import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authRepo } from '@/data/auth/auth.repo';
import { userRepo } from '@/data/user/user.repo';
import type { User } from '@/domain/user/schema';

/**
 * 인증 컨텍스트 — 자체 로그인(users 컬렉션 대조) 세션.
 * ⚠ UI 게이트일 뿐 진짜 보안이 아니다(클라 평문 대조). 진짜 인증은 후속
 *    Cloud Function custom token 으로 전환 예정. ([[firebase-backend-setup]])
 *
 * 세션은 localStorage 에 사용자 id 만 저장하고, 초기 로드 시 users 에서 복원한다.
 * (전체 User 를 저장하면 stale/평문 노출 위험 → id 만 보관)
 *
 * ⚠ 이 Provider 는 QueryProvider 바깥에 있으므로 TanStack Query 훅을 쓰지 못한다.
 *    → repo(authRepo/userRepo)를 직접 호출한다.
 */
interface AuthState {
  /** 로그인한 사용자(자체 도메인 User). 미로그인 시 null. */
  user: User | null;
  /** 세션 복원 등 초기 로딩 중. */
  loading: boolean;
  /** 자체 로그인은 항상 동작하므로 데모 통과 개념은 없음(하위호환용, 항상 false). */
  demoMode: boolean;
  /** 사번(empNo) 또는 이메일 + 비밀번호로 로그인. 실패 시 AuthError throw. */
  signIn: (loginId: string, password: string) => Promise<void>;
  /** 로그아웃 — 세션 클리어. */
  signOutUser: () => Promise<void>;
  /** 로그인 사용자의 비밀번호 변경(현재 비번 검증 후 DB 영구화). 실패 시 AuthError throw. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const SESSION_KEY = 'mes.auth.uid';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 초기 마운트 시 저장된 세션(사용자 id) 복원.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const uid = sessionStorage.getItem(SESSION_KEY);
        if (uid) {
          const users = await userRepo.list();
          const found = users.find((u) => u.id === uid && u.status === '사용');
          if (alive && found) setUser(found);
          else sessionStorage.removeItem(SESSION_KEY);
        }
      } catch {
        /* 복원 실패 시 미로그인으로 처리 */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function signIn(loginId: string, password: string) {
    const u = await authRepo.authenticate(loginId, password);
    sessionStorage.setItem(SESSION_KEY, u.id);
    setUser(u);
    void authRepo.touchLastLogin(u.id);
  }

  async function signOutUser() {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    if (!user) throw new Error('로그인 상태가 아닙니다.');
    const updated = await authRepo.changePassword(user.id, currentPassword, newPassword);
    setUser(updated); // 세션 내 비밀번호 최신화(이후 변경 검증 정확)
  }

  return (
    <AuthContext.Provider value={{ user, loading, demoMode: false, signIn, signOutUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 <AuthProvider> 내부에서만 사용할 수 있습니다.');
  return ctx;
}
