import { useEffect, useMemo, useState } from 'react';
import {
  COMMUTE_STATUS_LABELS,
  summarizeCommuteMonth,
  type CommuteRecord,
} from '@/domain/commute/schema';
import { COMMUTE_STATUS_TONES } from '@/data/commute/commute.fixture';
import { useCommuteEmployees, useCommuteMonth } from '@/features/commute/useCommute';
import { GwHead, GwSideNav, GwSplit } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';

/**
 * 근태 조회 — CAPS 연동 데이터의 읽기 화면(로컬 MVP).
 *
 * 좌측 직원 목록(조직도와 같은 마스터-디테일), 우측 월별 기록. 데이터는 읽기 전용이며
 * 쓰기는 서버 인제스트만 한다. status는 계약상 추정 매핑이라 참고용 안내를 함께 둔다.
 * 운영(Firestore)에서는 rules가 본인·관리자만 허용하므로 Auth 도입 후에 열린다.
 */
const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function moveMonth(month: string, amount: number): string {
  const [year, mm] = month.split('-').map(Number);
  const next = new Date(year, mm - 1 + amount, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

const timeOf = (iso: string | null): string => {
  if (!iso) return '—';
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
};

const hourText = (min: number): string => (min === 0 ? '—' : `${Math.floor(min / 60)}h ${min % 60}m`);

export default function CommuteScreen() {
  const employeesQuery = useCommuteEmployees();
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const [empId, setEmpId] = useState<number | null>(null);
  const [month, setMonth] = useState(thisMonth());

  // 첫 로드에 첫 재직자를 선택한다. 빈 화면으로 시작하면 뭘 눌러야 할지 모른다.
  useEffect(() => {
    if (empId === null && employees.length > 0) {
      setEmpId((employees.find((row) => row.active) ?? employees[0]).empId);
    }
  }, [employees, empId]);

  const monthQuery = useCommuteMonth(empId, month);
  const rows = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);
  const summary = useMemo(() => summarizeCommuteMonth(rows), [rows]);
  const selected = employees.find((row) => row.empId === empId);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead icon="⏱️" name="근태" />

      <GwSplit
        nav={(
          <GwSideNav
            title="근태"
            desc="CAPS 출퇴근 기록을 직원별로 조회합니다."
            items={employees.map((row) => ({
              id: String(row.empId),
              icon: row.active ? '🙂' : '👋',
              label: row.active ? row.name : `${row.name} (퇴사)`,
            }))}
            activeId={empId === null ? undefined : String(empId)}
            onSelect={(id) => setEmpId(Number(id))}
          />
        )}
      >
        <section className="rounded-xl border border-border bg-panel shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
            <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
            <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
            <h2 className="ml-1 text-[14px] font-extrabold text-ink">
              {month.replace('-', '년 ')}월 · {selected?.name ?? '직원 선택'}
            </h2>
            <div className="ml-auto flex gap-1.5 text-[9.5px] font-bold">
              <span className="rounded-full bg-teal/15 px-2 py-1 text-teal">근무 {summary.workDays}일</span>
              <span className="rounded-full bg-amber/15 px-2 py-1 text-amber">지각 {summary.lateDays}회</span>
              <span className="rounded-full bg-red-500/12 px-2 py-1 text-red-500">결근 {summary.absentDays}일</span>
              <span className="rounded-full bg-ink3/12 px-2 py-1 text-ink2">연장 {hourText(summary.overMinTotal)}</span>
            </div>
          </div>

          {monthQuery.isLoading ? (
            <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div className="grid min-h-64 place-items-center text-[11px] text-ink3">이 달의 기록이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto p-2">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold text-ink2">
                    <th className="p-2">날짜</th><th className="p-2">출근</th><th className="p-2">퇴근</th>
                    <th className="p-2">기본</th><th className="p-2">연장</th><th className="p-2">지각</th>
                    <th className="p-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: CommuteRecord) => (
                    <tr key={row.date} className="border-b border-border/60 text-ink">
                      <td className="p-2 font-semibold">{row.date.slice(5).replace('-', '/')}</td>
                      <td className="p-2">{timeOf(row.inAt)}</td>
                      <td className="p-2">{timeOf(row.outAt)}</td>
                      <td className="p-2 text-ink2">{hourText(row.basicMin)}</td>
                      <td className="p-2 text-ink2">{hourText(row.overMin)}</td>
                      <td className="p-2 text-ink2">{row.lateMin > 0 ? `${row.lateMin}분` : '—'}</td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${COMMUTE_STATUS_TONES[row.status]}`}>
                          {COMMUTE_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-2 pt-2 text-[9.5px] text-ink3">
                상태 분류는 CAPS 원본 코드의 추정 매핑입니다. 확정 전에는 참고용으로만 보세요.
              </p>
            </div>
          )}
        </section>
      </GwSplit>
    </div>
  );
}
