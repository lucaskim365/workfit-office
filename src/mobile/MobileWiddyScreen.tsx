import { createContext, useContext, type ReactNode } from 'react';
import { useWiddyChat } from '@/features/widdy/useWiddyChat';
import { ChatbotView } from '@/features/widdy/desktop/ChatbotPanel';

const WiddyChatContext = createContext<ReturnType<typeof useWiddyChat> | null>(null);

/** Widdy 대화를 앱 전체에 둔다 — 다른 탭이나 채팅방에 다녀와도 대화가 사라지지 않게 */
export function MobileWiddyProvider({ children }: { children: ReactNode }) {
  const chat = useWiddyChat();
  return <WiddyChatContext.Provider value={chat}>{children}</WiddyChatContext.Provider>;
}

/** 하단 탭 'Widdy' — 웹 챗봇과 같은 화면(사내 문서 질문·첨부·출처). 상단바·하단바는 그대로 둔다. */
export default function MobileWiddyScreen() {
  const chat = useContext(WiddyChatContext);
  if (!chat) return null;
  return <ChatbotView chat={chat} />;
}
