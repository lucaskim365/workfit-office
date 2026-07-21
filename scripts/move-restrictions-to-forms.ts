import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { encodeForFirestore } from '@/shared/lib/firestore-codec';

/**
 * 기존 결재선 규칙(approvalRouteRules)에 흩어져 있던 서식 단위의 고정 기안자 제한(직책)을
 * 서식 마스터(approvalForms)의 새로운 allowedPositionFromRank 설정으로 이관(마이그레이션)합니다.
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

  const collRef = db.collection('approvalForms');
  console.log('결재서식 기안 제한 설정 이관 시작...');

  const restrictions: Record<string, { from: number | null, to: number | null }> = {
    '해외출장': { from: 4, to: null },     // 팀장 이상 (대표1, 본부장2, 이사3, 부장/팀장4)
    '외주개발용역': { from: 2, to: null }, // 본부장 이상 (대표1, 본부장2)
    '접대비': { from: 4, to: null },       // 팀장 이상
    '인장날인': { from: 4, to: null },     // 팀장 이상
    '경조지원': { from: 4, to: null }      // 팀장 이상
  };

  const snap = await collRef.get();
  const batch = db.batch();
  let updatedCount = 0;

  for (const doc of snap.docs) {
    const code = doc.id;
    const limit = restrictions[code];
    const dbData = doc.data();

    // 새 필드 초기화 (기본값 설정)
    const updatedForm = {
      ...dbData,
      allowedPositionFromRank: dbData.allowedPositionFromRank ?? null,
      allowedPositionToRank: dbData.allowedPositionToRank ?? null,
      allowedDeptIds: dbData.allowedDeptIds ?? []
    };

    // 만약 정의된 제한이 있다면 업데이트
    if (limit) {
      updatedForm.allowedPositionFromRank = limit.from;
      updatedForm.allowedPositionToRank = limit.to;
      console.log(`  ✔ [설정 이관] 서식 ID: ${code} - 최소 기안 직급: ${limit.from === 2 ? '본부장' : '팀장'} 이상 제한 적용`);
    }

    batch.set(doc.ref, encodeForFirestore(updatedForm) as Record<string, unknown>);
    updatedCount++;
  }

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`성공: 총 ${updatedCount}개의 서식에 기안자 직급 제한 마이그레이션 완료.`);
  } else {
    console.log('업데이트할 서식이 없습니다.');
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
