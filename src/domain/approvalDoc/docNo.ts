/*
  화면·인쇄에 보이는 문서번호. 서식의 자동번호 칸이 '문서번호로 표시'면 상신 때 그 번호를 fieldValues[DOC_NO_VALUE_KEY] 에
  함께 남기고, 없으면 결재 문서 고유번호(docNo = AP-…)를 쓴다. 고유번호(id·docNo)는 바꾸지 않는다.
*/

export const DOC_NO_VALUE_KEY = '__docNo';

export function docNoOf(doc: { docNo: string; fieldValues?: Record<string, unknown> | null }): string {
  const shown = doc.fieldValues?.[DOC_NO_VALUE_KEY];
  return typeof shown === 'string' && shown.trim() ? shown : doc.docNo;
}
