import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  COMMUTE_STATUS_LABELS,
  summarizeCommuteMonth,
  type CommuteEmployee,
  type CommuteRecord,
} from '@/domain/commute/schema';
import { COMMUTE_STATUS_TONES } from '@/data/commute/commute.fixture';
import { useCommuteDay, useCommuteEmployees, useCommuteMonth } from '@/features/commute/useCommute';
import { GwHead, GwSideNav, GwSplit } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';

/**
 * 근태 조회 — CAPS 연동 데이터의 읽기 화면.
 *
 * 보는 방향이 둘이다. **일별**은 하루를 전 직원으로 보고(오늘 누가 안 왔나), **직원별**은
 * 한 사람의 한 달을 본다. 전환은 화면 머리의 토글이 맡는다 — 좌측 직원 목록에 섞으면
 * 성격이 다른 항목이 같은 줄에 서게 된다. 일별에서는 직원 목록이 필요 없어 표를 전폭으로 쓴다.
 *
 * 데이터는 읽기 전용이다. 쓰기는 CAPS 인제스트(서버 전용 키)만 한다. status는 계약상
 * 추정 매핑이라 참고용 안내를 함께 둔다.
 */
const DAY_VIEW = 'day';

const pad = (value: number) => String(value).padStart(2, '0');

const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

function moveMonth(month: string, amount: number): string {
  const [year, mm] = month.split('-').map(Number);
  const next = new Date(year, mm - 1 + amount, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
}

function moveDay(date: string, amount: number): string {
  const [year, mm, dd] = date.split('-').map(Number);
  const next = new Date(year, mm - 1, dd + amount);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayTitle = (date: string): string => {
  const [year, mm, dd] = date.split('-').map(Number);
  return `${year}년 ${mm}월 ${dd}일 (${WEEKDAYS[new Date(year, mm - 1, dd).getDay()]})`;
};

const timeOf = (iso: string | null): string => {
  if (!iso) return '—';
  const at = new Date(iso);
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

const hourText = (min: number): string => (min === 0 ? '—' : `${Math.floor(min / 60)}h ${min % 60}m`);

/** 요약 배지 — 일별·직원별이 같은 모양을 쓴다. */
function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`rounded-full px-2 py-1 text-[9.5px] font-bold ${tone}`}>{children}</span>;
}

function StatusBadge({ status }: { status: CommuteRecord['status'] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${COMMUTE_STATUS_TONES[status]}`}>
      {COMMUTE_STATUS_LABELS[status]}
    </span>
  );
}

const HEAD_CELL = 'p-2';
const NOTE = '상태 분류는 CAPS 원본 코드의 추정 매핑입니다. 확정 전에는 참고용으로만 보세요.';

/** 두 표가 같은 열 구성을 쓴다. 첫 칸 제목만 다르다(직원/날짜). */
function TableHead({ first }: { first: string }) {
  return (
    <thead>
      <tr className="border-b border-border text-[10px] font-bold text-ink2">
        <th className={HEAD_CELL}>{first}</th><th className={HEAD_CELL}>출근</th><th className={HEAD_CELL}>퇴근</th>
        <th className={HEAD_CELL}>기본</th><th className={HEAD_CELL}>연장</th><th className={HEAD_CELL}>지각</th>
        <th className={HEAD_CELL}>상태</th>
      </tr>
    </thead>
  );
}

export default function CommuteScreen() {
  const employeesQuery = useCommuteEmployees();
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  /** 보기 대상. `day`면 일별, 숫자면 그 사번의 월별. */
  const [view, setView] = useState<string>(DAY_VIEW);
  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(today());
  /**
   * 이름 검색·퇴사자 표시.
   *
   * 직원이 수백 명이면 목록을 눈으로 훑는 방식은 안 통한다. 좌측 목록과 일별 표가 같은
   * 검색어를 쓴다 — 보기를 바꿨는데 찾던 사람이 사라지면 다시 입력해야 한다.
   */
  const [keyword, setKeyword] = useState('');
  const [showRetired, setShowRetired] = useState(false);

  const empId = view === DAY_VIEW ? null : Number(view);
  const firstEmpId = (employees.find((row) => row.active) ?? employees[0])?.empId;

  // 직원별로 들어왔는데 아무도 안 골라져 있으면 첫 재직자를 고른다.
  useEffect(() => {
    if (view !== DAY_VIEW && Number.isNaN(Number(view)) && firstEmpId !== undefined) {
      setView(String(firstEmpId));
    }
  }, [firstEmpId, view]);

  const monthQuery = useCommuteMonth(empId, month);
  const dayQuery = useCommuteDay(view === DAY_VIEW ? date : null);

  const monthRows = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);
  const summary = useMemo(() => summarizeCommuteMonth(monthRows), [monthRows]);
  const selected = employees.find((row) => row.empId === empId);

  const matches = (employee: CommuteEmployee) => {
    const text = keyword.trim();
    if (text !== '' && !employee.name.includes(text) && !String(employee.empId).includes(text)) return false;
    return showRetired || employee.active;
  };

  /** 좌측 목록 대상. 이름·사번으로 좁힌다. */
  const navEmployees = useMemo(
    () => employees.filter(matches).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [employees, keyword, showRetired],
  );

  /** 일별 표 — 기록 없는 직원도 한 줄로 남긴다. 빠진 사람이 안 보이면 쓸모가 없다. */
  const dayRows = useMemo(() => {
    const byEmp = new Map<number, CommuteRecord>();
    for (const row of dayQuery.data ?? []) byEmp.set(row.empId, row);
    return employees
      .filter(matches)
      .map((employee: CommuteEmployee) => ({ employee, record: byEmp.get(employee.empId) ?? null }))
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name, 'ko'));
  }, [dayQuery.data, employees, keyword, showRetired]);

  const dayStats = useMemo(() => ({
    present: dayRows.filter((row) => row.record?.inAt).length,
    late: dayRows.filter((row) => row.record?.status === 'late').length,
    missing: dayRows.filter((row) => !row.record || (!row.record.inAt && !row.record.outAt)).length,
  }), [dayRows]);

  const modeToggle = (
    <div className="flex items-center gap-0.5 self-center rounded-lg border border-border bg-panel p-0.5">
      <button
        type="button"
        onClick={() => setView(DAY_VIEW)}
        className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
          view === DAY_VIEW ? 'bg-teal text-white' : 'text-ink3 hover:text-ink2'
        }`}
      >
        일별 현황
      </button>
      <button
        type="button"
        onClick={() => { if (view === DAY_VIEW && firstEmpId !== undefined) setView(String(firstEmpId)); }}
        className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
          view === DAY_VIEW ? 'text-ink3 hover:text-ink2' : 'bg-teal text-white'
        }`}
      >
        직원별
      </button>
    </div>
  );

  const dayPanel = (
    <section className="rounded-xl border border-border bg-panel shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <button type="button" onClick={() => setDate((value) => moveDay(value, -1))} aria-label="이전 날" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
        <Button size="sm" onClick={() => setDate(today())}>오늘</Button>
        <button type="button" onClick={() => setDate((value) => moveDay(value, 1))} aria-label="다음 날" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
        <h2 className="ml-1 text-[14px] font-extrabold text-ink">{dayTitle(date)}</h2>
        {/* 날짜를 직접 고르는 편이 화살표보다 빠른 경우가 많다(지난달 특정일 확인 등). */}
        <input
          type="date"
          value={date}
          onChange={(event) => event.target.value && setDate(event.target.value)}
          className="h-8 rounded-lg border border-border bg-panel px-2 text-[11px] text-ink2 outline-none"
        />
        {/* 사람이 많은 회사에서는 표를 훑는 것도 일이라, 여기서도 같은 검색을 건다. */}
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="이름·사번 검색"
          className="h-8 w-40 rounded-lg border border-border bg-panel px-2.5 text-[11px] text-ink outline-none placeholder:text-ink3"
        />
        <div className="ml-auto flex gap-1.5">
          <Chip tone="bg-teal/15 text-teal">출근 {dayStats.present}명</Chip>
          <Chip tone="bg-amber/15 text-amber">지각 {dayStats.late}명</Chip>
          <Chip tone="bg-red-500/12 text-red-500">기록 없음 {dayStats.missing}명</Chip>
        </div>
      </div>

      {dayQuery.isLoading ? (
        <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
      ) : dayRows.length === 0 ? (
        <div className="grid min-h-64 place-items-center text-[11px] text-ink3">재직 중인 직원이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto p-2">
          <table className="w-full border-collapse text-left text-[11px]">
            <TableHead first="직원" />
            <tbody>
              {dayRows.map(({ employee, record }) => (
                <tr key={employee.empId} className="border-b border-border/60 text-ink">
                  <td className="p-2 font-semibold">
                    {/* 이름 → 그 사람의 월별. 하루에서 사람으로 파고드는 방향. */}
                    <button type="button" onClick={() => { setMonth(date.slice(0, 7)); setView(String(employee.empId)); }} title="이 직원의 월별 기록 보기" className="hover:text-teal hover:underline">
                      {employee.name}
                    </button>
                  </td>
                  <td className="p-2">{timeOf(record?.inAt ?? null)}</td>
                  <td className="p-2">{timeOf(record?.outAt ?? null)}</td>
                  <td className="p-2 text-ink2">{hourText(record?.basicMin ?? 0)}</td>
                  <td className="p-2 text-ink2">{hourText(record?.overMin ?? 0)}</td>
                  <td className="p-2 text-ink2">{record && record.lateMin > 0 ? `${record.lateMin}분` : '—'}</td>
                  <td className="p-2">
                    {record ? <StatusBadge status={record.status} /> : <span className="text-[9.5px] text-ink3">기록 없음</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 pt-2 text-[9.5px] text-ink3">{NOTE}</p>
        </div>
      )}
    </section>
  );

  const monthPanel = (
    <section className="rounded-xl border border-border bg-panel shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
        <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
        <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
        <h2 className="ml-1 text-[14px] font-extrabold text-ink">
          {month.replace('-', '년 ')}월 · {selected?.name ?? '직원 선택'}
        </h2>
        <div className="ml-auto flex gap-1.5">
          <Chip tone="bg-teal/15 text-teal">근무 {summary.workDays}일</Chip>
          <Chip tone="bg-amber/15 text-amber">지각 {summary.lateDays}회</Chip>
          <Chip tone="bg-red-500/12 text-red-500">결근 {summary.absentDays}일</Chip>
          <Chip tone="bg-ink3/12 text-ink2">연장 {hourText(summary.overMinTotal)}</Chip>
        </div>
      </div>

      {monthQuery.isLoading ? (
        <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
      ) : monthRows.length === 0 ? (
        <div className="grid min-h-64 place-items-center text-[11px] text-ink3">이 달의 기록이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto p-2">
          <table className="w-full border-collapse text-left text-[11px]">
            <TableHead first="날짜" />
            <tbody>
              {monthRows.map((row: CommuteRecord) => (
                <tr key={row.date} className="border-b border-border/60 text-ink">
                  <td className="p-2 font-semibold">
                    {/* 날짜 → 그날 전 직원. 사람에서 하루로 나오는 방향. */}
                    <button type="button" onClick={() => { setDate(row.date); setView(DAY_VIEW); }} title="이 날짜의 전 직원 보기" className="hover:text-teal hover:underline">
                      {row.date.slice(5).replace('-', '/')}
                    </button>
                  </td>
                  <td className="p-2">{timeOf(row.inAt)}</td>
                  <td className="p-2">{timeOf(row.outAt)}</td>
                  <td className="p-2 text-ink2">{hourText(row.basicMin)}</td>
                  <td className="p-2 text-ink2">{hourText(row.overMin)}</td>
                  <td className="p-2 text-ink2">{row.lateMin > 0 ? `${row.lateMin}분` : '—'}</td>
                  <td className="p-2"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 pt-2 text-[9.5px] text-ink3">{NOTE}</p>
        </div>
      )}
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead icon="⏱️" name="근태" right={modeToggle} />

      {view === DAY_VIEW ? (
        <div className="mt-5">{dayPanel}</div>
      ) : (
        <GwSplit
          nav={(
            <GwSideNav
              title="직원"
              desc={`${navEmployees.length}명 / 전체 ${employees.length}명`}
              scrollItems
              filter={(
                <div className="flex flex-col gap-2">
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="이름·사번 검색"
                    className="h-8 w-full rounded-lg border border-border bg-panel px-2.5 text-[11px] text-ink outline-none placeholder:text-ink3"
                  />
                  <label className="flex cursor-pointer items-center gap-1.5 text-[10.5px] text-ink3">
                    <input type="checkbox" checked={showRetired} onChange={(event) => setShowRetired(event.target.checked)} className="h-3 w-3 accent-teal" />
                    퇴사자 포함
                  </label>
                </div>
              )}
              items={navEmployees.map((row) => ({
                id: String(row.empId),
                label: row.active ? row.name : `${row.name} (퇴사)`,
              }))}
              activeId={view}
              onSelect={setView}
            />
          )}
        >
          {monthPanel}
        </GwSplit>
      )}
    </div>
  );
}
