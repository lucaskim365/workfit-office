import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Eye, EyeOff, GripVertical, MoveDiagonal2 } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { arrange, CELL_GAP, CELL_H, GRID_COLS, PITCH, rowsHeight, tierOf, TIER_COLS, TIER_LABEL, TIERS, type Tier, type WidgetSlot } from './dashboard';
import { DEFAULT_LAYOUT, defaultSizeOf, loadLayout, MODULES, placementsOf, rowsAt, rowsOf, snapToTiers, storageKey, tierOfSlot, WIDGET_IDS, WIDGETS, type WidgetId } from './registry';
import { WidgetTierProvider } from './widgets';

/**
 * 홈(경영 현황) — 로그인 후 첫 화면.
 * 화면은 모눈(가로 12칸, 세로 64px 칸)으로 나뉘고, 위젯은 늘 왼쪽 위로 붙는다(빈칸은 높이가 다른 위젯 옆에만).
 * 편집: 위젯은 끌어서 옮기고, 크기는 소(4칸)·중(6칸)·대(12칸) 단추나 오른쪽 아래 손잡이를 끌어 바꾼다(가까운 단계로 맞춤).
 * 오른쪽 위젯 보관함(모듈 → 위젯)에서 눈을 켜고 끈다. 바꾼 것은 '적용'을 눌러야 저장되고, '취소'면 그대로 돌아간다.
 * 배치는 사용자별로 이 브라우저에 저장한다(데이터베이스는 건드리지 않는다).
 */

/** 미리보기를 그릴 실제 폭 — 이 폭으로 그린 뒤 줄여 보인다 */
const PREVIEW_WIDTH: Record<Tier, number> = { S: 420, M: 620, L: 1180 };
/** 위젯 보관함 폭 */
const LIBRARY_W = 264;
/** 보관함 미리보기 폭 */
const PREVIEW_BOX = 300;

const DRAG_NEW = 'application/x-workfit-widget';

/** 보관함에서 위젯에 커서를 올리면 왼쪽에 뜨는 미리보기 — 실제 위젯을 기본 크기로 그려 줄여 보인다 */
function WidgetPreview({ id }: { id: WidgetId }) {
  const def = WIDGETS[id];
  const tier = def.tier;
  const w = PREVIEW_WIDTH[tier];
  const zoom = PREVIEW_BOX / w;
  const h = rowsHeight(rowsAt(id, tier));
  return (
    <div className="pointer-events-none absolute top-1/2 right-full z-50 mr-3 -translate-y-1/2 rounded-2xl border border-border bg-[var(--color-bg)] p-2 shadow-[0_16px_40px_-12px_rgba(16,40,80,.35)]" aria-hidden="true">
      <div className="overflow-hidden" style={{ width: PREVIEW_BOX, height: Math.round(h * zoom) }}>
        <div className="select-none" data-tier={tier} style={{ width: w, height: h, zoom }} inert>
          <WidgetTierProvider value={tier}><def.Component /></WidgetTierProvider>
        </div>
      </div>
      <div className="mt-1.5 px-1 text-[11px] font-bold text-ink3">{TIER_LABEL[tier]} 크기로 들어갑니다</div>
    </div>
  );
}

/** 위젯 보관함 — 모듈 아래 위젯을 나열하고, 오른쪽 눈으로 홈에 보이기/숨기기. 숨긴 위젯은 끌어서 원하는 자리에 놓을 수도 있다 */
function WidgetLibrary({ layout, onToggle, onDragStart, onDragEnd }: {
  layout: WidgetSlot<WidgetId>[];
  onToggle: (id: WidgetId) => void;
  onDragStart: (id: WidgetId) => void;
  onDragEnd: () => void;
}) {
  const [hover, setHover] = useState<WidgetId | null>(null);
  const shownCount = layout.length;
  return (
    <aside aria-label="위젯 보관함" style={{ width: LIBRARY_W }} className="shrink-0 self-start rounded-[20px] border border-border bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-[15px] font-extrabold tracking-tight text-ink">위젯 보관함</h2>
        <span className="text-[11.5px] text-ink3">표시 <strong className="tabular-nums text-[#0876c8]">{shownCount}</strong> / {WIDGET_IDS.length}</span>
      </div>
      <div className="flex flex-col gap-3">
        {MODULES.map((m) => (
          <section key={m}>
            <h3 className="mb-1 px-1 text-[11.5px] font-extrabold text-ink3">{m}</h3>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {WIDGET_IDS.filter((id) => WIDGETS[id].module === m).map((id) => {
                const on = layout.some((s) => s.id === id);
                const title = WIDGETS[id].title;
                return (
                  <li
                    key={id}
                    className="relative"
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
                    {hover === id && <WidgetPreview id={id} />}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
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
  /** 옮기는 중인 위젯 / 보관함에서 끌어 오는 위젯 / 크기를 끌어 바꾸는 위젯 */
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [dragNew, setDragNew] = useState<WidgetId | null>(null);
  const [resizing, setResizing] = useState<WidgetId | null>(null);
  /** 옮기기 끌기를 허락한 위젯 — 크기 단추·손잡이를 누를 때는 옮기기가 시작되지 않게 */
  const [armed, setArmed] = useState<WidgetId | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** 화면 폭 — 편집 중에는 모눈을 이 폭 그대로 그린 뒤 보관함 자리만큼 줄여 보인다(위젯 모양이 평소와 같게) */
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowW, setRowW] = useState(0);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRowW(el.offsetWidth));
    ro.observe(el);
    setRowW(el.offsetWidth);
    return () => ro.disconnect();
  }, [editing, wide]);
  /** 잡은 곳이 위젯의 몇 번째 칸인지 — 끌 때 그 칸이 마우스를 따라간다 */
  const grab = useRef({ col: 0, row: 0 });

  // 로그인 사용자가 늦게 잡히면 그 사람 배치로 다시 읽는다
  useEffect(() => {
    const next = snapToTiers(loadLayout(me?.id));
    setSaved(next);
    setLayout(next);
  }, [me?.id]);

  /** 자리를 다시 잡는다(겹친 위젯은 아래로, 모두 왼쪽 위로) — 저장은 '적용'에서 */
  const commit = (next: WidgetSlot<WidgetId>[], pin: WidgetId | null = null) => {
    const boxes = arrange(placementsOf(next), pin);
    setLayout(next.map((s) => {
      const b = boxes.get(s.id)!;
      return { ...s, size: b.w, x: b.x, y: b.y };
    }));
  };

  const resetDrag = () => { setDraft(null); setDragId(null); setDragNew(null); setArmed(null); };
  const startEdit = () => { setLayout(saved); setEditing(true); resetDrag(); };
  const cancelEdit = () => { setLayout(saved); setEditing(false); resetDrag(); };
  const applyEdit = () => {
    setSaved(layout);
    setEditing(false);
    resetDrag();
    if (!me?.id) return;
    try { localStorage.setItem(storageKey(me.id), JSON.stringify(layout)); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };

  const shown = draft?.list ?? (editing ? layout : saved);
  const boxes = arrange(placementsOf(shown), draft?.pin ?? null);
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

  /** 오른쪽 아래 손잡이를 끌어 크기 바꾸기 — 마우스가 있는 폭에서 가장 가까운 단계(소·중·대)로 맞춘다 */
  const startResize = (id: WidgetId, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const box = boxes.get(id);
    if (!gridRef.current || !box) return;
    let list = layout.map((s) => (s.id === id ? { ...s, x: box.x, y: box.y } : s));
    let moved = false;
    setResizing(id);
    const onMove = (ev: PointerEvent) => {
      const at = cellAt(ev.clientX, ev.clientY);
      const cols = Math.round((at.x + CELL_GAP) / at.pitchX) - box.x;
      // 오른쪽 끝까지 끌면 한 줄 전체(대) — 가운데서 시작한 위젯도 대로 키울 수 있게
      const toEdge = at.x >= gridRef.current!.offsetWidth - at.pitchX / 2;
      const size = toEdge ? TIER_COLS.L : TIER_COLS[tierOf(cols)];
      const cur = list.find((s) => s.id === id)!;
      if (cur.size === size) return;
      moved = true;
      // 오른쪽 끝을 넘는 폭이면 왼쪽으로 당겨 둔다
      list = list.map((s) => (s.id === id ? { ...s, size, x: Math.min(box.x, GRID_COLS - size) } : s));
      setDraft({ list, pin: id });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResizing(null);
      setDraft(null);
      if (moved) commit(list, id);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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
      className="relative grid min-w-0 flex-1 grid-cols-12"
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
        const isResizing = resizing === slot.id;
        const tier = tierOfSlot(slot);
        const { Component, title } = WIDGETS[slot.id];
        return (
          <div
            key={slot.id}
            data-slot
            data-tier={tier}
            className="group/slot relative z-[1] min-w-0"
            style={{ gridColumn: `${box.x + 1} / span ${box.w}`, gridRow: `${box.y + 1} / span ${box.h}` }}
            draggable={canEdit && armed === slot.id}
            onPointerDown={(e) => {
              if (!canEdit || (e.target as HTMLElement).closest('button, [role="separator"]')) return;
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
                    ? `-m-1.5 h-[calc(100%+12px)] cursor-grab rounded-[24px] p-1.5 ring-2 transition-[box-shadow,background-color] active:cursor-grabbing ${
                        isResizing ? 'bg-[#dcebf9] ring-[#0876c8] dark:bg-sky-500/15' : 'bg-[#e8f0f9] ring-transparent hover:ring-[#9fcfee] dark:bg-white/5'
                      }`
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
                {/* 크기(소·중·대)와 숨기기 — 오른쪽 위 */}
                <div className="absolute -top-3 right-3 z-40 flex items-center gap-0.5 rounded-full border-2 border-[#0876c8] bg-panel p-0.5 shadow-md">
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
                {/* 크기 손잡이 — 끌면 가까운 단계로 맞춰진다 */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`${title} 크기 조절`}
                  title="끌어서 크기 조절"
                  onPointerDown={(e) => startResize(slot.id, e)}
                  className={`absolute -right-2.5 -bottom-2.5 z-40 grid h-8 w-8 cursor-ew-resize touch-none place-items-center rounded-full border-2 border-[#0876c8] shadow-md ${
                    isResizing ? 'bg-[#0876c8] text-white' : 'bg-panel text-[#0876c8] hover:bg-[#e0f0fb]'
                  }`}
                >
                  <MoveDiagonal2 size={15} />
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
          <div className="ml-auto flex items-center gap-2">
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
        canEdit ? (
          <div ref={rowRef} className="flex items-start gap-5">
            <div className="shrink-0" style={rowW ? { width: rowW, zoom: (rowW - LIBRARY_W - 20) / rowW } : { flex: 1 }}>{grid}</div>
            <WidgetLibrary
              layout={layout}
              onToggle={toggleWidget}
              onDragStart={(id) => { grab.current = { col: 0, row: 0 }; setDragNew(id); }}
              onDragEnd={resetDrag}
            />
          </div>
        ) : (
          <div ref={rowRef}>{grid}</div>
        )
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
