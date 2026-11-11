/**
 * 결재 문서 큰 제목(서식 docTitle)의 화면 모양.
 * 제목은 평범하게 저장하고('법인카드 사용 내역서'), 격식 있게 띄우는 건 화면이 맡는다.
 * - 짧은 제목(4글자 이하: 기안서·품의서·휴가원)은 글자 간격을 넓게 — 예전 '기 안 서' 모양
 * - 그보다 긴 제목은 조금만 띄운다(길게 벌리면 읽기 어렵고 결재란과 부딪힌다)
 * - 예전처럼 글자마다 띄어 저장된 제목('법 인 카 드 …')은 띄어쓰기를 걷어 내고 같은 규칙으로 그린다
 */

/** 글자마다 한 칸씩 띄어 쓴 제목인가('기 안 서') */
const SPACED_EVERY_CHAR = /^\S( \S)+$/;
/** 넓게 띄우는 제목 길이(글자 수, 띄어쓰기 뺌) */
const SHORT_TITLE = 4;

export interface DocTitleLook {
  text: string;
  /** CSS letter-spacing */
  letterSpacing: string;
}

export function docTitleLook(title: string): DocTitleLook {
  const trimmed = title.trim();
  const text = SPACED_EVERY_CHAR.test(trimmed) ? trimmed.replace(/ /g, '') : trimmed;
  const chars = text.replace(/\s/g, '').length;
  return { text, letterSpacing: chars <= SHORT_TITLE ? '0.5em' : '0.15em' };
}
