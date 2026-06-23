import { Fragment } from 'react';

export type IconName =
  | 'plus'
  | 'save'
  | 'upload'
  | 'download'
  | 'refresh'
  | 'compare'
  | 'search'
  | 'trash';

const PATHS: Record<IconName, string[]> = {
  plus: ['M12 5.5v13', 'M5.5 12h13'],
  save: ['M5 4.5h11l3 3V19a.5.5 0 0 1-.5.5H5.5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5Z', 'M8 4.5v4.5h6.5', 'M8.5 14.5h7'],
  upload: ['M12 14.5V5', 'M8.5 8.5 12 5l3.5 3.5', 'M6 18.5h12'],
  download: ['M12 5v9.5', 'M8.5 11 12 14.5 15.5 11', 'M6 18.5h12'],
  refresh: ['M19 12a7 7 0 1 1-2-4.9', 'M19 4.5V8h-3.5'],
  compare: ['M7.5 4.5v15', 'M4 8l3.5-3.5L11 8', 'M16.5 19.5v-15', 'M20 16l-3.5 3.5L13 16'],
  search: ['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z', 'M20 20l-4.2-4.2'],
  trash: ['M5.5 7h13', 'M9.5 7V5.2a.7.7 0 0 1 .7-.7h3.6a.7.7 0 0 1 .7.7V7', 'M7 7l.8 11.3a.8.8 0 0 0 .8.7h6.8a.8.8 0 0 0 .8-.7L18 7', 'M10.5 10.5v6', 'M13.5 10.5v6'],
};

export function ActIcon({ name, size = 13 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export interface ActionButtonProps {
  icon: IconName;
  label: string;
  variant?: 'default' | 'primary';
  /** 엑셀 계열 강조(아이콘 녹색). */
  accent?: 'excel';
  onClick?: () => void;
  disabled?: boolean;
}

/** 단일 액션 버튼 — 와이어프레임 shared.jsx ActionButton 정본 이관. */
export function ActionButton({
  icon,
  label,
  variant = 'default',
  accent,
  onClick,
  disabled,
}: ActionButtonProps) {
  const primary = variant === 'primary';
  const iconColor = primary
    ? 'text-white/85'
    : accent === 'excel'
      ? 'text-[#1f8a5b]'
      : 'text-ink3';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[7px] px-[11px] text-[11px] font-bold tracking-tight transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? 'border border-navy bg-navy text-white shadow-sm hover:opacity-95'
          : 'border border-border-hi bg-panel text-ink2 hover:bg-panel-alt'
      }`}
    >
      <span className={`inline-flex ${iconColor}`}>
        <ActIcon name={icon} />
      </span>
      {label}
    </button>
  );
}

type Preset = 'add' | 'save' | 'upload' | 'download' | 'refresh' | 'compare' | 'search' | 'delete';

const PRESET: Record<Preset, ActionButtonProps> = {
  add: { icon: 'plus', label: '추가' },
  save: { icon: 'save', label: '저장', variant: 'primary' },
  upload: { icon: 'upload', label: '엑셀업로드', accent: 'excel' },
  download: { icon: 'download', label: '엑셀다운로드', accent: 'excel' },
  refresh: { icon: 'refresh', label: '새로고침' },
  compare: { icon: 'compare', label: '기간 비교' },
  search: { icon: 'search', label: '조회', variant: 'primary' },
  delete: { icon: 'trash', label: '삭제' },
};

export interface ActionItem extends Partial<ActionButtonProps> {
  preset?: Preset;
}

export type ActionInput = Preset | ActionItem;

function resolve(a: ActionInput): ActionButtonProps {
  if (typeof a === 'string') return PRESET[a];
  const base = a.preset ? PRESET[a.preset] : ({} as ActionButtonProps);
  return { ...base, ...a } as ActionButtonProps;
}

/**
 * 액션 버튼 그룹 — 와이어프레임 shared.jsx ActionBar 정본 이관.
 * 프리셋 문자열('add', 'download'…) 또는 커스텀 객체(onClick 포함) 혼용 가능.
 * 엑셀 계열 버튼 앞에는 자동으로 구분선을 넣는다.
 */
export function ActionBar({ actions = [] }: { actions?: ActionInput[] }) {
  let prevExcel = false;
  return (
    <div className="flex items-center gap-1.5">
      {actions.map((a, i) => {
        const p = resolve(a);
        const isExcel = p.accent === 'excel';
        const divider = isExcel && !prevExcel && i > 0;
        prevExcel = isExcel;
        return (
          <Fragment key={i}>
            {divider && <span className="mx-0.5 h-[18px] w-px bg-border" />}
            <ActionButton {...p} />
          </Fragment>
        );
      })}
    </div>
  );
}
