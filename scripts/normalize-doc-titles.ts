/**
 * 결재 서식 큰 제목(docTitle) 띄어쓰기 바로잡기 — 글자마다 띄어 쓴 제목('법 인 카 드 사 용 내 역 서')을
 * 서식 이름과 같은 평범한 제목('법인카드 사용 내역서')으로 바꾼다. 격식 있게 띄우는 건 화면이 맡는다(docTitle.ts).
 *
 *   npx tsx scripts/normalize-doc-titles.ts                 # 개발 DB, 확인만
 *   npx tsx scripts/normalize-doc-titles.ts --apply         # 개발 DB, 적용
 *   npx tsx scripts/normalize-doc-titles.ts --prod          # 운영 DB, 확인만
 *   npx tsx scripts/normalize-doc-titles.ts --prod --apply  # 운영 DB, 적용
 *
 * - 바꾸는 칸은 docTitle 하나뿐이다(Appwrite updateDocument 는 보낸 칸만 고친다).
 * - 새 제목은 서식 이름. 단, 띄어쓰기를 걷은 글자가 서식 이름과 다르면(예: 제목에만 없는 글자) 바꾸지 않고 목록으로 알린다
 *   — 그 서식은 서식 편집 화면에서 직접 고친다.
 * - 바꾸기 전 값을 화면에 남긴다(되돌릴 때 쓴다).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases, Query, type Models } from 'node-appwrite';

const isProd = process.argv.includes('--prod');
const apply = process.argv.includes('--apply');

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*"?([^"#]*)"?`));
    if (m) return m[1].trim();
  }
  return undefined;
}

const endpoint = readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT');
const projectId = isProd ? '6a6bf85e002acb7f71d6' : (readEnv('APPWRITE_PROJECT_ID') ?? readEnv('VITE_APPWRITE_PROJECT_ID'));
const apiKey = isProd ? readEnv('APPWRITE_API_KEY_PROD') : (readEnv('APPWRITE_API_KEY_DEV') ?? readEnv('APPWRITE_API_KEY'));
const DB = readEnv('APPWRITE_DATABASE_ID') ?? readEnv('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';
if (!endpoint || !projectId || !apiKey) throw new Error('Appwrite 접속 정보가 .env.local 에 없습니다.');

const dbs = new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));
type Form = Models.Document & { name?: string; docTitle?: string };

/** 글자마다 한 칸씩 띄어 쓴 제목인가('기 안 서') */
const SPACED_EVERY_CHAR = /^\S( \S)+$/;
/** 띄어쓰기·문장부호를 뺀 글자(서식 이름과 같은 제목인지 볼 때) */
const letters = (s: string) => s.replace(/[\s/()·.,-]/g, '');

async function allForms(): Promise<Form[]> {
  const out: Form[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await dbs.listDocuments<Form>(DB, 'approvalForms', [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    out.push(...page.documents);
    if (page.documents.length < 100) return out;
    cursor = page.documents[page.documents.length - 1].$id;
  }
}

async function main() {
  console.log(`${isProd ? '운영' : '개발'} DB · ${apply ? '적용' : '확인만(--apply 로 적용)'}\n`);
  const forms = await allForms();
  const change: { form: Form; from: string; to: string }[] = [];
  const skipped: { form: Form; title: string }[] = [];
  for (const form of forms) {
    const title = (form.docTitle ?? '').trim();
    if (!SPACED_EVERY_CHAR.test(title)) continue;
    const name = (form.name ?? '').trim();
    if (name && letters(title) === letters(name)) change.push({ form, from: title, to: name });
    else skipped.push({ form, title });
  }

  console.log(`바꿀 서식 ${change.length}개`);
  for (const c of change) console.log(`  ${c.form.$id}  "${c.from}"  →  "${c.to}"`);
  if (skipped.length) {
    console.log(`\n이름과 글자가 달라 건너뛴 서식 ${skipped.length}개(서식 편집 화면에서 직접 고치세요)`);
    for (const s of skipped) console.log(`  ${s.form.$id}  이름 "${s.form.name}"  제목 "${s.title}"`);
  }
  if (!apply) return;

  for (const c of change) {
    await dbs.updateDocument(DB, 'approvalForms', c.form.$id, { docTitle: c.to });
    console.log(`  바꿈: ${c.form.$id} "${c.to}"`);
  }
  console.log('\n끝. 되돌리려면 위 "바꿀 서식" 목록의 왼쪽 값으로 docTitle 을 다시 넣으면 된다.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
