import { shipmentSchema, type Shipment, type ShipmentStatus } from '@/domain/shipment/schema';
import { canTransition } from '@/domain/shipment/status';
import { SHIPMENT_SEED } from '@/data/seeds/shipment.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 출하 Repository — 상태 전이 강제. 완료 시 cross-entity는 services/shipping.service.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직·상태전이만 여기 유지.
 */
const backend = createCrudBackend<Shipment>({
  coll: 'shipments',
  parse: (raw) => {
    const p = shipmentSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse shipment:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (s) => s.no,
  seed: SHIPMENT_SEED.map((s) => shipmentSchema.parse(s)),
});

export interface ShipmentFilter {
  customer?: string;
  status?: string;
}

function applyFilter(rows: Shipment[], f?: ShipmentFilter): Shipment[] {
  if (!f) return rows;
  return rows.filter((s) => (!f.customer || s.customer === f.customer) && (!f.status || s.status === f.status));
}

export const shipmentRepo = {
  async list(filter?: ShipmentFilter): Promise<Shipment[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(no: string): Promise<Shipment | null> {
    return (await this.list()).find((s) => s.no === no) ?? null;
  },

  /** 상태 전이 — 상태머신 검증 후 저장. */
  async transition(no: string, to: ShipmentStatus): Promise<void> {
    const s = await this.get(no);
    if (!s) throw new Error(`출하 없음: ${no}`);
    if (!canTransition(s.status, to)) throw new Error(`전이 불가: ${s.status} → ${to}`);
    await backend.save(shipmentSchema.parse({ ...s, status: to }));
  },
};
