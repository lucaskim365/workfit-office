import { useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';

/** 모바일 PWA 로그인 — 사번/이메일 + 비밀번호(자체 로그인). */
export default function MobileLogin() {
  const { signIn } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!loginId.trim() || !password) {
      setErr('사번(또는 이메일)과 비밀번호를 입력하세요.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await signIn(loginId.trim(), password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-7" style={{ background: '#101830' }}>
      <img src="/icons/icon-192.png" alt="워크핏" className="h-20 w-20 rounded-[22px]" />
      <h1 className="mt-4 text-[20px] font-extrabold text-white">워크핏 메신저</h1>
      <p className="mt-1 text-[12px] text-white/60">사내 전용 메신저 &amp; 전자결재</p>

      <div className="mt-8 w-full rounded-2xl bg-white p-5">
        <input
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="사번 또는 사내 이메일"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-lg border border-border px-3 py-2.5 text-[13px] text-ink outline-none focus:border-amber"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          type="password"
          placeholder="비밀번호"
          className="mt-3 w-full rounded-lg border border-border px-3 py-2.5 text-[13px] text-ink outline-none focus:border-amber"
        />
        {err && <div className="mt-2 text-[11.5px] text-danger">{err}</div>}
        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-lg py-3 text-[14px] font-bold text-white disabled:opacity-60"
          style={{ background: '#e6960c' }}
        >
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </div>
      <p className="mt-6 text-[10.5px] text-white/40">© Workfit Mobile</p>
    </div>
  );
}
