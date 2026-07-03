import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { AuthError } from '@/data/auth/auth.repo';

/** 새 비밀번호 최소 길이(데모 정책). */
const MIN_LEN = 4;

interface Props {
  onClose: () => void;
}

/** 비밀번호 변경 모달 — 로그인 사용자 본인의 비밀번호를 변경(DB 영구화). */
export default function ChangePasswordModal({ onClose }: Props) {
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // 클라이언트 형식 검증
    if (next.length < MIN_LEN) {
      setError(`새 비밀번호는 ${MIN_LEN}자 이상이어야 합니다.`);
      return;
    }
    if (next === current) {
      setError('새 비밀번호가 현재 비밀번호와 같습니다.');
      return;
    }
    if (next !== confirm) {
      setError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'WRONG_PASSWORD') {
        setError('현재 비밀번호가 올바르지 않습니다.');
      } else {
        setError('비밀번호 변경 중 오류가 발생했습니다.');
      }
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal';

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-panel shadow-[0_16px_48px_rgba(16,24,48,0.28)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="text-[14px] font-bold text-ink">비밀번호 변경</div>
          <button onClick={onClose} className="text-[16px] leading-none text-ink3 hover:text-ink">×</button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 px-5 py-8">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-teal-soft text-[22px]">✓</div>
            <div className="text-center text-[13px] font-semibold text-ink">비밀번호가 변경되었습니다.</div>
            <button
              onClick={onClose}
              className="rounded-lg bg-teal px-6 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
            >
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-5 py-5">
            <div className="text-[11.5px] text-ink3">{user?.name} ({user?.empNo})</div>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-ink2">현재 비밀번호</span>
              <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-ink2">새 비밀번호</span>
              <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required className={inputCls} placeholder={`${MIN_LEN}자 이상`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-ink2">새 비밀번호 확인</span>
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} />
            </label>

            {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[11.5px] font-semibold text-danger">{error}</div>}

            <div className="mt-1 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border-hi bg-panel py-2.5 text-[13px] font-semibold text-ink2 hover:bg-panel-alt">
                취소
              </button>
              <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-teal py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                {busy ? '변경 중…' : '변경'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
