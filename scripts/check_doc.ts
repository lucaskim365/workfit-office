import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function main() {
  const querySnap = await db.collection('approvalDocs')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log(`Fetched ${querySnap.size} documents.`);
  for (const doc of querySnap.docs) {
    const data = doc.data();
    console.log(`\n=== Document ID: ${doc.id} ===`);
    console.log(`Title: ${data.title}`);
    console.log(`Status: ${data.status}`);
    console.log(`Drafter: ${data.drafterId} (${data.drafterName})`);
    console.log(`Execution: ${JSON.stringify(data.execution, null, 2)}`);
  }
}

main().catch(console.error);
