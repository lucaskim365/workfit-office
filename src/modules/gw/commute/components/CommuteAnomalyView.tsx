import type { AnomalyItem, CommutePersonRow } from '../types';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CommuteAnomalyViewProps {
  anomalies: AnomalyItem[];
  personMap: Map<number, CommutePersonRow>;
  onSelectPerson: (person: CommutePersonRow) => void;
}

const timeOf = (iso: string | null): string => {
  if (!iso) return '—';
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

export function CommuteAnomalyView({ anomalies, personMap, onSelectPerson }: CommuteAnomalyViewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-2xs">
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-panel-alt/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-rose-500/15 text-rose-600">
            <AlertTriangle size={14} />
          </div>
          <h3 className="text-xs font-extrabold text-ink">
            이상 근태 관리 목록 (총 {anomalies.length}건 발생)
          </h3>
        </div>
        <div className="text-[11px] text-ink3">
          지각 · 결근 · 출퇴근 미기록 등 관리자의 확인 및 조치가 필요한 내역입니다.
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-border bg-panel-alt/80 text-[10.5px] font-bold text-ink2">
              <th className="p-3">일자</th>
              <th className="p-3">직원명</th>
              <th className="p-3">소속 부서</th>
              <th className="p-3">직급</th>
              <th className="p-3 text-center">이상 유형</th>
              <th className="p-3 text-center">출근 시각</th>
              <th className="p-3 text-center">퇴근 시각</th>
              <th className="p-3 text-center">지각 시간</th>
              <th className="p-3">비고 / 원인</th>
              <th className="p-3 text-center">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {anomalies.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-xs text-ink3">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 size={28} className="text-teal" />
                    <span className="font-bold text-ink">발생한 이상 근태 내역이 없습니다.</span>
                    <span className="text-[11px] text-ink3">모든 임직원의 출퇴근이 정상적으로 기록되었습니다.</span>
                  </div>
                </td>
              </tr>
            ) : (
              anomalies.map((item) => {
                const person = personMap.get(item.empId);
                let badgeClass = 'bg-rose-500/15 text-rose-600 border-rose-500/25';
                if (item.status === 'late') {
                  badgeClass = 'bg-amber/15 text-amber border-amber/25';
                } else if (item.status === 'missing_in' || item.status === 'missing_out') {
                  badgeClass = 'bg-orange-500/15 text-orange-600 border-orange-500/25';
                }

                return (
                  <tr
                    key={item.id}
                    onClick={() => person && onSelectPerson(person)}
                    className="hover:bg-panel-alt/60 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-extrabold text-ink tabular-nums">
                      {item.date}
                    </td>
                    <td className="p-3 font-bold text-ink">
                      <span className="hover:text-teal transition-colors">{item.name}</span>
                    </td>
                    <td className="p-3 text-ink2">{item.dept}</td>
                    <td className="p-3 text-ink3">{item.position}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold border ${badgeClass}`}>
                        {item.typeLabel}
                      </span>
                    </td>
                    <td className="p-3 text-center tabular-nums font-medium text-ink">
                      {timeOf(item.inAt)}
                    </td>
                    <td className="p-3 text-center tabular-nums font-medium text-ink">
                      {timeOf(item.outAt)}
                    </td>
                    <td className="p-3 text-center tabular-nums">
                      {item.lateMin > 0 ? (
                        <span className="font-extrabold text-amber">{item.lateMin}분</span>
                      ) : (
                        <span className="text-ink3/50">—</span>
                      )}
                    </td>
                    <td className="p-3 text-[11px] text-ink3">{item.note}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (person) onSelectPerson(person);
                        }}
                        className="rounded-md bg-panel-alt hover:bg-teal hover:text-white px-2 py-1 text-[10px] font-bold text-ink2 border border-border transition-colors"
                      >
                        월간 기록
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
