import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { shipmentSchema, type Shipment, type ShipmentStatus } from '@/domain/shipment/schema';
import { canTransition } from '@/domain/shipment/status';
import { SHIPMENT_SEED } from '@/data/seeds/shipment.seed';

/**
 * 출하 Repository — 상태 전이 강제. 완료 시 cross-entity는 services/shipping.service.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'shipments';

let memory: Shipment[] = SHIPMENT_SEED.map((s) => shipmentSchema.parse(s));

export interface ShipmentFilter {
  customer?: string;
  status?: string;
}

function applyFilter(rows: Shipment[], f?: ShipmentFilter): Shipment[] {
  if (!f) return rows;
  return rows.filter((s) => (!f.customer || s.customer === f.customer) && (!f.status || s.status === f.status));
}

async function persist(s: Shipment): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, s.no), s);
    return;
  }
  const i = memory.findIndex((m) => m.no === s.no);
  if (i >= 0) memory[i] = s;
  else memory = [s, ...memory];
}

export const shipmentRepo = {
  async list(filter?: ShipmentFilter): Promise<Shipment[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => shipmentSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(no: string): Promise<Shipment | null> {
    return (await this.list()).find((s) => s.no === no) ?? null;
  },

  /** 상태 전이 — 상태머신 검증 후 저장. */
  async transition(no: string, to: ShipmentStatus): Promise<void> {
    const s = await this.get(no);
    if (!s) throw new Error(`출하 없음: ${no}`);
    if (!canTransition(s.status, to)) throw new Error(`전이 불가: ${s.status} → ${to}`);
    await persist(shipmentSchema.parse({ ...s, status: to }));
  },
};
