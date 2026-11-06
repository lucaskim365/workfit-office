import { useEffect, useRef, useState } from 'react';
import { usePinchZoom, ViewerError, ViewerShell, type ViewerFile } from './viewerShell';

/** PDF — pdf.js 로 쪽마다 그림(처음 열 때만 내려받음). 두 손가락 확대·축소, 쪽 번호, 다른 앱으로 열기 */
export default function PdfScreen({ file, onClose }: { file: ViewerFile; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  // 배율 — 1 = 화면 폭에 맞춤
  const [zoom, setZoom] = useState(1);
  const docRef = useRef<{ numPages: number; getPage: (n: number) => Promise<any>; destroy: () => Promise<void> } | null>(null);
  const pinch = usePinchZoom(pagesRef, zoom, setZoom, 1, 4);

  // 불러오기
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const data = new Uint8Array(await file.blob.arrayBuffer());
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return void doc.destroy();
        docRef.current = doc;
        setPageCount(doc.numPages);
        setStatus('ready');
      } catch (err) {
        console.warn('[pdf] 열기 실패', err);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      void docRef.current?.destroy();
      docRef.current = null;
    };
  }, [file]);

  // 그리기 — 화면 폭 × 배율, 선명하게(기기 화소 비율). 배율을 바꾸면 보던 자리를 지킨다
  useEffect(() => {
    const doc = docRef.current;
    const holder = pagesRef.current;
    const box = boxRef.current;
    if (status !== 'ready' || !doc || !holder || !box) return;
    let cancelled = false;
    const keepRatio = box.scrollHeight > 0 ? box.scrollTop / box.scrollHeight : 0;
    holder.innerHTML = '';
    (async () => {
      const width = (box.clientWidth - 16) * zoom;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const pg = await doc.getPage(n);
        const base = pg.getViewport({ scale: 1 });
        const viewport = pg.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
        canvas.dataset.page = String(n);
        canvas.className = 'mx-auto mb-2 block bg-white shadow';
        holder.appendChild(canvas);
        await pg.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        if (n === 1 || n === doc.numPages) box.scrollTop = keepRatio * box.scrollHeight;
      }
    })().catch((err) => console.warn('[pdf] 그리기 실패', err));
    return () => {
      cancelled = true;
    };
  }, [status, zoom]);

  // 쪽 번호 — 화면 가운데에 걸친 쪽
  const onScroll = () => {
    const box = boxRef.current;
    const holder = pagesRef.current;
    if (!box || !holder) return;
    const mid = box.scrollTop + box.clientHeight / 2;
    let current = 1;
    for (const c of Array.from(holder.children) as HTMLElement[]) {
      if (c.offsetTop <= mid) current = Number(c.dataset.page) || current;
      else break;
    }
    setPage(current);
  };

  return (
    <ViewerShell
      file={file}
      onClose={onClose}
      zoom={zoom}
      setZoom={setZoom}
      min={1}
      max={4}
      step={0.5}
      canShare
      footer={
        pageCount > 0 && (
          <div className="pointer-events-none absolute bottom-[calc(14px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11.5px] font-semibold text-white">
            {page} / {pageCount}
          </div>
        )
      }
    >
      <div
        ref={boxRef}
        onScroll={onScroll}
        {...pinch}
        onTouchCancel={pinch.onTouchEnd}
        className="relative min-h-0 flex-1 overflow-auto p-2"
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', touchAction: 'pan-x pan-y' }}
      >
        {status === 'loading' && <div className="py-16 text-center text-[13px] text-white/80">PDF를 여는 중…</div>}
        {status === 'error' && <ViewerError file={file} message="PDF를 열지 못했습니다." />}
        <div ref={pagesRef} style={{ width: zoom > 1 ? `${zoom * 100}%` : undefined }} />
      </div>
    </ViewerShell>
  );
}
