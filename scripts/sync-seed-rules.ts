import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { encodeForFirestore } from '@/shared/lib/firestore-codec';
import { APPROVAL_ROUTE_SEED } from '@/data/seeds/approvalRoute.seed';

/**
 * 사용자 커스텀 룰을 보존하면서, 
 * 시스템 기본 시드 룰의 기안 권한(직급 범위) 및 결재 단계를 최신 정보로 Firestore에 동기화합니다.
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

  const collRef = db.collection('approvalRouteRules');
  console.log('Firestore의 결재선 룰 동기화 시작...');

  const seedMap = new Map(APPROVAL_ROUTE_SEED.map((r) => [r.id, r]));
  const snap = await collRef.get();
  
  const batch = db.batch();
  let updatedCount = 0;

  for (const doc of snap.docs) {
    const docId = doc.id;
    const seedRule = seedMap.get(docId);
    
    // 시드 룰셋에 존재하는 경우에만 최신 자격 조건 동기화
    if (seedRule) {
      const dbData = doc.data();
      const needsUpdate = 
        dbData.positionFromRank !== seedRule.positionFromRank ||
        dbData.positionToRank !== seedRule.positionToRank ||
        JSON.stringify(dbData.steps) !== JSON.stringify(seedRule.steps);

      if (needsUpdate) {
        const merged = {
          ...dbData,
          positionFromRank: seedRule.positionFromRank,
          positionToRank: seedRule.positionToRank,
          steps: seedRule.steps,
        };
        batch.set(doc.ref, encodeForFirestore(merged) as Record<string, unknown>);
        updatedCount++;
        console.log(`  ✔ [동기화 예정] ID: ${docId} (${seedRule.name}) - 기안자 직급 범위 및 단계 동기화`);
      }
    } else {
      console.log(`  - [보존] 커스텀 룰 ID: ${docId} (${doc.data().name}) - 건드리지 않음`);
    }
  }

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`성공: 총 ${updatedCount}개의 시스템 규칙 동기화 완료.`);
  } else {
    console.log('업데이트할 규칙이 없습니다. 이미 동기화되어 있습니다.');
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
