import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import { SheetView, displayValue, type Sheet } from '@/lib/sheet';
import { DOC_SHEET_VIEW, applyValues, type SheetValues } from '@/domain/approvalForm/sheet/approvalSheet';
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
const EXCLUDED_CLASS = 'outline-dashed outline-2 -outline-offset-2 outline-[#888]';

/**
 * 엑셀 올리기 미리보기 — 적용한 뒤의 서식 모습에 바뀌는 칸을 색으로 보이고, 칸을 눌러 적용할 칸을 고른다.
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

  const toggle = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
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
                <span className="text-ink3">색칠된 칸을 누르면 그 칸만 적용하지 않습니다</span>
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
          onClick={(e) => {
            const td = (e.target as HTMLElement).closest<HTMLElement>('td[data-sheet-cell]');
            const ch = td && byCell.get(td.dataset.sheetCell ?? '');
            if (ch) toggle(ch.key);
          }}
        >
          <SheetView
            sheet={shown}
            stretchTo={DOC_SHEET_VIEW.stretchTo}
            thinBorderColor={DOC_SHEET_VIEW.thinBorderColor}
            hiddenRows={(r) => hiddenRows.has(r)}
            cellClassName={(r, c) => {
              const ch = byCell.get(`${r}:${c}`);
              if (!ch) return undefined;
              return `cursor-pointer ${excluded.has(ch.key) ? EXCLUDED_CLASS : CELL_CLASS[ch.kind]}`;
            }}
            renderCell={(r, c) => {
              const head = renderHead(shown, r, c);
              if (head !== undefined) return head;
              const ch = byCell.get(`${r}:${c}`);
              if (!ch) return undefined;
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
