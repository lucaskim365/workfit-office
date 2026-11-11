/**
 * 결재 문서 큰 제목(서식 docTitle)의 화면 모양 — 글자는 입력한 그대로, 글자 간격만 길이에 맞춘다.
 * - 짧은 제목(공백 포함 4자 이하: 기안서·품의서·휴가원)은 글자 간격을 넓게 — 격식 있는 '기 안 서' 모양
 * - 그보다 긴 제목은 조금만 띄운다(길게 벌리면 읽기 어렵고 결재란과 부딪힌다)
 *   공백도 글자로 세므로, 글자마다 띄어 입력한 제목('기 안 서')은 넓게 벌어지지 않고 입력한 모양대로 보인다
 */

/** 넓게 띄우는 제목 길이(공백 포함 글자 수) */
const SHORT_TITLE = 4;

export interface DocTitleLook {
  text: string;
  /** CSS letter-spacing */
  letterSpacing: string;
}

export function docTitleLook(title: string): DocTitleLook {
  const text = title.trim();
  return { text, letterSpacing: text.length <= SHORT_TITLE ? '0.5em' : '0.15em' };
}
