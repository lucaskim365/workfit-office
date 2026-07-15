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

async function prune() {
  const projectId = readEnv('VITE_FB_PROJECT_ID');
  const databaseId = readEnv('VITE_FB_FIRESTORE_DB_ID');
  if (!projectId) throw new Error('VITE_FB_PROJECT_ID 를 찾을 수 없습니다.');

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(process.cwd(), 'serviceAccount.json');
  if (!existsSync(keyPath)) throw new Error('서비스 계정 키를 찾을 수 없습니다.');
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const app = initializeApp({ credential: cert(serviceAccount), projectId });
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  const deletedForms = ['식대', '회식비', '회의비', '교통비', '운반비'];
  const deletedRules = [
    'RR-SIKDAE-ALL',
    'RR-HOESIK-MEMBER',
    'RR-HOESIK-SPECIAL',
    'RR-HOEIBI-ALL',
    'RR-GYOTONGBI-ALL',
    'RR-DELIVERY-POST',
    'RR-DELIVERY-QUICK'
  ];

  const batch = db.batch();

  for (const formId of deletedForms) {
    const ref = db.collection('approvalForms').doc(formId);
    batch.delete(ref);
    console.log(`Firestore 서식 삭제 대기: [${formId}]`);
  }

  for (const ruleId of deletedRules) {
    const ref = db.collection('approvalRouteRules').doc(ruleId);
    batch.delete(ref);
    console.log(`Firestore 결재선 규칙 삭제 대기: [${ruleId}]`);
  }

  await batch.commit();
  console.log('선택한 중지 서식 및 규칙 Firestore 삭제 완료!');
}

prune().catch(console.error);
