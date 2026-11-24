/**
 * 프로젝트 관리(PM) 옮기기 — 지금은 **미리보기(dry-run)만** 한다. DB에 쓰지 않는다.
 * ([[2026-11-24-pms-port-design]] §4·5장 1.5단계 · 실제 쓰기는 7단계, 허락 후)
 *
 * 실행:
 *   npx tsx scripts/pm-import.ts --dry-run --state=C:/dev/pm-migration/state-20261124.json
 *     [--demo=<데모 HTML>]      계획서 PDF 지정(PLAN_LINK)을 읽음. 기본 = 바탕화면 프관 데모
 *     [--plans=<사업계획서 폴더>] 기본 = 데모 옆 `사업계획서/`
 *     [--users=<json>]          그룹웨어 사용자 목록 파일. 없으면 개발 DB `users` 를 **읽기만**
 *     [--out=<md 경로>]          보고서. 기본 = state 파일 옆 `dryrun-YYYYMMDD.md` (실제 이름이 있어 저장소 밖)
 *
 * 읽기만 하는 것: state.json · 데모 HTML · 계획서 폴더 목록 · 개발 DB users (listDocuments).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Client, Databases, Query } from 'node-appwrite';
import { buildImportPreview, type DemoState, type GwUserLite, type ImportPreview } from '../src/data/pm/importPlan';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => process.argv.includes(`--${name}`);

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  for (const f of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\r\\n]*)"?`));
      if (m) return m[1].trim();
    }
  }
  return undefined;
}

async function loadUsers(file?: string): Promise<{ users: GwUserLite[]; from: string }> {
  if (file) return { users: JSON.parse(readFileSync(file, 'utf8')), from: file };
  const endpoint = readEnv('VITE_APPWRITE_ENDPOINT');
  const project = readEnv('VITE_APPWRITE_PROJECT_ID');
  const dbId = readEnv('VITE_APPWRITE_DATABASE_ID') || 'workfit';
  const key = readEnv('APPWRITE_API_KEY'); // 개발 키만. 운영 키(APPWRITE_API_KEY_PROD)는 쓰지 않음
  if (!endpoint || !project || !key) throw new Error('개발 DB 접속 정보(.env)가 없습니다. --users=<json> 으로 주세요');
  const db = new Databases(new Client().setEndpoint(endpoint).setProject(project).setKey(key));
  const users: GwUserLite[] = [];
  let cursor: string | undefined;
  for (;;) {
    const q = [Query.limit(100), Query.select(['$id', 'name', 'dept', 'position', 'status', 'resignedAt'])];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await db.listDocuments(dbId, 'users', q);
    for (const d of res.documents) {
      const r = d as unknown as Record<string, unknown>;
      users.push({ id: d.$id, name: String(r.name ?? ''), dept: String(r.dept ?? ''), position: String(r.position ?? ''), status: String(r.status ?? ''), resignedAt: String(r.resignedAt ?? '') });
    }
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return { users, from: `개발 DB ${project} users (읽기만)` };
}

/** 데모 HTML 의 `const PLAN_LINK = …({ P2:'…pdf', … })` */
function readPlanLinks(html: string): Record<string, string> {
  const start = html.indexOf('const PLAN_LINK');
  if (start < 0) return {};
  const block = html.slice(start, html.indexOf('}).map', start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(P\d+)\s*:\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
}

const esc = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head: string[], rows: unknown[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');

function toMarkdown(p: ImportPreview, meta: Record<string, string>): string {
  const inside = p.people.filter((x) => x.kind === '내부');
  const outside = p.people.filter((x) => x.kind !== '내부');
  return [
    `# PM 옮기기 미리보기 (dry-run) — ${meta.today}`,
    '',
    '> DB에 쓰지 않음. 실제 이름이 있어 저장소 밖에 둔다.',
    '',
    table(['원본·기준', '값'], Object.entries(meta)),
    '',
    '## 1. 들어갈 건수',
    table(['컬렉션', '건수', '원본', '비고'], p.counts.map((c) => [c.collection, c.count, c.source, c.note])),
    '',
    `## 2. 연결 끊김 (${p.broken.length}건) — 예전 WBS 번호에 묶인 기록`,
    '옮기되 "연결 끊김" 표시. 후보는 이름이 비슷한 새 업무(참고만, 자동으로 잇지 않음).',
    table(['종류', 'ID', '예전 번호', '제목', '상태', '참고 후보', '닮은 정도'], p.broken.map((b) => [b.kind, b.id, b.oldKey, b.title, b.status, b.candidate || '-', b.candidate ? b.candidateScore : '-'])),
    '',
    `## 3. 사람 — 내부 직원 ${inside.length}명 (그룹웨어 사용자와 짝짓기)`,
    table(['이름', '데모 직급', '데모 소속', '결과', '그룹웨어 소속', '기록에 쓰인 횟수'], inside.map((x) => [x.name, x.title, x.org, x.match, x.gwDept || '-', x.refs])),
    '',
    `### 외부 ${outside.length}명 — 사용자로 넣지 않고 이름 글자로 (§4.4)`,
    table(['이름', '직급', '구분', '소속', '기록에 쓰인 횟수'], outside.map((x) => [x.name, x.title, x.kind, x.org, x.refs])),
    '',
    p.unknownNames.length ? `기록에 나오지만 데모 사용자 목록에 없는 이름: ${p.unknownNames.join(', ')}` : '기록에 나오는 이름은 모두 데모 사용자 목록에 있음.',
    '',
    '## 4. 사업 — 내장 데이터 vs state.json',
    table(['사업', '도입기업', 'state 에 있음', '다른 칸', 'state 에만 있는 칸'], p.projects.map((r) => [r.k, r.company, r.inState ? '예' : '아니오', r.diffs.join(' · ') || '-', r.stateOnly.join(' · ') || '-'])),
    '',
    '## 5. 계획서 PDF 대조 (폴더 기준)',
    table(['사업', '도입기업', '파일', '폴더에 있음'], p.pdf.map((r) => [r.k, r.company, r.file || '(지정 없음)', r.found ? '예' : '아니오'])),
    '',
    '## 6. 이번에 옮기지 않거나 뒤 단계로 미루는 state.json 칸',
    table(['칸', '건수', '이유', '언제'], p.left.map((r) => [r.key, r.count, r.reason, r.when])),
    '',
    '## 7. 칸 설계 확인 (지금 zod 모양에 넣어 봄)',
    p.schemaErrors.length ? p.schemaErrors.map((e) => `- ${e}`).join('\n') : '- 오류 없음',
    '',
    '## 8. 문제점',
    p.problems.length ? p.problems.map((e) => `- ${e}`).join('\n') : '- 없음',
    '',
  ].join('\n');
}

async function main() {
  if (!flag('dry-run')) {
    console.error('지금은 --dry-run 만 됩니다. 실제 쓰기는 7단계(허락 후)에서 만듭니다.');
    process.exit(1);
  }
  const statePath = arg('state');
  if (!statePath) throw new Error('--state=<state.json 경로> 가 필요합니다');
  const demo = arg('demo') ?? join(process.env.USERPROFILE ?? '', 'Desktop', '프관', 'FactoryFlow_PM_데모.html');
  const plans = arg('plans') ?? join(dirname(demo), '사업계획서');
  const today = new Date().toISOString().slice(0, 10);
  const out = arg('out') ?? join(dirname(statePath), `dryrun-${today.replace(/-/g, '')}.md`);
  if (resolve(out).startsWith(resolve(process.cwd()))) throw new Error('보고서는 저장소 밖에 둡니다 (실제 이름 포함)');

  const raw = JSON.parse(readFileSync(statePath, 'utf8')) as { ver?: number; savedAt?: string; state: DemoState };
  const { users, from } = await loadUsers(arg('users'));
  const links = existsSync(demo) ? readPlanLinks(readFileSync(demo, 'utf8')) : {};
  const files = existsSync(plans) ? readdirSync(plans) : [];

  const preview = buildImportPreview(raw.state, users, { links, files }, today);
  const md = toMarkdown(preview, {
    today,
    'state.json': `${statePath} (ver ${raw.ver ?? '?'}, 저장 ${raw.savedAt ?? '?'})`,
    '그룹웨어 사용자': `${from} — ${users.length}명`,
    '계획서 폴더': `${plans} (${files.length}개 파일, PLAN_LINK ${Object.keys(links).length}개)`,
  });
  writeFileSync(out, md, 'utf8');

  console.log('▶ 미리보기 (DB 쓰기 없음)');
  for (const c of preview.counts) console.log(`  ${c.collection.padEnd(16)} ${String(c.count).padStart(4)}  ${c.note}`);
  console.log(`  연결 끊김 ${preview.broken.length} · 칸 오류 ${preview.schemaErrors.length} · 문제점 ${preview.problems.length}`);
  console.log(`  보고서: ${out}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
