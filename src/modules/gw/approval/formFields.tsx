import type { FormField, FieldValue } from '@/domain/approvalForm/schema';
import {
  END_SUFFIX,
  DAYS_SUFFIX,
  daysBetween,
  type OrgLite,
} from './formFields/utils';
import { CalendarRangePicker } from './formFields/CalendarRangePicker';
import { AutoResizeTextarea } from './formFields/AutoResizeTextarea';
import { TableFieldEditor } from './formFields/TableFieldEditor';
import { SelectFieldEditor } from './formFields/SelectFieldEditor';

// Re-export utility functions and types for backward compatibility
export {
  END_SUFFIX,
  DAYS_SUFFIX,
  daysBetween,
  getCellMergeInfo,
  fieldText,
  missingRequired,
  type CellMerge,
  type OrgLite,
} from './formFields/utils';

const inp = 'w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[12.5px] text-ink outline-none focus:border-teal';

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
      return (
        <AutoResizeTextarea
          value={sv}
          onChange={(val) => set({ [field.key]: val })}
          placeholder={field.placeholder}
          className={`${inp} resize-none leading-relaxed`}
        />
      );

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
      return <SelectFieldEditor field={field} sv={sv} set={set} inp={inp} />;

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

    case '표': {
      return <TableFieldEditor field={field} v={v} set={set} />;
    }

    case '텍스트':
    default: {
      const isDaysField = field.key.endsWith('__days');
      if (isDaysField) {
        const daysVal = sv ? `${sv}일` : '—';
        return <input disabled value={daysVal} className={`${inp} opacity-70 bg-panel-alt`} />;
      }
      return (
        <AutoResizeTextarea
          value={sv}
          onChange={(val) => set({ [field.key]: val })}
          placeholder={field.placeholder}
          className={`${inp} resize-none leading-relaxed`}
          rows={1}
        />
      );
    }
  }
}
