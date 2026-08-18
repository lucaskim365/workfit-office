import { useState } from 'react';
import type { CommonCode } from '@/domain/commonCode/schema';
import { surveyCategoryLabel } from '@/domain/survey/category';
import type { Survey } from '@/domain/survey/schema';
import type { User } from '@/domain/user/schema';
import { AnonymousBadge, DeadlineBadge, SurveyStatusBadge } from './SurveyBadges';
import { formatSurveyDateTime } from './surveyDate';
import { Button } from '@/shared/ui/Button';

interface Props {
  surveys: Survey[];
  participatedIds: string[];
  users: User[];
  categories: CommonCode[];
  onRespond: (id: string) => void;
  onResult: (id: string) => void;
}

/** 참여할 설문 — 진행 중·참여 완료 탭. ([[jwheo/feat/survey/DESIGN.md]] §11.1) */
export default function SurveyParticipateList({ surveys, participatedIds, users, categories, onRespond, onResult }: Props) {
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const participated = new Set(participatedIds);
  const open = surveys.filter((row) => !participated.has(row.id) && row.status === 'ACTIVE');
  const done = surveys.filter((row) => participated.has(row.id));
  const rows = tab === 'open' ? open : done;
  const ownerName = (id: string) => users.find((user) => user.id === id)?.name ?? '알 수 없음';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {([['open', '진행 중', open.length], ['done', '참여 완료', done.length]] as const).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${tab === id ? 'bg-teal text-white' : 'bg-ink3/8 text-ink2 hover:bg-ink3/15'}`}
          >
            {label} <span className="opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-panel px-6 py-12 text-center">
          <div className="text-2xl">{tab === 'open' ? '🗳️' : '✅'}</div>
          <div className="mt-2 text-[12px] font-bold text-ink">
            {tab === 'open' ? '지금 참여할 설문이 없습니다.' : '아직 참여한 설문이 없습니다.'}
          </div>
          <div className="mt-1 text-[10.5px] text-ink3">
            {tab === 'open' ? '대상으로 지정된 설문이 배포되면 여기에 표시됩니다.' : '진행 중 탭에서 설문에 참여해 보세요.'}
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((row) => (
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
                    <span>{ownerName(row.ownerUserId)}</span>
                    <span>마감 {formatSurveyDateTime(row.endsAt)}</span>
                    <span>질문 {row.questionCount}개</span>
                  </div>
                </div>
                {tab === 'open' ? (
                  <button type="button" onClick={() => onRespond(row.id)} className="shrink-0 rounded-lg bg-teal px-4 py-2 text-[11px] font-bold text-white hover:opacity-90">참여</button>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* 결과 공개를 켠 설문만. 권한은 저장소가 다시 판정한다. */}
                    {row.showResultToRespondent && (
                      <Button onClick={() => onResult(row.id)} size="sm">결과 보기</Button>
                    )}
                    <span className="rounded-lg bg-teal-soft/40 px-3 py-2 text-[10.5px] font-bold text-teal">참여 완료</span>
                  </div>
                )}
              </div>
              {tab === 'done' && row.anonymous && (
                <div className="mt-2 text-[9.5px] text-ink3">익명 설문이라 제출한 응답 내용은 다시 확인할 수 없습니다.</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
