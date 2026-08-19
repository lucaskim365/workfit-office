import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases } from 'node-appwrite';
import { APPROVAL_ROUTE_SEED } from '@/data/seeds/approvalRoute.seed';

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`));
    if (m) return m[1].trim();
  }
  return undefined;
}

async function main() {
  const endpoint = readEnv('VITE_APPWRITE_ENDPOINT');
  const projectId = readEnv('VITE_APPWRITE_PROJECT_ID');
  const databaseId = readEnv('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';
  const apiKey = readEnv('APPWRITE_API_KEY');

  if (!endpoint || !projectId || !apiKey) {
    throw new Error('Appwrite 설정 환경변수가 누락되었습니다 (.env.local 확인)');
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const dbs = new Databases(client);

  const coll = 'approvalRouteRules';
  console.log(`Appwrite의 결재선 룰 동기화 시작... (DB: ${databaseId})`);

  const seedMap = new Map(APPROVAL_ROUTE_SEED.map((r) => [r.id, r]));

  // 현재 DB에 저장된 결재선 규칙 로드
  const dbRules: any[] = [];
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const res = await dbs.listDocuments(databaseId, coll, [
      Query.limit(PAGE),
      Query.offset(offset)
    ]);
    dbRules.push(...res.documents);
    if (res.documents.length < PAGE) break;
  }

  let updatedCount = 0;

  for (const doc of dbRules) {
    const docId = doc.$id;
    const seedRule = seedMap.get(docId);

    // 시드 룰셋에 존재하는 경우에만 최신 자격 조건 동기화
    if (seedRule) {
      const dbSteps = typeof doc.steps === 'string' ? JSON.parse(doc.steps) : doc.steps;
      
      const needsUpdate = 
        doc.positionFromRank !== seedRule.positionFromRank ||
        doc.positionToRank !== seedRule.positionToRank ||
        JSON.stringify(dbSteps) !== JSON.stringify(seedRule.steps);

      if (needsUpdate) {
        const updatedPayload = {
          positionFromRank: seedRule.positionFromRank,
          positionToRank: seedRule.positionToRank,
          steps: JSON.stringify(seedRule.steps),
        };

        await dbs.updateDocument(databaseId, coll, docId, updatedPayload);
        updatedCount++;
        console.log(`  ✔ [동기화 완료] ID: ${docId} (${seedRule.name}) - 기안자 직급 범위 및 단계 동기화`);
      }
    } else {
      console.log(`  - [보존] 커스텀 룰 ID: ${docId} (${doc.name}) - 건드리지 않음`);
    }
  }

  if (updatedCount > 0) {
    console.log(`성공: 총 ${updatedCount}개의 시스템 규칙 동기화 완료.`);
  } else {
    console.log('업데이트할 규칙이 없습니다. 이미 동기화되어 있습니다.');
  }
}

// node-appwrite SDK의 Query 클래스가 필요한 곳에 주입되도록 Query import 추가를 위해 아래와 같이 선언
import { Query } from 'node-appwrite';

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
