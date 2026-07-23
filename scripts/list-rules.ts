import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  const snap = await collRef.get();
  
  const rules = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name ?? '이름 없음',
      docType: data.docType ?? '전체',
      active: data.active ?? false,
      priority: data.priority ?? 100,
      amountFrom: data.amountFrom,
      amountTo: data.amountTo,
      positionFromRank: data.positionFromRank,
      positionToRank: data.positionToRank,
      steps: data.steps ?? [],
      conditionKey: data.conditionKey,
      conditionValues: data.conditionValues ?? [],
    };
  });

  // 정렬: 우선순위 오름차순, 문서유형순
  rules.sort((a, b) => a.priority - b.priority || a.docType.localeCompare(b.docType));

  console.log('총 규칙 개수:', rules.length);
  rules.forEach(r => console.log(`- ID: ${r.id}, Name: ${r.name}`));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
