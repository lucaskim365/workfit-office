import { useState } from 'react';
import type { CommonCode } from '@/domain/commonCode/schema';
import { surveyCategoryLabel } from '@/domain/survey/category';
import { SURVEY_STATUS_LABELS, type Survey, type SurveyStatus } from '@/domain/survey/schema';
import { SurveyError } from '@/domain/survey/engine';
import type { User } from '@/domain/user/schema';
import {
  useArchiveSurvey,
  useCloseSurvey,
  useDuplicateSurvey,
  usePublishSurvey,
  useRemoveSurvey,
} from '@/features/survey/useSurveys';
import { audienceLabel, AnonymousBadge, DeadlineBadge, SurveyStatusBadge } from './SurveyBadges';
import { formatSurveyPeriod } from './surveyDate';
import { Button } from '@/shared/ui/Button';

const FILTERS: { id: SurveyStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'DRAFT', label: SURVEY_STATUS_LABELS.DRAFT },
  { id: 'SCHEDULED', label: SURVEY_STATUS_LABELS.SCHEDULED },
  { id: 'ACTIVE', label: SURVEY_STATUS_LABELS.ACTIVE },
  { id: 'CLOSED', label: SURVEY_STATUS_LABELS.CLOSED },
];

const message = (error: unknown) =>
  error instanceof SurveyError ? error.message : '요청을 처리하지 못했습니다.';

interface Props {
  actor: User;
  surveys: Survey[];
  categories: CommonCode[];
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onResult: (id: string) => void;
  onNotice: (text: string) => void;
}

/** 내가 만든 설문 — 상태별 필터와 설문 단위 조작. ([[jwheo/feat/survey/DESIGN.md]] §11.2) */
export default function SurveyList({ actor, surveys, categories, onEdit, onPreview, onResult, onNotice }: Props) {
  const [filter, setFilter] = useState<SurveyStatus | 'ALL'>('ALL');
  const [error, setError] = useState('');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const publish = usePublishSurvey();
  const close = useCloseSurvey();
  const archive = useArchiveSurvey();
  const duplicate = useDuplicateSurvey();
  const remove = useRemoveSurvey();

  const busy = publish.isPending || close.isPending || archive.isPending || duplicate.isPending || remove.isPending;
  const rows = surveys.filter((row) => filter === 'ALL' || row.status === filter);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setError('');
    try {
      await work();
      onNotice(done);
    } catch (caught) {
      setError(message(caught));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => {
          const count = item.id === 'ALL' ? surveys.length : surveys.filter((row) => row.status === item.id).length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${filter === item.id ? 'bg-teal text-white' : 'bg-ink3/8 text-ink2 hover:bg-ink3/15'}`}
            >
              {item.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[11px] font-semibold text-red-500">{error}</div>}

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-panel px-6 py-12 text-center">
          <div className="text-2xl">📋</div>
          <div className="mt-2 text-[12px] font-bold text-ink">{filter === 'ALL' ? '아직 만든 설문이 없습니다.' : `${FILTERS.find((item) => item.id === filter)?.label} 설문이 없습니다.`}</div>
          <div className="mt-1 text-[10.5px] text-ink3">새 설문을 만들어 질문을 추가해 보세요.</div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((row) => {
            const editable = row.status === 'DRAFT' || (row.firstRespondedAt === null && row.status !== 'CLOSED' && row.status !== 'ARCHIVED');
            return (
              <li key={row.id} className="rounded-xl border border-border bg-panel p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SurveyStatusBadge status={row.status} />
                      <AnonymousBadge anonymous={row.anonymous} />
                      <DeadlineBadge survey={row} />
                      <span className="text-[9.5px] font-semibold text-ink3">{surveyCategoryLabel(categories, row.categoryCode)}</span>
                    </div>
                    <div className="mt-1.5 truncate text-[13px] font-bold text-ink">{row.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-ink3">
                      <span>{audienceLabel(row)}</span>
                      <span>{formatSurveyPeriod(row.startsAt, row.endsAt)}</span>
                      <span>질문 {row.questionCount}개</span>
                      <span>응답 {row.responseCount}건</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button onClick={() => onEdit(row.id)} size="sm">
                      {editable ? '수정' : '보기'}
                    </Button>
                    <Button onClick={() => onPreview(row.id)} size="sm">미리보기</Button>
                    {row.status !== 'DRAFT' && (
                      <Button onClick={() => onResult(row.id)} size="sm">결과</Button>
                    )}
                    <Button disabled={busy} onClick={() => run(() => duplicate.mutateAsync({ actor, id: row.id }), '설문을 복제했습니다. 기간을 설정한 뒤 배포하세요.')} size="sm">복제</Button>
                    {row.status === 'DRAFT' && (
                      <Button disabled={busy} onClick={() => run(() => publish.mutateAsync({ actor, id: row.id }), '설문을 배포했습니다.')} variant="primary" size="sm">배포</Button>
                    )}
                    {(row.status === 'SCHEDULED' || row.status === 'ACTIVE') && (
                      <Button disabled={busy} onClick={() => run(() => close.mutateAsync({ actor, id: row.id }), '설문을 마감했습니다.')} variant="warning" size="sm">마감</Button>
                    )}
                    {row.status === 'CLOSED' && (
                      <Button disabled={busy} onClick={() => run(() => archive.mutateAsync({ actor, id: row.id }), '설문을 보관했습니다.')} size="sm">보관</Button>
                    )}
                    {row.status === 'DRAFT' && (
                      pendingRemove === row.id ? (
                        <span className="flex items-center gap-1">
                          <Button disabled={busy} onClick={() => { setPendingRemove(null); void run(() => remove.mutateAsync({ actor, id: row.id }), '초안을 삭제했습니다.'); }} variant="dangerSolid" size="sm">삭제 확인</Button>
                          <Button onClick={() => setPendingRemove(null)} size="sm">취소</Button>
                        </span>
                      ) : (
                        <Button onClick={() => setPendingRemove(row.id)} variant="danger" size="sm">삭제</Button>
                      )
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
