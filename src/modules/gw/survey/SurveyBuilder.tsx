import { useMemo, useState } from 'react';
import type { CommonCode } from '@/domain/commonCode/schema';
import type { Department } from '@/domain/department/schema';
import type { User } from '@/domain/user/schema';
import { selectableSurveyCategories } from '@/domain/survey/category';
import { SurveyError, surveyEditScope } from '@/domain/survey/engine';
import {
  SURVEY_AUDIENCE_TYPES,
  SURVEY_AUDIENCE_TYPE_LABELS,
  type Survey,
  type SurveyAudienceType,
  type SurveyDraft,
} from '@/domain/survey/schema';
import {
  SURVEY_LONG_TEXT_MAX,
  SURVEY_MAX_QUESTIONS,
  SURVEY_QUESTION_TYPE_LABELS,
  SURVEY_QUESTION_TYPES,
  SURVEY_SHORT_TEXT_MAX,
  isChoiceQuestion,
  type SurveyQuestion,
  type SurveyQuestionType,
} from '@/domain/surveyQuestion/schema';
import { useSaveSurveyQuestions, useUpdateSurveyBasics } from '@/features/survey/useSurveys';
import { useSurveyBuilder, type BuilderCard } from '@/features/survey/useSurveyBuilder';
import { Modal } from '@/shared/ui/Modal';
import { QuestionTypeBadge, SurveyStatusBadge } from './SurveyBadges';
import { fromDateTimeInput, toDateTimeInput } from './surveyDate';
import { Button } from '@/shared/ui/Button';

const toDraft = (row: Survey): SurveyDraft => ({
  title: row.title,
  description: row.description,
  categoryCode: row.categoryCode,
  audienceType: row.audienceType,
  audienceDeptIds: [...row.audienceDeptIds],
  audienceUserIds: [...row.audienceUserIds],
  anonymous: row.anonymous,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  showResultToRespondent: row.showResultToRespondent,
});

const message = (error: unknown) =>
  error instanceof SurveyError ? error.message : (error instanceof Error ? error.message : '저장하지 못했습니다.');

const FIELD = 'w-full rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none focus:border-teal disabled:bg-ink3/8 disabled:text-ink3';
const LABEL = 'mb-1 block text-[10px] font-bold text-ink2';

interface Props {
  actor: User;
  survey: Survey;
  questions: SurveyQuestion[];
  categories: CommonCode[];
  departments: Department[];
  users: User[];
  onNotice: (text: string) => void;
  onBack: () => void;
}

/** 설문 작성 — 기본정보와 질문 카드. ([[jwheo/feat/survey/DESIGN.md]] §8 · §11.3) */
export default function SurveyBuilder({ actor, survey, questions, categories, departments, users, onNotice, onBack }: Props) {
  const scope = useMemo(() => surveyEditScope(survey), [survey]);
  const [basics, setBasics] = useState<SurveyDraft>(() => toDraft(survey));
  const [error, setError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkType, setBulkType] = useState<SurveyQuestionType>('RATING');
  const [bulkText, setBulkText] = useState('');
  const [optionSheet, setOptionSheet] = useState<{ key: string; text: string; warning: string } | null>(null);
  const builder = useSurveyBuilder(questions);
  const saveBasics = useUpdateSurveyBasics();
  const saveQuestions = useSaveSurveyQuestions();

  const basicsDirty = JSON.stringify(basics) !== JSON.stringify(toDraft(survey));
  const dirty = basicsDirty || builder.dirty;
  const saving = saveBasics.isPending || saveQuestions.isPending;
  const activeUsers = users.filter((user) => user.status === '사용');
  const set = <K extends keyof SurveyDraft>(key: K, value: SurveyDraft[K]) =>
    setBasics((previous) => ({ ...previous, [key]: value }));

  const changeAudienceType = (type: SurveyAudienceType) =>
    setBasics((previous) => ({
      ...previous,
      audienceType: type,
      audienceDeptIds: type === 'DEPARTMENT' ? previous.audienceDeptIds : [],
      audienceUserIds: type === 'USERS' ? previous.audienceUserIds : [],
    }));

  const toggle = (key: 'audienceDeptIds' | 'audienceUserIds', id: string) =>
    setBasics((previous) => ({
      ...previous,
      [key]: previous[key].includes(id) ? previous[key].filter((item) => item !== id) : [...previous[key], id],
    }));

  const save = async () => {
    setError('');
    try {
      if (basicsDirty) await saveBasics.mutateAsync({ actor, id: survey.id, draft: basics });
      if (builder.dirty) await saveQuestions.mutateAsync({ actor, surveyId: survey.id, drafts: builder.toDrafts() });
      builder.reset();
      onNotice('설문을 저장했습니다.');
    } catch (caught) {
      setError(message(caught));
    }
  };

  const applyBulk = () => {
    const added = builder.addBulk(bulkType, bulkText);
    setBulkOpen(false);
    setBulkText('');
    if (added > 0) onNotice(`질문 ${added}개를 추가했습니다.`);
  };

  const applyOptionLines = () => {
    if (!optionSheet) return;
    const duplicates = builder.setOptionsFromLines(optionSheet.key, optionSheet.text);
    if (duplicates.length > 0) {
      setOptionSheet({ ...optionSheet, warning: `같은 문구의 선택지가 있습니다: ${duplicates.join(', ')}` });
      return;
    }
    setOptionSheet(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={onBack} size="sm">← 목록</Button>
          <SurveyStatusBadge status={survey.status} />
          {!scope.questions && <span className="rounded bg-amber/15 px-1.5 py-px text-[9.5px] font-bold text-amber">질문 잠김</span>}
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[10px] font-bold text-amber">저장되지 않은 변경이 있습니다</span>}
          <Button disabled={!dirty || saving} onClick={save} variant="primary">
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[11px] font-semibold text-red-500">{error}</div>}
      {survey.firstRespondedAt !== null && (
        <div className="rounded-lg border border-amber/25 bg-amber-soft/25 px-3 py-2.5 text-[10.5px] text-ink2">
          응답이 시작되어 질문 구조와 대상이 잠겼습니다. 구조를 바꾸려면 설문을 복제해 새로 배포하세요.
        </div>
      )}

      <section className="rounded-xl border border-border bg-panel p-5 shadow-sm">
        <div className="mb-3 text-[12px] font-bold text-ink">설문 기본정보</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="survey-title">제목</label>
            <input id="survey-title" className={FIELD} value={basics.title} disabled={!scope.title} maxLength={100} onChange={(event) => set('title', event.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="survey-description">설명</label>
            <textarea id="survey-description" rows={2} className={FIELD} value={basics.description} disabled={!scope.description} maxLength={1000} onChange={(event) => set('description', event.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="survey-category">분류</label>
            <select id="survey-category" className={FIELD} value={basics.categoryCode} disabled={!scope.category} onChange={(event) => set('categoryCode', event.target.value)}>
              {selectableSurveyCategories(categories).map((code) => <option key={code.code} value={code.code}>{code.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink2">
              <input type="checkbox" checked={basics.anonymous} disabled={!scope.anonymous} onChange={(event) => set('anonymous', event.target.checked)} />
              익명 응답
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink2">
              <input type="checkbox" checked={basics.showResultToRespondent} disabled={!scope.showResult} onChange={(event) => set('showResultToRespondent', event.target.checked)} />
              응답자에게 결과 공개
            </label>
          </div>
          <div>
            <label className={LABEL} htmlFor="survey-starts">응답 시작</label>
            <input id="survey-starts" type="datetime-local" className={FIELD} value={toDateTimeInput(basics.startsAt)} disabled={!scope.startsAt} onChange={(event) => set('startsAt', fromDateTimeInput(event.target.value))} />
          </div>
          <div>
            <label className={LABEL} htmlFor="survey-ends">응답 마감{scope.extendEndsAtOnly && <span className="ml-1 font-normal text-amber">연장만 가능</span>}</label>
            <input id="survey-ends" type="datetime-local" className={FIELD} value={toDateTimeInput(basics.endsAt)} disabled={!scope.endsAt} onChange={(event) => set('endsAt', fromDateTimeInput(event.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <span className={LABEL}>대상</span>
            <div className="flex flex-wrap gap-1.5">
              {SURVEY_AUDIENCE_TYPES.map((type) => (
                <button key={type} type="button" disabled={!scope.audience} onClick={() => changeAudienceType(type)} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-45 ${basics.audienceType === type ? 'bg-teal text-white' : 'bg-ink3/8 text-ink2 hover:bg-ink3/15'}`}>
                  {SURVEY_AUDIENCE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            {basics.audienceType === 'DEPARTMENT' && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {departments.map((dept) => (
                  <label key={dept.id} className="flex items-center gap-2 px-1 py-1 text-[11px] text-ink2">
                    <input type="checkbox" checked={basics.audienceDeptIds.includes(dept.id)} disabled={!scope.audience} onChange={() => toggle('audienceDeptIds', dept.id)} />
                    {dept.name}
                  </label>
                ))}
                <div className="px-1 pt-1 text-[9.5px] text-ink3">하위 부서는 자동으로 포함되지 않습니다. 필요하면 각각 선택하세요.</div>
              </div>
            )}
            {basics.audienceType === 'USERS' && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {activeUsers.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 px-1 py-1 text-[11px] text-ink2">
                    <input type="checkbox" checked={basics.audienceUserIds.includes(user.id)} disabled={!scope.audience} onChange={() => toggle('audienceUserIds', user.id)} />
                    {user.name} <span className="text-ink3">· {user.dept}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        {builder.cards.map((card, index) => (
          <QuestionCard
            key={card.key}
            card={card}
            index={index}
            total={builder.cards.length}
            editable={scope.questions}
            builder={builder}
            onOpenOptionSheet={() => setOptionSheet({ key: card.key, text: card.options.map((option) => option.label).join('\n'), warning: '' })}
          />
        ))}
        {builder.cards.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-panel px-6 py-10 text-center text-[11px] text-ink3">
            질문이 없습니다. 아래에서 질문을 추가하세요.
          </div>
        )}
      </section>

      {scope.questions && (
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-lg border border-border bg-panel px-3 text-[11px] font-bold text-ink outline-none" value={bulkType} onChange={(event) => setBulkType(event.target.value as SurveyQuestionType)}>
            {SURVEY_QUESTION_TYPES.map((type) => <option key={type} value={type}>{SURVEY_QUESTION_TYPE_LABELS[type]}</option>)}
          </select>
          <Button variant="accent" disabled={builder.full} onClick={() => builder.add(bulkType)}>+ 질문 추가</Button>
          <Button disabled={builder.full} onClick={() => setBulkOpen(true)}>질문 일괄 추가</Button>
          <span className="text-[10px] text-ink3">{builder.cards.length} / {SURVEY_MAX_QUESTIONS}</span>
        </div>
      )}

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="질문 일괄 추가" width={520}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setBulkOpen(false)}>취소</Button>
            <Button onClick={applyBulk} variant="primary">추가</Button>
          </div>
        }>
        <div className="space-y-2">
          <div className="text-[10.5px] text-ink3">한 줄이 질문 하나가 됩니다. 추가한 뒤 카드별로 수정할 수 있습니다.</div>
          <select className={FIELD} value={bulkType} onChange={(event) => setBulkType(event.target.value as SurveyQuestionType)}>
            {SURVEY_QUESTION_TYPES.map((type) => <option key={type} value={type}>{SURVEY_QUESTION_TYPE_LABELS[type]}</option>)}
          </select>
          <textarea rows={7} className={FIELD} value={bulkText} placeholder={'근무 환경에 만족하십니까?\n복리후생에 만족하십니까?\n업무 도구에 만족하십니까?'} onChange={(event) => setBulkText(event.target.value)} />
        </div>
      </Modal>

      <Modal open={optionSheet !== null} onClose={() => setOptionSheet(null)} title="선택지 일괄 입력" width={460}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOptionSheet(null)}>취소</Button>
            <Button onClick={applyOptionLines} variant="primary">적용</Button>
          </div>
        }>
        {optionSheet && (
          <div className="space-y-2">
            <div className="text-[10.5px] text-ink3">한 줄이 선택지 하나가 됩니다. 빈 줄과 앞뒤 공백은 자동으로 제거됩니다.</div>
            {optionSheet.warning && <div className="rounded-lg border border-amber/25 bg-amber-soft/25 px-2.5 py-2 text-[10.5px] font-semibold text-amber">{optionSheet.warning} 그대로 적용하려면 다시 누르세요.</div>}
            <textarea rows={7} className={FIELD} value={optionSheet.text} onChange={(event) => setOptionSheet({ ...optionSheet, text: event.target.value, warning: '' })} />
          </div>
        )}
      </Modal>
    </div>
  );
}

interface CardProps {
  card: BuilderCard;
  index: number;
  total: number;
  editable: boolean;
  builder: ReturnType<typeof useSurveyBuilder>;
  onOpenOptionSheet: () => void;
}

function QuestionCard({ card, index, total, editable, builder, onOpenOptionSheet }: CardProps) {
  const textLimit = card.type === 'SHORT_TEXT' ? SURVEY_SHORT_TEXT_MAX : SURVEY_LONG_TEXT_MAX;
  return (
    <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-ink3">Q{index + 1}</span>
          <QuestionTypeBadge type={card.type} />
          {card.required && <span className="rounded bg-red-500/10 px-1.5 py-px text-[9.5px] font-bold text-red-500">필수</span>}
        </div>
        {editable && (
          <div className="flex items-center gap-1">
            <button type="button" disabled={index === 0} onClick={() => builder.move(card.key, -1)} className="rounded border border-border px-1.5 py-1 text-[10px] font-bold text-ink2 hover:bg-ink3/8 disabled:opacity-35" title="위로">↑</button>
            <button type="button" disabled={index === total - 1} onClick={() => builder.move(card.key, 1)} className="rounded border border-border px-1.5 py-1 text-[10px] font-bold text-ink2 hover:bg-ink3/8 disabled:opacity-35" title="아래로">↓</button>
            <button type="button" disabled={builder.full} onClick={() => builder.duplicate(card.key)} className="rounded border border-border px-2 py-1 text-[10px] font-bold text-ink2 hover:bg-ink3/8 disabled:opacity-35">복제</button>
            <button type="button" onClick={() => builder.remove(card.key)} className="rounded border border-red-500/25 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500/8">삭제</button>
          </div>
        )}
      </div>

      <input className={FIELD} value={card.title} disabled={!editable} maxLength={300} placeholder="질문 문구" onChange={(event) => builder.patch(card.key, { title: event.target.value })} />

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select className={FIELD} value={card.type} disabled={!editable} onChange={(event) => builder.changeType(card.key, event.target.value as SurveyQuestionType)}>
          {SURVEY_QUESTION_TYPES.map((type) => <option key={type} value={type}>{SURVEY_QUESTION_TYPE_LABELS[type]}</option>)}
        </select>
        <label className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink2">
          <input type="checkbox" checked={card.required} disabled={!editable} onChange={(event) => builder.patch(card.key, { required: event.target.checked })} />
          필수 응답
        </label>
      </div>

      <input className={`${FIELD} mt-2`} value={card.description} disabled={!editable} maxLength={500} placeholder="설명 (선택)" onChange={(event) => builder.patch(card.key, { description: event.target.value })} />

      {isChoiceQuestion(card.type) && (
        <div className="mt-2 space-y-1.5">
          {card.options.map((option) => (
            <div key={option.id} className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 text-[9.5px] font-semibold text-ink3">{option.id}</span>
              <input className={FIELD} value={option.label} disabled={!editable} maxLength={200} placeholder="선택지 문구" onChange={(event) => builder.setOption(card.key, option.id, event.target.value)} />
              {editable && card.options.length > 2 && (
                <button type="button" onClick={() => builder.removeOption(card.key, option.id)} className="shrink-0 rounded border border-border px-2 py-1.5 text-[10px] font-bold text-ink3 hover:bg-ink3/8">✕</button>
              )}
            </div>
          ))}
          {editable && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => builder.addOption(card.key)} className="rounded border border-border px-2.5 py-1 text-[10px] font-bold text-ink2 hover:bg-ink3/8">+ 선택지</button>
              <button type="button" onClick={onOpenOptionSheet} className="rounded border border-border px-2.5 py-1 text-[10px] font-bold text-ink2 hover:bg-ink3/8">줄바꿈 일괄 입력</button>
            </div>
          )}
        </div>
      )}

      {card.type === 'RATING' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className={FIELD} value={card.ratingMinLabel} disabled={!editable} maxLength={30} placeholder="1점 문구" onChange={(event) => builder.patch(card.key, { ratingMinLabel: event.target.value })} />
          <input className={FIELD} value={card.ratingMaxLabel} disabled={!editable} maxLength={30} placeholder="5점 문구" onChange={(event) => builder.patch(card.key, { ratingMaxLabel: event.target.value })} />
        </div>
      )}

      {(card.type === 'SHORT_TEXT' || card.type === 'LONG_TEXT') && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-bold text-ink2">글자 수 제한</span>
          <input type="number" min={1} max={textLimit} className="w-28 rounded-lg border border-border bg-panel px-2 py-1.5 text-[11px] text-ink outline-none focus:border-teal disabled:bg-ink3/8" value={card.maxLength ?? ''} disabled={!editable} placeholder={`기본 ${textLimit}`} onChange={(event) => builder.patch(card.key, { maxLength: event.target.value ? Number(event.target.value) : null })} />
        </div>
      )}
    </div>
  );
}
