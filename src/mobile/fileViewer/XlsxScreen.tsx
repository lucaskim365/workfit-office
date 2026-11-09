import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, SheetView, XlsxError, importXlsx, xlsxSheetImages, type Sheet, type XlsxImage } from '@/lib/sheet';
import { usePinchZoom, ViewerError, ViewerShell, type ViewerFile } from './viewerShell';

/** 휴대폰에서 그릴 만큼 — 이보다 크면 잘라 내고 안내(앞부분만 보임) */
const MAX_ROWS = 1000;
const MAX_COLS = 100;
/** 엑셀 기본 칸 크기(px) — 칸 내용이 없는 시트에서 그림 자리를 셀 때 */
const EXCEL_COL_PX = 64;
const EXCEL_ROW_PX = 20;

type Loaded = {
  /** 칸 내용이 없는 시트(그림만 있는 흐름도 등)는 null */
  sheet: Sheet | null;
  images: XlsxImage[];
  cut: string | null;
};

/**
 * 엑셀(.xlsx) — 시트 서식과 같은 엑셀 읽기(@/lib/sheet)로 칸·병합·글꼴·테두리·배경을 그리고, 시트 위에 띄운 그림도 제자리에 얹는다.
 * 아래 탭으로 시트를 고른다. 처음엔 화면 폭에 맞춰 줄이고, 두 손가락으로 확대·축소. 계산 못 하는 수식은 엑셀이 저장한 값으로 보인다.
 * 도형·차트는 보이지 않는다. .xls(옛 형식)는 읽지 못한다 — [저장]해서 다른 앱으로
 */
export default function XlsxScreen({ file, onClose }: { file: ViewerFile; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const pinch = usePinchZoom(contentRef, zoom, setZoom, 0.2, 3);

  useEffect(() => {
    let cancelled = false;
    void file.blob.arrayBuffer().then((b) => !cancelled && setBytes(new Uint8Array(b)));
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    setLoaded(null);
    setError('');
    (async () => {
      const images = await xlsxSheetImages(bytes, sheetIdx);
      try {
        const r = await importXlsx(bytes, { sheet: sheetIdx, maxRows: MAX_ROWS, maxCols: MAX_COLS, ignorePrintArea: true });
        if (cancelled) return;
        setNames(r.sheetNames);
        // 잘라 낸 경우만 알린다(못 가져온 서식 등은 보기엔 상관없음)
        setLoaded({ sheet: r.sheet, images, cut: r.warnings.find((w) => w.includes('까지만 가져왔습니다')) ?? null });
      } catch (e) {
        if (cancelled) return;
        // 칸 내용이 없는 시트 — 그림만 보이거나 빈 시트 안내
        if (e instanceof XlsxError && e.message.includes('내용이 없습니다')) return setLoaded({ sheet: null, images, cut: null });
        console.warn('[xlsx] 열기 실패', e);
        setError(/\.xls$/i.test(file.name) ? '예전 엑셀 형식(.xls)은 앱에서 볼 수 없습니다.' : '이 시트를 열지 못했습니다.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, sheetIdx, file.name]);

  // 그림 주소 — 시트를 바꾸거나 닫으면 정리
  const imageUrls = useMemo(() => (loaded?.images ?? []).map((img) => URL.createObjectURL(new Blob([img.data as BlobPart], { type: img.type }))), [loaded]);
  useEffect(() => () => imageUrls.forEach((u) => URL.revokeObjectURL(u)), [imageUrls]);

  // 칸 자리(px) — 그림을 그 칸 위치에 얹는다. 시트 밖 칸은 기본 크기로 센다
  const layout = useMemo(() => {
    const s = loaded?.sheet ?? null;
    const colW = (c: number) => (s ? (s.cols[c] !== undefined ? (s.colWidths[s.cols[c]] ?? DEFAULT_COL_WIDTH) : DEFAULT_COL_WIDTH) : EXCEL_COL_PX);
    const rowH = (r: number) => (s ? (r < s.rows.length ? (s.rowHeights[String(r)] ?? DEFAULT_ROW_HEIGHT) : DEFAULT_ROW_HEIGHT) : EXCEL_ROW_PX);
    const x = (c: number) => Array.from({ length: c }, (_, i) => colW(i)).reduce((n, w) => n + w, 0);
    const y = (r: number) => Array.from({ length: r }, (_, i) => rowH(i)).reduce((n, h) => n + h, 0);
    // 엑셀이 적어 둔 자리(x·y)가 있으면 그것 — 칸 번호로 세면 열 너비를 몰라(빈 시트) 그림이 겹쳤다
    const pics = (loaded?.images ?? []).map((img) => ({ left: img.x ?? x(img.col), top: img.y ?? y(img.row), width: img.width, height: img.height }));
    const tableW = s ? s.cols.reduce((n, c) => n + (s.colWidths[c] ?? DEFAULT_COL_WIDTH), 0) : 0;
    const width = Math.max(tableW, ...pics.map((p) => p.left + p.width), 0);
    const height = Math.max(s ? y(s.rows.length) : 0, ...pics.map((p) => p.top + p.height), 0);
    return { pics, width, height };
  }, [loaded]);

  // 처음(시트를 바꿀 때도)엔 화면 폭에 맞춘다
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !layout.width) return;
    setZoom(Math.min(1, Math.max(0.2, +((box.clientWidth - 16) / layout.width).toFixed(2))));
  }, [layout.width]);

  const empty = loaded && !loaded.sheet && loaded.images.length === 0;
  return (
    <ViewerShell
      file={file}
      onClose={onClose}
      zoom={zoom}
      setZoom={setZoom}
      min={0.2}
      max={3}
      step={0.25}
      canShare={false}
      footer={
        names.length > 1 && (
          <div className="flex shrink-0 gap-1 overflow-x-auto bg-[#222] px-2 py-1.5" style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
            {names.map((n, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSheetIdx(i)}
                className={`shrink-0 rounded-md px-3 py-1 text-[12px] font-semibold ${i === sheetIdx ? 'bg-white text-[#222]' : 'bg-white/10 text-white/80'}`}
              >
                {n || `시트${i + 1}`}
              </button>
            ))}
          </div>
        )
      }
    >
      <div
        ref={boxRef}
        {...pinch}
        onTouchCancel={pinch.onTouchEnd}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-[#f0f0f0] p-2"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {error ? (
          <div className="bg-[#3a3a3a]">
            <ViewerError file={file} message={error} />
          </div>
        ) : !loaded ? (
          <div className="py-16 text-center text-[13px] text-[#666]">엑셀을 여는 중…</div>
        ) : empty ? (
          <div className="py-16 text-center text-[13px] text-[#666]">이 시트에는 보일 내용이 없습니다(도형·차트는 앱에서 보이지 않습니다).</div>
        ) : (
          <>
            {loaded.cut && <div className="mb-2 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-800">{loaded.cut} 전체는 [저장]해서 엑셀에서 보세요.</div>}
            <div ref={contentRef} className="relative bg-white" style={{ zoom, width: layout.width, height: layout.height }}>
              {loaded.sheet && <SheetView sheet={loaded.sheet} />}
              {layout.pics.map((p, i) => (
                <img key={i} src={imageUrls[i]} alt="" className="absolute max-w-none" style={{ left: p.left, top: p.top, width: p.width || undefined, height: p.height || undefined }} />
              ))}
            </div>
          </>
        )}
      </div>
    </ViewerShell>
  );
}
