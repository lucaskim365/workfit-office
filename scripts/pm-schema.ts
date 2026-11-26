/**
 * PM 컬렉션 23개 만들기 — 공용 `appwrite-schema.ts` 를 **새 컬렉션만 · PM 23개만** 으로 돌린다 (설계 5.7.6 7-4).
 *
 * 실행:
 *   npm run appwrite:schema:pm -- --dry-run     (7-3 · 7-4 미리보기 — 읽기만)
 *   npm run appwrite:schema:pm                  (7-4 — 팀장 "실행해도 됨" 뒤에만, 개발 DB)
 *
 * 지키는 것 (`pm-env.ts`): 개발 DB 접속 값 4개만 읽음(운영 열쇠 이름은 안 읽음) · 운영 프로젝트 ID · `--prod` 거절.
 * 먼저 개발 DB 컬렉션 목록을 **읽기만** 해서 (1) 지금 컬렉션 수 (2) PM 23개 이름이 이미 있는지 보여 준다 —
 * 하나라도 있으면 멈춤 (공용 스크립트 `--new-only` 도 있는 컬렉션은 건너뛰지만, 그 전에 멈춰 보고).
 * 그다음 공용 스크립트를 `--only=<23개> --new-only` (+ `--dry-run`) 로 부른다 — 기존 컬렉션 · 데이터는 읽지도 쓰지도 않음.
 */
import { Client, Databases, Query } from 'node-appwrite';
import { devDb, fail, PM_COLL_NAMES, stampNow } from './pm-env';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const db = devDb(`PM 스키마 ${dryRun ? '미리보기 (읽기만)' : '만들기'}`);
  console.log(`  시작 ${stampNow()}`);

  // 읽기만: 지금 있는 컬렉션 목록
  const dbs = new Databases(new Client().setEndpoint(db.endpoint).setProject(db.project).setKey(db.key));
  const have: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const r = await dbs.listCollections(db.database, [Query.limit(100), Query.offset(offset)]);
    have.push(...r.collections.map((c) => c.$id));
    if (r.collections.length < 100) break;
  }
  const clash = PM_COLL_NAMES.filter((n) => have.includes(n));
  const pmLike = have.filter((n) => /^pm/i.test(n));
  console.log(`  지금 컬렉션 ${have.length}개 · pm 으로 시작하는 것 ${pmLike.length}개${pmLike.length ? ` (${pmLike.join(', ')})` : ''}`);
  console.log(`  만들 것: PM 23개 — ${PM_COLL_NAMES.join(', ')}`);
  if (PM_COLL_NAMES.length !== 23 || new Set(PM_COLL_NAMES).size !== 23) fail('PM 컬렉션 정의가 23개가 아닙니다');
  if (clash.length) fail(`이미 있는 이름 ${clash.length}개: ${clash.join(', ')} — 만들지 않고 멈춤`);
  console.log('');

  // 공용 스크립트에 넘길 값 — 프로세스 환경으로만 (공용 스크립트는 process.env 를 먼저 읽음)
  Object.assign(process.env, { APPWRITE_ENDPOINT: db.endpoint, APPWRITE_PROJECT_ID: db.project, APPWRITE_DATABASE_ID: db.database, APPWRITE_API_KEY: db.key });
  process.argv = [process.argv[0], process.argv[1], `--only=${PM_COLL_NAMES.join(',')}`, '--new-only', ...(dryRun ? ['--dry-run'] : [])];
  await import('./appwrite-schema');
  process.on('exit', () => console.log(`  끝 ${stampNow()}`));
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
