import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Download, Minus, Plus, Share2, X } from 'lucide-react';
import { saveBlob, shareFile } from '../chatFileStore';

/** 앱 안 파일 보기 화면이 받는 파일 */
export type ViewerFile = { blob: Blob; name: string; mime: string };

/**
 * 두 손가락 확대·축소 — 움직이는 동안은 그림만 늘이고(transform), 손을 떼면 그 배율로 정한다(다시 그리기는 화면마다).
 * contentRef: 늘일 상자, zoom: 지금 배율, setZoom: 손을 뗀 뒤 배율
 */
export function usePinchZoom(contentRef: RefObject<HTMLElement | null>, zoom: number, setZoom: (z: number) => void, min: number, max: number) {
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const distOf = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length === 2) pinch.current = { dist: distOf(e.touches), scale: 1 };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const p = pinch.current;
      const el = contentRef.current;
      if (!p || e.touches.length !== 2 || !el) return;
      p.scale = Math.min(max / zoom, Math.max(min / zoom, distOf(e.touches) / p.dist));
      el.style.transformOrigin = 'top left';
      el.style.transform = `scale(${p.scale})`;
    },
    onTouchEnd: () => {
      const p = pinch.current;
      if (!p) return;
      pinch.current = null;
      if (contentRef.current) contentRef.current.style.transform = '';
      const z = Math.min(max, Math.max(min, Math.round(zoom * p.scale * 20) / 20));
      if (z !== zoom) setZoom(z);
    },
  };
}

/**
 * 보기 화면 틀 — 위 띠(파일 이름·확대·축소·다른 앱으로 열기·저장·닫기), 아래 내용, 알림 한 줄.
 * canShare: 휴대폰 공유 창으로 넘길 수 있는 종류만(PDF) — 엑셀·워드는 크롬이 막아 [저장]만
 */
export function ViewerShell({
  file,
  onClose,
  zoom,
  setZoom,
  min,
  max,
  step,
  canShare,
  footer,
  children,
}: {
  file: ViewerFile;
  onClose: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  min: number;
  max: number;
  step: number;
  canShare: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [notice, setNotice] = useState('');
  const openWith = async () => {
    const r = await shareFile(file.blob, file.name, file.mime);
    if (r === 'unsupported') setNotice('이 휴대폰에서는 다른 앱으로 열 수 없습니다 — [저장]으로 내려받아 여세요.');
    else if (r === 'expired') setNotice('한 번 더 눌러 주세요.');
  };
  const btn = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 active:bg-white/25 disabled:opacity-40';
  return (
    // overscroll-none: 끌기가 페이지로 넘어가 '당겨서 새로고침'이 되지 않게(MobileFileViewer 가 페이지에도 끈다)
    <div className="fixed inset-0 z-[200] flex flex-col overscroll-none bg-[#3a3a3a]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex shrink-0 items-center gap-1 bg-[#222] px-2 py-2 text-white">
        <span className="min-w-0 flex-1 truncate px-1 text-[12.5px] font-semibold">{file.name}</span>
        <button type="button" onClick={() => setZoom(Math.max(min, +(zoom - step).toFixed(2)))} disabled={zoom <= min} title="축소" className={btn}>
          <Minus size={16} />
        </button>
        <button type="button" onClick={() => setZoom(Math.min(max, +(zoom + step).toFixed(2)))} disabled={zoom >= max} title="확대" className={btn}>
          <Plus size={16} />
        </button>
        {canShare && (
          <button type="button" onClick={() => void openWith()} title="다른 앱으로 열기" className={btn}>
            <Share2 size={16} />
          </button>
        )}
        <button type="button" onClick={() => saveBlob(file.blob, file.name)} title="저장(다운로드 폴더)" className={btn}>
          <Download size={16} />
        </button>
        <button type="button" onClick={onClose} title="닫기" className={btn}>
          <X size={18} />
        </button>
      </div>
      {children}
      {footer}
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

/** 열지 못했을 때 — 저장해서 다른 앱으로 */
export function ViewerError({ file, message }: { file: ViewerFile; message: string }) {
  return (
    <div className="py-16 text-center text-[13px] text-white/90">
      {message}
      <button type="button" onClick={() => saveBlob(file.blob, file.name)} className="mx-auto mt-3 block rounded-lg bg-white/15 px-4 py-2 font-semibold">
        저장해서 다른 앱으로 열기
      </button>
    </div>
  );
}
