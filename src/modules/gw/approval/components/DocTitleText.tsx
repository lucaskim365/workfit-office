import { docTitleLook } from '@/domain/approvalForm/docTitle';

/**
 * 결재 문서 큰 제목 글자 — 제목 길이에 맞춰 글자 간격을 준다(docTitle.ts).
 * 글자 간격은 마지막 글자 뒤에도 붙어 가운데에서 왼쪽으로 쏠리므로, 같은 만큼 왼쪽 여백을 줘 가운데를 맞춘다.
 */
export function DocTitleText({ title }: { title: string }) {
  const { text, letterSpacing } = docTitleLook(title);
  return <span style={{ letterSpacing, paddingLeft: letterSpacing }}>{text}</span>;
}
