import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'node:fs';
import * as path from 'node:path';

const firebaseConfig = {
  apiKey: "AIzaSyCnYjXcWwbwl4ETLBtwfk0G79zsn02ofWE",
  authDomain: "workfit-office-app.firebaseapp.com",
  projectId: "workfit-office-app",
  storageBucket: "workfit-office-app.firebasestorage.app",
  messagingSenderId: "34440992629",
  appId: "1:34440992629:web:3f1d6ea4a3e14c5780653c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching current forms from Firestore...");
  const querySnapshot = await getDocs(collection(db, "approvalForms"));
  const forms: any[] = [];
  querySnapshot.forEach((doc) => {
    forms.push(doc.data());
  });

  const backupDir = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\2c59cddd-a868-4c3c-8fe7-665a34c4009f\\scratch';
  const backupPath = path.join(backupDir, 'backup_forms.json');
  
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(forms, null, 2), 'utf-8');
  console.log(`[Backup Success] Saved to: ${backupPath}`);
}

run().catch(console.error);
