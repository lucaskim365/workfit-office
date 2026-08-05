/** 날짜/시간 포맷터 (YYYY.MM.DD HH:mm) */
export function fmtDateTime(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
  } catch {
    return isoStr;
  }
}

/** 날짜 포맷터 (YYYY.MM.DD) */
export function fmtDate(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
  } catch {
    return isoStr;
  }
}

/** 원화 금액 포맷터 */
export function won(num?: number | null): string {
  if (num == null || isNaN(num)) return '0원';
  return `${num.toLocaleString('ko-KR')}원`;
}

/** 문서 종류별 이모지 아이콘 매핑 */
export const DOC_TYPE_ICON: Record<string, string> = {
  일반: '📄',
  휴가: '🏖️',
  지출: '💳',
  구매: '🛒',
  품의: '📋',
  업무보고: '📊',
};

/** 문서 상태별 뱃지 스타일 매핑 */
export const STATUS_BADGE: Record<string, { label: string; toneClass: string }> = {
  임시저장: { label: '임시저장', toneClass: 'bg-ink3/10 text-ink2 border-ink3/20' },
  진행중: { label: '진행중', toneClass: 'bg-teal-soft text-teal border-teal/30 font-bold' },
  완료: { label: '완료', toneClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold' },
  반려: { label: '반려', toneClass: 'bg-red-500/10 text-red-600 border-red-500/30 font-bold' },
  '긴급 조치 사후 검토 반려': { label: '🚨 사후 검토 반려', toneClass: 'bg-rose-600 text-white border-rose-700 font-extrabold shadow-xs' },
  회수: { label: '회수', toneClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  삭제: { label: '삭제됨', toneClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
};

/** 결재 단계 구분(종류)별 텍스트 색상 매핑 */
export const KIND_TONE: Record<string, string> = {
  결재: 'text-teal',
  합의: 'text-purple-600',
  참조: 'text-ink3',
  시행: 'text-blue-600',
};
