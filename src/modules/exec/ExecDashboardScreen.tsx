import { useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { MoveDiagonal2, Plus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { arrange, CELL_GAP, CELL_H, GRID_COLS, MAX_ROWS, normalizeLayout, PITCH, rowsFor, rowsHeight, type WidgetSize, type WidgetSlot } from './dashboard';
import {
  ApprovalWidget,
  AttendanceWidget,
  AwayTodayWidget,
  BirthdayWidget,
  LeaveWidget,
  MyDraftsWidget,
  NoticeWidget,
  PendingApprovalWidget,
  ProjectWidget,
  RecentPostsWidget,
  ResourceTodayWidget,
  ResourceWidget,
  TeamWidget,
  TodayCommuteWidget,
  TodayWidget,
  WeekHoursWidget,
  WeekScheduleWidget,
} from './widgets';

/**
 * 경영 현황 — 로그인 후 첫 화면. 편집 모드의 '위젯 추가' 창에서 모듈을 골라 위젯을 넣고,
 * 화면은 모눈(가로 12칸, 세로 64px 칸)으로 나뉘고, 위젯은 원하는 칸에 끌어다 놓는다(빈칸이 남아도 된다).
 * 오른쪽 아래 단추로 폭·높이를 칸 단위로 바꾸고, 겹치는 위젯은 아래로 비켜 선다.
 * 배치는 사용자별로 이 브라우저에 저장한다(데이터베이스는 건드리지 않는다).
 */

/** sizes — 고를 수 있는 폭(가장 좁은 것이 최소 폭), minH — 내용이 다 보이는 높이(px). 이 높이가 들어가는 칸 수가 기본이자 최소 칸 수 */
interface WidgetDef { title: string; module: string; size: WidgetSize; sizes: readonly WidgetSize[]; minH: number; Component: ComponentType }

const WIDGETS = {
  today: { title: '오늘 일정', module: '일정', size: 12, sizes: [8, 12], minH: 220, Component: TodayWidget },
  weekSchedule: { title: '이번 주 내 일정', module: '일정', size: 6, sizes: [4, 6, 8, 12], minH: 260, Component: WeekScheduleWidget },
  attendance: { title: '내 근태', module: '근태', size: 8, sizes: [8, 12], minH: 420, Component: AttendanceWidget },
  todayCommute: { title: '오늘 출퇴근', module: '근태', size: 4, sizes: [4, 6], minH: 180, Component: TodayCommuteWidget },
  weekHours: { title: '이번 주 근무시간', module: '근태', size: 4, sizes: [4, 6, 8], minH: 220, Component: WeekHoursWidget },
  leave: { title: '연차', module: '근태', size: 4, sizes: [4, 6], minH: 120, Component: LeaveWidget },
  approval: { title: '전자결재 현황', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 240, Component: ApprovalWidget },
  approvalPending: { title: '결재 대기', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 200, Component: PendingApprovalWidget },
  approvalMine: { title: '내가 올린 문서', module: '전자결재', size: 4, sizes: [4, 6, 8], minH: 200, Component: MyDraftsWidget },
  resource: { title: '내 자원예약', module: '자원예약', size: 4, sizes: [4, 6], minH: 180, Component: ResourceWidget },
  resourceToday: { title: '오늘 자원 사용', module: '자원예약', size: 8, sizes: [6, 8, 12], minH: 180, Component: ResourceTodayWidget },
  team: { title: '우리 부서', module: '조직도', size: 4, sizes: [4, 6, 8], minH: 200, Component: TeamWidget },
  awayToday: { title: '오늘 휴가·외근', module: '조직도', size: 4, sizes: [4, 6, 8], minH: 160, Component: AwayTodayWidget },
  birthday: { title: '이달의 생일자', module: '조직도', size: 4, sizes: [4, 6], minH: 200, Component: BirthdayWidget },
  notice: { title: '공지사항', module: '게시판', size: 12, sizes: [4, 6, 8, 12], minH: 150, Component: NoticeWidget },
  recentPosts: { title: '최근 게시글', module: '게시판', size: 6, sizes: [4, 6, 8, 12], minH: 180, Component: RecentPostsWidget },
  project: { title: '프로젝트', module: '프로젝트', size: 4, sizes: [4, 6], minH: 220, Component: ProjectWidget },
} satisfies Record<string, WidgetDef>;

type WidgetId = keyof typeof WIDGETS;
const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];
const MODULES = [...new Set(WIDGET_IDS.map((id) => WIDGETS[id].module))];

const DEFAULT_LAYOUT: WidgetSlot<WidgetId>[] = [
  { id: 'today', size: 12 },
  { id: 'attendance', size: 8 },
  { id: 'approval', size: 4 },
  { id: 'resource', size: 4 },
  { id: 'team', size: 4 },
  { id: 'project', size: 4 },
  { id: 'notice', size: 12 },
];

/** 미리보기를 그릴 실제 폭 — 이 폭으로 그린 뒤 줄여 보인다 */
const PREVIEW_WIDTH: Record<WidgetSize, number> = { 4: 420, 6: 620, 8: 860, 12: 1180 };
/** 위젯 추가 창의 카드 폭 — 실제 폭 비율대로 */
const CARD_WIDTH: Record<WidgetSize, number> = { 4: 196, 6: 290, 8: 386, 12: 580 };
const CARD_H = 150;

const storageKey = (userId: string) => `workfit.execDashboard.layout.${userId}`;
const DRAG_NEW = 'application/x-workfit-widget';

function loadLayout(userId: string | undefined): WidgetSlot<WidgetId>[] {
  if (!userId) return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return normalizeLayout(raw ? JSON.parse(raw) : null, WIDGET_IDS, DEFAULT_LAYOUT);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/** 위젯 추가 창의 카드 — 실제 위젯을 그 폭 그대로 줄여 보인다. 누르면 넣고, 끌어서 원하는 자리에 놓을 수도 있다 */
function PickerCard({ id, size, placed, onAdd, onDragStart, onDragEnd }: {
  id: WidgetId; size: WidgetSize; placed: boolean; onAdd: () => void; onDragStart: () => void; onDragEnd: () => void;
}) {
  const def = WIDGETS[id];
  const cardW = CARD_WIDTH[size];
  const w = PREVIEW_WIDTH[size];
  return (
    <div
      role="button"
      tabIndex={placed ? -1 : 0}
      aria-disabled={placed}
      aria-label={`${def.title} 넣기`}
      data-pick={id}
      draggable={!placed}
      onClick={() => { if (!placed) onAdd(); }}
      onKeyDown={(e) => { if (!placed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAdd(); } }}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_NEW, `${id}:${size}`); e.dataTransfer.effectAllowed = 'copy'; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`group shrink-0 ${placed ? 'cursor-default opacity-45' : 'cursor-pointer'}`}
      style={{ width: cardW }}
    >
      <div className={`relative overflow-hidden rounded-2xl border bg-[var(--color-bg)] transition-colors ${placed ? 'border-border' : 'border-border group-hover:border-[#0876c8] group-focus-visible:border-[#0876c8]'}`} style={{ height: CARD_H }}>
        <div className="pointer-events-none absolute top-2 left-2 select-none" style={{ width: w, zoom: (cardW - 16) / w }} aria-hidden="true" inert>
          <def.Component />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--color-bg)] to-transparent" />
        {!placed && (
          <span className="absolute right-2.5 bottom-2.5 grid h-7 w-7 place-items-center rounded-full bg-[#0876c8] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            <Plus size={15} />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2 px-1">
        <span className="truncate text-[13px] font-bold text-ink">{def.title}</span>
        {placed && <span className="shrink-0 text-[11px] text-ink3">배치됨</span>}
      </div>
    </div>
  );
}

/** 위젯 추가 창 — 왼쪽에서 모듈을 고르면 오른쪽에 그 모듈의 위젯이 크기별로 나온다 */
function WidgetPicker({ open, hiddenForDrag, layout, onAdd, onClose, onDragStart, onDragEnd }: {
  open: boolean;
  hiddenForDrag: boolean;
  layout: WidgetSlot<WidgetId>[];
  onAdd: (id: WidgetId, size: WidgetSize) => void;
  onClose: () => void;
  onDragStart: (id: WidgetId) => void;
  onDragEnd: () => void;
}) {
  const [module, setModule] = useState(MODULES[0]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const ids = WIDGET_IDS.filter((id) => WIDGETS[id].module === module);
  return createPortal(
    // 끌어서 놓는 동안에는 창을 투명하게 두어 뒤의 화면에 놓을 수 있게 한다(창을 없애면 끌기가 끊긴다)
    <div
      className={`fixed inset-0 z-[80] grid place-items-center bg-[rgba(15,25,45,.38)] transition-opacity ${hiddenForDrag ? 'pointer-events-none opacity-0' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="위젯 추가"
        className="flex overflow-hidden rounded-[22px] border border-border bg-panel shadow-[0_24px_60px_-20px_rgba(16,40,80,.45)]"
        style={{ width: 'min(960px, calc(100vw / var(--font-scale, 1) - 32px))', height: 'min(620px, calc(100vh / var(--font-scale, 1) - 32px))' }}
      >
        {/* 모듈 */}
        <nav className="flex w-[176px] shrink-0 flex-col gap-0.5 border-r border-border bg-panel-alt p-3">
          <div className="px-2.5 pt-1 pb-3 text-[15px] font-extrabold text-ink">위젯 추가</div>
          {MODULES.map((m) => {
            const n = WIDGET_IDS.filter((id) => WIDGETS[id].module === m).length;
            const on = m === module;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModule(m)}
                className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-bold ${on ? 'bg-panel text-[#0876c8] shadow-sm' : 'text-ink2 hover:bg-panel/70'}`}
              >
                {m}
                <span className={`text-[11px] tabular-nums ${on ? 'text-[#0876c8]' : 'text-ink3'}`}>{n}</span>
              </button>
            );
          })}
        </nav>
        {/* 위젯 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="text-[17px] font-extrabold tracking-tight text-ink">{module}</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink3 hover:bg-panel-alt"><X size={17} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="flex flex-wrap items-start gap-5">
              {ids.map((id) => (
                <PickerCard
                  key={id}
                  id={id}
                  size={WIDGETS[id].size}
                  placed={layout.some((s) => s.id === id)}
                  onAdd={() => onAdd(id, WIDGETS[id].size)}
                  onDragStart={() => onDragStart(id)}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 위젯의 최소(기본) 세로 칸 수 */
const minRowsOf = (id: WidgetId) => rowsFor(WIDGETS[id].minH);
/** 위젯의 최소 가로 칸 수 */
const minColsOf = (id: WidgetId) => Math.min(...WIDGETS[id].sizes);
/** 위젯이 차지하는 세로 칸 수 */
const rowsOf = (slot: WidgetSlot<WidgetId>) => Math.max(slot.rows ?? 0, minRowsOf(slot.id));
const placementsOf = (list: WidgetSlot<WidgetId>[]) =>
  list.map((s) => ({ id: s.id, w: Math.max(s.size, minColsOf(s.id)), h: rowsOf(s), x: s.x, y: s.y }));

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
  const [layout, setLayout] = useState(() => loadLayout(me?.id));
  const [editing, setEditing] = useState(false);
  /** 끄는 동안 미리 보는 배치와, 그 안에서 방금 옮기거나 키운 위젯 */
  const [draft, setDraft] = useState<{ list: WidgetSlot<WidgetId>[]; pin: WidgetId } | null>(null);
  /** 옮기는 중인 위젯 / 위젯 추가 창에서 끌어 오는 위젯 */
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [dragNew, setDragNew] = useState<WidgetId | null>(null);
  const [resizing, setResizing] = useState<WidgetId | null>(null);
  /** 옮기기 끌기를 허락한 위젯 — 크기 단추·버튼을 누를 때는 옮기기가 시작되지 않게 */
  const [armed, setArmed] = useState<WidgetId | null>(null);
  const [picking, setPicking] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  /** 잡은 곳이 위젯의 몇 번째 칸인지 — 끌 때 그 칸이 마우스를 따라간다 */
  const grab = useRef({ col: 0, row: 0 });

  // 로그인 사용자가 늦게 잡히면 그 사람 배치로 다시 읽는다
  useEffect(() => { setLayout(loadLayout(me?.id)); }, [me?.id]);

  const persist = (next: WidgetSlot<WidgetId>[]) => {
    if (!me?.id) return;
    try { localStorage.setItem(storageKey(me.id), JSON.stringify(next)); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };
  /** 자리를 다시 잡아(겹친 위젯은 아래로) 저장한다 */
  const commit = (next: WidgetSlot<WidgetId>[], pin: WidgetId | null = null) => {
    const boxes = arrange(placementsOf(next), pin);
    const placed = next.map((s) => {
      const b = boxes.get(s.id)!;
      return { ...s, size: b.w, x: b.x, y: b.y };
    });
    setLayout(placed);
    persist(placed);
  };

  const resetDrag = () => { setDraft(null); setDragId(null); setDragNew(null); setArmed(null); };

  const shown = draft?.list ?? layout;
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
    const base = layout.some((s) => s.id === id) ? layout : [...layout, { id, size: WIDGETS[id].size }];
    const slot = base.find((s) => s.id === id)!;
    const w = Math.max(slot.size, minColsOf(id));
    const x = Math.min(Math.max(0, at.col - grab.current.col), GRID_COLS - w);
    const y = Math.max(0, at.row - grab.current.row);
    const cur = draft?.list.find((s) => s.id === id);
    if (cur && cur.x === x && cur.y === y) return;
    setDraft({ list: base.map((s) => (s.id === id ? { ...s, x, y } : s)), pin: id });
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draft) commit(draft.list, draft.pin);
    if (dragNew) setPicking(false);
    resetDrag();
  };

  /**
   * 크기 바꾸기 — 오른쪽 아래 단추를 끌면 마우스가 있는 칸까지 폭·높이가 칸 단위로 늘고 준다.
   * 겹치는 위젯은 끄는 동안 아래로 비켜 서고, 놓으면 그대로 저장된다.
   */
  const startResize = (id: WidgetId, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const box = boxes.get(id);
    if (!gridRef.current || !box) return;
    const minW = minColsOf(id);
    const minH = minRowsOf(id);
    let list = layout.map((s) => (s.id === id ? { ...s, x: box.x, y: box.y } : s));
    let moved = false;
    setResizing(id);
    const onMove = (ev: PointerEvent) => {
      const at = cellAt(ev.clientX, ev.clientY);
      const w = Math.min(Math.max(minW, Math.round((at.x + CELL_GAP) / at.pitchX) - box.x), GRID_COLS - box.x);
      const h = Math.min(Math.max(minH, Math.round((at.y + CELL_GAP) / PITCH) - box.y), MAX_ROWS);
      const cur = list.find((s) => s.id === id)!;
      if (cur.size === w && rowsOf(cur) === h) return;
      moved = true;
      list = list.map((s) => (s.id === id ? { ...s, size: w, rows: h } : s));
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

  /** 높이를 기본 칸 수로 되돌리기(크기 단추 두 번 누르기) */
  const resetHeight = (id: WidgetId) => commit(layout.map((s) => (s.id === id ? { ...s, rows: undefined } : s)), id);

  const canEdit = editing && wide;
  // 좁은 화면 — 모눈 자리 순서(위→아래, 왼→오)대로 쌓는다
  const order = [...shown].sort((a, b) => {
    const p = boxes.get(a.id)!;
    const q = boxes.get(b.id)!;
    return p.y - q.y || p.x - q.x;
  });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-3 pb-10">
      {/* 편집 도구 — 편집 중에는 파란 띠로 */}
      {canEdit ? (
        <div className="flex items-center gap-2 rounded-2xl bg-[#e0f0fb] px-3 py-2 dark:bg-sky-500/15">
          <button type="button" onClick={() => setPicking(true)} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0876c8] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#066aaf]">
            <Plus size={15} />위젯 추가
          </button>
          <button type="button" onClick={() => commit(DEFAULT_LAYOUT)} className="cursor-pointer rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#2f6fa5] hover:bg-white/70 dark:text-sky-200 dark:hover:bg-white/10">
            기본 배치
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setPicking(false); resetDrag(); }}
            className="ml-auto cursor-pointer rounded-lg border border-[#0876c8] bg-panel px-4 py-2 text-[12.5px] font-bold text-[#0876c8] hover:bg-white"
          >
            완료
          </button>
        </div>
      ) : wide ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setEditing(true); resetDrag(); }}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold text-ink2 hover:border-[#0876c8] hover:text-[#0876c8]"
          >
            화면 편집
          </button>
        </div>
      ) : null}

      <WidgetPicker
        open={canEdit && picking}
        hiddenForDrag={dragNew !== null}
        layout={layout}
        onAdd={(id, size) => { commit([...layout, { id, size }]); setPicking(false); }}
        onClose={() => setPicking(false)}
        onDragStart={(id) => { grab.current = { col: 0, row: 0 }; setDragNew(id); }}
        onDragEnd={resetDrag}
      />

      {wide ? (
        <div
          ref={gridRef}
          className="relative grid grid-cols-12"
          style={{ gridAutoRows: CELL_H, gap: CELL_GAP, minHeight: canEdit ? rowsHeight(bottom + 4) : undefined }}
          onDragOver={dragOverGrid}
          onDrop={(e) => { if (canEdit && (dragId || dragNew)) drop(e); }}
        >
          {/* 모눈 — 편집 중에만 칸 사이 점으로 */}
          {canEdit && <GridDots rows={bottom + 4} />}
          {shown.map((slot) => {
            const box = boxes.get(slot.id)!;
            const isNew = !layout.some((s) => s.id === slot.id);
            const isDragged = dragId === slot.id || isNew;
            const isResizing = resizing === slot.id;
            const { Component, title } = WIDGETS[slot.id];
            return (
              <div
                key={slot.id}
                data-slot
                className="group/slot relative z-[1] min-w-0"
                style={{ gridColumn: `${box.x + 1} / span ${box.w}`, gridRow: `${box.y + 1} / span ${box.h}` }}
                draggable={canEdit && armed === slot.id}
                onPointerDown={(e) => {
                  if (!canEdit || (e.target as HTMLElement).closest('[role="separator"], button')) return;
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
                      data-widget-body
                      className={`min-h-0 flex-1 overflow-hidden [&>section]:overflow-y-auto ${canEdit ? 'pointer-events-none select-none opacity-80' : ''}`}
                    >
                      <Component />
                    </div>
                  </div>
                )}
                {canEdit && !isDragged && (
                  <>
                    {/* 빼기 — 위젯에 커서를 올리면 오른쪽 위에 뜬다 */}
                    <button
                      type="button"
                      onClick={() => commit(layout.filter((s) => s.id !== slot.id))}
                      className="absolute -top-2.5 -right-2.5 z-40 grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-border bg-panel text-ink3 opacity-0 shadow-md transition-opacity group-hover/slot:opacity-100 hover:border-[#c4432f] hover:text-[#c4432f] focus-visible:opacity-100"
                      aria-label={`${title} 빼기`}
                      title="빼기"
                    >
                      <X size={15} />
                    </button>
                    {/* 크기 단추 — 오른쪽 아래 */}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`${title} 크기 조절`}
                      title={slot.rows ? '끌어서 크기 조절, 두 번 누르면 원래 높이' : '끌어서 크기 조절'}
                      onPointerDown={(e) => startResize(slot.id, e)}
                      onDoubleClick={() => resetHeight(slot.id)}
                      className={`absolute -right-2.5 -bottom-2.5 z-40 grid h-8 w-8 cursor-nwse-resize touch-none place-items-center rounded-full border-2 border-[#0876c8] shadow-md ${
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
      ) : (
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: CELL_H, gridAutoFlow: 'row dense' }}>
          {order.map((slot) => {
            const { Component } = WIDGETS[slot.id];
            return (
              <div
                key={slot.id}
                className={`min-w-0 ${slot.size <= 6 ? 'col-span-12 lg:col-span-6' : 'col-span-12'}`}
                style={{ gridRowEnd: `span ${rowsOf(slot)}` }}
              >
                <div className="h-full overflow-hidden [&>section]:overflow-y-auto"><Component /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
