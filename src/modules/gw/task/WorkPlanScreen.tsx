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
import { Modal } from '@/shared/ui/Modal';

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

/**
 * 로스터 제외 대상 — 대표(대표이사)·위원회 소속·테스트 계정만 뺀다(2026-08-27 지시로 범위 축소).
 * 상무이사·이사급은 이제 포함된다 — 실무 인원 현황판에 임원도 넣어달라는 요청.
 */
const isExcludedFromRoster = (user: User) =>
  user.position.includes('대표') ||
  user.dept.includes('위원회') ||
  user.dept.includes('테스트') ||
  user.name.includes('테스터') ||
  user.name.includes('테스트');

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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
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

  /** 로스터 대상 — 재직 + 대표/위원회 제외, 부서순(부서 안에서는 이름순). */
  const roster = useMemo(
    () =>
      users
        .filter((user) => user.status === '사용' && !isExcludedFromRoster(user))
        .sort((a, b) => a.dept.localeCompare(b.dept, 'ko') || a.name.localeCompare(b.name, 'ko')),
    [users],
  );
  /** 부서별로 묶어서 보여준다 — roster가 이미 부서순 정렬이라 등장 순서 그대로 묶으면 된다. */
  const rosterGroups = useMemo(() => {
    const groups: Array<{ dept: string; members: User[] }> = [];
    for (const user of roster) {
      const last = groups[groups.length - 1];
      if (last && last.dept === user.dept) last.members.push(user);
      else groups.push({ dept: user.dept, members: [user] });
    }
    return groups;
  }, [roster]);
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

      {/* 내 카드 — 날짜 선택도 여기 붙는다(달력만 따로 떨어져 덩그러니 있던 걸 팝업으로 합침, 2026-08-27 피드백).
          요약만 여기, 실제 작성/수정도 팝업으로(항상 펼쳐진 입력칸이 화면을 잡아먹지 않게). */}
      <section className="mt-5 rounded-xl border border-teal/30 bg-teal-soft/10 shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[12.5px] font-extrabold text-ink">{dayTitle(selectedDate)} · 내 계획</h3>
              <button
                type="button"
                onClick={() => setDatePickerOpen(true)}
                className="rounded-md border border-border bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-ink3 hover:border-teal/40 hover:text-teal"
              >
                📅 날짜 변경
              </button>
            </div>
            <p className={`mt-1 truncate text-[11px] ${myDayPlan ? 'text-ink2' : 'text-ink3'}`}>{myDayPlan?.content || '작성 없음'}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {myDayPlan && <Button size="sm" variant="danger" onClick={() => void removeMine()}>삭제</Button>}
            <Button size="sm" variant="primary" onClick={() => setDraftText(myDayPlan?.content ?? '')}>{myDayPlan ? '수정' : '작성'}</Button>
          </div>
        </div>
      </section>

      {/* 날짜 선택 팝업 — 달력은 이 용도 하나뿐이라 별도 상시 영역 대신 팝업으로. */}
      <Modal open={datePickerOpen} onClose={() => setDatePickerOpen(false)} title="날짜 선택" width={320}>
        <div className="flex items-center gap-1.5 pb-2">
          <button type="button" onClick={() => setMonth(moveCalendarMonth(month, -1))} aria-label="이전 달" className="grid h-7 w-7 place-items-center rounded-md border border-border text-ink2 hover:bg-panel-alt">‹</button>
          <span className="min-w-[64px] text-center text-[11.5px] font-bold text-ink">{monthLabel(month)}</span>
          <button type="button" onClick={() => setMonth(moveCalendarMonth(month, 1))} aria-label="다음 달" className="grid h-7 w-7 place-items-center rounded-md border border-border text-ink2 hover:bg-panel-alt">›</button>
          <Button size="sm" onClick={() => setMonth(today.slice(0, 7))}>오늘</Button>
        </div>
        <div className="grid grid-cols-7 border-b border-border bg-panel-alt/65">
          {WEEKDAYS.map((day, index) => (
            <div key={day} className={`py-1 text-center text-[9.5px] font-bold ${index === 5 ? 'text-blue' : index === 6 ? 'text-danger' : 'text-ink3'}`}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            const mine = myPlansByDate.get(cell.date) ?? [];
            const isToday = cell.date === today;
            const selected = cell.date === selectedDate;
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => { setSelectedDate(cell.date); setDatePickerOpen(false); }}
                className={`flex h-9 cursor-pointer flex-col items-center justify-center border-b border-r border-border text-left transition-colors ${selected ? 'bg-teal-soft/25' : 'hover:bg-panel-alt/45'} ${index % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${isToday ? 'bg-teal text-white' : cell.inCurrentMonth ? 'text-ink2' : 'text-ink3/55'}`}>{Number(cell.date.slice(-2))}</span>
                {mine.length > 0 && <span className="mt-0.5 block h-1 w-1 rounded-full bg-teal" title={`내 계획 ${mine.length}건`} />}
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={draftText !== null}
        onClose={() => setDraftText(null)}
        title={`${dayTitle(selectedDate)} · 내 계획`}
        width={640}
        footer={(
          <>
            <Button size="sm" onClick={() => setDraftText(null)}>취소</Button>
            <Button size="sm" variant="primary" disabled={(draftText ?? '').trim() === ''} onClick={() => void save()}>저장</Button>
          </>
        )}
      >
        <textarea
          value={draftText ?? ''}
          onChange={(event) => setDraftText(event.target.value)}
          maxLength={1000}
          rows={18}
          autoFocus
          placeholder="오늘 할 일을 자유롭게 적으세요"
          className="min-h-[50vh] w-full resize-y rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none"
        />
      </Modal>

      {/* 남의 계획 열람 — 로스터 행은 미리보기 2줄만 보여주고, 전체 내용은 여기서 본다. */}
      <Modal
        open={viewingUser !== null}
        onClose={() => setViewingUser(null)}
        title={viewingUser ? `${viewingUser.name} · ${viewingUser.dept}` : ''}
        footer={<Button size="sm" onClick={() => setViewingUser(null)}>닫기</Button>}
      >
        <p className="whitespace-pre-wrap text-[11.5px] text-ink">{viewingUser && dayPlanByOwner.get(viewingUser.id)?.content}</p>
      </Modal>

      {/* 로스터 — 재직 전원(경영진 제외), 부서별로 묶어서. 본인 행도 포함하되 수정은 위 팝업에서만.
          내용은 길이에 관계없이 2줄로 잘라 행 높이를 맞춘다 — 안 그러면 긴 계획 하나가 목록 전체를
          들쭉날쭉하게 만든다(2026-08-27 실사용 피드백). 전체 내용은 클릭해서 팝업으로 본다. */}
      <section className="mt-4 rounded-xl border border-border bg-panel shadow-sm">
        <div className="border-b border-border px-4 py-2.5">
          <h3 className="text-[12.5px] font-extrabold text-ink">전체 현황 · {roster.length}명</h3>
        </div>
        <div className="divide-y divide-border">
          {rosterGroups.map((group) => (
            <div key={group.dept}>
              <div className="bg-panel-alt/60 px-4 py-1.5 text-[10px] font-bold text-ink3">{group.dept}</div>
              {group.members.map((user) => {
                const isSelf = user.id === actor.id;
                const plan = dayPlanByOwner.get(user.id);
                const onOpen = isSelf ? () => setDraftText(myDayPlan?.content ?? '') : plan ? () => setViewingUser(user) : undefined;
                return (
                  <button
                    key={user.id}
                    type="button"
                    disabled={!onOpen}
                    onClick={onOpen}
                    className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${isSelf ? 'bg-teal-soft/10' : ''} ${onOpen ? 'cursor-pointer hover:bg-panel-alt/45' : 'cursor-default'}`}
                  >
                    <div className="w-20 shrink-0 pt-0.5 text-[11px] font-bold text-ink2">{user.name}{isSelf && <span className="ml-1 font-normal text-teal">(나)</span>}</div>
                    <div className="min-w-0 flex-1 text-[11px] text-ink">
                      {plan ? (
                        <p className="line-clamp-2 whitespace-pre-wrap">{plan.content}</p>
                      ) : (
                        <span className="text-ink3">작성 없음</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
