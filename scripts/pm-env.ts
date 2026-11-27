/**
 * PM 스크립트 공용 안전장치 (설계 5.7.6 · K7 · 11/26 사용자 지시 "그룹웨어 다른 데이터에 영향이 없는지" · 5.7.20 운영 길).
 * pm-schema · pm-import · pm-drop · pm-zz-check · pm-k5 가 쓴다.
 *
 * 1. 기본 = 개발 DB. `.env`(없으면 `.env.local`) 에서 **아래 이름만** 골라 읽고 다른 줄은 이름도 보지 않는다.
 *    프로젝트 ID 가 운영 ID 이면 거절. `--prod` 한 단어는 언제나 거절.
 * 2. 운영 = `--prod-project=<운영 ID 를 손으로 친 값>` 이 `PROD_PROJECT_ID` 와 글자 그대로 같고, 그 스크립트가 운영 길을 허락할 때만
 *    (`prodOk` — pm-k5 는 안 줌). 운영 길은 `VITE_APPWRITE_ENDPOINT` · `VITE_APPWRITE_DATABASE_ID` · `APPWRITE_API_KEY_PROD` 만 읽고
 *    프로젝트 ID 는 코드 상수. 운영 열쇠가 없으면 멈춤 (개발 열쇠로 안 넘어감).
 * 3. 운영 쓰기는 `--confirm=<미리보기가 알려 준 수>` 가 같을 때만 (`requireConfirm`).
 * 4. 운영 길은 첫 줄을 크게 찍고, 모든 출력 줄을 `C:/dev/pm-migration/8/` 기록 파일에도 남김 (열쇠 값은 `***`).
 * 5. 쓰거나 지우는 컬렉션 이름은 `PM_COLLS` 23개와 글자 그대로 같아야 한다 (pm 으로 시작하는지만 보지 않음).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { PM_COLLS } from '../src/data/pm/pmDb';

/** 운영 프로젝트 — 기본 길에선 거절, 운영 길에선 이 값만 */
export const PROD_PROJECT_ID = '6a6bf85e002acb7f71d6';
/** 운영 길 실행 기록 · 지우기 사본 (저장소 밖) */
export const PROD_LOG_DIR = 'C:/dev/pm-migration/8';
/** 개발 길이 읽는 이름 */
const DEV_NAMES = ['VITE_APPWRITE_ENDPOINT', 'VITE_APPWRITE_PROJECT_ID', 'VITE_APPWRITE_DATABASE_ID', 'APPWRITE_API_KEY'] as const;
/** 운영 길이 읽는 이름 (프로젝트 ID 는 상수, 개발 열쇠는 안 읽음) */
const PROD_NAMES = ['VITE_APPWRITE_ENDPOINT', 'VITE_APPWRITE_DATABASE_ID', 'APPWRITE_API_KEY_PROD'] as const;

/** PM 컬렉션 23개 이름 (글자 그대로) */
export const PM_COLL_NAMES: readonly string[] = PM_COLLS.map((c) => c.name);

export interface DevDb { endpoint: string; project: string; database: string; key: string; prod: boolean }

/** env 글(여러 파일을 앞에서부터)에서 고른 이름만 — 줄 이름이 정확히 같을 때만, 먼저 나온 값 */
export function pickEnv(texts: readonly string[], names: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const text of texts) {
    for (const line of text.split(/\r?\n/)) {
      const at = line.indexOf('=');
      if (at < 0) continue;
      const name = line.slice(0, at).trim();
      if (!names.includes(name) || out[name]) continue;
      // 값 = 따옴표 안, 따옴표가 없으면 뒤 주석(' #…') 뺀 것
      const rest = line.slice(at + 1).trim();
      const q = rest.match(/^"([^"]*)"|^'([^']*)'/);
      out[name] = q ? (q[1] ?? q[2]) : rest.replace(/\s+#.*$/, '').trim();
    }
  }
  return out;
}

export type Resolved = { ok: true; db: DevDb } | { ok: false; msg: string };

/** 순수 판정 — 어느 DB 로 갈지 (테스트 대상). argv 는 process.argv 그대로 */
export function resolveDb(argv: readonly string[], envTexts: readonly string[], opts: { prodOk?: boolean } = {}): Resolved {
  if (argv.some((a) => a === '--prod' || (a.startsWith('--prod') && !a.startsWith('--prod-project')))) return { ok: false, msg: '--prod 한 단어는 PM 스크립트에서 쓰지 않습니다 — 운영은 --prod-project=<운영 프로젝트 ID 를 손으로> (8단계 · 사용자 허락 뒤)' };
  const typed = argv.filter((a) => a.startsWith('--prod-project'));
  // 개발 길에 운영 열쇠가 끼지 않게 — 운영 길이 아니면 PROD_NAMES 의 열쇠 이름은 읽지 않음 (아래 DEV_NAMES 만)
  if (typed.length > 1) return { ok: false, msg: '--prod-project 가 두 번 있습니다' };
  if (typed.length === 1) {
    if (!opts.prodOk) return { ok: false, msg: '이 스크립트는 운영 길이 없습니다 (--prod-project 거절)' };
    const v = typed[0].startsWith('--prod-project=') ? typed[0].slice('--prod-project='.length) : '';
    if (v !== PROD_PROJECT_ID) return { ok: false, msg: `--prod-project 값 "${v}" 이 운영 프로젝트 ID 와 다릅니다 — 열지 않음` };
    const env = pickEnv(envTexts, PROD_NAMES);
    const db = { endpoint: env.VITE_APPWRITE_ENDPOINT ?? '', project: PROD_PROJECT_ID, database: env.VITE_APPWRITE_DATABASE_ID || 'workfit', key: env.APPWRITE_API_KEY_PROD ?? '', prod: true };
    if (!db.endpoint) return { ok: false, msg: '운영 접속 값이 없습니다 (.env 의 VITE_APPWRITE_ENDPOINT)' };
    if (!db.key) return { ok: false, msg: '운영 열쇠 APPWRITE_API_KEY_PROD 가 없습니다 — 개발 열쇠로 넘어가지 않고 멈춤' };
    return { ok: true, db };
  }
  const env = pickEnv(envTexts, DEV_NAMES);
  const db = { endpoint: env.VITE_APPWRITE_ENDPOINT ?? '', project: env.VITE_APPWRITE_PROJECT_ID ?? '', database: env.VITE_APPWRITE_DATABASE_ID || 'workfit', key: env.APPWRITE_API_KEY ?? '', prod: false };
  if (!db.endpoint || !db.project || !db.key) return { ok: false, msg: '개발 DB 접속 값이 없습니다 (.env 의 VITE_APPWRITE_ENDPOINT · VITE_APPWRITE_PROJECT_ID · APPWRITE_API_KEY)' };
  if (db.project === PROD_PROJECT_ID) return { ok: false, msg: `운영 프로젝트(${PROD_PROJECT_ID})는 기본 길에서 거절합니다 — 운영은 --prod-project=<ID>` };
  return { ok: true, db };
}

function envTexts(): string[] {
  return ['.env', '.env.local'].map((f) => resolve(process.cwd(), f)).filter((p) => existsSync(p)).map((p) => readFileSync(p, 'utf8'));
}

/** 접속 값 + 첫 줄. 운영이면 실행 기록 시작. mode = 기록 파일 이름에 들어갈 '미리보기 | 쓰기 | 대조' */
export function pmDb(label: string, opts: { prodOk?: boolean; mode?: string } = {}): DevDb {
  const r = resolveDb(process.argv, envTexts(), opts);
  if (!r.ok) fail(r.msg);
  const v = r.db;
  if (v.prod) startProdLog(v.key, opts.mode ?? '미리보기');
  console.log(`${v.prod ? `▶▶ 운영 (${v.project}) ◀◀ ` : '▶ '}${label} — endpoint ${v.endpoint} / project ${v.project} / database ${v.database}`);
  if (v.prod) console.log('  운영 열쇠 = APPWRITE_API_KEY_PROD (값은 찍지 않음)');
  return v;
}

/** 운영 쓰기 문 — `--confirm=<n>` 이 같을 때만 null. 다르면 이유 (순수, 테스트 대상) */
export function confirmError(argv: readonly string[], n: number, what: string): string | null {
  const got = argv.find((a) => a.startsWith('--confirm='))?.slice('--confirm='.length);
  return got === String(n) ? null : `--confirm=${got ?? '(없음)'} 이 ${what} ${n} 과 다릅니다 — 쓰지 않고 멈춤 (실행하려면 --confirm=${n})`;
}
export function requireConfirm(n: number, what: string): void {
  const e = confirmError(process.argv, n, what);
  if (e) fail(e);
}

/** 공용 appwrite-schema.ts 자식 인자 (순수, 테스트 대상) — `--only` 없는 인자는 만들 수 없음 */
export function sharedArgs(only: readonly string[], o: { dryRun: boolean; prod: boolean }): string[] {
  if (!only.length) throw new Error('--only 대상이 비었습니다');
  for (const n of only) if (!PM_COLL_NAMES.includes(n)) throw new Error(`PM 컬렉션 23개 목록 밖의 이름 "${n}"`);
  return ['--import', 'tsx', 'scripts/appwrite-schema.ts', `--only=${only.join(',')}`, '--new-only', ...(o.dryRun ? ['--dry-run'] : []), ...(o.prod ? ['--prod'] : [])];
}
/** 자식 환경 — 고른 값만 덮어씀. 운영이면 두 열쇠 이름 모두 운영 열쇠 (공용 스크립트가 _PROD 없을 때 개발 열쇠로 넘어가는 길을 막음) */
export function sharedEnv(base: NodeJS.ProcessEnv, db: DevDb): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, APPWRITE_ENDPOINT: db.endpoint, APPWRITE_PROJECT_ID: db.project, APPWRITE_DATABASE_ID: db.database, APPWRITE_API_KEY: db.key };
  if (db.prod) env.APPWRITE_API_KEY_PROD = db.key;
  else delete env.APPWRITE_API_KEY_PROD;
  return env;
}
/** 자식 dry-run 출력이 우리가 부른 대로인지 (순수) — 운영 쓰기 직전 확인 */
export function sharedHeadError(out: string, db: DevDb, only: readonly string[]): string | null {
  if (!out.includes(`project ${db.project} / db ${db.database}`)) return `자식 첫 줄의 project · db 가 ${db.project} / ${db.database} 가 아님`;
  const lines = out.split(/\r?\n/).map((l) => l.trim());
  if (!lines.includes(`대상 한정: ${only.join(', ')}`)) return '자식의 대상 한정 줄이 부른 이름과 글자 그대로 같지 않음';
  if (!out.includes('새 컬렉션 생성만')) return '자식이 새 컬렉션 생성만 모드가 아님';
  return null;
}

/** 쓰거나 지울 컬렉션이 PM 23개 안인지 (글자 그대로) — 밖이면 멈춤 */
export function assertPmColl(name: string): void {
  if (!PM_COLL_NAMES.includes(name)) fail(`PM 컬렉션 23개 목록 밖의 이름 "${name}" — 쓰거나 지우지 않고 멈춤`);
}

/** 넣을 줄 vs DB 문서 비교 (순수, 테스트 대상) — 줄에 있는 칸만, 없음(undefined) = null */
export function sameRow(row: Record<string, unknown>, doc: Record<string, unknown>): string[] {
  const norm = (v: unknown) => JSON.stringify(v === undefined ? null : v);
  return Object.keys(row).filter((k) => norm(row[k]) !== norm(doc[k]));
}
export interface RowDiff { missing: string[]; extra: string[]; changed: string[]; same: number }
/** 컬렉션 하나: want = 문서 $id → 넣을 줄, got = DB 문서 $id → 문서 */
export function compareRows(want: ReadonlyMap<string, Record<string, unknown>>, got: ReadonlyMap<string, Record<string, unknown>>): RowDiff {
  const d: RowDiff = { missing: [], extra: [], changed: [], same: 0 };
  for (const [id, row] of want) {
    const doc = got.get(id);
    if (!doc) { d.missing.push(id); continue; }
    const k = sameRow(row, doc);
    if (k.length) d.changed.push(`${id}(${k.join(',')})`); else d.same++;
  }
  for (const id of got.keys()) if (!want.has(id)) d.extra.push(id);
  return d;
}

// ── 운영 실행 기록 ─────────────────────────────────────────
let logFile: string | null = null;
/** 기록 파일 이름 — `<시각>-<스크립트>-<모드>.log` (순수) */
export function prodLogName(now: Date, script: string, mode: string): string {
  const t = now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/[-:]/g, '').replace(' ', '-');
  return `${t}-${script}-${mode}.log`;
}
function startProdLog(key: string, mode: string) {
  mkdirSync(PROD_LOG_DIR, { recursive: true });
  const script = basename(process.argv[1] ?? 'pm', '.ts');
  logFile = join(PROD_LOG_DIR, prodLogName(new Date(), script, mode));
  const hide = (s: string) => (key ? s.split(key).join('***') : s);
  const put = (s: string) => appendFileSync(logFile as string, hide(s) + '\n', 'utf8');
  put(`# ${script} ${mode} — 시작 ${stampNow()}`);
  put(`# 인자: ${process.argv.slice(2).join(' ')}`);
  for (const k of ['log', 'error'] as const) {
    const orig = console[k].bind(console);
    console[k] = (...a: unknown[]) => { orig(...a); put(a.map((x) => (typeof x === 'string' ? x : x instanceof Error ? x.message : JSON.stringify(x))).join(' ')); };
  }
  process.on('exit', (code) => put(`# 끝 ${stampNow()} · exit ${code}`));
  console.log(`  실행 기록: ${logFile}`);
}

export function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/** 시각 (초까지, 한국 시각) — 7-4 · 7-5 시작 · 끝 보고용 */
export const stampNow = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
