import { Client, Databases, ID, Query } from 'node-appwrite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_PROCESS_OPTIONS } from '../src/data/approvalProcess/approvalProcess.repo';

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
  const endpoint = readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT');
  const projectId = readEnv('APPWRITE_PROJECT_ID') ?? readEnv('VITE_APPWRITE_PROJECT_ID');
  const databaseId = readEnv('APPWRITE_DATABASE_ID') ?? readEnv('VITE_APPWRITE_DATABASE_ID');
  const apiKey = readEnv('APPWRITE_API_KEY') ?? readEnv('APPWRITE_API_KEY_DEV');

  const missing = [
    ['APPWRITE_ENDPOINT', endpoint],
    ['APPWRITE_PROJECT_ID', projectId],
    ['APPWRITE_DATABASE_ID', databaseId],
    ['APPWRITE_API_KEY', apiKey],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`필수 env 누락: ${missing.join(', ')}\n(.env.local 또는 환경변수에 설정하세요. API_KEY는 서버 비밀키)`);
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(endpoint as string)
    .setProject(projectId as string)
    .setKey(apiKey as string);
  const dbs = new Databases(client);
  const dbId = databaseId as string;
  const collId = 'approvalProcessSettings';

  console.log(`▶ 결재 프로세스 설정 Appwrite DB 시딩 시작...`);

  for (const opt of DEFAULT_PROCESS_OPTIONS) {
    // key 필드 기준으로 이미 저장된 문서가 있는지 조회
    const res = await dbs.listDocuments(dbId, collId, [
      Query.equal('key', opt.id)
    ]);

    const data = {
      key: opt.id,
      category: opt.category,
      name: opt.name,
      description: opt.description,
      enabled: opt.enabled,
      isImplemented: opt.isImplemented
    };

    if (res.total > 0) {
      const doc = res.documents[0];
      await dbs.updateDocument(dbId, collId, doc.$id, data);
      console.log(`• [업데이트] ${opt.name} (${opt.id})`);
    } else {
      await dbs.createDocument(dbId, collId, ID.unique(), data);
      console.log(`✓ [신규생성] ${opt.name} (${opt.id})`);
    }
  }

  console.log(`✅ 결재 프로세스 설정 시딩 완료!`);
}

main().catch((e) => {
  console.error('✗ 시딩 실패:', e);
  process.exit(1);
});
