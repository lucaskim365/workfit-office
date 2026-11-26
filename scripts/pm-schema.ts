/**
 * PM 컬렉션 23개 만들기 — 공용 `appwrite-schema.ts` 를 **새 컬렉션만 · PM 23개만** 으로 돌린다 (설계 5.7.6 7-4 · 5.7.13).
 *
 * 실행:
 *   npm run appwrite:schema:pm -- --dry-run            (미리보기 — 읽기만)
 *   npm run appwrite:schema:pm                         (23개 모두 없을 때 — 하나라도 있으면 멈춤)
 *   npm run appwrite:schema:pm -- --resume --dry-run   (이어 채우기 미리보기 — 읽기만)
 *   npm run appwrite:schema:pm -- --resume             (이어 채우기 — 빠진 컬렉션 · 빠진 인덱스만)
 *
 * 지키는 것 (`pm-env.ts`): 개발 DB 접속 값 4개만 읽음(운영 열쇠 이름은 안 읽음) · 운영 프로젝트 ID · `--prod` 거절.
 * 먼저 개발 DB 컬렉션 목록을 **읽기만** 한다. 공용 스크립트는 `--only=<만들 것> --new-only` 로만 부른다 — 기존 컬렉션 · 데이터는 읽지도 쓰지도 않음.
 *
 * --resume (7-4 중간 실패 뒤, 11/26 팀장 (가)): 있는 PM 컬렉션마다 정의(`pmSchemaPlan`)와 대조 —
 * '인덱스 빠짐' 말고 다른 차이가 하나라도 있으면 아무것도 안 쓰고 멈춤. 쓰기는 두 가지뿐:
 *   (a) 없는 컬렉션 = 공용 스크립트 `--only=<없는 것만> --new-only` (따로 프로세스)
 *   (b) 빠진 인덱스 = 여기서 createIndex — 'not yet available' 일 때만 5초 × 12번 다시, 다른 오류는 바로 멈춤
 * 수정 · 삭제 호출 없음. 끝나면 다시 읽어 23 · 속성 140 · 인덱스 25 · 전부 available 인지 찍음.
 */
import { spawnSync } from 'node:child_process';
import { Client, Databases, DatabasesIndexType, Query } from 'node-appwrite';
import { pmSchemaTotals, pmSchemaWant, resumePlan, type PmCollGot } from '../src/data/pm/pmSchemaPlan';
import { assertPmColl, devDb, fail, PM_COLL_NAMES, stampNow, type DevDb } from './pm-env';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const INDEX_RETRY = 12;
const INDEX_WAIT_MS = 5_000;

/** 읽기만: 컬렉션 전부 (속성 · 인덱스 포함) */
async function readColls(dbs: Databases, db: DevDb): Promise<PmCollGot[]> {
  const out: PmCollGot[] = [];
  for (let offset = 0; ; offset += 100) {
    const r = await dbs.listCollections(db.database, [Query.limit(100), Query.offset(offset)]);
    out.push(...(r.collections as unknown as PmCollGot[]));
    if (r.collections.length < 100) break;
  }
  return out;
}

/** 공용 스크립트를 따로 프로세스로 — 개발 값 4개만 환경으로 넘김 */
function runShared(db: DevDb, only: string[], dryRun: boolean): number {
  for (const n of only) assertPmColl(n);
  const args = ['--import', 'tsx', 'scripts/appwrite-schema.ts', `--only=${only.join(',')}`, '--new-only', ...(dryRun ? ['--dry-run'] : [])];
  const env = { ...process.env, APPWRITE_ENDPOINT: db.endpoint, APPWRITE_PROJECT_ID: db.project, APPWRITE_DATABASE_ID: db.database, APPWRITE_API_KEY: db.key };
  return spawnSync(process.execPath, args, { env, stdio: 'inherit' }).status ?? 1;
}

function printTotals(label: string, got: PmCollGot[]) {
  const pm = got.filter((g) => PM_COLL_NAMES.includes(g.$id));
  const attrs = pm.flatMap((g) => g.attributes);
  const idx = pm.flatMap((g) => g.indexes);
  const notAvail = [...attrs.map((a) => a.status), ...idx.map((i) => i.status)].filter((s) => s !== 'available').length;
  console.log(`  ${label}: 컬렉션 ${got.length} · PM ${pm.length} · 속성 ${attrs.length} · 인덱스 ${idx.length} · available 아닌 것 ${notAvail}`);
  return { pm: pm.length, attrs: attrs.length, idx: idx.length, notAvail };
}

async function resume(dbs: Databases, db: DevDb, dryRun: boolean) {
  const want = pmSchemaWant();
  const before = await readColls(dbs, db);
  printTotals('지금', before);
  const p = resumePlan(want, before.filter((g) => PM_COLL_NAMES.includes(g.$id)));
  console.log(`  있는 것 ${p.existing.length} · 차이 ${p.diffs.length} · 만들 컬렉션 ${p.createColls.length}${p.createColls.length ? ` (${p.createColls.join(', ')})` : ''} · 속성 ${p.attrs} · 인덱스 ${p.indexCount}`);
  for (const i of p.createIndexes) console.log(`  + 빠진 인덱스 ${i.coll}.${i.key} [${i.attributes.join(', ')}]`);
  if (p.diffs.length) { for (const d of p.diffs) console.log(`  ✗ 차이 ${d}`); fail(`'인덱스 빠짐' 말고 다른 차이 ${p.diffs.length}개 — 아무것도 쓰지 않고 멈춤`); }
  if (!p.createColls.length && !p.createIndexes.length) { console.log('  빠진 것 없음 · 쓰기 0'); return; }
  if (dryRun) {
    if (p.createColls.length) { console.log(''); runShared(db, p.createColls, true); }
    console.log(`  미리보기만 — 쓰기 0. 끝나면 맞아야 할 숫자: ${JSON.stringify(pmSchemaTotals(want))}`);
    return;
  }

  // (a) 없는 컬렉션 — 공용 스크립트 (같은 틈으로 끊겨도 아래 (b) 가 그 인덱스를 채움)
  if (p.createColls.length) {
    console.log('');
    const code = runShared(db, p.createColls, false);
    console.log(`  (a) 공용 스크립트 끝 (exit ${code})`);
  }
  // 다시 읽고 다시 대조 — (a) 가 남긴 것까지
  const mid = await readColls(dbs, db);
  const q = resumePlan(want, mid.filter((g) => PM_COLL_NAMES.includes(g.$id)));
  if (q.diffs.length) { for (const d of q.diffs) console.log(`  ✗ 차이 ${d}`); fail(`(a) 뒤 차이 ${q.diffs.length}개 — 더 쓰지 않고 멈춤 (--resume 을 다시 돌리기 전에 보고)`); }
  if (q.createColls.length) fail(`(a) 뒤에도 없는 컬렉션: ${q.createColls.join(', ')} — 멈춤`);

  // (b) 빠진 인덱스
  for (const i of q.createIndexes) {
    assertPmColl(i.coll);
    for (let n = 1; ; n++) {
      try {
        await dbs.createIndex(db.database, i.coll, i.key, DatabasesIndexType.Key, i.attributes);
        console.log(`  ✓ (b) index ${i.coll}.${i.key} [${i.attributes.join(', ')}] 생성${n > 1 ? ` (${n}번째)` : ''}`);
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/not yet available/i.test(msg) || n >= INDEX_RETRY) fail(`(b) ${i.coll}.${i.key} 실패: ${msg}`);
        console.log(`  … ${i.coll}.${i.key}: 속성 준비 전 — ${INDEX_WAIT_MS / 1000}초 뒤 다시 (${n}/${INDEX_RETRY})`);
        await sleep(INDEX_WAIT_MS);
      }
    }
  }
  // 인덱스까지 available 이 될 때까지 (최대 2분) — 읽기만
  const want3 = pmSchemaTotals(want);
  for (let t = 0; ; t++) {
    const now = await readColls(dbs, db);
    const s = printTotals(t ? '다시 읽음' : '끝난 뒤', now);
    if (!s.notAvail || t >= 24) {
      const ok = s.pm === want3.colls && s.attrs === want3.attrs && s.idx === want3.indexes && !s.notAvail;
      console.log(ok ? `  ✓ 맞음 — PM ${want3.colls} · 속성 ${want3.attrs} · 인덱스 ${want3.indexes} · 전부 available` : `  ✗ 다름 — 맞아야 할 숫자 ${JSON.stringify(want3)}`);
      if (!ok) process.exitCode = 1;
      return;
    }
    await sleep(INDEX_WAIT_MS);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const isResume = process.argv.includes('--resume');
  const db = devDb(`PM 스키마 ${isResume ? '이어 채우기 ' : ''}${dryRun ? '미리보기 (읽기만)' : '만들기'}`);
  console.log(`  시작 ${stampNow()}`);
  process.on('exit', () => console.log(`  끝 ${stampNow()}`));
  const dbs = new Databases(new Client().setEndpoint(db.endpoint).setProject(db.project).setKey(db.key));
  if (PM_COLL_NAMES.length !== 23 || new Set(PM_COLL_NAMES).size !== 23) fail('PM 컬렉션 정의가 23개가 아닙니다');

  if (isResume) { await resume(dbs, db, dryRun); return; }

  // 처음 만들기: 읽기만 — 지금 있는 컬렉션 목록, 23개 중 하나라도 있으면 멈춤
  const have = (await readColls(dbs, db)).map((c) => c.$id);
  const clash = PM_COLL_NAMES.filter((n) => have.includes(n));
  const pmLike = have.filter((n) => /^pm/i.test(n));
  console.log(`  지금 컬렉션 ${have.length}개 · pm 으로 시작하는 것 ${pmLike.length}개${pmLike.length ? ` (${pmLike.join(', ')})` : ''}`);
  console.log(`  만들 것: PM 23개 — ${PM_COLL_NAMES.join(', ')}`);
  if (clash.length) fail(`이미 있는 이름 ${clash.length}개: ${clash.join(', ')} — 만들지 않고 멈춤 (이어 채우기는 --resume)`);
  console.log('');
  process.exitCode = runShared(db, [...PM_COLL_NAMES], dryRun);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
