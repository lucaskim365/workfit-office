/**
 * 7-6 확인용 (읽기만) — PM 컬렉션 23개 건수 + body 에 "ZZ" 가 든 문서 목록 + `--since=` 뒤에 만들거나 고친 문서 목록.
 * (넣은 줄(buildImportRows)과의 대조는 없음 — 그건 pm:import 의 'DB 건수 대조')
 *   npx tsx scripts/pm-zz-check.ts [--since=2026-11-26T05:00:00.000Z]
 * 쓰기 호출 없음 (listDocuments 만). 접속 = pm-env (개발 값 4개만, 운영 거절).
 */
import { Client, Databases, Query } from 'node-appwrite';
import { devDb, PM_COLL_NAMES, stampNow } from './pm-env';

async function main() {
  const db = devDb('7-6 ZZ시험 기록 확인 (읽기만)');
  const dbs = new Databases(new Client().setEndpoint(db.endpoint).setProject(db.project).setKey(db.key));
  const counts: Record<string, number> = {};
  const zz: string[] = [];
  const recent: string[] = [];
  const since = process.argv.find((a) => a.startsWith('--since='))?.slice(8) ?? '2026-11-26T05:00:00.000Z';
  for (const name of PM_COLL_NAMES) {
    let n = 0;
    for (let cursor: string | null = null; ;) {
      const r = await dbs.listDocuments(db.database, name, [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
      for (const d of r.documents as unknown as Array<Record<string, string>>) {
        n++;
        if (name === 'pmMarks') console.log('  pmMarks', d.kind, d.id, d.$updatedAt, d.at, d.seq, d.body);
        if (String(d.body).includes('ZZ')) zz.push(`${name} ${d.kind}|${d.id} ${String(d.body).slice(0, 90)}`);
        if (d.$updatedAt > since) recent.push(`${name} ${d.kind}|${d.id} 만듦 ${d.$createdAt.slice(11, 19)} 고침 ${d.$updatedAt.slice(11, 19)}`);
      }
      if (r.documents.length < 100) break;
      cursor = r.documents[r.documents.length - 1].$id;
    }
    counts[name] = n;
  }
  console.log(`  ${stampNow()} 건수`, JSON.stringify(counts));
  console.log(`  합 ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  console.log(`  ZZ 든 문서 ${zz.length}`); for (const x of zz) console.log('   ', x);
  console.log(`  ${since} 뒤 만들거나 고친 문서 ${recent.length}`); for (const x of recent.slice(0, 200)) console.log('   ', x);
}
main().catch((e) => { console.error(e); process.exit(1); });
