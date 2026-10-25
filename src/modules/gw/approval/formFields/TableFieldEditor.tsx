import { useState, useMemo, type ReactNode } from 'react';
import type { FormField, FieldValue } from '@/domain/approvalForm/schema';
import { getCellMergeInfo } from './utils';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { TableCellTextarea } from './TableCellTextarea';
import { SheetEditor } from './SheetEditor';
import { CellSealSlot } from '../components/CompanySeal';
import {
  normalizeTablePayload,
  recalculateSheet,
  serializeSheet,
  sheetSignature,
  type SheetPayload,
} from './sheetModel';
import { deleteRow, insertRow } from './sheetOps';
import { cellCss, defaultAlign, displayCellValue } from './sheetStyle';

interface TableFieldEditorProps {
  field: FormField;
  v: FieldValue;
  set: (patch: Record<string, FieldValue>) => void;
  isDesignMode?: boolean;
  isHalf?: boolean;
  allFormValues?: Record<string, FieldValue>;
  formFields?: FormField[];
}

const DEFAULT_COLS = ['구분', '항목', '내용'];
// 예전 표의 숫자 열 판단(열 키 이름) — 입력 후 콤마 표시용
const LEGACY_NUM_COL = /수량|단가|가격|금액|비용|비중|수|율/;

/** 표 필드 값(문서 값 → 서식 기본값 → 빈 3행) 을 시트로 */
export function sheetOfField(field: FormField, value: FieldValue | undefined): SheetPayload {
  const fallbackCols = field.options && field.options.length > 0 ? field.options : DEFAULT_COLS;
  if (typeof value === 'string' && value) return normalizeTablePayload(value, fallbackCols);
  if (field.placeholder) return normalizeTablePayload(field.placeholder, fallbackCols);
  const empty = Object.fromEntries(fallbackCols.map((c) => [c, '']));
  return normalizeTablePayload({ cols: fallbackCols, rows: [empty, { ...empty }, { ...empty }] }, fallbackCols);
}

/** 직인 칸이면 칸 내용 오른쪽에 직인 자리를 붙인다 */
function withSeal(seal: boolean | undefined, stamped: boolean, content: ReactNode): ReactNode {
  return seal ? <CellSealSlot stamped={stamped}>{content}</CellSealSlot> : content;
}

export function TableFieldEditor({
  field,
  v,
  set,
  isDesignMode = false,
  isHalf = false,
  allFormValues,
  formFields,
}: TableFieldEditorProps) {
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);

  const sheet = useMemo(() => sheetOfField(field, v), [field, v]);

  // 같은 문서의 다른 표 (표 간 참조용)
  const { otherSheets, labels } = useMemo(() => {
    const otherSheets: Record<string, SheetPayload> = {};
    const labels: Record<string, string> = { [field.key]: field.label || field.key };
    (formFields ?? [])
      .filter((f) => f.type === '표' && f.key !== field.key)
      .forEach((f) => {
        otherSheets[f.key] = sheetOfField(f, allFormValues?.[f.key]);
        labels[f.key] = f.label || f.key;
      });
    return { otherSheets, labels };
  }, [formFields, allFormValues, field.key, field.label]);

  const othersByName = useMemo(() => {
    const ctx: Record<string, SheetPayload> = {};
    Object.entries(otherSheets).forEach(([key, s]) => {
      ctx[key] = s;
      ctx[labels[key]] = s;
    });
    return ctx;
  }, [otherSheets, labels]);

  // 실시간 수식 및 타 표 참조가 반영된 시트
  const effective = useMemo(() => recalculateSheet(sheet, othersByName), [sheet, othersByName]);
  const { cols, rows, merges, colWidths } = effective;

  /** 저장 — 기안 문서는 처음 저장할 때 서식 구조 기준값(baseSig)을 남김 */
  const toValue = (next: SheetPayload): string => {
    const withSig =
      !isDesignMode && !next.baseSig && field.placeholder
        ? { ...next, baseSig: sheetSignature(normalizeTablePayload(field.placeholder, field.options)) }
        : next;
    return serializeSheet(recalculateSheet(withSig, othersByName));
  };

  const save = (next: SheetPayload) => set({ [field.key]: toValue(next) });

  // 50% 절반 너비 표일 때 고정 px로 인한 잘림을 원천 차단하고 비율(%)로 자동 변환
  const isHalfTable = isHalf || field.width === 'half';
  const getColWidth = (col: string, cIdx: number) => {
    if (isHalfTable) {
      const raw = colWidths[col];
      if (raw && raw.endsWith('%')) return raw;

      const pxVals = cols.map((c) => {
        const w = colWidths[c];
        if (!w) return 100;
        const num = parseFloat(w);
        return isNaN(num) || num <= 0 ? 100 : num;
      });
      const totalPx = pxVals.reduce((acc, n) => acc + n, 0);
      if (totalPx > 0) {
        const pct = ((pxVals[cIdx] / totalPx) * 100).toFixed(1);
        return `${pct}%`;
      }
      return `${(100 / cols.length).toFixed(1)}%`;
    }
    return colWidths[col] || 'auto';
  };

  // 셀 값 변경 (인라인 입력은 글자 그대로 — 수식은 표 편집기에서)
  const handleCellChange = (rIdx: number, col: string, val: string) => {
    save({ ...effective, rows: effective.rows.map((r, idx) => (idx === rIdx ? { ...r, [col]: val } : r)) });
  };

  const handleAddRow = () => save(insertRow(effective, effective.rows.length));

  const handleDeleteRow = () => {
    if (effective.rows.length <= 1) return;
    save(deleteRow(effective, effective.rows.length - 1));
  };

  // 표 편집기에서 적용 — 다른 표 참조가 따라 움직였으면 그 표도 함께 저장
  const handleApplyEditor = (next: SheetPayload, othersPatch: Record<string, SheetPayload>) => {
    const patch: Record<string, FieldValue> = { [field.key]: toValue(next) };
    Object.entries(othersPatch).forEach(([key, s]) => {
      patch[key] = serializeSheet(s);
    });
    set(patch);
    setIsDesignerOpen(false);
  };

  const isNumericCell = (rIdx: number, col: string) => {
    const style = effective.cellStyles[`${rIdx}:${col}`];
    if (style?.numFmt === 'currency') return true;
    return !!effective.legacyHeaderRow && rIdx > 0 && LEGACY_NUM_COL.test(col);
  };

  return (
    <div className="w-full relative group">
      {/* 상단 툴바: 표 편집기 열기 버튼 */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink3"></span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDesignerOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-md bg-teal/10 hover:bg-teal text-teal hover:text-white px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer shadow-2xs border border-teal/25"
          title="서식·수식·병합·행열 추가 등 표를 엑셀처럼 편집합니다"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>표 편집</span>
        </button>
      </div>

      {/* 실물 문서와 같은 표 (인라인 내용 입력 가능) */}
      <div className="w-full overflow-x-auto bg-white rounded border border-[#ddd]">
        <table className="w-full table-fixed border-collapse text-left text-[11.5px] border-none">
          <colgroup>
            {cols.map((col, cIdx) => (
              <col key={col} style={{ width: getColWidth(col, cIdx) }} />
            ))}
          </colgroup>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[#fafafa]/80 transition-colors">
                {cols.map((col, cIdx) => {
                  const { isMerged, isStart, rowSpan, colSpan } = getCellMergeInfo(rIdx, cIdx, merges);
                  if (isMerged && !isStart) return null;

                  const cellKey = `${rIdx}:${col}`;
                  const formulaInfo = effective.cellFormulas[cellKey];
                  const isSum = !!(effective.sumCell && effective.sumCell.rIdx === rIdx && effective.sumCell.col === col);
                  const isCalculated = !!formulaInfo || isSum;
                  const style = effective.cellStyles[cellKey];
                  const align = style?.align ?? defaultAlign(effective, rIdx, col);
                  const numeric = isNumericCell(rIdx, col);

                  return (
                    <td
                      key={col}
                      rowSpan={rowSpan > 1 ? rowSpan : undefined}
                      colSpan={colSpan > 1 ? colSpan : undefined}
                      className={`p-0 border border-[#eee] text-[#222] relative ${
                        isCalculated && !style?.bg ? (isDesignMode ? 'bg-teal-soft/15' : 'bg-[#fafafa]') : ''
                      }`}
                      style={cellCss(style)}
                    >
                      {withSeal(style?.seal, isDesignMode, isCalculated ? (
                        <div
                          className="flex items-center justify-between w-full px-2 py-1.5 cursor-default select-none"
                          title={isDesignMode && formulaInfo ? `수식: ${formulaInfo.expression}` : undefined}
                        >
                          <span className="w-full font-medium whitespace-pre-wrap break-words" style={{ textAlign: align }}>
                            {displayCellValue(effective, rIdx, col)}
                          </span>
                          {isDesignMode && formulaInfo && (
                            <span className="ml-1 shrink-0 px-1 rounded bg-teal text-white font-mono text-[8.5px] font-extrabold shadow-2xs select-none">
                              fx
                            </span>
                          )}
                        </div>
                      ) : (
                        <TableCellTextarea
                          value={row[col] ?? ''}
                          onChange={(nextVal) => handleCellChange(rIdx, col, nextVal)}
                          onBlur={(e) => {
                            const raw = e.target.value.replace(/,/g, '').trim();
                            if (numeric && !raw.includes('\n') && raw !== '' && !isNaN(Number(raw))) {
                              handleCellChange(rIdx, col, Number(raw).toLocaleString('ko-KR'));
                            }
                          }}
                          placeholder={numeric ? '0' : ''}
                          className={align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}
                        />
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="py-4 text-center text-[#999] text-[11px]">
                  등록된 데이터가 없습니다. 아래 [행 추가] 버튼을 눌러 행을 추가하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 동적 행 추가 / 행 삭제 버튼 */}
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="text-ink3 font-medium text-[10.5px]">
          {effective.legacyHeaderRow ? rows.length - 1 : rows.length}개 행
        </span>
        <div className="flex items-center gap-1.5">
          {rows.length > 1 && (
            <button
              type="button"
              onClick={handleDeleteRow}
              className="flex items-center gap-1 text-[10.5px] font-semibold text-rose-500 hover:text-rose-700 transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-rose-50"
              title="마지막 행 삭제"
            >
              <Trash2 className="h-3 w-3" />
              <span>행 삭제</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 text-[10.5px] font-bold text-teal hover:text-teal-700 transition-colors cursor-pointer px-2.5 py-0.5 rounded bg-teal-soft/40 hover:bg-teal-soft/70"
          >
            <Plus className="h-3 w-3" />
            <span>행 추가</span>
          </button>
        </div>
      </div>

      <SheetEditor
        isOpen={isDesignerOpen}
        onClose={() => setIsDesignerOpen(false)}
        title={field.label || '표 편집'}
        initial={effective}
        others={otherSheets}
        labels={labels}
        selfKey={field.key}
        isDesignMode={isDesignMode}
        onApply={handleApplyEditor}
      />
    </div>
  );
}
