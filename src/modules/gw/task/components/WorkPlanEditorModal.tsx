import { useState, useMemo, useEffect } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import {
  parseWorkPlanItems,
  calculatePlanProgress,
  getWorkPlanTagMeta,
  toggleWorkPlanItem,
  removeWorkPlanItem,
} from '@/domain/workPlan/engine';
import {
  extractTimeFromText,
  importCalendarEventsToWorkPlanContent,
  isWorkPlanDerivedEvent,
} from '@/domain/workPlan/workPlanCalendarBridge';
import { useWorkPlanConfig } from '@/features/workPlan/useWorkPlanConfig';
import { WorkPlanConfigModal } from './WorkPlanConfigModal';
import {
  CheckSquare,
  Sparkles,
  Trash2,
  CheckCircle2,
  CalendarDays,
  Clock,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00',
];

interface WorkPlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  date?: string;
  dateTitle: string;
  initialContent: string;
  todayEvents?: CalendarEvent[];
  onSave: (content: string, shareToCalendar?: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function WorkPlanEditorModal({
  isOpen,
  onClose,
  dateTitle,
  initialContent,
  todayEvents = [],
  onSave,
  onDelete,
}: WorkPlanEditorModalProps) {
  const [content, setContent] = useState(initialContent);
  const [shareToCalendar, setShareToCalendar] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [entryTab, setEntryTab] = useState<'schedule' | 'todo'>('schedule');
  const [configModalTab, setConfigModalTab] = useState<'templates' | 'tags' | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // 시간 일정 등록 상태
  const [eventTitle, setEventTitle] = useState('');
  const [eventTag, setEventTag] = useState('회의');
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventStartTime, setEventStartTime] = useState('10:00');
  const [eventEndTime, setEventEndTime] = useState('11:00');

  // 일반 업무 등록 상태
  const [todoText, setTodoText] = useState('');
  const [todoTag, setTodoTag] = useState('');

  const { templates, tagMap } = useWorkPlanConfig();

  // 모달 열릴 때 초기 내용 동기화
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent, isOpen]);

  // 알림 메시지 자동 소멸
  useEffect(() => {
    if (!noticeMessage) return;
    const timer = setTimeout(() => setNoticeMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [noticeMessage]);

  const parsedItems = useMemo(() => parseWorkPlanItems(content), [content]);
  const progress = useMemo(() => calculatePlanProgress(content), [content]);

  // 오늘 캘린더 이벤트 중 아직 본문에 없는 신규 후보 일정 수
  const availableCalendarCount = useMemo(() => {
    if (!todayEvents.length) return 0;
    const { addedCount } = importCalendarEventsToWorkPlanContent(content, todayEvents);
    return addedCount;
  }, [content, todayEvents]);

  // [🔄 캘린더 일정 불러오기] 멱등성 보장 핸들러
  const handleImportCalendar = () => {
    const validEvents = todayEvents.filter((e) => !isWorkPlanDerivedEvent(e));
    if (validEvents.length === 0) {
      setNoticeMessage('해당 날짜에 등록된 캘린더 일정이 없습니다.');
      return;
    }
    const { nextContent, addedCount } = importCalendarEventsToWorkPlanContent(content, validEvents);
    if (addedCount === 0) {
      setNoticeMessage('모든 캘린더 일정이 이미 반영되어 있습니다 (중복 없음).');
    } else {
      setContent(nextContent);
      setNoticeMessage(`캘린더 일정 ${addedCount}건을 계획에 안전하게 추가했습니다.`);
    }
  };

  // ⏰ 시간 일정 추가
  const handleAddSchedule = () => {
    if (!eventTitle.trim()) return;
    const timePart = eventAllDay ? '' : `(${eventStartTime}~${eventEndTime}) `;
    const tagPart = eventTag ? `[${eventTag}] ` : '';
    const newLine = `- [ ] ${tagPart}${timePart}${eventTitle.trim()}`;

    setContent((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${newLine}` : newLine;
    });

    setEventTitle('');
    setNoticeMessage(`'${eventTitle.trim()}' 일정을 추가했습니다.`);
  };

  // 📋 일반 업무 추가
  const handleAddTodo = () => {
    if (!todoText.trim()) return;
    const tagPart = todoTag ? `[${todoTag}] ` : '';
    const newLine = `- [ ] ${tagPart}${todoText.trim()}`;

    setContent((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${newLine}` : newLine;
    });

    setTodoText('');
    setNoticeMessage(`'${todoText.trim()}' 업무를 추가했습니다.`);
  };

  // 템플릿 적용
  const handleApplyTemplate = (tplContent: string) => {
    setContent((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${tplContent}` : tplContent;
    });
    setNoticeMessage('템플릿을 추가했습니다.');
  };

  // 개별 아이템 완료 토글
  const handleToggle = (idx: number) => {
    setContent((prev) => toggleWorkPlanItem(prev, idx));
  };

  // 개별 아이템 삭제
  const handleRemove = (idx: number) => {
    setContent((prev) => removeWorkPlanItem(prev, idx));
  };

  // 최종 저장
  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await onSave(content.trim(), shareToCalendar);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // 전체 삭제
  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm('이 날짜의 업무계획을 삭제하시겠습니까? (연동된 캘린더 일정도 함께 정리됩니다)')) return;
    setIsSaving(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        title={`${dateTitle} · 업무계획 작성`}
        width={680}
      >
        <div className="space-y-4">
          {/* 상단 툴바: 캘린더 불러오기 & 루틴 템플릿 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              {/* 🔄 캘린더 일정 불러오기 버튼 (멱등성 보장) */}
              <button
                type="button"
                onClick={handleImportCalendar}
                className="flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal-soft/30 px-3 py-1.5 text-[11.5px] font-bold text-teal hover:bg-teal-soft/60 transition-all cursor-pointer shadow-2xs"
                title="캘린더에 등록된 내 일정(회의/외근 등)을 중복 없이 가져옵니다."
              >
                <RefreshCw size={12} className={availableCalendarCount > 0 ? 'animate-spin-once text-teal' : ''} />
                <span>캘린더 일정 불러오기</span>
                {availableCalendarCount > 0 && (
                  <span className="rounded-full bg-teal px-1.5 py-0.2 text-[9.5px] text-white">
                    +{availableCalendarCount}
                  </span>
                )}
              </button>

              {/* 루틴 템플릿 관리 버튼 */}
              <button
                type="button"
                onClick={() => setConfigModalTab('templates')}
                className="flex items-center gap-1 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-[11px] font-medium text-ink2 hover:bg-panel-alt transition-colors cursor-pointer"
                title="자주 쓰는 루틴 템플릿"
              >
                <Sparkles size={12} className="text-amber-500" />
                <span>루틴 템플릿</span>
              </button>

              {templates.slice(0, 2).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl.content)}
                  className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border/80 bg-panel px-2 py-1 text-[10.5px] font-medium text-ink2 hover:border-teal hover:text-teal transition-all cursor-pointer"
                  title={tpl.desc}
                >
                  <span>{tpl.icon}</span>
                  <span>{tpl.name}</span>
                </button>
              ))}
            </div>

            {/* 시간 일정 vs 일반 업무 탭 전환 세그먼트 */}
            <div className="flex items-center rounded-lg border border-border bg-panel-alt p-0.5">
              <button
                type="button"
                onClick={() => setEntryTab('schedule')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-all cursor-pointer ${
                  entryTab === 'schedule'
                    ? 'bg-panel text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-ink3 hover:text-ink2'
                }`}
              >
                <Clock size={13} />
                <span>시간 일정</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryTab('todo')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-all cursor-pointer ${
                  entryTab === 'todo'
                    ? 'bg-panel text-teal shadow-2xs'
                    : 'text-ink3 hover:text-ink2'
                }`}
              >
                <CheckSquare size={13} />
                <span>일반 업무</span>
              </button>
            </div>
          </div>

          {/* 알림 토스트 배너 */}
          {noticeMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-teal/10 px-3 py-2 text-[11px] font-semibold text-teal border border-teal/20 transition-all animate-in fade-in">
              <AlertCircle size={13} />
              <span>{noticeMessage}</span>
            </div>
          )}

          {/* ────────────────── 탭별 입력 폼 영역 ────────────────── */}
          {entryTab === 'schedule' ? (
            /* 1) ⏰ 시간 일정 추가 폼 */
            <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-blue-600 dark:text-blue-400">
                  <Clock size={13} />
                  <span>새 시간 일정 등록 (저장 시 부서 캘린더에 자동 공유)</span>
                </span>
                <label className="flex items-center gap-1.5 text-[11px] text-ink2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={eventAllDay}
                    onChange={(e) => setEventAllDay(e.target.checked)}
                    className="rounded border-border text-teal focus:ring-teal"
                  />
                  <span>종일 일정</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 시간 선택 드롭다운 (종일이 아닐 때) */}
                {!eventAllDay && (
                  <div className="flex items-center gap-1 text-[11.5px] font-medium text-ink2">
                    <select
                      value={eventStartTime}
                      onChange={(e) => setEventStartTime(e.target.value)}
                      className="rounded-lg border border-border bg-panel px-2.5 py-1 text-[11.5px] outline-none focus:border-teal"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span>~</span>
                    <select
                      value={eventEndTime}
                      onChange={(e) => setEventEndTime(e.target.value)}
                      className="rounded-lg border border-border bg-panel px-2.5 py-1 text-[11.5px] outline-none focus:border-teal"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 태그 선택 버튼 */}
                <div className="flex items-center gap-1">
                  {['회의', '외근·출장', '미팅', '보고', '행사'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEventTag(tag)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                        eventTag === tag
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-panel border border-border text-ink2 hover:border-blue-400'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSchedule();
                    }
                  }}
                  placeholder="일정 제목 입력 (예: 데이터 플랫폼 백엔드 회의, 거래처 미팅)"
                  className="flex-1 rounded-lg border border-border bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-blue-500"
                />
                <Button
                  size="sm"
                  onClick={handleAddSchedule}
                  disabled={!eventTitle.trim()}
                >
                  <Plus size={13} />
                  <span>일정 추가</span>
                </Button>
              </div>
            </div>
          ) : (
            /* 2) 📋 일반 업무 추가 폼 */
            <div className="rounded-xl border border-teal/25 bg-teal-soft/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-teal">
                  <CheckSquare size={13} />
                  <span>새 일반 업무 등록 (오늘 완수할 To-Do 체크리스트)</span>
                </span>
                <div className="flex items-center gap-1">
                  {['집중', '마감', '교육', '보고'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTodoTag(todoTag === tag ? '' : tag)}
                      className={`rounded px-2 py-0.5 text-[10.5px] font-medium transition-all cursor-pointer ${
                        todoTag === tag
                          ? 'bg-teal text-white shadow-2xs'
                          : 'bg-panel border border-border text-ink3 hover:border-teal hover:text-teal'
                      }`}
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={todoText}
                  onChange={(e) => setTodoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTodo();
                    }
                  }}
                  placeholder="할 일 내용 입력 (예: 결산 리포트 데이터 검증, 배치 쿼리 최적화)"
                  className="flex-1 rounded-lg border border-border bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-teal"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAddTodo}
                  disabled={!todoText.trim()}
                >
                  <Plus size={13} />
                  <span>업무 추가</span>
                </Button>
              </div>
            </div>
          )}

          {/* ────────────────── 오늘 작성된 계획 목록 ────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11.5px] font-bold text-ink px-1">
              <span>오늘의 계획 목록 ({parsedItems.filter(i => i.text).length}건)</span>
              {progress && (
                <span className="text-teal text-[11px]">
                  진행률: {progress.completed}/{progress.total}건 완료 ({progress.percent}%)
                </span>
              )}
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-1.5 rounded-xl border border-border bg-panel p-2.5">
              {parsedItems.filter(i => i.text).length === 0 ? (
                <div className="py-8 text-center text-[12px] text-ink3">
                  아직 등록된 계획이 없습니다. 상단에서 일정이나 업무를 추가해주세요.
                </div>
              ) : (
                parsedItems.map((item, idx) => {
                  if (!item.text && !item.tag) return null;
                  const { startTime, endTime, cleanText } = extractTimeFromText(item.text);
                  const hasTime = Boolean(startTime);
                  const tagMeta = item.tag ? getWorkPlanTagMeta(item.tag, tagMap) : null;

                  return (
                    <div
                      key={item.id || idx}
                      className="group flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-panel-alt/30 px-3 py-2 hover:bg-panel-alt transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* 완료 체크 버튼 */}
                        <button
                          type="button"
                          onClick={() => handleToggle(idx)}
                          className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded border transition-colors cursor-pointer ${
                            item.completed
                              ? 'border-teal bg-teal text-white'
                              : 'border-border bg-panel hover:border-teal'
                          }`}
                        >
                          {item.completed && <CheckCircle2 size={12} />}
                        </button>

                        {/* 시간 일정인 경우 시간 뱃지 */}
                        {hasTime && (
                          <span className="shrink-0 flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10.5px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <Clock size={11} />
                            <span>{startTime}{endTime ? `~${endTime}` : ''}</span>
                          </span>
                        )}

                        {/* 태그 뱃지 */}
                        {tagMeta && (
                          <span className={`shrink-0 rounded px-1.5 py-0.2 text-[10px] font-bold ${tagMeta.badgeClass}`}>
                            {tagMeta.tag}
                          </span>
                        )}

                        {/* 본문 텍스트 */}
                        <span
                          className={`text-[12px] truncate ${
                            item.completed ? 'line-through text-ink3' : 'text-ink'
                          }`}
                        >
                          {cleanText || item.text}
                        </span>
                      </div>

                      {/* 개별 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        className="opacity-0 group-hover:opacity-100 rounded p-1 text-ink3 hover:text-rose-500 transition-all shrink-0 cursor-pointer"
                        title="항목 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 하단 부서 캘린더 동기화 설정 */}
          <div className="flex items-center justify-between rounded-xl border border-teal/25 bg-teal-soft/15 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-teal/15 text-teal">
                <CalendarDays size={15} />
              </div>
              <div>
                <div className="text-[11.5px] font-bold text-ink flex items-center gap-1.5">
                  <span>부서 캘린더 자동 등록 & 실시간 공유</span>
                  <span className="rounded bg-teal/20 px-1 py-0.2 text-[9px] font-bold text-teal">추천</span>
                </div>
                <div className="text-[10px] text-ink3">
                  시간 일정이나 회의·외근 등 주요 일정이 포함된 항목을 부서 캘린더에 자동으로 등록/동기화합니다.
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
              <input
                type="checkbox"
                checked={shareToCalendar}
                onChange={(e) => setShareToCalendar(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-teal"></div>
            </label>
          </div>

          {/* 모달 하단 액션 버튼 */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              {onDelete && initialContent && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="flex items-center gap-1 text-[11.5px] font-semibold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>계획 전체 삭제</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={onClose} disabled={isSaving}>
                취소
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !content.trim()}>
                {isSaving ? '저장 중…' : '저장하기'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <WorkPlanConfigModal
        isOpen={Boolean(configModalTab)}
        onClose={() => setConfigModalTab(null)}
        defaultTab={configModalTab ?? 'templates'}
      />
    </>
  );
}
