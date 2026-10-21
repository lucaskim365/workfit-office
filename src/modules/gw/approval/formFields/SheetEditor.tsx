import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  Lock,
  PaintBucket,
  Table,
  TableCellsMerge,
  TableCellsSplit,
  X,
} from 'lucide-react';
import { getCellMergeInfo } from './utils';
import { cellToCoord, colIndexToLetter, type CellFormat, type ShiftAction } from './formulaEngine';
import { recalculateSheet, type CellStyle, type SheetPayload } from './sheetModel';
import {
  applyBorder,
  applyStyle,
  deleteCol,
  deleteRow,
  insertCol,
  insertRow,
  mergeRange,
  pasteTsv,
  propagateStructureChange,
  setCellValue,
  setSecretCell,
  unmergeAt,
  type BorderPreset,
  type CellRange,
} from './sheetOps';
import { SHEET_PALETTE, cellCss, defaultAlign, displayCellValue, isSecretCell } from './sheetStyle';

interface SheetEditorProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initial: SheetPayload;
  /** 같은 문서의 다른 표 (키 = 필드 key) */
  others: Record<string, SheetPayload>;
  /** 필드 key → 표 라벨 */
  labels: Record<string, string>;
  selfKey: string;
  /** 서식 설계 화면 — 비공개 칸 지정은 여기서만 */
  isDesignMode: boolean;
  onApply: (next: SheetPayload, othersPatch: Record<string, SheetPayload>) => void;
}

type Cell = { r: number; c: number };
type Popover = 'color' | 'bg' | 'border' | 'numFmt' | null;
type HeaderMenu = { kind: 'row' | 'col'; idx: number; x: number; y: number } | null;

const DEFAULT_COL_WIDTH = 110;

const HELPER_BUTTONS: Array<{ label: string; insert: string; title: string }> = [
  { label: '=', insert: '=', title: '수식 시작' },
  { label: '+', insert: '+', title: '더하기' },
  { label: '−', insert: '-', title: '빼기' },
  { label: '×', insert: '*', title: '곱하기' },
  { label: '÷', insert: '/', title: '나누기' },
  { label: '(', insert: '(', title: '여는 괄호' },
  { label: ')', insert: ')', title: '닫는 괄호' },
  { label: '합계', insert: 'SUM(', title: '합계 — 이어서 범위를 드래그하세요' },
];

const BORDER_PRESETS: Array<{ preset: BorderPreset; label: string }> = [
  { preset: 'all', label: '모든 테두리' },
  { preset: 'outer', label: '바깥 테두리' },
  { preset: 'thickOuter', label: '굵은 바깥 테두리' },
  { preset: 'none', label: '테두리 없음' },
];

const NUM_FORMATS: Array<{ key: 'general' | 'currency' | 'percent'; label: string; formula: CellFormat }> = [
  { key: 'general', label: '일반', formula: 'number' },
  { key: 'currency', label: '금액 (1,000)', formula: 'currency' },
  { key: 'percent', label: '백분율 (%)', formula: 'percent1' },
];

function normRange(a: Cell, b: Cell): CellRange {
  return { r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
}

function inRange(g: CellRange, r: number, c: number) {
  return r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
}

function rangeLabel(g: CellRange) {
  const a = cellToCoord(g.r1, g.c1);
  return g.r1 === g.r2 && g.c1 === g.c2 ? a : `${a}:${cellToCoord(g.r2, g.c2)}`;
}

/** 엑셀식 표 편집기 — 서식 설계·기안 작성 공용 */
export function SheetEditor({ isOpen, onClose, title, initial, others, labels, selfKey, isDesignMode, onApply }: SheetEditorProps) {
  const [sheet, setSheet] = useState<SheetPayload>(initial);
  const [otherSheets, setOtherSheets] = useState<Record<string, SheetPayload>>(others);
  const [anchor, setAnchor] = useState<Cell>({ r: 0, c: 0 });
  const [focus, setFocus] = useState<Cell>({ r: 0, c: 0 });
  const [editing, setEditing] = useState<Cell | null>(null);
  const [editSource, setEditSource] = useState<'cell' | 'bar'>('cell');
  const [draft, setDraft] = useState('');
  const [popover, setPopover] = useState<Popover>(null);
  const [headerMenu, setHeaderMenu] = useState<HeaderMenu>(null);
  const [picked, setPicked] = useState<CellRange | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const cellInputRef = useRef<HTMLTextAreaElement>(null);
  const barInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<'select' | 'pick' | null>(null);
  // 셀 찍기: 수식에 넣은 주소 토큰 위치 (드래그로 범위가 되면 같은 자리를 바꿔 씀)
  const pickRef = useRef<{ start: Cell; pos: number; len: number } | null>(null);
  const caretRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setSheet(initial);
    setOtherSheets(others);
    setAnchor({ r: 0, c: 0 });
    setFocus({ r: 0, c: 0 });
    setEditing(null);
    setPopover(null);
    setHeaderMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const othersByName = useMemo(() => {
    const ctx: Record<string, SheetPayload> = {};
    Object.entries(otherSheets).forEach(([key, s]) => {
      ctx[key] = s;
      if (labels[key]) ctx[labels[key]] = s;
    });
    return ctx;
  }, [otherSheets, labels]);

  const computed = useMemo(() => recalculateSheet(sheet, othersByName), [sheet, othersByName]);

  useEffect(() => {
    const up = () => (dragRef.current = null);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  if (!isOpen) return null;

  const { cols, rows } = sheet;
  const range = normRange(anchor, focus);
  const isPicking = editing !== null && draft.trimStart().startsWith('=');

  const rawOf = (r: number, c: number) => {
    const col = cols[c];
    if (col === undefined) return '';
    return sheet.cellFormulas[`${r}:${col}`]?.expression ?? String(rows[r]?.[col] ?? '');
  };

  const clampCell = (r: number, c: number): Cell => ({
    r: Math.max(0, Math.min(rows.length - 1, r)),
    c: Math.max(0, Math.min(cols.length - 1, c)),
  });

  /** 병합 블록 안의 칸이면 대표 칸으로 */
  const anchorOf = (cell: Cell): Cell => {
    const info = getCellMergeInfo(cell.r, cell.c, sheet.merges);
    return info.isMerged && info.mergeInfo ? { r: info.mergeInfo.startRow, c: info.mergeInfo.startCol } : cell;
  };

  const select = (cell: Cell, extend = false) => {
    const target = anchorOf(clampCell(cell.r, cell.c));
    if (!extend) setAnchor(target);
    setFocus(target);
  };

  const focusGrid = () => requestAnimationFrame(() => gridRef.current?.focus());

  // ── 편집 ────────────────────────────────────────────────
  const startEdit = (cell: Cell, initialText?: string, source: 'cell' | 'bar' = 'cell') => {
    const text = initialText ?? rawOf(cell.r, cell.c);
    setEditing(cell);
    setEditSource(source);
    setDraft(text);
    caretRef.current = text.length;
    requestAnimationFrame(() => {
      const el = source === 'bar' ? barInputRef.current : cellInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(text.length, text.length);
      }
    });
  };

  const commitEdit = (move?: { dr: number; dc: number }) => {
    if (!editing) return;
    const cell = editing;
    if (draft !== rawOf(cell.r, cell.c)) setSheet((s) => setCellValue(s, cell.r, cell.c, draft));
    setEditing(null);
    setPicked(null);
    pickRef.current = null;
    if (move) select({ r: cell.r + move.dr, c: cell.c + move.dc });
    focusGrid();
  };

  const cancelEdit = () => {
    setEditing(null);
    setPicked(null);
    pickRef.current = null;
    focusGrid();
  };

  const activeInput = () => (editSource === 'bar' ? barInputRef.current : cellInputRef.current);

  /** 편집 중인 입력칸 커서 위치에 글자 넣기 (편집 중이 아니면 선택 칸 편집 시작) */
  const insertText = (text: string) => {
    if (!editing) {
      const start = text === '=' ? '=' : `=${text}`;
      startEdit(anchorOf(focus), start, 'bar');
      return;
    }
    const el = activeInput();
    const pos = el?.selectionStart ?? caretRef.current;
    const end = el?.selectionEnd ?? pos;
    const next = draft.slice(0, pos) + text + draft.slice(end);
    setDraft(next);
    const caret = pos + text.length;
    caretRef.current = caret;
    requestAnimationFrame(() => {
      const target = activeInput();
      target?.focus();
      target?.setSelectionRange(caret, caret);
    });
  };

  /** 셀 찍기 — 수식 입력 중 셀을 누르면 주소, 드래그하면 범위를 커서 위치에 넣음 */
  const pickCell = (cell: Cell, dragging: boolean) => {
    const el = activeInput();
    let base = draft;
    let pos = el?.selectionStart ?? caretRef.current;
    if (dragging && pickRef.current) {
      const p = pickRef.current;
      base = draft.slice(0, p.pos) + draft.slice(p.pos + p.len);
      pos = p.pos;
    }
    const g = dragging && pickRef.current ? normRange(pickRef.current.start, cell) : normRange(cell, cell);
    const token = rangeLabel(g);
    const next = base.slice(0, pos) + token + base.slice(pos);
    pickRef.current = { start: dragging && pickRef.current ? pickRef.current.start : cell, pos, len: token.length };
    setPicked(g);
    setDraft(next);
    const caret = pos + token.length;
    caretRef.current = caret;
    requestAnimationFrame(() => {
      const target = activeInput();
      target?.focus();
      target?.setSelectionRange(caret, caret);
    });
  };

  // ── 구조 변경 (다른 표의 참조도 함께 이동) ─────────────────
  const structural = (fn: (s: SheetPayload) => SheetPayload, actions: ShiftAction[]) => {
    setSheet((s) => fn(s));
    if (actions.length === 0) return;
    setOtherSheets((o) => {
      let tables: Record<string, SheetPayload> = { ...o, [selfKey]: sheet };
      actions.forEach((a) => {
        tables = propagateStructureChange(tables, labels, selfKey, a);
      });
      const { [selfKey]: _self, ...rest } = tables;
      return rest;
    });
  };

  const addRowAt = (at: number) => structural((s) => insertRow(s, at), [{ type: 'row_add', atIndex: at }]);
  const addColAt = (at: number) => structural((s) => insertCol(s, at), [{ type: 'col_add', atIndex: at }]);

  const removeRows = (r1: number, r2: number) => {
    if (rows.length - (r2 - r1 + 1) < 1) return;
    const actions: ShiftAction[] = [];
    for (let r = r2; r >= r1; r--) actions.push({ type: 'row_del', atIndex: r });
    structural((s) => actions.reduce((acc, a) => deleteRow(acc, a.atIndex), s), actions);
    select({ r: r1, c: focus.c });
  };

  const removeCols = (c1: number, c2: number) => {
    if (cols.length - (c2 - c1 + 1) < 1) return;
    const actions: ShiftAction[] = [];
    for (let c = c2; c >= c1; c--) actions.push({ type: 'col_del', atIndex: c });
    structural((s) => actions.reduce((acc, a) => deleteCol(acc, a.atIndex), s), actions);
    select({ r: focus.r, c: c1 });
  };

  // ── 서식 ────────────────────────────────────────────────
  const styleAt = (r: number, c: number): CellStyle | undefined => sheet.cellStyles[`${r}:${cols[c]}`];
  const focusStyle = styleAt(anchorOf(focus).r, anchorOf(focus).c);

  const style = (patch: Partial<CellStyle>) => setSheet((s) => applyStyle(s, range, patch));

  const toggleBold = () => {
    let allBold = true;
    for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) if (!styleAt(r, c)?.bold) allBold = false;
    style({ bold: allBold ? undefined : true });
  };

  const setNumFmt = (fmt: (typeof NUM_FORMATS)[number]) => {
    setSheet((s) => {
      const cellFormulas = { ...s.cellFormulas };
      const plain: CellRange[] = [];
      for (let r = range.r1; r <= range.r2; r++) {
        for (let c = range.c1; c <= range.c2; c++) {
          const key = `${r}:${s.cols[c]}`;
          if (cellFormulas[key]) cellFormulas[key] = { ...cellFormulas[key], format: fmt.formula };
          else plain.push({ r1: r, r2: r, c1: c, c2: c });
        }
      }
      return plain.reduce(
        (acc, g) => applyStyle(acc, g, { numFmt: fmt.key === 'general' ? undefined : fmt.key }),
        { ...s, cellFormulas }
      );
    });
    setPopover(null);
  };

  const toggleSecret = () => {
    const on = !isSecretCell(sheet, anchorOf(focus).r, cols[anchorOf(focus).c]);
    setSheet((s) => {
      let next = s;
      for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) next = setSecretCell(next, r, c, on);
      return next;
    });
  };

  const clearRange = () => {
    setSheet((s) => {
      let next = s;
      for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) next = setCellValue(next, r, c, '');
      return next;
    });
  };

  const copyRange = () => {
    const lines: string[] = [];
    for (let r = range.r1; r <= range.r2; r++) {
      const cells: string[] = [];
      for (let c = range.c1; c <= range.c2; c++) cells.push(String(computed.rows[r]?.[cols[c]] ?? ''));
      lines.push(cells.join('\t'));
    }
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
  };

  // ── 키보드 ──────────────────────────────────────────────
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      select({ r: focus.r + dr, c: focus.c + dc }, e.shiftKey);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      select({ r: focus.r + (e.shiftKey ? -1 : 1), c: focus.c });
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      select({ r: focus.r, c: focus.c + (e.shiftKey ? -1 : 1) });
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      startEdit(anchorOf(focus));
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearRange();
      return;
    }
    if (ctrl && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleBold();
      return;
    }
    if (ctrl && e.key.toLowerCase() === 'c') {
      copyRange();
      return;
    }
    if (!ctrl && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      startEdit(anchorOf(focus), e.key);
    }
  };

  const onGridPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const at = anchorOf(range.r1 === focus.r && range.c1 === focus.c ? focus : { r: range.r1, c: range.c1 });
    // 붙여넣기로 늘어난 행·열은 끝에 붙으므로 다른 표 참조는 옮길 필요 없음
    setSheet((s) => pasteTsv(s, at.r, at.c, text));
  };

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === 'Enter' && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      commitEdit({ dr: 1, dc: 0 });
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit({ dr: 0, dc: e.shiftKey ? -1 : 1 });
    }
  };

  // ── 마우스 ──────────────────────────────────────────────
  const onCellMouseDown = (e: React.MouseEvent, cell: Cell) => {
    if (e.button !== 0) return;
    setHeaderMenu(null);
    setPopover(null);
    if (isPicking && editing && !(editing.r === cell.r && editing.c === cell.c)) {
      e.preventDefault(); // 입력칸 포커스 유지
      dragRef.current = 'pick';
      pickRef.current = null;
      pickCell(cell, false);
      return;
    }
    if (editing) {
      if (editing.r === cell.r && editing.c === cell.c) return;
      commitEdit();
    }
    dragRef.current = 'select';
    select(cell, e.shiftKey);
    focusGrid();
  };

  const onCellMouseEnter = (cell: Cell) => {
    if (dragRef.current === 'pick') pickCell(cell, true);
    else if (dragRef.current === 'select') select(cell, true);
  };

  const startColResize = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const startX = e.clientX;
    const startW = th.getBoundingClientRect().width;
    const move = (ev: MouseEvent) => {
      const w = Math.max(40, Math.round(startW + ev.clientX - startX));
      setSheet((s) => ({ ...s, colWidths: { ...s.colWidths, [col]: `${w}px` } }));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const colWidth = (col: string) => {
    const w = sheet.colWidths[col];
    return w && w.endsWith('px') ? w : `${DEFAULT_COL_WIDTH}px`;
  };

  const apply = () => {
    if (editing) {
      const cell = editing;
      const next = draft !== rawOf(cell.r, cell.c) ? setCellValue(sheet, cell.r, cell.c, draft) : sheet;
      finish(next);
      return;
    }
    finish(sheet);
  };

  const finish = (next: SheetPayload) => {
    const patch: Record<string, SheetPayload> = {};
    Object.entries(otherSheets).forEach(([k, s]) => {
      if (s !== others[k]) patch[k] = recalculateSheet(s, { ...othersByName });
    });
    onApply(recalculateSheet(next, othersByName), patch);
  };

  // ── 화면 ────────────────────────────────────────────────
  const tbBtn = (active = false) =>
    `flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-semibold transition-colors cursor-pointer ${
      active ? 'border-teal bg-teal-soft/60 text-teal' : 'border-border bg-white text-ink hover:border-teal hover:text-teal'
    }`;

  const palettePopover = (kind: 'color' | 'bg') => (
    <div className="absolute left-0 top-full z-20 mt-1 w-[188px] rounded-lg border border-border bg-white p-2 shadow-lg">
      <div className="grid grid-cols-5 gap-1.5">
        {SHEET_PALETTE.map((p) => (
          <button
            key={p.token}
            type="button"
            title={p.label}
            onClick={() => {
              style(kind === 'color' ? { color: p.token } : { bg: p.token });
              setPopover(null);
            }}
            className="h-6 w-6 rounded border border-black/10 cursor-pointer"
            style={{ background: kind === 'color' ? p.text : p.bg }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          style(kind === 'color' ? { color: undefined } : { bg: undefined });
          setPopover(null);
        }}
        className="mt-2 w-full rounded border border-border py-1 text-[11px] text-ink3 hover:text-ink cursor-pointer"
      >
        {kind === 'color' ? '기본 글자색' : '배경색 없음'}
      </button>
    </div>
  );

  const focusCell = anchorOf(focus);
  const barValue = editing ? draft : rawOf(focusCell.r, focusCell.c);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative flex flex-col w-full max-w-6xl h-[calc(88vh/var(--font-scale,1))] rounded-2xl bg-white shadow-2xl border border-border overflow-hidden">
        {/* 머리 */}
        <div className="flex items-center justify-between border-b border-border bg-panel px-5 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-soft/80 text-teal">
              <Table className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-[14.5px] font-bold text-ink">{title || '표 편집'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink3 hover:bg-panel-alt hover:text-ink cursor-pointer" title="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 도구 모음 */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-panel-alt/40 px-4 py-2 shrink-0">
          <button type="button" className={tbBtn(!!focusStyle?.bold)} onClick={toggleBold} title="굵게 (Ctrl+B)">
            <Bold className="h-3.5 w-3.5" />
          </button>
          <div className="relative">
            <button type="button" className={tbBtn(popover === 'color')} onClick={() => setPopover(popover === 'color' ? null : 'color')} title="글자색">
              <Baseline className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </button>
            {popover === 'color' && palettePopover('color')}
          </div>
          <div className="relative">
            <button type="button" className={tbBtn(popover === 'bg')} onClick={() => setPopover(popover === 'bg' ? null : 'bg')} title="배경색">
              <PaintBucket className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </button>
            {popover === 'bg' && palettePopover('bg')}
          </div>
          <span className="mx-1 h-5 w-px bg-border" />
          <button type="button" className={tbBtn(focusStyle?.align === 'left')} onClick={() => style({ align: 'left' })} title="왼쪽 정렬">
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={tbBtn(focusStyle?.align === 'center')} onClick={() => style({ align: 'center' })} title="가운데 정렬">
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={tbBtn(focusStyle?.align === 'right')} onClick={() => style({ align: 'right' })} title="오른쪽 정렬">
            <AlignRight className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 h-5 w-px bg-border" />
          <div className="relative">
            <button type="button" className={tbBtn(popover === 'numFmt')} onClick={() => setPopover(popover === 'numFmt' ? null : 'numFmt')} title="숫자 표시">
              <span>숫자 표시</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {popover === 'numFmt' && (
              <div className="absolute left-0 top-full z-20 mt-1 w-[140px] rounded-lg border border-border bg-white py-1 shadow-lg">
                {NUM_FORMATS.map((f) => (
                  <button key={f.key} type="button" onClick={() => setNumFmt(f)} className="block w-full px-3 py-1.5 text-left text-[11.5px] text-ink hover:bg-teal-soft/40 cursor-pointer">
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" className={tbBtn(popover === 'border')} onClick={() => setPopover(popover === 'border' ? null : 'border')} title="테두리">
              <span>테두리</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {popover === 'border' && (
              <div className="absolute left-0 top-full z-20 mt-1 w-[150px] rounded-lg border border-border bg-white py-1 shadow-lg">
                {BORDER_PRESETS.map((b) => (
                  <button
                    key={b.preset}
                    type="button"
                    onClick={() => {
                      setSheet((s) => applyBorder(s, range, b.preset));
                      setPopover(null);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-[11.5px] text-ink hover:bg-teal-soft/40 cursor-pointer"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="mx-1 h-5 w-px bg-border" />
          <button type="button" className={tbBtn()} onClick={() => setSheet((s) => mergeRange(s, range))} title="셀 병합">
            <TableCellsMerge className="h-3.5 w-3.5" />
            <span>병합</span>
          </button>
          <button type="button" className={tbBtn()} onClick={() => setSheet((s) => unmergeAt(s, focusCell.r, focusCell.c))} title="병합 해제">
            <TableCellsSplit className="h-3.5 w-3.5" />
            <span>해제</span>
          </button>
          <span className="mx-1 h-5 w-px bg-border" />
          <button type="button" className={tbBtn()} onClick={() => addRowAt(range.r2 + 1)}>+ 행</button>
          <button type="button" className={tbBtn()} onClick={() => addColAt(range.c2 + 1)}>+ 열</button>
          <button type="button" className={tbBtn()} onClick={() => removeRows(range.r1, range.r2)} disabled={rows.length <= 1}>행 삭제</button>
          <button type="button" className={tbBtn()} onClick={() => removeCols(range.c1, range.c2)} disabled={cols.length <= 1}>열 삭제</button>
          {isDesignMode && (
            <>
              <span className="mx-1 h-5 w-px bg-border" />
              <button
                type="button"
                className={tbBtn(isSecretCell(sheet, focusCell.r, cols[focusCell.c] ?? ''))}
                onClick={toggleSecret}
                title="비공개 칸 지정/해제"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>비공개</span>
              </button>
            </>
          )}
        </div>

        {/* 수식 입력줄 */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-1.5 shrink-0">
          <div className="w-[76px] shrink-0 rounded border border-border bg-panel px-2 py-1 text-center font-mono text-[12px] font-bold text-ink">
            {editing ? cellToCoord(editing.r, editing.c) : rangeLabel(range)}
          </div>
          <span className="shrink-0 font-serif text-[13px] italic text-ink3">fx</span>
          <input
            ref={barInputRef}
            value={barValue}
            onFocus={() => {
              if (!editing) startEdit(focusCell, undefined, 'bar');
              else setEditSource('bar');
            }}
            onChange={(e) => {
              setDraft(e.target.value);
              caretRef.current = e.target.selectionStart ?? e.target.value.length;
              pickRef.current = null;
            }}
            onSelect={(e) => (caretRef.current = (e.target as HTMLInputElement).selectionStart ?? 0)}
            onKeyDown={onEditorKeyDown}
            className="min-w-0 flex-1 rounded border border-border px-2 py-1 font-mono text-[12.5px] text-ink outline-none focus:border-teal"
          />
          <div className="flex shrink-0 items-center gap-1">
            {HELPER_BUTTONS.map((b) => (
              <button
                key={b.label}
                type="button"
                title={b.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertText(b.insert)}
                className="min-w-[28px] rounded-md border border-border bg-white px-1.5 py-1 text-[12px] font-bold text-ink hover:border-teal hover:text-teal cursor-pointer"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* 격자 */}
        <div
          ref={gridRef}
          tabIndex={0}
          onKeyDown={onGridKeyDown}
          onPaste={onGridPaste}
          className="relative flex-1 overflow-auto bg-[#f7f7f8] outline-none"
        >
          <table className={`border-collapse bg-white text-[12px] ${editing ? '' : 'select-none'}`} style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              {cols.map((col) => (
                <col key={col} style={{ width: colWidth(col) }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-[3] border border-[#d0d0d0] bg-[#eef0f2]" />
                {cols.map((col, c) => (
                  <th
                    key={col}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      if (editing) commitEdit();
                      setAnchor({ r: 0, c });
                      setFocus({ r: rows.length - 1, c });
                      focusGrid();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setHeaderMenu({ kind: 'col', idx: c, x: e.clientX, y: e.clientY });
                    }}
                    className={`sticky top-0 z-[2] relative select-none border border-[#d0d0d0] py-1 text-center text-[11px] font-semibold ${
                      c >= range.c1 && c <= range.c2 ? 'bg-teal-soft text-teal' : 'bg-[#eef0f2] text-[#666]'
                    }`}
                  >
                    {colIndexToLetter(c)}
                    <span onMouseDown={(e) => startColResize(e, col)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-teal/40" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((_row, r) => (
                <tr key={r}>
                  <th
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      if (editing) commitEdit();
                      setAnchor({ r, c: 0 });
                      setFocus({ r, c: cols.length - 1 });
                      focusGrid();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setHeaderMenu({ kind: 'row', idx: r, x: e.clientX, y: e.clientY });
                    }}
                    className={`sticky left-0 z-[1] select-none border border-[#d0d0d0] px-1 text-center text-[11px] font-semibold ${
                      r >= range.r1 && r <= range.r2 ? 'bg-teal-soft text-teal' : 'bg-[#eef0f2] text-[#666]'
                    }`}
                  >
                    {r + 1}
                  </th>
                  {cols.map((col, c) => {
                    const { isMerged, isStart, rowSpan, colSpan } = getCellMergeInfo(r, c, sheet.merges);
                    if (isMerged && !isStart) return null;
                    const key = `${r}:${col}`;
                    const isEditing = editing?.r === r && editing?.c === c;
                    const selected = inRange(range, r, c);
                    const isFocus = focusCell.r === r && focusCell.c === c;
                    const isPicked = picked ? inRange(picked, r, c) : false;
                    const secret = isSecretCell(sheet, r, col);
                    return (
                      <td
                        key={col}
                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                        colSpan={colSpan > 1 ? colSpan : undefined}
                        onMouseDown={(e) => onCellMouseDown(e, { r, c })}
                        onMouseEnter={() => onCellMouseEnter({ r, c })}
                        onDoubleClick={() => startEdit({ r, c })}
                        className={`relative h-[28px] border border-[#e2e2e2] px-1.5 py-1 align-middle text-[#222] whitespace-pre-wrap break-words ${
                          selected && !isEditing ? 'bg-teal-soft/35' : ''
                        }`}
                        style={{
                          textAlign: defaultAlign(computed, r, col),
                          ...cellCss(sheet.cellStyles[key]),
                          ...(isFocus && !isEditing ? { outline: '2px solid var(--color-teal, #0f766e)', outlineOffset: '-2px' } : {}),
                          ...(isPicked ? { outline: '2px dashed #2563eb', outlineOffset: '-2px' } : {}),
                        }}
                      >
                        {isEditing && editSource === 'cell' ? (
                          <textarea
                            ref={cellInputRef}
                            value={draft}
                            rows={Math.max(1, draft.split('\n').length)}
                            onChange={(e) => {
                              setDraft(e.target.value);
                              caretRef.current = e.target.selectionStart ?? e.target.value.length;
                              pickRef.current = null;
                            }}
                            onSelect={(e) => (caretRef.current = (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                            onKeyDown={onEditorKeyDown}
                            className="block w-full resize-none bg-white font-mono text-[12px] text-ink outline-2 outline-teal"
                          />
                        ) : (
                          <>
                            {isEditing ? draft : displayCellValue(computed, r, col)}
                            {secret && <Lock className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-ink3" />}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {headerMenu && (
            <div
              className="fixed z-30 w-[150px] rounded-lg border border-border bg-white py-1 text-[11.5px] shadow-lg"
              style={{ left: headerMenu.x, top: headerMenu.y }}
              onMouseLeave={() => setHeaderMenu(null)}
            >
              {(headerMenu.kind === 'row'
                ? [
                    { label: '위에 행 삽입', run: () => addRowAt(headerMenu.idx) },
                    { label: '아래에 행 삽입', run: () => addRowAt(headerMenu.idx + 1) },
                    { label: '행 삭제', run: () => removeRows(headerMenu.idx, headerMenu.idx) },
                  ]
                : [
                    { label: '왼쪽에 열 삽입', run: () => addColAt(headerMenu.idx) },
                    { label: '오른쪽에 열 삽입', run: () => addColAt(headerMenu.idx + 1) },
                    { label: '열 삭제', run: () => removeCols(headerMenu.idx, headerMenu.idx) },
                  ]
              ).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.run();
                    setHeaderMenu(null);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-ink hover:bg-teal-soft/40 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 바닥 */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-panel px-5 py-3 shrink-0">
          <button type="button" onClick={onClose} className="rounded-lg border border-border bg-white px-4 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-panel-alt cursor-pointer">
            취소
          </button>
          <button type="button" onClick={apply} className="rounded-lg bg-teal px-4 py-1.5 text-[12.5px] font-bold text-white hover:opacity-90 cursor-pointer">
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
