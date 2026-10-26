import type { FormField } from './schema';

/**
 * 회사 직인 서식 여부 — 직인 필드가 있거나 표 칸에 직인 지정(cellStyles.seal)이 있으면 직인 모드.
 * 직인 모드 문서는 결재란을 숨기고 결재 완료 후 회사 직인을 찍는다.
 */
export function isSealForm(fields: FormField[] | undefined): boolean {
  return (fields ?? []).some(
    (f) => f.type === '직인' || (f.type === '표' && typeof f.placeholder === 'string' && /"seal"\s*:\s*true/.test(f.placeholder))
  );
}
