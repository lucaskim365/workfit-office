import { useMemo, useState, useCallback } from 'react';
import type { User } from '@/domain/user/schema';
import type { WorkPlan } from '@/domain/workPlan/schema';
import { useAllWorkPlans, useUpdateWorkPlan, useCreateWorkPlan } from '@/features/workPlan/useWorkPlans';
import {
  parseWorkPlanItems,
  calculatePlanProgress,
  getWorkPlanTagMeta,
  toggleWorkPlanItem,
  addWorkPlanItem,
} from '@/domain/workPlan/engine';
import { useWorkPlanConfig } from '@/features/workPlan/useWorkPlanConfig';
import { USER_PRESENCE_META } from '@/domain/userPresence/schema';
import type { UserPresence } from '@/domain/userPresence/schema';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Edit3,
  Plus,
  Settings,
} from 'lucide-react';

const WEEKDAYS_KO = ['월', '화', '수', '목', '금'];

function parseDateUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWorkWeekDays(refDateStr: string): string[] {
  const date = parseDateUtc(refDateStr);
  const day = date.getUTCDay(); // 0(일) ~ 6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getTime() + diffToMonday * 86400000);

  const days: string[] = [];
  for (let i = 0; i < 5; i++) {
    const current = new Date(monday.getTime() + i * 86400000);
    days.push(formatDateStr(current));
  }
  return days;
}

interface WorkPlanTeamWeeklyMatrixProps {
  actor: User;
  todayStr: string;
  members: User[];
  presences?: Record<string, UserPresence>;
  onOpenEditor: (date: string, plan?: WorkPlan) => void;
  onOpenDetail: (user: User, plan: WorkPlan) => void;
  onOpenCalendarModal?: (text: string, date: string, tag?: string) => void;
  onOpenConfig?: () => void;
}

export function WorkPlanTeamWeeklyMatrix({
  actor,
  todayStr,
  members,
  presences,
  onOpenEditor,
  onOpenDetail,
  onOpenCalendarModal,
  onOpenConfig,
}: WorkPlanTeamWeeklyMatrixProps) {
  const [anchorDate, setAnchorDate] = useState(todayStr);
  const { tags, tagMap } = useWorkPlanConfig();

  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [addingText, setAddingText] = useState('');
  const [addingTag, setAddingTag] = useState('');

  const weekDays = useMemo(() => getWorkWeekDays(anchorDate), [anchorDate]);
  const startDay = weekDays[0];
  const endDay = weekDays[4];

  // 주간 범위의 전체 사용자 업무계획 조회
  const weeklyPlansQuery = useAllWorkPlans({ from: startDay, to: endDay }, true);
  const updateMutation = useUpdateWorkPlan();
  const createMutation = useCreateWorkPlan();

  // (userId -> (date -> WorkPlan)) 맵 생성
  const plansByUserAndDate = useMemo(() => {
    const userMap = new Map<string, Map<string, WorkPlan>>();
    (weeklyPlansQuery.data ?? []).forEach((plan) => {
      if (!userMap.has(plan.ownerUserId)) {
        userMap.set(plan.ownerUserId, new Map());
      }
      userMap.get(plan.ownerUserId)!.set(plan.date, plan);
    });
    return userMap;
  }, [weeklyPlansQuery.data]);

  const handlePrevWeek = () => {
    const d = parseDateUtc(anchorDate);
    d.setUTCDate(d.getUTCDate() - 7);
    setAnchorDate(formatDateStr(d));
  };

  const handleNextWeek = () => {
    const d = parseDateUtc(anchorDate);
    d.setUTCDate(d.getUTCDate() + 7);
    setAnchorDate(formatDateStr(d));
  };

  const handleThisWeek = () => {
    setAnchorDate(todayStr);
  };

  const handleToggleMyItem = useCallback(
    async (plan: WorkPlan, idx: number) => {
      const nextContent = toggleWorkPlanItem(plan.content, idx);
      await updateMutation.mutateAsync({
        actor: { userId: actor.id, active: actor.status === '사용' },
        id: plan.id,
        draft: { date: plan.date, content: nextContent },
      });
    },
    [actor, updateMutation],
  );

  const handleQuickAdd = useCallback(
    async (targetDate: string, existingPlan?: WorkPlan) => {
      if (!addingText.trim()) return;
      const currentContent = existingPlan?.content ?? '';
      const nextContent = addWorkPlanItem(currentContent, addingText.trim(), addingTag || undefined);
      const actorParam = { userId: actor.id, active: actor.status === '사용' };

      if (existingPlan) {
        await updateMutation.mutateAsync({
          actor: actorParam,
          id: existingPlan.id,
          draft: { date: targetDate, content: nextContent },
        });
      } else {
        await createMutation.mutateAsync({
          actor: actorParam,
          draft: { date: targetDate, content: nextContent },
        });
      }
      setAddingText('');
      setAddingDate(null);
    },
    [actor, addingText, addingTag, updateMutation, createMutation],
  );

  const [startYear, startMonth, startDayNum] = startDay.split('-').map(Number);
  const [, endMonth, endDayNum] = endDay.split('-').map(Number);

  return (
    <div className="space-y-3.5">
      {/* 주간 네비게이션 및 빠른 작업 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevWeek}
              aria-label="이전 주"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleThisWeek}
              className="rounded-lg border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt transition-colors shadow-2xs"
            >
              이번 주
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              aria-label="다음 주"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 className="ml-1 text-[14px] font-extrabold text-ink">
            {startYear}년 {startMonth}월 {startDayNum}일 ~ {endMonth}월 {endDayNum}일
          </h2>

          <span className="text-[11px] font-semibold text-ink3 ml-2">
            ({members.length}명 조회)
          </span>
        </div>

        {/* 사용자 액션 3종 버튼: [+ 업무 추가], [✏️ 편집], [⚙️ 설정] */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setAddingDate(todayStr);
              setAddingText('');
            }}
            className="flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-[11.5px] font-bold text-indigo-600 hover:bg-indigo-100/60 transition-colors shadow-2xs dark:border-indigo-800/40 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            <Plus size={13} />
            <span>업무 추가</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const myTodayPlan = plansByUserAndDate.get(actor.id)?.get(todayStr);
              onOpenEditor(todayStr, myTodayPlan);
            }}
            className="flex items-center gap-1 rounded-xl border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt transition-colors shadow-2xs"
          >
            <Edit3 size={12} className="text-ink3" />
            <span>편집</span>
          </button>
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="flex items-center gap-1 rounded-xl border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt transition-colors shadow-2xs"
            >
              <Settings size={12} className="text-ink3" />
              <span>설정</span>
            </button>
          )}
        </div>
      </div>

      {/* 팀 주간 매트릭스 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-panel-alt/75">
              {/* 팀원 프로필 고정 열 */}
              <th className="w-[180px] p-3 text-[11.5px] font-extrabold text-ink sticky left-0 bg-panel-alt/95 z-10 border-r border-border backdrop-blur-xs">
                팀원 명단 ({members.length})
              </th>
              {/* 월~금 5영업일 열 */}
              {weekDays.map((dayStr, i) => {
                const isToday = dayStr === todayStr;
                const [, m, d] = dayStr.split('-');
                return (
                  <th
                    key={dayStr}
                    className={`p-3 text-[12px] font-extrabold border-r border-border last:border-r-0 ${
                      isToday ? 'bg-teal-soft/25 text-teal' : 'text-ink'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span>{WEEKDAYS_KO[i]}요일</span>
                        <span className="text-[10.5px] font-semibold text-ink3">
                          {m}.{d}
                        </span>
                      </div>
                      {isToday && (
                        <span className="rounded bg-teal px-1.5 py-0.2 text-[9px] font-extrabold text-white shadow-2xs">
                          오늘
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[12px] font-semibold text-ink3">
                  조회할 수 있는 팀원이 없습니다.
                </td>
              </tr>
            ) : (
              members.map((member) => {
                const isSelf = member.id === actor.id;
                const userPlans = plansByUserAndDate.get(member.id);
                const presence = presences?.[member.id];
                const presenceMeta = presence?.status ? USER_PRESENCE_META[presence.status] : null;

                return (
                  <tr
                    key={member.id}
                    className={`transition-colors ${
                      isSelf ? 'bg-teal-soft/10 font-medium' : 'hover:bg-panel-alt/30'
                    }`}
                  >
                    {/* 팀원 프로필 열 */}
                    <td className="p-3 align-top sticky left-0 bg-panel/95 z-10 border-r border-border backdrop-blur-xs">
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white shadow-2xs ${
                            isSelf ? 'bg-teal' : 'bg-ink3'
                          }`}
                        >
                          {member.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1 leading-snug">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-bold text-ink truncate">
                              {member.name}
                            </span>
                            {isSelf && (
                              <span className="rounded bg-teal/20 px-1 py-0.2 text-[9px] font-extrabold text-teal">
                                나
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-ink3 truncate">
                            {member.dept} · {member.position}
                          </div>

                          {presenceMeta && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold">
                              <span>{presenceMeta.icon}</span>
                              <span className={presenceMeta.textColor}>{presenceMeta.label}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 월~금 5일치 일정 셀 */}
                    {weekDays.map((dayStr) => {
                      const isToday = dayStr === todayStr;
                      const plan = userPlans?.get(dayStr);
                      const parsed = plan ? parseWorkPlanItems(plan.content) : [];
                      const prog = plan ? calculatePlanProgress(plan.content) : null;

                      return (
                        <td
                          key={dayStr}
                          className={`p-2.5 align-top border-r border-border last:border-r-0 transition-colors ${
                            isToday ? 'bg-teal-soft/10' : ''
                          }`}
                        >
                          {parsed.length === 0 ? (
                            isSelf ? (
                              addingDate === dayStr ? (
                                <div className="rounded-lg border border-teal/40 bg-teal-soft/20 p-2 shadow-xs space-y-2">
                                  <div className="text-[10px] font-bold text-teal flex items-center justify-between">
                                    <span>새 업무 등록 ({dayStr.slice(5)})</span>
                                    <button
                                      type="button"
                                      onClick={() => { setAddingDate(null); setAddingText(''); }}
                                      className="text-ink3 hover:text-ink"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={addingTag}
                                      onChange={(e) => setAddingTag(e.target.value)}
                                      className="h-6 rounded border border-border bg-panel text-[10px] font-bold text-ink px-1 outline-none"
                                    >
                                      <option value="">태그 없음</option>
                                      {tags.map((t) => (
                                        <option key={t.tag} value={t.tag}>{t.tag}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      value={addingText}
                                      onChange={(e) => setAddingText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') void handleQuickAdd(dayStr, plan);
                                        if (e.key === 'Escape') { setAddingDate(null); setAddingText(''); }
                                      }}
                                      placeholder="업무 입력 (Enter)"
                                      className="h-6 flex-1 min-w-0 rounded border border-border bg-panel px-1.5 text-[11px] text-ink outline-none focus:border-teal"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-1.5 text-[10px]">
                                    <button
                                      type="button"
                                      onClick={() => { setAddingDate(null); setAddingText(''); }}
                                      className="rounded px-2 py-0.5 text-ink3 hover:bg-panel font-medium"
                                    >
                                      취소
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!addingText.trim()}
                                      onClick={() => void handleQuickAdd(dayStr, plan)}
                                      className="rounded bg-teal px-2.5 py-0.5 font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                                    >
                                      추가
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddingDate(dayStr);
                                    setAddingText('');
                                  }}
                                  className="flex h-full min-h-[64px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-2 text-center text-ink3 hover:border-teal hover:bg-teal-soft/20 hover:text-teal transition-all"
                                >
                                  <span className="text-[10.5px] font-semibold">+ 업무 추가</span>
                                </button>
                              )
                            ) : (
                              <div className="grid min-h-[64px] place-items-center text-[10.5px] text-ink3/40">
                                -
                              </div>
                            )
                          ) : (
                            <div className="space-y-1.5 min-h-[64px]">
                              {/* 계획 항목 목록: 기존 업무들을 항상 먼저 노출 */}
                              <div className="space-y-1">
                                {parsed.map((item, idx) => {
                                  if (!item.text && !item.tag && !item.isChecklist) return null;
                                  const tagMeta = item.tag ? getWorkPlanTagMeta(item.tag, tagMap) : null;

                                  return (
                                    <div
                                      key={idx}
                                      className="group flex items-start gap-1 rounded p-0.5 hover:bg-panel-alt/60 transition-colors"
                                    >
                                      {item.isChecklist ? (
                                        <button
                                          type="button"
                                          disabled={!isSelf}
                                          onClick={() => isSelf && plan && void handleToggleMyItem(plan, idx)}
                                          className={`mt-0.5 grid h-3 w-3 shrink-0 place-items-center rounded border transition-colors ${
                                            item.completed
                                              ? 'border-teal bg-teal text-white'
                                              : 'border-border bg-panel'
                                          } ${isSelf ? 'hover:border-teal cursor-pointer' : 'cursor-default'}`}
                                        >
                                          {item.completed && <CheckCircle2 size={9} />}
                                        </button>
                                      ) : (
                                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink3" />
                                      )}

                                      <div className="min-w-0 flex-1 leading-snug">
                                        {tagMeta && (
                                          <span
                                            className={`mr-1 inline-block rounded px-1 py-0.2 text-[8.5px] font-bold ${tagMeta.badgeClass}`}
                                          >
                                            {tagMeta.tag}
                                          </span>
                                        )}
                                        <span
                                          className={`text-[10.5px] break-words ${
                                            item.completed ? 'line-through text-ink3' : 'text-ink'
                                          }`}
                                        >
                                          {item.text}
                                        </span>
                                      </div>

                                      {/* 본인 행인 경우 캘린더 등록 호버 버튼 */}
                                      {isSelf && onOpenCalendarModal && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenCalendarModal(item.text, dayStr, item.tag);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-ink3 hover:text-teal transition-all shrink-0"
                                          title="캘린더 일정으로 등록"
                                        >
                                          <CalendarDays size={10} />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 기존 업무 목록 아래: 업무 추가 박스 또는 추가 버튼 */}
                              {isSelf && (
                                addingDate === dayStr ? (
                                  <div className="rounded-lg border border-teal/40 bg-teal-soft/20 p-2 shadow-xs space-y-2 mt-1">
                                    <div className="text-[10px] font-bold text-teal flex items-center justify-between">
                                      <span>새 업무 추가 ({dayStr.slice(5)})</span>
                                      <button
                                        type="button"
                                        onClick={() => { setAddingDate(null); setAddingText(''); }}
                                        className="text-ink3 hover:text-ink"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <select
                                        value={addingTag}
                                        onChange={(e) => setAddingTag(e.target.value)}
                                        className="h-6 rounded border border-border bg-panel text-[10px] font-bold text-ink px-1 outline-none"
                                      >
                                        <option value="">태그 없음</option>
                                        {tags.map((t) => (
                                          <option key={t.tag} value={t.tag}>{t.tag}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="text"
                                        value={addingText}
                                        onChange={(e) => setAddingText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') void handleQuickAdd(dayStr, plan);
                                          if (e.key === 'Escape') { setAddingDate(null); setAddingText(''); }
                                        }}
                                        placeholder="업무 입력 (Enter)"
                                        className="h-6 flex-1 min-w-0 rounded border border-border bg-panel px-1.5 text-[11px] text-ink outline-none focus:border-teal"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5 text-[10px]">
                                      <button
                                        type="button"
                                        onClick={() => { setAddingDate(null); setAddingText(''); }}
                                        className="rounded px-2 py-0.5 text-ink3 hover:bg-panel font-medium"
                                      >
                                        취소
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!addingText.trim()}
                                        onClick={() => void handleQuickAdd(dayStr, plan)}
                                        className="rounded bg-teal px-2.5 py-0.5 font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                                      >
                                        추가
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddingDate(dayStr);
                                      setAddingText('');
                                    }}
                                    className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border/60 py-0.5 text-[9.5px] font-semibold text-ink3 hover:border-teal/50 hover:bg-teal-soft/20 hover:text-teal transition-colors mt-1"
                                  >
                                    <Plus size={10} />
                                    <span>추가</span>
                                  </button>
                                )
                              )}

                              {/* 하단 진행률 및 액션 버튼 */}
                              <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[9.5px]">
                                {prog && (
                                  <span className="text-ink3">
                                    {prog.completed}/{prog.total} ({prog.percent}%)
                                  </span>
                                )}

                                {isSelf ? (
                                  <button
                                    type="button"
                                    onClick={() => onOpenEditor(dayStr, plan)}
                                    className="ml-auto rounded p-0.5 text-ink3 hover:text-teal transition-colors"
                                    title="계획 전체 편집"
                                  >
                                    <Edit3 size={11} />
                                  </button>
                                ) : (
                                  plan && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenDetail(member, plan)}
                                      className="ml-auto rounded px-1 text-ink3 hover:text-ink font-semibold transition-colors"
                                    >
                                      상세
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
