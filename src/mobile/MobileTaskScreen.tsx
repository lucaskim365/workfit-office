import { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import {
  useMyWorkPlans,
  useCreateWorkPlan,
  useUpdateWorkPlan,
} from '@/features/workPlan/useWorkPlans';
import {
  parseWorkPlanItems,
  calculatePlanProgress,
  toggleWorkPlanItem,
  removeWorkPlanItem,
  getWorkPlanTagMeta,
} from '@/domain/workPlan/engine';
import { useWorkPlanConfig } from '@/features/workPlan/useWorkPlanConfig';
import MobileCommonHeader from './MobileCommonHeader';

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function MobileTaskScreen() {
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const selectedDateStr = useMemo(() => formatDate(selectedDate), [selectedDate]);

  const [newTodoText, setNewTodoText] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  const { tagMap } = useWorkPlanConfig();

  const workActor = useMemo(
    () => ({ userId: user?.id ?? '__anonymous__', active: user?.status === '사용' }),
    [user],
  );

  // 내 업무계획 목록 쿼리
  const workPlansQuery = useMyWorkPlans(workActor);
  const workPlans = workPlansQuery.data ?? [];

  const createPlan = useCreateWorkPlan();
  const updatePlan = useUpdateWorkPlan();

  // 오늘 날짜의 업무계획 데이터
  const todayPlan = useMemo(() => {
    return workPlans.find((p) => p.date === selectedDateStr);
  }, [workPlans, selectedDateStr]);

  const rawContent = todayPlan?.content ?? '';

  const parsedItems = useMemo(() => {
    return parseWorkPlanItems(rawContent);
  }, [rawContent]);

  const progress = useMemo(() => {
    return calculatePlanProgress(rawContent);
  }, [rawContent]);

  // 완료 토글 핸들러
  const handleToggle = async (idx: number) => {
    const nextContent = toggleWorkPlanItem(rawContent, idx);
    if (todayPlan) {
      await updatePlan.mutateAsync({
        actor: workActor,
        id: todayPlan.id,
        draft: { date: todayPlan.date, content: nextContent },
      });
    } else {
      await createPlan.mutateAsync({
        actor: workActor,
        draft: { date: selectedDateStr, content: nextContent },
      });
    }
  };

  // 항목 삭제 핸들러
  const handleRemove = async (idx: number) => {
    const nextContent = removeWorkPlanItem(rawContent, idx);
    if (todayPlan) {
      await updatePlan.mutateAsync({
        actor: workActor,
        id: todayPlan.id,
        draft: { date: todayPlan.date, content: nextContent },
      });
    }
  };

  // 신규 할 일 추가 핸들러
  const handleAddTodo = async () => {
    const text = newTodoText.trim();
    if (!text) return;

    const tagPart = selectedTag ? `[${selectedTag}] ` : '';
    const newLine = `- [ ] ${tagPart}${text}`;
    const nextContent = rawContent.trim() ? `${rawContent.trim()}\n${newLine}` : newLine;

    if (todayPlan) {
      await updatePlan.mutateAsync({
        actor: workActor,
        id: todayPlan.id,
        draft: { date: todayPlan.date, content: nextContent },
      });
    } else {
      await createPlan.mutateAsync({
        actor: workActor,
        draft: { date: selectedDateStr, content: nextContent },
      });
    }

    setNewTodoText('');
  };

  // 날짜 이동 핸들러
  const handlePrevDay = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const dateTitle = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth() + 1;
    const d = selectedDate.getDate();
    const day = WEEKDAYS[selectedDate.getDay()];
    return `${y}년 ${m}월 ${d}일 (${day})`;
  }, [selectedDate]);

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader title="업무계획" subtitle={dateTitle} />

      {/* 1. 날짜 이동 바 */}
      <div className="flex items-center justify-between border-b border-border/70 bg-white px-3 py-2 shadow-2xs shrink-0">
        <button
          type="button"
          onClick={handlePrevDay}
          className="grid h-8 w-8 place-items-center rounded-xl hover:bg-panel-alt transition-colors text-ink2"
          title="이전 날"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          onClick={handleToday}
          className="text-[13px] font-bold text-ink hover:text-teal transition-colors flex items-center gap-1.5"
        >
          <Calendar size={14} className="text-teal" />
          <span>{dateTitle}</span>
        </button>

        <button
          type="button"
          onClick={handleNextDay}
          className="grid h-8 w-8 place-items-center rounded-xl hover:bg-panel-alt transition-colors text-ink2"
          title="다음 날"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 2. 진행률 바 */}
      {progress && progress.total > 0 && (
        <div className="bg-white px-4 py-2 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
            <span className="text-ink">오늘의 달성률</span>
            <span className="text-teal">
              {progress.completed}/{progress.total}건 완료 ({progress.percent}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-panel-alt overflow-hidden">
            <div
              className="h-full rounded-full bg-teal transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. 스크롤 본문 To-Do 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {parsedItems.length === 0 ? (
          <div className="py-16 text-center text-ink3 border border-dashed border-border/80 rounded-2xl bg-white/60">
            <CheckSquare size={32} className="mx-auto mb-2 text-ink3/40" />
            <p className="text-[12.5px] font-bold text-ink">오늘 등록된 업무가 없습니다.</p>
            <p className="text-[11px] text-ink3 mt-0.5">하단 입력창에서 오늘의 할 일을 추가해보세요.</p>
          </div>
        ) : (
          parsedItems.map((item, idx) => {
            const tagMeta = item.tag ? getWorkPlanTagMeta(item.tag, tagMap) : null;
            return (
              <div
                key={idx}
                className="group flex items-center justify-between gap-2.5 rounded-2xl border border-border/80 bg-white p-3 shadow-2xs hover:border-teal/40 transition-all"
              >
                <div
                  onClick={() => handleToggle(idx)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  <button
                    type="button"
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition-all ${
                      item.completed
                        ? 'border-teal bg-teal text-white shadow-2xs'
                        : 'border-border-hi bg-panel hover:border-teal'
                    }`}
                  >
                    {item.completed && <CheckSquare size={13} strokeWidth={2.5} />}
                  </button>

                  {tagMeta && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.2 text-[9.5px] font-bold ${tagMeta.badgeClass}`}
                    >
                      {item.tag}
                    </span>
                  )}

                  <span
                    className={`text-[12.5px] font-medium truncate ${
                      item.completed ? 'line-through text-ink3' : 'text-ink'
                    }`}
                  >
                    {item.text}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="p-1 text-ink3 opacity-40 group-hover:opacity-100 hover:text-rose-500 transition-all shrink-0"
                  title="삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 4. 하단 고정 빠른 할 일 입력 바 */}
      <div className="border-t border-border/80 bg-white p-3 space-y-2 shrink-0 shadow-lg">
        {/* 태그 선택 칩 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {['회의', '미팅', '보고', '집중', '마감'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTag(selectedTag === t ? '' : t)}
              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold transition-all shrink-0 ${
                selectedTag === t
                  ? 'bg-teal text-white shadow-2xs'
                  : 'bg-panel-alt text-ink2 border border-border/60 hover:border-teal'
              }`}
            >
              +{t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTodo();
              }
            }}
            placeholder="오늘의 할 일 추가 (Enter 입력 시 등록)"
            className="flex-1 rounded-xl border border-border bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-teal placeholder:text-ink3"
          />

          <button
            type="button"
            onClick={handleAddTodo}
            disabled={!newTodoText.trim()}
            className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-teal text-white shadow-2xs hover:opacity-90 disabled:opacity-40 active:scale-95 transition-all shrink-0"
          >
            <Plus size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
