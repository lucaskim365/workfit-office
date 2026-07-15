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

async function restore() {
  const projectId = readEnv('VITE_FB_PROJECT_ID');
  const databaseId = readEnv('VITE_FB_FIRESTORE_DB_ID');
  if (!projectId) throw new Error('VITE_FB_PROJECT_ID 를 찾을 수 없습니다.');

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(process.cwd(), 'serviceAccount.json');
  if (!existsSync(keyPath)) throw new Error('서비스 계정 키를 찾을 수 없습니다.');
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const app = initializeApp({ credential: cert(serviceAccount), projectId });
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  const crypto = await import('node:crypto');
  const getHash = (pw: string) => crypto.createHash('sha256').update(pw).digest('hex');

  // 마이그레이션 전 터미널 로그에서 추출한 고유 비밀번호 복원 데이터
  const customPasswords: Record<string, string> = {
    'U001': '*Leedo0219',
    'U003': '*inno0406',
    'U012': 'ghdcodnjs02!',
  };

  const batch = db.batch();
  for (const [id, plainPw] of Object.entries(customPasswords)) {
    const hashed = getHash(plainPw);
    const ref = db.collection('users').doc(id);
    batch.update(ref, { password: hashed });
    console.log(`사원 ID: [${id}]의 비밀번호를 원본 해시값으로 업데이트합니다.`);
  }

  await batch.commit();
  console.log('비밀번호 복원 완료!');
}

restore().catch(console.error);
