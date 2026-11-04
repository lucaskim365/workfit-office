/**
 * 시트 보기 — 머리글·격자선 없이 문서 모양 그대로 (결재 문서 열람·인쇄용)
 * - 테두리는 셀 서식에 지정된 것만 그린다(엑셀 인쇄와 같음)
 * - fitWidth 를 주면 그 폭에 맞게 비율로 줄인다(넘칠 때만, A4 인쇄 등)
 * - 표는 감싼 영역 가운데에 놓는다
 *
 * 칸(td)에 position 을 주지 않는다 — 크롬은 위치 지정된 칸의 배경을 표 테두리(border-collapse) 위에 칠해
 * 배경색 있는 칸 둘레의 테두리가 화면·인쇄에서 군데군데 사라진다. 덧그림(직인 등)은 칸 안 상자에 붙인다
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, type Sheet } from './model';
import { cellCss, defaultAlign, displayValue, renderStyle, shrinkFontSize } from './style';

export interface SheetViewProps {
  /** 계산까지 끝난 시트(값이 rows 에 들어 있어야 한다) */
  sheet: Sheet;
  /** 가릴 칸 — true 면 값 대신 hiddenText */
  hidden?: (r: number, c: number) => boolean;
  hiddenText?: string;
  /** 칸 내용을 바꿔 그림(예: 작성 화면의 입력 상자). undefined 를 돌려주면 보통처럼 값 */
  renderCell?: (r: number, c: number) => ReactNode | undefined;
  /** 칸 위에 덧그릴 것(예: 직인 그림) — 칸 안 상자 기준으로 놓인다 */
  renderOverlay?: (r: number, c: number) => ReactNode;
  /** 칸에 붙일 클래스(예: 반복 구간 표시 — 위치 지정 없이 그림자 등으로) */
  cellClassName?: (r: number, c: number) => string | undefined;
  /** 이 폭(px)보다 넓으면 비율로 줄인다 */
  fitWidth?: number;
  /**
   * 인쇄 때 종이 폭에 맞춘다 — 인쇄되는 문서 상자(이 선택자의 조상)를 기준으로, 그 안에서 표가 차지하는 비율만큼의
   * 인쇄 가능 폭(pageWidthMm)에 맞게 인쇄 직전에 다시 줄인다. 화면 배율(body zoom)이 인쇄에도 남아 있어
   * 화면 기준 fitWidth 로는 종이를 넘기 때문
   */
  printFit?: { rootSelector: string; pageWidthMm: number };
  className?: string;
}

export function SheetView({ sheet, hidden, hiddenText = '비공개', renderCell, renderOverlay, cellClassName, fitWidth, printFit, className = '' }: SheetViewProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const { cols, rows, merges } = sheet;
  const widthOf = (col: string) => sheet.colWidths[col] ?? DEFAULT_COL_WIDTH;
  /** 셀에 맞춤 — 칸(병합 폭)보다 긴 한 줄 글은 글씨를 줄인다 */
  const fitted = (r: number, c: number, col: string, span: number) => {
    const w = cols.slice(c, c + span).reduce((sum, k) => sum + widthOf(k), 0);
    const size = shrinkFontSize(displayValue(sheet, r, col), sheet.styles[`${r}:${col}`], w);
    return size ? { fontSize: size, whiteSpace: 'nowrap' as const } : {};
  };
  const total = cols.reduce((sum, col) => sum + widthOf(col), 0);
  const scale = fitWidth && total > fitWidth ? fitWidth / total : 1;

  useEffect(() => {
    if (!printFit) return;
    let saved: string | null = null;
    const before = () => {
      const table = tableRef.current;
      const box = table?.parentElement?.parentElement;
      const root = table?.closest(printFit.rootSelector) as HTMLElement | null;
      if (!table || !box || !root || !root.clientWidth) return;
      // 화면에서 문서 상자 안 표 자리의 비율 × 종이 인쇄 폭(화면 배율로 나눠 CSS 단위로)
      const bodyZoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
      const pagePx = (printFit.pageWidthMm / 25.4) * 96 / bodyZoom;
      const available = pagePx * (box.clientWidth / root.clientWidth);
      saved = table.style.zoom;
      table.style.zoom = String(Math.min(1, available / total));
    };
    const after = () => {
      if (saved !== null && tableRef.current) tableRef.current.style.zoom = saved;
      saved = null;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [printFit, total]);

  const mergeAt = (r: number, c: number) =>
    merges.find((m) => r >= m.startRow && r < m.startRow + m.rowSpan && c >= m.startCol && c < m.startCol + m.colSpan);

  return (
    <div className={`mx-auto w-fit ${className}`}>
      <table
        ref={tableRef}
        // 배경색도 인쇄되게(브라우저 기본은 인쇄 때 배경을 뺀다)
        className="border-collapse bg-white text-[12px] text-[#222] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]"
        // 줄일 때는 zoom — transform 과 달리 줄어든 크기만큼 자리도 줄어 아래에 빈 공간이 남지 않는다
        style={{ tableLayout: 'fixed', width: total, ...(scale < 1 ? { zoom: scale } : {}) }}
      >
        <colgroup>
          {cols.map((col) => (
            <col key={col} style={{ width: widthOf(col) }} />
          ))}
        </colgroup>
        <tbody>
          {rows.map((_row, r) => (
            <tr key={r} style={{ height: sheet.rowHeights[String(r)] ?? DEFAULT_ROW_HEIGHT, breakInside: 'avoid' }}>
              {cols.map((col, c) => {
                const m = mergeAt(r, c);
                if (m && (m.startRow !== r || m.startCol !== c)) return null;
                const secret = hidden?.(r, c) ?? false;
                const content = secret ? <span className="italic text-[#999]">{hiddenText}</span> : (renderCell?.(r, c) ?? displayValue(sheet, r, col));
                const overlay = renderOverlay?.(r, c);
                return (
                  <td
                    key={col}
                    rowSpan={m && m.rowSpan > 1 ? m.rowSpan : undefined}
                    colSpan={m && m.colSpan > 1 ? m.colSpan : undefined}
                    className={`overflow-hidden px-1 align-middle whitespace-pre-wrap break-words ${cellClassName?.(r, c) ?? ''}`}
                    style={{
                      textAlign: defaultAlign(sheet, r, col),
                      ...cellCss(renderStyle(sheet, r, c, m?.rowSpan, m?.colSpan)),
                      ...fitted(r, c, col, m?.colSpan ?? 1),
                    }}
                  >
                    {overlay ? (
                      // span — 앱 인쇄 CSS 가 div 의 position 을 static 으로 바꾸므로(index.css @media print) 덧그림 기준 상자는 span 으로
                      <span className="relative block">
                        {content}
                        {overlay}
                      </span>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
