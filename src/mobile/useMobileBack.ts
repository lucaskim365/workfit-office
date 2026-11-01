import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/** 앱 안에서 돌아갈 화면이 있는지 — 라우터가 history.state.idx 에 몇 번째 화면인지 적어 둔다(첫 화면 0) */
export function canGoBackInApp(historyState: unknown): boolean {
  const idx = (historyState as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' && idx > 0;
}

/**
 * 화면 안 ← 버튼 — 휴대폰 뒤로가기와 똑같이 히스토리를 한 칸 되돌린다.
 * 상위 화면으로 새로 이동(nav('/m'))하면 다녀온 화면이 히스토리에 쌓여, 휴대폰 뒤로가기로 앱을 닫으려 할 때 그 화면들을 다시 오가게 된다.
 * 알림으로 바로 들어와 돌아갈 화면이 없으면 parent 로 바꿔치기한다.
 */
export function useMobileBack(parent: string) {
  const nav = useNavigate();
  return useCallback(() => {
    if (canGoBackInApp(window.history.state)) nav(-1);
    else nav(parent, { replace: true });
  }, [nav, parent]);
}
