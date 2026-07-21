import { useState, useRef, useEffect } from 'react';
import type { FormField, FieldValue } from '@/domain/approvalForm/schema';
import type { User } from '@/domain/user/schema';
import type { Department } from '@/domain/department/schema';

/**
 * 결재서식 동적 필드 위젯 — 상신 모달·서식 미리보기가 공유한다.
 * 기간(period) 필드는 보조 키(`key__end`,`key__days`)로 시작/종료/일수를 분해 저장한다.
 * body(본문)·금액(amount) 예약 필드는 상신 모달이 별도 1급 컬럼으로 바인딩하므로 여기서 제외.
 */

export const END_SUFFIX = '__end';
export const DAYS_SUFFIX = '__days';

/** 날짜 차이(일). endDate 포함. 유효하지 않으면 0. */
export function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export interface CellMerge {
  startRow: number;
  startCol: number;
  rowSpan: number;
  colSpan: number;
}

export function getCellMergeInfo(rIdx: number, cIdx: number, merges: CellMerge[]) {
  const mergeInfo = (merges || []).find((m) => {
    const rMatch = rIdx >= m.startRow && rIdx < m.startRow + m.rowSpan;
    const cMatch = cIdx >= m.startCol && cIdx < m.startCol + m.colSpan;
    return rMatch && cMatch;
  });

  if (!mergeInfo) {
    return { isMerged: false, isStart: false, rowSpan: 1, colSpan: 1 };
  }

  const isStart = mergeInfo.startRow === rIdx && mergeInfo.startCol === cIdx;
  return {
    isMerged: true,
    isStart,
    rowSpan: isStart ? mergeInfo.rowSpan : 0,
    colSpan: isStart ? mergeInfo.colSpan : 0,
    mergeInfo,
  };
}

function EditableHeader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState(value);
  useEffect(() => {
    setVal(value);
  }, [value]);
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== value) {
          onChange(val);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-full rounded border border-border bg-panel-alt px-1.5 py-1 text-[11px] text-ink outline-none focus:border-teal"
    />
  );
}

const inp = 'w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12.5px] text-ink outline-none focus:border-teal';

export interface OrgLite {
  users: User[];
  depts: Department[];
}

function CalendarRangePicker({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState(() => {
    const initial = start ? new Date(start) : new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDateClick = (dateStr: string) => {
    if (!start || (start && end)) {
      onChange(dateStr, '');
    } else {
      if (dateStr < start) {
        onChange(dateStr, '');
      } else {
        onChange(start, dateStr);
        setOpen(false);
      }
    }
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const dateItems: { dateStr: string; day: number; currentMonth: boolean }[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(year, month - 1, prevMonthDays - i);
    const yStr = prevDate.getFullYear();
    const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(prevDate.getDate()).padStart(2, '0');
    dateItems.push({
      dateStr: `${yStr}-${mStr}-${dStr}`,
      day: prevMonthDays - i,
      currentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(i).padStart(2, '0');
    dateItems.push({
      dateStr: `${year}-${mStr}-${dStr}`,
      day: i,
      currentMonth: true,
    });
  }

  const remaining = 42 - dateItems.length;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    const yStr = nextDate.getFullYear();
    const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(nextDate.getDate()).padStart(2, '0');
    dateItems.push({
      dateStr: `${yStr}-${mStr}-${dStr}`,
      day: i,
      currentMonth: false,
    });
  }

  const daysLabel = start && end ? daysBetween(start, end) : 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-left text-[12.5px] text-ink outline-none focus:border-teal flex justify-between items-center hover:bg-panel-alt/80 transition-colors"
      >
        <span>
          {start
            ? `${start} ~ ${end || '종료일 선택'}${daysLabel > 0 ? ` (${daysLabel}일)` : ''}`
            : '기간을 선택하세요'}
        </span>
        <span className="text-ink3 text-xs">📅</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 z-50 w-72 rounded-xl border border-border bg-panel p-3 shadow-xl">
          <div className="flex justify-between items-center mb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 text-ink2 hover:bg-panel-alt rounded-lg text-[13px] font-bold"
            >
              ◀
            </button>
            <span className="text-[12.5px] font-bold text-ink">
              {year}년 {month + 1}월
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 text-ink2 hover:bg-panel-alt rounded-lg text-[13px] font-bold"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[10.5px] font-bold text-ink3 mb-1.5">
            {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[11.5px]">
            {dateItems.map((item, idx) => {
              const { dateStr, day, currentMonth } = item;
              const isStart = start === dateStr;
              const isEnd = end === dateStr;
              const isWithinRange = start && end && dateStr >= start && dateStr <= end;

              let btnClass = 'h-8 w-8 mx-auto grid place-items-center rounded-lg transition-all ';
              if (!currentMonth) {
                btnClass += 'text-ink3/40 ';
              } else {
                btnClass += 'text-ink ';
              }

              if (isStart || isEnd) {
                btnClass += 'bg-teal text-white font-bold ';
              } else if (isWithinRange) {
                btnClass += 'bg-teal-soft/75 text-teal font-medium ';
              } else if (currentMonth) {
                btnClass += 'hover:bg-panel-alt ';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDateClick(dateStr)}
                  className={btnClass}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 단일 동적 필드 입력 위젯. values/set 로 상태를 주고받는다(기간은 다중 키). */
export function DynamicField({
  field, values, set, org,
}: {
  field: FormField;
  values: Record<string, FieldValue>;
  set: (patch: Record<string, FieldValue>) => void;
  org?: OrgLite;
}) {
  const v = values[field.key];
  const sv = typeof v === 'string' ? v : v == null ? '' : String(v);

  const [localColWidths, setLocalColWidths] = useState<Record<string, string>>({});

  useEffect(() => {
    if (field.type === '표') {
      let w: Record<string, string> = {};
      if (field.placeholder) {
        try {
          const cfg = JSON.parse(field.placeholder);
          if (cfg && cfg.colWidths) w = cfg.colWidths;
        } catch (e) {}
      }
      if (typeof v === 'string' && v) {
        try {
          const parsed = JSON.parse(v);
          if (parsed && parsed.colWidths) w = parsed.colWidths;
        } catch (e) {}
      }
      setLocalColWidths(w);
    }
  }, [v, field.placeholder, field.type]);

  switch (field.type) {
    case '안내문':
      return <div className="rounded-lg bg-panel-alt px-3 py-2 text-[11.5px] text-ink3">{field.placeholder || field.label}</div>;

    case '장문':
      return <textarea value={sv} onChange={(e) => set({ [field.key]: e.target.value })} rows={4} placeholder={field.placeholder} className={`${inp} resize-none leading-relaxed`} />;

    case '숫자':
    case '금액':
      return (
        <>
          <input value={sv} onChange={(e) => set({ [field.key]: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder={field.placeholder || (field.type === '금액' ? '예: 3000000' : '')} className={inp} />
          {field.type === '금액' && sv && <span className="mt-1 block text-[11px] text-ink3">₩{Number(sv).toLocaleString()}</span>}
        </>
      );

    case '날짜':
      return <input type="date" value={sv} onChange={(e) => set({ [field.key]: e.target.value })} className={inp} />;

    case '기간': {
      const start = sv;
      const end = (values[field.key + END_SUFFIX] as string) ?? '';
      return (
        <CalendarRangePicker
          start={start}
          end={end}
          onChange={(newStart, newEnd) => {
            const days = newStart && newEnd ? daysBetween(newStart, newEnd) : 0;
            set({
              [field.key]: newStart,
              [field.key + END_SUFFIX]: newEnd,
              [field.key + DAYS_SUFFIX]: days,
            });
          }}
        />
      );
    }

    case '선택':
      return (
        <select value={sv} onChange={(e) => set({ [field.key]: e.target.value })} className={inp}>
          <option value="">선택</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );

    case '다중선택': {
      const picked = new Set(sv ? sv.split(',').filter(Boolean) : []);
      const toggle = (o: string) => {
        picked.has(o) ? picked.delete(o) : picked.add(o);
        set({ [field.key]: [...picked].join(',') });
      };
      return (
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((o) => (
            <button key={o} type="button" onClick={() => toggle(o)} className={`rounded-lg border px-2.5 py-1 text-[11.5px] ${picked.has(o) ? 'border-teal bg-teal-soft text-teal' : 'border-border bg-panel-alt text-ink2'}`}>{o}</button>
          ))}
        </div>
      );
    }

    case '체크':
      return (
        <label className="flex items-center gap-2 text-[12.5px] text-ink">
          <input type="checkbox" checked={v === true} onChange={(e) => set({ [field.key]: e.target.checked })} />
          {field.placeholder || '예'}
        </label>
      );

    case '사용자':
      return (
        <select value={sv} onChange={(e) => set({ [field.key]: e.target.value })} className={inp}>
          <option value="">선택</option>
          {(org?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept}</option>)}
        </select>
      );

    case '부서':
      return (
        <select value={sv} onChange={(e) => set({ [field.key]: e.target.value })} className={inp}>
          <option value="">선택</option>
          {(org?.depts ?? []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      );


    case '표': {
      const defaultCols = field.options && field.options.length > 0 ? field.options : ['구분', '항목', '내용'];
      const defaultRows: Array<Record<string, string>> = [
        defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {}),
        defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {}),
        defaultCols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {})
      ];

      // headerValues: 헤더 행의 셀 표시 텍스트 (컬럼 내부 key와 별개로 저장)
      const { cols, rows, tableWidth, colWidths, merges, headerValues, amountCells, sumCell } = (() => {
        try {
          if (v) {
            const parsedData = JSON.parse(v as string);
            const cells = parsedData.amountCells 
              ? (parsedData.amountCells as Array<{ rIdx: number; col: string }>)
              : (parsedData.amountCell ? [parsedData.amountCell as { rIdx: number; col: string }] : []);
            return {
              cols: (parsedData.cols ?? defaultCols) as string[],
              rows: (parsedData.rows ?? defaultRows) as Array<Record<string, string>>,
              tableWidth: (parsedData.tableWidth ?? '100%') as string,
              colWidths: (parsedData.colWidths ?? {}) as Record<string, string>,
              merges: (parsedData.merges ?? []) as CellMerge[],
              headerValues: (parsedData.headerValues ?? {}) as Record<string, string>,
              amountCells: cells,
              sumCell: parsedData.sumCell as { rIdx: number; col: string } | null,
            };
          } else if (field.placeholder) {
            const parsedData = JSON.parse(field.placeholder);
            const cells = parsedData.amountCells 
              ? (parsedData.amountCells as Array<{ rIdx: number; col: string }>)
              : (parsedData.amountCell ? [parsedData.amountCell as { rIdx: number; col: string }] : []);
            return {
              cols: (parsedData.cols ?? parsedData.options ?? defaultCols) as string[],
              rows: (parsedData.defaultRows ?? defaultRows) as Array<Record<string, string>>,
              tableWidth: (parsedData.tableWidth ?? '100%') as string,
              colWidths: (parsedData.colWidths ?? {}) as Record<string, string>,
              merges: (parsedData.merges ?? []) as CellMerge[],
              headerValues: (parsedData.headerValues ?? {}) as Record<string, string>,
              amountCells: cells,
              sumCell: parsedData.sumCell as { rIdx: number; col: string } | null,
            };
          }
        } catch (e) {}
        return { cols: defaultCols, rows: defaultRows, tableWidth: '100%', colWidths: {} as Record<string, string>, merges: [] as CellMerge[], headerValues: {} as Record<string, string>, amountCells: [] as Array<{ rIdx: number; col: string }>, sumCell: null };
      })();

      const getMergeInfo = (rIdx: number, cIdx: number) => getCellMergeInfo(rIdx, cIdx, merges);

      const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rIdx: number; cIdx: number } | null>(null);
      const [dragRow, setDragRow] = useState<number | null>(null);
      const [dragCol, setDragCol] = useState<number | null>(null);
      const [dragOverRow, setDragOverRow] = useState<number | null>(null);
      const [dragOverCol, setDragOverCol] = useState<number | null>(null);

      useEffect(() => {
        const handleCloseMenu = () => setContextMenu(null);
        window.addEventListener('click', handleCloseMenu);
        return () => window.removeEventListener('click', handleCloseMenu);
      }, []);

      useEffect(() => {
        if (!v && rows.length > 0) {
          set({ [field.key]: JSON.stringify({ cols, rows, tableWidth, colWidths, merges, headerValues, amountCells, sumCell }) });
        }
      }, [v, field.key]);

      const save = (nextCols: string[], nextRows: Array<Record<string, string>>, nextMerges: CellMerge[], nextColWidths = colWidths, nextHeaderValues = headerValues, nextAmountCells = amountCells, nextSumCell = sumCell) =>
        set({ [field.key]: JSON.stringify({ cols: nextCols, rows: nextRows, tableWidth, colWidths: nextColWidths, merges: nextMerges, headerValues: nextHeaderValues, amountCells: nextAmountCells, sumCell: nextSumCell }) });

      const recalculateSum = (
        targetRows: Array<Record<string, string>>, 
        targetAmountCells = amountCells, 
        targetSumCell = sumCell
      ) => {
        if (!targetSumCell) return targetRows;
        const nextRows = [...targetRows];
        let sum = 0;
        nextRows.forEach((row, rowIdx) => {
          cols.forEach((cName) => {
            if (targetSumCell.rIdx === rowIdx && targetSumCell.col === cName) return;
            const isAutoAmt = cName.includes('금액');
            const isManualAmt = targetAmountCells.some((ac) => ac.rIdx === rowIdx && ac.col === cName);
            if (isAutoAmt || isManualAmt) {
              const num = Number(String(row[cName] ?? '').replace(/[^0-9]/g, '')) || 0;
              sum += num;
            }
          });
        });
        if (nextRows[targetSumCell.rIdx]) {
          nextRows[targetSumCell.rIdx] = {
            ...nextRows[targetSumCell.rIdx],
            [targetSumCell.col]: sum > 0 ? String(sum) : ''
          };
        }
        return nextRows;
      };

      const toggleAmountCell = (rIdx: number, col: string) => {
        const exists = amountCells.some((c) => c.rIdx === rIdx && c.col === col);
        const nextCells = exists
          ? amountCells.filter((c) => !(c.rIdx === rIdx && c.col === col))
          : [...amountCells, { rIdx, col }];
        const nextRows = recalculateSum(rows, nextCells, sumCell);
        save(cols, nextRows, merges, colWidths, headerValues, nextCells, sumCell);
      };

      const toggleSumCell = (rIdx: number, col: string) => {
        const isCurrentlySum = sumCell && sumCell.rIdx === rIdx && sumCell.col === col;
        const nextSumCell = isCurrentlySum ? null : { rIdx, col };
        const nextAmountCells = isCurrentlySum
          ? amountCells
          : amountCells.filter((c) => !(c.rIdx === rIdx && c.col === col));
        const nextRows = recalculateSum(rows, nextAmountCells, nextSumCell);
        save(cols, nextRows, merges, colWidths, headerValues, nextAmountCells, nextSumCell);
      };

      const updateCell = (rIdx: number, col: string, val: string) => {
        const nextRows = [...rows];
        nextRows[rIdx] = { ...nextRows[rIdx], [col]: val };
        const nextRowsWithSum = recalculateSum(nextRows, amountCells, sumCell);
        save(cols, nextRowsWithSum, merges);
      };

      const updateHeaderCell = (col: string, val: string) => {
        const nextHeaderValues = { ...headerValues, [col]: val };
        save(cols, rows, merges, colWidths, nextHeaderValues);
      };

      const addRow = () => {
        const newRow = cols.reduce((acc: Record<string, string>, col: string) => ({ ...acc, [col]: '' }), {});
        save(cols, [...rows, newRow], merges);
      };

      const removeRow = (rowIndex: number) => {
        const nextRows = rows.filter((_, idx) => idx !== rowIndex);
        const nextMerges = merges
          .map((m: CellMerge) => {
            if (m.startRow < 0) return m;
            if (m.startRow > rowIndex) return { ...m, startRow: m.startRow - 1 };
            if (m.startRow + m.rowSpan - 1 >= rowIndex) return { ...m, rowSpan: m.rowSpan - 1 };
            return m;
          })
          .filter((m: CellMerge) => m.startRow < 0 || m.rowSpan > 0);
        save(cols, nextRows, nextMerges);
      };

      const addCol = (cIdx: number) => {
        let suffix = cols.length + 1;
        let newColName = `열${suffix}`;
        while (cols.includes(newColName)) { suffix++; newColName = `열${suffix}`; }
        const nextCols = [...cols];
        nextCols.splice(cIdx + 1, 0, newColName);
        const nextRows = rows.map((row) => ({ ...row, [newColName]: '' }));
        const nextMerges = merges.map((m: CellMerge) => {
          if (m.startCol > cIdx) return { ...m, startCol: m.startCol + 1 };
          if (m.startCol + m.colSpan - 1 >= cIdx + 1) return { ...m, colSpan: m.colSpan + 1 };
          return m;
        });
        save(nextCols, nextRows, nextMerges);
      };

      const removeCol = (cIdx: number) => {
        if (cols.length <= 1) return;
        const colName = cols[cIdx];
        const nextCols = cols.filter((_, idx) => idx !== cIdx);
        const nextRows = rows.map((row) => { const r = { ...row }; delete r[colName]; return r; });
        const nextWidths = { ...colWidths }; delete nextWidths[colName];
        const nextHeaderValues = { ...headerValues }; delete nextHeaderValues[colName];
        const nextMerges = merges
          .map((m: CellMerge) => {
            if (m.startCol > cIdx) return { ...m, startCol: m.startCol - 1 };
            if (m.startCol + m.colSpan - 1 >= cIdx) return { ...m, colSpan: m.colSpan - 1 };
            return m;
          })
          .filter((m: CellMerge) => m.colSpan > 0);
        save(nextCols, nextRows, nextMerges, nextWidths, nextHeaderValues);
      };

      const handleResizeStart = (e: React.MouseEvent, colName: string) => {
        e.preventDefault();
        const startX = e.clientX;
        const parentTh = e.currentTarget.parentElement;
        const startWidth = parentTh ? parentTh.getBoundingClientRect().width : 120;
        let currentWidth = startWidth;
        const handleMouseMove = (moveEvent: MouseEvent) => {
          const dx = moveEvent.clientX - startX;
          currentWidth = Math.max(40, startWidth + dx);
          setLocalColWidths((prev) => ({ ...prev, [colName]: `${currentWidth}px` }));
        };
        const handleMouseUp = () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          save(cols, rows, merges, { ...colWidths, [colName]: `${currentWidth}px` });
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      };

      const mergeRight = (rIdx: number, cIdx: number) => {
        if (cIdx >= cols.length - 1) return;
        const { isMerged, mergeInfo } = getMergeInfo(rIdx, cIdx);
        let nextMerges = [...merges];
        if (isMerged && mergeInfo && mergeInfo.startRow === rIdx && mergeInfo.startCol === cIdx) {
          nextMerges = merges.map((m: CellMerge) => m.startRow === rIdx && m.startCol === cIdx ? { ...m, colSpan: m.colSpan + 1 } : m);
        } else if (!isMerged) {
          nextMerges.push({ startRow: rIdx, startCol: cIdx, rowSpan: 1, colSpan: 2 });
        }
        save(cols, rows, nextMerges);
      };

      const mergeDown = (rIdx: number, cIdx: number) => {
        // rIdx=-1 은 헤더 행; 헤더→첫 데이터 행(0) 병합 허용
        if (rIdx !== -1 && rIdx >= rows.length - 1) return;
        const { isMerged, mergeInfo } = getMergeInfo(rIdx, cIdx);
        let nextMerges = [...merges];
        if (isMerged && mergeInfo && mergeInfo.startRow === rIdx && mergeInfo.startCol === cIdx) {
          nextMerges = merges.map((m: CellMerge) => m.startRow === rIdx && m.startCol === cIdx ? { ...m, rowSpan: m.rowSpan + 1 } : m);
        } else if (!isMerged) {
          nextMerges.push({ startRow: rIdx, startCol: cIdx, rowSpan: 2, colSpan: 1 });
        }
        save(cols, rows, nextMerges);
      };

      const unmerge = (rIdx: number, cIdx: number) => {
        const { mergeInfo } = getMergeInfo(rIdx, cIdx);
        if (!mergeInfo) return;
        const nextMerges = merges.filter((m: CellMerge) => !(m.startRow === mergeInfo.startRow && m.startCol === mergeInfo.startCol));
        save(cols, rows, nextMerges);
      };

      const handleCellContextMenu = (e: React.MouseEvent, rIdx: number, cIdx: number) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, rIdx, cIdx });
      };

      // ── 행 드래그 앤 드롭 ──
      const handleRowDragStart = (e: React.DragEvent, rIdx: number) => {
        setDragRow(rIdx);
        e.dataTransfer.effectAllowed = 'move';
      };
      const handleRowDragOver = (e: React.DragEvent, rIdx: number) => {
        e.preventDefault();
        setDragOverRow(rIdx);
      };
      const handleRowDrop = (rIdx: number) => {
        if (dragRow === null || dragRow === rIdx) { setDragRow(null); setDragOverRow(null); return; }

        // ── 헤더(rIdx=-1)가 관여된 경우: 헤더 ↔ 데이터 행 내용 교환 ──
        if (dragRow === -1 || rIdx === -1) {
          const dataIdx = dragRow === -1 ? rIdx : dragRow;
          // 헤더 행 내용을 데이터 행으로, 데이터 행 내용을 헤더로 전환
          const oldHeaderAsRow = cols.reduce((acc: Record<string, string>, col: string) => ({
            ...acc, [col]: headerValues[col] !== undefined ? headerValues[col] : col
          }), {});
          const nextHeaderValues = cols.reduce((acc: Record<string, string>, col: string) => ({
            ...acc, [col]: rows[dataIdx][col] ?? ''
          }), {});
          const nextRows = [...rows];
          nextRows[dataIdx] = oldHeaderAsRow;
          // 병합 좌표: startRow=-1 ↔ startRow=dataIdx 교환
          const nextMerges = merges.map((m: CellMerge) => {
            if (m.startRow === -1) return { ...m, startRow: dataIdx };
            if (m.startRow === dataIdx) return { ...m, startRow: -1 };
            return m;
          });
          save(cols, nextRows, nextMerges, colWidths, nextHeaderValues);
          setDragRow(null); setDragOverRow(null);
          return;
        }

        // ── 일반 데이터 행 간 이동 ──
        const nextRows = [...rows];
        const [moved] = nextRows.splice(dragRow, 1);
        nextRows.splice(rIdx, 0, moved);
        const nextMerges = merges.map((m: CellMerge) => {
          if (m.startRow < 0) return m;
          let nr = m.startRow;
          if (m.startRow === dragRow) nr = rIdx;
          else if (dragRow < rIdx && m.startRow > dragRow && m.startRow <= rIdx) nr = m.startRow - 1;
          else if (dragRow > rIdx && m.startRow >= rIdx && m.startRow < dragRow) nr = m.startRow + 1;
          return { ...m, startRow: nr };
        });
        save(cols, nextRows, nextMerges);
        setDragRow(null); setDragOverRow(null);
      };

      // ── 열 드래그 앤 드롭 ──
      const handleColDragStart = (e: React.DragEvent, cIdx: number) => {
        setDragCol(cIdx);
        e.dataTransfer.effectAllowed = 'move';
      };
      const handleColDragOver = (e: React.DragEvent, cIdx: number) => {
        e.preventDefault();
        setDragOverCol(cIdx);
      };
      const handleColDrop = (cIdx: number) => {
        if (dragCol === null || dragCol === cIdx) { setDragCol(null); setDragOverCol(null); return; }
        const nextCols = [...cols];
        const [movedCol] = nextCols.splice(dragCol, 1);
        nextCols.splice(cIdx, 0, movedCol);
        const nextRows = rows.map((row) => {
          const newRow: Record<string, string> = {};
          nextCols.forEach((c) => { newRow[c] = row[c] ?? ''; });
          return newRow;
        });
        const nextHeaderValues: Record<string, string> = {};
        nextCols.forEach((c) => { if (c in headerValues) nextHeaderValues[c] = headerValues[c]; });
        const nextMerges = merges.map((m: CellMerge) => {
          let nc = m.startCol;
          if (m.startCol === dragCol) nc = cIdx;
          else if (dragCol < cIdx && m.startCol > dragCol && m.startCol <= cIdx) nc = m.startCol - 1;
          else if (dragCol > cIdx && m.startCol >= cIdx && m.startCol < dragCol) nc = m.startCol + 1;
          return { ...m, startCol: nc };
        });
        save(nextCols, nextRows, nextMerges, colWidths, nextHeaderValues);
        setDragCol(null); setDragOverCol(null);
      };

      const isHalfWidth = field.width === 'half';

      return (
        <div className="mt-1 rounded-lg border border-border bg-panel p-2 relative">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-semibold text-ink2">표 편집기 — 우클릭: 셀 병합 · 헤더/핸들 드래그: 열·행 순서 변경</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-fixed border-collapse text-left text-[11.5px] border border-border" style={{ width: '100%', minWidth: isHalfWidth ? 'auto' : '500px' }}>
              <colgroup>
                <col style={{ width: '20px' }} />
                {cols.map((col: string, cIdx: number) => (
                  <col key={cIdx} style={{ width: localColWidths[col] || 'auto' }} />
                ))}
                <col style={{ width: '45px' }} />
              </colgroup>
              <tbody>
                {/* ── 헤더 행 (tbody 첫 번째 tr — rowSpan이 데이터 행까지 확장 가능, 드래그로 이동 가능) ── */}
                <tr
                  className={`border-b border-border transition-colors ${dragOverRow === -1 && dragRow !== -1 ? 'border-t-2 border-t-teal' : ''} ${dragRow === -1 ? 'opacity-40' : ''}`}
                  onDragOver={(e) => handleRowDragOver(e, -1)}
                  onDrop={() => handleRowDrop(-1)}
                >
                  {/* 행 드래그 핸들 */}
                  <td className="p-0 text-center border-r border-border w-[20px]">
                    <span
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, -1)}
                      onDragEnd={() => { setDragRow(null); setDragOverRow(null); }}
                      className="text-ink3 cursor-grab active:cursor-grabbing select-none text-[13px] block leading-none px-1 py-2"
                      title="드래그하여 행 순서 변경"
                    >
                      ⠿
                    </span>
                  </td>
                  {cols.map((col: string, cIdx: number) => {
                    const { isMerged, isStart, rowSpan, colSpan } = getMergeInfo(-1, cIdx);
                    if (isMerged && !isStart) return null;
                    const isDragTarget = dragOverCol === cIdx && dragCol !== cIdx;
                    return (
                      <th
                        key={cIdx}
                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                        colSpan={colSpan > 1 ? colSpan : undefined}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); handleColDragStart(e, cIdx); }}
                        onDragOver={(e) => { e.stopPropagation(); handleColDragOver(e, cIdx); }}
                        onDrop={(e) => { e.stopPropagation(); handleColDrop(cIdx); }}
                        onDragEnd={() => { setDragCol(null); setDragOverCol(null); }}
                        onContextMenu={(e) => handleCellContextMenu(e, -1, cIdx)}
                        className={`p-1.5 relative group border-r border-border min-w-[50px] cursor-grab active:cursor-grabbing transition-colors ${isDragTarget ? 'bg-teal-soft/40 border-l-2 border-l-teal' : ''} ${dragCol === cIdx ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-center gap-1 pr-2">
                          <EditableHeader
                            value={headerValues[col] !== undefined ? headerValues[col] : col}
                            onChange={(val) => updateHeaderCell(col, val)}
                          />
                          {cols.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeCol(cIdx); }}
                              className="text-[10px] text-ink3 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold shrink-0"
                              title="이 열 삭제"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div
                          onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, col); }}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal bg-[#ddd]/30 group-hover:bg-[#ddd] active:bg-teal transition-colors"
                          style={{ zIndex: 10 }}
                          title="드래그하여 열 너비 조절"
                        />
                      </th>
                    );
                  })}
                  <th className="w-[45px] p-1.5 border-r border-border text-center relative">
                    <button
                      type="button"
                      onClick={() => addCol(cols.length - 1)}
                      className="w-6 h-6 rounded-full border border-border bg-panel text-[13px] font-bold text-ink2 hover:border-teal hover:text-teal hover:bg-teal-soft flex items-center justify-center mx-auto transition-colors"
                      title="오른쪽에 열 추가"
                    >
                      +
                    </button>
                  </th>
                </tr>
                {/* ── 데이터 행 ── */}
                {rows.map((row: Record<string, string>, rIdx: number) => {
                  const isDragRowTarget = dragOverRow === rIdx && dragRow !== rIdx;
                  return (
                    <tr
                      key={rIdx}
                      onDragOver={(e) => handleRowDragOver(e, rIdx)}
                      onDrop={() => handleRowDrop(rIdx)}
                      className={`border-b border-border/50 hover:bg-panel-alt/30 transition-colors ${isDragRowTarget ? 'border-t-2 border-t-teal' : ''} ${dragRow === rIdx ? 'opacity-40' : ''}`}
                    >
                      <td className="p-0 text-center border-r border-border w-[20px]">
                        <span
                          draggable
                          onDragStart={(e) => handleRowDragStart(e, rIdx)}
                          onDragEnd={() => { setDragRow(null); setDragOverRow(null); }}
                          className="text-ink3 cursor-grab active:cursor-grabbing select-none text-[13px] block leading-none px-1 py-2"
                          title="드래그하여 행 순서 변경"
                        >
                          ⠿
                        </span>
                      </td>
                      {cols.map((col: string, cIdx: number) => {
                        const isNumLike = col.includes('수량') || col.includes('단가') || col.includes('가격') || col.includes('금액') || col.includes('수') || col.includes('율');
                        const { isMerged, isStart, rowSpan, colSpan } = getMergeInfo(rIdx, cIdx);
                        if (isMerged && !isStart) return null;
                        const isAutoAmt = col.includes('금액');
                        const isManualAmt = amountCells.some((c) => c.rIdx === rIdx && c.col === col);
                        const isAmountCell = isAutoAmt || isManualAmt;
                        const isSumCell = !!(sumCell && sumCell.rIdx === rIdx && sumCell.col === col);
                        return (
                          <td
                            key={col}
                            rowSpan={rowSpan}
                            colSpan={colSpan}
                            onContextMenu={(e) => handleCellContextMenu(e, rIdx, cIdx)}
                            className="p-1 border-r border-border"
                          >
                            <input
                              value={row[col] ?? ''}
                              onChange={(e) => {
                                const val = isAmountCell ? e.target.value.replace(/[^0-9]/g, '') : e.target.value;
                                updateCell(rIdx, col, val);
                              }}
                              disabled={isSumCell}
                              placeholder={isNumLike || isAmountCell || isSumCell ? '0' : ''}
                              className={`w-full rounded border border-border px-1.5 py-1 text-[11px] text-ink outline-none focus:border-teal ${
                                isSumCell ? 'bg-panel/40 font-semibold cursor-not-allowed text-teal' : 'bg-panel-alt'
                              }`}
                            />
                          </td>
                        );
                      })}
                      <td className="p-1 text-center border-none bg-transparent">
                        <button type="button" onClick={() => removeRow(rIdx)} className="text-[12px] text-ink3 hover:text-red-500 font-bold">✕</button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={cols.length + 2} className="py-4 text-center text-ink3 text-[11px]">
                      표가 비어 있습니다. 아래 버튼을 눌러 행/열을 추가하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-2 w-full rounded border border-dashed border-border-hi py-1 text-[11px] font-semibold text-ink2 hover:border-teal hover:text-teal"
          >
            + 행 추가
          </button>

          {contextMenu && (
            <div
              className="fixed z-50 min-w-[130px] rounded-lg border border-border bg-panel py-1.5 shadow-xl text-[12px]"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.rIdx !== -1 && (
                <>
                  {/* 금액 셀 토글 */}
                  {amountCells.some((c) => c.rIdx === contextMenu.rIdx && c.col === cols[contextMenu.cIdx]) ? (
                    <button type="button" onClick={() => { toggleAmountCell(contextMenu.rIdx, cols[contextMenu.cIdx]); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-amber-600 font-semibold">
                      💰 금액 셀 지정 해제
                    </button>
                  ) : (
                    <button type="button" onClick={() => { toggleAmountCell(contextMenu.rIdx, cols[contextMenu.cIdx]); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-teal font-semibold">
                      💰 금액 셀로 지정
                    </button>
                  )}

                  {/* 합산 결과 표시 셀 토글 */}
                  {sumCell && sumCell.rIdx === contextMenu.rIdx && sumCell.col === cols[contextMenu.cIdx] ? (
                    <button type="button" onClick={() => { toggleSumCell(contextMenu.rIdx, cols[contextMenu.cIdx]); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-amber-600 font-semibold">
                      📊 합산 셀 지정 해제
                    </button>
                  ) : (
                    <button type="button" onClick={() => { toggleSumCell(contextMenu.rIdx, cols[contextMenu.cIdx]); setContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-indigo-600 font-semibold">
                      📊 합산 결과 표시 지정
                    </button>
                  )}
                  <hr className="border-border my-1" />
                </>
              )}
              <button type="button" onClick={() => { mergeRight(contextMenu.rIdx, contextMenu.cIdx); setContextMenu(null); }}
                disabled={contextMenu.cIdx >= cols.length - 1}
                className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-ink disabled:opacity-50 disabled:hover:bg-transparent">
                👉 오른쪽 셀과 병합
              </button>
              <button type="button" onClick={() => { mergeDown(contextMenu.rIdx, contextMenu.cIdx); setContextMenu(null); }}
                disabled={contextMenu.rIdx !== -1 && contextMenu.rIdx >= rows.length - 1}
                className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-ink disabled:opacity-50 disabled:hover:bg-transparent">
                👇 아래 셀과 병합
              </button>
              <button type="button" onClick={() => { unmerge(contextMenu.rIdx, contextMenu.cIdx); setContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 hover:bg-panel-alt text-ink">
                🔓 병합 해제
              </button>
            </div>
          )}
        </div>
      );
    }

    case '텍스트':
    default: {
      const isDaysField = field.key.endsWith('__days');
      if (isDaysField) {
        const daysVal = sv ? `${sv}일` : '—';
        return <input disabled value={daysVal} className={`${inp} opacity-70 bg-panel-alt`} />;
      }
      return <input value={sv} onChange={(e) => set({ [field.key]: e.target.value })} placeholder={field.placeholder} className={inp} />;
    }
  }
}

/** 인쇄/문서뷰용 — 필드값을 사람이 읽는 문자열로. */
export function fieldText(field: FormField, values: Record<string, FieldValue>, org?: OrgLite): string {
  const v = values[field.key];
  switch (field.type) {
    case '표':
      return '(표 형식 데이터)';
    case '금액':
      return v ? `₩${Number(v).toLocaleString()}` : '—';
    case '기간': {
      const start = (v as string) ?? '';
      const end = (values[field.key + END_SUFFIX] as string) ?? '';
      const days = (values[field.key + DAYS_SUFFIX] as number) ?? (start && end ? daysBetween(start, end) : 0);
      return start && end ? `${start} ~ ${end} (${days}일)` : '—';
    }
    case '체크':
      return v === true ? '예' : '아니오';
    case '사용자':
      return org?.users.find((u) => u.id === v)?.name ?? (v ? String(v) : '—');
    default:
      return v === '' || v == null ? '—' : String(v);
  }
}

/** 필수 미입력 필드 라벨 목록(검증용). body/amount 예약 필드는 상신 모달이 별도 검증. */
export function missingRequired(fields: FormField[], values: Record<string, FieldValue>): string[] {
  return fields
    .filter((f) => f.required && f.type !== '안내문')
    .filter((f) => {
      const v = values[f.key];
      if (f.type === '기간') return !(v && values[f.key + END_SUFFIX]);
      if (f.type === '체크') return v !== true;
      return v === '' || v == null;
    })
    .map((f) => f.label);
}
