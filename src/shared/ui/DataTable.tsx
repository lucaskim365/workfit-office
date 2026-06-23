import { useMemo, useState, type ReactNode } from 'react';

export type Align = 'left' | 'center' | 'right';

export interface Column<T> {
  /** 데이터 키(기본 셀 값·정렬 접근자로 사용). */
  key: string;
  header: ReactNode;
  align?: Align;
  width?: number | string;
  /** 숫자 컬럼: 고정폭 숫자(tabular-nums). */
  mono?: boolean;
  sortable?: boolean;
  /** 커스텀 렌더(상태 Pill 등). 없으면 row[key] 표시. */
  render?: (row: T, rowIndex: number) => ReactNode;
  /** 정렬 기준값. render가 있을 때 정렬 키를 따로 지정. */
  sortAccessor?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** 지정 시 페이지네이션 활성화. */
  pageSize?: number;
  /** 체크박스 선택 컬럼. */
  selectable?: boolean;
  selectedKeys?: Array<string | number>;
  onSelectionChange?: (keys: Array<string | number>) => void;
  onRowClick?: (row: T) => void;
  /** 좌측 teal 보더로 강조할 활성 행. */
  activeRowKey?: string | number;
  stickyHeader?: boolean;
  emptyText?: string;
  className?: string;
}

const ALIGN: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

type SortDir = 'asc' | 'desc';

/**
 * 공통 데이터 테이블 — 와이어프레임 표 스타일(th panelAlt / td border / Pill) 정본.
 * 정렬·페이지네이션·행 선택·행 클릭·빈 상태를 지원하는 제네릭 컴포넌트.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  onRowClick,
  activeRowKey,
  stickyHeader = false,
  emptyText = '데이터가 없습니다.',
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [internalSel, setInternalSel] = useState<Array<string | number>>([]);

  const selected = selectedKeys ?? internalSel;
  const setSelected = (keys: Array<string | number>) => {
    if (onSelectionChange) onSelectionChange(keys);
    else setInternalSel(keys);
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const get = (r: T): string | number =>
      col.sortAccessor ? col.sortAccessor(r) : ((r as Record<string, unknown>)[col.key] as string | number);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, columns, sortKey, sortDir]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const view = pageSize ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const viewKeys = view.map(rowKey);
  const allChecked = view.length > 0 && viewKeys.every((k) => selected.includes(k));
  const someChecked = viewKeys.some((k) => selected.includes(k));

  const toggleAll = () => {
    if (allChecked) setSelected(selected.filter((k) => !viewKeys.includes(k)));
    else setSelected([...new Set([...selected, ...viewKeys])]);
  };
  const toggleOne = (k: string | number) => {
    if (selected.includes(k)) setSelected(selected.filter((x) => x !== k));
    else setSelected([...selected, k]);
  };

  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {selectable && (
                <th
                  className={`w-9 border-b border-border bg-panel-alt px-2.5 py-2 ${
                    stickyHeader ? 'sticky top-0 z-10' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-teal"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = !allChecked && someChecked;
                    }}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col)}
                    style={col.width ? { width: col.width } : undefined}
                    className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${
                      ALIGN[col.align ?? 'left']
                    } ${col.sortable ? 'cursor-pointer select-none hover:text-ink' : ''} ${
                      stickyHeader ? 'sticky top-0 z-10' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span className="text-[8px] text-ink3">
                          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-2.5 py-12 text-center text-[12px] text-ink3">
                  {emptyText}
                </td>
              </tr>
            ) : (
              view.map((row, i) => {
                const k = rowKey(row);
                const isActive = activeRowKey != null && k === activeRowKey;
                return (
                  <tr
                    key={k}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-border transition-colors hover:bg-panel-alt ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${isActive ? 'bg-teal-soft/50' : ''}`}
                  >
                    {selectable && (
                      <td
                        className="px-2.5 py-2.5"
                        style={isActive ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="accent-teal"
                          checked={selected.includes(k)}
                          onChange={() => toggleOne(k)}
                        />
                      </td>
                    )}
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        style={
                          !selectable && ci === 0 && isActive
                            ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' }
                            : undefined
                        }
                        className={`px-2.5 py-2.5 whitespace-nowrap ${ALIGN[col.align ?? 'left']} ${
                          col.mono ? 'font-mono tabular-nums' : ''
                        } ${ci === 0 ? 'font-semibold text-ink' : 'text-ink2'}`}
                      >
                        {col.render
                          ? col.render(row, i)
                          : ((row as Record<string, ReactNode>)[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pageSize && sorted.length > 0 && (
        <div className="flex items-center justify-between px-1 pt-3 text-[11px] text-ink2">
          <span>
            총 <b className="text-ink">{sorted.length.toLocaleString()}</b>건
          </span>
          <div className="flex items-center gap-1">
            <PageBtn disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              이전
            </PageBtn>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-6 min-w-6 rounded-md px-1.5 text-[11px] font-semibold transition-colors ${
                  i === safePage
                    ? 'bg-navy text-white'
                    : 'text-ink2 hover:bg-panel-alt'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <PageBtn disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
              다음
            </PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PageBtn({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="h-6 rounded-md border border-border-hi px-2 text-[11px] font-semibold text-ink2 transition-colors hover:bg-panel-alt disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
