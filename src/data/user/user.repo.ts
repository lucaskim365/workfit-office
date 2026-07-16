import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { userSchema, DEFAULT_USER_PASSWORD, type User, type UserFormValues } from '@/domain/user/schema';
import { USER_SEED } from '@/data/seeds/user.seed';
import { hashPassword } from '@/shared/lib/crypto';

/**
 * 사용자 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 * 문서 ID = user.id. 미설정 시 seed degrade.
 */
const COLL = 'users';

export interface UserFilter {
  dept?: string;
  roleGroup?: string;
  status?: string;
  q?: string;
}

let memory: User[] = USER_SEED.map((u) => userSchema.parse(u));

function applyFilter(rows: User[], f?: UserFilter): User[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (u) =>
      (!f.dept || u.dept === f.dept) &&
      (!f.roleGroup || u.roleGroup === f.roleGroup) &&
      (!f.status || u.status === f.status) &&
      (!kw || [u.empNo, u.name].some((v) => v.toLowerCase().includes(kw))),
  );
}

/** 차기 ID 채번(U0NN) — 운영 시 counters 컬렉션으로 대체. */
function nextId(rows: User[]): string {
  const max = rows.reduce((m, u) => {
    const n = Number(u.id.replace(/\D/g, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `U${String(max + 1).padStart(3, '0')}`;
}

export const userRepo = {
  async list(filter?: UserFilter): Promise<User[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => userSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  /** 신규 등록 — id 채번 후 저장. */
  async create(values: UserFormValues): Promise<User> {
    const all = await this.list();
    // 초기 비밀번호: 입력값 우선, 비우면 공통 기본값(mes1234) 부여 → 등록 즉시 로그인 가능.
    const plainPassword = values.password?.trim() || DEFAULT_USER_PASSWORD;
    const password = await hashPassword(plainPassword);
    const user = userSchema.parse({ ...values, password, id: nextId(all), lastLogin: '-' });
    await this.save(user);
    return user;
  },

  /** 기존 사용자 수정 — lastLogin 등 시스템 필드 보존. 비밀번호는 입력 시에만 변경. */
  async update(id: string, values: UserFormValues): Promise<void> {
    const existing = (await this.list()).find((u) => u.id === id);
    // 비밀번호를 비워두면 기존 비밀번호 보존, 입력하면 해당 값으로 변경.
    let password = existing?.password || '';
    if (values.password?.trim()) {
      password = await hashPassword(values.password.trim());
    }
    await this.save(userSchema.parse({ ...existing, ...values, password, id }));
  },

  /** 프로필 자기 수정 — 사용자가 직접 변경 가능한 필드만(이메일, 인감 URL, 프로필 사진). */
  async updateProfile(id: string, patch: { email?: string; sealUrl?: string; photoUrl?: string }): Promise<User> {
    const all = await this.list();
    const existing = all.find((u) => u.id === id);
    if (!existing) throw new Error('사용자를 찾을 수 없습니다.');
    const updated = userSchema.parse({ ...existing, ...patch, id });
    await this.save(updated);
    return updated;
  },

  async updateActiveChatRoom(userId: string, roomId: string | null): Promise<void> {
    const all = await this.list();
    const existing = all.find((u) => u.id === userId);
    if (!existing) return;
    const updated = {
      ...existing,
      activeChatRoomId: roomId,
    };
    await this.save(updated);
  },

  /** 등록/수정(upsert). */
  async save(user: User): Promise<void> {
    const valid = userSchema.parse(user);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [valid, ...memory];
  },

  async removeMany(ids: Array<string | number>): Promise<void> {
    const set = new Set(ids.map(String));
    if (isFirebaseConfigured && db) {
      const fdb = db;
      await Promise.all([...set].map((id) => deleteDoc(doc(fdb, COLL, id))));
      return;
    }
    memory = memory.filter((m) => !set.has(m.id));
  },
};
