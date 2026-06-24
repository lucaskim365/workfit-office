import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import LoginScreen from './LoginScreen';

/**
 * 로그인 게이트 활성화 플래그.
 * VITE_AUTH_ENABLED="true" 일 때만 로그인 화면이 뜬다.
 * 그 외(미설정/false)에는 게이트를 건너뛰고 바로 앱에 진입한다.
 * → 콘솔 Auth 준비가 끝나면 .env 에 이 값만 "true"로 바꾸면 다시 켜진다.
 */
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

/**
 * 인증 게이트 — 로그인한 사용자(또는 데모 모드)에게만 앱 셸을 노출.
 * Firebase 미설정 시 demoMode=true 로 통과(seed 폴백 유지).
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, demoMode } = useAuth();

  if (!AUTH_ENABLED || demoMode) return <>{children}</>;

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg-deep">
        <div className="text-[13px] font-semibold text-ink3">불러오는 중…</div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return <>{children}</>;
}
