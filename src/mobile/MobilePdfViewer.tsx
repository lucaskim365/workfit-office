import { useEffect, useRef, useState } from 'react';
import { Download, Minus, Plus, Share2, X } from 'lucide-react';
import { saveBlob, shareFile } from './chatFileStore';

/**
 * 휴대폰 앱(PWA) 안 PDF 보기 — 채팅방 등에서 받은 PDF 를 앱 안에서 연다.
 * 다운로드해서 다른 뷰어 앱으로 열면(휴대폰에 따라 다운로드 뒤 자동으로 뜨는 '다른 앱으로 열기') 그 앱이 따로 떠서,
 * 뒤로가기를 누르면 앱이 아니라 홈 화면으로 나가 버렸다. 이 화면은 열 때 방문 기록을 하나 쌓아
 * 휴대폰 [뒤로가기]가 이 화면만 닫고 원래 화면(대화방)으로 돌아오게 한다.
 * - [다른 앱으로 열기]: 휴대폰 공유 창 — 앱 화면 위에 떠서 고른 뷰어에서 뒤로가기하면 이 화면으로 돌아온다
 * - [저장]: 휴대폰 '다운로드' 폴더에
 * - 두 손가락으로 확대·축소, 쪽 번호
 * PDF 를 그리는 pdf.js 는 처음 열 때만 내려받는다(앱 시작 속도에 영향 없음).
 *
 * 쓰는 쪽: openPdfViewer({ blob, name, mime }) — 앱 셸(MobileApp)의 <MobilePdfViewerHost /> 가 받는다.
 */
const OPEN_EVENT = 'workfit-open-pdf';

type PdfFile = { blob: Blob; name: string; mime: string };

export function isPdfFile(name: string, mime?: string): boolean {
  return mime === 'application/pdf' || /\.pdf$/i.test(name.trim());
}

export function openPdfViewer(file: PdfFile) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: file }));
}

/** 앱 셸에 한 번 두는 받침 — 열기 신호를 받아 보기 화면을 띄우고, [뒤로가기]로 닫는다 */
export function MobilePdfViewerHost() {
  const [file, setFile] = useState<PdfFile | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<PdfFile>).detail;
      if (!d?.blob) return;
      setFile(d);
      // 뒤로가기가 이 화면만 닫게 — 같은 주소로 기록 하나
      if (!pushed.current) {
        window.history.pushState({ ...(window.history.state ?? {}), workfitPdf: true }, '');
        pushed.current = true;
      }
    };
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      setFile(null);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  // [닫기] — 쌓아 둔 기록을 되돌린다(popstate 가 닫는다)
  const close = () => {
    if (pushed.current) window.history.back();
    else setFile(null);
  };

  return file ? <PdfScreen file={file} onClose={close} /> : null;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function PdfScreen({ file, onClose }: { file: PdfFile; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  // 배율 — 1 = 화면 폭에 맞춤
  const [zoom, setZoom] = useState(1);
  const docRef = useRef<{ numPages: number; getPage: (n: number) => Promise<any>; destroy: () => Promise<void> } | null>(null);

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

  // 두 손가락 확대·축소 — 움직이는 동안은 그림만 늘이고(transform), 손을 떼면 그 배율로 다시 그린다(선명하게)
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const distOf = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) pinch.current = { dist: distOf(e.touches), scale: 1 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = pinch.current;
    const holder = pagesRef.current;
    if (!p || e.touches.length !== 2 || !holder) return;
    const next = Math.min(MAX_ZOOM / zoom, Math.max(MIN_ZOOM / zoom, distOf(e.touches) / p.dist));
    p.scale = next;
    holder.style.transformOrigin = 'top left';
    holder.style.transform = `scale(${next})`;
  };
  const onTouchEnd = () => {
    const p = pinch.current;
    const holder = pagesRef.current;
    if (!p) return;
    pinch.current = null;
    if (holder) holder.style.transform = '';
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * p.scale * 4) / 4));
    if (z !== zoom) setZoom(z);
  };

  const openWith = async () => {
    const r = await shareFile(file.blob, file.name, file.mime);
    if (r === 'unsupported') setNotice('이 휴대폰에서는 다른 앱으로 열 수 없습니다 — [저장]으로 내려받아 여세요.');
    else if (r === 'expired') setNotice('한 번 더 눌러 주세요.');
  };

  const btn = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 active:bg-white/25 disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#3a3a3a]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex shrink-0 items-center gap-1 bg-[#222] px-2 py-2 text-white">
        <span className="min-w-0 flex-1 truncate px-1 text-[12.5px] font-semibold">{file.name}</span>
        <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.5))} disabled={zoom <= MIN_ZOOM} title="축소" className={btn}>
          <Minus size={16} />
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))} disabled={zoom >= MAX_ZOOM} title="확대" className={btn}>
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => void openWith()} title="다른 앱으로 열기" className={btn}>
          <Share2 size={16} />
        </button>
        <button type="button" onClick={() => saveBlob(file.blob, file.name)} title="저장(다운로드 폴더)" className={btn}>
          <Download size={16} />
        </button>
        <button type="button" onClick={onClose} title="닫기" className={btn}>
          <X size={18} />
        </button>
      </div>
      <div
        ref={boxRef}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="relative min-h-0 flex-1 overflow-auto p-2"
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', touchAction: 'pan-x pan-y' }}
      >
        {status === 'loading' && <div className="py-16 text-center text-[13px] text-white/80">PDF를 여는 중…</div>}
        {status === 'error' && (
          <div className="py-16 text-center text-[13px] text-white/90">
            PDF를 열지 못했습니다.
            <button type="button" onClick={() => void openWith()} className="mx-auto mt-3 block rounded-lg bg-white/15 px-4 py-2 font-semibold">
              다른 앱으로 열기
            </button>
          </div>
        )}
        <div ref={pagesRef} style={{ width: zoom > 1 ? `${zoom * 100}%` : undefined }} />
      </div>
      {pageCount > 0 && (
        <div className="pointer-events-none absolute bottom-[calc(14px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11.5px] font-semibold text-white">
          {page} / {pageCount}
        </div>
      )}
      {notice && (
        <button
          type="button"
          onClick={() => setNotice('')}
          className="absolute inset-x-4 bottom-[calc(48px+env(safe-area-inset-bottom))] rounded-lg bg-black/80 px-3 py-2 text-[12px] text-white"
        >
          {notice}
        </button>
      )}
    </div>
  );
}
