/**
 * 시트 보기 — 머리글·격자선 없이 문서 모양 그대로 (결재 문서 열람·인쇄용)
 * - 테두리는 셀 서식에 지정된 것만 그린다(엑셀 인쇄와 같음)
 * - fitWidth 를 주면 그 폭에 맞게 비율로 줄인다(넘칠 때만, A4 인쇄 등)
 */
import type { ReactNode } from 'react';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, type Sheet } from './model';
import { cellCss, defaultAlign, displayValue } from './style';

export interface SheetViewProps {
  /** 계산까지 끝난 시트(값이 rows 에 들어 있어야 한다) */
  sheet: Sheet;
  /** 가릴 칸 — true 면 값 대신 hiddenText */
  hidden?: (r: number, c: number) => boolean;
  hiddenText?: string;
  /** 칸 위에 덧그릴 것(예: 직인 그림) */
  renderOverlay?: (r: number, c: number) => ReactNode;
  /** 이 폭(px)보다 넓으면 비율로 줄인다 */
  fitWidth?: number;
  className?: string;
}

export function SheetView({ sheet, hidden, hiddenText = '비공개', renderOverlay, fitWidth, className = '' }: SheetViewProps) {
  const { cols, rows, merges } = sheet;
  const widthOf = (col: string) => sheet.colWidths[col] ?? DEFAULT_COL_WIDTH;
  const total = cols.reduce((sum, col) => sum + widthOf(col), 0);
  const scale = fitWidth && total > fitWidth ? fitWidth / total : 1;
  const mergeAt = (r: number, c: number) =>
    merges.find((m) => r >= m.startRow && r < m.startRow + m.rowSpan && c >= m.startCol && c < m.startCol + m.colSpan);

  return (
    <div className={className} style={scale < 1 ? { width: total * scale, overflow: 'hidden' } : undefined}>
      <table
        className="border-collapse bg-white text-[12px] text-[#222]"
        style={{ tableLayout: 'fixed', width: total, ...(scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'top left' } : {}) }}
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
                const key = `${r}:${col}`;
                const secret = hidden?.(r, c) ?? false;
                return (
                  <td
                    key={col}
                    rowSpan={m && m.rowSpan > 1 ? m.rowSpan : undefined}
                    colSpan={m && m.colSpan > 1 ? m.colSpan : undefined}
                    className="relative overflow-hidden px-1 align-middle whitespace-pre-wrap break-words"
                    style={{ textAlign: defaultAlign(sheet, r, col), ...cellCss(sheet.styles[key]) }}
                  >
                    {secret ? <span className="italic text-[#999]">{hiddenText}</span> : displayValue(sheet, r, col)}
                    {renderOverlay?.(r, c)}
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
