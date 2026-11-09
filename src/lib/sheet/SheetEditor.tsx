/**
 * 엑셀식 시트 편집기 — 머리글(A·B·C / 1·2·3)·격자·도구 모음·수식 입력줄
 * - mode 'design': 틀까지 편집(값·수식·서식·병합·행/열·너비/높이)
 * - mode 'input' : 값만 편집. 도구 모음·머리글 메뉴 없음, canEditCell 이 허락한 칸만
 * - 업무 규칙(결재 칸 등)은 모르며, 쓰는 쪽이 판단 함수·칸 표시·도구 모음 끝 버튼을 넘겨준다
 * - 되돌리기(Ctrl+Z)·다시 실행(Ctrl+Y)은 편집기 안에서 관리한다
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { colLetter } from './formula';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, recalculate, type CellStyle, type Sheet } from './model';
import {
  applyBorder,
  applyStyle,
  deleteCol,
  deleteRow,
  insertCol,
  insertRow,
  mergeRange,
  pasteTsv,
  setCellValue,
  unmergeRange,
  type BorderPreset,
  type CellRange,
} from './ops';
import { SHEET_COLORS, cellCss, defaultAlign, displayValue, renderStyle, shrinkFontSize } from './style';

export interface SheetSelection {
  range: CellRange;
  focus: { r: number; c: number };
}

export interface SheetEditorProps {
  value: Sheet;
  onChange: (next: Sheet) => void;
  mode: 'design' | 'input';
  /** input 모드에서 값을 고칠 수 있는 칸 (없으면 모두) */
  canEditCell?: (s: Sheet, r: number, c: number) => boolean;
  /** 병합해도 되는가 — false 면 막고 onNotice */
  canMerge?: (s: Sheet, range: CellRange) => boolean;
  /** 행·열을 지워도 되는가 */
  canDeleteRow?: (s: Sheet, r: number) => boolean;
  canDeleteCol?: (s: Sheet, c: number) => boolean;
  /** 값 넣기 — 기본 setCellValue (예: 수식을 받지 않는 칸 처리) */
  setValue?: (s: Sheet, r: number, c: number, text: string) => Sheet;
  /** 붙여넣기 — 기본 pasteTsv (input 모드 기본은 늘리지 않고 허락된 칸에만) */
  paste?: (s: Sheet, r: number, c: number, text: string) => Sheet;
  /** 칸 오른쪽 위에 그릴 표시(예: 입력 칸·칸 이름 표시) */
  renderBadge?: (r: number, c: number) => ReactNode;
  /** 도구 모음 끝에 붙일 쓰는 쪽 버튼 */
  toolbarExtra?: ReactNode;
  onSelect?: (sel: SheetSelection) => void;
  /** 막힌 동작 안내 */
  onNotice?: (message: string) => void;
  /** 이 폭(px)에 세로 안내선 — 예: A4 인쇄 폭 */
  guideWidth?: number;
  /** 편집기 높이(CSS 값). 기본 520px */
  height?: string;
  /** 편집할 때마다 쓰는 쪽 규칙으로 다듬기(예: 반복 구간 이어 붙이기) — 다듬은 결과가 한 번의 편집으로 되돌리기에 들어간다 */
  normalize?: (s: Sheet) => Sheet;
  /**
   * 종이 보기 — 행·열 머리(A·B·C, 1·2·3)를 가는 띠로 줄이고, 격자를 이 함수가 감싼 문서(종이) 안에 그린다.
   * 워드에서 표를 고치듯 실제 문서 모양 그대로 편집한다. 띠를 눌러 행·열 고르기, 띠 끝을 끌어 크기 바꾸기는 그대로.
   */
  paper?: (table: ReactNode) => ReactNode;
}

type Cell = { r: number; c: number };
type Popover = 'color' | 'bg' | 'border' | 'numFmt' | null;
type HeaderMenu = { kind: 'row' | 'col'; idx: number; x: number; y: number } | null;

const HISTORY_LIMIT = 50;
const HEADER_W = 40;
const HEADER_H = 24;

/** 테두리 고르기 — 줄마다 방향, 칸마다 굵기(일반·굵게) */
const BORDER_PRESETS: Array<{ preset: BorderPreset; label: string }> = [
  { preset: 'all', label: '모든 테두리' },
  { preset: 'outer', label: '바깥 테두리' },
  { preset: 'top', label: '위쪽' },
  { preset: 'bottom', label: '아래쪽' },
  { preset: 'left', label: '왼쪽' },
  { preset: 'right', label: '오른쪽' },
];

const NUM_FORMATS: Array<{ key: NonNullable<CellStyle['numFmt']>; label: string }> = [
  { key: 'general', label: '일반' },
  { key: 'currency', label: '금액 (1,000)' },
  { key: 'percent', label: '백분율 (%)' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

const HELPERS: Array<{ label: string; insert: string; title: string }> = [
  { label: '=', insert: '=', title: '수식 시작' },
  { label: '+', insert: '+', title: '더하기' },
  { label: '−', insert: '-', title: '빼기' },
  { label: '×', insert: '*', title: '곱하기' },
  { label: '÷', insert: '/', title: '나누기' },
  { label: '합계', insert: 'SUM(', title: '합계 — 이어서 범위를 끌어 고르세요' },
];

function norm(a: Cell, b: Cell): CellRange {
  return { r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
}
const inRange = (g: CellRange, r: number, c: number) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
const addr = (r: number, c: number) => `${colLetter(c)}${r + 1}`;
const rangeLabel = (g: CellRange) => (g.r1 === g.r2 && g.c1 === g.c2 ? addr(g.r1, g.c1) : `${addr(g.r1, g.c1)}:${addr(g.r2, g.c2)}`);

export function SheetEditor({
  value,
  onChange,
  mode,
  canEditCell,
  canMerge,
  canDeleteRow,
  canDeleteCol,
  setValue = (s, r, c, text) => setCellValue(s, r, c, text),
  paste,
  renderBadge,
  toolbarExtra,
  onSelect,
  onNotice,
  guideWidth,
  height = '520px',
  normalize,
  paper,
}: SheetEditorProps) {
  const design = mode === 'design';
  // 행·열 머리 크기 — 종이 보기에선 글자 없는 가는 띠
  const hw = paper ? 10 : HEADER_W;
  const hh = paper ? 10 : HEADER_H;
  const [anchor, setAnchor] = useState<Cell>({ r: 0, c: 0 });
  const [focus, setFocus] = useState<Cell>({ r: 0, c: 0 });
  const [editing, setEditing] = useState<Cell | null>(null);
  const [editSource, setEditSource] = useState<'cell' | 'bar'>('cell');
  const [draft, setDraft] = useState('');
  const [popover, setPopover] = useState<Popover>(null);
  const [headerMenu, setHeaderMenu] = useState<HeaderMenu>(null);
  const [picked, setPicked] = useState<CellRange | null>(null);
  const [customColor, setCustomColor] = useState('#');

  const undoStack = useRef<Sheet[]>([]);
  const redoStack = useRef<Sheet[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellInputRef = useRef<HTMLTextAreaElement>(null);
  const barInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<'select' | 'pick' | null>(null);
  const pickRef = useRef<{ start: Cell; pos: number; len: number } | null>(null);
  const caretRef = useRef(0);

  const computed = useMemo(() => recalculate(value), [value]);
  const { cols, rows, merges } = value;

  useEffect(() => {
    const up = () => (dragRef.current = null);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const range = norm(anchor, focus);
  const multiSelected = range.r1 !== range.r2 || range.c1 !== range.c2;
  useEffect(() => {
    onSelect?.({ range, focus });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.r1, range.r2, range.c1, range.c2, focus.r, focus.c]);

  // ── 변경·되돌리기 ───────────────────────────────────────
  // 편집기가 마지막으로 내보낸(또는 받은) 값. 쓰는 쪽이 바깥에서 값을 바꾸면(칸 속성 패널·엑셀 불러오기 등)
  // 그 직전 값을 되돌리기 목록에 넣어, 바깥 변경도 Ctrl+Z 로 되돌릴 수 있게 한다
  const seenRef = useRef(value);
  if (value !== seenRef.current) {
    undoStack.current = [...undoStack.current.slice(-(HISTORY_LIMIT - 1)), seenRef.current];
    redoStack.current = [];
    seenRef.current = value;
  }
  const emit = (next: Sheet) => {
    seenRef.current = next;
    onChange(next);
  };
  const commit = (raw: Sheet) => {
    if (raw === value) return;
    const next = normalize ? normalize(raw) : raw;
    undoStack.current = [...undoStack.current.slice(-(HISTORY_LIMIT - 1)), value];
    redoStack.current = [];
    emit(next);
  };
  const update = (fn: (s: Sheet) => Sheet) => commit(fn(value));
  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(value);
    emit(prev);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(value);
    emit(next);
  };

  // 격자 밖(속성 패널의 고르기·체크·버튼 등)에 초점이 있어도 Ctrl+Z / Ctrl+Shift+Z·Ctrl+Y 가 편집기에 듣게.
  // 글을 쓰는 중(입력란·글 상자)이면 그 글의 되돌리기(브라우저 기본)를 그대로 둔다
  const historyRef = useRef({ undo, redo });
  historyRef.current = { undo, redo };
  useEffect(() => {
    const TEXT_INPUT_SKIP = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color', 'range']);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.code !== 'KeyZ' && e.code !== 'KeyY') return;
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !TEXT_INPUT_SKIP.has((t as HTMLInputElement).type)));
      if (typing) return;
      e.preventDefault();
      if (e.code === 'KeyY' || e.shiftKey) historyRef.current.redo();
      else historyRef.current.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── 칸 ─────────────────────────────────────────────────
  const mergeAt = (r: number, c: number) =>
    merges.find((m) => r >= m.startRow && r < m.startRow + m.rowSpan && c >= m.startCol && c < m.startCol + m.colSpan);
  const anchorOf = (cell: Cell): Cell => {
    const m = mergeAt(cell.r, cell.c);
    return m ? { r: m.startRow, c: m.startCol } : cell;
  };
  const clamp = (r: number, c: number): Cell => ({
    r: Math.max(0, Math.min(rows.length - 1, r)),
    c: Math.max(0, Math.min(cols.length - 1, c)),
  });
  const editable = (cell: Cell) => design || !canEditCell || canEditCell(value, cell.r, cell.c);
  const rawOf = (r: number, c: number) => {
    const col = cols[c];
    if (col === undefined) return '';
    return value.formulas[`${r}:${col}`] ?? String(rows[r]?.[col] ?? '');
  };

  const select = (cell: Cell, extend = false) => {
    const target = anchorOf(clamp(cell.r, cell.c));
    if (!extend) setAnchor(target);
    setFocus(target);
  };
  const focusGrid = () => requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));

  // ── 편집 ───────────────────────────────────────────────
  const startEdit = (cell: Cell, initialText?: string, source: 'cell' | 'bar' = 'cell') => {
    if (!editable(cell)) {
      onNotice?.('이 칸은 고칠 수 없습니다.');
      return;
    }
    const text = initialText ?? rawOf(cell.r, cell.c);
    setEditing(cell);
    setEditSource(source);
    setDraft(text);
    caretRef.current = text.length;
    requestAnimationFrame(() => {
      const el = source === 'bar' ? barInputRef.current : cellInputRef.current;
      el?.focus();
      el?.setSelectionRange(text.length, text.length);
    });
  };

  const commitEdit = (move?: { dr: number; dc: number }) => {
    if (!editing) return;
    const cell = editing;
    if (draft !== rawOf(cell.r, cell.c)) update((s) => setValue(s, cell.r, cell.c, draft));
    setEditing(null);
    setPicked(null);
    pickRef.current = null;
    if (move) select({ r: cell.r + move.dr, c: cell.c + move.dc });
    focusGrid();
  };

  // 칸 편집 상자 — 고친 칸 자리에 띄운다(병합 칸은 병합 크기). 글에 맞춰 넓이·높이를 늘린다
  const [editBox, setEditBox] = useState<{ left: number; top: number; width: number; height: number; fontSize?: string; fontWeight?: number } | null>(null);
  useLayoutEffect(() => {
    if (!editing || editSource !== 'cell') {
      setEditBox(null);
      return;
    }
    const grid = gridRef.current;
    const td = grid?.querySelector<HTMLElement>(`[data-cell="${editing.r}:${editing.c}"]`);
    if (!grid || !td) return;
    const g = grid.getBoundingClientRect();
    const t = td.getBoundingClientRect();
    const cs = getComputedStyle(td);
    // 화면 크기 배율(CSS zoom — 글자 크기 설정)이 걸려 있으면 화면 좌표가 배율만큼 커져 있다 — 배치 단위로 되돌린다
    const scale = grid.offsetWidth > 0 ? g.width / grid.offsetWidth : 1;
    setEditBox({
      left: (t.left - g.left) / scale + grid.scrollLeft,
      top: (t.top - g.top) / scale + grid.scrollTop,
      width: t.width / scale,
      height: t.height / scale,
      fontSize: cs.fontSize,
      fontWeight: Number(cs.fontWeight) || undefined,
    });
  }, [editing, editSource]);
  useLayoutEffect(() => {
    const el = cellInputRef.current;
    const grid = gridRef.current;
    if (!el || !grid || !editBox) return;
    // 한 줄로 쓴 폭을 재고, 칸보다 넓으면 오른쪽으로 넓힌다. 시트 끝까지 넘으면 그 폭에서 줄을 바꾼다
    const maxWidth = Math.max(editBox.width, grid.scrollWidth - editBox.left - 2);
    el.style.whiteSpace = 'pre';
    el.style.width = `${editBox.width}px`;
    el.style.height = 'auto';
    const wanted = el.scrollWidth + 4;
    if (wanted > editBox.width) el.style.width = `${Math.min(wanted, maxWidth)}px`;
    if (wanted > maxWidth) el.style.whiteSpace = 'pre-wrap';
    el.style.height = `${Math.max(editBox.height, el.scrollHeight)}px`;
  }, [draft, editBox]);

  const cancelEdit = () => {
    setEditing(null);
    setPicked(null);
    pickRef.current = null;
    focusGrid();
  };

  const activeInput = () => (editSource === 'bar' ? barInputRef.current : cellInputRef.current);
  const isPicking = design && editing !== null && draft.trimStart().startsWith('=');

  const insertText = (text: string) => {
    if (!editing) {
      startEdit(anchorOf(focus), text === '=' ? '=' : `=${text}`, 'bar');
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
      activeInput()?.focus();
      activeInput()?.setSelectionRange(caret, caret);
    });
  };

  /**
   * 수식 입력 중 칸을 누를 때 주소를 넣을 자리인가 — 'insert': 커서 앞이 = + - * / ^ & ( , : < > (공백은 건너뜀),
   * 'replace': 방금 눌러 넣은 주소 바로 뒤(다른 칸을 누르면 그 주소를 바꿈), null: 주소 자리가 아님(고치기를 끝냄)
   */
  const refExpected = (): 'insert' | 'replace' | null => {
    const pos = activeInput()?.selectionStart ?? caretRef.current;
    const p = pickRef.current;
    if (p && p.pos + p.len === pos) return 'replace';
    return /[=+\-*/^&(,:<>]$/.test(draft.slice(0, pos).replace(/\s+$/, '')) ? 'insert' : null;
  };

  /** 수식 입력 중 칸을 누르면 주소, 끌면 범위를 커서 자리에 넣는다 */
  const pickCell = (cell: Cell, dragging: boolean) => {
    const el = activeInput();
    let base = draft;
    let pos = el?.selectionStart ?? caretRef.current;
    if (dragging && pickRef.current) {
      base = draft.slice(0, pickRef.current.pos) + draft.slice(pickRef.current.pos + pickRef.current.len);
      pos = pickRef.current.pos;
    }
    const start = dragging && pickRef.current ? pickRef.current.start : cell;
    const g = norm(start, cell);
    const token = rangeLabel(g);
    pickRef.current = { start, pos, len: token.length };
    setPicked(g);
    setDraft(base.slice(0, pos) + token + base.slice(pos));
    const caret = pos + token.length;
    caretRef.current = caret;
    requestAnimationFrame(() => {
      activeInput()?.focus();
      activeInput()?.setSelectionRange(caret, caret);
    });
  };

  // ── 구조 ───────────────────────────────────────────────
  const removeRows = (r1: number, r2: number) => {
    if (rows.length - (r2 - r1 + 1) < 1) return;
    for (let r = r1; r <= r2; r++) {
      if (canDeleteRow && !canDeleteRow(value, r)) {
        onNotice?.(`${r + 1}행에 연결된 칸이 있어 지울 수 없습니다.`);
        return;
      }
    }
    update((s) => {
      let next = s;
      for (let r = r2; r >= r1; r--) next = deleteRow(next, r);
      return next;
    });
    select({ r: r1, c: focus.c });
  };
  const removeCols = (c1: number, c2: number) => {
    if (cols.length - (c2 - c1 + 1) < 1) return;
    for (let c = c1; c <= c2; c++) {
      if (canDeleteCol && !canDeleteCol(value, c)) {
        onNotice?.(`${colLetter(c)}열에 연결된 칸이 있어 지울 수 없습니다.`);
        return;
      }
    }
    update((s) => {
      let next = s;
      for (let c = c2; c >= c1; c--) next = deleteCol(next, c);
      return next;
    });
    select({ r: focus.r, c: c1 });
  };
  const merge = () => {
    if (canMerge && !canMerge(value, range)) {
      onNotice?.('연결된 칸을 덮는 병합은 할 수 없습니다. 연결된 칸이 왼쪽 위에 오도록 고르세요.');
      return;
    }
    update((s) => mergeRange(s, range));
  };

  // ── 서식 ───────────────────────────────────────────────
  const styleAt = (r: number, c: number): CellStyle | undefined => value.styles[`${r}:${cols[c]}`];
  const focusCell = anchorOf(focus);
  const focusStyle = styleAt(focusCell.r, focusCell.c);
  const style = (patch: Partial<CellStyle>) => update((s) => applyStyle(s, range, patch));
  const toggle = (key: 'bold' | 'italic' | 'underline' | 'shrink') => {
    let all = true;
    for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) if (!styleAt(r, c)?.[key]) all = false;
    style({ [key]: all ? undefined : true });
  };

  const clearRange = () => {
    update((s) => {
      let next = s;
      for (let r = range.r1; r <= range.r2; r++) {
        for (let c = range.c1; c <= range.c2; c++) {
          if (!design && canEditCell && !canEditCell(s, r, c)) continue;
          next = setValue(next, r, c, '');
        }
      }
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

  // ── 키보드 ─────────────────────────────────────────────
  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const ctrl = e.ctrlKey || e.metaKey;
    // 한글 입력 상태에선 e.key 가 'ㅋ'처럼 오므로 단축키는 물리 키(e.code)로 본다
    const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      select({ r: focus.r + dr, c: focus.c + dc }, e.shiftKey);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (e.key === 'Enter') select({ r: focus.r + (e.shiftKey ? -1 : 1), c: focus.c });
      else select({ r: focus.r, c: focus.c + (e.shiftKey ? -1 : 1) });
    } else if (e.key === 'F2') {
      e.preventDefault();
      startEdit(focusCell);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearRange();
    } else if (ctrl && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (ctrl && key === 'y') {
      e.preventDefault();
      redo();
    } else if (ctrl && key === 'c') {
      copyRange();
    } else if (design && ctrl && (key === 'b' || key === 'i' || key === 'u')) {
      e.preventDefault();
      toggle(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
    } else if (!ctrl && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      startEdit(focusCell, e.key);
    }
  };

  const onGridPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const at = anchorOf({ r: range.r1, c: range.c1 });
    const fn =
      paste ??
      (design
        ? pasteTsv
        : (s: Sheet, r: number, c: number, t: string) => pasteTsv(s, r, c, t, { grow: false, canWrite: (rr, cc) => !canEditCell || canEditCell(s, rr, cc) }));
    update((s) => fn(s, at.r, at.c, text));
  };

  const onEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'Enter' && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      commitEdit({ dr: 1, dc: 0 });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit({ dr: 0, dc: e.shiftKey ? -1 : 1 });
    }
  };

  // ── 마우스 ─────────────────────────────────────────────
  const onCellMouseDown = (e: MouseEvent, cell: Cell) => {
    if (e.button !== 0) return;
    setHeaderMenu(null);
    setPopover(null);
    if (isPicking && editing && !(editing.r === cell.r && editing.c === cell.c)) {
      // 엑셀과 같게 — 커서 바로 앞이 연산 기호·괄호·쉼표면 누른 칸 주소를 넣고, 방금 눌러 넣은 주소 바로 뒤면 그 주소를 바꾼다.
      // 그 밖(=A1 끝에 커서 등)이면 수식 고치기를 끝내고 누른 칸으로 옮긴다(아래)
      const mode = refExpected();
      if (mode) {
        e.preventDefault();
        dragRef.current = 'pick';
        if (mode === 'replace' && pickRef.current) pickRef.current = { ...pickRef.current, start: cell };
        else pickRef.current = null;
        pickCell(cell, mode === 'replace');
        return;
      }
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

  /** 열 너비·행 높이 끌기 — 끝날 때 한 번만 기록(되돌리기 한 번에 되돌아감) */
  const startResize = (e: MouseEvent, kind: 'col' | 'row', key: string, startSize: number) => {
    e.preventDefault();
    e.stopPropagation();
    const start = kind === 'col' ? e.clientX : e.clientY;
    // 화면 크기 배율(CSS zoom — 글자 크기 설정)만큼 마우스 거리가 커져 있다 — 배치 단위로 되돌린다.
    // 안 그러면 끄는 거리보다 칸이 배율만큼 더 늘어 경계선이 마우스(조절 손잡이)를 앞질러 간다
    const grid = gridRef.current;
    const scale = grid && grid.offsetWidth > 0 ? grid.getBoundingClientRect().width / grid.offsetWidth : 1;
    const base = value;
    let latest = value;
    const move = (ev: globalThis.MouseEvent) => {
      const moved = ((kind === 'col' ? ev.clientX : ev.clientY) - start) / (scale || 1);
      const size = Math.max(kind === 'col' ? 24 : 16, Math.round(startSize + moved));
      latest = kind === 'col' ? { ...base, colWidths: { ...base.colWidths, [key]: size } } : { ...base, rowHeights: { ...base.rowHeights, [key]: size } };
      emit(latest);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (latest !== base) {
        undoStack.current = [...undoStack.current.slice(-(HISTORY_LIMIT - 1)), base];
        redoStack.current = [];
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const colW = (col: string) => value.colWidths[col] ?? DEFAULT_COL_WIDTH;
  const rowH = (r: number) => value.rowHeights[String(r)] ?? DEFAULT_ROW_HEIGHT;

  // ── 화면 ───────────────────────────────────────────────
  const btn = (active = false) =>
    `inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border px-2 text-[11.5px] font-semibold transition-colors ${
      active ? 'border-teal bg-teal-soft/60 text-teal' : 'border-border bg-white text-ink hover:border-teal hover:text-teal'
    }`;
  const sep = <span className="mx-0.5 h-5 w-px bg-border" />;

  const palette = (kind: 'color' | 'bg') => (
    <div className="absolute left-0 top-full z-30 mt-1 w-[196px] rounded-lg border border-border bg-white p-2 shadow-lg">
      <div className="grid grid-cols-5 gap-1.5">
        {SHEET_COLORS.map((p) => (
          <button
            key={p.label}
            type="button"
            title={p.label}
            onClick={() => {
              style(kind === 'color' ? { color: p.text } : { bg: p.bg });
              setPopover(null);
            }}
            className="h-6 w-6 rounded border border-black/10"
            style={{ background: kind === 'color' ? p.text : p.bg }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <input
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value.trim())}
          placeholder="#1f4e79"
          aria-label="직접 색 지정"
          className="h-7 min-w-0 flex-1 rounded border border-border px-1.5 font-mono text-[11px] outline-none focus:border-teal"
        />
        <button
          type="button"
          className={btn()}
          onClick={() => {
            if (!/^#[0-9a-f]{6}$/i.test(customColor)) {
              onNotice?.('색은 #rrggbb 형식으로 입력하세요.');
              return;
            }
            style(kind === 'color' ? { color: customColor.toLowerCase() } : { bg: customColor.toLowerCase() });
            setPopover(null);
          }}
        >
          적용
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          style(kind === 'color' ? { color: undefined } : { bg: undefined });
          setPopover(null);
        }}
        className="mt-2 w-full rounded border border-border py-1 text-[11px] text-ink3 hover:text-ink"
      >
        {kind === 'color' ? '기본 글자색' : '배경색 없음'}
      </button>
    </div>
  );

  const barValue = editing ? draft : rawOf(focusCell.r, focusCell.c);
  const totalWidth = hw + cols.reduce((sum, col) => sum + colW(col), 0);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-white" style={{ height }}>
      {design && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-panel-alt/40 px-2 py-1.5">
          <button type="button" className={btn()} onClick={undo} disabled={undoStack.current.length === 0} title="되돌리기 (Ctrl+Z)">
            ↶
          </button>
          <button type="button" className={btn()} onClick={redo} disabled={redoStack.current.length === 0} title="다시 실행 (Ctrl+Y)">
            ↷
          </button>
          {sep}
          <button type="button" className={`${btn(!!focusStyle?.bold)} font-bold`} onClick={() => toggle('bold')} title="굵게 (Ctrl+B)">
            가
          </button>
          <button type="button" className={`${btn(!!focusStyle?.italic)} italic`} onClick={() => toggle('italic')} title="기울임 (Ctrl+I)">
            가
          </button>
          <button type="button" className={`${btn(!!focusStyle?.underline)} underline`} onClick={() => toggle('underline')} title="밑줄 (Ctrl+U)">
            가
          </button>
          <button
            type="button"
            className={`${btn(!!focusStyle?.shrink)} text-[10.5px]`}
            onClick={() => toggle('shrink')}
            title="셀에 맞춤 — 한 줄 글이 칸보다 길면 글씨를 줄여 칸에 맞춥니다(줄바꿈이 든 글은 제외, 엑셀과 같음)"
          >
            맞춤
          </button>
          <select
            value={focusStyle?.fontSize ?? ''}
            onChange={(e) => style({ fontSize: e.target.value ? Number(e.target.value) : undefined })}
            title="글자 크기(pt)"
            className="h-7 rounded-md border border-border bg-white px-1 text-[11.5px]"
          >
            <option value="">기본</option>
            {FONT_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="relative">
            <button type="button" className={btn(popover === 'color')} onClick={() => setPopover(popover === 'color' ? null : 'color')} title="글자색">
              <span className="border-b-2 border-rose-600 leading-none">가</span> ▾
            </button>
            {popover === 'color' && palette('color')}
          </div>
          <div className="relative">
            <button type="button" className={btn(popover === 'bg')} onClick={() => setPopover(popover === 'bg' ? null : 'bg')} title="배경색">
              <span className="rounded-sm bg-amber-200 px-1 leading-none">가</span> ▾
            </button>
            {popover === 'bg' && palette('bg')}
          </div>
          {sep}
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} type="button" className={btn(focusStyle?.align === a)} onClick={() => style({ align: a })} title={{ left: '왼쪽', center: '가운데', right: '오른쪽' }[a] + ' 정렬'}>
              {{ left: '⫷', center: '≡', right: '⫸' }[a]}
            </button>
          ))}
          {(['top', 'middle', 'bottom'] as const).map((v) => (
            <button key={v} type="button" className={btn(focusStyle?.valign === v)} onClick={() => style({ valign: v })} title={{ top: '위', middle: '가운데', bottom: '아래' }[v] + ' 맞춤'}>
              {{ top: '⤒', middle: '⇕', bottom: '⤓' }[v]}
            </button>
          ))}
          {sep}
          <div className="relative">
            <button type="button" className={btn(popover === 'numFmt')} onClick={() => setPopover(popover === 'numFmt' ? null : 'numFmt')}>
              숫자 ▾
            </button>
            {popover === 'numFmt' && (
              <div className="absolute left-0 top-full z-30 mt-1 w-[140px] rounded-lg border border-border bg-white py-1 shadow-lg">
                {NUM_FORMATS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      style({ numFmt: f.key === 'general' ? undefined : f.key });
                      setPopover(null);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-[11.5px] text-ink hover:bg-teal-soft/40"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" className={btn(popover === 'border')} onClick={() => setPopover(popover === 'border' ? null : 'border')}>
              테두리 ▾
            </button>
            {popover === 'border' && (
              <div className="absolute left-0 top-full z-30 mt-1 w-[210px] rounded-lg border border-border bg-white p-1.5 shadow-lg">
                <div className="grid grid-cols-[1fr_52px_52px] items-center gap-x-1 gap-y-0.5 text-[11.5px]">
                  <span />
                  <span className="text-center text-[10.5px] font-semibold text-ink3">일반</span>
                  <span className="text-center text-[10.5px] font-semibold text-ink3">굵게</span>
                  {BORDER_PRESETS.map((b) => (
                    <Fragment key={b.preset}>
                      <span className="px-1 text-ink">{b.label}</span>
                      {(['thin', 'thick'] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          title={`${b.label} — ${w === 'thin' ? '일반' : '굵게'}`}
                          onClick={() => {
                            update((s) => applyBorder(s, range, b.preset, w));
                            setPopover(null);
                          }}
                          className="grid h-6 place-items-center rounded border border-border hover:border-teal hover:bg-teal-soft/40"
                        >
                          <span className={`block w-6 bg-ink ${w === 'thin' ? 'h-px' : 'h-[3px]'}`} />
                        </button>
                      ))}
                    </Fragment>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    update((s) => applyBorder(s, range, 'none'));
                    setPopover(null);
                  }}
                  className="mt-1.5 block w-full rounded border-t border-border px-2 pt-1.5 text-left text-[11.5px] text-ink hover:bg-teal-soft/40"
                >
                  테두리 없음
                </button>
              </div>
            )}
          </div>
          {sep}
          <button type="button" className={btn()} onClick={merge} title="셀 병합">
            병합
          </button>
          <button type="button" className={btn()} onClick={() => update((s) => unmergeRange(s, range))} title="병합 해제 — 고른 범위에 걸친 병합을 모두 풂">
            해제
          </button>
          {sep}
          <button type="button" className={btn()} onClick={() => update((s) => insertRow(s, range.r2 + 1))}>
            + 행
          </button>
          <button type="button" className={btn()} onClick={() => update((s) => insertCol(s, range.c2 + 1))}>
            + 열
          </button>
          <button type="button" className={btn()} onClick={() => removeRows(range.r1, range.r2)} disabled={rows.length <= 1}>
            행 삭제
          </button>
          <button type="button" className={btn()} onClick={() => removeCols(range.c1, range.c2)} disabled={cols.length <= 1}>
            열 삭제
          </button>
          {toolbarExtra && (
            <>
              {sep}
              {toolbarExtra}
            </>
          )}
        </div>
      )}

      {/* 수식 입력줄 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1">
        <div className="w-[72px] shrink-0 rounded border border-border bg-panel px-1.5 py-0.5 text-center font-mono text-[11.5px] font-bold text-ink">
          {editing ? addr(editing.r, editing.c) : rangeLabel(range)}
        </div>
        <span className="shrink-0 font-serif text-[12px] italic text-ink3">fx</span>
        <input
          ref={barInputRef}
          value={barValue}
          readOnly={!editable(focusCell)}
          onFocus={() => {
            if (!editing && editable(focusCell)) startEdit(focusCell, undefined, 'bar');
            else setEditSource('bar');
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            caretRef.current = e.target.selectionStart ?? e.target.value.length;
            pickRef.current = null;
          }}
          onSelect={(e) => (caretRef.current = (e.target as HTMLInputElement).selectionStart ?? 0)}
          onKeyDown={onEditorKeyDown}
          className="min-w-0 flex-1 rounded border border-border px-2 py-0.5 font-mono text-[12px] text-ink outline-none focus:border-teal read-only:bg-panel-alt/50"
        />
        {design && (
          <div className="flex shrink-0 items-center gap-1">
            {HELPERS.map((h) => (
              <button key={h.label} type="button" title={h.title} onMouseDown={(e) => e.preventDefault()} onClick={() => insertText(h.insert)} className={btn()}>
                {h.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 격자 — 열 머리(A·B·C) 아래 선과 행 번호 칸 오른쪽 선은 없앤다: 같은 굵기 테두리가 겹치면 위·왼쪽 칸 선이 이겨
          맨 위 행·A열의 서식 테두리가 머리 칸의 연회색 선에 가려지기 때문 */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        onPaste={onGridPaste}
        className={`relative min-h-0 flex-1 overflow-auto outline-none ${paper ? 'bg-[#878d90] p-4' : 'bg-[#f7f7f8]'}`}
      >
        {(() => {
          const table = (
        <table
          className={`border-collapse bg-white text-[12px] ${editing ? '' : 'select-none'}`}
          // 종이 보기 — 가는 띠는 종이 여백에 걸치고, 시트 첫 열·첫 행이 문서 본문 가장자리에 맞게
          style={{ tableLayout: 'fixed', width: totalWidth, ...(paper ? { marginLeft: -hw, marginTop: -hh } : {}) }}
        >
          <colgroup>
            <col style={{ width: hw }} />
            {cols.map((col) => (
              <col key={col} style={{ width: colW(col) }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ height: hh }}>
              <th className={paper ? 'p-0' : 'sticky left-0 top-0 z-[3] border border-[#d0d0d0] bg-[#eef0f2]'} />
              {cols.map((col, c) => (
                <th
                  key={col}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    if (editing) commitEdit();
                    // Shift — 고른 열부터 여기까지 (엑셀과 같음)
                    setAnchor((a) => (e.shiftKey ? { r: 0, c: a.c } : { r: 0, c }));
                    setFocus({ r: rows.length - 1, c });
                    focusGrid();
                  }}
                  onContextMenu={(e) => {
                    if (!design) return;
                    e.preventDefault();
                    setHeaderMenu({ kind: 'col', idx: c, x: e.clientX, y: e.clientY });
                  }}
                  title={paper ? `${colLetter(c)}열 — 눌러 열 고르기, 오른쪽 끝을 끌어 너비 바꾸기` : undefined}
                  className={
                    paper
                      ? `relative select-none p-0 ${c >= range.c1 && c <= range.c2 ? 'bg-teal/50' : 'bg-transparent hover:bg-[#d0d0d0]'}`
                      : `sticky top-0 z-[2] select-none border border-b-0 border-[#d0d0d0] [background-clip:padding-box] text-center text-[11px] font-semibold ${
                          c >= range.c1 && c <= range.c2 ? 'bg-teal-soft text-teal' : 'bg-[#eef0f2] text-[#666]'
                        }`
                  }
                >
                  {/* 종이 보기는 띠(th)에 맞춰 끝에 손잡이 — 글자 없는 div 기준이면 띠 가운데에 와서 고르기를 가로챔 */}
                  <div className={paper ? undefined : "relative"}>
                    {!paper && colLetter(c)}
                    {design && (
                      <span
                        onMouseDown={(e) => startResize(e, 'col', col, colW(col))}
                        className={`absolute -right-1 w-2 cursor-col-resize hover:bg-teal/40 ${paper ? 'top-0 h-[10px]' : 'top-[-4px] h-[24px]'}`}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((_row, r) => (
              <tr key={r} style={{ height: rowH(r) }}>
                <th
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    if (editing) commitEdit();
                    // Shift — 고른 행부터 여기까지 (엑셀과 같음)
                    setAnchor((a) => (e.shiftKey ? { r: a.r, c: 0 } : { r, c: 0 }));
                    setFocus({ r, c: cols.length - 1 });
                    focusGrid();
                  }}
                  onContextMenu={(e) => {
                    if (!design) return;
                    e.preventDefault();
                    setHeaderMenu({ kind: 'row', idx: r, x: e.clientX, y: e.clientY });
                  }}
                  title={paper ? `${r + 1}행 — 눌러 행 고르기, 아래 끝을 끌어 높이 바꾸기` : undefined}
                  className={
                    paper
                      ? `relative select-none p-0 ${r >= range.r1 && r <= range.r2 ? 'bg-teal/50' : 'bg-transparent hover:bg-[#d0d0d0]'}`
                      : `sticky left-0 z-[1] select-none border border-r-0 border-[#d0d0d0] [background-clip:padding-box] p-0 text-center text-[11px] font-semibold ${
                          r >= range.r1 && r <= range.r2 ? 'bg-teal-soft text-teal' : 'bg-[#eef0f2] text-[#666]'
                        }`
                  }
                >
                  {/* 손잡이는 행 머리 칸(th — 종이 보기 relative, 격자 보기 sticky 라 둘 다 위치 기준) 아래 끝에.
                      행 번호 글자 상자(div) 기준이면 행을 늘렸을 때 손잡이가 칸 가운데(글자 아래)에 남는다 */}
                  <div>
                    {!paper && r + 1}
                    {design && (
                      <span
                        onMouseDown={(e) => startResize(e, 'row', String(r), rowH(r))}
                        className="absolute -bottom-1 left-0 h-2 w-full cursor-row-resize hover:bg-teal/40"
                      />
                    )}
                  </div>
                </th>
                {cols.map((col, c) => {
                  const m = mergeAt(r, c);
                  if (m && (m.startRow !== r || m.startCol !== c)) return null;
                  const key = `${r}:${col}`;
                  const isEditing = editing?.r === r && editing?.c === c;
                  const selected = inRange(range, r, c);
                  const isFocus = focusCell.r === r && focusCell.c === c;
                  const isPicked = picked ? inRange(picked, r, c) : false;
                  const locked = !design && !editable({ r, c });
                  return (
                    <td
                      key={col}
                      data-cell={`${r}:${c}`}
                      rowSpan={m && m.rowSpan > 1 ? m.rowSpan : undefined}
                      colSpan={m && m.colSpan > 1 ? m.colSpan : undefined}
                      onMouseDown={(e) => onCellMouseDown(e, { r, c })}
                      onMouseEnter={() => onCellMouseEnter({ r, c })}
                      onDoubleClick={() => startEdit({ r, c })}
                      className={`relative overflow-hidden border ${paper ? 'border-dashed border-[#dcdcdc]' : 'border-[#e2e2e2]'} px-1 align-middle whitespace-pre-wrap break-words text-[#222] ${
                        !design && !locked ? 'cursor-text' : ''
                      }`}
                      style={{
                        textAlign: defaultAlign(computed, r, col),
                        ...cellCss(renderStyle(value, r, c, m?.rowSpan, m?.colSpan)),
                        // 배경은 칸 안쪽만 칠한다 — 칸에 위치 지정(relative)이 있으면 크롬이 배경을 이웃 칸과 맞닿은
                        // 테두리 위에까지 칠해 선이 군데군데 사라진다(배경색 칸 둘레)
                        backgroundClip: 'padding-box',
                        ...(() => {
                          // 셀에 맞춤 — 칸(병합 폭)보다 긴 한 줄 글은 글씨를 줄인다
                          const w = cols.slice(c, c + (m?.colSpan ?? 1)).reduce((sum, k) => sum + colW(k), 0);
                          const size = shrinkFontSize(displayValue(computed, r, col), value.styles[key], w);
                          return size ? { fontSize: size, whiteSpace: 'nowrap' as const } : {};
                        })(),
                        ...(isFocus && !isEditing ? { outline: '2px solid var(--color-teal, #0f766e)', outlineOffset: '-2px' } : {}),
                        ...(isPicked ? { outline: '2px dashed #2563eb', outlineOffset: '-2px' } : {}),
                        ...(!design && !locked ? { backgroundColor: value.styles[key]?.bg ?? '#fffdf0' } : {}),
                      }}
                    >
                      {isEditing && editSource === 'cell' ? null : (
                        <>
                          {isEditing ? draft : displayValue(computed, r, col)}
                          {renderBadge?.(r, c)}
                          {selected && multiSelected && (
                            // 여러 칸 선택 — 칸 배경색 위에 덧칠하고, 범위 바깥 테두리를 진하게(배경색 있는 칸에서도 보이게)
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 z-[1]"
                              style={{
                                backgroundColor: 'rgba(15, 118, 110, 0.14)',
                                // 바깥 가장자리는 굵게, 안쪽 칸 경계는 가늘게 — 덧칠에 격자선이 묻히지 않게
                                boxShadow: [
                                  r === range.r1 ? 'inset 0 2px 0 #0f766e' : '',
                                  r + (m?.rowSpan ?? 1) - 1 >= range.r2 ? 'inset 0 -2px 0 #0f766e' : 'inset 0 -1px 0 rgba(15, 118, 110, 0.55)',
                                  c === range.c1 ? 'inset 2px 0 0 #0f766e' : '',
                                  c + (m?.colSpan ?? 1) - 1 >= range.c2 ? 'inset -2px 0 0 #0f766e' : 'inset -1px 0 0 rgba(15, 118, 110, 0.55)',
                                ]
                                  .filter(Boolean)
                                  .join(', ') || undefined,
                              }}
                            />
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
          );
          return paper ? paper(table) : table;
        })()}
        {editing && editSource === 'cell' && editBox && (
          // 엑셀처럼 칸을 넘는 글은 오른쪽으로 넓어지고, 시트 끝에 닿으면 줄을 바꿔 아래로 늘어난다(다른 칸 위에 뜸)
          <textarea
            ref={cellInputRef}
            value={draft}
            rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              caretRef.current = e.target.selectionStart ?? e.target.value.length;
              pickRef.current = null;
            }}
            onSelect={(e) => (caretRef.current = (e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onKeyDown={onEditorKeyDown}
            className="absolute z-[5] resize-none overflow-hidden bg-white px-1 text-[#222] shadow-md outline-2 outline-teal"
            style={{
              left: editBox.left,
              top: editBox.top,
              minWidth: editBox.width,
              minHeight: editBox.height,
              fontSize: editBox.fontSize,
              fontWeight: editBox.fontWeight,
              lineHeight: 1.35,
            }}
          />
        )}
        {guideWidth !== undefined && !paper && (
          <div
            aria-hidden
            title="인쇄 폭"
            className="pointer-events-none absolute top-0 z-[4] border-l-2 border-dashed border-rose-400/70"
            style={{ left: hw + guideWidth, height: '100%' }}
          />
        )}

        {headerMenu && (
          <div
            className="fixed z-40 w-[150px] rounded-lg border border-border bg-white py-1 text-[11.5px] shadow-lg"
            style={{ left: headerMenu.x, top: headerMenu.y }}
            onMouseLeave={() => setHeaderMenu(null)}
          >
            {(headerMenu.kind === 'row'
              ? [
                  { label: '위에 행 삽입', run: () => update((s) => insertRow(s, headerMenu.idx)) },
                  { label: '아래에 행 삽입', run: () => update((s) => insertRow(s, headerMenu.idx + 1)) },
                  { label: '행 삭제', run: () => removeRows(headerMenu.idx, headerMenu.idx) },
                ]
              : [
                  { label: '왼쪽에 열 삽입', run: () => update((s) => insertCol(s, headerMenu.idx)) },
                  { label: '오른쪽에 열 삽입', run: () => update((s) => insertCol(s, headerMenu.idx + 1)) },
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
                className="block w-full px-3 py-1.5 text-left text-ink hover:bg-teal-soft/40"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
