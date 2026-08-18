import type { Survey } from '@/domain/survey/schema';
import {
  SURVEY_RATING_MAX,
  SURVEY_RATING_MIN,
  isChoiceQuestion,
  questionTextLimit,
  type SurveyQuestion,
} from '@/domain/surveyQuestion/schema';
import { audienceLabel, AnonymousBadge, SurveyStatusBadge } from './SurveyBadges';
import { formatSurveyPeriod } from './surveyDate';
import { Button } from '@/shared/ui/Button';

const scores = Array.from(
  { length: SURVEY_RATING_MAX - SURVEY_RATING_MIN + 1 },
  (_, index) => SURVEY_RATING_MIN + index,
);

/**
 * 배포 전 미리보기 — 응답자가 보게 될 화면을 입력 없이 그대로 보여준다.
 * 실제 응답 제출은 별도 화면에서 처리한다. ([[jwheo/feat/survey/DESIGN.md]] §11.3)
 */
export default function SurveyPreview({ survey, questions, onBack }: {
  survey: Survey;
  questions: SurveyQuestion[];
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button onClick={onBack} size="sm">← 목록</Button>
        <span className="rounded bg-ink3/10 px-2 py-1 text-[9.5px] font-bold text-ink2">미리보기 · 응답은 저장되지 않습니다</span>
      </div>

      <section className="rounded-xl border border-border bg-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <SurveyStatusBadge status={survey.status} />
          <AnonymousBadge anonymous={survey.anonymous} />
        </div>
        <h2 className="mt-2 text-[15px] font-bold text-ink">{survey.title}</h2>
        {survey.description && <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink2">{survey.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink3">
          <span>{audienceLabel(survey)}</span>
          <span>{formatSurveyPeriod(survey.startsAt, survey.endsAt)}</span>
          <span>질문 {questions.length}개</span>
        </div>
        {survey.anonymous && (
          <div className="mt-3 rounded-lg border border-teal/20 bg-teal-soft/25 px-3 py-2 text-[10.5px] text-teal">
            익명 설문입니다. 응답에 이름·부서가 저장되지 않으니 특정 개인을 알아볼 수 있는 내용은 남기지 말아 주세요.
          </div>
        )}
      </section>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-panel px-6 py-10 text-center text-[11px] text-ink3">
          질문이 없습니다. 배포하려면 질문을 한 개 이상 추가하세요.
        </div>
      ) : (
        questions.map((question, index) => (
          <section key={question.id} className="rounded-xl border border-border bg-panel p-4 shadow-sm">
            <div className="text-[12px] font-bold text-ink">
              <span className="mr-1.5 text-ink3">Q{index + 1}.</span>
              {question.title}
              {question.required && <span className="ml-1 text-red-500">*</span>}
            </div>
            {question.description && <p className="mt-1 text-[10.5px] text-ink3">{question.description}</p>}

            <div className="mt-3 space-y-1.5">
              {isChoiceQuestion(question.type) && question.options.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-[11.5px] text-ink2">
                  <input type={question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} disabled />
                  {option.label || <span className="text-ink3">(빈 선택지)</span>}
                </label>
              ))}

              {question.type === 'SHORT_TEXT' && (
                <input disabled className="w-full rounded-lg border border-border bg-ink3/5 px-3 py-2 text-[11.5px]" placeholder={`${questionTextLimit(question)}자 이내`} />
              )}
              {question.type === 'LONG_TEXT' && (
                <textarea disabled rows={3} className="w-full rounded-lg border border-border bg-ink3/5 px-3 py-2 text-[11.5px]" placeholder={`${questionTextLimit(question)}자 이내`} />
              )}

              {question.type === 'RATING' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink3">{question.ratingMinLabel}</span>
                  {scores.map((score) => (
                    <label key={score} className="flex flex-col items-center gap-0.5 text-[10px] text-ink2">
                      <input type="radio" disabled />
                      {score}
                    </label>
                  ))}
                  <span className="text-[10px] text-ink3">{question.ratingMaxLabel}</span>
                </div>
              )}
            </div>
          </section>
        ))
      )}

      <button type="button" disabled className="w-full rounded-lg bg-ink3/20 py-2.5 text-[12px] font-bold text-ink3">제출 (미리보기에서는 동작하지 않습니다)</button>
    </div>
  );
}
