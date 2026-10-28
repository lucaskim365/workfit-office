import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Printer, Search } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useUsers } from '@/features/user/useUsers';
import { useRosterOrder } from '@/features/user/useRosterOrder';
import { useHolidays } from '@/features/holiday/useHolidays';
import { useMealTickets, useUpdateMealTicket } from '@/features/mealTicket/useMealTickets';
import { dayLabel, monthCsv, monthDates, rangeCells, remainingAsOf, remainingCell, shiftMonth, summarizeMonth, weekdayOf } from '@/domain/mealTicket/engine';
import { calendarToday } from '@/domain/calendarEvent/calendarDate';
import { GwHead } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';
import { MealTicketPrintSheet } from './MealTicketPrintSheet';

/**
 * 식권 대장 — 한 달을 출석부처럼(행 = 재직자, 열 = 날짜). 체크하면 그날 받은 사람이 되고,
 * 아래 줄에서 입고를 적으면 발행(= 받은 사람 수)·남은 식권은 자동으로 계산된다. 누구나 고칠 수 있다.
 */
export default function MealTicketScreen() {
  const { user } = useAuth();
  const today = calendarToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [q, setQ] = useState('');
  const dates = useMemo(() => monthDates(month), [month]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: users = [] } = useUsers();
  const { compare } = useRosterOrder();
  const { data: holidays = [] } = useHolidays(month.slice(0, 4));
  const { data: days = [], isLoading } = useMealTickets();
  const save = useUpdateMealTicket(user?.name ?? '');

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const holidayNames = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const { opening, rows: summary } = useMemo(() => summarizeMonth(days, dates), [days, dates]);
  // 지금 남은 식권 — 지난달이면 그달 말, 이번 달이면 오늘까지, 다음 달이면 이월분
  const remainingNow = remainingAsOf(opening, summary, today);

  // 재직자 + 이 달에 받은 기록이 있는 퇴직자(합계가 맞도록)
  const people = useMemo(() => {
    const received = new Set(dates.flatMap((d) => byDate.get(d)?.recipients ?? []));
    return users
      .filter((u) => u.status === '사용' || received.has(u.id))
      .sort(compare)
      .map((u) => ({ id: u.id, name: u.name, dept: u.dept, retired: u.status !== '사용' }));
  }, [users, dates, byDate, compare]);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? people.filter((p) => p.name.toLowerCase().includes(k) || p.dept.toLowerCase().includes(k)) : people;
  }, [people, q]);

  useLayoutEffect(() => {
    const box = scrollRef.current;
    const cell = box?.querySelector<HTMLElement>('[data-today]');
    if (!box) return;
    box.scrollLeft = cell ? Math.max(0, cell.offsetLeft - 150 - cell.offsetWidth * 3) : 0;
  }, [month, isLoading]);

  /*
   * 체크 — 칸을 누르면 그 칸이 바뀌고, 누른 채 끌면 지나간 칸이 모두 같은 상태가 된다(놓을 때 저장).
   * Shift+클릭은 마지막으로 누른 칸과 이 칸 사이 사각형(사람 × 날짜)을 마지막으로 누른 칸의 상태로 맞춘다.
   * 저장은 날짜별로 한 번 — 바뀌는 사람만 모아서.
   */
  const cellKey = (date: string, userId: string) => `${date}|${userId}`;
  const [preview, setPreview] = useState<Map<string, boolean> | null>(null);
  const dragRef = useRef<{ received: boolean; cells: Map<string, Set<string>> } | null>(null);
  const anchorRef = useRef<{ userId: string; date: string; received: boolean } | null>(null);
  const isChecked = (date: string, userId: string) =>
    preview?.get(cellKey(date, userId)) ?? byDate.get(date)?.recipients.includes(userId) ?? false;

  const commit = (cells: Map<string, Iterable<string>>, received: boolean) => {
    for (const [date, ids] of cells) {
      const current = byDate.get(date)?.recipients ?? [];
      const userIds = [...ids].filter((id) => current.includes(id) !== received);
      if (userIds.length) save.mutate({ kind: 'received', date, userIds, received });
    }
    // 화면 반영(낙관적 갱신)이 끝난 다음 프레임에 미리보기를 걷는다 — 바로 걷으면 잠깐 원래대로 깜빡인다
    requestAnimationFrame(() => setPreview(null));
  };

  const onCellDown = (e: React.MouseEvent, date: string, userId: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const anchor = anchorRef.current;
    if (e.shiftKey && anchor) {
      const cells = rangeCells(shown.map((p) => p.id), dates, anchor, { userId, date });
      setPreview(new Map([...cells].flatMap(([d, ids]) => ids.map((id) => [cellKey(d, id), anchor.received] as const))));
      commit(cells, anchor.received);
      return;
    }
    const received = !isChecked(date, userId);
    anchorRef.current = { userId, date, received };
    dragRef.current = { received, cells: new Map([[date, new Set([userId])]]) };
    setPreview(new Map([[cellKey(date, userId), received]]));
    const finish = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) commit(drag.cells, drag.received);
    };
    window.addEventListener('mouseup', finish, { once: true });
  };

  const onCellEnter = (date: string, userId: string) => {
    const drag = dragRef.current;
    if (!drag) return;
    const set = drag.cells.get(date) ?? new Set<string>();
    if (set.has(userId)) return;
    set.add(userId);
    drag.cells.set(date, set);
    setPreview((prev) => new Map(prev ?? []).set(cellKey(date, userId), drag.received));
  };

  /** 키보드(Tab으로 옮겨 Space·Enter) — 한 칸씩 */
  const onCellKey = (e: React.KeyboardEvent, date: string, userId: string) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    const received = !isChecked(date, userId);
    anchorRef.current = { userId, date, received };
    commit(new Map([[date, [userId]]]), received);
  };

  const offDay = (date: string) => weekdayOf(date) === 0 || weekdayOf(date) === 6 || holidayNames.has(date);

  const download = () => {
    const csv = monthCsv(days, dates, people, today);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `식권대장_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * PDF 저장 — 인쇄용 표를 붙인 다음 프레임에 인쇄 창을 연다(인쇄 창의 'PDF로 저장').
   * 문서 제목이 PDF 파일 이름이 되므로 인쇄하는 동안만 바꿔 둔다.
   */
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const title = document.title;
    document.title = `식권대장_${month}`;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      document.title = title;
    };
  }, [printing, month]);

  const editMemo = (date: string) => {
    const memo = window.prompt(`${dayLabel(date)} 메모 (예: 분실 1장)`, byDate.get(date)?.memo ?? '');
    if (memo !== null) save.mutate({ kind: 'memo', date, memo: memo.trim() });
  };

  const firstCol = 'sticky left-0 z-[5] border-r border-border'; // 배경은 쓰는 곳에서 — 같은 칸에 배경 두 개가 겹치지 않게
  const lastCol = 'sticky right-0 z-[5] border-l border-border'; // 합계 — 이름 열처럼 가로 스크롤해도 오른쪽에 붙어 있게
  const sumCell = (date: string) => (date === today ? 'bg-teal-soft' : 'bg-panel-alt');

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead
        icon="🎫"
        name="식권 대장"
        desc="받은 사람을 체크하면 발행·남은 식권이 자동 계산됩니다. 누른 채 끌거나 Shift+클릭으로 여러 칸을 한 번에 체크할 수 있습니다. 식권을 받아 온 날은 표 위쪽 '입고'에 수량을, 분실 등은 날짜를 눌러 메모로 남기세요."
        right={
          <div className="flex gap-2">
            <Button onClick={() => setPrinting(true)} disabled={isLoading || printing}>
              <Printer size={14} /> PDF 저장
            </Button>
            <Button onClick={download} disabled={isLoading}>
              <Download size={14} /> 엑셀 다운로드
            </Button>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-panel text-ink2 hover:bg-panel-alt" title="이전 달">
            <ChevronLeft size={16} />
          </button>
          <span className="w-28 text-center text-sm font-bold text-ink">{month.slice(0, 4)}년 {Number(month.slice(5))}월</span>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-panel text-ink2 hover:bg-panel-alt" title="다음 달">
            <ChevronRight size={16} />
          </button>
          {month !== today.slice(0, 7) && (
            <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="ml-1 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs font-semibold text-ink2 hover:bg-panel-alt">이번 달</button>
          )}
        </div>
        <label className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 text-ink3">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·부서 검색" className="w-36 bg-transparent text-xs text-ink outline-none" />
        </label>
        <div className="ml-auto text-xs text-ink2">
          전월 이월 <b className="text-ink">{opening}</b> · 이번 달 발행 <b className="text-ink">{summary.reduce((a, r) => a + r.issued, 0)}</b> · 남은 식권{' '}
          <b className="text-teal">{remainingNow}</b>
        </div>
      </div>

      {/* 세로는 페이지 스크롤 하나로 펼치고, 표는 가로로만 스크롤한다. 합계 줄은 머리글 바로 아래에 둔다. */}
      <div ref={scrollRef} className="content-scroll mt-3 overflow-x-auto rounded-xl border border-border bg-panel shadow-sm [contain:inline-size]">
        <table className="select-none border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className={`${firstCol} min-w-[150px] border-b bg-panel-alt px-3 py-2 text-left font-bold text-ink2`}>이름</th>
              {dates.map((date) => (
                <th
                  key={date}
                  data-today={date === today || undefined}
                  title={[holidayNames.get(date), byDate.get(date)?.memo, '눌러서 메모'].filter(Boolean).join('\n')}
                  onClick={() => editMemo(date)}
                  className={`min-w-[44px] cursor-pointer border-b border-border px-1 py-1.5 text-center font-semibold ${
                    date === today
                      ? 'bg-teal text-white'
                      : `bg-panel-alt hover:bg-teal-soft ${weekdayOf(date) === 0 || holidayNames.has(date) ? 'text-danger' : weekdayOf(date) === 6 ? 'text-blue' : 'text-ink2'}`
                  }`}
                >
                  <div>{date === today ? '오늘' : Number(date.slice(8))}</div>
                  <div className="text-[10px] font-normal">
                    {date === today ? `${Number(date.slice(8))} ` : ''}
                    {dayLabel(date).slice(-2, -1)}
                    {byDate.get(date)?.memo ? ' •' : ''}
                  </div>
                </th>
              ))}
              <th className={`${lastCol} min-w-[48px] border-b bg-panel-alt px-2 text-center font-bold text-ink2`}>합계</th>
            </tr>
            <tr>
              <td className={`${firstCol} bg-panel-alt px-3 py-1 font-bold text-ink`}>입고</td>
              {summary.map((r) => (
                <td key={r.date} className={`p-0.5 ${sumCell(r.date)}`}>
                  <StockInput value={r.stockIn} onSave={(n) => save.mutate({ kind: 'stockIn', date: r.date, stockIn: n })} />
                </td>
              ))}
              <td className={`${lastCol} bg-panel-alt text-center font-semibold text-ink`}>{summary.reduce((a, r) => a + r.stockIn, 0) || ''}</td>
            </tr>
            <tr>
              <td className={`${firstCol} bg-panel-alt px-3 py-1.5 font-bold text-ink`}>발행</td>
              {summary.map((r) => (
                <td key={r.date} className={`text-center font-semibold text-ink2 ${sumCell(r.date)}`}>{r.issued || ''}</td>
              ))}
              <td className={`${lastCol} bg-panel-alt text-center font-semibold text-ink`}>{summary.reduce((a, r) => a + r.issued, 0) || ''}</td>
            </tr>
            <tr>
              <td className={`${firstCol} border-b-2 bg-panel-alt px-3 py-1.5 font-bold text-ink`}>남은 식권</td>
              {summary.map((r) => (
                <td key={r.date} className={`border-b-2 border-border text-center font-bold ${r.remaining < 0 ? 'text-danger' : 'text-teal'} ${sumCell(r.date)}`}>
                  {remainingCell(r)}
                </td>
              ))}
              <td className={`${lastCol} border-b-2 bg-panel-alt text-center font-bold text-teal`}>{remainingNow}</td>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              let total = 0;
              return (
                <tr key={p.id} className="group">
                  <td className={`${firstCol} whitespace-nowrap border-b bg-panel px-3 py-1.5 group-hover:bg-panel-alt`}>
                    <span className="font-semibold text-ink">{p.name}</span>
                    <span className="ml-1.5 text-[10.5px] text-ink3">{p.retired ? '퇴직' : p.dept}</span>
                  </td>
                  {dates.map((date) => {
                    const checked = isChecked(date, p.id);
                    if (checked) total += 1;
                    return (
                      <td
                        key={date}
                        onMouseDown={(e) => onCellDown(e, date, p.id)}
                        onMouseEnter={() => onCellEnter(date, p.id)}
                        className={`h-8 cursor-pointer border-b border-border p-0 text-center ${date === today ? 'border-x border-x-teal bg-teal-soft' : offDay(date) ? 'bg-bg group-hover:bg-panel-alt' : 'group-hover:bg-panel-alt'}`}
                      >
                        {/* 마우스는 칸(td)이 받는다 — 체크박스는 보이기·키보드용 */}
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          onKeyDown={(e) => onCellKey(e, date, p.id)}
                          className="pointer-events-none h-4 w-4 accent-teal"
                          aria-label={`${p.name} ${dayLabel(date)} 식권`}
                        />
                      </td>
                    );
                  })}
                  <td className={`${lastCol} border-b bg-panel text-center font-semibold text-ink group-hover:bg-panel-alt`}>{total || ''}</td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={dates.length + 2} className="py-10 text-center text-ink3">{isLoading ? '불러오는 중…' : '표시할 사람이 없습니다.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {printing && (
        <MealTicketPrintSheet
          month={month}
          dates={dates}
          people={people}
          byDate={byDate}
          summary={summary}
          opening={opening}
          remainingNow={remainingNow}
          today={today}
          offDay={offDay}
          weekdayOf={weekdayOf}
        />
      )}
    </div>
  );
}

/** 입고 수량 칸 — 입력 중에는 저장하지 않고, 칸을 벗어나거나 Enter 때 바뀐 값만 저장한다. */
function StockInput({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Math.max(0, Math.floor(Number(draft) || 0));
    setDraft(null);
    if (n !== value) onSave(n);
  };
  return (
    <input
      inputMode="numeric"
      value={draft ?? (value ? String(value) : '')}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-7 w-full rounded border border-transparent bg-transparent text-center text-xs font-semibold text-ink outline-none hover:border-border focus:border-teal focus:bg-panel"
    />
  );
}
