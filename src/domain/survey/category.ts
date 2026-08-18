import type { CommonCode } from '@/domain/commonCode/schema';

export const SURVEY_CATEGORY_GROUP_CODE = 'GW_SURVEY_CATEGORY';
export const SURVEY_CATEGORY_GROUP_NAME = '그룹웨어 설문 분류';

/**
 * 설문 분류 공통코드 fallback.
 *
 * 정식 위치는 `commonCodes` 컬렉션의 `GW_SURVEY_CATEGORY` 그룹이지만
 * 기존 공통코드 seed(`src/data/seeds/commonCode.seed.ts`)는 병렬 개발 보호 대상이라
 * 같은 `code` 값을 갖는 모듈 내부 목록으로 대체한다.
 * 공통코드가 실제로 등록되면 `resolveSurveyCategories`가 조회 결과를 우선 사용한다.
 * ([[jwheo/feat/survey/DESIGN.md]] §4.1 · §17.0)
 */
export const SURVEY_CATEGORY_FALLBACK: CommonCode[] = [
  { groupCode: SURVEY_CATEGORY_GROUP_CODE, groupName: SURVEY_CATEGORY_GROUP_NAME, code: 'EMPLOYEE', name: '임직원 의견', order: 10, use: true, regBy: '관리자' },
  { groupCode: SURVEY_CATEGORY_GROUP_CODE, groupName: SURVEY_CATEGORY_GROUP_NAME, code: 'EVENT', name: '행사·참여', order: 20, use: true, regBy: '관리자' },
  { groupCode: SURVEY_CATEGORY_GROUP_CODE, groupName: SURVEY_CATEGORY_GROUP_NAME, code: 'DEMAND', name: '수요 조사', order: 30, use: true, regBy: '관리자' },
  { groupCode: SURVEY_CATEGORY_GROUP_CODE, groupName: SURVEY_CATEGORY_GROUP_NAME, code: 'EDUCATION', name: '교육 평가', order: 40, use: true, regBy: '관리자' },
  { groupCode: SURVEY_CATEGORY_GROUP_CODE, groupName: SURVEY_CATEGORY_GROUP_NAME, code: 'OTHER', name: '기타', order: 90, use: true, regBy: '관리자' },
];

/** 공통코드 조회 결과에 설문 분류 그룹이 있으면 그것을, 없으면 fallback을 쓴다. */
export function resolveSurveyCategories(codes: CommonCode[] | undefined): CommonCode[] {
  const registered = (codes ?? [])
    .filter((row) => row.groupCode === SURVEY_CATEGORY_GROUP_CODE)
    .sort((a, b) => a.order - b.order);
  return registered.length > 0 ? registered : SURVEY_CATEGORY_FALLBACK;
}

/** 신규 설문에서 고를 수 있는 분류 — 사용 중인 코드만. */
export function selectableSurveyCategories(codes: CommonCode[] | undefined): CommonCode[] {
  return resolveSurveyCategories(codes).filter((row) => row.use);
}

/**
 * 코드값 → 표시 명칭. 사용 중지된 코드도 기존 설문 표시를 위해 이름을 유지하고,
 * 목록에 아예 없으면 코드값 자체를 보여준다. ([[jwheo/feat/survey/DESIGN.md]] §4.1)
 */
export function surveyCategoryLabel(codes: CommonCode[] | undefined, code: string): string {
  return resolveSurveyCategories(codes).find((row) => row.code === code)?.name ?? code;
}

/** 저장 시 검증 — 사용 중인 분류 코드인지. */
export function isSelectableSurveyCategory(codes: CommonCode[] | undefined, code: string): boolean {
  return selectableSurveyCategories(codes).some((row) => row.code === code);
}
