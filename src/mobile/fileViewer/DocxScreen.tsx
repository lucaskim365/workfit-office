import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePinchZoom, ViewerError, ViewerShell, type ViewerFile } from './viewerShell';

/** docx-preview 가 그리는 쪽 폭(A4 기준 대략) — 처음 화면 폭에 맞출 때 쓴다 */
const PAGE_PX = 820;

/**
 * 워드(.docx) — docx-preview 로 쪽 모양 그대로 그린다(처음 열 때만 내려받음). 처음엔 화면 폭에 맞춰 줄이고,
 * 두 손가락으로 확대·축소. .doc(옛 형식)는 읽지 못한다 — [저장]해서 다른 앱으로
 */
export default function DocxScreen({ file, onClose }: { file: ViewerFile; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [zoom, setZoom] = useState(1);
  const pinch = usePinchZoom(contentRef, zoom, setZoom, 0.2, 3);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        el.innerHTML = '';
        await renderAsync(file.blob, el, undefined, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          useBase64URL: true,
        });
        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.warn('[docx] 열기 실패', err);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // 처음엔 화면 폭에 맞춘다
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || status !== 'ready') return;
    const page = (contentRef.current?.querySelector('section') as HTMLElement | null)?.offsetWidth || PAGE_PX;
    setZoom(Math.min(1, Math.max(0.2, +((box.clientWidth - 8) / page).toFixed(2))));
  }, [status]);

  return (
    <ViewerShell file={file} onClose={onClose} zoom={zoom} setZoom={setZoom} min={0.2} max={3} step={0.25} canShare={false}>
      <div
        ref={boxRef}
        {...pinch}
        onTouchCancel={pinch.onTouchEnd}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-[#e8e8e8] p-1"
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', touchAction: 'pan-x pan-y' }}
      >
        {status === 'loading' && <div className="py-16 text-center text-[13px] text-[#666]">워드 문서를 여는 중…</div>}
        {status === 'error' && (
          <div className="bg-[#3a3a3a]">
            <ViewerError file={file} message={/\.doc$/i.test(file.name) ? '예전 워드 형식(.doc)은 앱에서 볼 수 없습니다.' : '워드 문서를 열지 못했습니다.'} />
          </div>
        )}
        {/* docx-preview 가 쪽(section)을 그려 넣는 곳 — 바깥 띠 배경은 위 회색 */}
        <div ref={contentRef} className="w-fit [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-0" style={{ zoom }} />
      </div>
    </ViewerShell>
  );
}
