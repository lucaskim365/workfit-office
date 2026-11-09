import { canShareFileType, useChatFileStatus } from './chatFileStore';
import { viewerKindOf } from './MobileFileViewer';
import { fmtSize } from './chatUtils';

/**
 * 채팅 파일 아랫줄(휴대폰) — 받기 전·받는 중(진행률)·받음(앱 보관함에 있어 바로 열림)·받기 실패.
 * 파일 말풍선·서식 메시지 속 파일·여러 파일 묶음이 같이 쓴다
 */
export function ChatFileStatusText({ url, name, size, className = '' }: { url: string; name: string; size: number; className?: string }) {
  const st = useChatFileStatus(url);
  // 한글·압축 등 — 앱 안에서도 공유 창으로도 못 열어 다운로드로 연다(PDF·엑셀·워드는 앱 안 보기 화면)
  const downloadOnly = !viewerKindOf(name) && !canShareFileType(name);
  const label = downloadOnly
    ? `${fmtSize(size)} · 누르면 다운로드`
    :
    st.state === 'loading'
      ? `받는 중 ${st.progress}%`
      : st.state === 'ready'
        ? `${fmtSize(size)} · 받음 — 누르면 열기`
        : st.state === 'error'
          ? '받기 실패 — 다시 누르기'
          : `${fmtSize(size)} · 누르면 받아서 열기`;
  return <span className={`${className} ${st.state === 'error' ? '!text-rose-600' : ''}`}>{label}</span>;
}
