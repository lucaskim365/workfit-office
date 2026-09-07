import type { DeptSummary } from '../types';
import { Building2, ArrowRight, AlertTriangle } from 'lucide-react';

interface CommuteDeptViewProps {
  deptSummaries: DeptSummary[];
  onDrillDownDept: (dept: string) => void;
}

export function CommuteDeptView({ deptSummaries, onDrillDownDept }: CommuteDeptViewProps) {
  const totalMembers = deptSummaries.reduce((sum, d) => sum + d.memberCount, 0);

  return (
    <div className="space-y-4">
      {/* 부서별 카드 그리드 요약 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {deptSummaries.map((dept) => (
          <div
            key={dept.dept}
            onClick={() => onDrillDownDept(dept.dept)}
            className="group cursor-pointer rounded-xl border border-border bg-panel p-4 shadow-2xs hover:border-teal/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal/10 text-teal group-hover:bg-teal group-hover:text-white transition-colors">
                  <Building2 size={16} />
                </div>
                <div className="font-extrabold text-[13.5px] text-ink group-hover:text-teal transition-colors">
                  {dept.dept}
                </div>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold text-ink3 group-hover:text-teal transition-colors">
                상세 <ArrowRight size={12} />
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
              <div>
                <div className="text-[10px] text-ink3">인원</div>
                <div className="text-xs font-bold text-ink">{dept.memberCount}명</div>
              </div>
              <div>
                <div className="text-[10px] text-ink3">출근율</div>
                <div className="text-xs font-bold text-teal">{dept.attendanceRate}%</div>
              </div>
              <div>
                <div className="text-[10px] text-ink3">이상 관리</div>
                <div
                  className={`text-xs font-bold ${
                    dept.anomalyCount > 0 ? 'text-rose-600 font-black' : 'text-ink3'
                  }`}
                >
                  {dept.anomalyCount}건
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 부서별 상세 집계 표 */}
      <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-2xs">
        <div className="border-b border-border bg-panel-alt/50 px-4 py-3">
          <h3 className="text-xs font-extrabold text-ink flex items-center gap-2">
            <Building2 size={14} className="text-teal" />
            <span>부서별 근태 집계 통계 (총 {deptSummaries.length}개 부서 / {totalMembers}명)</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-border bg-panel-alt/80 text-[10.5px] font-bold text-ink2">
                <th className="p-3">부서명</th>
                <th className="p-3 text-center">인원</th>
                <th className="p-3 text-center">정상출근(연)</th>
                <th className="p-3 text-center">지각</th>
                <th className="p-3 text-center">결근</th>
                <th className="p-3 text-center">휴가</th>
                <th className="p-3 text-center text-rose-600">관리 필요</th>
                <th className="p-3 text-center">출근율</th>
                <th className="p-3 text-center">현황 보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {deptSummaries.map((dept) => (
                <tr
                  key={dept.dept}
                  className="hover:bg-panel-alt/60 cursor-pointer transition-colors"
                  onClick={() => onDrillDownDept(dept.dept)}
                >
                  <td className="p-3 font-extrabold text-ink flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-teal" />
                    <span>{dept.dept}</span>
                  </td>
                  <td className="p-3 text-center tabular-nums font-semibold text-ink2">
                    {dept.memberCount}명
                  </td>
                  <td className="p-3 text-center tabular-nums text-teal font-semibold">
                    {dept.presentDays}일
                  </td>
                  <td className="p-3 text-center tabular-nums">
                    {dept.lateCount > 0 ? (
                      <span className="text-amber font-extrabold">{dept.lateCount}건</span>
                    ) : (
                      <span className="text-ink3/50">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center tabular-nums">
                    {dept.absentCount > 0 ? (
                      <span className="text-rose-600 font-extrabold">{dept.absentCount}건</span>
                    ) : (
                      <span className="text-ink3/50">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center tabular-nums text-emerald-600 font-semibold">
                    {dept.leaveCount}건
                  </td>
                  <td className="p-3 text-center tabular-nums">
                    {dept.anomalyCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 border border-rose-500/25">
                        <AlertTriangle size={10} />
                        {dept.anomalyCount}건
                      </span>
                    ) : (
                      <span className="text-ink3/50">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center tabular-nums">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="h-1.5 w-12 rounded-full bg-panel-alt overflow-hidden border border-border">
                        <div
                          className="h-full bg-teal rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, dept.attendanceRate))}%` }}
                        />
                      </div>
                      <span className="font-bold text-ink text-[11px]">{dept.attendanceRate}%</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDrillDownDept(dept.dept);
                      }}
                      className="rounded-md bg-panel-alt hover:bg-teal hover:text-white px-2.5 py-1 text-[10.5px] font-bold text-ink2 border border-border transition-colors"
                    >
                      직원 현황 →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
