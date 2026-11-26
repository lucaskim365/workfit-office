/**
 * PM 되돌리기 — 개발 DB 의 PM 컬렉션 23개만 지운다 (설계 5.7.6 되돌리기).
 *
 * 실행:
 *   npm run pm:drop                       (미리보기 — 지울 컬렉션 · 문서 수, 읽기만. 기본)
 *   npm run pm:drop -- --docs-only        (미리보기 — 컬렉션은 두고 문서만)
 *   npm run pm:drop -- --write            (컬렉션째 지움 — 팀장 확인 뒤에만)
 *   npm run pm:drop -- --docs-only --write
 *
 * 지키는 것 (`pm-env.ts`): 개발 DB 접속 값 4개만 읽음(운영 열쇠 이름은 안 읽음) · 운영 프로젝트 ID · `--prod` 거절 ·
 * 지울 이름 = PM_COLLS 23개 목록 그대로, 지우기 직전마다 `assertPmColl` 로 다시 확인 (pm 으로 시작하는지만 보지 않음).
 * 다른 컬렉션은 목록(listCollections)을 읽어 '지금 몇 개' 만 보여 주고, 열거나 쓰지 않는다.
 */
import { Client, Databases, Query } from 'node-appwrite';
import { assertPmColl, devDb, fail, PM_COLL_NAMES, stampNow } from './pm-env';

const isCode = (e: unknown, code: number) => (e as { code?: number })?.code === code;

async function main() {
  const write = process.argv.includes('--write');
  const docsOnly = process.argv.includes('--docs-only');
  const db = devDb(`PM 되돌리기 ${write ? '실행' : '미리보기 (읽기만)'} — ${docsOnly ? '문서만' : '컬렉션째'}`);
  console.log(`  시작 ${stampNow()}`);
  const dbs = new Databases(new Client().setEndpoint(db.endpoint).setProject(db.project).setKey(db.key));

  const all: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const r = await dbs.listCollections(db.database, [Query.limit(100), Query.offset(offset)]);
    all.push(...r.collections.map((c) => c.$id));
    if (r.collections.length < 100) break;
  }
  const targets = PM_COLL_NAMES.filter((n) => all.includes(n));
  const others = all.filter((n) => !PM_COLL_NAMES.includes(n));
  console.log(`  지금 컬렉션 ${all.length}개 = PM ${targets.length} + 그 밖 ${others.length} (그 밖은 손대지 않음)`);

  const counts = new Map<string, number>();
  for (const name of targets) {
    assertPmColl(name);
    const r = await dbs.listDocuments(db.database, name, [Query.limit(1)]);
    counts.set(name, r.total);
    console.log(`  - ${name.padEnd(17)} 문서 ${r.total}`);
  }
  if (!targets.length) { console.log('  지울 PM 컬렉션 없음'); return; }
  if (!write) { console.log(`  끝 ${stampNow()} — 미리보기만 (지운 것 없음). 실행은 --write`); return; }

  for (const name of targets) {
    assertPmColl(name);
    if (!docsOnly) {
      await dbs.deleteCollection(db.database, name);
      console.log(`  ✓ 컬렉션 지움 ${name}`);
      continue;
    }
    let n = 0;
    for (;;) {
      const r = await dbs.listDocuments(db.database, name, [Query.limit(100), Query.select(['$id'])]);
      if (!r.documents.length) break;
      for (const d of r.documents) { try { await dbs.deleteDocument(db.database, name, d.$id); n++; } catch (e) { if (!isCode(e, 404)) throw e; } }
    }
    console.log(`  ✓ ${name} 문서 ${n} 지움`);
  }
  console.log(`  끝 ${stampNow()}`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
