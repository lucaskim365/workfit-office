import { useMemo, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { buildCalendarMonth, calendarToday, moveCalendarMonth } from '@/domain/calendarEvent/calendarDate';
import type { WorkPlan } from '@/domain/workPlan/schema';
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
 * 그룹웨어 일정관리와 의도적으로 다르게 짠다: 공유 범위 개념이 없다(전체 보기는 늘 전원
 * 공개), 시간도 없다(하루 단위 한 줄), 고치는 건 본인 것만. 새 인프라 없이 기존
 * `workPlans` 컬렉션 하나로 끝나서 그룹웨어 캘린더보다 훨씬 가볍다.
 */
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_NAMES_SUN0 = ['일', '월', '화', '수', '목', '금', '토'];

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
  const [tab, setTab] = useState<'me' | 'all'>('me');
  const [selectedDate, setSelectedDate] = useState(today);
  const [editing, setEditing] = useState<{ date: string; plan?: WorkPlan } | null>(null);
  const [notice, setNotice] = useState('');

  const cells = useMemo(() => buildCalendarMonth(month), [month]);
  const range = useMemo(() => ({ from: cells[0].date, to: cells[cells.length - 1].date }), [cells]);

  const workActor = useMemo(() => ({ userId: actor?.id ?? '__anonymous__', active: actor?.status === '사용' }), [actor]);
  const isAll = tab === 'all';
  const mineQuery = useMyWorkPlans(workActor, range);
  const allQuery = useAllWorkPlans(range, isAll);
  const plans = isAll ? (allQuery.data ?? []) : (mineQuery.data ?? []);
  const loading = usersQuery.isLoading || mineQuery.isLoading || (isAll && allQuery.isLoading);

  const create = useCreateWorkPlan();
  const update = useUpdateWorkPlan();
  const remove = useRemoveWorkPlan();

  const plansByDate = useMemo(() => {
    const rows = new Map<string, WorkPlan[]>();
    plans.forEach((plan) => rows.set(plan.date, [...(rows.get(plan.date) ?? []), plan]));
    return rows;
  }, [plans]);

  const nameOf = (userId: string) => users.find((u) => u.id === userId)?.name ?? '알 수 없음';
  const isMine = (plan: WorkPlan) => plan.ownerUserId === (actor?.id ?? '');
  const dayPlans = plansByDate.get(selectedDate) ?? [];

  const save = async (title: string, memo: string) => {
    if (!editing || !actor) return;
    try {
      if (editing.plan) {
        await update.mutateAsync({ actor: workActor, id: editing.plan.id, draft: { date: editing.date, title, memo } });
      } else {
        await create.mutateAsync({ actor: workActor, draft: { date: editing.date, title, memo } });
      }
      setEditing(null);
      setNotice('저장했습니다.');
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    }
  };

  const removePlan = async (id: string) => {
    if (!window.confirm('이 업무계획을 삭제하시겠습니까?')) return;
    await remove.mutateAsync({ actor: workActor, id });
    setNotice('삭제했습니다.');
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">불러오는 중…</div>;
  if (!actor) return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">사용자 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead
        icon="🗓️"
        name="업무계획"
        right={(
          <div className="flex items-center gap-2">
            {!authenticatedUser && (
              <select value={actor.id} onChange={(event) => setDemoUserId(event.target.value)} title="사용자 선택" className="h-9 rounded-lg border border-amber/30 bg-amber-soft/30 px-3 text-[10.5px] font-bold text-ink outline-none">
                {users.filter((user) => user.status === '사용').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-0.5 self-center rounded-lg border border-border bg-panel p-0.5">
              {([['me', '내 계획'], ['all', '전체 보기']] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors ${tab === key ? 'bg-teal text-white' : 'text-ink3 hover:text-ink2'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      />

      {notice && <div aria-live="polite" className="mt-4 rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] font-semibold text-teal">{notice}</div>}

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel p-3 shadow-sm">
        <button type="button" onClick={() => setMonth(moveCalendarMonth(month, -1))} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
        <Button size="sm" onClick={() => setMonth(today.slice(0, 7))}>오늘</Button>
        <button type="button" onClick={() => setMonth(moveCalendarMonth(month, 1))} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
        <h2 className="ml-1 text-[16px] font-extrabold text-ink">{monthLabel(month)}{isAll ? ' · 전체 보기' : ''}</h2>
        <span className="ml-auto text-[10px] font-semibold text-ink3">날짜를 누르면 아래에 그날 계획이 나옵니다</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-border bg-panel-alt/65">
            {WEEKDAYS.map((day, index) => (
              <div key={day} className={`px-2 py-2.5 text-center text-[10px] font-bold ${index === 5 ? 'text-blue' : index === 6 ? 'text-danger' : 'text-ink3'}`}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, index) => {
              const rows = plansByDate.get(cell.date) ?? [];
              const isToday = cell.date === today;
              const selected = cell.date === selectedDate;
              return (
                <div
                  key={cell.date}
                  onClick={() => setSelectedDate(cell.date)}
                  className={`min-h-24 cursor-pointer border-b border-r border-border p-2 text-left align-top transition-colors ${selected ? 'bg-teal-soft/25' : 'hover:bg-panel-alt/45'} ${index % 7 === 6 ? 'border-r-0' : ''}`}
                >
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[10.5px] font-bold ${isToday ? 'bg-teal text-white' : cell.inCurrentMonth ? 'text-ink2' : 'text-ink3/55'}`}>{Number(cell.date.slice(-2))}</span>
                  <span className="mt-1.5 block space-y-1">
                    {rows.slice(0, 3).map((plan) => (
                      <span key={plan.id} title={plan.title} className={`block truncate rounded px-1.5 py-1 text-[8.5px] font-semibold ${isMine(plan) ? 'bg-teal-soft/75 text-teal' : 'bg-ink3/10 text-ink3'}`}>
                        {isAll ? `${nameOf(plan.ownerUserId)} · ${plan.title}` : plan.title}
                      </span>
                    ))}
                    {rows.length > 3 && <span className="block px-1 text-[8.5px] font-bold text-ink3">+{rows.length - 3}개 더</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 선택한 날짜의 계획 — 팝업이 아니라 달력 바로 아래에 쭉 나열한다. */}
      <section className="mt-4 rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[13px] font-extrabold text-ink">{dayTitle(selectedDate)} · {dayPlans.length}건</h3>
          <Button size="sm" variant="primary" onClick={() => setEditing({ date: selectedDate })}>+ 계획 추가</Button>
        </div>
        {dayPlans.length === 0 ? (
          <div className="py-8 text-center text-[11px] font-semibold text-ink3">등록된 계획이 없습니다.</div>
        ) : (
          <div className="space-y-2 p-3">
            {(isAll
              ? [...dayPlans].sort((a, b) => nameOf(a.ownerUserId).localeCompare(b.ownerUserId, 'ko'))
              : dayPlans
            ).map((plan) => {
              const mine = isMine(plan);
              return (
                <div key={plan.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    {isAll && <div className="text-[9.5px] font-bold text-ink3">{nameOf(plan.ownerUserId)}</div>}
                    <div className="truncate text-[11.5px] font-bold text-ink">{plan.title}</div>
                    {plan.memo && <p className="mt-0.5 line-clamp-2 text-[10px] text-ink3">{plan.memo}</p>}
                  </div>
                  {/* 남의 계획은 못 고친다 — 버튼 자체를 안 그린다. */}
                  {mine && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" onClick={() => setEditing({ date: plan.date, plan })}>수정</Button>
                      <Button size="sm" variant="danger" onClick={() => void removePlan(plan.id)}>삭제</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing && <WorkPlanFormModal date={editing.date} plan={editing.plan} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function WorkPlanFormModal({ date, plan, onClose, onSave }: {
  date: string;
  plan?: WorkPlan;
  onClose: () => void;
  onSave: (title: string, memo: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(plan?.title ?? '');
  const [memo, setMemo] = useState(plan?.memo ?? '');
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? '업무계획 수정' : '업무계획 추가'}
      width={440}
      footer={(
        <div className="flex w-full items-center justify-end gap-1.5">
          <Button onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            disabled={saving || title.trim() === ''}
            onClick={async () => { setSaving(true); await onSave(title, memo); setSaving(false); }}
          >
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="text-[11px] font-semibold text-ink3">{date}</div>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold text-ink3">내용</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} autoFocus placeholder="예: A사 영업 미팅" className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold text-ink3">메모 (선택)</span>
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={2000} rows={4} className="w-full resize-y rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none" />
        </label>
      </div>
    </Modal>
  );
}
