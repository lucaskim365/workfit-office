/*
  결재란·결재 진행 카드에 이름 위로 보이는 칭호 — 직책이 있으면 직책(팀장·본부장·소장…), 없으면 직급(사원·과장…).
  새로 만든 문서(titleMode='jobTitle')부터 적용한다. 그 전 문서는 예전처럼 직급 — 기존 문서 데이터는 바꾸지 않는다.
  승인한 칸은 승인 때 남긴 직책(approverTitle)을, 아직 승인 전인 칸은 그 사람의 지금 직책을 쓴다.
*/

/** 칭호로 보이지 않는 직책 — 팀원·임원은 직급(사원·이사 등)이 더 알려 준다 */
const PLAIN_TITLES = new Set(['', '팀원', '임원']);

export const TITLE_MODE_JOB_TITLE = 'jobTitle';

export function titleOrPosition(jobTitle: string | null | undefined, position: string | null | undefined): string {
  const t = (jobTitle ?? '').trim();
  return PLAIN_TITLES.has(t) ? (position ?? '').trim() : t;
}

interface DocLike {
  titleMode?: string | null;
  drafterPos?: string | null;
  drafterTitle?: string | null;
}
interface StepLike {
  approverPos?: string | null;
  approverTitle?: string | null;
}
interface PersonLike {
  position?: string | null;
  jobTitle?: string | null;
}

const usesJobTitle = (doc: DocLike) => doc.titleMode === TITLE_MODE_JOB_TITLE;

/** 결재선 한 칸의 칭호 — person 은 그 칸 결재자의 지금 정보(없을 수 있음) */
export function stepTitleOf(doc: DocLike, step: StepLike, person?: PersonLike | null): string {
  if (!usesJobTitle(doc)) return step.approverPos || person?.position || '';
  // 승인 때 남긴 직책이 있으면 그것(빈 값도 '직책 없음'으로 남긴 것)
  if (step.approverTitle != null) return titleOrPosition(step.approverTitle, step.approverPos || person?.position);
  return titleOrPosition(person?.jobTitle, step.approverPos || person?.position);
}

/** 기안자의 칭호 */
export function drafterTitleOf(doc: DocLike, person?: PersonLike | null): string {
  if (!usesJobTitle(doc)) return doc.drafterPos || person?.position || '';
  if (doc.drafterTitle != null) return titleOrPosition(doc.drafterTitle, doc.drafterPos || person?.position);
  return titleOrPosition(person?.jobTitle, doc.drafterPos || person?.position);
}
