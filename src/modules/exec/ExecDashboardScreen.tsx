import { useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { insertSlot, moveSlot, normalizeLayout, snapSize, type WidgetSize, type WidgetSlot } from './dashboard';
import { ApprovalWidget, AttendanceWidget, NoticeWidget, ProjectWidget, ResourceWidget, TeamWidget, TodayWidget } from './widgets';

/**
 * 경영 현황 — 로그인 후 첫 화면. 편집 모드에서 모듈별 위젯 목록을 끌어 넣고,
 * 위젯은 끌어서 순서를 바꾸고 오른쪽 가장자리를 끌어 폭을 바꾼다.
 * 배치는 사용자별로 이 브라우저에 저장한다(데이터베이스는 건드리지 않는다).
 */

interface WidgetDef { title: string; module: string; size: WidgetSize; Component: ComponentType }

const WIDGETS = {
  today: { title: '오늘 일정', module: '일정', size: 12, Component: TodayWidget },
  attendance: { title: '내 근태', module: '근태', size: 8, Component: AttendanceWidget },
  approval: { title: '전자결재', module: '전자결재', size: 4, Component: ApprovalWidget },
  resource: { title: '내 자원예약', module: '자원예약', size: 4, Component: ResourceWidget },
  team: { title: '우리 부서', module: '조직도', size: 4, Component: TeamWidget },
  notice: { title: '공지사항', module: '게시판', size: 12, Component: NoticeWidget },
  project: { title: '프로젝트', module: '프로젝트', size: 4, Component: ProjectWidget },
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
const SIZE_LABEL: Record<WidgetSize, string> = { 4: '1/3', 6: '1/2', 8: '2/3', 12: '전체' };
/** 미리보기를 그릴 실제 폭 — 이 폭으로 그린 뒤 줄여 보인다 */
const PREVIEW_WIDTH: Record<WidgetSize, number> = { 4: 420, 6: 620, 8: 860, 12: 1180 };
const PREVIEW_W = 188;
const PREVIEW_H = 100;

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

/** 위젯 목록의 카드 — 실제 위젯을 줄여 보인다. 끌어서 놓거나 눌러서 맨 끝에 넣는다 */
function TrayCard({ id, placed, onAdd, onDragStart, onDragEnd }: { id: WidgetId; placed: boolean; onAdd: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const def = WIDGETS[id];
  const w = PREVIEW_WIDTH[def.size];
  return (
    <div
      role="button"
      tabIndex={placed ? -1 : 0}
      aria-disabled={placed}
      data-tray={id}
      draggable={!placed}
      onClick={() => { if (!placed) onAdd(); }}
      onKeyDown={(e) => { if (!placed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAdd(); } }}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_NEW, id); e.dataTransfer.effectAllowed = 'copy'; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`group shrink-0 text-left ${placed ? 'cursor-default opacity-45' : 'cursor-grab active:cursor-grabbing'}`}
      style={{ width: PREVIEW_W }}
    >
      <div className={`relative overflow-hidden rounded-2xl border bg-[var(--color-bg)] ${placed ? 'border-border' : 'border-border group-hover:border-[#0876c8]'}`} style={{ height: PREVIEW_H }}>
        <div className="pointer-events-none absolute top-2 left-2 origin-top-left select-none" style={{ width: w, zoom: (PREVIEW_W - 16) / w }} aria-hidden="true" inert>
          <def.Component />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--color-bg)] to-transparent" />
        {!placed && (
          <span className="absolute right-2 bottom-2 grid h-6 w-6 place-items-center rounded-full bg-[#0876c8] text-white opacity-0 shadow-sm group-hover:opacity-100">
            <Plus size={14} />
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between px-1">
        <span className="text-[12px] font-bold text-ink">{def.title}</span>
        <span className="text-[11px] text-ink3">{placed ? '배치됨' : SIZE_LABEL[def.size]}</span>
      </div>
    </div>
  );
}

export default function ExecDashboardScreen() {
  const { user: me } = useAuth();
  const [layout, setLayout] = useState(() => loadLayout(me?.id));
  const [editing, setEditing] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragNew, setDragNew] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [resizing, setResizing] = useState<number | null>(null);
  /** 옮기기 끌기를 허락한 위젯 — 폭 손잡이·버튼을 누를 때는 옮기기가 시작되지 않게 */
  const [armed, setArmed] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // 로그인 사용자가 늦게 잡히면 그 사람 배치로 다시 읽는다
  useEffect(() => { setLayout(loadLayout(me?.id)); }, [me?.id]);

  const persist = (next: WidgetSlot<WidgetId>[]) => {
    if (!me?.id) return;
    try { localStorage.setItem(storageKey(me.id), JSON.stringify(next)); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };
  const save = (next: WidgetSlot<WidgetId>[]) => { setLayout(next); persist(next); };

  const resetDrag = () => { setDragFrom(null); setDragNew(false); setDragOver(null); setArmed(null); };

  const dropAt = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    const newId = e.dataTransfer.getData(DRAG_NEW) as WidgetId | '';
    if (newId && WIDGETS[newId]) save(insertSlot(layout, { id: newId, size: WIDGETS[newId].size }, index));
    else if (dragFrom !== null) save(moveSlot(layout, dragFrom, index > dragFrom ? index - 1 : index));
    resetDrag();
  };

  /** 오른쪽 가장자리를 끌어 폭 바꾸기 — 12칸 기준 가장 가까운 폭으로 맞춘다 */
  const startResize = (index: number, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    const cell = (e.currentTarget as HTMLElement).closest('[data-slot]') as HTMLElement | null;
    if (!grid || !cell) return;
    const gridRect = grid.getBoundingClientRect();
    const left = cell.getBoundingClientRect().left;
    setResizing(index);
    let latest = layout;
    const onMove = (ev: PointerEvent) => {
      const cols = ((ev.clientX - left) / gridRect.width) * 12;
      const size = snapSize(cols);
      if (latest[index].size !== size) {
        latest = latest.map((s, i) => (i === index ? { ...s, size } : s));
        setLayout(latest);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResizing(null);
      persist(latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const dragging = dragFrom !== null || dragNew;

  return (
    <div className={`mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-3 ${editing ? 'pb-[240px]' : 'pb-10'}`}>
      {/* 편집 도구 */}
      <div className="flex min-h-8 items-center justify-end gap-2">
        {editing && (
          <button type="button" onClick={() => save(DEFAULT_LAYOUT)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-ink3 hover:bg-panel-alt">
            기본 배치
          </button>
        )}
        <button
          type="button"
          onClick={() => { setEditing((v) => !v); resetDrag(); }}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-bold ${editing ? 'bg-[#0876c8] text-white hover:bg-[#066aaf]' : 'border border-border text-ink2 hover:border-[#0876c8] hover:text-[#0876c8]'}`}
        >
          {editing ? '완료' : '화면 편집'}
        </button>
      </div>

      {/* 위젯 목록 — 모듈별 */}
      {editing && (
        <div
          className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-[22px] border border-border bg-panel/95 px-4 pt-3 pb-3 shadow-[0_16px_40px_-12px_rgba(16,40,80,.35)] backdrop-blur"
          style={{ width: 'min(1180px, calc(100vw / var(--font-scale, 1) - 32px))' }}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
          <div className="flex gap-6 overflow-x-auto pb-1">
            {MODULES.map((module) => (
              <div key={module} className="shrink-0">
                <div className="mb-2 px-1 text-[12px] font-extrabold text-ink2">{module}</div>
                <div className="flex gap-3">
                  {WIDGET_IDS.filter((id) => WIDGETS[id].module === module).map((id) => (
                    <TrayCard
                      key={id}
                      id={id}
                      placed={layout.some((s) => s.id === id)}
                      onAdd={() => save(insertSlot(layout, { id, size: WIDGETS[id].size }, layout.length))}
                      onDragStart={() => setDragNew(true)}
                      onDragEnd={resetDrag}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={gridRef} className="grid grid-cols-12 gap-4">
        {layout.map((slot, index) => {
          const { Component, title } = WIDGETS[slot.id];
          const isTarget = editing && dragging && dragOver === index && dragFrom !== index;
          return (
            <div
              key={slot.id}
              data-slot
              className={`${SPAN[slot.size]} relative min-w-0 transition-[outline-color] ${
                editing ? 'rounded-[22px] outline-2 outline-offset-2 outline-dashed' : ''
              } ${isTarget || resizing === index ? 'outline-[#0876c8]' : 'outline-[#c9d6e6] dark:outline-white/20'} ${editing && dragFrom === index ? 'opacity-40' : ''}`}
              draggable={editing && armed === index}
              onPointerDown={(e) => {
                if (!editing || (e.target as HTMLElement).closest('[role="separator"], button')) return;
                setArmed(index);
              }}
              onPointerUp={() => { if (dragFrom === null) setArmed(null); }}
              onDragStart={(e) => { setDragFrom(index); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { if (!editing) return; e.preventDefault(); setDragOver(index); }}
              onDrop={(e) => dropAt(index, e)}
              onDragEnd={resetDrag}
            >
              {/* 놓을 자리 표시 — 이 위젯 앞에 들어간다 */}
              {isTarget && <div className="absolute inset-y-2 -left-[10px] z-20 w-1 rounded-full bg-[#0876c8]" />}
              <div className={editing ? 'pointer-events-none h-full select-none' : 'h-full'}>
                <Component />
              </div>
              {editing && (
                <>
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded-xl border border-border bg-panel p-1 shadow-sm">
                    <span className="grid h-7 w-7 cursor-grab place-items-center text-ink3" title="끌어서 옮기기" aria-label={`${title} 옮기기`}>
                      <GripVertical size={15} />
                    </span>
                    <span className="min-w-[34px] px-1 text-center text-[11.5px] font-bold text-ink2 tabular-nums">{SIZE_LABEL[slot.size]}</span>
                    <button
                      type="button"
                      onClick={() => save(layout.filter((_, i) => i !== index))}
                      className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-ink3 hover:bg-panel-alt hover:text-[#c4432f]"
                      aria-label={`${title} 빼기`}
                      title="빼기"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {/* 폭 조절 손잡이 — 오른쪽 가장자리 */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`${title} 폭 조절`}
                    title="끌어서 폭 조절"
                    onPointerDown={(e) => startResize(index, e)}
                    className="group/rs absolute inset-y-0 -right-[11px] z-10 flex w-[14px] cursor-ew-resize touch-none items-center justify-center"
                  >
                    <span className={`h-14 w-1.5 rounded-full ${resizing === index ? 'bg-[#0876c8]' : 'bg-[#b7c6d9] group-hover/rs:bg-[#0876c8] dark:bg-white/30'}`} />
                  </div>
                  {resizing === index && (
                    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[20px] bg-[#0876c8]/8">
                      <span className="rounded-xl bg-[#0876c8] px-4 py-2 text-[18px] font-black text-white tabular-nums shadow">{SIZE_LABEL[slot.size]}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        {/* 맨 끝에 놓을 자리 */}
        {editing && dragging && (
          <div
            className={`col-span-12 grid h-24 place-items-center rounded-[20px] border-2 border-dashed text-[12px] font-bold ${dragOver === layout.length ? 'border-[#0876c8] text-[#0876c8]' : 'border-border text-ink3'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(layout.length); }}
            onDrop={(e) => dropAt(layout.length, e)}
          >
            여기에 놓기
          </div>
        )}
      </div>
    </div>
  );
}
