import { useEffect, useState, type ComponentType } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { moveSlot, nextSize, normalizeLayout, type WidgetSize, type WidgetSlot } from './dashboard';
import { ApprovalWidget, AttendanceWidget, NoticeWidget, ProjectWidget, ResourceWidget, TeamWidget, TodayWidget } from './widgets';

/**
 * 경영 현황 — 로그인 후 첫 화면. 위젯을 골라 순서·폭을 바꿔 둘 수 있다.
 * 배치는 사용자별로 이 브라우저에 저장한다(데이터베이스는 건드리지 않는다).
 */

const WIDGETS = {
  today: { title: '오늘 일정', Component: TodayWidget },
  attendance: { title: '내 근태', Component: AttendanceWidget },
  approval: { title: '전자결재', Component: ApprovalWidget },
  resource: { title: '자원예약', Component: ResourceWidget },
  team: { title: '우리 부서', Component: TeamWidget },
  notice: { title: '공지사항', Component: NoticeWidget },
  project: { title: '프로젝트', Component: ProjectWidget },
} satisfies Record<string, { title: string; Component: ComponentType }>;

type WidgetId = keyof typeof WIDGETS;
const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];

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

const storageKey = (userId: string) => `workfit.execDashboard.layout.${userId}`;

function loadLayout(userId: string | undefined): WidgetSlot<WidgetId>[] {
  if (!userId) return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return normalizeLayout(raw ? JSON.parse(raw) : null, WIDGET_IDS, DEFAULT_LAYOUT);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export default function ExecDashboardScreen() {
  const { user: me } = useAuth();
  const [layout, setLayout] = useState(() => loadLayout(me?.id));
  const [editing, setEditing] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // 로그인 사용자가 늦게 잡히면 그 사람 배치로 다시 읽는다
  useEffect(() => { setLayout(loadLayout(me?.id)); }, [me?.id]);

  const save = (next: WidgetSlot<WidgetId>[]) => {
    setLayout(next);
    if (!me?.id) return;
    try { localStorage.setItem(storageKey(me.id), JSON.stringify(next)); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };

  const hidden = WIDGET_IDS.filter((id) => !layout.some((s) => s.id === id));

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-3 pb-10">
      {/* 편집 도구 */}
      <div className="flex min-h-8 flex-wrap items-center justify-end gap-2">
        {editing && (
          <>
            {hidden.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => save([...layout, { id, size: id === 'today' || id === 'notice' ? 12 : 4 }])}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-[#9fcfee] px-2.5 py-1.5 text-[12px] font-bold text-[#0876c8] hover:bg-[#e0f0fb] dark:hover:bg-sky-500/15"
              >
                <Plus size={13} />{WIDGETS[id].title}
              </button>
            ))}
            <button type="button" onClick={() => save(DEFAULT_LAYOUT)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-ink3 hover:bg-panel-alt">
              기본 배치
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-bold ${editing ? 'bg-[#0876c8] text-white hover:bg-[#066aaf]' : 'border border-border text-ink2 hover:border-[#0876c8] hover:text-[#0876c8]'}`}
        >
          {editing ? '완료' : '화면 편집'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {layout.map((slot, index) => {
          const { Component, title } = WIDGETS[slot.id];
          return (
            <div
              key={slot.id}
              className={`${SPAN[slot.size]} relative min-w-0 ${editing ? 'rounded-[22px] outline-2 outline-offset-2 outline-dashed' : ''} ${
                editing && dragOver === index && dragFrom !== index ? 'outline-[#0876c8]' : 'outline-[#c9d6e6] dark:outline-white/20'
              } ${editing && dragFrom === index ? 'opacity-50' : ''}`}
              draggable={editing}
              onDragStart={(e) => { setDragFrom(index); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { if (dragFrom === null) return; e.preventDefault(); setDragOver(index); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) save(moveSlot(layout, dragFrom, index));
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
            >
              <div className={editing ? 'pointer-events-none h-full select-none' : 'h-full'}>
                <Component />
              </div>
              {editing && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-xl border border-border bg-panel p-1 shadow-sm">
                  <span className="grid h-7 w-7 cursor-grab place-items-center text-ink3" title="끌어서 옮기기" aria-label={`${title} 옮기기`}>
                    <GripVertical size={15} />
                  </span>
                  <button
                    type="button"
                    onClick={() => save(layout.map((s, i) => (i === index ? { ...s, size: nextSize(s.size) } : s)))}
                    className="h-7 min-w-[40px] cursor-pointer rounded-lg px-2 text-[11.5px] font-bold text-ink2 tabular-nums hover:bg-panel-alt"
                    title="폭 바꾸기"
                  >
                    {SIZE_LABEL[slot.size]}
                  </button>
                  <button
                    type="button"
                    onClick={() => save(layout.filter((_, i) => i !== index))}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-ink3 hover:bg-panel-alt hover:text-[#c4432f]"
                    aria-label={`${title} 숨기기`}
                    title="숨기기"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
