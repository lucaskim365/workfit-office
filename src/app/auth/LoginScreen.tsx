import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from './AuthProvider';

/** Firebase Auth 에러코드 → 한국어 메시지. */
function authErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-email':
        return '이메일 형식이 올바르지 않습니다.';
      case 'auth/user-disabled':
        return '비활성화된 계정입니다.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return '이메일 또는 비밀번호가 올바르지 않습니다.';
      case 'auth/too-many-requests':
        return '로그인 시도가 많습니다. 잠시 후 다시 시도하세요.';
      default:
        return `로그인에 실패했습니다. (${err.code})`;
    }
  }
  return '로그인 중 오류가 발생했습니다.';
}

/** 로그인 화면 — 셸 진입 전 전체화면 게이트. */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg-deep px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-panel shadow-[0_16px_48px_rgba(16,24,48,0.18)]">
        <div className="flex flex-col items-center gap-2 bg-navy px-6 pb-6 pt-8">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-teal text-[22px] font-bold text-white shadow-[0_2px_8px_rgba(23,168,154,0.35)]">
            M
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-white">스마트 MES</div>
            <div className="text-[11.5px] text-white/70">생산 관리 플랫폼</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-6 py-6">
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-ink2">이메일</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal"
              placeholder="you@company.co.kr"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-ink2">비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal"
              placeholder="••••••••"
            />
          </label>

          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[11.5px] font-semibold text-danger">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-lg bg-teal py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
