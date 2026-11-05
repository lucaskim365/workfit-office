/**
 * 새 서식의 코드 — 서식명에서 저절로 만든다(관리자가 코드를 몰라도 되게).
 * 서식 코드는 문서 종류 이름으로 목록·모바일·결재 모니터에 그대로 보이므로 무작위 글자 대신 서식명을 쓴다.
 * 공백·기호는 빼고, 이미 쓰는(또는 지운 시트 서식이 쓰던) 코드와 겹치면 뒤에 2, 3…을 붙인다.
 */
export const FORM_CODE_MAX = 30;

export function suggestFormCode(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((c) => c.toLowerCase()));
  const base = name.normalize('NFC').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, FORM_CODE_MAX) || '서식';
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const code = `${base.slice(0, FORM_CODE_MAX - String(n).length)}${n}`;
    if (!used.has(code.toLowerCase())) return code;
  }
}
