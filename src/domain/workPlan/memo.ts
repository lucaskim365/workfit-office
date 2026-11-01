import { parseWorkPlanItems } from './engine';
import { serializeInlineSegments, stripInlineMarks } from './richText';

/** 메모 글자 수 한도 — 저장 본문(`workPlans.content`) 한도와 같다 */
export const WORK_PLAN_MEMO_MAX = 1_000;

/** 할 일로 읽히는 줄 머리(`-`, `*`, `[ ]`, `[x]`) — 메모 줄이 할 일로 바뀌지 않게 막는다 */
const LOOKS_LIKE_TASK = /^\s*(?:[-*]|\[[ xX]\])/;

/**
 * 업무계획 본문 → 칸에 보일 메모 글. 서식 기호는 빼고, 태그가 있던 줄은 `[태그] ` 접두.
 * 빈 줄은 뺀다. 남는 글이 없으면 null.
 */
export function contentToMemo(content: string): string | null {
  const lines = parseWorkPlanItems(content)
    .map((line) => {
      const text = stripInlineMarks(line.text).trim();
      if (!text) return '';
      return line.tag ? `[${line.tag}] ${text}` : text;
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * 메모 글 → 저장 본문. 다시 읽을 때(`contentToMemo`) 같은 글이 나오도록
 * 서식 기호처럼 보이는 글자는 이스케이프하고, 할 일처럼 보이는 줄은 역슬래시를 붙인다. 빈 줄은 뺀다.
 */
export function memoToContent(memo: string): string {
  return memo
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const escaped = serializeInlineSegments([{ text: line, marks: {} }]);
      return LOOKS_LIKE_TASK.test(escaped) ? `\\${escaped}` : escaped;
    })
    .join('\n');
}
