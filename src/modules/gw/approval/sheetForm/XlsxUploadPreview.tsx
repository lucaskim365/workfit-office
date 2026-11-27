import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import { SheetView, displayValue, type Sheet } from '@/lib/sheet';
import { DOC_SHEET_VIEW, applyValues, type SheetValues } from '@/domain/approvalForm/sheet/approvalSheet';
import { repeatSections } from '@/domain/approvalForm/sheet/repeatRows';
import { pickXlsxValues, xlsxChanges, type XlsxCellChange, type XlsxChangeKind } from '@/domain/approvalForm/sheet/xlsxPreview';

/** 올린 엑셀을 얹은 결과 — 올리기 계산(draftExcel·listExcel)이 돌려준 것 그대로 */
export interface XlsxUploadResult {
  fileName: string;
  /** 새 줄 수로 펼친 틀 */
  shape: Sheet;
  /** 엑셀 값을 얹기 전(화면 값)과 얹은 뒤 */
  base: SheetValues;
  baseRefs: SheetValues;
  values: SheetValues;
  refs: SheetValues;
  /** 무엇을 어떻게 받았는지(줄 수·맞춘 열 등) */
  summary: string[];
  /** 받지 못했거나 알아 둘 것 */
  notes: string[];
}

/**
 * 칸 색 — 여기 color 값만 고치면 범례와 칸이 같이 바뀐다(CSS 색 표기면 무엇이든: hsl(색 선명함 밝기)·#rrggbb).
 * 색을 클래스 이름에 넣지 않고 CSS 변수로 넘긴다 — 클래스에 넣으면 값을 바꿀 때마다 스타일을 새로 만들어야 해서 개발 중 반영이 어긋난다.
 * '바뀜'은 입력 칸 바탕(옅은 노랑)과 헷갈리지 않게 귤색
 */
const KINDS: { kind: XlsxChangeKind; label: string; hint: string; color: string; cell: string }[] = [
  { kind: 'add', label: '채움', hint: '빈 칸에 새로 들어가는 값', color: 'hsla(132, 100%, 85%, 0.5)', cell: '!bg-[color:var(--xlsx-add)]' },
  { kind: 'change', label: '바뀜', hint: '있던 값이 엑셀 값으로 바뀌는 칸', color: 'hsla(38, 100%, 87%, 0.6)', cell: '!bg-[color:var(--xlsx-change)]' },
  { kind: 'clear', label: '지워짐', hint: '있던 값이 지워지는 칸', color: 'hsla(348, 100%, 91%, 0.7)', cell: '!bg-[color:var(--xlsx-clear)]' },
];
const CELL_CLASS = Object.fromEntries(KINDS.map((k) => [k.kind, k.cell])) as Record<XlsxChangeKind, string>;
const COLOR_VARS = Object.fromEntries(KINDS.map((k) => [`--xlsx-${k.kind}`, k.color])) as CSSProperties;
/** 적용하지 않기로 한 칸 — 화면 값 그대로(점선 테두리). 칸 색은 배경색으로 — 칸마다 큰 그림자를 쓰면 스크롤이 무겁다 */
/** 누르면 그 열을 통째로 빼거나 넣는 머리글 칸 */
const HEAD_CLASS = 'cursor-pointer select-none hover:!bg-[#e8eefc]';
const EXCLUDED_CLASS = 'outline-dashed outline-2 -outline-offset-2 outline-[#888]';

/**
 * 엑셀 올리기 미리보기 — 적용한 뒤의 서식 모습에 바뀌는 칸을 색으로 보이고, 칸을 누르거나 끌어서(열 제목을 누르면 열째로) 적용할 칸을 고른다.
 * [적용]을 누르기 전에는 문서를 건드리지 않는다
 */
export function XlsxUploadPreview({
  result,
  skipNames,
  hiddenRowsOf,
  settle,
  renderHead,
  onApply,
  onClose,
}: {
  result: XlsxUploadResult;
  /** 엑셀로 받지 않는 이름 붙은 칸 */
  skipNames: readonly string[];
  /** 작성 화면에서 숨는 줄(조건으로 숨은 행 등) */
  hiddenRowsOf: (s: Sheet) => Set<number>;
  /** 문서에 남기기 전 정리(조건으로 숨은 행·종속 선택 칸 비우기)까지 한 모습 — [적용] 결과와 같게 */
  settle: (s: Sheet) => Sheet;
  /** 작성 화면이 따로 그리는 칸(문서 제목·기안자 등) — 그 밖의 칸은 undefined */
  renderHead: (s: Sheet, r: number, c: number) => ReactNode | undefined;
  onApply: (values: SheetValues, refs: SheetValues) => void;
  onClose: () => void;
}) {
  const { shape, base, baseRefs, values, refs } = result;
  // 숨은 행의 칸은 [적용]하면 비워지므로 바뀌는 칸으로 세지 않는다
  const changes = useMemo(() => {
    const hidden = hiddenRowsOf(settle(applyValues(shape, values, { recalc: true })));
    return xlsxChanges({ shape, base, values, skipNames }).filter((ch) => !hidden.has(ch.r));
    // 창이 떠 있는 동안 바깥 값은 바뀌지 않는다 — 올린 결과가 바뀔 때만 다시 센다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, base, values, skipNames]);
  const byCell = useMemo(() => new Map<string, XlsxCellChange>(changes.map((ch) => [`${ch.r}:${ch.c}`, ch])), [changes]);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const picked = useMemo(() => pickXlsxValues({ base, baseRefs, values, refs, excluded }), [base, baseRefs, values, refs, excluded]);
  // 적용한 뒤의 모습 — 합계 등 수식도 다시 계산해 보인다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => settle(applyValues(shape, picked.values, { recalc: true })), [shape, picked.values]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hiddenRows = useMemo(() => hiddenRowsOf(shown), [shown]);

  const boxRef = useRef<HTMLDivElement>(null);
  // 바뀌는 첫 칸이 보이게
  const firstCell = changes[0] ? `${changes[0].r}:${changes[0].c}` : '';
  useEffect(() => {
    if (firstCell) boxRef.current?.querySelector(`td[data-sheet-cell="${firstCell}"]`)?.scrollIntoView({ block: 'center' });
  }, [firstCell]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /**
   * 열 머리글 — 바뀌는 칸들이 세로로 이어진 묶음 위의 글자 칸('행:열' → 그 아래 바뀌는 칸들).
   * 누르면 그 열을 통째로 빼거나 넣는다. 머리글이 여러 열을 합친 칸이면 그 아래 열들을 모두
   */
  const columnHeads = useMemo(() => {
    const out = new Map<string, string[]>();
    const sections = repeatSections(shape);
    const anchorOf = (r: number, c: number) => {
      const m = shape.merges.find((x) => r >= x.startRow && r < x.startRow + x.rowSpan && c >= x.startCol && c < x.startCol + x.colSpan);
      return m ? { r: m.startRow, c: m.startCol } : { r, c };
    };
    for (const ch of changes) {
      // 묶음의 맨 위 칸에서만 위로 올라가 머리글을 찾는다
      if (byCell.has(`${ch.r - 1}:${ch.c}`)) continue;
      // 표(반복 구간) 안의 칸이면 표 바로 위 줄이 머리글 — 표 가운데부터 바뀌어도(늘어난 줄의 번호 등) 위의 내용 칸을 머리글로 잡지 않는다
      const sec = sections.find((x) => ch.r >= x.first && ch.r <= x.last);
      const above = (sec ? sec.first : ch.r) - 1;
      const head = above >= 0 ? anchorOf(above, ch.c) : null;
      if (!head || byCell.has(`${head.r}:${head.c}`) || String(shape.rows[head.r]?.[shape.cols[head.c]] ?? '').trim() === '') continue;
      const keys = out.get(`${head.r}:${head.c}`) ?? [];
      for (let r = ch.r; byCell.has(`${r}:${ch.c}`); r++) keys.push(byCell.get(`${r}:${ch.c}`)!.key);
      out.set(`${head.r}:${head.c}`, keys);
    }
    return out;
  }, [changes, byCell, shape]);

  // 고르기 — 누르면 그 칸을 빼거나 넣고, 끌면 지나간 네모 안의 칸을 같은 쪽으로, Shift+누르기는 앞서 누른 칸부터 이 칸까지
  const drag = useRef<{ from: { r: number; c: number }; start: ReadonlySet<string>; exclude: boolean } | null>(null);
  const lastPick = useRef<{ r: number; c: number; exclude: boolean } | null>(null);
  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  const cellAt = (target: EventTarget) => {
    const id = (target as HTMLElement).closest<HTMLElement>('td[data-sheet-cell]')?.dataset.sheetCell;
    if (!id) return null;
    const [r, c] = id.split(':').map(Number);
    return { id, r, c };
  };
  /** 두 칸을 모서리로 하는 네모 안의 바뀌는 칸을 모두 빼거나(exclude) 넣은 것 */
  const withRect = (start: ReadonlySet<string>, a: { r: number; c: number }, b: { r: number; c: number }, exclude: boolean) => {
    const next = new Set(start);
    const [r1, r2, c1, c2] = [Math.min(a.r, b.r), Math.max(a.r, b.r), Math.min(a.c, b.c), Math.max(a.c, b.c)];
    for (const ch of changes) {
      if (ch.r < r1 || ch.r > r2 || ch.c < c1 || ch.c > c2) continue;
      if (exclude) next.add(ch.key);
      else next.delete(ch.key);
    }
    return next;
  };
  const onPickStart = (e: ReactMouseEvent) => {
    const cell = e.button === 0 ? cellAt(e.target) : null;
    if (!cell) return;
    const ch = byCell.get(cell.id);
    if (!ch) {
      // 열 머리글 — 그 열에 적용할 칸이 하나라도 있으면 모두 빼고, 다 빠져 있으면 모두 넣는다
      const keys = columnHeads.get(cell.id);
      if (!keys) return;
      const exclude = keys.some((k) => !excluded.has(k));
      const next = new Set(excluded);
      keys.forEach((k) => (exclude ? next.add(k) : next.delete(k)));
      return setExcluded(next);
    }
    // 끄는 동안 글자가 선택되지 않게
    e.preventDefault();
    if (e.shiftKey && lastPick.current) return setExcluded(withRect(excluded, lastPick.current, cell, lastPick.current.exclude));
    const exclude = !excluded.has(ch.key);
    drag.current = { from: cell, start: excluded, exclude };
    lastPick.current = { r: cell.r, c: cell.c, exclude };
    setExcluded(withRect(excluded, cell, cell, exclude));
  };
  const onPickMove = (e: ReactMouseEvent) => {
    const d = drag.current;
    const cell = d ? cellAt(e.target) : null;
    if (d && cell) setExcluded(withRect(d.start, d.from, cell, d.exclude));
  };
  const countOf = (kind: XlsxChangeKind) => changes.filter((ch) => ch.kind === kind && !excluded.has(ch.key)).length;
  const applying = changes.length - excluded.size;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 print:hidden" onClick={onClose}>
      <div
        className="flex max-h-[calc(92vh/var(--font-scale,1))] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[14px] font-extrabold text-ink">
            <FileSpreadsheet size={16} className="shrink-0 text-teal" />
            <span className="shrink-0">엑셀 올리기 미리보기</span>
            <span className="truncate text-[11.5px] font-normal text-ink3">{result.fileName}</span>
          </div>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-ink3 hover:bg-panel-alt" title="닫기">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1.5 border-b border-border bg-panel-alt/30 px-5 py-2.5 text-[11.5px] text-ink2">
          {result.summary.map((line) => (
            <div key={line}>{line}</div>
          ))}
          {result.notes.length > 0 && (
            <ul className="list-disc rounded-lg border border-amber-500/40 bg-amber-500/10 py-1.5 pl-6 pr-3 text-[12px] leading-relaxed text-ink">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {KINDS.map((k) => (
              <span key={k.kind} className="flex items-center gap-1" title={k.hint}>
                <span className="inline-block h-3 w-3 rounded-sm border border-black/10" style={{ backgroundColor: k.color }} />
                {k.label} {countOf(k.kind)}칸
              </span>
            ))}
            {excluded.size > 0 && (
              <span className="flex items-center gap-1" title="적용하지 않고 화면 값 그대로 두는 칸">
                <span className="inline-block h-3 w-3 rounded-sm border-2 border-[#888] bg-white" />
                적용 안 함 {excluded.size}칸
              </span>
            )}
            {changes.length > 0 && (
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-ink3" title="Shift를 누른 채 누르면 앞서 누른 칸부터 그 칸까지 한 번에 고릅니다">칸을 누르거나 끌어서 뺄 칸을 고릅니다 · 열 제목을 누르면 그 열 전체</span>
                <button type="button" onClick={() => setExcluded(new Set())} className="rounded border border-border bg-white px-1.5 py-0.5 font-semibold hover:border-teal hover:text-teal">
                  모두 적용
                </button>
                <button
                  type="button"
                  onClick={() => setExcluded(new Set(changes.map((ch) => ch.key)))}
                  className="rounded border border-border bg-white px-1.5 py-0.5 font-semibold hover:border-teal hover:text-teal"
                >
                  모두 빼기
                </button>
              </span>
            )}
          </div>
        </div>

        {/* 서식은 늘 흰 종이 위에(어두운 화면에서도 문서 모양 그대로) */}
        <div
          ref={boxRef}
          // 스크롤 상자를 따로 그리는 층으로(transform-gpu·contain) — 스크롤할 때 뒤의 기안 화면·창 그림자까지 다시 그리지 않게.
          // overscroll-contain: 끝까지 내린 뒤 뒤쪽 기안 화면이 따라 움직이지 않게
          className="min-h-0 flex-1 transform-gpu overflow-auto overscroll-contain bg-white px-6 py-4 text-[12px] text-[#111] [contain:layout_paint]"
          style={COLOR_VARS}
          onMouseDown={onPickStart}
          onMouseOver={onPickMove}
        >
          <SheetView
            sheet={shown}
            stretchTo={DOC_SHEET_VIEW.stretchTo}
            thinBorderColor={DOC_SHEET_VIEW.thinBorderColor}
            hiddenRows={(r) => hiddenRows.has(r)}
            cellClassName={(r, c) => {
              const ch = byCell.get(`${r}:${c}`);
              if (!ch) return columnHeads.has(`${r}:${c}`) ? HEAD_CLASS : undefined;
              return `cursor-pointer select-none ${excluded.has(ch.key) ? EXCLUDED_CLASS : CELL_CLASS[ch.kind]}`;
            }}
            renderCell={(r, c) => {
              const head = renderHead(shown, r, c);
              if (head !== undefined) return head;
              const ch = byCell.get(`${r}:${c}`);
              if (!ch) return columnHeads.has(`${r}:${c}`) ? <span title="누르면 이 열을 통째로 빼거나 넣습니다">{displayValue(shown, r, shown.cols[c])}</span> : undefined;
              const off = excluded.has(ch.key);
              const tip = off ? `적용 안 함 — 화면 값 그대로${ch.after ? ` (엑셀 값: ${ch.after})` : ''}` : ch.kind === 'add' ? '새로 들어가는 값' : `이전 값: ${ch.before}`;
              // 지워지는 칸은 지워질 글자를 줄 그어 보인다
              if (!off && ch.kind === 'clear') return <span title={tip} className="text-rose-800/70 line-through">{ch.before}</span>;
              return <span title={tip}>{displayValue(shown, r, shown.cols[c])}</span>;
            }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-panel-alt/20 px-5 py-3">
          <span className="mr-auto text-[11px] text-ink3">[적용]을 누르기 전에는 문서가 바뀌지 않습니다.</span>
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3.5 py-1.5 text-[12px] font-bold text-ink2 hover:bg-panel-alt">
            취소
          </button>
          <button type="button" onClick={() => onApply(picked.values, picked.refs)} className="rounded-lg bg-teal px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90">
            {changes.length ? `${applying}칸 적용` : '적용'}
          </button>
        </div>
      </div>
    </div>
  );
}
