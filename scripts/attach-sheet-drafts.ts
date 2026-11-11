/**
 * 기존 서식에 시트 초안 일괄로 붙이기 — 항목 목록이 있는 서식마다 자동 변환(legacyFormToSheet) 결과를 새 시트 버전으로 쌓는다.
 * 시트 기안 스위치는 건드리지 않는다(없으면 꺼짐 — 기안은 기존 양식 그대로). 관리자가 미리보기로 확인한 뒤 서식 관리에서 켠다.
 * 서식 기록(approvalForms)은 읽기만 한다. 쓰는 곳은 시트 버전 컬렉션(approvalFormVersions)뿐이다.
 *
 *   npx tsx scripts/attach-sheet-drafts.ts                       # 개발 DB, 확인만
 *   npx tsx scripts/attach-sheet-drafts.ts --apply               # 개발 DB, 적용
 *   npx tsx scripts/attach-sheet-drafts.ts --prod                # 운영 DB, 확인만
 *   npx tsx scripts/attach-sheet-drafts.ts --only=휴가,외근 ...    # 이 서식 코드만
 *
 * - 다시 돌려도 된다: 최신 버전이 이 스크립트가 쌓은 것(메모가 AUTO_NOTE)이면 새 변환 결과를 그 위에 쌓는다(틀이 같으면 건너뜀).
 *   버전은 고치지 않고 쌓기만 하므로 이전 초안도 남고, 기안에는 최신 버전이 쓰인다.
 * - 관리자가 손본 버전이 최신이면 건너뛴다. --force 를 주면 그 위에 새 초안을 쌓는다(손본 버전은 남지만 최신이 아니게 됨).
 * - 이미 시트로 기안 중(스위치 켜짐)인 서식은 --force 여도 건너뛴다(기안자 화면이 바로 바뀌므로 서식 관리에서 직접).
 * - 시스템 서식(취소신청)·항목이 없는 서식(처음부터 시트로 만든 서식)은 건너뛴다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases, Query, type Models } from 'node-appwrite';
import { approvalFormSchema, type ApprovalForm } from '@/domain/approvalForm/schema';
import { SHEET_VERSION_MAX_CHARS, versionKey } from '@/domain/approvalForm/sheetVersion';
import { legacyFormToSheet } from '@/modules/gw/approval/sheetForm/fromLegacyForm';
import { safeDocId } from '@/shared/lib/appwrite';

const isProd = process.argv.includes('--prod');
const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');
const only = new Set(
  (process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

/** 이 스크립트가 쌓은 버전의 메모 — 다시 돌릴 때 '자동 초안'인지 알아본다 */
const AUTO_NOTE = '자동 변환 초안(일괄)';
const BY = { id: 'system', name: '자동 변환' };

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

type Doc = Models.Document & Record<string, unknown>;

async function all(coll: string, queries: string[] = []): Promise<Doc[]> {
  const out: Doc[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await dbs.listDocuments<Doc>(DB, coll, [...queries, Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    out.push(...page.documents);
    if (page.documents.length < 100) return out;
    cursor = page.documents[page.documents.length - 1].$id;
  }
}

/**
 * 틀 비교용 — 변환할 때마다 열 키(c_xxxxxx)·반복 구간 id(rep_xxxxxx)가 새로 뽑히므로 나온 차례대로 번호로 바꿔 내용만 비교한다
 */
function canonical(sheet: unknown): string {
  const json = typeof sheet === 'string' ? sheet : JSON.stringify(sheet ?? null);
  const seen = new Map<string, string>();
  return json.replace(/\b(?:c|rep)_[a-z0-9]{6}\b/g, (id) => {
    if (!seen.has(id)) seen.set(id, `#${seen.size}`);
    return seen.get(id)!;
  });
}

/** 서식 항목(fields)은 JSON 글자 배열로 저장될 수 있다 */
const decode = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? JSON.parse(x) : x)) : typeof v === 'string' && v ? JSON.parse(v) : v);

async function main() {
  console.log(`${isProd ? '운영' : '개발'} DB · ${apply ? '적용' : '확인만(--apply 로 적용)'}${force ? ' · --force' : ''}${only.size ? ` · 서식 ${[...only].join(',')}` : ''}\n`);
  const forms = (await all('approvalForms'))
    .map((raw) => approvalFormSchema.safeParse({ ...raw, fields: decode(raw.fields) }))
    .filter((p): p is { success: true; data: ApprovalForm } => p.success)
    .map((p) => p.data);
  const heads = await all('approvalFormVersions', [Query.select(['formId', 'version', 'note'])]);
  const latest = new Map<string, { version: number; note: string }>();
  for (const h of heads) {
    const formId = String(h.formId);
    const v = Number(h.version);
    if ((latest.get(formId)?.version ?? 0) < v) latest.set(formId, { version: v, note: String(h.note ?? '') });
  }
  const switchedOn = new Set((await all('approvalSheetSwitches')).filter((s) => s.applied === true).map((s) => String(s.formId)));

  const plan: { form: ApprovalForm; version: number; sheet: string; link: string | null; warnings: string[] }[] = [];
  const skipped: string[] = [];
  for (const form of forms.sort((a, b) => a.name.localeCompare(b.name))) {
    if (only.size && !only.has(form.code)) continue;
    const name = `${form.name}(${form.code})`;
    if (form.system) continue;
    if (!form.fields.length) {
      skipped.push(`${name} — 항목이 없는 서식(처음부터 시트로 만든 서식)`);
      continue;
    }
    if (switchedOn.has(form.id)) {
      skipped.push(`${name} — 이미 시트로 기안 중(서식 관리에서 직접 고치세요)`);
      continue;
    }
    const cur = latest.get(form.id);
    if (cur && cur.note !== AUTO_NOTE && !force) {
      skipped.push(`${name} — 관리자가 손본 시트 v${cur.version} 이 있음(--force 로만 그 위에 쌓음)`);
      continue;
    }
    const { sheet, link, warnings } = legacyFormToSheet(form);
    const json = JSON.stringify(sheet);
    if (json.length > SHEET_VERSION_MAX_CHARS) {
      skipped.push(`${name} — 틀이 너무 큼(${json.length}자)`);
      continue;
    }
    if (cur) {
      const prev = await dbs.getDocument<Doc>(DB, 'approvalFormVersions', safeDocId(versionKey(form.id, cur.version)));
      if (canonical(prev.sheet) === canonical(json)) {
        skipped.push(`${name} — 최신 자동 초안 v${cur.version} 과 같음`);
        continue;
      }
    }
    plan.push({ form, version: (cur?.version ?? 0) + 1, sheet: json, link, warnings });
  }

  console.log(`시트 초안을 붙일 서식 ${plan.length}개`);
  for (const p of plan) {
    console.log(`  ${p.form.name}(${p.form.code}) → v${p.version}${p.link ? ` · 연동 ${p.link}` : ''}`);
    for (const w of p.warnings) console.log(`      · ${w}`);
  }
  if (skipped.length) {
    console.log(`\n건너뜀 ${skipped.length}개`);
    for (const s of skipped) console.log(`  ${s}`);
  }
  if (!apply) return;

  console.log('');
  for (const p of plan) {
    const now = new Date().toISOString();
    await dbs.createDocument(DB, 'approvalFormVersions', safeDocId(versionKey(p.form.id, p.version)), {
      formId: p.form.id,
      version: p.version,
      sheet: p.sheet,
      note: AUTO_NOTE,
      link: p.link,
      createdBy: BY.id,
      createdByName: BY.name,
      createdAt: now,
    });
    console.log(`  붙임: ${p.form.name} v${p.version}`);
  }
  console.log('\n끝. 시트 기안 스위치는 꺼진 그대로입니다 — 서식 관리에서 미리보기로 확인한 뒤 서식마다 켜세요.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
