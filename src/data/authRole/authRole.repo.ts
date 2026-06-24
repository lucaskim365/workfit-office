import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { authRoleSchema, type AuthRole } from '@/domain/authRole/schema';
import { AUTH_ROLE_SEED } from '@/data/seeds/authRole.seed';

/**
 * 권한 역할 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'authRoles';

export interface AuthRoleFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: AuthRole[] = AUTH_ROLE_SEED.map((r) => authRoleSchema.parse(r));

function applyFilter(rows: AuthRole[], f?: AuthRoleFilter): AuthRole[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter((r) => !kw || r.code.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw));
}

export const authRoleRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: AuthRoleFilter): Promise<AuthRole[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => authRoleSchema.parse(decodeFromFirestore(d.data())));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(code: string): Promise<AuthRole | null> {
    const rows = await this.list();
    return rows.find((r) => r.code === code) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 역할 코드. */
  async save(role: AuthRole): Promise<void> {
    const valid = authRoleSchema.parse(role);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.code), encodeForFirestore(valid));
      return;
    }
    const i = memory.findIndex((m) => m.code === valid.code);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
