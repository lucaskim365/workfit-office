import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { vendorSchema, type Vendor } from '@/domain/vendor/schema';
import { VENDOR_SEED } from '@/data/seeds/vendor.seed';

/**
 * 거래처 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 정본 패턴)
 * Firebase 미설정 시 in-memory seed 로 graceful degrade.
 */
const COLL = 'vendors';

export interface VendorFilter {
  type?: string;
  use?: string;
  q?: string;
}

let memory: Vendor[] = VENDOR_SEED.map((v) => vendorSchema.parse(v));

function applyFilter(rows: Vendor[], f?: VendorFilter): Vendor[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (v) =>
      (!f.type || v.type === f.type) &&
      (!f.use || v.use === f.use) &&
      (!kw || v.code.toLowerCase().includes(kw) || v.name.toLowerCase().includes(kw)),
  );
}

export const vendorRepo = {
  async list(filter?: VendorFilter): Promise<Vendor[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => vendorSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(code: string): Promise<Vendor | null> {
    const rows = await this.list();
    return rows.find((v) => v.code === code) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 거래처코드. */
  async save(vendor: Vendor): Promise<void> {
    const valid = vendorSchema.parse(vendor);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.code), valid);
      return;
    }
    const i = memory.findIndex((m) => m.code === valid.code);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(code: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, code));
      return;
    }
    memory = memory.filter((m) => m.code !== code);
  },
};
