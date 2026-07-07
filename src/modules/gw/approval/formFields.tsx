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
      const days = start && end ? daysBetween(start, end) : 0;
      return (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={start} onChange={(e) => set({ [field.key]: e.target.value, [field.key + DAYS_SUFFIX]: daysBetween(e.target.value, end) })} className={inp} />
          <div>
            <input type="date" value={end} onChange={(e) => set({ [field.key + END_SUFFIX]: e.target.value, [field.key + DAYS_SUFFIX]: daysBetween(start, e.target.value) })} className={inp} />
            {days > 0 && <span className="mt-1 block text-[11px] text-ink3">{days}일</span>}
          </div>
        </div>
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
    default:
      return <input value={sv} onChange={(e) => set({ [field.key]: e.target.value })} placeholder={field.placeholder} className={inp} />;
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
