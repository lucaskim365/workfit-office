/**
 * 연동 유형 — 휴가 차감·근태·캘린더·결재선이 문서를 알아보는 기준 (시트 서식 §5.3).
 *
 * 연동 코드는 원래 서식 코드(docType === '휴가' 등)로 문서를 알아봤다. 시트 서식은 기존 서식을 지우지 않으려고
 * 코드를 따로 두므로(예: '휴가_시트'), 서식에 '대체 서식'(어느 기존 서식을 대신하는지)을 정하고
 * 상신할 때 문서에 fieldValues.__link 로 남긴다. 연동 코드는 docType 대신 이 함수를 본다.
 * 기존 문서에는 __link 가 없어 지금과 똑같이 docType 을 쓴다.
 */

/** 문서 fieldValues 에 연동 유형을 담는 키 — 저장 데이터의 키이므로 바꾸지 말 것 */
export const LINK_KEY = '__link';

export function docLinkType(doc: { docType: string; fieldValues?: Record<string, unknown> | null }): string {
  const link = doc.fieldValues?.[LINK_KEY];
  return typeof link === 'string' && link ? link : doc.docType;
}
