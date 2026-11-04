import { cellKey, type Sheet } from '@/lib/sheet';
import { autoNumberConfigSchema, DEFAULT_AUTO_NUMBER, type AutoNumberConfig } from './autoNumber';

/*
  시트 서식의 '자동번호' 칸 — 기존 서식 '자동번호' 항목과 같은 규칙(접두어·날짜·자릿수·초기화 주기)으로
  상신할 때 번호를 매겨 그 칸의 값(문서 fieldValues.__values)에 넣는다. 재상신은 받은 번호를 그대로 둔다.
  칸 속성 이름공간(cellMeta)과 문서 값 키는 시트 서식 저장 형식이라 바꾸지 말 것.
*/

/** 칸 속성 이름공간 — 값은 AutoNumberConfig */
export const SHEET_AUTO_NO_NS = 'autoNo';
/** 문서 fieldValues 의 칸 값 JSON 키(시트 서식 approvalSheet.SHEET_VALUES_KEY 와 같음) */
export const SHEET_CELL_VALUES_KEY = '__values';

export interface SheetAutoNumberCell {
  /** 칸 키 'r:열키' — 문서 칸 값 JSON 의 키 */
  key: string;
  r: number;
  c: number;
  config: AutoNumberConfig;
  /**
   * 순번 채널에 쓰는 칸 구분 — 시트 안 순서(위→아래, 왼→오른). 칸 주소는 행을 넣고 빼면 바뀌므로 쓰지 않는다
   * (주소로 하면 서식을 고칠 때마다 번호가 1부터 다시 시작)
   */
  channelKey: string;
}

/** 시트의 자동번호 칸 — 위에서 아래, 왼쪽에서 오른쪽 순서 */
export function sheetAutoNumberCells(s: Sheet | null | undefined): SheetAutoNumberCell[] {
  if (!s) return [];
  const rec = s.cellMeta[SHEET_AUTO_NO_NS] ?? {};
  const cells = Object.entries(rec)
    .map(([key, raw]) => {
      const i = key.indexOf(':');
      const r = Number(key.slice(0, i));
      const c = s.cols.indexOf(key.slice(i + 1));
      const parsed = autoNumberConfigSchema.safeParse(raw);
      return { key, r, c, config: parsed.success ? parsed.data : DEFAULT_AUTO_NUMBER };
    })
    .filter((x) => x.c >= 0 && x.r >= 0 && x.r < s.rows.length)
    .sort((a, b) => a.r - b.r || a.c - b.c);
  return cells.map((x, i) => ({ ...x, key: cellKey(x.r, s.cols[x.c]), channelKey: `sheet#${i + 1}` }));
}

/** 문서 칸 값 JSON 읽기(문자열 값만) */
export function readCellValues(raw: unknown): Record<string, string> {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
    return Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * 자동번호 칸에 번호 넣기 — 이미 번호가 있는 칸(재상신)은 그대로. next 는 칸마다 새 번호를 받아 온다.
 * 돌려주는 docNo 는 '문서번호로 표시' 칸의 번호(없으면 undefined).
 */
export async function fillSheetAutoNumbers(
  valuesJson: unknown,
  cells: SheetAutoNumberCell[],
  next: (cell: SheetAutoNumberCell) => Promise<string>,
): Promise<{ valuesJson: string; docNo?: string }> {
  const vals = readCellValues(valuesJson);
  let docNo: string | undefined;
  for (const cell of cells) {
    if (!vals[cell.key]) vals[cell.key] = await next(cell);
    if (cell.config.asDocNo && docNo === undefined) docNo = vals[cell.key];
  }
  return { valuesJson: JSON.stringify(vals), docNo };
}
