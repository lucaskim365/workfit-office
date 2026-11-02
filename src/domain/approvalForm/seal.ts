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

/** 결재 완료로 끝난 문서 — 직인 서식은 이때 결재란 대신 회사 직인 */
const SEAL_DONE_STATUSES = ['완료', '취소완료'];
/** 일반 서식이 종이에 결재란을 보이는 상태(진행 중에는 상세 화면의 결재선 흐름도로 본다) */
const STAMP_TABLE_STATUSES = ['완료', '시행대기', '취소완료'];

/**
 * 문서 종이에 결재란을 보일지.
 * 직인 서식 — 결재가 진행되는 동안은 결재란, 완료되면 결재란을 숨기고 회사 직인.
 * 일반 서식 — 지금처럼 완료(시행대기·취소완료 포함) 문서에만.
 */
export function stampTableShown(status: string, sealForm: boolean): boolean {
  return sealForm ? !SEAL_DONE_STATUSES.includes(status) : STAMP_TABLE_STATUSES.includes(status);
}
