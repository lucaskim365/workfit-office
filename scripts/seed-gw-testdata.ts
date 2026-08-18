/**
 * 업무 모듈 테스트 데이터 적재기 — 일정관리·자원예약·업무관리·전자설문.
 *
 * 데이터는 `scripts/gw-testdata.json`(컬렉션 id → 레코드 배열)에서 읽는다.
 * 적재 전에 **실제 도메인 zod 스키마로 검증**한다. 앱이 읽을 때와 같은 규칙이라,
 * 여기서 통과하면 화면에서 파싱 실패로 사라지는 일이 없다.
 *
 * 실행:
 *   npx tsx scripts/seed-gw-testdata.ts --target dev            # 드라이런(검증만)
 *   npx tsx scripts/seed-gw-testdata.ts --target dev --commit   # 실제 적재
 *   npx tsx scripts/seed-gw-testdata.ts --target prod --commit
 *   npx tsx scripts/seed-gw-testdata.ts --target prod --purge   # 이 파일에 있는 id 전부 삭제
 *
 * env(.env.local): dev 는 APPWRITE_API_KEY_DEV, prod 는 APPWRITE_API_KEY_PROD.
 * 엔드포인트·DB 는 VITE_APPWRITE_ENDPOINT / VITE_APPWRITE_DATABASE_ID 를 쓴다.
 * ⚠ VITE_APPWRITE_PROJECT_ID 는 보지 않는다 — dev 를 가리키고 있어 prod 적재를 오염시킨다.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calendarEventSchema } from '@/domain/calendarEvent/schema';
import { resourceSchema } from '@/domain/resource/schema';
import { reservationSchema } from '@/domain/reservation/schema';
import { workProjectSchema } from '@/domain/workProject/schema';
import { workPhaseSchema } from '@/domain/workPhase/schema';
import { workTaskSchema } from '@/domain/workTask/schema';
import { surveySchema } from '@/domain/survey/schema';
import { surveyQuestionSchema } from '@/domain/surveyQuestion/schema';

const PROJECTS = {
  dev: { id: '6a8288390007f641306d', keyVar: 'APPWRITE_API_KEY_DEV' },
  prod: { id: '6a6bf85e002acb7f71d6', keyVar: 'APPWRITE_API_KEY_PROD' },
} as const;

/** 적재 순서 — 참조되는 쪽을 먼저 넣는다. */
const ORDER = [
  'calendarEvents',
  'resources',
  'resourceReservations',
  'workProjects',
  'workPhases',
  'workTasks',
  'surveys',
  'surveyQuestions',
] as const;

type Coll = (typeof ORDER)[number];

const VALIDATORS: Record<Coll, { safeParse: (v: unknown) => { success: boolean; error?: unknown } }> = {
  calendarEvents: calendarEventSchema,
  resources: resourceSchema,
  resourceReservations: reservationSchema,
  workProjects: workProjectSchema,
  workPhases: workPhaseSchema,
  workTasks: workTaskSchema,
  surveys: surveySchema,
  surveyQuestions: surveyQuestionSchema,
};

/** Appwrite 는 중첩 객체를 못 담는다 — 이 필드는 JSON 문자열로 직렬화한다(crudBackend 와 동일 규칙). */
const JSON_FIELDS: Partial<Record<Coll, string[]>> = {
  surveyQuestions: ['options'],
};

// ── env ──
function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n\\r]*)"?`));
    if (m) return m[1].trim();
  }
  return undefined;
}

const args = process.argv.slice(2);
const target = (args[args.indexOf('--target') + 1] ?? '') as keyof typeof PROJECTS;
const commit = args.includes('--commit');
const purge = args.includes('--purge');

if (!PROJECTS[target]) {
  console.error('사용법: --target dev|prod [--commit] [--purge]');
  process.exit(1);
}

const endpoint = readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT');
const dbId = readEnv('APPWRITE_DATABASE_ID') ?? readEnv('VITE_APPWRITE_DATABASE_ID');
const projectId = PROJECTS[target].id;
const apiKey = readEnv(PROJECTS[target].keyVar);

if (!endpoint || !dbId || !apiKey) {
  console.error(`env 부족: endpoint=${!!endpoint} db=${!!dbId} ${PROJECTS[target].keyVar}=${!!apiKey}`);
  process.exit(1);
}

const H = { 'content-type': 'application/json', 'x-appwrite-project': projectId, 'x-appwrite-key': apiKey };
const docUrl = (coll: string, id: string) => `${endpoint}/databases/${dbId}/collections/${coll}/documents/${id}`;

// ── 데이터 로드 ──
const dataPath = resolve(process.cwd(), 'scripts/gw-testdata.json');
if (!existsSync(dataPath)) {
  console.error(`데이터 파일 없음: ${dataPath}`);
  process.exit(1);
}
const data = JSON.parse(readFileSync(dataPath, 'utf8')) as Record<string, Array<Record<string, unknown>>>;

console.log(`대상: ${target} (${projectId}) / DB ${dbId}`);
console.log(`모드: ${purge ? 'PURGE(삭제)' : commit ? 'COMMIT(적재)' : 'DRY-RUN(검증만)'}\n`);

// ── 1) 검증 ──
let invalid = 0;
const ids: Array<{ coll: string; id: string }> = [];
for (const coll of ORDER) {
  const rows = data[coll] ?? [];
  if (!rows.length) continue;
  const seen = new Set<string>();
  for (const row of rows) {
    const id = String(row.id ?? '');
    if (!id) { console.error(`  ✗ ${coll}: id 없는 레코드`); invalid++; continue; }
    if (seen.has(id)) { console.error(`  ✗ ${coll}/${id}: id 중복`); invalid++; }
    seen.add(id);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(id)) {
      console.error(`  ✗ ${coll}/${id}: Appwrite $id 규격 위반`); invalid++;
    }
    const parsed = VALIDATORS[coll].safeParse(row);
    if (!parsed.success) {
      const issues = (parsed.error as { issues?: Array<{ path: unknown[]; message: string }> })?.issues ?? [];
      console.error(`  ✗ ${coll}/${id}: ${issues.map((i) => `${i.path.join('.')} — ${i.message}`).join(' / ')}`);
      invalid++;
    }
    ids.push({ coll, id });
  }
  console.log(`  ${coll.padEnd(22)} ${String(rows.length).padStart(3)}건`);
}

if (invalid) {
  console.error(`\n✗ 스키마 검증 실패 ${invalid}건 — 적재하지 않는다.`);
  process.exit(1);
}
console.log(`\n✓ 스키마 검증 통과 (총 ${ids.length}건)`);

// ── 2) 쓰기 ──
const toRow = (coll: Coll, row: Record<string, unknown>) => {
  const out = { ...row };
  for (const f of JSON_FIELDS[coll] ?? []) out[f] = out[f] == null ? null : JSON.stringify(out[f]);
  return out;
};

async function upsert(coll: string, id: string, body: Record<string, unknown>) {
  const put = await fetch(docUrl(coll, id), { method: 'PATCH', headers: H, body: JSON.stringify({ data: body }) });
  if (put.ok) return 'updated';
  if (put.status !== 404) throw new Error(`${coll}/${id} PATCH ${put.status} ${(await put.text()).slice(0, 200)}`);
  const created = await fetch(`${endpoint}/databases/${dbId}/collections/${coll}/documents`, {
    method: 'POST', headers: H, body: JSON.stringify({ documentId: id, data: body }),
  });
  if (!created.ok) throw new Error(`${coll}/${id} POST ${created.status} ${(await created.text()).slice(0, 200)}`);
  return 'created';
}

if (purge) {
  let gone = 0;
  for (const { coll, id } of [...ids].reverse()) {
    const r = await fetch(docUrl(coll, id), { method: 'DELETE', headers: H });
    if (r.ok || r.status === 404) gone++;
    else console.error(`  ✗ 삭제 실패 ${coll}/${id}: ${r.status}`);
  }
  console.log(`\n✓ 삭제 완료 ${gone}/${ids.length}건`);
} else if (commit) {
  const stat = { created: 0, updated: 0 };
  for (const coll of ORDER) {
    for (const row of data[coll] ?? []) {
      const r = await upsert(coll, String(row.id), toRow(coll, row));
      stat[r as 'created' | 'updated']++;
    }
  }
  console.log(`\n✓ 적재 완료 — 생성 ${stat.created} / 갱신 ${stat.updated}`);
  writeFileSync(
    resolve(process.cwd(), `scripts/gw-testdata.${target}.manifest.json`),
    JSON.stringify(ids, null, 2),
    'utf8',
  );
  console.log(`  적재 id 목록: scripts/gw-testdata.${target}.manifest.json (삭제 시 --purge)`);
} else {
  console.log('  (드라이런 — 실제 적재하려면 --commit)');
}
