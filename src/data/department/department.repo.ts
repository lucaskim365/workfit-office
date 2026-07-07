import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { departmentSchema, type Department } from '@/domain/department/schema';
import { DEPARTMENT_SEED } from '@/data/seeds/department.seed';

/**
 * 부서 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'departments';

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: Department[] = DEPARTMENT_SEED.map((d) => departmentSchema.parse(d));

export const departmentRepo = {
  /** 전체 조회(마스터 규모상 전건 로드). */
  async list(): Promise<Department[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => departmentSchema.parse(d.data()));
    }
    return memory;
  },

  async get(id: string): Promise<Department | null> {
    const rows = await this.list();
    return rows.find((d) => d.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = department.id. */
  async save(item: Department): Promise<void> {
    const valid = departmentSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  /** 삭제. 문서 ID = department.id. */
  async remove(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, id));
      return;
    }
    memory = memory.filter((m) => m.id !== id);
  },
};
