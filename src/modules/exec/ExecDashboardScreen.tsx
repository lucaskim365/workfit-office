import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { GripVertical, MoveDiagonal2, Plus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { insertSlot, normalizeLayout, snapHeight, snapSize, type WidgetSize, type WidgetSlot } from './dashboard';
import {
  ApprovalWidget,
  AttendanceWidget,
  AwayTodayWidget,
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
 * 위젯은 12칸 바둑판에 맞춰 붙는다 — 끌어서 옮기면 놓일 자리가 점선으로 보이고, 오른쪽 아래 단추로 폭·높이를 바꾼다.
 * 빈칸은 뒤 위젯이 자동으로 채운다.
 * 배치는 사용자별로 이 브라우저에 저장한다(데이터베이스는 건드리지 않는다).
 */

/** sizes — 고를 수 있는 폭(가장 좁은 것이 최소 폭), minH — 이보다 낮게는 줄이지 못하는 높이(px) */
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
  notice: { title: '공지사항', module: '게시판', size: 12, sizes: [4, 6, 8, 12], minH: 150, Component: NoticeWidget },
  recentPosts: { title: '최근 게시글', module: '게시판', size: 6, sizes: [4, 6, 8, 12], minH: 180, Component: RecentPostsWidget },
  project: { title: '프로젝트', module: '프로젝트', size: 4, sizes: [4, 6], minH: 160, Component: ProjectWidget },
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

/** 폭 → 칸 클래스. 좁은 화면에서는 한 줄 전체 */
const SPAN: Record<WidgetSize, string> = {
  4: 'col-span-12 lg:col-span-6 xl:col-span-4',
  6: 'col-span-12 lg:col-span-6',
  8: 'col-span-12 xl:col-span-8',
  12: 'col-span-12',
};
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

/** 바둑판 한 줄 높이(px) — 위젯 높이를 이 단위로 세어 칸을 잡고, 빈칸은 뒤 위젯이 채운다 */
const ROW = 4;

/** 바둑판 한 칸 — 안쪽 내용의 높이를 재어 몇 줄을 차지할지 정한다 */
function Cell({ gap, order, className, innerClass, children, ...rest }: {
  gap: number; order: number; className: string; innerClass: string; children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>) {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setRows(Math.max(1, Math.ceil((el.offsetHeight + gap) / ROW)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gap]);
  return (
    <div {...rest} data-slot className={`${className} min-w-0`} style={{ order, gridRowEnd: `span ${rows}` }}>
      <div ref={ref} data-slot-inner className={innerClass}>{children}</div>
    </div>
  );
}

export default function ExecDashboardScreen() {
  const { user: me } = useAuth();
  const [layout, setLayout] = useState(() => loadLayout(me?.id));
  const [editing, setEditing] = useState(false);
  /** 옮기는 중인 위젯 / 위젯 추가 창에서 끌어 오는 위젯 */
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [dragNew, setDragNew] = useState<WidgetId | null>(null);
  /** 놓일 자리(옮기는 위젯을 뺀 목록에서의 순번) */
  const [target, setTarget] = useState<number | null>(null);
  /** 크기 조절 중 미리 보이는 윤곽(px) */
  const [resize, setResize] = useState<{ id: WidgetId; w: number; h: number } | null>(null);
  /** 옮기기 끌기를 허락한 위젯 — 크기 단추·버튼을 누를 때는 옮기기가 시작되지 않게 */
  const [armed, setArmed] = useState<WidgetId | null>(null);
  const [picking, setPicking] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // 로그인 사용자가 늦게 잡히면 그 사람 배치로 다시 읽는다
  useEffect(() => { setLayout(loadLayout(me?.id)); }, [me?.id]);

  const persist = (next: WidgetSlot<WidgetId>[]) => {
    if (!me?.id) return;
    try { localStorage.setItem(storageKey(me.id), JSON.stringify(next)); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };
  const save = (next: WidgetSlot<WidgetId>[]) => { setLayout(next); persist(next); };

  const resetDrag = () => { setDragId(null); setDragNew(null); setTarget(null); setArmed(null); };

  const gap = editing ? 20 : 16;
  const dragging = dragId !== null || dragNew !== null;
  const base = dragId ? layout.filter((s) => s.id !== dragId) : layout;
  const at = target ?? (dragId ? layout.findIndex((s) => s.id === dragId) : base.length);
  /** 화면 순서 — 놓일 자리 앞뒤로 나머지가 비켜 선다(실제 순서는 놓을 때 바뀐다) */
  const orderOf = (id: WidgetId) => {
    if (id === dragId) return at;
    const i = base.findIndex((s) => s.id === id);
    return dragging && i >= at ? i + 1 : i;
  };

  /** 끌고 있는 위젯이 다른 위젯 위에 오면 — 그 위젯의 앞쪽 반이면 앞에, 뒤쪽 반이면 뒤에 놓는다 */
  const overSlot = (id: WidgetId, e: React.DragEvent<HTMLDivElement>) => {
    if (!editing || !dragging) return;
    e.preventDefault();
    if (id === dragId) return;
    const j = base.findIndex((s) => s.id === id);
    const r = e.currentTarget.getBoundingClientRect();
    const gridW = gridRef.current?.getBoundingClientRect().width ?? r.width;
    const before = r.width > gridW * 0.6 ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
    const next = before ? j : j + 1;
    if (next !== target) setTarget(next);
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragNew) {
      save(insertSlot(layout, { id: dragNew, size: WIDGETS[dragNew].size }, at));
      setPicking(false);
    } else if (dragId) {
      const slot = layout.find((s) => s.id === dragId);
      if (slot) save(insertSlot(base, slot, at));
    }
    resetDrag();
  };

  /**
   * 크기 바꾸기 — 오른쪽 아래 단추 하나로 폭(12칸 중 허용 폭)과 높이(20px 단위)를 함께.
   * 끄는 동안에는 점선 윤곽으로만 보이고, 놓을 때 바뀐다. 화면 배율 때문에 마우스 이동량을 실제 px 로 바꿔 쓴다.
   */
  const startResize = (index: number, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    const cell = (e.currentTarget as HTMLElement).closest('[data-slot]') as HTMLElement | null;
    const inner = cell?.querySelector('[data-slot-inner]') as HTMLElement | null;
    const body = cell?.querySelector('[data-widget-body]') as HTMLElement | null;
    if (!grid || !cell || !inner || !body) return;
    const slot = layout[index];
    const def = WIDGETS[slot.id];
    const gridRect = grid.getBoundingClientRect();
    const left = cell.getBoundingClientRect().left;
    const bodyRect = body.getBoundingClientRect();
    const pxPerClient = bodyRect.height ? body.offsetHeight / bodyRect.height : 1;
    const innerW0 = inner.offsetWidth;
    const innerH0 = inner.offsetHeight;
    const bodyH0 = body.offsetHeight;
    const colW = (n: number) => ((grid.offsetWidth + gap) * n) / 12 - gap;
    const startY = e.clientY;
    let size = slot.size;
    let h = bodyH0;
    let moved = false;
    const draw = () => setResize({
      id: slot.id,
      w: size === slot.size ? innerW0 : colW(size),
      h: innerH0 + Math.max(h, def.minH) - bodyH0,
    });
    draw();
    const onMove = (ev: PointerEvent) => {
      const nextSize = snapSize(((ev.clientX - left) / gridRect.width) * 12, def.sizes);
      const nextH = snapHeight(bodyH0 + (ev.clientY - startY) * pxPerClient, def.minH);
      if (nextSize === size && nextH === h) return;
      moved = true;
      size = nextSize;
      h = nextH;
      draw();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResize(null);
      if (moved) save(layout.map((s, i) => (i === index ? { ...s, size, h } : s)));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /** 높이를 내용 높이로 되돌리기(크기 단추 두 번 누르기) */
  const resetHeight = (index: number) => save(layout.map((s, i) => (i === index ? { id: s.id, size: s.size } : s)));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-3 pb-10">
      {/* 편집 도구 — 편집 중에는 파란 띠로 */}
      {editing ? (
        <div className="flex items-center gap-2 rounded-2xl bg-[#e0f0fb] px-3 py-2 dark:bg-sky-500/15">
          <button type="button" onClick={() => setPicking(true)} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0876c8] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#066aaf]">
            <Plus size={15} />위젯 추가
          </button>
          <button type="button" onClick={() => save(DEFAULT_LAYOUT)} className="cursor-pointer rounded-lg px-3 py-2 text-[12.5px] font-bold text-[#2f6fa5] hover:bg-white/70 dark:text-sky-200 dark:hover:bg-white/10">
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
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setEditing(true); resetDrag(); }}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold text-ink2 hover:border-[#0876c8] hover:text-[#0876c8]"
          >
            화면 편집
          </button>
        </div>
      )}

      <WidgetPicker
        open={editing && picking}
        hiddenForDrag={dragNew !== null}
        layout={layout}
        onAdd={(id, size) => { save(insertSlot(layout, { id, size }, layout.length)); setPicking(false); }}
        onClose={() => setPicking(false)}
        onDragStart={(id) => setDragNew(id)}
        onDragEnd={resetDrag}
      />

      <div
        ref={gridRef}
        className={`grid grid-cols-12 ${editing ? 'gap-x-5' : 'gap-x-4'}`}
        style={{ gridAutoRows: ROW, gridAutoFlow: 'row dense' }}
        onDragOver={(e) => { if (editing && dragging) e.preventDefault(); }}
        onDrop={(e) => { if (editing && dragging) drop(e); }}
      >
        {layout.map((slot, index) => {
          const { Component, title, minH } = WIDGETS[slot.id];
          const isDragged = dragId === slot.id;
          const preview = resize?.id === slot.id ? resize : null;
          return (
            <Cell
              key={slot.id}
              gap={gap}
              order={orderOf(slot.id)}
              className={`${SPAN[slot.size]} group/slot`}
              innerClass={`relative flex flex-col ${
                editing
                  ? `rounded-[24px] p-2 ${
                      isDragged
                        ? 'border-2 border-dashed border-[#0876c8] bg-[#0876c8]/[.06]'
                        : `ring-2 transition-[box-shadow,background-color] ${preview ? 'bg-[#dcebf9] ring-[#0876c8] dark:bg-sky-500/15' : 'bg-[#e8f0f9] ring-transparent hover:ring-[#9fcfee] dark:bg-white/5'}`
                    }`
                  : ''
              }`}
              draggable={editing && armed === slot.id}
              onPointerDown={(e) => {
                if (!editing || (e.target as HTMLElement).closest('[role="separator"], button')) return;
                setArmed(slot.id);
              }}
              onPointerUp={() => { if (!dragId) setArmed(null); }}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', slot.id);
                // 끌리는 그림을 뜬 다음에 자리 표시로 바꾼다
                setTimeout(() => setDragId(slot.id), 0);
              }}
              onDragOver={(e) => overSlot(slot.id, e)}
              onDragEnd={resetDrag}
            >
              <div className={isDragged ? 'invisible flex flex-col' : 'contents'}>
                {/* 편집 줄 — 위젯 내용을 가리지 않게 위젯 위에 따로 둔다 */}
                {editing && (
                  <div className="flex cursor-grab items-center gap-2 px-1.5 pb-2 active:cursor-grabbing" title="끌어서 옮기기">
                    <GripVertical size={16} className="shrink-0 text-[#6f8fb3]" aria-label={`${title} 옮기기`} />
                    <span className="flex-1" />
                    <button
                      type="button"
                      onClick={() => save(layout.filter((_, i) => i !== index))}
                      className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg bg-panel text-ink3 shadow-sm hover:text-[#c4432f]"
                      aria-label={`${title} 빼기`}
                      title="빼기"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
                <div
                  data-widget-body
                  className={`${editing ? 'pointer-events-none select-none opacity-80' : ''} ${slot.h ? 'overflow-hidden [&>section]:overflow-y-auto' : ''}`}
                  style={slot.h ? { height: Math.max(slot.h, minH) } : { minHeight: minH }}
                >
                  <Component />
                </div>
              </div>
              {/* 크기 조절 중 — 바뀔 크기를 점선 윤곽으로 */}
              {preview && (
                <div
                  className="pointer-events-none absolute top-0 left-0 z-30 rounded-[24px] border-2 border-dashed border-[#0876c8] bg-[#0876c8]/[.08]"
                  style={{ width: preview.w, height: preview.h }}
                />
              )}
              {/* 크기 단추 — 오른쪽 아래 하나 */}
              {editing && !isDragged && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`${title} 크기 조절`}
                  title={slot.h ? '끌어서 크기 조절, 두 번 누르면 원래 높이' : '끌어서 크기 조절'}
                  onPointerDown={(e) => startResize(index, e)}
                  onDoubleClick={() => resetHeight(index)}
                  className={`absolute -right-2.5 -bottom-2.5 z-40 grid h-8 w-8 cursor-nwse-resize touch-none place-items-center rounded-full border-2 border-[#0876c8] shadow-md ${
                    preview ? 'bg-[#0876c8] text-white' : 'bg-panel text-[#0876c8] hover:bg-[#e0f0fb]'
                  }`}
                >
                  <MoveDiagonal2 size={15} />
                </div>
              )}
            </Cell>
          );
        })}
        {/* 위젯 추가 창에서 끌어 오는 위젯이 놓일 자리 */}
        {dragNew && target !== null && (
          <Cell
            gap={gap}
            order={at}
            className={SPAN[WIDGETS[dragNew].size]}
            innerClass="rounded-[24px] border-2 border-dashed border-[#0876c8] bg-[#0876c8]/[.06]"
            onDragOver={(e) => { e.preventDefault(); }}
          >
            <div style={{ height: WIDGETS[dragNew].minH + 40 }} />
          </Cell>
        )}
        {/* 맨 끝에 놓을 자리 */}
        {editing && dragging && (
          <div
            className={`col-span-12 h-20 rounded-[20px] border-2 border-dashed ${target === base.length ? 'border-[#0876c8]' : 'border-border'}`}
            style={{ order: 10000, gridRowEnd: `span ${Math.ceil((80 + gap) / ROW)}` }}
            onDragOver={(e) => { e.preventDefault(); if (target !== base.length) setTarget(base.length); }}
          />
        )}
      </div>
    </div>
  );
}
