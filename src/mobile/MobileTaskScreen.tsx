import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Tags,
  User as UserIcon,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useUsers } from '@/features/user/useUsers';
import { resolveWorkPlanScope, canViewWorkPlan } from '@/features/auth/scopeHelper';
import { useDepartments } from '@/features/department/useDepartments';
import { resolveDeptId } from '@/domain/department/engine';
import { buildCalendarMonth, calendarToday, isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import type { OutsideScheduleView } from '@/domain/outsideWork/view';
import type { User } from '@/domain/user/schema';
import type { DayCell, DayEntry } from '@/domain/workPlan/dayEntries';
import { useDayEntryIndex } from '@/features/workPlan/useDayEntryIndex';
import { BirthdayMark } from '@/features/birthday/BirthdayProvider';
import CalendarEventModal from '@/modules/gw/calendar/CalendarEventModal';
import { OutsideWorkDetailModal } from '@/modules/gw/outsideWork/OutsideWorkDetailModal';
import { chipLook, timeRangeOf } from '@/modules/gw/task/components/entryChipLook';
import { MobileWorkPlanEventSheet } from '@/modules/gw/task/event/MobileWorkPlanEventSheet';
import { WorkPlanTagManager } from '@/modules/gw/task/event/WorkPlanTagManager';
import type { EventTarget } from '@/modules/gw/task/event/eventFormMapping';
import { createTarget, routeEntry } from '@/modules/gw/task/event/entryRouting';
import MobileCommonHeader from './MobileCommonHeader';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 모바일 앱 틀(z-[100]) 위에 띄우는 공통 창 층 */
const MOBILE_MODAL_Z = 'z-[110]';

/** 'YYYY-MM-DD' 에 일수를 더한다(시간대 이동 없이 UTC 날짜 계산) */
function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dateTitleOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일 (${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

export default function MobileTaskScreen() {
  const { user } = useAuth();
  const usersQuery = useUsers();
  if (!user) {
    return (
      <div className="flex h-full flex-col overflow-hidden" style={{ background: '#f2f8fc' }}>
        <MobileCommonHeader title="업무계획" />
        <div className="grid flex-1 place-items-center text-[12px] font-semibold text-ink3">
          {usersQuery.isLoading ? '불러오는 중…' : '사용자 정보를 불러올 수 없습니다.'}
        </div>
      </div>
    );
  }
  return <MobileTaskBody actor={user} />;
}

/**
 * 모바일 업무계획 — 날짜를 고르면 그 날 항목(일반·회의·외근·출장·결재·캘린더 일정)을 시간순으로.
 * [+] → 전체 화면 일정 창(PC와 같은 저장·같은 규칙). 다른 사람에게는 회의 초대만.
 */
function MobileTaskBody({ actor }: { actor: User }) {
  const { userRoles, isSuperAdmin, canAction } = usePermission();
  const canManageTags = isSuperAdmin || canAction('S_GW_WORK_PLAN_ADMIN', 'update');
  const org = useOrgTree();
  const usersQuery = useUsers();
  const departmentsQuery = useDepartments();
  const deptId = useMemo(
    () => resolveDeptId(departmentsQuery.data ?? [], actor.dept),
    [departmentsQuery.data, actor.dept],
  );
  const actorActive = actor.status === '사용';

  const today = calendarToday();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [view, setView] = useState<'me' | 'team'>('me');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // 업무계획 로스터 원칙 — 퇴사자(미사용·퇴사일)는 빼고
  const users = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.status === '사용' && !u.resignedAt),
    [usersQuery.data],
  );
  const actorScope = useMemo(() => resolveWorkPlanScope(actor, userRoles, org), [actor, userRoles, org]);

  // 정책상 열람 가능한 팀원 목록 (본인 제외)
  const teamMembers = useMemo(
    () =>
      users
        .filter((u) => u.id !== actor.id)
        .filter((u) => canViewWorkPlan(actor, u, actorScope, org))
        .sort((a, b) => {
          const rankDiff = org.rankOf(a.position) - org.rankOf(b.position);
          if (rankDiff !== 0) return rankDiff;
          return a.name.localeCompare(b.name, 'ko');
        }),
    [users, actor, actorScope, org],
  );

  const deptList = useMemo(() => {
    const s = new Set<string>();
    teamMembers.forEach((m) => {
      if (m.dept) s.add(m.dept);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [teamMembers]);

  const displayedMembers = useMemo(
    () => (deptFilter === 'all' ? teamMembers : teamMembers.filter((m) => m.dept === deptFilter)),
    [teamMembers, deptFilter],
  );

  // 칸 조립 — 고른 날의 달 전체(일정 창 시간표에서 날짜를 옮겨도 겹쳐 보이게, PC 표와 같은 범위)
  const month = selectedDate.slice(0, 7);
  const dates = useMemo(() => {
    try {
      return buildCalendarMonth(month).map((c) => c.date);
    } catch {
      return [];
    }
  }, [month]);
  const members = useMemo(() => [actor, ...teamMembers], [actor, teamMembers]);
  const { cellOf } = useDayEntryIndex({ actor, deptId, members, dates });

  /** 일정 창 — 새 일정·수정·보기 공용. key는 대상이 바뀔 때마다 새로 띄우기 위한 것. */
  const [sheet, setSheet] = useState<{ key: number; target: EventTarget } | null>(null);
  /** 회의 외 캘린더 일정(사내행사 등) 상세 */
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null);
  /** 결재 완료 외근·출장과 동행 외근 상세 */
  const [outsideDetail, setOutsideDetail] = useState<{ view: OutsideScheduleView; entry: DayEntry } | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const openSheet = (target: EventTarget) => {
    setNotice('');
    setSheet((prev) => ({ key: (prev?.key ?? 0) + 1, target }));
  };

  /** [+] — 오늘이면 지금 다음 30분, 아니면 09:00~09:30. 다른 사람이면 회의 초대만 */
  const handleCreate = (member: User) => {
    openSheet(createTarget(selectedDate, member, actor, today, new Date()));
  };

  /** 항목 탭 — PC 표와 같은 규칙([[entryRouting]]) */
  const handleOpenEntry = (entry: DayEntry) => {
    const route = routeEntry(entry, actor, actorActive);
    if (!route) return;
    if ('sheet' in route) openSheet(route.sheet);
    else if ('calendar' in route) setCalendarEvent(route.calendar);
    else setOutsideDetail(route.outside);
  };

  const myCell = cellOf(actor.id, selectedDate);

  return (
    <div className="relative flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader
        title="업무계획"
        subtitle={dateTitleOf(selectedDate)}
        rightAction={canManageTags ? (
          <button
            type="button"
            onClick={() => setTagManagerOpen(true)}
            aria-label="태그 관리"
            className="grid h-8.5 w-8.5 place-items-center rounded-xl text-white/90 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <Tags size={18} />
          </button>
        ) : undefined}
      />

      {/* 날짜 이동 */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-white px-3 py-2 shadow-2xs">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
          className="grid h-8 w-8 place-items-center rounded-xl text-ink2 transition-colors hover:bg-panel-alt"
          aria-label="이전 날"
        >
          <ChevronLeft size={18} />
        </button>
        <label className="relative flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <Calendar size={14} className="text-teal" />
          <span>{dateTitleOf(selectedDate)}</span>
          {/* 날짜를 눌러 바로 고른다 */}
          <input
            type="date"
            aria-label="날짜 선택"
            value={selectedDate}
            onChange={(e) => isValidCalendarDate(e.target.value) && setSelectedDate(e.target.value)}
            className="absolute inset-0 opacity-0"
          />
        </label>
        <button
          type="button"
          onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
          className="grid h-8 w-8 place-items-center rounded-xl text-ink2 transition-colors hover:bg-panel-alt"
          aria-label="다음 날"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 나 / 팀원 전환 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-white px-3 py-2">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-panel-alt p-1" role="tablist" aria-label="보기">
          {([['me', '나'], ['team', `팀원 ${teamMembers.length}명`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`rounded-lg py-1.5 text-[12px] font-bold transition-colors ${
                view === key ? 'bg-white text-ink shadow-2xs' : 'text-ink3'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {selectedDate !== today && (
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-bold text-ink2 active:bg-panel-alt"
          >
            오늘
          </button>
        )}
      </div>

      {notice && (
        <div aria-live="polite" className="shrink-0 border-b border-teal/20 bg-teal-soft/25 px-4 py-2 text-[11.5px] font-semibold text-teal">
          {notice}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3.5">
        {view === 'me' ? (
          <div className="rounded-2xl border border-teal/40 bg-white p-3.5 shadow-xs">
            <DayList cell={myCell} onOpen={handleOpenEntry} />
          </div>
        ) : (
          <div className="space-y-3">
            {deptList.length > 1 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                aria-label="부서 필터"
                className="w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-bold text-ink shadow-2xs outline-none"
              >
                <option value="all">전체 부서 ({teamMembers.length}명)</option>
                {deptList.map((d) => (
                  <option key={d} value={d}>
                    {d} ({teamMembers.filter((m) => m.dept === d).length}명)
                  </option>
                ))}
              </select>
            )}

            {displayedMembers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-white/70 p-8 text-center text-ink3">
                <UserIcon size={24} className="mx-auto mb-1 text-ink3/40" />
                <p className="text-[12px] font-bold text-ink">표시할 팀원이 없습니다.</p>
              </div>
            ) : (
              displayedMembers.map((member) => (
                <div key={member.id} className="rounded-2xl border border-border/80 bg-white p-3.5 shadow-2xs">
                  <div className="mb-2 flex items-center gap-2 border-b border-border/50 pb-2">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-700 text-[10.5px] font-black text-white">
                      {member.name.slice(-2)}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <span className="truncate text-[12.5px] font-black text-ink">{member.name}</span>
                      <BirthdayMark userId={member.id} />
                      <span className="shrink-0 text-[10.5px] text-ink3">{member.position}</span>
                    </div>
                    {actorActive && (
                      <button
                        type="button"
                        onClick={() => handleCreate(member)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-700 active:scale-95"
                      >
                        <UserPlus size={12} />
                        회의 초대
                      </button>
                    )}
                  </div>
                  <DayList cell={cellOf(member.id, selectedDate)} onOpen={handleOpenEntry} />
                </div>
              ))
            )}
          </div>
        )}
        {/* 아래 [+] 버튼에 마지막 항목이 가리지 않게 */}
        {view === 'me' && actorActive && <div className="h-16" />}
      </div>

      {view === 'me' && actorActive && (
        <button
          type="button"
          onClick={() => handleCreate(actor)}
          aria-label="새 일정"
          className="absolute right-4 z-10 grid h-13 w-13 place-items-center rounded-full bg-teal text-white shadow-lg active:scale-95"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={24} strokeWidth={2.4} />
        </button>
      )}

      {sheet && (
        <MobileWorkPlanEventSheet
          key={sheet.key}
          target={sheet.target}
          actor={actor}
          deptId={deptId}
          users={users}
          cellOf={cellOf}
          onClose={() => setSheet(null)}
          onSaved={setNotice}
        />
      )}

      {/* 회의 외 캘린더 일정(사내행사 등) — 캘린더 일정 창 그대로 */}
      {calendarEvent && (
        <CalendarEventModal
          zClass={MOBILE_MODAL_Z}
          actor={{ userId: actor.id, active: actorActive, deptId }}
          initialDate={calendarEvent.date}
          event={calendarEvent}
          myProjects={[]}
          deptName={actor.dept || null}
          ownerName={
            calendarEvent.ownerUserId !== actor.id
              ? users.find((u) => u.id === calendarEvent.ownerUserId)?.name ?? null
              : null
          }
          onClose={() => setCalendarEvent(null)}
          onSaved={() => {
            setCalendarEvent(null);
            setNotice('일정을 저장했습니다.');
          }}
          onRemoved={() => {
            setCalendarEvent(null);
            setNotice('일정을 삭제했습니다.');
          }}
        />
      )}

      {outsideDetail && (
        <OutsideWorkDetailModal
          zClass={MOBILE_MODAL_Z}
          view={outsideDetail.view}
          viewer={{ userId: actor.id, active: actorActive, dept: actor.dept }}
          users={usersQuery.data ?? []}
          onClose={() => setOutsideDetail(null)}
          // 등록 본인만 수정 버튼이 보인다 — 동행 칸에서 열었어도 본인 칸 기준으로 일정 창을 연다
          onEdit={() => {
            const entry = { ...outsideDetail.entry, companionOf: undefined };
            setOutsideDetail(null);
            openSheet({ mode: 'edit', entry });
          }}
        />
      )}

      {tagManagerOpen && (
        <FullSheet title="태그 관리" onClose={() => setTagManagerOpen(false)}>
          <WorkPlanTagManager canEdit={canManageTags} />
        </FullSheet>
      )}
    </div>
  );
}

/** 그 날 항목 목록 — 시간순(조립 결과 순서 그대로) + 이전 메모(읽기 전용) */
function DayList({ cell, onOpen }: { cell: DayCell; onOpen: (entry: DayEntry) => void }) {
  if (cell.entries.length === 0 && !cell.legacyMemo) {
    return <div className="py-4 text-center text-[11.5px] text-ink3">일정이 없습니다.</div>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {cell.entries.map((entry) => (
        <EntryRow key={entry.key} entry={entry} onOpen={onOpen} />
      ))}
      {cell.legacyMemo && <LegacyMemo text={cell.legacyMemo} divided={cell.entries.length > 0} />}
    </div>
  );
}

/** 항목 한 줄 — 시간 + `[태그] 제목`. 결재 휴가는 상세가 없어 누르지 않는다. */
function EntryRow({ entry, onOpen }: { entry: DayEntry; onOpen: (entry: DayEntry) => void }) {
  const { label, badgeClass } = chipLook(entry);
  const openable = !(entry.source === 'APPROVAL' && !entry.outside);
  const body = (
    <>
      <span className="w-[76px] shrink-0 text-[11px] font-semibold text-ink3">{timeRangeOf(entry)}</span>
      <span className={`flex min-w-0 flex-1 items-center gap-1 rounded-lg border px-2 py-1.5 text-[12px] font-bold ${badgeClass}`}>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {entry.roomStatus === 'PENDING' && (
          <span className="shrink-0 rounded bg-amber-soft px-1 text-[10px] font-bold text-amber">대기</span>
        )}
        {entry.roomStatus === 'REJECTED' && (
          <span className="shrink-0 rounded bg-danger/10 px-1 text-[10px] font-bold text-danger">회의실 반려</span>
        )}
        {entry.outside?.source === 'APPROVAL' && (
          <Check size={11} strokeWidth={3} className="shrink-0 opacity-40" aria-label="결재 완료" />
        )}
      </span>
    </>
  );
  if (!openable) return <div className="flex items-center gap-2">{body}</div>;
  return (
    <button type="button" onClick={() => onOpen(entry)} className="flex w-full items-center gap-2 text-left active:opacity-70">
      {body}
    </button>
  );
}

/** 이전 메모 — 예전 자유 글(서식 제거). 읽기 전용, 4줄 넘으면 접어 둔다. */
function LegacyMemo({ text, divided }: { text: string; divided: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className={divided ? 'mt-1 border-t border-border/50 pt-2' : ''}>
      <div className="mb-0.5 text-[10.5px] font-bold text-ink3">이전 메모</div>
      <div
        ref={ref}
        className={`whitespace-pre-line break-words text-[11.5px] leading-relaxed text-ink3 ${expanded ? '' : 'line-clamp-4'}`}
      >
        {text}
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-ink3"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? '접기' : '더보기'}
        </button>
      )}
    </div>
  );
}

/** 전체 화면 시트 — 닫기 · 제목 + 스크롤 본문 */
function FullSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    // 모바일 앱 틀(가운데 최대 480px)과 같은 폭으로 화면 전체를 덮는다
    <div className="fixed inset-0 z-[110] flex justify-center bg-black/10">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-[480px] flex-col bg-panel"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <header className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink2 active:bg-panel-alt"
          >
            <X size={20} />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{title}</h2>
        </header>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
