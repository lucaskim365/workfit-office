import { useState, useMemo } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import {
  parseWorkPlanItems,
  calculatePlanProgress,
  getWorkPlanTagMeta,
} from '@/domain/workPlan/engine';
import {
  useWorkPlanConfig,
} from '@/features/workPlan/useWorkPlanConfig';
import { WorkPlanConfigModal } from './WorkPlanConfigModal';
import { CheckSquare, Tag, Sparkles, Trash2, CheckCircle2, Settings } from 'lucide-react';

interface WorkPlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  dateTitle: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function WorkPlanEditorModal({
  isOpen,
  onClose,
  dateTitle,
  initialContent,
  onSave,
  onDelete,
}: WorkPlanEditorModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [configModalTab, setConfigModalTab] = useState<'templates' | 'tags' | null>(null);

  const { templates, tags, tagMap } = useWorkPlanConfig();

  const parsedItems = useMemo(() => parseWorkPlanItems(content), [content]);
  const progress = useMemo(() => calculatePlanProgress(content), [content]);

  // 빠른 태그 추가
  const handleInsertTag = (tag: string) => {
    setContent((prev) => {
      const trimmed = prev.trim();
      const newLine = `- [ ] [${tag}] `;
      return trimmed ? `${trimmed}\n${newLine}` : newLine;
    });
  };

  // 일반 To-Do 추가
  const handleInsertTodo = () => {
    setContent((prev) => {
      const trimmed = prev.trim();
      const newLine = '- [ ] ';
      return trimmed ? `${trimmed}\n${newLine}` : newLine;
    });
  };

  // 템플릿 적용
  const handleApplyTemplate = (tplContent: string) => {
    setContent((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${tplContent}` : tplContent;
    });
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await onSave(content.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm('이 날짜의 업무계획을 삭제하시겠습니까?')) return;
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
        width={640}
      >
        <div className="space-y-4">
          {/* 빠른 템플릿 영역 */}
          <div className="rounded-xl border border-border bg-panel-alt/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                <Sparkles size={13} className="text-amber-500" />
                자주 쓰는 루틴 템플릿
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ink3">클릭 시 내용에 추가됩니다</span>
                <button
                  type="button"
                  onClick={() => setConfigModalTab('templates')}
                  className="flex items-center gap-1 text-[10.5px] font-bold text-teal hover:underline"
                  title="루틴 템플릿 추가/수정/삭제"
                >
                  <Settings size={11} />
                  <span>템플릿 관리</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl.content)}
                  className="flex items-center gap-1 rounded-lg border border-border bg-panel px-2.5 py-1 text-[11px] font-medium text-ink2 hover:border-teal hover:bg-teal-soft/20 hover:text-teal transition-all shadow-2xs"
                  title={tpl.desc}
                >
                  <span>{tpl.icon}</span>
                  <span>{tpl.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 편집기 상단 툴바 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleInsertTodo}
                className="flex items-center gap-1 rounded-md border border-border bg-panel px-2 py-1 text-[11px] font-bold text-ink hover:bg-panel-alt transition-colors"
              >
                <CheckSquare size={13} className="text-teal" />
                <span>+ 할 일 추가</span>
              </button>
              <span className="mx-1 text-border">|</span>
              <span className="text-[10.5px] font-bold text-ink3 flex items-center gap-1">
                <Tag size={12} /> 태그:
              </span>
              {tags.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => handleInsertTag(t.tag)}
                  className="rounded-md bg-panel-alt px-2 py-0.5 text-[10.5px] font-semibold text-ink2 hover:bg-teal-soft hover:text-teal transition-colors"
                >
                  +{t.tag}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setConfigModalTab('tags')}
                className="rounded p-1 text-ink3 hover:text-teal hover:bg-panel-alt transition-colors"
                title="업무 태그 추가/편집"
              >
                <Settings size={12} />
              </button>
            </div>

            <div className="flex items-center rounded-lg border border-border bg-panel-alt p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                  activeTab === 'edit' ? 'bg-panel text-ink shadow-2xs' : 'text-ink3 hover:text-ink2'
                }`}
              >
                편집
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                  activeTab === 'preview' ? 'bg-panel text-teal shadow-2xs' : 'text-ink3 hover:text-ink2'
                }`}
              >
                미리보기
              </button>
            </div>
          </div>

        {/* 본문 편집 / 미리보기 영역 */}
        {activeTab === 'edit' ? (
          <div>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="- [ ] [회의] 오전 10시 부서 정기 미팅&#10;- [ ] [외근·출장] 오후 2시 고객사 방문 미팅&#10;- [ ] [보고] 미팅 결과 및 주간 리포트 작성"
              className="w-full rounded-xl border border-border bg-panel p-3.5 text-[12.5px] leading-relaxed text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal font-mono"
            />
            <p className="mt-1 text-[10.5px] text-ink3">
              💡 <span className="font-semibold text-ink2">- [ ] 할 일</span> 형태로 작성하면 체크리스트로 자동 인식되며, 카드에서 바로 체크할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="min-h-[190px] rounded-xl border border-border bg-panel p-4 space-y-2">
            {parsedItems.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-ink3">작성된 내용이 없습니다.</div>
            ) : (
              parsedItems.map((item, idx) => {
                if (!item.text && !item.tag && !item.isChecklist) return null;
                const tagMeta = item.tag ? getWorkPlanTagMeta(item.tag, tagMap) : null;

                return (
                  <div key={idx} className="flex items-center gap-2 py-0.5">
                    {item.isChecklist ? (
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                        item.completed ? 'border-teal bg-teal text-white' : 'border-border bg-panel'
                      }`}>
                        {item.completed && <CheckCircle2 size={12} />}
                      </span>
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink3" />
                    )}

                    {tagMeta && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${tagMeta.badgeClass}`}>
                        {tagMeta.tag}
                      </span>
                    )}

                    <span className={`text-[12px] ${item.completed ? 'line-through text-ink3' : 'text-ink'}`}>
                      {item.text}
                    </span>
                  </div>
                );
              })
            )}

            {progress && (
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-ink3">
                <span>진행률: {progress.completed}/{progress.total}건 완료</span>
                <span className="font-bold text-teal">{progress.percent}%</span>
              </div>
            )}
          </div>
        )}

        {/* 모달 하단 액션 버튼 */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            {onDelete && initialContent && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="flex items-center gap-1 text-[11.5px] font-semibold text-rose-500 hover:text-rose-600 transition-colors"
              >
                <Trash2 size={13} />
                <span>계획 삭제</span>
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
