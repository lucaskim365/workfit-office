import {
  SURVEY_AUDIENCE_TYPE_LABELS,
  SURVEY_STATUS_LABELS,
  type Survey,
  type SurveyStatus,
} from '@/domain/survey/schema';
import { SURVEY_QUESTION_TYPE_LABELS, type SurveyQuestionType } from '@/domain/surveyQuestion/schema';
import { daysUntil } from './surveyDate';

const STATUS_TONE: Record<SurveyStatus, string> = {
  DRAFT: 'bg-ink3/12 text-ink2',
  SCHEDULED: 'bg-blue/12 text-blue',
  ACTIVE: 'bg-teal/15 text-teal',
  CLOSED: 'bg-ink3/15 text-ink2',
  ARCHIVED: 'bg-ink3/10 text-ink3',
};

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  return (
    <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TONE[status]}`}>
      {SURVEY_STATUS_LABELS[status]}
    </span>
  );
}

export function AnonymousBadge({ anonymous }: { anonymous: boolean }) {
  return (
    <span className={`inline-block shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold ${anonymous ? 'bg-teal/12 text-teal' : 'bg-ink3/12 text-ink2'}`}>
      {anonymous ? '익명' : '기명'}
    </span>
  );
}

export function QuestionTypeBadge({ type }: { type: SurveyQuestionType }) {
  return (
    <span className="inline-block shrink-0 rounded bg-ink3/10 px-1.5 py-px text-[9.5px] font-bold text-ink2">
      {SURVEY_QUESTION_TYPE_LABELS[type]}
    </span>
  );
}

/** 마감 임박 표시 — 진행 중이고 3일 이하로 남았을 때만. ([[DESIGN.md]] §11.1) */
export function DeadlineBadge({ survey, now }: { survey: Survey; now?: Date }) {
  if (survey.status !== 'ACTIVE') return null;
  const left = daysUntil(survey.endsAt, now);
  if (left === null || left > 3) return null;
  return (
    <span className="inline-block shrink-0 rounded bg-amber/15 px-1.5 py-px text-[9.5px] font-bold text-amber">
      {left <= 0 ? '오늘 마감' : `마감 ${left}일 전`}
    </span>
  );
}

export function audienceLabel(survey: Survey): string {
  const base = SURVEY_AUDIENCE_TYPE_LABELS[survey.audienceType];
  if (survey.audienceType === 'DEPARTMENT') return `${base} ${survey.audienceDeptIds.length}곳`;
  if (survey.audienceType === 'USERS') return `${base} ${survey.audienceUserIds.length}명`;
  return base;
}
