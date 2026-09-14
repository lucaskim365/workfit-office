import { useState, useMemo } from 'react';
import type { FormField, FieldValue } from '@/domain/approvalForm/schema';
import { getCellMergeInfo, type CellMerge } from './utils';
import { TableDesignerModal, type TableDataPayload } from './TableDesignerModal';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { recalculateTableFormulas, type CellFormula } from './formulaEngine';

interface TableFieldEditorProps {
  field: FormField;
  v: FieldValue;
  set: (patch: Record<string, FieldValue>) => void;
  isDesignMode?: boolean;
  isHalf?: boolean;
}

export function TableFieldEditor({
  field,
  v,
  set,
  isDesignMode = false,
  isHalf = false,
}: TableFieldEditorProps) {
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);

  // 기본 열/행 정의
  const defaultCols =
    field.options && field.options.length > 0 ? field.options : ['구분', '항목', '내용'];
  const defaultRows: Array<Record<string, string>> = [
    defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {}),
    defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {}),
    defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {}),
  ];

  // 데이터 파싱
  const parsedData = useMemo<TableDataPayload>(() => {
    try {
      if (v && typeof v === 'string') {
        const p = JSON.parse(v);
        const cells: Array<{ rIdx: number; col: string }> = p.amountCells
          ? p.amountCells
          : p.amountCell
          ? [p.amountCell]
          : [];
        return {
          cols: Array.isArray(p.cols) && p.cols.length > 0 ? p.cols : defaultCols,
          rows: (Array.isArray(p.rows) && p.rows.length > 0
            ? p.rows
            : Array.isArray(p.defaultRows) && p.defaultRows.length > 0
            ? p.defaultRows
            : Array.isArray(p.rows)
            ? p.rows
            : Array.isArray(p.defaultRows)
            ? p.defaultRows
            : defaultRows) as Array<Record<string, string>>,
          tableWidth: (p.tableWidth || '100%') as string,
          colWidths: (p.colWidths || {}) as Record<string, string>,
          merges: (p.merges ?? []) as CellMerge[],
          headerValues: (p.headerValues ?? {}) as Record<string, string>,
          amountCells: cells,
          sumCell: p.sumCell as { rIdx: number; col: string } | null,
          secretCols: Array.isArray(p.secretCols) ? (p.secretCols as string[]) : [],
          secretCells: Array.isArray(p.secretCells) ? (p.secretCells as string[]) : [],
          secretRows: Array.isArray(p.secretRows) ? (p.secretRows as number[]) : [],
          cellFormulas: (p.cellFormulas ?? {}) as Record<string, CellFormula>,
        };
      } else if (field.placeholder) {
        const p = JSON.parse(field.placeholder);
        const cells = p.amountCells
          ? (p.amountCells as Array<{ rIdx: number; col: string }>)
          : p.amountCell
          ? [p.amountCell as { rIdx: number; col: string }]
          : [];
        return {
          cols: (p.cols ?? p.options ?? defaultCols) as string[],
          rows: (p.rows ?? p.defaultRows ?? defaultRows) as Array<Record<string, string>>,
          tableWidth: (p.tableWidth ?? '100%') as string,
          colWidths: (p.colWidths ?? {}) as Record<string, string>,
          merges: (p.merges ?? []) as CellMerge[],
          headerValues: (p.headerValues ?? {}) as Record<string, string>,
          amountCells: cells,
          sumCell: p.sumCell as { rIdx: number; col: string } | null,
          secretCols: Array.isArray(p.secretCols) ? (p.secretCols as string[]) : [],
          secretCells: Array.isArray(p.secretCells) ? (p.secretCells as string[]) : [],
          secretRows: Array.isArray(p.secretRows) ? (p.secretRows as number[]) : [],
          cellFormulas: (p.cellFormulas ?? {}) as Record<string, CellFormula>,
        };
      }
    } catch (e) {}

    return {
      cols: defaultCols,
      rows: defaultRows,
      tableWidth: '100%',
      colWidths: {},
      merges: [],
      headerValues: {},
      amountCells: [],
      sumCell: null,
      secretCols: [],
      secretCells: [],
      secretRows: [],
      cellFormulas: {},
    };
  }, [v, field.placeholder, field.options]);

  const {
    cols,
    rows,
    colWidths,
    merges,
    headerValues,
    amountCells,
    sumCell,
    cellFormulas,
  } = parsedData;

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

  // 병합 정보
  const getMergeInfo = (rIdx: number, cIdx: number) => getCellMergeInfo(rIdx, cIdx, merges);

  // 셀 값 변경 (기안 모드)
  const handleCellChange = (rIdx: number, col: string, val: string) => {
    const nextRows = rows.map((r, idx) => (idx === rIdx ? { ...r, [col]: val } : r));

    // 실시간 수식 및 합계 재계산
    let recalculated = recalculateTableFormulas(cols, nextRows, cellFormulas, headerValues);
    if (sumCell) {
      let sum = 0;
      recalculated.forEach((r, idx) => {
        cols.forEach((c) => {
          if (sumCell.rIdx === idx && sumCell.col === c) return;
          if (c.includes('금액') || amountCells.some((ac) => ac.rIdx === idx && ac.col === c)) {
            const num = Number(String(r[c] ?? '').replace(/[^0-9]/g, '')) || 0;
            sum += num;
          }
        });
      });
      if (recalculated[sumCell.rIdx]) {
        recalculated[sumCell.rIdx] = {
          ...recalculated[sumCell.rIdx],
          [sumCell.col]: sum > 0 ? String(sum) : '',
        };
      }
    }

    set({
      [field.key]: JSON.stringify({
        ...parsedData,
        rows: recalculated,
        defaultRows: recalculated,
      }),
    });
  };

  // 기안자용 행 추가
  const handleAddRow = () => {
    const emptyRow = cols.reduce(
      (acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }),
      {}
    );
    const nextRows = [...rows, emptyRow];
    let recalculated = recalculateTableFormulas(cols, nextRows, cellFormulas, headerValues);
    if (sumCell) {
      let sum = 0;
      recalculated.forEach((r, idx) => {
        cols.forEach((c) => {
          if (sumCell.rIdx === idx && sumCell.col === c) return;
          if (c.includes('금액') || amountCells.some((ac) => ac.rIdx === idx && ac.col === c)) {
            const num = Number(String(r[c] ?? '').replace(/[^0-9]/g, '')) || 0;
            sum += num;
          }
        });
      });
      if (recalculated[sumCell.rIdx]) {
        recalculated[sumCell.rIdx] = {
          ...recalculated[sumCell.rIdx],
          [sumCell.col]: sum > 0 ? String(sum) : '',
        };
      }
    }
    set({
      [field.key]: JSON.stringify({
        ...parsedData,
        rows: recalculated,
        defaultRows: recalculated,
      }),
    });
  };

  // 행 삭제
  const handleDeleteRow = () => {
    if (rows.length <= 1) return;
    const nextRows = rows.slice(0, rows.length - 1);
    let recalculated = recalculateTableFormulas(cols, nextRows, cellFormulas, headerValues);
    if (sumCell) {
      let sum = 0;
      recalculated.forEach((r, idx) => {
        cols.forEach((c) => {
          if (sumCell.rIdx === idx && sumCell.col === c) return;
          if (c.includes('금액') || amountCells.some((ac) => ac.rIdx === idx && ac.col === c)) {
            const num = Number(String(r[c] ?? '').replace(/[^0-9]/g, '')) || 0;
            sum += num;
          }
        });
      });
      if (recalculated[sumCell.rIdx]) {
        recalculated[sumCell.rIdx] = {
          ...recalculated[sumCell.rIdx],
          [sumCell.col]: sum > 0 ? String(sum) : '',
        };
      }
    }
    set({
      [field.key]: JSON.stringify({
        ...parsedData,
        rows: recalculated,
        defaultRows: recalculated,
      }),
    });
  };

  // 모달에서 구조 및 수식 적용 시
  const handleApplyDesigner = (nextData: TableDataPayload) => {
    set({
      [field.key]: JSON.stringify({
        ...nextData,
        defaultRows: nextData.rows,
      }),
    });
  };

  return (
    <div className="w-full relative group">
      {/* 상단 툴바: 대형 엑셀 표 편집기 열기 버튼 */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink3"></span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDesignerOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-md bg-teal/10 hover:bg-teal text-teal hover:text-white px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer shadow-2xs border border-teal/25"
          title="행·열 추가/삭제, 수식(fx) 설정, 병합 등 표 양식을 수정하는 표 편집기를 엽니다"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>표 편집기 (양식·수식 수정)</span>
        </button>
      </div>

      {/* 실물 문서와 100% 동일한 공문서 표 렌더러 (인라인 내용 입력 가능) */}
      <div className="w-full overflow-x-auto bg-white rounded border border-[#ddd]">
        <table className="w-full table-fixed border-collapse text-left text-[11.5px] border-none">
          <colgroup>
            {cols.map((col, cIdx) => (
              <col key={cIdx} style={{ width: getColWidth(col, cIdx) }} />
            ))}
          </colgroup>
          <tbody>
            {/* 정갈한 헤더 행 (더블클릭 시 표 편집기 열기 지원) */}
            <tr
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsDesignerOpen(true);
              }}
              className="border-b border-[#bbb] bg-[#f9f9f9]"
              title="더블클릭 시 표 편집기(양식·수식)를 엽니다"
            >
              {cols.map((col, cIdx) => {
                const { isMerged, isStart, rowSpan, colSpan } = getMergeInfo(-1, cIdx);
                if (isMerged && !isStart) return null;
                const headerTitle = headerValues[col] !== undefined ? headerValues[col] : col;
                return (
                  <th
                    key={col}
                    rowSpan={rowSpan > 1 ? rowSpan : undefined}
                    colSpan={colSpan > 1 ? colSpan : undefined}
                    className="p-2 border border-[#eee] font-bold text-[#444] text-center select-none"
                  >
                    {headerTitle}
                  </th>
                );
              })}
            </tr>

            {/* 데이터 행 리스트 (직접 입력 가능 및 수식 자동 계산) */}
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-[#eee] hover:bg-[#fafafa]/80 transition-colors">
                {cols.map((col, cIdx) => {
                  const { isMerged, isStart, rowSpan, colSpan } = getMergeInfo(rIdx, cIdx);
                  if (isMerged && !isStart) return null;

                  const cellKey = `${rIdx}:${col}`;
                  const formulaInfo = cellFormulas[cellKey];
                  const hasFormula = !!formulaInfo;
                  const isSum = !!(sumCell && sumCell.rIdx === rIdx && sumCell.col === col);
                  const isCalculated = hasFormula || isSum;

                  const cellVal = row[col] ?? '';
                  const isPercent = typeof cellVal === 'string' && cellVal.endsWith('%');
                  const isNumLike =
                    col.includes('수량') ||
                    col.includes('단가') ||
                    col.includes('가격') ||
                    col.includes('금액') ||
                    col.includes('비용') ||
                    col.includes('비중') ||
                    col.includes('수') ||
                    col.includes('율') ||
                    isPercent ||
                    isCalculated;

                  // 디스플레이 포맷팅
                  let displayVal = cellVal;
                  if (isNumLike && !isPercent && !isNaN(Number(String(cellVal).replace(/,/g, ''))) && cellVal !== '') {
                    displayVal = Number(String(cellVal).replace(/,/g, '')).toLocaleString('ko-KR');
                  }

                  return (
                    <td
                      key={col}
                      rowSpan={rowSpan > 1 ? rowSpan : undefined}
                      colSpan={colSpan > 1 ? colSpan : undefined}
                      className={`p-0 border border-[#eee] text-[#222] relative ${
                        isCalculated ? (isDesignMode ? 'bg-teal-soft/15' : 'bg-[#fafafa]') : ''
                      }`}
                    >
                      {isCalculated ? (
                        <div
                          className={`flex items-center justify-between w-full px-2 py-1.5 ${
                            !isDesignMode ? 'cursor-default select-none' : ''
                          }`}
                          title={isDesignMode ? `수식으로 자동 계산됨 (${formulaInfo?.expression || '합산'})` : undefined}
                        >
                          <span
                            className={`w-full font-medium ${
                              isDesignMode ? 'text-teal font-bold font-mono' : 'text-[#111] dark:text-ink'
                            } ${isNumLike ? 'text-right' : 'text-left'}`}
                          >
                            {displayVal || (isNumLike ? '0' : '—')}
                          </span>
                          {isDesignMode && hasFormula && (
                            <span
                              className="ml-1 shrink-0 px-1 py-0.2 rounded bg-teal text-white font-mono text-[8.5px] font-extrabold shadow-2xs select-none"
                              title={`수식: ${formulaInfo.expression}`}
                            >
                              fx
                            </span>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={cellVal}
                          onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => {
                            const raw = e.target.value.replace(/,/g, '').trim();
                            if (isNumLike && !isPercent && raw !== '' && !isNaN(Number(raw))) {
                              handleCellChange(rIdx, col, Number(raw).toLocaleString('ko-KR'));
                            }
                          }}
                          placeholder={isNumLike ? '0' : ''}
                          className={`w-full bg-transparent px-2 py-1.5 text-[11.5px] text-ink outline-none transition-colors hover:bg-teal-soft/10 focus:bg-white focus:ring-1 focus:ring-teal/70 rounded-none ${
                            isNumLike ? 'text-right' : 'text-left'
                          }`}
                        />
                      )}
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
        <span className="text-ink3 font-medium text-[10.5px]">{rows.length}개 행</span>
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

      {/* 대형 엑셀 전용 모달 편집기 */}
      <TableDesignerModal
        isOpen={isDesignerOpen}
        onClose={() => setIsDesignerOpen(false)}
        field={field}
        initialData={parsedData}
        onApply={handleApplyDesigner}
        isDesignMode={isDesignMode}
      />
    </div>
  );
}
