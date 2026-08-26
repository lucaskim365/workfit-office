import { useMemo, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { buildCalendarMonth, calendarToday, moveCalendarMonth } from '@/domain/calendarEvent/calendarDate';
import type { WorkPlan } from '@/domain/workPlan/schema';
import type { User } from '@/domain/user/schema';
import { useUsers } from '@/features/user/useUsers';
import {
  useAllWorkPlans,
  useCreateWorkPlan,
  useMyWorkPlans,
  useRemoveWorkPlan,
  useUpdateWorkPlan,
} from '@/features/workPlan/useWorkPlans';
import { GwHead } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';

/**
 * 업무계획 — 이사진 등이 구글시트로 적던 개인 영업/업무 예정을 옮겨오는 화면.
 *
 * 처음엔 그룹웨어 일정관리처럼 달력 칩으로 전원을 표시하려 했으나, 실제로 만들어보니
 * 한 칸에 여러 명의 항목이 겹쳐 한눈에 안 들어왔다(피드백 2026-08-26). 그래서 구조를
 * 바꾼다 — **달력은 보조**(내 항목이 어느 날 있는지만 훑어보는 용도, 접어둘 수 있음),
 * **로스터가 주역**(선택한 날짜에 재직 중인 전 직원을 한 줄씩 나열, 카드에 자유 텍스트
 * 한 덩어리). 대표·상무·이사급은 로스터에 안 올린다 — 실무 인원 현황판이 목적이라
 * 경영진까지 줄 세우면 목적과 안 맞는다.
 */
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_NAMES_SUN0 = ['일', '월', '화', '수', '목', '금', '토'];

/** 로스터 제외 직급. "이사"가 들어가면 다 걸린다(대표이사·상무이사·이사 전부). */
const isExecutive = (user: User) => user.position.includes('이사');

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${year}년 ${m}월`;
}

function dayTitle(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAY_NAMES_SUN0[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

export default function WorkPlanScreen() {
  const { user: authenticatedUser } = useAuth();
  const usersQuery = useUsers();
  const users = usersQuery.data ?? [];
  const [demoUserId, setDemoUserId] = useState('U009');
  const actor = authenticatedUser
    ?? users.find((user) => user.id === demoUserId)
    ?? users.find((user) => user.status === '사용')
    ?? null;

  const today = calendarToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const cells = useMemo(() => buildCalendarMonth(month), [month]);
  const range = useMemo(() => ({ from: cells[0].date, to: cells[cells.length - 1].date }), [cells]);

  const workActor = useMemo(() => ({ userId: actor?.id ?? '__anonymous__', active: actor?.status === '사용' }), [actor]);
  // 로스터는 항상 전원 보기라 늘 켜져 있다. 내 달력 칩은 별도 쿼리(month 범위, 가벼움)로 뺀다.
  const mineQuery = useMyWorkPlans(workActor, range);
  const allDayQuery = useAllWorkPlans({ from: selectedDate, to: selectedDate }, true);
  const loading = usersQuery.isLoading || mineQuery.isLoading || allDayQuery.isLoading;

  const create = useCreateWorkPlan();
  const update = useUpdateWorkPlan();
  const remove = useRemoveWorkPlan();

  const myPlansByDate = useMemo(() => {
    const rows = new Map<string, WorkPlan[]>();
    (mineQuery.data ?? []).forEach((plan) => rows.set(plan.date, [...(rows.get(plan.date) ?? []), plan]));
    return rows;
  }, [mineQuery.data]);

  /** 로스터 대상 — 재직 + 대표/상무/이사 제외, 이름순. */
  const roster = useMemo(
    () => users.filter((user) => user.status === '사용' && !isExecutive(user)).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [users],
  );
  const dayPlanByOwner = useMemo(() => {
    const rows = new Map<string, WorkPlan>();
    (allDayQuery.data ?? []).forEach((plan) => rows.set(plan.ownerUserId, plan));
    return rows;
  }, [allDayQuery.data]);
  const myDayPlan = actor ? dayPlanByOwner.get(actor.id) : undefined;

  const save = async () => {
    if (draftText === null || !actor) return;
    const content = draftText.trim();
    if (content === '') return;
    try {
      if (myDayPlan) {
        await update.mutateAsync({ actor: workActor, id: myDayPlan.id, draft: { date: selectedDate, content } });
      } else {
        await create.mutateAsync({ actor: workActor, draft: { date: selectedDate, content } });
      }
      setDraftText(null);
      setNotice('저장했습니다.');
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    }
  };

  const removeMine = async () => {
    if (!myDayPlan || !window.confirm('오늘 작성한 계획을 삭제하시겠습니까?')) return;
    await remove.mutateAsync({ actor: workActor, id: myDayPlan.id });
    setNotice('삭제했습니다.');
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">불러오는 중…</div>;
  if (!actor) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead
        icon="🗓️"
        name="업무계획"
        right={!authenticatedUser ? (
          <select value={actor.id} onChange={(event) => setDemoUserId(event.target.value)} title="사용자 선택" className="h-9 rounded-lg border border-amber/30 bg-amber-soft/30 px-3 text-[10.5px] font-bold text-ink outline-none">
            {users.filter((user) => user.status === '사용').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        ) : undefined}
      />

      {notice && <div aria-live="polite" className="mt-4 rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      {/* 달력은 보조 — 내 항목이 있는 날만 훑어보는 용도라 접어둘 수 있다. */}
      <div className="mt-5 rounded-xl border border-border bg-panel shadow-sm">
        <button type="button" onClick={() => setCalendarOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
          <span className={`text-[11px] text-ink3 transition-transform ${calendarOpen ? 'rotate-90' : ''}`}>▶</span>
          <span className="text-[12px] font-bold text-ink">{monthLabel(month)} 달력 {calendarOpen ? '접기' : '펼치기'}</span>
          <span className="ml-1 text-[10px] font-semibold text-ink3">(내 항목만 표시 — 선택: {selectedDate})</span>
        </button>
        {calendarOpen && (
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 pb-2">
              <button type="button" onClick={() => setMonth(moveCalendarMonth(month, -1))} aria-label="이전 달" className="grid h-7 w-7 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
              <Button size="sm" onClick={() => setMonth(today.slice(0, 7))}>오늘</Button>
              <button type="button" onClick={() => setMonth(moveCalendarMonth(month, 1))} aria-label="다음 달" className="grid h-7 w-7 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 border-b border-border bg-panel-alt/65">
                  {WEEKDAYS.map((day, index) => (
                    <div key={day} className={`px-2 py-2 text-center text-[9.5px] font-bold ${index === 5 ? 'text-blue' : index === 6 ? 'text-danger' : 'text-ink3'}`}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((cell, index) => {
                    const mine = myPlansByDate.get(cell.date) ?? [];
                    const isToday = cell.date === today;
                    const selected = cell.date === selectedDate;
                    return (
                      <div
                        key={cell.date}
                        onClick={() => setSelectedDate(cell.date)}
                        className={`min-h-16 cursor-pointer border-b border-r border-border p-1.5 text-left align-top transition-colors ${selected ? 'bg-teal-soft/25' : 'hover:bg-panel-alt/45'} ${index % 7 === 6 ? 'border-r-0' : ''}`}
                      >
                        <span className={`grid h-5 w-5 place-items-center rounded-full text-[9.5px] font-bold ${isToday ? 'bg-teal text-white' : cell.inCurrentMonth ? 'text-ink2' : 'text-ink3/55'}`}>{Number(cell.date.slice(-2))}</span>
                        {mine.length > 0 && <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-teal" title={`내 계획 ${mine.length}건`} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 내 카드 — 항상 맨 위, 바로 쓰고 고칠 수 있게. */}
      <section className="mt-4 rounded-xl border border-teal/30 bg-teal-soft/10 shadow-sm">
        <div className="flex items-center justify-between border-b border-teal/20 px-4 py-2.5">
          <h3 className="text-[12.5px] font-extrabold text-ink">{dayTitle(selectedDate)} · 내 계획</h3>
          {myDayPlan && draftText === null && <Button size="sm" variant="danger" onClick={() => void removeMine()}>삭제</Button>}
        </div>
        <div className="p-3">
          {draftText !== null ? (
            <div className="space-y-2">
              <textarea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                maxLength={1000}
                rows={4}
                autoFocus
                placeholder="오늘 할 일을 자유롭게 적으세요"
                className="w-full resize-y rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none"
              />
              <div className="flex justify-end gap-1.5">
                <Button size="sm" onClick={() => setDraftText(null)}>취소</Button>
                <Button size="sm" variant="primary" disabled={draftText.trim() === ''} onClick={() => void save()}>저장</Button>
              </div>
            </div>
          ) : myDayPlan ? (
            <button type="button" onClick={() => setDraftText(myDayPlan.content)} className="block w-full whitespace-pre-wrap rounded-lg px-1 py-1 text-left text-[11.5px] text-ink hover:bg-panel-alt/50">
              {myDayPlan.content}
            </button>
          ) : (
            <button type="button" onClick={() => setDraftText('')} className="w-full rounded-lg border border-dashed border-border py-4 text-center text-[11px] font-semibold text-ink3 hover:border-teal/40 hover:text-teal">
              + 이 날짜에 계획 작성
            </button>
          )}
        </div>
      </section>

      {/* 로스터 — 재직 전원(경영진 제외), 남의 카드는 읽기 전용. */}
      <section className="mt-4 rounded-xl border border-border bg-panel shadow-sm">
        <div className="border-b border-border px-4 py-2.5">
          <h3 className="text-[12.5px] font-extrabold text-ink">전체 현황 · {roster.length}명</h3>
        </div>
        <div className="divide-y divide-border">
          {roster.map((user) => {
            if (user.id === actor.id) return null; // 본인은 위 카드에서 이미 다룬다.
            const plan = dayPlanByOwner.get(user.id);
            return (
              <div key={user.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-24 shrink-0 text-[11px] font-bold text-ink2">{user.name}<span className="ml-1 font-normal text-ink3">{user.dept}</span></div>
                <div className="min-w-0 flex-1 text-[11px] text-ink">
                  {plan ? <p className="whitespace-pre-wrap">{plan.content}</p> : <span className="text-ink3">작성 없음</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
