import { useSyncExternalStore, type CSSProperties } from 'react';

/**
 * PWA 메신저 글자 크기 — 사용자별로 브라우저(localStorage)에 둔다(상단 고정과 같은 방식, features/chat/pinnedRooms.ts 참고).
 * 화면은 `chatTextScaleStyle()` 로 `--chat-text-scale` 을 깔고, 글자는 `chat-text-[13px]`(index.css)로 그 배율을 따른다.
 * 값을 깔지 않는 웹 메신저는 배율 1 그대로다.
 */
export type ChatTextSize = 'normal' | 'large' | 'xlarge';

export const CHAT_TEXT_SIZES: { id: ChatTextSize; label: string; scale: number }[] = [
  { id: 'normal', label: '보통', scale: 1 },
  { id: 'large', label: '크게', scale: 1.2 },
  { id: 'xlarge', label: '아주 크게', scale: 1.4 },
];

const keyOf = (me: string) => `workfit-chat-text-size-${me}`;
const CHANGE_EVENT = 'workfit-chat-text-size-change';

export function parseChatTextSize(raw: string | null): ChatTextSize {
  return CHAT_TEXT_SIZES.some((s) => s.id === raw) ? (raw as ChatTextSize) : 'normal';
}

export function readChatTextSize(me: string): ChatTextSize {
  try {
    return parseChatTextSize(localStorage.getItem(keyOf(me)));
  } catch {
    return 'normal';
  }
}

export function setChatTextSize(me: string, size: ChatTextSize): void {
  try {
    localStorage.setItem(keyOf(me), size);
  } catch {
    /* 저장 불가(사생활 모드 등) — 이번 화면에서만 못 바뀐다 */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange); // 다른 탭에서 바꾼 경우
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** 내 글자 크기 — 어디서 바꾸든 열려 있는 화면이 즉시 다시 그린다. */
export function useChatTextSize(me: string): ChatTextSize {
  return useSyncExternalStore(subscribe, () => readChatTextSize(me));
}

/** 화면 맨 바깥 요소에 깔 배율 변수. */
export function chatTextScaleStyle(size: ChatTextSize): CSSProperties {
  const scale = CHAT_TEXT_SIZES.find((s) => s.id === size)?.scale ?? 1;
  return { '--chat-text-scale': String(scale) } as CSSProperties;
}
