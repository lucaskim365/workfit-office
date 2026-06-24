import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { shiftSchema, shiftRotationSchema, type Shift, type ShiftRotation } from '@/domain/shift/schema';
import { SHIFT_SEED, SHIFT_ROTATION_SEED } from '@/data/seeds/shift.seed';

/**
 * 근무조 Repository — shifts·shiftRotations 두 컬렉션 캡슐화.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const SHIFTS = 'shifts';
const ROTATIONS = 'shiftRotations';

let shiftMem: Shift[] = SHIFT_SEED.map((s) => shiftSchema.parse(s));
let rotationMem: ShiftRotation[] = SHIFT_ROTATION_SEED.map((r) => shiftRotationSchema.parse(r));

export const shiftRepo = {
  async listShifts(): Promise<Shift[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, SHIFTS));
      return snap.docs.map((d) => shiftSchema.parse(d.data()));
    }
    return shiftMem;
  },

  async listRotations(): Promise<ShiftRotation[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, ROTATIONS));
      return snap.docs.map((d) => shiftRotationSchema.parse(d.data()));
    }
    return rotationMem;
  },

  async saveShift(shift: Shift): Promise<void> {
    const valid = shiftSchema.parse(shift);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, SHIFTS, valid.code), valid);
      return;
    }
    const i = shiftMem.findIndex((m) => m.code === valid.code);
    if (i >= 0) shiftMem[i] = valid;
    else shiftMem = [...shiftMem, valid];
  },

  async saveRotation(rotation: ShiftRotation): Promise<void> {
    const valid = shiftRotationSchema.parse(rotation);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, ROTATIONS, valid.crew), valid);
      return;
    }
    const i = rotationMem.findIndex((m) => m.crew === valid.crew);
    if (i >= 0) rotationMem[i] = valid;
    else rotationMem = [...rotationMem, valid];
  },
};
