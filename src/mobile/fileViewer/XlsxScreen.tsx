import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_COL_WIDTH, SheetView, importXlsx, type Sheet } from '@/lib/sheet';
import { usePinchZoom, ViewerError, ViewerShell, type ViewerFile } from './viewerShell';

/** 휴대폰에서 그릴 만큼 — 이보다 크면 잘라 내고 안내(앞부분만 보임) */
const MAX_ROWS = 1000;
const MAX_COLS = 100;

/**
 * 엑셀(.xlsx) — 시트 서식과 같은 엑셀 읽기(@/lib/sheet)로 칸·병합·글꼴·테두리·배경을 그린다. 아래 탭으로 시트를 고른다.
 * 처음엔 화면 폭에 맞춰 줄이고, 두 손가락으로 확대·축소. 계산 못 하는 수식은 엑셀이 저장한 값으로 보인다.
 * .xls(옛 형식)는 읽지 못한다 — [저장]해서 다른 앱으로
 */
export default function XlsxScreen({ file, onClose }: { file: ViewerFile; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [result, setResult] = useState<{ sheet: Sheet; names: string[]; cut: string | null } | null>(null);
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
    setResult(null);
    importXlsx(bytes, { sheet: sheetIdx, maxRows: MAX_ROWS, maxCols: MAX_COLS, ignorePrintArea: true })
      .then((r) => {
        if (cancelled) return;
        // 잘라 낸 경우만 알린다(못 가져온 서식 등은 보기엔 상관없음)
        const cut = r.warnings.find((w) => w.includes('까지만 가져왔습니다')) ?? null;
        setResult({ sheet: r.sheet, names: r.sheetNames, cut });
      })
      .catch((e) => {
        console.warn('[xlsx] 열기 실패', e);
        if (!cancelled) setError(/\.xls$/i.test(file.name) ? '예전 엑셀 형식(.xls)은 앱에서 볼 수 없습니다.' : '엑셀 파일을 열지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [bytes, sheetIdx, file.name]);

  // 처음(시트를 바꿀 때도)엔 화면 폭에 맞춘다
  const tableWidth = useMemo(
    () => (result ? result.sheet.cols.reduce((n, c) => n + (result.sheet.colWidths[c] ?? DEFAULT_COL_WIDTH), 0) : 0),
    [result]
  );
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !tableWidth) return;
    setZoom(Math.min(1, Math.max(0.2, +((box.clientWidth - 16) / tableWidth).toFixed(2))));
  }, [tableWidth]);

  const names = result?.names ?? [];
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
        className="relative min-h-0 flex-1 overflow-auto bg-[#f0f0f0] p-2"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {error ? (
          <div className="bg-[#3a3a3a]">
            <ViewerError file={file} message={error} />
          </div>
        ) : !result ? (
          <div className="py-16 text-center text-[13px] text-[#666]">엑셀을 여는 중…</div>
        ) : (
          <>
            {result.cut && <div className="mb-2 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-800">{result.cut} 전체는 [저장]해서 엑셀에서 보세요.</div>}
            <div ref={contentRef} className="w-fit bg-white" style={{ zoom }}>
              <SheetView sheet={result.sheet} />
            </div>
          </>
        )}
      </div>
    </ViewerShell>
  );
}
