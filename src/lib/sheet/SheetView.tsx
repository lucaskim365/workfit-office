/**
 * 시트 보기 — 머리글·격자선 없이 문서 모양 그대로 (결재 문서 열람·인쇄용)
 * - 테두리는 셀 서식에 지정된 것만 그린다(엑셀 인쇄와 같음)
 * - fitWidth 를 주면 그 폭에 맞게 비율로 줄인다(넘칠 때만, A4 인쇄 등)
 * - 표는 감싼 영역 가운데에 놓는다
 *
 * 칸(td)에 position 을 주지 않는다 — 크롬은 위치 지정된 칸의 배경을 표 테두리(border-collapse) 위에 칠해
 * 배경색 있는 칸 둘레의 테두리가 화면·인쇄에서 군데군데 사라진다. 덧그림(직인 등)은 칸 안 상자에 붙인다
 */
import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, type Merge, type Sheet } from './model';
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
   * 이 폭(px)보다 좁으면 열 너비를 비율대로 늘려 이 폭에 맞춘다(글씨 크기는 그대로) — 문서 머리 표와 양 끝을 맞추기.
   * 원래 폭이 이 폭의 minRatio(기본 0.5)보다 좁은 작은 표는 늘리지 않는다(칸이 지나치게 넓어지지 않게)
   */
  stretchTo?: number;
  stretchMinRatio?: number;
  /** 가는 테두리 색 — 문서 안에서 머리 표 선 색과 맞출 때(굵은 선·배경색은 그대로) */
  thinBorderColor?: string;
  /**
   * 인쇄 때 종이 폭에 맞춘다 — 인쇄되는 문서 상자(이 선택자의 조상)를 기준으로, 그 안에서 표가 차지하는 비율만큼의
   * 인쇄 가능 폭(pageWidthMm)에 맞게 인쇄 직전에 다시 줄인다. 화면 배율(body zoom)이 인쇄에도 남아 있어
   * 화면 기준 fitWidth 로는 종이를 넘기 때문
   */
  printFit?: { rootSelector: string; pageWidthMm: number };
  /** 그리지 않을 줄(예: 결재 끝나기 전의 결재 완료일 줄) — 위아래로 걸친 병합이 없는 줄에만 쓸 것 */
  hiddenRows?: (r: number) => boolean;
  /** 줄 아래에 덧붙일 띠(표 폭 한 칸, 인쇄 안 됨) — 예: 반복 구간 [행 추가] */
  afterRow?: (r: number) => ReactNode;
  /** 줄(tr)에 붙일 클래스 — 예: 마우스를 올린 줄에만 칸 위 단추 보이기(group) */
  rowClassName?: (r: number) => string | undefined;
  /**
   * 표 오른쪽 바깥에 줄마다 덧그릴 것(예: 반복 구간 줄 [+][−]) — 폭 0 칸에서 오른쪽으로 삐져나오게 그려 표 폭은 그대로.
   * 바깥 상자가 오른쪽에 자리를 내줘야 보인다(인쇄 안 됨)
   */
  rowEnd?: (r: number) => ReactNode;
  className?: string;
}

export function SheetView({
  sheet,
  hidden,
  hiddenText = '비공개',
  renderCell,
  renderOverlay,
  cellClassName,
  fitWidth,
  stretchTo,
  stretchMinRatio = 0.5,
  thinBorderColor,
  printFit,
  hiddenRows,
  afterRow,
  rowClassName,
  rowEnd,
  className = '',
}: SheetViewProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const { cols, rows, merges } = sheet;
  const rawWidth = (col: string) => sheet.colWidths[col] ?? DEFAULT_COL_WIDTH;
  const rawTotal = cols.reduce((sum, col) => sum + rawWidth(col), 0);
  // 종이 폭에 맞춰 늘리기 — 열 비율 그대로
  const stretch = stretchTo && rawTotal < stretchTo && rawTotal >= stretchTo * stretchMinRatio ? stretchTo / rawTotal : 1;
  const widthOf = (col: string) => rawWidth(col) * stretch;
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
  /**
   * 숨긴 행이 걸친 병합 — 보이는 행만 센 높이(rowSpan)로, 맨 위 행이 숨었으면 첫 보이는 행에서 그린다(내용·모양은 원래 칸).
   * 그대로 두면 숨은 행을 덮은 칸 때문에 아래 줄 칸이 한 칸씩 밀린다
   */
  const isHiddenRow = (r: number) => hiddenRows?.(r) ?? false;
  const visibleMerge = (m: Merge) => {
    let first = -1;
    let span = 0;
    for (let r = m.startRow; r < m.startRow + m.rowSpan; r++) {
      if (isHiddenRow(r)) continue;
      if (first < 0) first = r;
      span++;
    }
    return { first, span };
  };

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
          {rowEnd && <col style={{ width: 0 }} />}
        </colgroup>
        <tbody>
          {rows.map((_row, r) => hiddenRows?.(r) ? null : (
            <Fragment key={r}>
            <tr className={rowClassName?.(r)} style={{ height: sheet.rowHeights[String(r)] ?? DEFAULT_ROW_HEIGHT, breakInside: 'avoid' }}>
              {cols.map((col, c) => {
                const m = mergeAt(r, c);
                if (m && m.startCol !== c) return null;
                const vm = m ? visibleMerge(m) : null;
                if (vm && vm.first !== r) return null;
                // 병합 칸은 원래 칸(맨 위 행) 기준으로 그린다 — 맨 위 행이 숨어 아래 행에서 그려도 같은 내용·모양
                const rr = m ? m.startRow : r;
                const rowSpan = vm ? vm.span : 1;
                const secret = hidden?.(rr, c) ?? false;
                const content = secret ? <span className="italic text-[#999]">{hiddenText}</span> : (renderCell?.(rr, c) ?? displayValue(sheet, rr, col));
                const overlay = renderOverlay?.(rr, c);
                return (
                  <td
                    key={col}
                    rowSpan={rowSpan > 1 ? rowSpan : undefined}
                    colSpan={m && m.colSpan > 1 ? m.colSpan : undefined}
                    className={`overflow-hidden px-1 align-middle whitespace-pre-wrap break-words ${cellClassName?.(rr, c) ?? ''}`}
                    style={{
                      textAlign: defaultAlign(sheet, rr, col),
                      ...cellCss(renderStyle(sheet, rr, c, m?.rowSpan, m?.colSpan), { thinColor: thinBorderColor }),
                      ...fitted(rr, c, col, m?.colSpan ?? 1),
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
              {rowEnd && (
                <td className="relative w-0 p-0 print:hidden" style={{ border: 'none' }}>
                  {(() => {
                    const node = rowEnd(r);
                    return node ? <div className="absolute left-1 top-1/2 -translate-y-1/2">{node}</div> : null;
                  })()}
                </td>
              )}
            </tr>
            {(() => {
              const band = afterRow?.(r);
              return band ? (
                <tr className="print:hidden">
                  <td colSpan={cols.length} className="p-0">
                    {band}
                  </td>
                </tr>
              ) : null;
            })()}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
