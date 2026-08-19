import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases, Query } from 'node-appwrite';

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

  console.log(`Appwrite 결재선 룰 조회 중... (DB: ${databaseId})`);
  const coll = 'approvalRouteRules';

  // 페이징 처리하며 모든 문서 조회
  const rules: any[] = [];
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const res = await dbs.listDocuments(databaseId, coll, [
      Query.limit(PAGE),
      Query.offset(offset)
    ]);
    
    for (const doc of res.documents) {
      rules.push({
        id: doc.$id,
        name: doc.name ?? '이름 없음',
        docType: doc.docType ?? '전체',
        active: doc.active ?? false,
        priority: doc.priority ?? 100,
        amountFrom: doc.amountFrom,
        amountTo: doc.amountTo,
        positionFromRank: doc.positionFromRank,
        positionToRank: doc.positionToRank,
        steps: typeof doc.steps === 'string' ? JSON.parse(doc.steps) : (doc.steps ?? []),
        conditionKey: doc.conditionKey,
        conditionValues: doc.conditionValues ?? [],
      });
    }
    if (res.documents.length < PAGE) break;
  }

  // 정렬: 우선순위 오름차순, 문서유형순
  rules.sort((a, b) => a.priority - b.priority || a.docType.localeCompare(b.docType));

  console.log('총 규칙 개수:', rules.length);
  rules.forEach(r => console.log(`- ID: ${r.id}, Name: ${r.name}`));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
