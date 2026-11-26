import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMutating } from '@tanstack/react-query';
import { pmStore } from '@/data/pm/pmStoreInstance';
import { PM_MUTATION_KEY } from '@/features/pm/usePm';
import type { PmProgress } from '@/data/pm/pmSync';
import { clearPmSaveError, isShownPmSaveError, usePmSaveBus } from '@/features/pm/pmSaveBus';

/**
 * PM 저장 공통 표시 (7-6, DB 모드에서만 나옴 — 메모리 모드는 저장이 바로 끝나고 DB 오류가 없음).
 * ① 쓰기가 20건 넘는 저장(사업 등록 · 삭제 · 일괄 수정 · 견적) · 쓰기 제한(429)으로 기다릴 때 — "저장 중 n / 전체",
 *    "쓰기 제한으로 기다리는 중 · 남은 n건". 창 위를 덮어 저장 중엔 창 닫기 · 같은 버튼 · ESC 를 막음 (설계 5.7.2 K4 d).
 * ② DB 저장 실패(충돌 · 일부만 저장 · 연결 오류) 안내 — 창 위에도 보이게 오른쪽 위에. 오류 칸이 없는 저장(체크 등)도 안내가 나옴.
 */
export function PmSaveLayer() {
  const [prog, setProg] = useState<PmProgress | null>(null);
  const busy = useIsMutating({ mutationKey: PM_MUTATION_KEY }) > 0;
  const { last } = usePmSaveBus();

  useEffect(() => {
    const s = pmStore();
    s.onProgress((p) => setProg({ ...p }));
    return () => s.onProgress(null);
  }, []);
  // 저장이 다 끝나면 진행 표시를 닫음
  useEffect(() => { if (!busy) setProg(null); }, [busy]);

  // 안내를 띄운 저장 실패를 화면 코드가 받지 않았을 때(void mutateAsync) 콘솔 오류로 또 나오지 않게
  useEffect(() => {
    const onRej = (e: PromiseRejectionEvent) => { if (isShownPmSaveError(e.reason)) e.preventDefault(); };
    window.addEventListener('unhandledrejection', onRej);
    return () => window.removeEventListener('unhandledrejection', onRej);
  }, []);

  const showProg = !!prog && busy;
  // 저장 중엔 ESC 로 창이 닫히지 않게 (창의 ESC 는 window 에서 받음 → 먼저 가로챔)
  useEffect(() => {
    if (!showProg) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [showProg]);

  return createPortal(
    <>
      {showProg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-deep/30" role="alertdialog" aria-live="polite" aria-label="저장 중">
          <div className="w-[380px] rounded-xl border border-border bg-panel px-5 py-4 shadow-lg">
            <div className="text-[14px] font-bold text-ink">저장 중 {prog.done.toLocaleString()} / {prog.total.toLocaleString()}</div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-panel-alt">
              <div className="h-full bg-navy transition-[width]" style={{ width: `${prog.total ? Math.round((prog.done / prog.total) * 100) : 0}%` }} />
            </div>
            {prog.waitMs
              ? <div className="mt-2 text-[12.5px] font-bold text-amber-700">쓰기 제한으로 기다리는 중 · 남은 {(prog.total - prog.done).toLocaleString()}건 (약 {Math.round(prog.waitMs / 1000)}초 뒤 이어 씀)</div>
              : <div className="mt-2 text-[12px] text-ink3">끝날 때까지 창을 닫지 말고 기다려 주세요</div>}
          </div>
        </div>
      )}
      {last && (
        <div role="alert" className="fixed right-6 top-6 z-[80] flex max-w-[460px] items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-800 shadow-lg">
          <span className="flex-1">{last.msg}</span>
          <button type="button" className="shrink-0 font-bold text-red-700 underline" onClick={clearPmSaveError}>닫기</button>
        </div>
      )}
    </>,
    document.body,
  );
}
