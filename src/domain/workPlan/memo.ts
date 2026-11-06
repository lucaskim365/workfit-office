import { parseWorkPlanItems } from './engine';
import { contentToEditorDoc, editorDocToContent, toEditableText, type EditorNode } from './richText';

/** 메모 글자 수 한도 — 저장 본문(`workPlans.content`) 한도와 같다(서식 표기 포함) */
export const WORK_PLAN_MEMO_MAX = 1_000;

/*
  칸 메모는 업무계획 본문(`workPlans.content`)을 그대로 쓴다 — 줄 단위 텍스트 + 서식 표기(`**굵게**` 등) + 체크박스(`- [ ]`).
  편집기(WorkPlanMemoEditor)가 이 표기를 서식으로 보여 주고 저장할 때 되돌린다(domain/workPlan/richText).
  예전 글자만 메모(서식 기호를 역슬래시로 막아 둔 것)도 같은 형식이라 그대로 읽힌다.
*/

/** 업무계획 본문 → 칸 메모(편집기에 넣는 본문). 체크 메타(`__c__`)는 `- [x]`로 풀고, 글이 없으면 null */
export function contentToMemo(content: string): string | null {
  const memo = memoToContent(toEditableText(content));
  return memo ? memo : null;
}

/** 칸 메모 → 저장 본문. 앞뒤 공백·빈 줄은 뺀다 */
export function memoToContent(memo: string): string {
  return memo
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/** 칸에 그릴 메모 한 줄 — 체크박스 줄이면 checked, 몇 번째 체크박스인지(taskIndex) */
export interface MemoLine {
  key: string;
  /** 서식 표기가 남은 글 — WorkPlanInlineText 로 그린다 */
  text: string;
  tag?: string;
  task: { index: number; checked: boolean } | null;
}

export function memoLines(memo: string): MemoLine[] {
  let taskIndex = 0;
  return parseWorkPlanItems(memo)
    .filter((item) => item.text || item.isChecklist)
    .map((item) => ({
      key: item.id,
      text: item.text,
      tag: item.tag,
      task: item.isChecklist ? { index: taskIndex++, checked: item.completed } : null,
    }));
}

/** 칸에서 체크박스를 눌렀을 때 — 몇 번째(0부터) 체크박스를 뒤집은 본문 */
export function toggleMemoTask(memo: string, taskIndex: number): string {
  const doc = contentToEditorDoc(memo);
  let seen = 0;
  const flip = (node: EditorNode): EditorNode => {
    if (node.type === 'taskItem') {
      const hit = seen++ === taskIndex;
      return hit ? { ...node, attrs: { ...node.attrs, checked: !node.attrs?.checked } } : node;
    }
    return node.content ? { ...node, content: node.content.map(flip) } : node;
  };
  return memoToContent(editorDocToContent(flip(doc)));
}
