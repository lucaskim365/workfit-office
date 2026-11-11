import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ChevronDown, Eye, EyeOff, GripVertical, LayoutGrid, Undo2, X } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { arrange, CELL_GAP, CELL_H, GRID_COLS, PITCH, rowsHeight, TIER_COLS, TIER_LABEL, TIERS, type Tier, type WidgetSlot } from './dashboard';
import { DEFAULT_LAYOUT, defaultSizeOf, loadLayout, MODULES, placementsOf, rowsAt, rowsOf, snapToTiers, storageKey, tierOfSlot, WIDGET_IDS, WIDGETS, type WidgetId } from './registry';
import { WidgetTierProvider } from './widgets';

/**
 * 홈(경영 현황) — 로그인 후 첫 화면.
 * 화면은 모눈(가로 12칸, 세로 64px 칸)으로 나뉘고, 위젯은 늘 왼쪽 위로 붙는다(빈칸은 높이가 다른 위젯 옆에만).
 * 편집: 위젯은 끌어서 옮기고, 크기는 소(6칸, 대의 절반)·중(9칸)·대(12칸) 단추로 바꾼다. 높이는 모든 위젯이 같다.
 * 편집 띠의 '위젯 보관함'을 열면 화면 위에 떠서(모듈 → 위젯, 끌어서 옮기고 모듈별로 펴고 접기) 눈을 켜고 끈다. 닫으면 화면에는 놓인 위젯만 깔린다. 바꾼 것은 '적용'을 눌러야 저장되고, '취소'면 그대로 돌아간다.
 * 배치는 사용자별로 이 브라우저에 저장한다(데이터베이스는 건드리지 않는다).
 */

/** 미리보기를 그릴 실제 폭 — 이 폭으로 그린 뒤 줄여 보인다 */
const PREVIEW_WIDTH: Record<Tier, number> = { S: 620, M: 900, L: 1180 };
/** 위젯 보관함 폭 */
const LIBRARY_W = 264;
/** 보관함 미리보기 폭 */
const PREVIEW_BOX = 300;

const DRAG_NEW = 'application/x-workfit-widget';

/** 보관함에서 위젯에 커서를 올리면 옆에 뜨는 미리보기 — 실제 위젯을 기본 크기로 그려 줄여 보인다.
 *  보관함이 화면 오른쪽에 있으면 왼쪽에, 왼쪽에 있으면 오른쪽에 */
function WidgetPreview({ id, side }: { id: WidgetId; side: 'left' | 'right' }) {
  const def = WIDGETS[id];
  const tier = def.tier;
  const w = PREVIEW_WIDTH[tier];
  const zoom = PREVIEW_BOX / w;
  const h = rowsHeight(rowsAt(id, tier));
  return (
    <div
      className={`pointer-events-none absolute top-0 z-50 rounded-2xl border border-border bg-[var(--color-bg)] p-2 shadow-[0_16px_40px_-12px_rgba(16,40,80,.35)] ${side === 'left' ? 'right-full mr-3' : 'left-full ml-3'}`}
      aria-hidden="true"
    >
      <div className="overflow-hidden" style={{ width: PREVIEW_BOX, height: Math.round(h * zoom) }}>
        <div className="select-none" data-tier={tier} style={{ width: w, height: h, zoom }} inert>
          <WidgetTierProvider value={tier}><def.Component /></WidgetTierProvider>
        </div>
      </div>
      <div className="mt-1.5 px-1 text-[11px] font-bold text-ink3">{TIER_LABEL[tier]} 크기로 들어갑니다</div>
    </div>
  );
}

const LIB_POS_KEY = 'workfit.execDashboard.libraryPos';
const LIB_FOLD_KEY = 'workfit.execDashboard.libraryFold';
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 못 남겨도 그대로 쓴다 */ }
};

/**
 * 위젯 보관함 — 화면 위에 떠 있는 판. 머리를 끌어 아무 데나 옮기고(자리는 이 브라우저에 기억),
 * 모듈별로 펴고 접는다. 위젯 오른쪽 눈으로 홈에 보이기/숨기기, 숨긴 위젯은 끌어서 원하는 자리에 놓을 수도 있다.
 */
function WidgetLibrary({ layout, onToggle, onDragStart, onDragEnd, onClose }: {
  layout: WidgetSlot<WidgetId>[];
  onClose: () => void;
  onToggle: (id: WidgetId) => void;
  onDragStart: (id: WidgetId) => void;
  onDragEnd: () => void;
}) {
  const [hover, setHover] = useState<WidgetId | null>(null);
  const [folded, setFolded] = useState<string[]>(() => readJson<string[]>(LIB_FOLD_KEY, []));
  /** 판의 왼쪽 위(화면 배율을 걷어 낸 px). 없으면 오른쪽 기본 자리 */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => readJson<{ x: number; y: number } | null>(LIB_POS_KEY, null));
  const [moving, setMoving] = useState(false);
  const ref = useRef<HTMLElement>(null);
  /** 화면 배율 — 화면 좌표를 판 좌표로 */
  const scaleOf = () => {
    const el = ref.current;
    const r = el?.getBoundingClientRect();
    return el && r?.width ? el.offsetWidth / r.width : 1;
  };
  const viewport = () => {
    const k = scaleOf();
    return { w: window.innerWidth * k, h: window.innerHeight * k };
  };
  const clamp = (p: { x: number; y: number }) => {
    const el = ref.current;
    const { w, h } = viewport();
    return {
      x: Math.min(Math.max(8, p.x), w - (el?.offsetWidth ?? LIBRARY_W) - 8),
      y: Math.min(Math.max(8, p.y), h - 220),
    };
  };
  /** 화면에 남는 높이 — 판이 화면 아래로 빠져나가지 않게 */
  const [maxH, setMaxH] = useState<number | null>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    const k = scaleOf();
    const { h } = viewport();
    const top = el.getBoundingClientRect().top * k;
    setMaxH(Math.max(200, h - top - 16));
  };
  // 열 때마다(예전에 둔 자리가 지금 화면 밖이어도) 화면 안으로 들이고 높이를 맞춘다. 창 크기가 바뀔 때도
  useLayoutEffect(() => {
    setPos((p) => (p ? clamp(p) : p));
    const on = () => { setPos((p) => (p ? clamp(p) : p)); fit(); };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(fit, [pos]);

  /** 머리를 끌어 옮기기 */
  const startMove = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    const k = scaleOf();
    const r = el.getBoundingClientRect();
    const from = { x: r.left * k, y: r.top * k };
    const start = { x: e.clientX, y: e.clientY };
    let last = from;
    setMoving(true);
    setHover(null);
    const onMove = (ev: PointerEvent) => {
      last = clamp({ x: from.x + (ev.clientX - start.x) * k, y: from.y + (ev.clientY - start.y) * k });
      setPos(last);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setMoving(false);
      writeJson(LIB_POS_KEY, last);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const toggleFold = (m: string) =>
    setFolded((f) => {
      const next = f.includes(m) ? f.filter((x) => x !== m) : [...f, m];
      writeJson(LIB_FOLD_KEY, next);
      return next;
    });

  // 판이 화면 왼쪽 절반에 있으면 미리보기를 오른쪽에
  const side: 'left' | 'right' = pos && pos.x + LIBRARY_W / 2 < viewport().w / 2 ? 'right' : 'left';
  const shownCount = layout.length;
  return (
    <aside
      ref={ref}
      aria-label="위젯 보관함"
      style={{ width: LIBRARY_W, maxHeight: Math.min(680, maxH ?? 680), ...(pos ? { left: pos.x, top: pos.y } : { right: 20, top: 262 }) }}
      className={`fixed z-[70] flex flex-col rounded-[20px] border border-border bg-panel shadow-[0_24px_60px_-20px_rgba(16,40,80,.45)] ${moving ? 'select-none ring-2 ring-[#9fcfee]' : ''}`}
    >
      {hover && !moving && <WidgetPreview id={hover} side={side} />}
      {/* 머리 — 끌어서 옮긴다 */}
      <div
        onPointerDown={startMove}
        className={`flex touch-none items-center gap-1.5 rounded-t-[20px] px-3 pt-3 pb-2 ${moving ? 'cursor-grabbing' : 'cursor-grab'}`}
        title="끌어서 옮기기"
      >
        <GripVertical size={15} className="shrink-0 text-ink3" aria-hidden="true" />
        <h2 className="text-[15px] font-extrabold tracking-tight text-ink">위젯 보관함</h2>
        <span className="ml-auto text-[11.5px] text-ink3">표시 <strong className="tabular-nums text-[#0876c8]">{shownCount}</strong> / {WIDGET_IDS.length}</span>
        <button type="button" onClick={onClose} aria-label="위젯 보관함 닫기" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-ink3 hover:bg-panel-alt"><X size={16} /></button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
        {MODULES.map((m) => {
          const ids = WIDGET_IDS.filter((id) => WIDGETS[id].module === m);
          const onCount = ids.filter((id) => layout.some((s) => s.id === id)).length;
          const open = !folded.includes(m);
          return (
            <section key={m}>
              <button
                type="button"
                onClick={() => toggleFold(m)}
                aria-expanded={open}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-panel-alt"
              >
                <ChevronDown size={14} className={`shrink-0 text-ink3 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                <span className="flex-1 text-[12.5px] font-extrabold text-ink2">{m}</span>
                <span className={`text-[11px] tabular-nums ${onCount ? 'font-bold text-[#0876c8]' : 'text-ink3'}`}>{onCount}/{ids.length}</span>
              </button>
              {open && (
                <ul className="m-0 mb-1 flex list-none flex-col gap-0.5 p-0 pl-3">
                  {ids.map((id) => {
                    const on = layout.some((s) => s.id === id);
                    const title = WIDGETS[id].title;
                    return (
                      <li
                        key={id}
                        onMouseEnter={() => setHover(id)}
                        onMouseLeave={() => setHover((h) => (h === id ? null : h))}
                      >
                        <div
                          draggable={!on}
                          onDragStart={(e) => { e.dataTransfer.setData(DRAG_NEW, id); e.dataTransfer.effectAllowed = 'copy'; setHover(null); onDragStart(id); }}
                          onDragEnd={onDragEnd}
                          className={`flex items-center gap-1.5 rounded-lg py-1 pr-1 pl-1.5 ${on ? 'bg-[#eef6fd] dark:bg-sky-500/10' : 'cursor-grab hover:bg-panel-alt active:cursor-grabbing'}`}
                        >
                          <GripVertical size={14} className={`shrink-0 ${on ? 'text-transparent' : 'text-ink3'}`} aria-hidden="true" />
                          <span className={`min-w-0 flex-1 truncate text-[13px] ${on ? 'font-bold text-ink' : 'text-ink2'}`}>{title}</span>
                          <button
                            type="button"
                            onClick={() => onToggle(id)}
                            aria-pressed={on}
                            aria-label={on ? `${title} 숨기기` : `${title} 보이기`}
                            title={on ? '숨기기' : '보이기'}
                            className={`grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md ${on ? 'text-[#0876c8] hover:bg-white dark:hover:bg-white/10' : 'text-ink3 hover:bg-white hover:text-ink2 dark:hover:bg-white/10'}`}
                          >
                            {on ? <Eye size={16} /> : <EyeOff size={16} />}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

/** 넓은 화면(모눈 배치)인지 — 좁은 화면에서는 위젯을 위에서부터 차례로 쌓는다 */
function useWide() {
  const query = '(min-width: 1280px)';
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/** 모눈 점 — 칸과 칸 사이 교차점마다 작은 점 하나 */
function GridDots({ rows }: { rows: number }) {
  const dots: ReactNode[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= GRID_COLS; c++) {
      dots.push(
        <span
          key={`${r}-${c}`}
          className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b9d2ea] dark:bg-white/15"
          style={{ left: `calc(${c} * (100% + ${CELL_GAP}px) / ${GRID_COLS} - ${CELL_GAP / 2}px)`, top: r * PITCH - CELL_GAP / 2 }}
        />,
      );
    }
  }
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0">{dots}</div>;
}

export default function ExecDashboardScreen() {
  const { user: me } = useAuth();
  const wide = useWide();
  /** 저장된 배치와, 편집 중에 고치는 배치(적용을 눌러야 저장) */
  const [saved, setSaved] = useState(() => snapToTiers(loadLayout(me?.id)));
  const [layout, setLayout] = useState(saved);
  const [editing, setEditing] = useState(false);
  /** 끄는 동안 미리 보는 배치와, 그 안에서 방금 옮기거나 키운 위젯 */
  const [draft, setDraft] = useState<{ list: WidgetSlot<WidgetId>[]; pin: WidgetId } | null>(null);
  /** 옮기는 중인 위젯 / 보관함에서 끌어 오는 위젯 */
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [dragNew, setDragNew] = useState<WidgetId | null>(null);
  /** 옮기기 끌기를 허락한 위젯 — 크기 단추·손잡이를 누를 때는 옮기기가 시작되지 않게 */
  const [armed, setArmed] = useState<WidgetId | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** 위젯 보관함을 띄웠는가(편집 중에만) */
  const [libOpen, setLibOpen] = useState(false);
  /** 위젯 구역 폭 — 편집 중에는 이 폭으로 그린 뒤 오른쪽 보관함 자리만큼 줄여 보인다 */
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaW, setAreaW] = useState(0);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaW(el.offsetWidth));
    ro.observe(el);
    setAreaW(el.offsetWidth);
    return () => ro.disconnect();
  }, [wide]);
  /** 잡은 곳이 위젯의 몇 번째 칸인지 — 끌 때 그 칸이 마우스를 따라간다 */
  const grab = useRef({ col: 0, row: 0 });

  // 로그인 사용자가 늦게 잡히면 그 사람 배치로 다시 읽는다
  useEffect(() => {
    const next = snapToTiers(loadLayout(me?.id));
    setSaved(next);
    setLayout(next);
  }, [me?.id]);

  /** 편집 중 되돌리기 기록 — 바꿀 때마다 직전 배치를 쌓는다(최근 30번) */
  const [history, setHistory] = useState<WidgetSlot<WidgetId>[][]>([]);

  /** 자리를 다시 잡는다(빈틈없이 왼쪽 위부터) — 저장은 '적용'에서 */
  const commit = (next: WidgetSlot<WidgetId>[], pin: WidgetId | null = null) => {
    const boxes = arrange(placementsOf(next), pin);
    const placed = next.map((s) => {
      const b = boxes.get(s.id)!;
      return { ...s, size: b.w, x: b.x, y: b.y };
    });
    if (JSON.stringify(placed) === JSON.stringify(layout)) return;
    setHistory((h) => [...h.slice(-29), layout]);
    setLayout(placed);
  };
  const undo = () => {
    if (!history.length) return;
    setLayout(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const resetDrag = () => { setDraft(null); setDragId(null); setDragNew(null); setArmed(null); };
  const startEdit = () => { setLayout(saved); setHistory([]); setEditing(true); setLibOpen(false); resetDrag(); };
  const cancelEdit = () => { setLayout(saved); setHistory([]); setEditing(false); setLibOpen(false); resetDrag(); };
  const applyEdit = () => {
    setSaved(layout);
    setHistory([]);
    setEditing(false);
    setLibOpen(false);
    resetDrag();
    if (!me?.id) return;
    try { localStorage.setItem(storageKey(me.id), JSON.stringify(layout)); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };

  const shown = draft?.list ?? (editing ? layout : saved);
  const boxes = arrange(placementsOf(shown), draft?.pin ?? null);
  /** 적용하지 않은 바뀐 것이 있는가 */
  const dirty = editing && JSON.stringify(layout) !== JSON.stringify(saved);

  // 위젯 자리가 바뀌면 원래 자리에서 새 자리로 미끄러지듯 옮겨 보인다(무엇이 어디로 갔는지 보이게)
  const prevRects = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const g = grid.getBoundingClientRect();
    const k = g.width ? grid.offsetWidth / g.width : 1;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, { x: number; y: number }>();
    grid.querySelectorAll<HTMLElement>('[data-slot-id]').forEach((el) => {
      const id = el.dataset.slotId!;
      const r = el.getBoundingClientRect();
      const at = { x: (r.left - g.left) * k, y: (r.top - g.top) * k };
      next.set(id, at);
      const before = prevRects.current.get(id);
      if (!editing || still || !before) return;
      const dx = before.x - at.x;
      const dy = before.y - at.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
    prevRects.current = next;
  });

  // 편집 중 Ctrl+Z(⌘+Z) — 한 단계 되돌리기
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 적용하지 않고 창을 닫거나 새로 고치면 한 번 묻는다
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);
  const bottom = Math.max(0, ...[...boxes.values()].map((b) => b.y + b.h));

  /** 마우스 위치 → 모눈 칸(화면 배율을 걷어 내고 센다) */
  const cellAt = (clientX: number, clientY: number) => {
    const grid = gridRef.current!;
    const rect = grid.getBoundingClientRect();
    const scale = rect.width ? grid.offsetWidth / rect.width : 1;
    const pitchX = (grid.offsetWidth + CELL_GAP) / GRID_COLS;
    return { col: Math.floor(((clientX - rect.left) * scale) / pitchX), row: Math.floor(((clientY - rect.top) * scale) / PITCH), x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale, pitchX };
  };

  /** 끄는 동안 — 마우스가 가리키는 칸에 위젯을 두어 본다 */
  const dragOverGrid = (e: React.DragEvent<HTMLDivElement>) => {
    const id = dragId ?? dragNew;
    if (!editing || !id) return;
    e.preventDefault();
    const at = cellAt(e.clientX, e.clientY);
    const base = layout.some((s) => s.id === id) ? layout : [...layout, { id, size: defaultSizeOf(id) }];
    const slot = base.find((s) => s.id === id)!;
    const x = Math.min(Math.max(0, at.col - grab.current.col), GRID_COLS - slot.size);
    const y = Math.max(0, at.row - grab.current.row);
    const cur = draft?.list.find((s) => s.id === id);
    if (cur && cur.x === x && cur.y === y) return;
    setDraft({ list: base.map((s) => (s.id === id ? { ...s, x, y } : s)), pin: id });
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draft) commit(draft.list, draft.pin);
    resetDrag();
  };

  /** 크기 바꾸기 — 소·중·대 단추. 폭과 높이가 그 단계로 바뀌고, 나머지 위젯은 다시 왼쪽 위로 붙는다 */
  const setTier = (id: WidgetId, tier: Tier) => commit(layout.map((s) => (s.id === id ? { ...s, size: TIER_COLS[tier] } : s)), id);

  /** 보관함의 눈 — 켜면 첫 빈자리에 기본 크기로, 끄면 홈에서 뺀다 */
  const toggleWidget = (id: WidgetId) =>
    commit(layout.some((s) => s.id === id) ? layout.filter((s) => s.id !== id) : [...layout, { id, size: defaultSizeOf(id) }]);

  const canEdit = editing && wide;
  // 좁은 화면 — 모눈 자리 순서(위→아래, 왼→오)대로 쌓는다
  const order = [...shown].sort((a, b) => {
    const p = boxes.get(a.id)!;
    const q = boxes.get(b.id)!;
    return p.y - q.y || p.x - q.x;
  });

  const grid = (
    <div
      ref={gridRef}
      className="relative grid min-w-0 grid-cols-12"
      style={{ gridAutoRows: CELL_H, gap: CELL_GAP, minHeight: canEdit ? rowsHeight(bottom + 4) : undefined }}
      onDragOver={dragOverGrid}
      onDrop={(e) => { if (canEdit && (dragId || dragNew)) drop(e); }}
    >
      {/* 모눈 — 편집 중에만 칸 사이 점으로 */}
      {canEdit && <GridDots rows={bottom + 4} />}
      {shown.map((slot) => {
        const box = boxes.get(slot.id)!;
        const isNew = !layout.some((s) => s.id === slot.id);
        const isDragged = dragId === slot.id || (isNew && canEdit);
        const tier = tierOfSlot(slot);
        const { Component, title } = WIDGETS[slot.id];
        return (
          <div
            key={slot.id}
            data-slot
            data-slot-id={slot.id}
            data-tier={tier}
            className="group/slot relative z-[1] min-w-0"
            style={{ gridColumn: `${box.x + 1} / span ${box.w}`, gridRow: `${box.y + 1} / span ${box.h}` }}
            draggable={canEdit && armed === slot.id}
            onPointerDown={(e) => {
              if (!canEdit || (e.target as HTMLElement).closest('button')) return;
              setArmed(slot.id);
            }}
            onPointerUp={() => { if (!dragId) setArmed(null); }}
            onDragStart={(e) => {
              const at = cellAt(e.clientX, e.clientY);
              grab.current = { col: Math.max(0, at.col - box.x), row: Math.max(0, at.row - box.y) };
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', slot.id);
              // 끌리는 그림을 뜬 다음에 자리 표시로 바꾼다
              setTimeout(() => setDragId(slot.id), 0);
            }}
            onDragEnd={resetDrag}
          >
            {isDragged ? (
              // 놓일 자리
              <div className="h-full rounded-[22px] border-2 border-dashed border-[#0876c8] bg-[#0876c8]/[.07]" />
            ) : (
              <div
                className={`flex h-full flex-col ${
                  canEdit
                    ? '-m-1.5 h-[calc(100%+12px)] cursor-grab rounded-[24px] bg-[#e8f0f9] p-1.5 ring-2 ring-transparent transition-[box-shadow,background-color] hover:ring-[#9fcfee] active:cursor-grabbing dark:bg-white/5'
                    : ''
                }`}
              >
                <div
                  data-widget-body={slot.id}
                  className={`min-h-0 flex-1 overflow-hidden [&>section]:overflow-hidden ${canEdit ? 'pointer-events-none select-none opacity-80' : ''}`}
                >
                  <WidgetTierProvider value={tier}><Component /></WidgetTierProvider>
                </div>
              </div>
            )}
            {canEdit && !isDragged && (
              <>
                {/* 크기(소·중·대)와 숨기기 — 오른쪽 위, 커서를 올리면 */}
                <div className={`absolute -top-3 right-3 z-40 flex items-center gap-0.5 rounded-full border-2 border-[#0876c8] bg-panel p-0.5 shadow-md transition-opacity focus-within:opacity-100 opacity-0 group-hover/slot:opacity-100`}>
                  <div role="radiogroup" aria-label={`${title} 크기`} className="flex gap-0.5">
                    {TIERS.map((t) => {
                      const on = t === tier;
                      return (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={`${title} ${TIER_LABEL[t]}`}
                          onClick={() => { if (!on) setTier(slot.id, t); }}
                          className={`grid h-6 w-7 cursor-pointer place-items-center rounded-full text-[11.5px] font-extrabold ${on ? 'bg-[#0876c8] text-white' : 'text-[#0876c8] hover:bg-[#e0f0fb] dark:hover:bg-white/10'}`}
                        >
                          {TIER_LABEL[t]}
                        </button>
                      );
                    })}
                  </div>
                  <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => commit(layout.filter((s) => s.id !== slot.id))}
                    aria-label={`${title} 숨기기`}
                    title="숨기기"
                    className="grid h-6 w-7 cursor-pointer place-items-center rounded-full text-ink3 hover:bg-[#fdecea] hover:text-[#c4432f]"
                  >
                    <EyeOff size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-3 pb-10">
      {/* 편집 도구 — 편집 중에는 파란 띠로, 적용해야 저장된다 */}
      {canEdit ? (
        <div className="flex items-center gap-2 rounded-2xl bg-[#e0f0fb] px-4 py-2.5 dark:bg-sky-500/15">
          <span className="text-[14px] font-extrabold text-[#0b4f86] dark:text-sky-200">홈 편집</span>
          <button
            type="button"
            onClick={() => setLibOpen((v) => !v)}
            aria-pressed={libOpen}
            className={`ml-3 flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-bold ${libOpen ? 'bg-[#0876c8] text-white hover:bg-[#066aaf]' : 'border border-[#0876c8] bg-panel text-[#0876c8] hover:bg-white'}`}
          >
            <LayoutGrid size={15} />위젯 보관함
          </button>
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="mr-1 text-[12px] font-bold text-[#2f6fa5] dark:text-sky-200">적용하지 않은 변경</span>}
            <button
              type="button"
              onClick={undo}
              disabled={!history.length}
              title="되돌리기 (Ctrl+Z)"
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#2f6fa5] hover:bg-white/70 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:text-sky-200 dark:hover:bg-white/10"
            >
              <Undo2 size={15} />되돌리기
            </button>
            <button type="button" onClick={() => commit(DEFAULT_LAYOUT)} className="cursor-pointer rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#2f6fa5] hover:bg-white/70 dark:text-sky-200 dark:hover:bg-white/10">
              기본 배치
            </button>
            <button type="button" onClick={cancelEdit} className="cursor-pointer rounded-lg border border-border bg-panel px-4 py-2 text-[12.5px] font-bold text-ink2 hover:border-ink3">
              취소
            </button>
            <button type="button" onClick={applyEdit} className="cursor-pointer rounded-lg bg-[#0876c8] px-4 py-2 text-[12.5px] font-bold text-white hover:bg-[#066aaf]">
              적용
            </button>
          </div>
        </div>
      ) : wide ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={startEdit}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold text-ink2 hover:border-[#0876c8] hover:text-[#0876c8]"
          >
            화면 편집
          </button>
        </div>
      ) : null}

      {wide ? (
        <>
          <div ref={areaRef}>
            {canEdit && areaW > 0 ? (
              <div style={{ width: areaW, zoom: (areaW - LIBRARY_W - 28) / areaW }}>{grid}</div>
            ) : (
              grid
            )}
          </div>
          {canEdit && libOpen && (
            <WidgetLibrary
              layout={layout}
              onToggle={toggleWidget}
              onDragStart={(id) => { grab.current = { col: 0, row: 0 }; setDragNew(id); }}
              onDragEnd={resetDrag}
              onClose={() => setLibOpen(false)}
            />
          )}
        </>
      ) : (
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: CELL_H, gridAutoFlow: 'row dense' }}>
          {order.map((slot) => {
            const { Component } = WIDGETS[slot.id];
            const tier = tierOfSlot(slot);
            return (
              <div
                key={slot.id}
                data-tier={tier}
                className={`min-w-0 ${slot.size <= 6 ? 'col-span-12 lg:col-span-6' : 'col-span-12'}`}
                style={{ gridRowEnd: `span ${rowsOf(slot)}` }}
              >
                <div className="h-full overflow-hidden [&>section]:overflow-hidden"><WidgetTierProvider value={tier}><Component /></WidgetTierProvider></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
