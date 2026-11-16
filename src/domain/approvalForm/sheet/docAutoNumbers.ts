/**
 * 상신 때 번호를 받을 자동번호 칸 — 이 문서 기준(서식 틀이 아니라 문서가 펼친 모양).
 * - 반복 구간에 기안자가 줄을 더했으면 그 아래 칸은 줄 수만큼 아래로 밀린 자리(문서 칸 값 키)에 번호를 넣는다
 * - 행 보이기 조건으로 숨은 행의 칸은 번호를 받지 않는다(기존 양식 '숨은 항목엔 안 매김'과 같음 — 순번이 헛돌지 않게)
 * 순번 채널(channelKey)은 서식 틀 기준 그대로라 문서마다 바뀌지 않는다.
 */
import { cellKey, type Sheet } from '@/lib/sheet/core';
import { DOC_NO_VALUE_KEY } from '@/domain/approvalDoc/docNo';
import { sheetAutoNumberCells, type SheetAutoNumberCell } from '@/domain/approvalForm/sheetAutoNumber';
import { SHEET_VALUES_KEY, applyValues, conditionHiddenRows, readSheetValues } from './approvalSheet';
import { SHEET_ROWS_KEY, expandRepeats, extraRowCount, readRowExtras, repeatSections } from './repeatRows';

export function docAutoNumberCells(template: Sheet | null | undefined, fieldValues: Record<string, unknown>): SheetAutoNumberCell[] {
  if (!template) return [];
  const cells = sheetAutoNumberCells(template);
  if (!cells.length) return [];
  const extras = readRowExtras(fieldValues[SHEET_ROWS_KEY]);
  const sections = repeatSections(template);
  /** 서식 틀 행 → 문서 행: 위쪽 반복 구간에 더한(지운) 줄 수만큼 */
  const docRow = (r: number) => r + sections.filter((x) => x.last < r).reduce((n, x) => n + extraRowCount(extras, x), 0);
  /** 서식 틀 행이 [행 삭제]로 지워졌나 — 구간의 그린 줄 중 아래에서 지운 줄 */
  const inRemovedRow = (r: number) =>
    sections.some((x) => {
      const n = extraRowCount(extras, x);
      return n < 0 && r > x.last + n && r <= x.last;
    });
  const doc = applyValues(expandRepeats(template, extras), readSheetValues(fieldValues[SHEET_VALUES_KEY]), { recalc: false });
  const hidden = conditionHiddenRows(doc);
  return cells
    .map((x) => {
      const r = docRow(x.r);
      return { ...x, r, key: cellKey(r, template.cols[x.c]) };
    })
    // 지운 줄에 있던 칸(반복 구간 안 자동번호 — 드묾)은 빼고
    .filter((x, i) => !hidden.has(x.r) && !inRemovedRow(cells[i].r))
}

/**
 * 자동번호 칸을 이 문서가 받은 번호로 맞춘다 — 저장된 문서(own)가 받은 번호는 되살리고, 그 밖의 번호(다른 문서의 것)는 지운다.
 * 보관해 둔 작성 내용을 불러오면 값이 통째로 바뀌어, 다른 문서의 번호가 넘어오거나(번호 겹침) 자기 번호가 사라진다(재상신 때 새 번호).
 * - 번호 칸은 순번 채널(channelKey — 서식 틀의 번호 칸 차례, 조건으로 숨은 칸과 상관없음)로 짝짓는다.
 *   own 의 번호 자리는 own 이 쓰던 틀(ownTemplate — 표 모양을 고친 문서는 그 틀, 아니면 own 이 쓴 서식 버전의 틀)로 찾는다
 * - own 의 틀을 모르면(ownTemplate 없음 — 다른 버전 보관본을 불러온 경우 등) 값으로 견준다: own 의 칸 값에 있는 번호면 자기 것으로 본다
 * - own 이 없으면(새 기안) 자동번호 칸은 모두 비운다. 바꿀 것이 없으면 받은 값을 그대로 돌려준다
 */
export function keepOwnAutoNumbers<T extends Record<string, unknown>>(
  template: Sheet | null | undefined,
  fieldValues: T,
  own: Record<string, unknown> | null | undefined,
  ownTemplate: Sheet | null | undefined,
): T {
  const cells = docAutoNumberCells(template, fieldValues);
  if (!cells.length) return fieldValues;
  const ownValues = readSheetValues(own?.[SHEET_VALUES_KEY]);
  // 저장된 문서가 번호 칸마다 받은 번호(순번 채널별) — 아직 안 받았으면 없음
  const received = new Map<string, string>();
  docAutoNumberCells(ownTemplate, own ?? {}).forEach((x) => ownValues[x.key] && received.set(x.channelKey, ownValues[x.key]));
  const anyOwn = new Set(Object.values(ownValues).filter(Boolean));
  const values = { ...readSheetValues(fieldValues[SHEET_VALUES_KEY]) };
  let changed = false;
  cells.forEach((x) => {
    const cur = values[x.key] ?? '';
    const mine = received.get(x.channelKey) || (!ownTemplate && anyOwn.has(cur) ? cur : '');
    if (cur === mine) return;
    if (mine) values[x.key] = mine;
    else delete values[x.key];
    changed = true;
  });
  if (!changed) return fieldValues;
  const next: Record<string, unknown> = { ...fieldValues, [SHEET_VALUES_KEY]: JSON.stringify(values) };
  // 번호를 문서번호로 보이게 하던 값도 이 문서 것으로 — 남의 문서번호가 목록에 보이지 않게(없으면 상신 때 새 번호로 채워진다)
  if (own?.[DOC_NO_VALUE_KEY]) next[DOC_NO_VALUE_KEY] = own[DOC_NO_VALUE_KEY];
  else delete next[DOC_NO_VALUE_KEY];
  return next as T;
}
