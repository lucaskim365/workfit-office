import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  const projectId = readEnv('VITE_FB_PROJECT_ID');
  const databaseId = readEnv('VITE_FB_FIRESTORE_DB_ID');
  if (!projectId) throw new Error('VITE_FB_PROJECT_ID 를 찾을 수 없습니다 (.env.local).');

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(process.cwd(), 'serviceAccount.json');
  if (!existsSync(keyPath)) {
    throw new Error(`서비스 계정 키를 찾을 수 없습니다: ${keyPath}`);
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const app = initializeApp({ credential: cert(serviceAccount), projectId });
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  
  console.log(`타깃: project=${projectId} db=${databaseId ?? '(default)'}`);
  console.log('approvalDocs 컬렉션의 모든 문서를 삭제하는 중...');

  const collRef = db.collection('approvalDocs');
  const snapshot = await collRef.get();
  
  if (snapshot.empty) {
    console.log('삭제할 결재 문서가 없습니다.');
    return;
  }

  console.log(`총 ${snapshot.size}개의 문서를 찾았습니다. 삭제를 시작합니다...`);

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log('모든 결재 문서 삭제가 완료되었습니다.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
