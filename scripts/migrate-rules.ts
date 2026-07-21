import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { encodeForFirestore } from '@/shared/lib/firestore-codec';

/**
 * 기존 Firestore 내 모든 결재선 룰을 안전하게 마이그레이션합니다.
 * 사용자가 생성한 커스텀 룰을 보존하면서, 결재선 단계(`steps`) 내의 'DRAFTER' (기안자 결재) 단계를 제거합니다.
 */
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
  console.log('기존 approvalRouteRules 컬렉션 조회 중...');

  const collRef = db.collection('approvalRouteRules');
  const snap = await collRef.get();
  
  if (snap.size === 0) {
    console.log('기존 룰이 없습니다.');
    return;
  }

  console.log(`총 ${snap.size}개의 결재선 룰을 분석 및 마이그레이션 합니다...`);
  const batch = db.batch();
  let updatedCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.steps && Array.isArray(data.steps)) {
      const oldLen = data.steps.length;
      // DRAFTER 리졸버를 제외시킴 (기안자 결재 제거)
      const newSteps = data.steps.filter((step: any) => step.resolver !== 'DRAFTER');
      
      if (oldLen !== newSteps.length) {
        data.steps = newSteps;
        batch.set(doc.ref, encodeForFirestore(data) as Record<string, unknown>);
        updatedCount++;
        console.log(`  ✔ [수정 대기] ID: ${doc.id} (${data.name}) - 기안자 결재 단계 제거 예정`);
      }
    }
  }

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`총 ${updatedCount}개의 결재선 룰 마이그레이션 적용 완료.`);
  } else {
    console.log('이미 모든 결재선에 기안자 결재 단계가 없거나 마이그레이션할 대상이 없습니다.');
  }
  console.log('완료.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
