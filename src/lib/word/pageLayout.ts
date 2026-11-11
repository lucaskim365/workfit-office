/**
 * 쪽 배치 계산(화면과 무관한 순수 계산) — 재어 온 덩어리·줄 위치로 어디를 다음 장으로 밀지 정한다. 워드 기본 규칙을 따른다.
 * - 문단은 줄 단위로 나눈다. 외톨이 줄 방지: 첫 줄만 앞 장에 남으면 문단을 통째로, 마지막 줄만 넘어가면 한 줄 더 같이 넘긴다
 * - 제목은 다음 덩어리(이어진 제목들 포함)의 첫머리와 같은 장에 둔다(다음 문단과 함께)
 * - 나눌 수 없는 덩어리(표 행 묶음·그림 문단·목록 항목 등)는 통째로 넘긴다
 * - 이미 장 첫머리에 있는 것은 밀지 않는다(한 장보다 큰 덩어리·줄은 그대로 둔다 — 밀어도 들어가지 않으므로)
 *
 * 위치는 '밀기가 하나도 없을 때'의 자리(px, 첫 장 본문 위 = 0)다.
 */

export interface LayoutLine {
  top: number;
  bottom: number;
}

export interface LayoutItem {
  pos: number;
  kind: 'pad' | 'row';
  top: number;
  bottom: number;
  /** 줄 단위로 나눌 수 있는 문단의 줄들(두 줄 이상일 때만 나눈다) */
  lines?: LayoutLine[];
  /** 줄 첫 글자 앞 문서 위치 — 실제로 나눌 줄에서만 부른다(재는 비용이 커서) */
  lineStart?: (index: number) => number;
  /** 다음 덩어리와 같은 장에 둔다(제목) */
  keepWithNext?: boolean;
}

export type PushKind = 'pad' | 'row' | 'line';

export interface PagePush {
  /** pad·row: 덩어리 위치, line: 나눌 줄 첫 글자 위치 */
  pos: number;
  kind: PushKind;
  /** 밀 높이(px) */
  size: number;
}

/** 외톨이 줄 방지로 나눌 수 있는 최소 줄 수 — 앞 장 두 줄 + 다음 장 두 줄 */
const MIN_SPLIT_LINES = 4;
const EPS = 0.5;

export function layoutPages(items: LayoutItem[], pitch: number, contentH: number): { pushes: PagePush[]; pages: number } {
  const pageOf = (y: number) => Math.max(0, Math.floor((y + EPS) / pitch));
  const endOf = (page: number) => page * pitch + contentH;
  const atPageStart = (y: number) => Math.abs(y - pageOf(y) * pitch) <= EPS;
  /** 이 장 본문 아래 여백에 걸리거나, 틈(여백)에서 시작한다 */
  const overflows = (top: number, bottom: number) => top >= endOf(pageOf(top)) - EPS || bottom > endOf(pageOf(top)) + EPS;

  const pushes: PagePush[] = [];
  let offset = 0;
  let lastBottom = 0;

  /** y 에 있는 것을 다음 장 첫머리로 — 이미 장 첫머리면 밀지 않는다 */
  const push = (pos: number, kind: PushKind, y: number): boolean => {
    if (atPageStart(y)) return false;
    const size = Math.round((pageOf(y) + 1) * pitch - y);
    if (size <= 0) return false;
    pushes.push({ pos, kind, size });
    offset += size;
    return true;
  };
  const splittable = (it: LayoutItem) => !!it.lines && !!it.lineStart && it.lines.length >= 2;

  /** 이 덩어리 첫머리로 같은 장에 있어야 하는 부분의 아래 끝(밀기 전 자리) — 제목이 이어지면 그 뒤까지 */
  const leadBottom = (i: number): number => {
    const it = items[i];
    if (it.keepWithNext && items[i + 1]) return Math.max(it.bottom, leadBottom(i + 1));
    if (splittable(it) && it.lines!.length >= MIN_SPLIT_LINES) return it.lines![1].bottom;
    return it.bottom;
  };

  /** 문단을 줄 단위로 나눈다(한 장보다 긴 문단은 여러 번). 매번 한 줄 이상 나아가므로 끝난다 */
  const splitLines = (it: LayoutItem) => {
    const lines = it.lines!;
    let movedWhole = false;
    for (let j = 0; j < lines.length; ) {
      const lt = lines[j].top + offset;
      if (!overflows(lt, lines[j].bottom + offset) || atPageStart(lt)) {
        j++;
        continue;
      }
      // 넘길 첫 줄 — 마지막 한 줄만 넘어가면 한 줄 더 같이(앞 줄이 이 장 첫 줄이 아닐 때만)
      let k = j;
      if (k === lines.length - 1 && k > 0 && !atPageStart(lines[k - 1].top + offset)) k--;
      // 문단 첫 줄 하나만 앞 장에 남으면 문단을 통째로(처음 한 번만)
      if (k <= 1 && !movedWhole) {
        movedWhole = true;
        if (push(it.pos, it.kind, it.top + offset)) {
          j = 0;
          continue;
        }
      }
      push(it.lineStart!(k), 'line', lines[k].top + offset);
      j = Math.max(j, k) + 1;
    }
  };

  items.forEach((it, i) => {
    const top = it.top + offset;
    const bottom = it.bottom + offset;
    if (overflows(top, bottom)) {
      if (splittable(it) && top < endOf(pageOf(top)) - EPS) splitLines(it);
      else push(it.pos, it.kind, top);
    } else if (it.keepWithNext && items[i + 1]) {
      // 다음 덩어리 첫머리가 이 장에 못 들어가면 제목도 같이 넘긴다(같이 넘겨도 한 장에 안 들어가면 그대로)
      const lead = leadBottom(i + 1) + offset;
      if (lead - top <= contentH && lead > endOf(pageOf(top)) + EPS) push(it.pos, it.kind, top);
    }
    lastBottom = Math.max(lastBottom, it.bottom + offset);
  });

  return { pushes, pages: pageOf(Math.max(0, lastBottom - 1)) + 1 };
}
