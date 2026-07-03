import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { AuthError, type AuthErrorCode } from '@/data/auth/auth.repo';
import { companyInfoRepo } from '@/data/companyInfo/companyInfo.repo';

/** 자체 로그인 실패 코드 → 한국어 메시지. */
function authErrorMessage(err: unknown): string {
  if (err instanceof AuthError) {
    const map: Record<AuthErrorCode, string> = {
      NOT_FOUND: '사번 또는 이메일이 올바르지 않습니다.',
      WRONG_PASSWORD: '비밀번호가 올바르지 않습니다.',
      LOCKED: '잠긴 계정입니다. 관리자에게 문의하세요.',
      DISABLED: '사용할 수 없는 계정입니다. 관리자에게 문의하세요.',
    };
    return map[err.code];
  }
  return '로그인 중 오류가 발생했습니다.';
}

/** 로그인 화면 — 셸 진입 전 전체화면 게이트. 상단에 회사 로고/명칭 표시. */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 회사 브랜딩(로고/명칭) — QueryProvider 밖이므로 repo 직접 호출.
  const [logoUrl, setLogoUrl] = useState('');
  const [companyName, setCompanyName] = useState('스마트 MES');
  const [sysName, setSysName] = useState('생산 관리 플랫폼');

  useEffect(() => {
    let alive = true;
    companyInfoRepo
      .get()
      .then((c) => {
        if (!alive) return;
        setLogoUrl(c.logoUrl || '');
        if (c.name) setCompanyName(c.name);
        if (c.sysName) setSysName(c.sysName);
      })
      .catch(() => {
        /* 브랜딩 조회 실패 시 기본 문구 유지 */
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(loginId.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg-deep px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-panel shadow-[0_16px_48px_rgba(16,24,48,0.18)]">
        <div className="flex flex-col items-center gap-3 bg-navy px-6 pb-6 pt-8">
          {logoUrl ? (
            // 남색 헤더 위에 로고 직접 배치(흰 로고도 보이도록). 원본 비율 유지 +
            // 최대 높이/너비 제한으로 어떤 비율의 로고든 박스를 넘치지 않게 담는다.
            <img
              src={logoUrl}
              alt={companyName}
              className="max-h-16 w-auto max-w-[240px] object-contain"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-teal text-[22px] font-bold text-white shadow-[0_2px_8px_rgba(23,168,154,0.35)]">
              {companyName.charAt(0) || 'M'}
            </div>
          )}
          <div className="text-center">
            <div className="text-base font-bold text-white">{companyName}</div>
            <div className="text-[11.5px] text-white/70">{sysName}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-6 py-6">
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-ink2">사번 또는 이메일</span>
            <input
              type="text"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              className="rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal"
              placeholder="A12345 또는 you@company.co.kr"
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
