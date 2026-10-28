import { createPortal } from 'react-dom';
import { remainingCell, type MealTicketDay, type MealTicketDaySummary } from '@/domain/mealTicket/engine';

const WEEKDAY = '일월화수목금토';

interface Props {
  month: string;
  dates: string[];
  people: { id: string; name: string; dept: string; retired: boolean }[];
  byDate: Map<string, MealTicketDay>;
  summary: MealTicketDaySummary[];
  opening: number;
  remainingNow: number;
  today: string;
  offDay: (date: string) => boolean;
  weekdayOf: (date: string) => number;
}

/**
 * 식권 대장 인쇄(PDF 저장)용 한 달 표 — A4 가로, 행 = 사람, 열 = 날짜(화면 표와 같은 모양).
 * 인쇄하는 동안만 body 에 붙인다. 인쇄 때는 `.approval-print` 만 보이는 공통 규칙(index.css)을 그대로 쓰고,
 * 용지 방향·여백은 이 표가 떠 있을 때만 끼우는 @page 로 바꾼다(전자결재 인쇄는 세로 그대로).
 */
export function MealTicketPrintSheet({ month, dates, people, byDate, summary, opening, remainingNow, today, offDay, weekdayOf }: Props) {
  const cell = 'border border-[#999] text-center';
  const off = (date: string) => (offDay(date) ? 'bg-[#eee]' : '');
  const memos = dates.flatMap((date) => {
    const memo = byDate.get(date)?.memo;
    return memo ? [{ date, memo }] : [];
  });

  return createPortal(
    <div className="approval-print hidden bg-white text-[#111] [print-color-adjust:exact] print:block">
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
      {/* 화면 글씨 배율(body zoom)을 되돌려 mm·pt 그대로 찍히게 */}
      <div style={{ zoom: 'calc(1 / var(--font-scale, 1.48))' }} className="text-[7pt] leading-tight">
        <div className="mb-[3mm] flex items-end justify-between">
          <h1 className="text-[13pt] font-bold">
            식권 대장 — {month.slice(0, 4)}년 {Number(month.slice(5))}월
          </h1>
          <div className="text-[8pt]">
            전월 이월 <b>{opening}</b> · 이번 달 입고 <b>{summary.reduce((a, r) => a + r.stockIn, 0)}</b> · 발행{' '}
            <b>{summary.reduce((a, r) => a + r.issued, 0)}</b> · 남은 식권 <b>{remainingNow}</b>
            <span className="ml-[3mm] text-[#666]">출력 {today}</span>
          </div>
        </div>

        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: '30mm' }} />
            {dates.map((d) => (
              <col key={d} />
            ))}
            <col style={{ width: '9mm' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={`${cell} px-[1mm] text-left`}>이름</th>
              {dates.map((d) => (
                <th key={d} className={`${cell} py-[0.5mm] font-semibold ${off(d)}`}>
                  {Number(d.slice(8))}
                  <div className={`text-[6pt] font-normal ${weekdayOf(d) === 0 ? 'text-[#c00]' : 'text-[#555]'}`}>{WEEKDAY[weekdayOf(d)]}</div>
                </th>
              ))}
              <th className={`${cell} font-semibold`}>합계</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const total = dates.filter((d) => byDate.get(d)?.recipients.includes(p.id)).length;
              return (
                <tr key={p.id} className="break-inside-avoid">
                  <td className={`${cell} truncate px-[1mm] text-left`}>
                    <b>{p.name}</b> <span className="text-[6pt] text-[#666]">{p.retired ? '퇴직' : p.dept}</span>
                  </td>
                  {dates.map((d) => (
                    <td key={d} className={`${cell} h-[4.6mm] ${off(d)}`}>
                      {byDate.get(d)?.recipients.includes(p.id) ? 'O' : ''}
                    </td>
                  ))}
                  <td className={`${cell} font-semibold`}>{total || ''}</td>
                </tr>
              );
            })}
            {(
              [
                ['입고', (r: MealTicketDaySummary) => r.stockIn || '', summary.reduce((a, r) => a + r.stockIn, 0)],
                ['발행', (r: MealTicketDaySummary) => r.issued || '', summary.reduce((a, r) => a + r.issued, 0)],
                ['남은 식권', remainingCell, remainingNow],
              ] as const
            ).map(([label, value, total], i) => (
              <tr key={label} className={`break-inside-avoid bg-[#f4f4f4] font-semibold ${i === 0 ? 'border-t-2 border-t-[#333]' : ''}`}>
                <td className={`${cell} px-[1mm] text-left`}>{label}</td>
                {summary.map((r) => (
                  <td key={r.date} className={`${cell} h-[4.6mm]`}>
                    {value(r)}
                  </td>
                ))}
                <td className={cell}>{total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {memos.length > 0 && (
          <div className="mt-[3mm] break-inside-avoid text-[7.5pt]">
            <b>메모</b>
            {memos.map(({ date, memo }) => (
              <div key={date}>
                {Number(date.slice(5, 7))}/{Number(date.slice(8))}({WEEKDAY[weekdayOf(date)]}) {memo}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
