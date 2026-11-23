/*
  서식의 칸을 통째로 바꾸기 전에 낸 문서 알아내기.
  문서는 서식 칸의 사본을 갖고 있지 않아 문서 보기가 지금 서식으로 그려진다. 그래서 칸이 통째로 바뀌면
  이미 낸 문서에 빈 새 칸이 끼어든다. 문서에 든 값이 지금 서식의 칸과 하나도 맞지 않으면 옛 모양 문서로 보고
  - 문서 보기: 지금 서식의 칸을 그리지 않고 문서에 든 본문만 보여 준다
  - 다시 작성(회수·반려 뒤): 옛 칸의 값을 버리고 지금 서식으로 새로 쓴다
*/
import { RESERVED_BODY_KEY } from '@/domain/approvalForm/schema';

type Values = Record<string, unknown>;

const filled = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

/**
 * 옛 모양 문서면 지금 서식에 없는 칸의 키들, 아니면 빈 배열.
 * 옛 모양 = 지금 서식의 칸에는 값이 하나도 없고, 서식에 없는 칸에만 값이 있다.
 * 칸에 딸린 값(기간__end 등)은 그 칸의 값으로 치고, 안쪽 기록(__ 로 시작)은 세지 않는다
 */
export function staleValueKeys(fields: Array<{ key: string }> | null | undefined, values: Values | null | undefined): string[] {
  if (!fields || fields.length === 0 || !values) return [];
  const keys = new Set(fields.map((f) => f.key));
  const stale: string[] = [];
  for (const [k, v] of Object.entries(values)) {
    if (!filled(v) || k.startsWith('__')) continue;
    if (keys.has(k) || keys.has(k.split('__')[0])) return [];
    stale.push(k);
  }
  return stale;
}

/** 문서가 옛 모양인지 — 본문(doc.body)도 값으로 친다 */
export function staleDocKeys(
  fields: Array<{ key: string }> | null | undefined,
  doc: { body?: string | null; fieldValues?: Values | null }
): string[] {
  return staleValueKeys(fields, { ...(doc.fieldValues ?? {}), ...(filled(doc.body) ? { [RESERVED_BODY_KEY]: doc.body } : {}) });
}
