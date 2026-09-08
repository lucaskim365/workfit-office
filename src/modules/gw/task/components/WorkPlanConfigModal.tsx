import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import {
  useWorkPlanConfig,
  TAG_COLOR_PRESETS,
  type WorkPlanCustomTag,
} from '@/features/workPlan/useWorkPlanConfig';
import type { WorkPlanTemplate } from '@/domain/workPlan/engine';
import {
  Sparkles,
  Tag,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';

const COMMON_EMOJIS = ['🔵', '🟣', '🟠', '📋', '🚀', '💡', '🛠️', '⚡', '☕', '💼', '📈', '🎯', '✨', '📝'];

interface WorkPlanConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'templates' | 'tags';
}

export function WorkPlanConfigModal({
  isOpen,
  onClose,
  defaultTab = 'templates',
}: WorkPlanConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'tags'>(defaultTab);

  const {
    templates,
    tags,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetTemplates,
    addTag,
    updateTag,
    deleteTag,
    resetTags,
  } = useWorkPlanConfig();

  // --- 템플릿 편집 상태 ---
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [isAddingTpl, setIsAddingTpl] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplIcon, setTplIcon] = useState('📋');
  const [tplContent, setTplContent] = useState('');

  // --- 태그 편집 상태 ---
  const [editingTagOriginal, setEditingTagOriginal] = useState<string | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColorId, setTagColorId] = useState('teal');

  // 템플릿 등록/수정 시작
  const startEditTemplate = (tpl: WorkPlanTemplate) => {
    setEditingTplId(tpl.id);
    setIsAddingTpl(false);
    setTplName(tpl.name);
    setTplDesc(tpl.desc);
    setTplIcon(tpl.icon);
    setTplContent(tpl.content);
  };

  const startAddTemplate = () => {
    setEditingTplId(null);
    setIsAddingTpl(true);
    setTplName('');
    setTplDesc('');
    setTplIcon('📋');
    setTplContent('- [ ] 새로운 할 일');
  };

  const cancelTplForm = () => {
    setEditingTplId(null);
    setIsAddingTpl(false);
  };

  const saveTemplateForm = () => {
    if (!tplName.trim() || !tplContent.trim()) return;
    if (editingTplId) {
      updateTemplate(editingTplId, {
        name: tplName.trim(),
        desc: tplDesc.trim(),
        icon: tplIcon,
        content: tplContent.trim(),
      });
    } else {
      addTemplate({
        name: tplName.trim(),
        desc: tplDesc.trim(),
        icon: tplIcon,
        content: tplContent.trim(),
      });
    }
    cancelTplForm();
  };

  // 태그 등록/수정 시작
  const startEditTag = (t: WorkPlanCustomTag) => {
    setEditingTagOriginal(t.tag);
    setIsAddingTag(false);
    setTagName(t.tag);
    setTagColorId(t.colorId);
  };

  const startAddTag = () => {
    setEditingTagOriginal(null);
    setIsAddingTag(true);
    setTagName('');
    setTagColorId('teal');
  };

  const cancelTagForm = () => {
    setEditingTagOriginal(null);
    setIsAddingTag(false);
  };

  const saveTagForm = () => {
    const clean = tagName.trim();
    if (!clean) return;
    if (editingTagOriginal) {
      updateTag(editingTagOriginal, clean, tagColorId);
    } else {
      addTag(clean, tagColorId);
    }
    cancelTagForm();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="업무계획 루틴 템플릿 및 태그 관리"
      width={680}
    >
      <div className="space-y-4">
        {/* 상단 탭 네비게이션 */}
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('templates');
                cancelTplForm();
                cancelTagForm();
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
                activeTab === 'templates'
                  ? 'bg-teal-soft/30 text-teal border border-teal/40 shadow-2xs'
                  : 'text-ink3 hover:bg-panel-alt hover:text-ink'
              }`}
            >
              <Sparkles size={14} className={activeTab === 'templates' ? 'text-amber-500' : ''} />
              <span>루틴 템플릿 ({templates.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('tags');
                cancelTplForm();
                cancelTagForm();
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
                activeTab === 'tags'
                  ? 'bg-teal-soft/30 text-teal border border-teal/40 shadow-2xs'
                  : 'text-ink3 hover:bg-panel-alt hover:text-ink'
              }`}
            >
              <Tag size={14} />
              <span>업무 태그 ({tags.length})</span>
            </button>
          </div>

          <div>
            {activeTab === 'templates' && !isAddingTpl && !editingTplId && (
              <button
                type="button"
                onClick={startAddTemplate}
                className="flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-[11.5px] font-bold text-white hover:opacity-90 transition-opacity shadow-2xs"
              >
                <Plus size={13} />
                <span>새 템플릿</span>
              </button>
            )}

            {activeTab === 'tags' && !isAddingTag && !editingTagOriginal && (
              <button
                type="button"
                onClick={startAddTag}
                className="flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-[11.5px] font-bold text-white hover:opacity-90 transition-opacity shadow-2xs"
              >
                <Plus size={13} />
                <span>새 태그</span>
              </button>
            )}
          </div>
        </div>

        {/* ============================================================
            TAB 1: 루틴 템플릿 관리
           ============================================================ */}
        {activeTab === 'templates' && (
          <div className="space-y-3">
            {/* 추가/수정 폼 */}
            {(isAddingTpl || editingTplId) && (
              <div className="rounded-xl border border-teal/40 bg-teal-soft/10 p-3.5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-extrabold text-ink flex items-center gap-1.5">
                    <Sparkles size={13} className="text-teal" />
                    {editingTplId ? '템플릿 수정' : '새 루틴 템플릿 추가'}
                  </span>
                  <button
                    type="button"
                    onClick={cancelTplForm}
                    className="rounded p-1 text-ink3 hover:bg-panel hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold text-ink3">템플릿 이름 *</label>
                    <input
                      type="text"
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      placeholder="예: 개발 데일리 스크럼"
                      className="h-8 w-full rounded-lg border border-border bg-panel px-2.5 text-[12px] text-ink outline-none focus:border-teal"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold text-ink3">한 줄 설명</label>
                    <input
                      type="text"
                      value={tplDesc}
                      onChange={(e) => setTplDesc(e.target.value)}
                      placeholder="예: 어제 한 일, 오늘 할 일 공유"
                      className="h-8 w-full rounded-lg border border-border bg-panel px-2.5 text-[12px] text-ink outline-none focus:border-teal"
                    />
                  </div>
                </div>

                {/* 아이콘 선택 */}
                <div>
                  <label className="mb-1 block text-[10.5px] font-bold text-ink3">아이콘 선택</label>
                  <div className="flex flex-wrap gap-1">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setTplIcon(emoji)}
                        className={`h-7 w-7 rounded-md border text-[13px] flex items-center justify-center transition-all ${
                          tplIcon === emoji
                            ? 'border-teal bg-teal/20 scale-110 shadow-2xs'
                            : 'border-border bg-panel hover:bg-panel-alt'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 마크다운 내용 */}
                <div>
                  <label className="mb-1 block text-[10.5px] font-bold text-ink3">
                    템플릿 To-Do 본문 * (마크다운 체크리스트)
                  </label>
                  <textarea
                    rows={4}
                    value={tplContent}
                    onChange={(e) => setTplContent(e.target.value)}
                    placeholder="- [ ] [회의] 아침 일일 스크럼 참석&#10;- [ ] [집중] 기능 개발 진행"
                    className="w-full rounded-lg border border-border bg-panel p-2.5 text-[12px] font-mono text-ink outline-none focus:border-teal"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelTplForm}
                    className="rounded-lg border border-border bg-panel px-3 py-1 text-[11.5px] font-semibold text-ink2 hover:bg-panel-alt"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={saveTemplateForm}
                    disabled={!tplName.trim() || !tplContent.trim()}
                    className="flex items-center gap-1 rounded-lg bg-teal px-3.5 py-1 text-[11.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    <Check size={13} />
                    <span>{editingTplId ? '변경사항 저장' : '등록'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 템플릿 목록 리스트 */}
            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {templates.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-ink3">등록된 템플릿이 없습니다.</div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="group rounded-xl border border-border bg-panel p-3 hover:border-border-hi transition-all shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px]">{tpl.icon}</span>
                        <div>
                          <h4 className="text-[12.5px] font-bold text-ink">{tpl.name}</h4>
                          {tpl.desc && <p className="text-[10.5px] text-ink3">{tpl.desc}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEditTemplate(tpl)}
                          className="rounded p-1 text-ink3 hover:bg-panel-alt hover:text-teal transition-colors"
                          title="템플릿 수정"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`'${tpl.name}' 템플릿을 삭제하시겠습니까?`)) {
                              deleteTemplate(tpl.id);
                            }
                          }}
                          className="rounded p-1 text-ink3 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                          title="템플릿 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <pre className="rounded-lg bg-panel-alt/50 p-2 text-[11px] font-mono text-ink2 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {tpl.content}
                    </pre>
                  </div>
                ))
              )}
            </div>

            {/* 기본값 초기화 */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[10.5px] text-ink3">
                자주 사용하는 업무 패턴을 등록해두면 계획 작성 시 한 번의 클릭으로 자동 입력됩니다.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('루틴 템플릿을 기본 추천 목록으로 초기화하시겠습니까?')) {
                    resetTemplates();
                    cancelTplForm();
                  }
                }}
                className="flex items-center gap-1 text-[10.5px] font-semibold text-ink3 hover:text-rose-500 transition-colors shrink-0"
              >
                <RotateCcw size={11} />
                <span>기본값으로 복원</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: 업무 태그 관리
           ============================================================ */}
        {activeTab === 'tags' && (
          <div className="space-y-3">
            {/* 태그 추가/수정 폼 */}
            {(isAddingTag || editingTagOriginal) && (
              <div className="rounded-xl border border-teal/40 bg-teal-soft/10 p-3.5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-extrabold text-ink flex items-center gap-1.5">
                    <Tag size={13} className="text-teal" />
                    {editingTagOriginal ? `'${editingTagOriginal}' 태그 수정` : '새 업무 태그 추가'}
                  </span>
                  <button
                    type="button"
                    onClick={cancelTagForm}
                    className="rounded p-1 text-ink3 hover:bg-panel hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold text-ink3">태그 이름 *</label>
                    <input
                      type="text"
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      placeholder="예: 기획, 디자인, 검수, CS"
                      className="h-8 w-full rounded-lg border border-border bg-panel px-2.5 text-[12px] text-ink outline-none focus:border-teal"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold text-ink3">미리보기</label>
                    <div className="flex h-8 items-center">
                      {tagName.trim() ? (
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                            TAG_COLOR_PRESETS.find((p) => p.id === tagColorId)?.badgeClass || ''
                          }`}
                        >
                          {tagName.trim()}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink3 italic">태그명을 입력하세요</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 색상 프리셋 선택 */}
                <div>
                  <label className="mb-1 block text-[10.5px] font-bold text-ink3">색상 테마 선택</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setTagColorId(preset.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          tagColorId === preset.id
                            ? 'border-teal ring-2 ring-teal/30 bg-panel text-ink'
                            : 'border-border bg-panel text-ink2 hover:bg-panel-alt'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${preset.dotColor}`} />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelTagForm}
                    className="rounded-lg border border-border bg-panel px-3 py-1 text-[11.5px] font-semibold text-ink2 hover:bg-panel-alt"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={saveTagForm}
                    disabled={!tagName.trim()}
                    className="flex items-center gap-1 rounded-lg bg-teal px-3.5 py-1 text-[11.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    <Check size={13} />
                    <span>{editingTagOriginal ? '변경사항 저장' : '태그 등록'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 등록된 태그 목록 */}
            <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {tags.map((t) => (
                  <div
                    key={t.tag}
                    className="group flex items-center justify-between rounded-xl border border-border bg-panel p-2.5 hover:border-border-hi transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${t.dotColor}`} />
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${t.badgeClass}`}>
                        {t.tag}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => startEditTag(t)}
                        className="rounded p-1 text-ink3 hover:bg-panel-alt hover:text-teal transition-colors"
                        title="태그 수정"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`'${t.tag}' 태그를 삭제하시겠습니까?`)) {
                            deleteTag(t.tag);
                          }
                        }}
                        className="rounded p-1 text-ink3 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                        title="태그 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 기본값 초기화 */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[10.5px] text-ink3">
                등록된 태그는 업무 계획 작성 시 원클릭 삽입 버튼과 인라인 태그 셀렉터에 즉시 반영됩니다.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('업무 태그를 기본 권장 목록으로 초기화하시겠습니까?')) {
                    resetTags();
                    cancelTagForm();
                  }
                }}
                className="flex items-center gap-1 text-[10.5px] font-semibold text-ink3 hover:text-rose-500 transition-colors shrink-0"
              >
                <RotateCcw size={11} />
                <span>기본 태그 복원</span>
              </button>
            </div>
          </div>
        )}

        {/* 닫기 버튼 */}
        <div className="flex justify-end pt-2 border-t border-border">
          <Button size="sm" variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
