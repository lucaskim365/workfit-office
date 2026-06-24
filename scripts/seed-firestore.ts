/**
 * Firestore 시드 러너 — src/data/seeds/* 의 정적 시드를 실제 Firestore(named DB)에 1회 적재한다.
 *
 * 설계: repo의 메서드 의미(save/create/addMovement…)에 의존하지 않고,
 *   { 컬렉션, 시드배열, id함수 } 매핑 테이블로 균일하게 upsert(setDoc) 한다.
 *   문서 ID는 각 repo가 쓰는 키와 동일하게 맞춰 재실행해도 중복이 생기지 않는다(idempotent).
 *
 * 인증: Firestore 보안 룰을 우회하는 Admin SDK 사용 → 서비스 계정 키 필요.
 *   - GOOGLE_APPLICATION_CREDENTIALS=<service-account.json 경로> 또는
 *   - 프로젝트 루트의 ./serviceAccount.json (gitignore 됨)
 *   Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성.
 *
 * 실행:
 *   npm run seed -- --dry     # Firestore 접근 없이 시드 건수만 검증
 *   npm run seed              # 실제 적재
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { ITEM_SEED } from '@/data/seeds/item.seed';
import { VENDOR_SEED } from '@/data/seeds/vendor.seed';
import { COMMON_CODE_SEED } from '@/data/seeds/commonCode.seed';
import { USER_SEED } from '@/data/seeds/user.seed';
import { ROLE_GROUP_SEED } from '@/data/seeds/roleGroup.seed';
import { SHIFT_SEED, SHIFT_ROTATION_SEED } from '@/data/seeds/shift.seed';
import { WORK_CENTER_SEED } from '@/data/seeds/workCenter.seed';
import { BOM_SEED } from '@/data/seeds/bom.seed';
import { ROUTING_SEED } from '@/data/seeds/routing.seed';
import { STOCK_MOVEMENT_SEED } from '@/data/seeds/stock.seed';
import { WORK_ORDER_SEED } from '@/data/seeds/workOrder.seed';
import { SALES_ORDER_SEED } from '@/data/seeds/salesOrder.seed';
import { SHIPMENT_SEED } from '@/data/seeds/shipment.seed';
import { RECEIPT_SEED } from '@/data/seeds/receipt.seed';
import { ISSUE_SEED } from '@/data/seeds/issue.seed';
import { INSPECTION_ITEM_SEED } from '@/data/seeds/inspectionItem.seed';
import { INSPECTION_STANDARD_SEED } from '@/data/seeds/inspectionStandard.seed';
import { DEFECT_CODE_SEED } from '@/data/seeds/defectCode.seed';
import { QUALITY_GRADE_SEED } from '@/data/seeds/qualityGrade.seed';
import { INSPECTION_SEED } from '@/data/seeds/inspection.seed';
import { NONCONFORMANCE_SEED } from '@/data/seeds/nonconformance.seed';

interface SeedTable<T> {
  coll: string;
  docs: readonly T[];
  /** 문서 ID — 해당 repo의 setDoc(doc(db, COLL, <여기>)) 키와 동일해야 한다. */
  id: (d: T) => string;
}

/** 컬렉션 적재 순서 = repo의 doc-id 규칙과 1:1로 맞춤. */
const TABLES: SeedTable<any>[] = [
  { coll: 'items', docs: ITEM_SEED, id: (d) => d.code },
  { coll: 'vendors', docs: VENDOR_SEED, id: (d) => d.code },
  { coll: 'commonCodes', docs: COMMON_CODE_SEED, id: (d) => `${d.groupCode}__${d.code}` },
  { coll: 'users', docs: USER_SEED, id: (d) => d.id },
  { coll: 'roleGroups', docs: ROLE_GROUP_SEED, id: (d) => d.code },
  { coll: 'shifts', docs: SHIFT_SEED, id: (d) => d.code },
  { coll: 'shiftRotations', docs: SHIFT_ROTATION_SEED, id: (d) => d.crew },
  { coll: 'workCenters', docs: WORK_CENTER_SEED, id: (d) => d.code },
  { coll: 'boms', docs: BOM_SEED, id: (d) => d.code },
  { coll: 'routings', docs: ROUTING_SEED, id: (d) => d.code },
  { coll: 'stockMovements', docs: STOCK_MOVEMENT_SEED, id: (d) => d.id },
  { coll: 'workOrders', docs: WORK_ORDER_SEED, id: (d) => d.no },
  { coll: 'salesOrders', docs: SALES_ORDER_SEED, id: (d) => d.no },
  { coll: 'shipments', docs: SHIPMENT_SEED, id: (d) => d.no },
  { coll: 'receipts', docs: RECEIPT_SEED, id: (d) => d.po },
  { coll: 'issues', docs: ISSUE_SEED, id: (d) => d.no },
  { coll: 'inspectionItems', docs: INSPECTION_ITEM_SEED, id: (d) => d.code },
  { coll: 'inspectionStandards', docs: INSPECTION_STANDARD_SEED, id: (d) => d.code },
  { coll: 'defectCodes', docs: DEFECT_CODE_SEED, id: (d) => d.code },
  { coll: 'qualityGrades', docs: QUALITY_GRADE_SEED, id: (d) => d.code },
  { coll: 'inspections', docs: INSPECTION_SEED, id: (d) => d.recv },
  { coll: 'nonconformances', docs: NONCONFORMANCE_SEED, id: (d) => d.no },
];

/** .env.local 의 VITE_FB_* 값을 읽어 named DB를 타깃팅한다. */
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

const DRY = process.argv.includes('--dry');

async function main() {
  const total = TABLES.reduce((n, t) => n + t.docs.length, 0);
  console.log(`시드 ${TABLES.length}개 컬렉션 · 문서 ${total}건`);

  if (DRY) {
    for (const t of TABLES) console.log(`  ${t.coll.padEnd(16)} ${t.docs.length}건`);
    console.log('[dry] Firestore 접근 없이 검증만 수행했습니다.');
    return;
  }

  const projectId = readEnv('VITE_FB_PROJECT_ID');
  const databaseId = readEnv('VITE_FB_FIRESTORE_DB_ID');
  if (!projectId) throw new Error('VITE_FB_PROJECT_ID 를 찾을 수 없습니다 (.env.local).');

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(process.cwd(), 'serviceAccount.json');
  if (!existsSync(keyPath)) {
    throw new Error(
      `서비스 계정 키를 찾을 수 없습니다: ${keyPath}\n` +
        'Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후 ' +
        './serviceAccount.json 로 저장하거나 GOOGLE_APPLICATION_CREDENTIALS 로 경로를 지정하세요.',
    );
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const app = initializeApp({ credential: cert(serviceAccount), projectId });
  // named database( (default) 아님 )를 명시적으로 타깃팅.
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  console.log(`타깃: project=${projectId} db=${databaseId ?? '(default)'}`);

  for (const t of TABLES) {
    // Firestore batch 최대 500건 → 청크로 분할.
    for (let i = 0; i < t.docs.length; i += 450) {
      const batch = db.batch();
      for (const d of t.docs.slice(i, i + 450)) {
        batch.set(db.collection(t.coll).doc(t.id(d)), d as Record<string, unknown>);
      }
      await batch.commit();
    }
    console.log(`  ✔ ${t.coll.padEnd(16)} ${t.docs.length}건`);
  }
  console.log('완료.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
