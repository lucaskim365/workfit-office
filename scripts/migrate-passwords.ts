import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

async function runMigration() {
  const projectId = readEnv('VITE_FB_PROJECT_ID');
  const databaseId = readEnv('VITE_FB_FIRESTORE_DB_ID');
  if (!projectId) throw new Error('VITE_FB_PROJECT_ID 를 찾을 수 없습니다.');

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(process.cwd(), 'serviceAccount.json');
  if (!existsSync(keyPath)) {
    throw new Error(
      `서비스 계정 키를 찾을 수 없습니다: ${keyPath}\n` +
        'Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후 ' +
        './serviceAccount.json 로 저장하거나 GOOGLE_APPLICATION_CREDENTIALS 로 경로를 지정하세요.'
    );
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const app = initializeApp({ credential: cert(serviceAccount), projectId });
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  const usersColl = db.collection('users');
  const snap = await usersColl.get();
  
  console.log(`총 ${snap.size}명의 사원 분석 시작...`);
  
  let migratedCount = 0;
  const isHash = (str: string) => /^[0-9a-f]{64}$/i.test(str);
  
  const crypto = await import('node:crypto');
  const getHash = (pw: string) => crypto.createHash('sha256').update(pw).digest('hex');

  const batch = db.batch();
  for (const doc of snap.docs) {
    const data = doc.data();
    const pw = data.password;
    if (pw && !isHash(pw)) {
      const hashed = getHash(pw);
      console.log(`사원 [${data.name} (${data.id})]의 평문 비밀번호(${pw})를 해싱 마이그레이션합니다.`);
      batch.update(doc.ref, { password: hashed });
      migratedCount++;
    }
  }

  if (migratedCount > 0) {
    await batch.commit();
    console.log(`성공: 총 ${migratedCount}명의 비밀번호가 해싱되어 업데이트되었습니다.`);
  } else {
    console.log('업데이트할 평문 비밀번호가 없습니다. 모든 계정이 이미 해싱되었습니다.');
  }
}

runMigration().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
