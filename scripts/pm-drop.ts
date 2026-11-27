/**
 * PM 되돌리기 — PM 컬렉션 23개만 지운다 (설계 5.7.6 되돌리기 · 4.2 ⑤).
 *
 * 실행 (개발):
 *   npm run pm:drop                       (미리보기 — 지울 컬렉션 · 문서 수, 읽기만. 기본)
 *   npm run pm:drop -- --docs-only        (미리보기 — 컬렉션은 두고 문서만)
 *   npm run pm:drop -- --write --confirm=<지울 문서 합>   (컬렉션째 지움 — 팀장 확인 뒤에만, 합은 미리보기가 알려 줌)
 *   npm run pm:drop -- --docs-only --write --confirm=<지울 문서 합>
 *
 * 운영 (8단계 · 사용자 허락 뒤, 설계 5.7.20 · 검수 P5): 끝에 `--prod-project=<운영 프로젝트 ID 를 손으로>`.
 *   배포 뒤에는 사용자 기록이 들어 있으므로 — 미리보기가 PM 문서 전부를 `C:/dev/pm-migration/8/<시각>-pm-drop-backup.json` 으로
 *   내려받고(건수 · 경로 출력), `--write` 는 `--confirm=<합>` + `--backup=<그 파일>` (운영 · 컬렉션마다 $id 목록이 지금 DB 와 같음) 일 때만.
 *   운영 기본 = 문서만. 컬렉션째는 `--collections` 따로.
 *
 * 지키는 것 (`pm-env.ts`): 기본 = 개발 DB 접속 값만 · 운영 프로젝트 ID · `--prod` 거절 ·
 * 지울 이름 = PM_COLLS 23개 목록 그대로, 지우기 직전마다 `assertPmColl` 로 다시 확인 (pm 으로 시작하는지만 보지 않음).
 * 다른 컬렉션은 목록(listCollections)을 읽어 '지금 몇 개' 만 보여 주고, 열거나 쓰지 않는다.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, Databases, Query, type Models } from 'node-appwrite';
import { assertPmColl, confirmError, fail, pmDb, PM_COLL_NAMES, PROD_LOG_DIR, prodLogName, stampNow, type DevDb } from './pm-env';

const isCode = (e: unknown, code: number) => (e as { code?: number })?.code === code;

/** 컬렉션 하나의 문서 전부 (읽기만) */
async function allDocs(dbs: Databases, db: DevDb, name: string): Promise<Array<Record<string, unknown> & { $id: string }>> {
  assertPmColl(name);
  const out: Array<Record<string, unknown> & { $id: string }> = [];
  for (let cursor: string | null = null; ;) {
    const r: Models.DocumentList<Models.Document> = await dbs.listDocuments(db.database, name, [Query.limit(100), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    out.push(...(r.documents as unknown as Array<Record<string, unknown> & { $id: string }>));
    if (r.documents.length < 100) break;
    cursor = r.documents[r.documents.length - 1].$id;
  }
  return out;
}

interface Backup { project: string; database: string; at: string; total: number; collections: Record<string, Array<Record<string, unknown> & { $id: string }>> }

async function main() {
  const write = process.argv.includes('--write');
  const db0 = pmDb('PM 되돌리기', { prodOk: true, mode: write ? '쓰기' : '미리보기' });
  if (process.argv.includes('--docs-only') && process.argv.includes('--collections')) fail('--docs-only 와 --collections 는 같이 줄 수 없습니다');
  // 개발 기본 = 컬렉션째 (지금 그대로) · 운영 기본 = 문서만, 컬렉션째는 --collections 따로
  const docsOnly = db0.prod ? !process.argv.includes('--collections') : process.argv.includes('--docs-only');
  if (!db0.prod && process.argv.includes('--collections')) fail('--collections 는 운영 길에서만 씁니다 (개발 기본이 컬렉션째)');
  const db = db0;
  console.log(`  ${write ? '실행' : '미리보기 (읽기만)'} — ${docsOnly ? '문서만' : '컬렉션째'}`);
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
  // 실수로 돌려 사람이 넣은 기록까지 지우지 않게 — 지울 문서 합을 보여 주고 --confirm=<그 숫자> 가 맞을 때만 (검수 ② 제안)
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  if (db.prod && !write) {
    // 운영 미리보기 = 사본 내려받기 (검수 P5) — 저장소 밖, 사용자 기록이 들어 있음
    const b: Backup = { project: db.project, database: db.database, at: stampNow(), total: 0, collections: {} };
    for (const name of targets) { b.collections[name] = await allDocs(dbs, db, name); b.total += b.collections[name].length; }
    const file = join(PROD_LOG_DIR, prodLogName(new Date(), 'pm-drop', 'backup').replace(/\.log$/, '.json'));
    writeFileSync(file, JSON.stringify(b), 'utf8');
    console.log(`  사본: ${file} — 문서 ${b.total}건 (컬렉션 ${targets.length})`);
    console.log(`  지울 문서 합 ${total} — 실행하려면 --write --confirm=${total} --backup=${file}${docsOnly ? '' : ' --collections'}`);
    console.log(`  끝 ${stampNow()} — 미리보기만 (지운 것 없음)`);
    return;
  }
  console.log(`  지울 문서 합 ${total} — 실행하려면 --write --confirm=${total}`);
  if (!write) { console.log(`  끝 ${stampNow()} — 미리보기만 (지운 것 없음)`); return; }
  const ce = confirmError(process.argv, total, '지울 문서 합');
  if (ce) fail(ce.replace('쓰지 않고', '지우지 않고'));

  if (db.prod) {
    // 사본 확인 — 파일이 있고 · 운영 것이고 · 컬렉션마다 문서 목록($id + $updatedAt)이 지금 DB 와 같을 때만
    // ($updatedAt 까지 보는 이유: 사본 뒤에 고친 문서가 있으면 사본에는 고치기 전 값만 있어 그 고친 내용을 잃음 — G-1 사소 ①)
    const path = process.argv.find((a) => a.startsWith('--backup='))?.slice('--backup='.length);
    if (!path || !existsSync(path)) fail(`--backup=<미리보기가 만든 사본> 이 없거나 파일이 없습니다 (${path ?? '없음'}) — 지우지 않고 멈춤`);
    const b = JSON.parse(readFileSync(path, 'utf8')) as Backup;
    if (b.project !== db.project || b.database !== db.database) fail(`사본의 project · database (${b.project} / ${b.database}) 가 지금과 다름 — 지우지 않고 멈춤`);
    const sig = (docs: Array<Record<string, unknown> & { $id: string }>) => docs.map((d) => `${d.$id}@${String(d.$updatedAt ?? '')}`).sort().join(',');
    for (const name of targets) {
      const now = sig(await allDocs(dbs, db, name));
      const was = sig(b.collections[name] ?? []);
      if (now !== was) fail(`${name}: 사본과 지금 DB 의 문서 목록 · 고친 시각이 다름 (사본 뒤에 바뀜) — 미리보기를 다시 돌려 새 사본으로`);
    }
    console.log(`  사본 확인 맞음: ${path} (${b.total}건, ${b.at})`);
  }

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
