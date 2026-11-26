/**
 * 7-6 K5 시험 — 개발 DB `pmChangeLogs` 에 시험 변경 이력 6,000건 넣기 · 지우기 (설계 5.7.5 건수 한계).
 * 공용 `loadWithQueries`(offset 100건씩)가 큰 offset 에서 막히는지 · 처음 열기가 얼마나 느려지는지 화면에서 보려고.
 *
 * 실행 (package.json 은 안 고침 — 공용 파일):
 *   npx tsx scripts/pm-k5.ts                       (미리보기 — 지금 건수 · 시험 문서 수, 읽기만. 기본)
 *   npx tsx scripts/pm-k5.ts --write               (넣기 6,000건 — 같은 id 는 건너뜀)
 *   npx tsx scripts/pm-k5.ts --remove --dry-run    (지울 시험 문서 수만 — 읽기만)
 *   npx tsx scripts/pm-k5.ts --remove --write      (시험 문서만 지움)
 *
 * 지키는 것: `pm-env`(개발 값 4개만 · 운영 ID · --prod 거절) · 쓰고 지우는 곳은 `assertPmColl('pmChangeLogs')` 하나 ·
 * 시험 문서 = 기록 id 접두 `zzk5` + projectId "ZZK5" + 문서 $id 가 그 기록에서 만든 id 와 같음 — 셋 다 맞을 때만 지움.
 */
import { Client, Databases, Query } from 'node-appwrite';
import { safeDocId } from '../src/shared/lib/appwrite';
import { docKeyOf, LOG_COLL, PM_COLLS, rowOf, type PmRow } from '../src/data/pm/pmDb';
import { assertPmColl, devDb, fail, stampNow } from './pm-env';

const N = 6000;
const PREFIX = 'zzk5';
const PROJECT = 'ZZK5';
/** 하루 30건 × 200일 (설계 5.7.5 '하루 30건이면 약 8달') */
const PER_DAY = 30;

const isCode = (e: unknown, code: number) => (e as { code?: number })?.code === code;
const isTest = (d: { $id: string; id?: unknown; projectId?: unknown; kind?: unknown }) =>
  typeof d.id === 'string' && d.id.startsWith(PREFIX) && d.projectId === PROJECT && d.$id === safeDocId(docKeyOf({ kind: String(d.kind ?? ''), id: d.id }));

function testRows(): PmRow[] {
  const def = PM_COLLS.find((c) => c.name === LOG_COLL)!;
  const kd = def.kinds[0];
  const end = new Date(2026, 10, 25, 9);
  const rows: PmRow[] = [];
  for (let i = 0; i < N; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - Math.floor(i / PER_DAY));
    const day = d.toLocaleDateString('sv-SE');
    const id = `${PREFIX}${String(i + 1).padStart(5, '0')}`;
    const rec = { id, projectId: PROJECT, code: '', kind: '수정', text: `ZZ시험 K5 이력 ${i + 1}`, date: day, by: '' };
    rows.push(rowOf(def, kd, { key: docKeyOf({ kind: kd.kind, id }), id, kind: kd.kind, rec }, d.getTime() + (i % PER_DAY), i % PER_DAY));
  }
  return rows;
}

async function main() {
  const remove = process.argv.includes('--remove');
  const write = process.argv.includes('--write');
  if (write && process.argv.includes('--dry-run')) fail('--dry-run 과 --write 를 같이 줄 수 없습니다');
  const db = devDb(`K5 시험 이력 ${remove ? '지우기' : '넣기'} ${write ? '실행' : '미리보기 (읽기만)'}`);
  console.log(`  시작 ${stampNow()}`);
  assertPmColl(LOG_COLL);
  const dbs = new Databases(new Client().setEndpoint(db.endpoint).setProject(db.project).setKey(db.key));
  const total0 = (await dbs.listDocuments(db.database, LOG_COLL, [Query.limit(1)])).total;
  const mine = (await dbs.listDocuments(db.database, LOG_COLL, [Query.equal('projectId', PROJECT), Query.limit(1)])).total;
  console.log(`  ${LOG_COLL} 지금 ${total0}건 · 그중 projectId "${PROJECT}" ${mine}건 · 그 밖 ${total0 - mine}건 (그 밖은 손대지 않음)`);

  if (!remove) {
    const rows = testRows();
    console.log(`  넣을 시험 이력 ${rows.length}건 (id ${rows[0].id} ~ ${rows[rows.length - 1].id}, 날짜 ${rows[rows.length - 1].date} ~ ${rows[0].date})`);
    if (!write) { console.log(`  끝 ${stampNow()} — 미리보기만 (쓴 것 없음). 실행: --write`); return; }
    let made = 0, skip = 0;
    for (let i = 0; i < rows.length; i += 5) {
      assertPmColl(LOG_COLL);
      await Promise.all(rows.slice(i, i + 5).map(async (r) => {
        try { await dbs.createDocument(db.database, LOG_COLL, safeDocId(docKeyOf(r)), { ...r }); made++; } catch (e) { if (isCode(e, 409)) skip++; else throw e; }
      }));
      if ((i + 5) % 1000 === 0) console.log(`  … ${i + 5} / ${rows.length}`);
    }
    const total1 = (await dbs.listDocuments(db.database, LOG_COLL, [Query.limit(1)])).total;
    console.log(`  ✓ 새로 ${made} · 이미 있어 건너뜀 ${skip} → ${LOG_COLL} ${total0} → ${total1}건`);
    console.log(`  끝 ${stampNow()}`);
    return;
  }

  // 지우기 — projectId "ZZK5" 로 찾고, 한 건씩 isTest 로 다시 확인
  const found: string[] = [];
  let odd = 0;
  for (let cursor: string | null = null; ;) {
    const q = [Query.equal('projectId', PROJECT), Query.limit(100), Query.select(['$id', 'id', 'projectId', 'kind']), ...(cursor ? [Query.cursorAfter(cursor)] : [])];
    const r = await dbs.listDocuments(db.database, LOG_COLL, q);
    for (const d of r.documents as unknown as Array<{ $id: string; id?: unknown; projectId?: unknown; kind?: unknown }>) { if (isTest(d)) found.push(d.$id); else odd++; }
    if (r.documents.length < 100) break;
    cursor = r.documents[r.documents.length - 1].$id;
  }
  console.log(`  지울 시험 문서 ${found.length}건 (projectId "${PROJECT}" 인데 접두 · id 가 안 맞아 안 지울 것 ${odd}건)`);
  if (!write) { console.log(`  끝 ${stampNow()} — 미리보기만 (지운 것 없음). 실행: --remove --write`); return; }
  let gone = 0;
  for (let i = 0; i < found.length; i += 5) {
    assertPmColl(LOG_COLL);
    await Promise.all(found.slice(i, i + 5).map(async (id) => { try { await dbs.deleteDocument(db.database, LOG_COLL, id); gone++; } catch (e) { if (!isCode(e, 404)) throw e; } }));
    if ((i + 5) % 1000 === 0) console.log(`  … ${i + 5} / ${found.length}`);
  }
  const total1 = (await dbs.listDocuments(db.database, LOG_COLL, [Query.limit(1)])).total;
  const left = (await dbs.listDocuments(db.database, LOG_COLL, [Query.equal('projectId', PROJECT), Query.limit(1)])).total;
  console.log(`  ✓ 지움 ${gone} → ${LOG_COLL} ${total0} → ${total1}건 · projectId "${PROJECT}" 남은 것 ${left}건`);
  console.log(`  끝 ${stampNow()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
