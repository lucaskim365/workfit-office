import { useChatFileStatus } from './chatFileStore';
import { fmtSize } from './chatUtils';

/**
 * 채팅 파일 아랫줄(휴대폰) — 받기 전·받는 중(진행률)·받음(앱 보관함에 있어 바로 열림)·받기 실패.
 * 파일 말풍선·서식 메시지 속 파일·여러 파일 묶음이 같이 쓴다
 */
export function ChatFileStatusText({ url, size, className = '' }: { url: string; size: number; className?: string }) {
  const st = useChatFileStatus(url);
  const label =
    st.state === 'loading'
      ? `받는 중 ${st.progress}%`
      : st.state === 'ready'
        ? `${fmtSize(size)} · 받음 — 누르면 열기`
        : st.state === 'error'
          ? '받기 실패 — 다시 누르기'
          : `${fmtSize(size)} · 누르면 받아서 열기`;
  return <span className={`${className} ${st.state === 'error' ? '!text-rose-600' : ''}`}>{label}</span>;
}
