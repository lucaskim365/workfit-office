import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { encodeForFirestore } from '@/shared/lib/firestore-codec';
import { APPROVAL_ROUTE_SEED } from '@/data/seeds/approvalRoute.seed';

async function main() {
  const p = resolve(process.cwd(), '.env.local');
  let projectId = 'workfit-office-app';
  let databaseId = '';

  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m1 = line.match(/^VITE_FB_PROJECT_ID\s*=\s*"?([^"\n]*)"?/);
      if (m1) projectId = m1[1].trim();
      const m2 = line.match(/^VITE_FB_FIRESTORE_DB_ID\s*=\s*"?([^"\n]*)"?/);
      if (m2) databaseId = m2[1].trim();
    }
  }

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(process.cwd(), 'service-account.json');
  if (!existsSync(keyPath)) {
    throw new Error(`서비스 계정 키를 찾을 수 없습니다: ${keyPath}`);
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const app = initializeApp({ credential: cert(serviceAccount), projectId });
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  console.log(`타깃: project=${projectId} db=${databaseId ?? '(default)'}`);
  console.log('기존 approvalRouteRules 컬렉션 삭제 중...');

  const collRef = db.collection('approvalRouteRules');
  const snap = await collRef.select().get();
  
  if (snap.size > 0) {
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`기존 룰 ${snap.size}건 삭제 완료.`);
  } else {
    console.log('기존 룰 없음.');
  }

  console.log('새로운 전결 규정 결재선 룰 적재 중...');
  const batch = db.batch();
  for (const d of APPROVAL_ROUTE_SEED) {
    batch.set(collRef.doc(d.id), encodeForFirestore(d) as Record<string, unknown>);
  }
  await batch.commit();
  console.log(`신규 룰 ${APPROVAL_ROUTE_SEED.length}건 적재 완료.`);
  console.log('완료.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
