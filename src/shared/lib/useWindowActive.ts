import { useSyncExternalStore } from 'react';

/** 이 창을 지금 보고 있는지 — 화면에 보이고(다른 탭이 아니고) 키보드 포커스가 이 창에 있을 때만 true */
export function isWindowActive(doc: Pick<Document, 'visibilityState' | 'hasFocus'>): boolean {
  return doc.visibilityState === 'visible' && doc.hasFocus();
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('focus', onChange);
  window.addEventListener('blur', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    window.removeEventListener('blur', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

/** 창을 보고 있는지 실시간으로 — 다른 창으로 갔다 돌아오면 다시 렌더된다 */
export function useWindowActive(): boolean {
  return useSyncExternalStore(subscribe, () => isWindowActive(document));
}
