import { useState, useRef, useEffect } from 'react';
import type { FormField, FieldValue } from '@/domain/approvalForm/schema';
import type { User } from '@/domain/user/schema';
import type { Department } from '@/domain/department/schema';

/**
 * 결재서식 동적 필드 위젯 — 상신 모달·서식 미리보기가 공유한다.
 * 기간(period) 필드는 보조 키(`key__end`,`key__days`)로 시작/종료/일수를 분해 저장한다.
 * body(본문)·금액(amount) 예약 필드는 상신 모달이 별도 1급 컬럼으로 바인딩하므로 여기서 제외.
 */

export const END_SUFFIX = '__end';
export const DAYS_SUFFIX = '__days';

/** 날짜 차이(일). endDate 포함. 유효하지 않으면 0. */
export function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

const inp = 'w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12.5px] text-ink outline-none focus:border-teal';

export interface OrgLite {
  users: User[];
  depts: Department[];
}

function CalendarRangePicker({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState(() => {
    const initial = start ? new Date(start) : new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDateClick = (dateStr: string) => {
    if (!start || (start && end)) {
      onChange(dateStr, '');
    } else {
      if (dateStr < start) {
        onChange(dateStr, '');
      } else {
        onChange(start, dateStr);
        setOpen(false);
      }
    }
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const dateItems: { dateStr: string; day: number; currentMonth: boolean }[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(year, month - 1, prevMonthDays - i);
    const yStr = prevDate.getFullYear();
    const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(prevDate.getDate()).padStart(2, '0');
    dateItems.push({
      dateStr: `${yStr}-${mStr}-${dStr}`,
      day: prevMonthDays - i,
      currentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(i).padStart(2, '0');
    dateItems.push({
      dateStr: `${year}-${mStr}-${dStr}`,
      day: i,
      currentMonth: true,
    });
  }

  const remaining = 42 - dateItems.length;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    const yStr = nextDate.getFullYear();
    const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(nextDate.getDate()).padStart(2, '0');
    dateItems.push({
      dateStr: `${yStr}-${mStr}-${dStr}`,
      day: i,
      currentMonth: false,
    });
  }

  const daysLabel = start && end ? daysBetween(start, end) : 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-left text-[12.5px] text-ink outline-none focus:border-teal flex justify-between items-center hover:bg-panel-alt/80 transition-colors"
      >
        <span>
          {start
            ? `${start} ~ ${end || '종료일 선택'}${daysLabel > 0 ? ` (${daysLabel}일)` : ''}`
            : '기간을 선택하세요'}
        </span>
        <span className="text-ink3 text-xs">📅</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 z-50 w-72 rounded-xl border border-border bg-panel p-3 shadow-xl">
          <div className="flex justify-between items-center mb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 text-ink2 hover:bg-panel-alt rounded-lg text-[13px] font-bold"
            >
              ◀
            </button>
            <span className="text-[12.5px] font-bold text-ink">
              {year}년 {month + 1}월
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 text-ink2 hover:bg-panel-alt rounded-lg text-[13px] font-bold"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[10.5px] font-bold text-ink3 mb-1.5">
            {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[11.5px]">
            {dateItems.map((item, idx) => {
              const { dateStr, day, currentMonth } = item;
              const isStart = start === dateStr;
              const isEnd = end === dateStr;
              const isWithinRange = start && end && dateStr >= start && dateStr <= end;

              let btnClass = 'h-8 w-8 mx-auto grid place-items-center rounded-lg transition-all ';
              if (!currentMonth) {
                btnClass += 'text-ink3/40 ';
              } else {
                btnClass += 'text-ink ';
              }

              if (isStart || isEnd) {
                btnClass += 'bg-teal text-white font-bold ';
              } else if (isWithinRange) {
                btnClass += 'bg-teal-soft/75 text-teal font-medium ';
              } else if (currentMonth) {
                btnClass += 'hover:bg-panel-alt ';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDateClick(dateStr)}
                  className={btnClass}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 단일 동적 필드 입력 위젯. values/set 로 상태를 주고받는다(기간은 다중 키). */
export function DynamicField({
  field, values, set, org,
}: {
  field: FormField;
  values: Record<string, FieldValue>;
  set: (patch: Record<string, FieldValue>) => void;
  org?: OrgLite;
}) {
  const v = values[field.key];
  const sv = typeof v === 'string' ? v : v == null ? '' : String(v);

  switch (field.type) {
    case '안내문':
      return <div className="rounded-lg bg-panel-alt px-3 py-2 text-[11.5px] text-ink3">{field.placeholder || field.label}</div>;

    case '장문':
      return <textarea value={sv} onChange={(e) => set({ [field.key]: e.target.value })} rows={4} placeholder={field.placeholder} className={`${inp} resize-none leading-relaxed`} />;

    case '숫자':
    case '금액':
      return (
        <>
          <input value={sv} onChange={(e) => set({ [field.key]: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder={field.placeholder || (field.type === '금액' ? '예: 3000000' : '')} className={inp} />
          {field.type === '금액' && sv && <span className="mt-1 block text-[11px] text-ink3">₩{Number(sv).toLocaleString()}</span>}
        </>
      );

    case '날짜':
      return <input type="date" value={sv} onChange={(e) => set({ [field.key]: e.target.value })} className={inp} />;

    case '기간': {
      const start = sv;
      const end = (values[field.key + END_SUFFIX] as string) ?? '';
      return (
        <CalendarRangePicker
          start={start}
          end={end}
          onChange={(newStart, newEnd) => {
            const days = newStart && newEnd ? daysBetween(newStart, newEnd) : 0;
            set({
              [field.key]: newStart,
              [field.key + END_SUFFIX]: newEnd,
              [field.key + DAYS_SUFFIX]: days,
            });
          }}
        />
      );
    }

    case '선택':
      return (
        <select value={sv} onChange={(e) => set({ [field.key]: e.target.value })} className={inp}>
          <option value="">선택</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );

    case '다중선택': {
      const picked = new Set(sv ? sv.split(',').filter(Boolean) : []);
      const toggle = (o: string) => {
        picked.has(o) ? picked.delete(o) : picked.add(o);
        set({ [field.key]: [...picked].join(',') });
      };
      return (
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((o) => (
            <button key={o} type="button" onClick={() => toggle(o)} className={`rounded-lg border px-2.5 py-1 text-[11.5px] ${picked.has(o) ? 'border-teal bg-teal-soft text-teal' : 'border-border bg-panel-alt text-ink2'}`}>{o}</button>
          ))}
        </div>
      );
    }

    case '체크':
      return (
        <label className="flex items-center gap-2 text-[12.5px] text-ink">
          <input type="checkbox" checked={v === true} onChange={(e) => set({ [field.key]: e.target.checked })} />
          {field.placeholder || '예'}
        </label>
      );

    case '사용자':
      return (
        <select value={sv} onChange={(e) => set({ [field.key]: e.target.value })} className={inp}>
          <option value="">선택</option>
          {(org?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept}</option>)}
        </select>
      );

    case '부서':
      return (
        <select value={sv} onChange={(e) => set({ [field.key]: e.target.value })} className={inp}>
          <option value="">선택</option>
          {(org?.depts ?? []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      );

    case '텍스트':
    default: {
      const isDaysField = field.key.endsWith('__days');
      if (isDaysField) {
        const daysVal = sv ? `${sv}일` : '—';
        return <input disabled value={daysVal} className={`${inp} opacity-70 bg-panel-alt`} />;
      }
      return <input value={sv} onChange={(e) => set({ [field.key]: e.target.value })} placeholder={field.placeholder} className={inp} />;
    }
  }
}

/** 인쇄/문서뷰용 — 필드값을 사람이 읽는 문자열로. */
export function fieldText(field: FormField, values: Record<string, FieldValue>, org?: OrgLite): string {
  const v = values[field.key];
  switch (field.type) {
    case '금액':
      return v ? `₩${Number(v).toLocaleString()}` : '—';
    case '기간': {
      const start = (v as string) ?? '';
      const end = (values[field.key + END_SUFFIX] as string) ?? '';
      const days = (values[field.key + DAYS_SUFFIX] as number) ?? (start && end ? daysBetween(start, end) : 0);
      return start && end ? `${start} ~ ${end} (${days}일)` : '—';
    }
    case '체크':
      return v === true ? '예' : '아니오';
    case '사용자':
      return org?.users.find((u) => u.id === v)?.name ?? (v ? String(v) : '—');
    default:
      return v === '' || v == null ? '—' : String(v);
  }
}

/** 필수 미입력 필드 라벨 목록(검증용). body/amount 예약 필드는 상신 모달이 별도 검증. */
export function missingRequired(fields: FormField[], values: Record<string, FieldValue>): string[] {
  return fields
    .filter((f) => f.required && f.type !== '안내문')
    .filter((f) => {
      const v = values[f.key];
      if (f.type === '기간') return !(v && values[f.key + END_SUFFIX]);
      if (f.type === '체크') return v !== true;
      return v === '' || v == null;
    })
    .map((f) => f.label);
}
