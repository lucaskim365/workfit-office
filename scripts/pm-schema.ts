/**
 * PM 컬렉션 23개 만들기 — 공용 `appwrite-schema.ts` 를 **새 컬렉션만 · PM 23개만** 으로 돌린다 (설계 5.7.6 7-4 · 5.7.13).
 *
 * 실행:
 *   npm run appwrite:schema:pm -- --dry-run            (미리보기 — 읽기만)
 *   npm run appwrite:schema:pm                         (23개 모두 없을 때 — 하나라도 있으면 멈춤)
 *   npm run appwrite:schema:pm -- --resume --dry-run   (이어 채우기 미리보기 — 읽기만)
 *   npm run appwrite:schema:pm -- --resume             (이어 채우기 — 빠진 컬렉션 · 빠진 인덱스만)
 *   npm run appwrite:schema:pm -- --touch=<PM 23개 중 하나> [--dry-run]  (컬렉션 기록의 속성 상태 어긋남 풀기 — 읽은 값 그대로 다시 쓰기 1번)
 *
 * 운영 (8단계 · 사용자 허락 뒤, 설계 5.7.20): 위 명령 끝에 `--prod-project=<운영 프로젝트 ID 를 손으로>`.
 *   쓰기는 `--confirm=<미리보기가 알려 준 수>` 가 같을 때만 (처음 만들기 23 · 이어 채우기 = 만들 컬렉션 + 채울 인덱스 · touch 1).
 *   운영 이어 채우기는 있는 PM 컬렉션이 모두 '정의와 같음 · 문서 0' 일 때만. 운영 쓰기 직전에 공용 스크립트를 --dry-run 으로 한 번 돌려
 *   첫 줄의 project · 대상 한정 · '새 컬렉션 생성만' 을 확인한 뒤에만 쓰기 자식을 부름. 출력은 모두 `C:/dev/pm-migration/8/` 기록 파일에도.
 *
 * 지키는 것 (`pm-env.ts`): 기본 = 개발 DB 접속 값만 읽음 · 운영 프로젝트 ID · `--prod` 거절 · 운영 길은 `APPWRITE_API_KEY_PROD` 만.
 * 먼저 개발 DB 컬렉션 목록을 **읽기만** 한다. 공용 스크립트는 `--only=<만들 것> --new-only` 로만 부른다 — 기존 컬렉션 · 데이터는 읽지도 쓰지도 않음.
 *
 * --resume (7-4 중간 실패 뒤, 11/26 팀장 (가)): 있는 PM 컬렉션마다 정의(`pmSchemaPlan`)와 대조 —
 * '인덱스 빠짐' 말고 다른 차이가 하나라도 있으면 아무것도 안 쓰고 멈춤. 쓰기는 두 가지뿐:
 *   (a) 없는 컬렉션 = 공용 스크립트 `--only=<없는 것만> --new-only` (따로 프로세스)
 *   (b) 빠진 인덱스 = 여기서 createIndex — 'not yet available' 일 때만 5초 × 12번 다시, 다른 오류는 바로 멈춤
 * 처리 중(processing)인 속성 · 인덱스는 차이가 아니라 기다릴 것 — 처음 읽을 때 · (a) 뒤 5초 간격 최대 2분 다시 읽고 대조 (F4).
 * 수정 · 삭제 호출 없음. 끝나면 다시 읽어 23 · 속성 140 · 인덱스 25 · 전부 available 인지 찍음.
 */
import { spawnSync } from 'node:child_process';
import { Client, Databases, DatabasesIndexType, Query } from 'node-appwrite';
import { pmSchemaTotals, pmSchemaWant, resumePlan, type PmCollGot } from '../src/data/pm/pmSchemaPlan';
import { assertPmColl, fail, pmDb, PM_COLL_NAMES, requireConfirm, sharedArgs, sharedEnv, sharedHeadError, stampNow, type DevDb } from './pm-env';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const INDEX_RETRY = 12;
const INDEX_WAIT_MS = 5_000;
/** 처리 중 기다리기 5초 × 24 = 2분 (F4) */
const SETTLE_TRIES = 24;

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

/** 공용 스크립트를 따로 프로세스로 — 고른 접속 값만 환경으로 넘김. 운영이면 출력을 받아 찍고(기록 파일에도) 돌려줌 */
function spawnShared(db: DevDb, only: string[], dryRun: boolean): { code: number; out: string } {
  for (const n of only) assertPmColl(n);
  const args = sharedArgs(only, { dryRun, prod: db.prod });
  const env = sharedEnv(process.env, db);
  if (!db.prod) return { code: spawnSync(process.execPath, args, { env, stdio: 'inherit' }).status ?? 1, out: '' };
  const r = spawnSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  for (const line of out.trimEnd().split(/\r?\n/)) console.log(`  │ ${line}`);
  return { code: r.status ?? 1, out };
}
/** 개발 = 그대로 한 번. 운영 = 먼저 --dry-run(읽기만) 출력의 project · 대상 · 모드를 확인한 뒤에만 쓰기 (검수 P1 · P2) */
function runShared(db: DevDb, only: string[], dryRun: boolean): number {
  if (!db.prod) return spawnShared(db, only, dryRun).code;
  const pre = spawnShared(db, only, true);
  const e = pre.code !== 0 ? `자식 --dry-run exit ${pre.code}` : sharedHeadError(pre.out, db, only);
  if (e) fail(`${e} — 쓰지 않고 멈춤`);
  if (dryRun) return 0;
  console.log(`  자식 --dry-run 확인 맞음 (project ${db.project} · 대상 ${only.length}개 · 새 컬렉션 생성만) — 쓰기 자식을 부름`);
  return spawnShared(db, only, false).code;
}

function printTotals(label: string, got: PmCollGot[]) {
  const pm = got.filter((g) => PM_COLL_NAMES.includes(g.$id));
  const attrs = pm.flatMap((g) => g.attributes);
  const idx = pm.flatMap((g) => g.indexes);
  const notAvail = [...attrs.map((a) => a.status), ...idx.map((i) => i.status)].filter((s) => s !== 'available').length;
  console.log(`  ${label}: 컬렉션 ${got.length} · PM ${pm.length} · 속성 ${attrs.length} · 인덱스 ${idx.length} · available 아닌 것 ${notAvail}`);
  return { pm: pm.length, attrs: attrs.length, idx: idx.length, notAvail };
}

/** 읽고 대조 — '처리 중'(기다릴 것)이 있으면 5초 간격 최대 2분 다시 읽은 뒤 대조 (F4). 2분 넘으면 멈춤 */
async function settled(dbs: Databases, db: DevDb, want: ReturnType<typeof pmSchemaWant>, label: string) {
  for (let t = 0; ; t++) {
    const got = await readColls(dbs, db);
    const p = resumePlan(want, got.filter((g) => PM_COLL_NAMES.includes(g.$id)));
    if (!p.waiting.length) return { got, p };
    if (t >= SETTLE_TRIES) fail(`${label}: 2분 기다림 넘음 — 아직 처리 중 ${p.waiting.join(', ')} (멈춤)`);
    console.log(`  … ${label}: 처리 중 ${p.waiting.length}개 (${p.waiting.join(', ')}) — ${INDEX_WAIT_MS / 1000}초 뒤 다시 읽음 (${t + 1}/${SETTLE_TRIES})`);
    await sleep(INDEX_WAIT_MS);
  }
}

async function resume(dbs: Databases, db: DevDb, dryRun: boolean) {
  const want = pmSchemaWant();
  const { got: before, p } = await settled(dbs, db, want, '처음 읽기');
  printTotals('지금', before);
  console.log(`  있는 것 ${p.existing.length} · 차이 ${p.diffs.length} · 만들 컬렉션 ${p.createColls.length}${p.createColls.length ? ` (${p.createColls.join(', ')})` : ''} · 속성 ${p.attrs} · 인덱스 ${p.indexCount}`);
  for (const i of p.createIndexes) console.log(`  + 빠진 인덱스 ${i.coll}.${i.key} [${i.attributes.join(', ')}]`);
  if (p.diffs.length) { for (const d of p.diffs) console.log(`  ✗ 차이 ${d}`); fail(`'인덱스 빠짐' 말고 다른 차이 ${p.diffs.length}개 — 아무것도 쓰지 않고 멈춤`); }
  if (db.prod) {
    // 운영 이어 채우기 = 있는 PM 컬렉션이 모두 정의와 같고(위 차이 0) 문서 0 일 때만 (검수 P3)
    const withDocs: string[] = [];
    for (const name of p.existing) {
      assertPmColl(name);
      const n = (await dbs.listDocuments(db.database, name, [Query.limit(1)])).total;
      if (n) withDocs.push(`${name} ${n}`);
    }
    console.log(`  운영: 있는 PM 컬렉션 ${p.existing.length}개 중 문서 있는 것 ${withDocs.length}${withDocs.length ? ` (${withDocs.join(', ')})` : ''}`);
    if (withDocs.length) fail('운영 이어 채우기는 있는 PM 컬렉션이 모두 문서 0 일 때만 — 쓰지 않고 멈춤');
  }
  if (!p.createColls.length && !p.createIndexes.length) { console.log('  빠진 것 없음 · 쓰기 0'); return; }
  const writes = p.createColls.length + p.createIndexes.length;
  if (db.prod) console.log(`  운영 쓰기 수 = 만들 컬렉션 ${p.createColls.length} + 채울 인덱스 ${p.createIndexes.length} = ${writes} — 실행하려면 --confirm=${writes}`);
  if (dryRun) {
    if (p.createColls.length) { console.log(''); runShared(db, p.createColls, true); }
    console.log(`  미리보기만 — 쓰기 0. 끝나면 맞아야 할 숫자: ${JSON.stringify(pmSchemaTotals(want))}`);
    return;
  }

  if (db.prod) requireConfirm(writes, '운영 쓰기 수');
  // (a) 없는 컬렉션 — 공용 스크립트 (같은 틈으로 끊겨도 아래 (b) 가 그 인덱스를 채움)
  if (p.createColls.length) {
    console.log('');
    const code = runShared(db, p.createColls, false);
    console.log(`  (a) 공용 스크립트 끝 (exit ${code})`);
  }
  // 다시 읽고 다시 대조 — (a) 가 남긴 것까지
  const { p: q } = await settled(dbs, db, want, '(a) 뒤');
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
  // 인덱스까지 available 이 될 때까지 (최대 2분) — 읽기만. 숫자 합 + 대조(차이 0 · 만들 컬렉션 0 · 채울 인덱스 0 · 처리 중 0) 둘 다
  const want3 = pmSchemaTotals(want);
  for (let t = 0; ; t++) {
    const now = await readColls(dbs, db);
    const s = printTotals(t ? '다시 읽음' : '끝난 뒤', now);
    const e = resumePlan(want, now.filter((g) => PM_COLL_NAMES.includes(g.$id)));
    if (!e.waiting.length || t >= SETTLE_TRIES) {
      const sumOk = s.pm === want3.colls && s.attrs === want3.attrs && s.idx === want3.indexes && !s.notAvail;
      const planOk = !e.diffs.length && !e.createColls.length && !e.createIndexes.length && !e.waiting.length;
      console.log(`  대조: 차이 ${e.diffs.length} · 만들 컬렉션 ${e.createColls.length} · 채울 인덱스 ${e.createIndexes.length} · 처리 중 ${e.waiting.length}`);
      console.log(sumOk && planOk ? `  ✓ 맞음 — PM ${want3.colls} · 속성 ${want3.attrs} · 인덱스 ${want3.indexes} · 전부 available` : `  ✗ 다름 — 맞아야 할 숫자 ${JSON.stringify(want3)}${e.diffs.length ? ` · 차이 ${e.diffs.join(' / ')}` : ''}`);
      if (!(sumOk && planOk)) process.exitCode = 1;
      return;
    }
    await sleep(INDEX_WAIT_MS);
  }
}

/**
 * --touch=<이름> (7-4 pmMoney, 11/26 팀장 (가)) — 컬렉션 기록이 속성 상태를 processing 으로 들고 있는데 속성 자체(listAttributes)는
 * available 인 어긋남을 풀려고, **방금 읽은 값 그대로**(name · $permissions · documentSecurity · enabled) updateCollection 1번.
 * 쓰기 전 읽기만으로: 가드 · assertPmColl · 문서 0 · 어긋남이 있을 때만. 다시 하기 없음. 쓴 뒤 다시 읽어 값이 같은지 · 속성 상태를 찍음.
 */
async function touch(dbs: Databases, db: DevDb, name: string, dryRun: boolean) {
  assertPmColl(name);
  const c = await dbs.getCollection(db.database, name);
  const docs = (await dbs.listDocuments(db.database, name, [Query.limit(1)])).total;
  const attrs = (await dbs.listAttributes(db.database, name, [Query.limit(500)])).attributes as unknown as Array<{ key: string; status: string }>;
  const inColl = c.attributes as unknown as Array<{ key: string; status: string }>;
  const off = inColl.filter((a) => a.status === 'processing' && attrs.find((x) => x.key === a.key)?.status === 'available').map((a) => a.key);
  const sent = { name: c.name, permissions: [...c.$permissions], documentSecurity: c.documentSecurity, enabled: c.enabled };
  console.log(`  읽은 값: ${JSON.stringify(sent)} · $updatedAt ${c.$updatedAt}`);
  console.log(`  getCollection 속성: ${inColl.map((a) => `${a.key}:${a.status}`).join(' ')}`);
  console.log(`  listAttributes 속성: ${attrs.map((a) => `${a.key}:${a.status}`).join(' ')}`);
  console.log(`  문서 ${docs} · 어긋난 속성 ${off.length ? off.join(', ') : '없음'}`);
  if (docs !== 0) fail(`문서가 ${docs}건 있음 — 쓰기 0 으로 멈춤`);
  if (!off.length) { console.log('  할 일 없음 · 쓰기 0'); return; }
  console.log(`  보낼 값 (읽은 값 그대로): ${JSON.stringify(sent)}`);
  if (db.prod) console.log('  운영 쓰기 수 1 — 실행하려면 --confirm=1');
  if (dryRun) { console.log('  미리보기만 — 쓰기 0'); return; }
  if (db.prod) requireConfirm(1, '운영 쓰기 수');
  assertPmColl(name);
  await dbs.updateCollection(db.database, name, sent.name, sent.permissions, sent.documentSecurity, sent.enabled);
  console.log('  ✓ updateCollection 1번 보냄');
  const a = await dbs.getCollection(db.database, name);
  const after = { name: a.name, permissions: [...a.$permissions], documentSecurity: a.documentSecurity, enabled: a.enabled };
  const same = JSON.stringify(after) === JSON.stringify(sent);
  console.log(`  쓴 뒤 값: ${JSON.stringify(after)} · $updatedAt ${a.$updatedAt} → 앞과 ${same ? '같음' : '다름'}`);
  const st = (a.attributes as unknown as Array<{ key: string; status: string }>).map((x) => `${x.key}:${x.status}`);
  console.log(`  쓴 뒤 getCollection 속성: ${st.join(' ')}`);
  if (!same) process.exitCode = 1;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const isResume = process.argv.includes('--resume');
  const touchName = process.argv.find((a) => a.startsWith('--touch='))?.slice('--touch='.length);
  const what = isResume ? '이어 채우기 ' : touchName !== undefined ? `touch ${touchName} ` : '';
  const db = pmDb(`PM 스키마 ${what}${dryRun ? '미리보기 (읽기만)' : '만들기'}`, { prodOk: true, mode: dryRun ? '미리보기' : '쓰기' });
  console.log(`  시작 ${stampNow()}`);
  process.on('exit', () => console.log(`  끝 ${stampNow()}`));
  const dbs = new Databases(new Client().setEndpoint(db.endpoint).setProject(db.project).setKey(db.key));
  if (PM_COLL_NAMES.length !== 23 || new Set(PM_COLL_NAMES).size !== 23) fail('PM 컬렉션 정의가 23개가 아닙니다');

  if (touchName !== undefined) {
    // 11/26 팀장 허락은 pmMoney 하나였음 → 11/27 검수 P6: PM 23개 어느 이름이든 같은 안전 조건으로 (운영에서 다른 컬렉션이 같은 어긋남일 때)
    assertPmColl(touchName);
    if (isResume) fail('--touch 와 --resume 은 따로 돌립니다');
    await touch(dbs, db, touchName, dryRun);
    return;
  }
  if (isResume) { await resume(dbs, db, dryRun); return; }

  // 처음 만들기: 읽기만 — 지금 있는 컬렉션 목록, 23개 중 하나라도 있으면 멈춤
  const colls = await readColls(dbs, db);
  const have = colls.map((c) => c.$id);
  const clash = PM_COLL_NAMES.filter((n) => have.includes(n));
  const pmLike = have.filter((n) => /^pm/i.test(n));
  console.log(`  지금 컬렉션 ${have.length}개 · pm 으로 시작하는 것 ${pmLike.length}개${pmLike.length ? ` (${pmLike.join(', ')})` : ''}`);
  // 23개 이름마다 있음/없음 · 문서 수 · 속성 수 (읽기만, 검수 P3) — 남이 만든 같은 이름이 있으면 여기서 보임
  for (const n of PM_COLL_NAMES) {
    const c = colls.find((x) => x.$id === n);
    const docs = c ? (await dbs.listDocuments(db.database, n, [Query.limit(1)])).total : 0;
    console.log(`  - ${n.padEnd(17)} ${c ? `있음 · 문서 ${docs} · 속성 ${c.attributes.length}` : '없음'}`);
  }
  console.log(`  만들 것: PM 23개 — ${PM_COLL_NAMES.join(', ')}`);
  if (clash.length) fail(`이미 있는 이름 ${clash.length}개: ${clash.join(', ')} — 만들지 않고 멈춤 (이어 채우기는 --resume)`);
  if (db.prod) console.log(`  운영 쓰기 수 = 만들 컬렉션 ${PM_COLL_NAMES.length} — 실행하려면 --confirm=${PM_COLL_NAMES.length}`);
  if (db.prod && !dryRun) requireConfirm(PM_COLL_NAMES.length, '운영 쓰기 수(만들 컬렉션)');
  console.log('');
  process.exitCode = runShared(db, [...PM_COLL_NAMES], dryRun);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
