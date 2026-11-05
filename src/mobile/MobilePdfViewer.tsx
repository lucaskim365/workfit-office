import { useEffect, useRef, useState } from 'react';
import { Download, Minus, Plus, X } from 'lucide-react';
import { downloadFile } from '@/shared/lib/download';

/**
 * 휴대폰 앱(PWA) 안 PDF 보기 — 채팅방 등에서 받은 PDF 를 앱 안에서 연다.
 * 다운로드해서 다른 뷰어 앱으로 열면 그 앱이 따로 떠서, 뒤로가기를 누르면 앱이 아니라 홈 화면으로 나가 버렸다.
 * 이 화면은 열 때 방문 기록을 하나 쌓아 휴대폰 [뒤로가기]가 이 화면만 닫고 원래 화면(대화방)으로 돌아오게 한다.
 * PDF 를 그리는 pdf.js 는 처음 열 때만 내려받는다(앱 시작 속도에 영향 없음).
 *
 * 쓰는 쪽: openPdfViewer(url, name) — 앱 셸(MobileApp)에 띄워 둔 <MobilePdfViewerHost /> 가 받는다.
 */
const OPEN_EVENT = 'workfit-open-pdf';

export function isPdfFile(name: string, mime?: string): boolean {
  return mime === 'application/pdf' || /\.pdf$/i.test(name.trim());
}

export function openPdfViewer(url: string, name: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { url, name } }));
}

/** 앱 셸에 한 번 두는 받침 — 열기 신호를 받아 보기 화면을 띄우고, [뒤로가기]로 닫는다 */
export function MobilePdfViewerHost() {
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ url: string; name: string }>).detail;
      if (!d?.url) return;
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

  return file ? <PdfScreen url={file.url} name={file.name} onClose={close} /> : null;
}

function PdfScreen({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pageCount, setPageCount] = useState(0);
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
        // no-store: 화면이 먼저 받아 둔 캐시(CORS 헤더 없음)를 쓰지 않게(download.ts 와 같은 이유)
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data = new Uint8Array(await res.arrayBuffer());
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
  }, [url]);

  // 그리기 — 화면 폭 × 배율, 선명하게(기기 화소 비율)
  useEffect(() => {
    const doc = docRef.current;
    const holder = pagesRef.current;
    const box = boxRef.current;
    if (status !== 'ready' || !doc || !holder || !box) return;
    let cancelled = false;
    holder.innerHTML = '';
    (async () => {
      const width = (box.clientWidth - 16) * zoom;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
        canvas.className = 'mx-auto mb-2 block bg-white shadow';
        holder.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      }
    })().catch((err) => console.warn('[pdf] 그리기 실패', err));
    return () => {
      cancelled = true;
    };
  }, [status, zoom]);

  const btn = 'grid h-9 w-9 place-items-center rounded-lg bg-white/15 active:bg-white/25 disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#3a3a3a]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex shrink-0 items-center gap-1.5 bg-[#222] px-2 py-2 text-white">
        <span className="min-w-0 flex-1 truncate px-1 text-[12.5px] font-semibold">
          {name}
          {pageCount > 0 ? <span className="ml-1 font-normal text-white/60">({pageCount}쪽)</span> : null}
        </span>
        <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} title="축소" className={btn}>
          <Minus size={16} />
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} disabled={zoom >= 3} title="확대" className={btn}>
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => void downloadFile(url, name)} title="다운로드" className={btn}>
          <Download size={16} />
        </button>
        <button type="button" onClick={onClose} title="닫기" className={btn}>
          <X size={18} />
        </button>
      </div>
      <div ref={boxRef} className="min-h-0 flex-1 overflow-auto p-2" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
        {status === 'loading' && <div className="py-16 text-center text-[13px] text-white/80">PDF를 여는 중…</div>}
        {status === 'error' && (
          <div className="py-16 text-center text-[13px] text-white/90">
            PDF를 열지 못했습니다.
            <button type="button" onClick={() => void downloadFile(url, name)} className="mx-auto mt-3 block rounded-lg bg-white/15 px-4 py-2 font-semibold">
              다운로드해서 보기
            </button>
          </div>
        )}
        <div ref={pagesRef} style={{ width: zoom > 1 ? `${zoom * 100}%` : undefined }} />
      </div>
    </div>
  );
}
