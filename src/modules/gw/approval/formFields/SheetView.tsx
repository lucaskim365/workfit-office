import { getCellMergeInfo } from './utils';
import { normalizeTablePayload, type SheetPayload } from './sheetModel';
import { CellSealText } from '../components/CompanySeal';
import { cellCss, defaultAlign, displayCellValue, isLegacyHeaderCell, isSecretCell } from './sheetStyle';

/**
 * 문서 보기용 시트 — 서식 마스터(placeholder)와 문서 값으로 보여 줄 시트를 정함
 * 비공개 표시는 문서 값의 것(기안자 행·열 변경을 따라 이동됨)에 서식의 비공개 열을 더함
 */
export function resolveViewSheet(placeholder: string | undefined, docValue: unknown, fallbackCols?: string[]): SheetPayload {
  const master = normalizeTablePayload(placeholder, fallbackCols);
  if (typeof docValue !== 'string' || !docValue) return master;
  let parsed: any = null;
  try {
    parsed = JSON.parse(docValue);
  } catch {
    return master;
  }
  if (!parsed || !Array.isArray(parsed.rows)) return master;
  const doc = normalizeTablePayload(parsed, master.cols);
  return {
    ...doc,
    cellStyles: inheritSealCells(master, doc),
    secretCols: Array.from(new Set([...doc.secretCols, ...master.secretCols])),
  };
}

/**
 * 직인 칸 지정 전에 기안한 문서 — 서식의 직인 칸을 보기에서만 이어 붙임 (DB 값은 그대로)
 * 서식 직인 칸과 글자가 같은 칸을 찾고, 없으면 같은 자리 칸에 찍음
 */
function inheritSealCells(master: SheetPayload, doc: SheetPayload): SheetPayload['cellStyles'] {
  const hasSeal = (s: SheetPayload) => Object.values(s.cellStyles).some((st) => st?.seal);
  if (hasSeal(doc) || !hasSeal(master)) return doc.cellStyles;

  const text = (s: SheetPayload, key: string) => {
    const [r, col] = key.split(':');
    return String(s.rows[Number(r)]?.[col] ?? '').trim();
  };
  const next = { ...doc.cellStyles };
  for (const [key, st] of Object.entries(master.cellStyles)) {
    if (!st?.seal) continue;
    const col = key.slice(key.indexOf(':') + 1);
    const want = text(master, key);
    let target: string | null = null;
    if (want) {
      const r = doc.rows.findIndex((row) => String(row[col] ?? '').trim() === want);
      if (r >= 0) target = `${r}:${col}`;
    }
    if (!target && doc.cols.includes(col) && Number(key.split(':')[0]) < doc.rows.length) target = key;
    if (target) next[target] = { ...next[target], seal: true };
  }
  return next;
}

interface SheetViewProps {
  sheet: SheetPayload;
  /** 필드 전체가 비공개 */
  allSecret?: boolean;
  isMaskingActive: boolean;
  maskValue: (rawVal: string, isSecret?: boolean) => string;
  minWidth?: string;
  /** 'print' = 흰 바탕 고정 문서(PC 보기·인쇄), 'theme' = 앱 테마 색(모바일) */
  tone?: 'print' | 'theme';
  /** 결재 완료 — 직인 칸에 회사 직인을 찍음 */
  sealStamped?: boolean;
}

/** 읽기 전용 표 — 저장된 값을 그대로 보여 줌(재계산 안 함), 행·열 머리글 없음 */
export function SheetView({ sheet, allSecret, isMaskingActive, maskValue, minWidth = '500px', tone = 'print', sealStamped = false }: SheetViewProps) {
  const { cols, rows, merges, colWidths, cellStyles } = sheet;
  const baseCell =
    tone === 'print'
      ? 'p-2 border border-[#ddd] text-[#222] whitespace-pre-wrap break-words leading-relaxed'
      : 'p-1.5 border border-black/10 text-ink whitespace-pre-wrap break-words';

  return (
    <table className="table-fixed border-collapse text-left text-[11.5px]" style={{ width: '100%', minWidth }}>
      <colgroup>
        {cols.map((col) => (
          <col key={col} style={{ width: colWidths[col] || 'auto' }} />
        ))}
      </colgroup>
      <tbody>
        {rows.map((_row, rIdx) => (
          <tr key={rIdx}>
            {cols.map((col, cIdx) => {
              const { isMerged, isStart, rowSpan, colSpan } = getCellMergeInfo(rIdx, cIdx, merges);
              if (isMerged && !isStart) return null;
              const secret = isLegacyHeaderCell(sheet, rIdx) ? false : !!allSecret || isSecretCell(sheet, rIdx, col);
              const blurred = secret && isMaskingActive;
              let text = displayCellValue(sheet, rIdx, col);
              if (blurred) text = maskValue(text, true);
              const style = cellStyles[`${rIdx}:${col}`];
              return (
                <td
                  key={col}
                  rowSpan={rowSpan > 1 ? rowSpan : undefined}
                  colSpan={colSpan > 1 ? colSpan : undefined}
                  title={blurred ? '보안 필드입니다. 열람 권한이 없습니다.' : undefined}
                  className={`${baseCell} ${blurred ? 'blur-sm select-none opacity-70 cursor-help' : ''}`}
                  style={{ textAlign: defaultAlign(sheet, rIdx, col), ...cellCss(style) }}
                >
                  {style?.seal ? <CellSealText text={text} stamped={sealStamped} /> : text}
                </td>
              );
            })}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={cols.length} className="py-4 text-center text-[#999] text-[11px]">
              등록된 데이터가 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
