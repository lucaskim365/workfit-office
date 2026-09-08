import {
  type UserPresence,
  type UserPresenceStatus,
  USER_PRESENCE_META,
} from '@/domain/userPresence/schema';

interface PresenceDotProps {
  presence?: UserPresence | null;
  status?: UserPresenceStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
}

const DOT_SIZES = {
  sm: 'h-2 w-2 ring-1.5',
  md: 'h-2.5 w-2.5 ring-2',
  lg: 'h-3 w-3 ring-2',
};

/**
 * 아바타 우측 하단 등에 표시되는 실시간 상태 점 (디스코드/슬랙 스타일)
 */
export function PresenceDot({
  presence,
  status: propStatus,
  size = 'md',
  className = '',
  showTooltip = true,
}: PresenceDotProps) {
  const status = propStatus || presence?.status || 'OFFLINE';
  const meta = USER_PRESENCE_META[status] || USER_PRESENCE_META.OFFLINE;

  const tooltip = showTooltip
    ? `${meta.label}${presence?.message ? ` - ${presence.message}` : ''}`
    : undefined;

  return (
    <span
      title={tooltip}
      className={`absolute bottom-0 right-0 rounded-full ring-white dark:ring-zinc-900 transition-colors ${meta.dotColor} ${DOT_SIZES[size]} ${className}`}
    />
  );
}

interface PresenceBadgeProps {
  presence?: UserPresence | null;
  status?: UserPresenceStatus;
  showMessage?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * 대화방 상단 헤더, 사원 목록 등에서 텍스트 및 아이콘과 함께 표시되는 상태 알약 뱃지
 */
export function PresenceBadge({
  presence,
  status: propStatus,
  showMessage = true,
  size = 'xs',
  className = '',
}: PresenceBadgeProps) {
  const status = propStatus || presence?.status || 'OFFLINE';
  const meta = USER_PRESENCE_META[status] || USER_PRESENCE_META.OFFLINE;

  const isXs = size === 'xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border px-1.5 py-0.5 select-none transition-all ${meta.bgTone} ${
        isXs ? 'text-[9.5px]' : 'text-[10.5px]'
      } ${className}`}
      title={presence?.message ? `${meta.label} (${presence.message})` : meta.label}
    >
      <span className={`inline-block rounded-full ${meta.dotColor} ${isXs ? 'h-1.5 w-1.5' : 'h-2 w-2'}`} />
      <span>{meta.label}</span>
      {showMessage && presence?.message && (
        <span className="opacity-80 max-w-[120px] truncate text-[9px] font-normal">
          · {presence.message}
        </span>
      )}
    </span>
  );
}
