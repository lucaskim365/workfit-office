import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { enablePushForUser, isPushConfigured, notificationPermission } from '@/shared/lib/messaging';
import { checkDeviceEnvironment } from './IosPwaGuideModal';
import { pushBlockedGuide, pushUnavailableGuide, type PushGuide } from './pushGuide';

const INTRO_KEY = 'workfit.push-intro.v1';
function dismissed(): boolean {
  try { return localStorage.getItem(INTRO_KEY) === 'done'; } catch { return false; }
}
function remember(): void {
  try { localStorage.setItem(INTRO_KEY, 'done'); } catch { /* 저장 제한 환경 */ }
}

/** 지금 요청해 봐야 소용없는 상태면 그 안내(앱 안 브라우저·설치 전 아이폰·이미 차단). 요청해도 되면 null. */
function currentGuide(): PushGuide | null {
  return pushUnavailableGuide() ?? (notificationPermission() === 'denied' ? pushBlockedGuide() : null);
}

export default function MobilePushPermissionPrompt({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [guide, setGuide] = useState<PushGuide | null>(null);

  useEffect(() => {
    if (checkDeviceEnvironment().isStandalone && window.isSecureContext && isPushConfigured() && notificationPermission() === 'default' && !dismissed()) setOpen(true);
    const show = () => { setError(''); setGuide(currentGuide()); setOpen(true); };
    window.addEventListener('workfit-enable-push', show);
    return () => window.removeEventListener('workfit-enable-push', show);
  }, []);

  // 설정에서 차단을 풀고 돌아오면 안내를 걷어 바로 [허용]할 수 있게 한다
  useEffect(() => {
    if (!open || !guide) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !currentGuide()) { setGuide(null); setError(''); }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [open, guide]);

  const close = () => { if (!busy) { remember(); setOpen(false); } };

  const allow = async () => {
    if (busy) return;
    if (!window.isSecureContext || !isPushConfigured()) { setError('알림을 지원하는 HTTPS 앱에서 다시 시도해 주세요.'); return; }
    // 차단됐거나 앱 안 브라우저면 요청해도 바로 거절된다 — 요청하지 않고 푸는 방법을 보여 준다
    const blocked = currentGuide();
    if (blocked) { setGuide(blocked); setError(''); return; }
    setBusy(true);
    setError('');
    try {
      // 브라우저 권한 요청은 사용자가 누른 이 버튼에서 실행한다.
      const permission = await Notification.requestPermission();
      if (permission === 'denied') { setGuide(pushBlockedGuide()); return; }
      if (permission !== 'granted') { setError('알림 요청 창에서 "허용"을 선택해 주세요. 창이 뜨지 않았다면 잠시 후 다시 시도해 주세요.'); return; }
      const result = await enablePushForUser(userId);
      // 원인을 알 수 있게 실제 오류를 함께 보여 준다(관리자에게 전달용)
      if (!result.ok) { setError(`알림 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.${result.error ? `\n(원인: ${result.error})` : ''}`); return; }
      remember();
      setGuide(null);
      setOpen(false);
      window.dispatchEvent(new CustomEvent('workfit-push-enabled'));
    } catch { setError('알림을 켜지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };

  /** 설정을 바꾸고 돌아와 누르는 버튼 — 풀렸으면 바로 연결, 아직이면 그대로 안내 */
  const recheck = () => {
    const still = currentGuide();
    if (still) { setGuide(still); setError('아직 차단되어 있어요. 위 순서대로 허용으로 바꿨는지 확인해 주세요.'); return; }
    setGuide(null);
    void allow();
  };

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/50 px-6" role="dialog" aria-modal="true" aria-labelledby="push-intro-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        {guide ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><BellOff size={28} /></div>
            <h2 id="push-intro-title" className="mt-4 text-[16px] font-bold text-slate-900">알림을 켤 수 없는 상태예요</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">{guide.title}</p>
            <ol className="mt-3 list-decimal space-y-1.5 rounded-xl bg-slate-50 py-3 pl-8 pr-3 text-left text-[12.5px] leading-relaxed text-slate-700">
              {guide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            {error && <p role="alert" className="mt-3 whitespace-pre-line break-all text-[12px] text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" disabled={busy} onClick={close} className="flex-1 rounded-xl bg-slate-100 py-3 text-[13px] font-bold text-slate-600 disabled:opacity-50">닫기</button>
              {guide.recheckable && (
                <button type="button" disabled={busy} onClick={recheck} className="flex-1 rounded-xl bg-teal-600 py-3 text-[13px] font-bold text-white disabled:opacity-50">{busy ? '설정 중…' : '다시 확인'}</button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-600"><Bell size={28} /></div>
            <h2 id="push-intro-title" className="mt-4 text-[17px] font-bold text-slate-900">알림을 허용하시겠습니까?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">새 메시지와 전자결재, 일정 알림을<br />바로 받아볼 수 있어요.</p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-400">이어서 뜨는 창에서 "허용"을 눌러 주세요.<br />"차단"을 누르면 설정에서 직접 풀어야 해요.</p>
            {error && <p role="alert" className="mt-3 whitespace-pre-line break-all text-[12px] text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" disabled={busy} onClick={close} className="flex-1 rounded-xl bg-slate-100 py-3 text-[13px] font-bold text-slate-600 disabled:opacity-50">나중에</button>
              <button type="button" disabled={busy} onClick={() => void allow()} className="flex-1 rounded-xl bg-teal-600 py-3 text-[13px] font-bold text-white disabled:opacity-50">{busy ? '설정 중…' : error ? '다시 시도' : '허용'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
