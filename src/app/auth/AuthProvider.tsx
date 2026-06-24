import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FbUser,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/shared/lib/firebase';

/**
 * 인증 컨텍스트 — Firebase Auth(이메일/비밀번호) 로그인 게이트.
 * 클라이언트 SDK가 Firestore에 직접 접근하므로, 로그인 = 보안 룰(request.auth != null)의 전제다.
 *
 * Firebase 미설정(.env 없음)일 때는 데모 모드로 자동 통과시켜
 * seed 폴백으로 동작하던 기존 동작을 깨지 않는다. ([[data-layer-pattern]] graceful degrade)
 */
interface AuthState {
  user: FbUser | null;
  /** 인증 상태 확정 전(초기 로딩). */
  loading: boolean;
  /** Firebase 미설정으로 인증을 건너뛴 데모 모드. */
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FbUser | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signIn(email: string, password: string) {
    if (!auth) throw new Error('Firebase Auth가 초기화되지 않았습니다.');
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOutUser() {
    if (!auth) return;
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, demoMode: !isFirebaseConfigured, signIn, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 <AuthProvider> 내부에서만 사용할 수 있습니다.');
  return ctx;
}
