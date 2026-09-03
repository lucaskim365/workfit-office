import { useState, useEffect, useMemo } from 'react';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { getJobTitleRank } from '../utils';

const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal';

interface FormPermissionSettingsProps {
  form: ApprovalForm;
  org: any;
  users: any[];
  jobTitles: any[];
  onChange: (patch: Partial<ApprovalForm>) => void;
}

export function FormPermissionSettings({
  form,
  org,
  users,
  jobTitles,
  onChange,
}: FormPermissionSettingsProps) {
  const { depts = [] } = org;
  const [limitState, setLimitState] = useState<'ALL' | 'LIMITED'>('ALL');

  useEffect(() => {
    const hasLimit =
      (form.allowedDeptIds && form.allowedDeptIds.length > 0) ||
      (form.allowedUserIds && form.allowedUserIds.length > 0) ||
      form.allowedPositionFromRank !== null ||
      form.allowedPositionToRank !== null ||
      (form.allowedJobTitles && form.allowedJobTitles.length > 0);
    setLimitState(hasLimit ? 'LIMITED' : 'ALL');
  }, [form.id, form.allowedDeptIds, form.allowedUserIds, form.allowedPositionFromRank, form.allowedPositionToRank, form.allowedJobTitles]);

  const sortedJobs = useMemo(() => {
    return jobTitles
      .map((j) => j.name)
      .filter((v, i, self) => self.indexOf(v) === i)
      .sort((a, b) => getJobTitleRank(a) - getJobTitleRank(b));
  }, [jobTitles]);

  const minJob = useMemo(() => {
    if (!form.allowedJobTitles || form.allowedJobTitles.length === 0) return '';
    const sorted = form.allowedJobTitles.slice().sort((a, b) => getJobTitleRank(b) - getJobTitleRank(a));
    return sorted[0] || '';
  }, [form.allowedJobTitles]);

  const maxJob = useMemo(() => {
    if (!form.allowedJobTitles || form.allowedJobTitles.length === 0) return '';
    const sorted = form.allowedJobTitles.slice().sort((a, b) => getJobTitleRank(a) - getJobTitleRank(b));
    return sorted[0] || '';
  }, [form.allowedJobTitles]);

  const handleJobChange = (minVal: string | null, maxVal: string | null) => {
    if (!minVal && !maxVal) {
      onChange({ allowedJobTitles: [] });
      return;
    }
    const minRank = minVal ? getJobTitleRank(minVal) : 999;
    const maxRank = maxVal ? getJobTitleRank(maxVal) : -999;
    const allPossible = sortedJobs;
    const filteredJobs = allPossible.filter((j) => {
      const r = getJobTitleRank(j);
      return r >= maxRank && r <= minRank;
    });
    onChange({ allowedJobTitles: filteredJobs });
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <div>
        <div className="text-[13px] font-bold text-ink">2. 기안 권한 설정</div>
        <div className="text-[10.5px] text-ink3 mt-0.5">이 서식을 사용할 수 있는 기안자의 범위(직급, 부서 등)를 정의합니다.</div>
      </div>

      <div className="flex gap-6 border-b border-border/50 pb-3 text-[11.5px] font-semibold text-ink2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="limitState"
            checked={limitState === 'ALL'}
            onChange={() => {
              setLimitState('ALL');
              onChange({
                allowedDeptIds: [],
                allowedUserIds: [],
                allowedPositionFromRank: null,
                allowedPositionToRank: null,
                allowedJobTitles: [],
              });
            }}
            className="text-teal focus:ring-teal h-3.5 w-3.5"
          />
          모든 임직원 (기본값)
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="limitState"
            checked={limitState === 'LIMITED'}
            onChange={() => setLimitState('LIMITED')}
            className="text-teal focus:ring-teal h-3.5 w-3.5"
          />
          지정된 대상만 기안 허용
        </label>
      </div>

      {limitState === 'LIMITED' && (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-3 gap-4">
            {/* 직급 설정 */}
            <div className="space-y-3">
              <div className="text-[11.5px] font-bold text-ink2">기안 가능 직급 범위</div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10.5px] font-semibold text-ink3 text-center">최소 기안직급 (최하위)</label>
                  <select
                    value={form.allowedPositionFromRank ?? ''}
                    onChange={(e) => onChange({ allowedPositionFromRank: e.target.value === '' ? null : Number(e.target.value) })}
                    className={`${inp} text-center`}
                  >
                    <option value="">제한 없음</option>
                    {org.positions.slice().sort((a: any, b: any) => b.rank - a.rank).map((p: any) => (
                      <option key={p.id} value={p.rank}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <span className="text-ink3 font-bold mt-4 shrink-0">~</span>
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10.5px] font-semibold text-ink3 text-center">최대 기안직급 (최상위)</label>
                  <select
                    value={form.allowedPositionToRank ?? ''}
                    onChange={(e) => onChange({ allowedPositionToRank: e.target.value === '' ? null : Number(e.target.value) })}
                    className={`${inp} text-center`}
                  >
                    <option value="">제한 없음</option>
                    {org.positions.slice().sort((a: any, b: any) => a.rank - b.rank).map((p: any) => (
                      <option key={p.id} value={p.rank}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 직책 설정 */}
            <div className="space-y-3">
              <div className="text-[11.5px] font-bold text-ink2">기안 가능 직책 범위</div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10.5px] font-semibold text-ink3 text-center">최소 기안직책 (최하위)</label>
                  <select
                    value={minJob}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      handleJobChange(val, maxJob || null);
                    }}
                    className={`${inp} text-center`}
                  >
                    <option value="">제한 없음</option>
                    {sortedJobs.slice().reverse().map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <span className="text-ink3 font-bold mt-4 shrink-0">~</span>
                <div className="flex-1">
                  <label className="mb-0.5 block text-[10.5px] font-semibold text-ink3 text-center">최대 기안직책 (최상위)</label>
                  <select
                    value={maxJob}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      handleJobChange(minJob || null, val);
                    }}
                    className={`${inp} text-center`}
                  >
                    <option value="">제한 없음</option>
                    {sortedJobs.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 부서 설정 */}
            <div className="space-y-2.5">
              <div className="text-[11.5px] font-bold text-ink2">기안 가능 부서 지정</div>
              <div>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const currentDepts = form.allowedDeptIds ?? [];
                    if (!currentDepts.includes(val)) {
                      onChange({ allowedDeptIds: [...currentDepts, val] });
                    }
                  }}
                  className={inp}
                >
                  <option value="">허용 부서 선택 및 추가...</option>
                  {depts
                    .filter((d: any) => !(form.allowedDeptIds ?? []).includes(d.id))
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))
                    .map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* 부서 뱃지 리스트 */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] rounded-lg border border-dashed border-border p-2 bg-panel-alt/30 max-h-[75px] overflow-y-auto">
                {(form.allowedDeptIds ?? []).map((did) => {
                  const d = depts.find((dept: any) => dept.id === did);
                  if (!d) return null;
                  return (
                    <span
                      key={did}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-soft text-teal text-[11px] font-semibold border border-teal/15"
                    >
                      <span>📁 {d.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextDepts = (form.allowedDeptIds ?? []).filter((id) => id !== did);
                          onChange({ allowedDeptIds: nextDepts });
                        }}
                        className="hover:text-red-500 font-bold transition-colors ml-1 cursor-pointer text-[10px]"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
                {(form.allowedDeptIds ?? []).length === 0 && (
                  <div className="text-[10.5px] text-ink3 my-auto pl-1">지정된 허용 부서가 없습니다.</div>
                )}
              </div>
            </div>
          </div>

          {/* 예외 허용 사용자 지정 */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11.5px] font-bold text-ink2">기안 가능 예외 사용자 지정</div>
              <div className="w-[240px]">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const currentList = form.allowedUserIds ?? [];
                    if (!currentList.includes(val)) {
                      onChange({ allowedUserIds: [...currentList, val] });
                    }
                  }}
                  className={inp}
                >
                  <option value="">예외 사원 선택 및 추가...</option>
                  {users
                    .filter((u) => u.status === '사용' && !(form.allowedUserIds ?? []).includes(u.id))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.dept} / {u.position})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* 예외 사원 뱃지 리스트 */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] rounded-lg border border-dashed border-border p-2 bg-panel-alt/30 max-h-[75px] overflow-y-auto">
              {(form.allowedUserIds ?? []).map((uid) => {
                const u = users.find((user) => user.id === uid);
                if (!u) return null;
                return (
                  <span
                    key={uid}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal/10 text-teal text-[11px] font-semibold border border-teal/20"
                  >
                    <span>👤 {u.name}</span>
                    <span className="text-[10px] text-teal/70 font-medium">({u.dept} / {u.position})</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextList = (form.allowedUserIds ?? []).filter((id) => id !== uid);
                        onChange({ allowedUserIds: nextList });
                      }}
                      className="hover:text-red-500 font-bold transition-colors ml-1 cursor-pointer text-[10px]"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
              {(form.allowedUserIds ?? []).length === 0 && (
                <div className="text-[10.5px] text-ink3 my-auto pl-1">지정된 예외 사용자가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
