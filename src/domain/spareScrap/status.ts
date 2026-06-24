import type { SpareScrap } from './schema';

type ScrapState = SpareScrap['state'];

/**
 * 예비품 폐기·불용 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 불용지정 → 폐기요청 → 승인대기 → 승인완료 → 폐기완료 (선형 진행).
 * '반려'는 승인대기 단계의 예외 분기로, 재상신 시 폐기요청으로 복귀.
 */
const ALLOWED: Record<ScrapState, ScrapState[]> = {
  불용지정: ['폐기요청'],
  폐기요청: ['승인대기'],
  승인대기: ['승인완료', '반려'],
  승인완료: ['폐기완료'],
  폐기완료: [],
  반려: ['폐기요청'],
};

const FORWARD: Record<ScrapState, ScrapState | null> = {
  불용지정: '폐기요청',
  폐기요청: '승인대기',
  승인대기: '승인완료',
  승인완료: '폐기완료',
  폐기완료: null,
  반려: '폐기요청',
};

export function canTransition(from: ScrapState, to: ScrapState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: ScrapState): ScrapState | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨(각 단계의 다음 액션). */
export function nextActionLabel(s: ScrapState): string | null {
  return {
    불용지정: '폐기 승인 요청',
    폐기요청: '승인 상신',
    승인대기: '승인',
    승인완료: '폐기 완료 처리',
    폐기완료: null,
    반려: '재상신',
  }[s];
}
