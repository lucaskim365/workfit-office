/**
 * 기존 서식 → 시트 서식 초안 자동 변환(§11.17). 기존 서식은 읽기만 한다 — 결과는 새 서식으로 저장된다.
 *
 * - 항목은 [라벨 | 값] 칸으로: 반쪽(half) 항목은 한 줄에 둘, 한 줄(full) 항목은 값 칸을 끝까지 합침. 섹션은 제목 줄
 * - 입력 종류·금액 키·연동 칸 이름(휴가 기간 등)·비공개·대외 숨김을 옮긴다
 * - '표'는 칸·병합·굵게·정렬·회색 바탕을 옮기고 마지막 줄을 반복 구간으로(수식은 값만 — 경고)
 * - 직인·자동번호·회사정보·안내문은 시트 부품으로, 문서제목은 문서 정보 표의 제목 칸이 대신한다
 * - 맨 위·아래에 문서 머리 전체(로고·큰 제목·결재란·문서 정보·맺음말)를 넣는다
 */
import {
  applyBorder,
  colIndex,
  colLetter,
  parseNumber,
  applyStyle,
  createSheet,
  mergeRange,
  setCellValue,
  setRowMeta,
  type CellRange,
  type CellStyle,
  type Sheet,
} from '@/lib/sheet';
import type { ApprovalForm, FormField } from '@/domain/approvalForm/schema';
import { DEFAULT_AUTO_NUMBER } from '@/domain/approvalForm/autoNumber';
import { normalizeTablePayload } from '../formFields/sheetModel';
import { APPROVAL_NS, LINK_TYPES, approvalCellProps, linkTypeDef, rowConditionOf, setApprovalProp, setCellName, setRowCondition, type CellInputType } from '@/domain/approvalForm/sheet/approvalSheet';
import { setRepeatSection } from '@/domain/approvalForm/sheet/repeatRows';
import { insertDocHeader } from '@/domain/approvalForm/sheet/sheetHeader';

/** A4 인쇄 폭(SHEET_PAGE_WIDTH)과 같게 */
const PAGE = 718;
const LABEL_BG = '#f2f2f2';
const SECTION_BG = '#e8eef5';

const INPUT_OF: Partial<Record<FormField['type'], CellInputType>> = {
  텍스트: 'text',
  장문: 'multiline',
  숫자: 'number',
  금액: 'currency',
  날짜: 'date',
  기간: 'dateRange',
  선택: 'select',
  다중선택: 'multiSelect',
  체크: 'checkbox',
  사용자: 'user',
  부서: 'dept',
};

export interface LegacyConversion {
  sheet: Sheet;
  /** 대체 서식(연동 유형) — 기존 서식 코드가 연동 서식(휴가 등)이면 그 코드 */
  link: string | null;
  /** 옮기지 못했거나 손봐야 할 것 */
  warnings: string[];
}

/**
 * 기존 '표' 수식 → 시트 수식. 기존 수식은 표 안 좌표(A1 = 표 0번 줄 첫 열)·열 이름([금액])·SUM(ABOVE)·[줄 이름:열]을 쓴다.
 * 시트에선 표가 top 행부터 같은 열 순서로 놓이므로 행 번호만 top 만큼 민다(열 글자는 그대로).
 * 기존 엔진은 계산이 안 되면(0으로 나눔 등) 0 — 나눗셈이 든 식만 IFERROR(…,0)으로 감싼다. 백분율(percent1·2)은 식에 ×100 이 들어 있어
 * 시트 백분율 모양(값×100 에 %)에 맞게 ×100 을 뗀다(없으면 /100).
 * 열 이름은 열 키(금액)나 머리 줄 글자(인정거리) 어느 쪽이든. 다른 표는 [표 이름]![줄 이름:열] — 그 표가 놓인 자리(tables)를 알 때만.
 * 모르는 열·줄·표는 옮기지 못한다 — null
 */
export interface LegacyTableAt {
  /** 표 0번 줄이 놓인 시트 행(0부터) */
  top: number;
  cols: string[];
  rows: Array<Record<string, string>>;
  /** 표 열(0부터) → 그 열이 시작하는 시트 열. 없으면 표 열 자리 그대로(표 열 수 = 시트 열 수) */
  colAt?: number[];
}

/** 표 열이 놓인 시트 열 */
const sheetColOf = (t: LegacyTableAt, j: number) => t.colAt?.[j] ?? j;

/**
 * 표 열을 시트 열에 나눠 놓기 — 표 열이 시트 열보다 적을 때, 열마다 시트 열 몇 칸을 차지할지(합 = n).
 * 기존 양식의 열 너비 비율(weights)대로 나눈다 — 모든 열이 한 칸은 받고, 남는 칸은 비율이 큰 열부터.
 * 예전에는 앞 열들을 한 칸씩 두고 마지막 열이 남는 칸을 모두 덮어, 왼쪽 칸은 좁고 오른쪽 끝만 넓은 표가 됐다
 */
export function spreadColumns(weights: number[], n: number): number[] {
  const tc = weights.length;
  if (tc === 0) return [];
  if (tc >= n) return weights.map(() => 1);
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 1));
  const total = w.reduce((a, x) => a + x, 0);
  // 한 칸씩 먼저 주고, 나머지 칸을 비율대로(큰 나머지부터)
  const extra = n - tc;
  const ideal = w.map((x) => (x / total) * n - 1);
  const floor = ideal.map((x) => Math.max(0, Math.floor(x)));
  let left = extra - floor.reduce((a, x) => a + x, 0);
  const order = ideal.map((x, i) => ({ i, rest: x - floor[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % tc, left--) floor[order[k].i]++;
  // 한 칸 보장 때문에 넘치면(아주 좁은 열이 많을 때) 가장 넓은 열에서 덜어 낸다
  for (; left < 0; left++) floor[floor.indexOf(Math.max(...floor))]--;
  return floor.map((x) => x + 1);
}

/** 너비를 정해 두지 않은 열의 어림 범위(px) — 빈 입력 열도 금액 하나는 들어가게, 긴 글 열이 다른 열을 한 칸으로 밀어내지 않게(최소의 3배까지) */
const AUTO_COL_MIN = 100;
const AUTO_COL_MAX = 300;

/**
 * 기존 표 열의 너비 어림(px) — 정해 둔 너비가 있으면 그 값, 없으면(자동 너비) 그 열에서 가장 긴 글자 길이로.
 * 여러 열을 합친 칸의 글자는 보지 않는다(한 열의 너비가 아니다 — '본 발주금액 (VAT 포함)'처럼 두 열에 걸친 이름표)
 */
function legacyColWeight(
  t: { cols: string[]; rows: Array<Record<string, string>>; colWidths: Record<string, string>; merges: Array<{ startRow: number; startCol: number; rowSpan: number; colSpan: number }> },
  col: string
): number {
  const set = parseFloat(t.colWidths[col] ?? '');
  if (Number.isFinite(set) && set > 0) return set;
  const c = t.cols.indexOf(col);
  const wide = (r: number) => t.merges.some((m) => m.colSpan > 1 && r >= m.startRow && r < m.startRow + m.rowSpan && c >= m.startCol && c < m.startCol + m.colSpan);
  const longest = Math.max(0, ...t.rows.map((row, r) => (wide(r) ? 0 : Math.max(0, ...String(row[col] ?? '').split(/\r?\n/).map((line) => line.length)))));
  return Math.min(AUTO_COL_MAX, Math.max(AUTO_COL_MIN, longest * 13 + 16));
}

/** 표 열 자리 — 열 키 또는 머리 줄(0번 줄) 글자 */
function tableColOf(t: LegacyTableAt, name: string): number {
  const n = name.trim();
  const byKey = t.cols.indexOf(n);
  return byKey >= 0 ? byKey : t.cols.findIndex((c) => String(t.rows[0]?.[c] ?? '').trim() === n);
}

export function translateLegacyFormula(
  expression: string | undefined,
  at: LegacyTableAt & {
    /** 수식이 든 표 줄(0부터)·열 이름 — [열]·SUM(ABOVE) 의 기준 */
    r: number;
    col: string;
    /** 다른 표 — 표 이름(항목 라벨) → 놓인 자리 */
    tables?: ReadonlyMap<string, LegacyTableAt>;
  },
  format?: string
): string | null {
  let expr = String(expression ?? '').trim().replace(/^=/, '');
  if (!expr) return null;
  const sheetRow = (tableRow: number) => at.top + tableRow + 1; // 표 줄(0부터) → 시트 행 번호(1부터)
  const colOf = (name: string) => tableColOf(at, name);
  let failed = false;
  // 다른 표 [표]![줄:열] → 그 표 칸 주소. 아래 표 안 좌표 변환이 이 주소를 또 밀지 않게 자리표(@@0@@)로 두었다가 끝에 넣는다
  const outside: string[] = [];
  expr = expr.replace(/\[([^\]]+)\]\s*!\s*\[([^\]]+)\]/g, (m, table: string, ref: string) => {
    const t = at.tables?.get(table.trim());
    const k = ref.indexOf(':');
    const j = t && k >= 0 ? tableColOf(t, ref.slice(k + 1)) : -1;
    const rr = t && k >= 0 ? t.rows.findIndex((row) => String(row[t.cols[0]] ?? '').trim() === ref.slice(0, k).trim()) : -1;
    if (!t || j < 0 || rr < 0) {
      failed = true;
      return m;
    }
    outside.push(`${colLetter(sheetColOf(t, j))}${t.top + rr + 1}`);
    return `@@${outside.length - 1}@@`;
  });
  if (failed || expr.includes('!')) return null;
  expr = expr.replace(
    /SUM\s*\(\s*ABOVE\s*\)|SUM\s*\(\s*\[([^\]]+)\]\s*\)|\[([^\]]+)\]|\b([A-Z]{1,3})(\d+)\b/gi,
    (m, sumCol: string | undefined, bracket: string | undefined, L: string | undefined, num: string | undefined) => {
      const fail = () => {
        failed = true;
        return m;
      };
      // 위쪽 모두 합 — 같은 열(또는 지정 열)의 표 0번 줄부터 바로 위 줄까지
      if (/^SUM/i.test(m)) {
        const j = sumCol !== undefined ? colOf(sumCol) : at.cols.indexOf(at.col);
        if (j < 0) return fail();
        const L = colLetter(sheetColOf(at, j));
        return at.r === 0 ? '0' : `SUM(${L}${sheetRow(0)}:${L}${sheetRow(at.r - 1)})`;
      }
      if (bracket !== undefined) {
        // [줄 이름:열] — 첫 열이 그 이름인 줄의 그 열, [열] — 같은 줄의 그 열
        const k = bracket.indexOf(':');
        if (k >= 0) {
          const label = bracket.slice(0, k).trim();
          const j = colOf(bracket.slice(k + 1));
          const rr = at.rows.findIndex((row) => String(row[at.cols[0]] ?? '').trim() === label);
          if (j < 0 || rr < 0) return fail();
          return `${colLetter(sheetColOf(at, j))}${sheetRow(rr)}`;
        }
        const j = colOf(bracket);
        if (j < 0) return fail();
        return `${colLetter(sheetColOf(at, j))}${sheetRow(at.r)}`;
      }
      // 표 안 좌표 A1 — 표 열 글자를 그 열이 놓인 시트 열로, 행은 표 자리만큼 민다
      const n = Number(num);
      if (!L || !Number.isFinite(n) || n < 1) return fail();
      const tj = colIndex(L.toUpperCase());
      return `${colLetter(tj < at.cols.length ? sheetColOf(at, tj) : tj)}${at.top + n}`;
    }
  );
  if (failed) return null;
  expr = expr.replace(/@@(\d+)@@/g, (_, i: string) => outside[Number(i)]);
  if (format === 'percent1' || format === 'percent2') {
    const dropped = expr.replace(/\s*\*\s*100\s*$/, '');
    // ×100 이 없는 식: 백분율 칸들의 합(소계 비중 =SUM(ABOVE))은 이미 시트 백분율 값이라 그대로, 그 밖은 /100
    const sumOnly = /^\s*SUM\([^()]*\)\s*$/i.test(expr);
    expr = dropped !== expr ? dropped : sumOnly ? expr : `(${expr})/100`;
  }
  // 나눗셈만 IFERROR — 기존 엔진은 계산이 안 되면 0, 시트는 #DIV/0! 를 띄우므로(비율 칸에 아직 분모를 안 쓴 때).
  // 더하기·곱하기는 빈 칸을 0으로 계산하므로 감싸지 않는다(감싸면 칸 주소를 잘못 쓴 #REF! 같은 진짜 오류까지 0으로 숨겨짐)
  return expr.includes('/') ? `=IFERROR(${expr},0)` : `=${expr}`;
}

/**
 * 기존 '표'에서 기안자가 줄을 더하고 지우던 곳 — 품목 줄: 빈 칸이 있고 미리 쓴 글자가 칸의 절반이 안 되는 줄.
 * 같은 모양(칸마다 수식·빈 칸·같은 글자)의 품목 줄이 두 줄 넘게 이어지는 마지막 묶음 전체 — 줄 번호(1·2·3…)는 빈 칸으로 보고,
 * 줄마다 똑같이 미리 써 둔 글자('2026.', '-')는 같은 모양으로 본다(품목 1~8 뒤에 합계 줄이 오는 발주 세부내역 → 1~8번 줄 —
 * 기안자가 [행 삭제]로 안 쓰는 품목 줄을 아래부터 지운다). 데이터 줄이 하나뿐이고 품목 줄이면 그 줄(빈 줄 하나로 시작하는 품목 표).
 * 줄마다 이름표가 다른 표(선급금·중도금·잔금, 작성일·상호 같은 라벨·값 표, 합계 줄, 직인란)는 품목 줄이 아니다 — 반복 구간 없음
 */
export function legacyRepeatRows(
  t: { cols: string[]; rows: Array<Record<string, string>>; cellFormulas: Record<string, unknown> },
  headerRows: number
): { first: number; last: number } | null {
  const data = t.rows.map((_, i) => i).filter((i) => i >= headerRows);
  /** 칸 모양 — 수식(f)·빈 칸이나 줄 번호(_)·미리 쓴 글자(t:글자) */
  const kind = (i: number, c: string) => {
    if (t.cellFormulas[`${i}:${c}`]) return 'f';
    const v = String(t.rows[i][c] ?? '').trim();
    return v === '' || /^\d+$/.test(v) ? '_' : `t:${v}`;
  };
  const shape = (i: number) => t.cols.map((c) => kind(i, c)).join('|');
  const itemRow = (i: number) => {
    const texts = t.cols.filter((c) => kind(i, c).startsWith('t:')).length;
    const blanks = t.cols.filter((c) => !t.cellFormulas[`${i}:${c}`] && !String(t.rows[i][c] ?? '').trim()).length;
    return blanks > 0 && texts * 2 < t.cols.length;
  };
  if (data.length === 1) return itemRow(data[0]) ? { first: data[0], last: data[0] } : null;
  for (let k = data.length - 1; k >= 1; k--) {
    const [b, c] = [data[k - 1], data[k]];
    if (shape(b) === shape(c) && itemRow(b) && itemRow(c)) {
      // 같은 모양 품목 줄이 위로 이어지는 데까지
      let first = k - 1;
      while (first - 1 >= 0 && shape(data[first - 1]) === shape(c) && itemRow(data[first - 1])) first--;
      return { first: data[first], last: c };
    }
  }
  return null;
}

/**
 * 좌우로 나란히 놓을 표 짝 — 같은 구역에서 잇달아 나오는 반쪽 너비(half) 표 둘. 기존 양식이 한 줄에 둘씩 보이던 표다.
 * 행을 함께 쓰므로 행 단위 설정(보이기 조건·대외 숨김)이 같은 표끼리만 짝짓는다. 짝 없는 반쪽 표는 전체 폭으로 놓인다
 */
export function legacyTablePairs(fields: FormField[]): Map<FormField, FormField> {
  const halfTable = (f: FormField) => f.type === '표' && f.width === 'half';
  const sameRowRules = (a: FormField, b: FormField) => (a.visibleIf ?? '') === (b.visibleIf ?? '') && !!a.hideOnExternal === !!b.hideOnExternal;
  const bySection = new Map<string, FormField[]>();
  fields.forEach((f) => bySection.set(f.section ?? '', [...(bySection.get(f.section ?? '') ?? []), f]));
  const pairs = new Map<FormField, FormField>();
  for (const list of bySection.values()) {
    for (let i = 0; i + 1 < list.length; i++) {
      if (halfTable(list[i]) && halfTable(list[i + 1]) && sameRowRules(list[i], list[i + 1])) {
        pairs.set(list[i], list[i + 1]);
        i++;
      }
    }
  }
  return pairs;
}

export function legacyFormToSheet(form: ApprovalForm): LegacyConversion {
  const warnings: string[] = [];
  const fields = form.fields ?? [];
  // 연동 기능은 옛 항목 키가 연동 칸 이름과 같을 때만 잇는다(휴가원 period·leaveType 등 — 그 칸에 이름이 저절로 붙는다).
  // 발주서처럼 코드는 같아도 옮길 칸이 없으면 잇지 않는다 — 연동만 켜지고 이름 붙은 칸이 없는 서식이 되지 않게(관리자가 칸에 이름을 붙이며 켠다)
  const candidate = LINK_TYPES.find((t) => t.code === form.code);
  const link = candidate && fields.some((f) => candidate.names.some((n) => n.key === f.key)) ? candidate.code : null;
  const linkNames = new Set(linkTypeDef(link)?.names.map((n) => n.key) ?? []);
  // 기존 서식이 숨긴 문서 머리 항목 — 공문처럼 머리를 거의 다 끈 서식은 그 모양 그대로
  const hiddenHead = new Set(form.hiddenHeaderItems ?? []);
  const INFO_ITEMS = ['docNo', 'drafterDept', 'drafter', 'draftDate', 'preservation', 'visibility'];
  const withInfo = !INFO_ITEMS.every((i) => hiddenHead.has(i));

  // 열 수 — 표가 넓으면 표에 맞춘다(최소 4: 라벨·값·라벨·값). 나란히 놓는 표는 절반 폭에 들어가야 하므로 그 열 수의 두 배
  const colsOf = (f: FormField) => normalizeTablePayload(f.placeholder).cols.length;
  const tableCols = fields.filter((f) => f.type === '표').map(colsOf);
  const pairs = legacyTablePairs(fields);
  const pairCols = [...pairs].map(([a, b]) => 2 * Math.max(colsOf(a), colsOf(b)));
  const widest = Math.max(4, ...tableCols, ...pairCols);
  // 나란히 놓는 표가 있으면 짝수 열로(좌우 절반이 같은 칸 수)
  const n = pairs.size && widest % 2 ? widest + 1 : widest;
  const mid = Math.floor(n / 2);
  let s = createSheet(1, n);
  s = { ...s, colWidths: Object.fromEntries(s.cols.map((c) => [c, Math.floor(PAGE / n)])) };
  let row = 0;
  /** 다음 줄 — 시트를 한 줄 늘려 그 번호를 준다 */
  const nextRow = () => {
    // 맨 끝에 빈 줄을 덧붙인다 — insertRow 는 '범위 바로 다음 삽입 = 범위가 늘어남'(엑셀과 같음)이라
    // 방금 넣은 합계 수식(=SUM(C17:K17))의 범위가 줄을 붙일 때마다 늘어난다. 끝에 붙이는 건 아무것도 밀지 않으므로 그냥 붙인다
    if (row >= s.rows.length) s = { ...s, rows: [...s.rows, Object.fromEntries(s.cols.map((c) => [c, '']))] };
    return row++;
  };
  const span = (r: number, c1: number, c2: number): CellRange => ({ r1: r, r2: r, c1, c2 });
  const merge = (r: number, c1: number, c2: number) => {
    if (c2 > c1) s = mergeRange(s, span(r, c1, c2));
  };
  const label = (r: number, c: number, text: string) => {
    s = setCellValue(s, r, c, text, { allowFormula: false });
    s = applyStyle(s, span(r, c, c), { bold: true, bg: LABEL_BG, align: 'center' });
  };
  /** 값 칸 — 항목 종류에 맞는 부품·이름·비공개 */
  const value = (r: number, c1: number, c2: number, f: FormField) => {
    merge(r, c1, c2);
    if (!valueAt.has(f.key)) valueAt.set(f.key, { r, c: c1 });
    const at = span(r, c1, c1);
    const input = INPUT_OF[f.type];
    if (input) {
      const options = input === 'select' || input === 'multiSelect' ? { options: f.options ?? [] } : {};
      s = setApprovalProp(s, at, APPROVAL_NS.input, { type: input, ...options });
      // 금액은 천 단위 쉼표·오른쪽 정렬(기존 양식처럼 35,000)
      if (input === 'currency') s = applyStyle(s, at, { numFmt: 'currency', align: 'right' });
      if (f.required) s = setApprovalProp(s, at, APPROVAL_NS.required, true);
    } else if (f.type === '자동번호') {
      // 같은 서식 코드에 붙이므로 그 항목의 순번을 이어 쓴다(1번부터 다시 시작하지 않게)
      s = setApprovalProp(s, at, APPROVAL_NS.autoNo, { ...(f.autoNumber ?? DEFAULT_AUTO_NUMBER), channelKey: f.key });
    }
    // 금액 키 → 결재선 금액, 연동 서식의 연동 칸(휴가 기간 등)은 같은 이름
    if (f.type === '금액' && f.isAmountKey) s = setCellName(s, r, c1, 'amount');
    else if (linkNames.has(f.key)) s = setCellName(s, r, c1, f.key);
    // 선택 항목은 기존 키 그대로 — 결재선 규칙 조건(예: 지출결의 expenseItem = 식대)이 이 키로 값을 읽는다
    else if (f.type === '선택' || f.type === '다중선택') s = setCellName(s, r, c1, f.key);
    if (f.isSecret) s = setApprovalProp(s, at, APPROVAL_NS.secret, true);
    if (f.type === '장문') s = { ...s, rowHeights: { ...s.rowHeights, [String(r)]: 80 } };
  };
  const box = (r1: number, r2: number) => (s = applyBorder(s, { r1, r2, c1: 0, c2: n - 1 }, 'all'));
  const extHide = (r: number, f: FormField) => {
    if (f.hideOnExternal) s = setRowMeta(s, APPROVAL_NS.extHide, r, true);
  };

  /** 품목 줄(반복 구간)을 못 찾은 표 — 경고 한 줄로 모은다 */
  const noRepeat: string[] = [];
  /** 조건부 항목이 만든 행 — 다 놓은 뒤 행 보이기 조건으로 */
  const condRows: { r: number; visibleIf: string }[] = [];
  /** 항목 키 → 값 칸(조건 칸에 이름을 붙이려고) */
  const valueAt = new Map<string, { r: number; c: number }>();
  /** 표 이름(항목 라벨) → 놓인 자리 — 다른 표를 가리키는 수식용 */
  const tables = new Map<string, LegacyTableAt>();
  /** 아래에 놓일 표를 가리켜 아직 못 옮긴 수식 — 표를 다 놓은 뒤 다시 */
  const deferred: { r: number; j: number; expr: string; format?: string; at: LegacyTableAt & { r: number; col: string }; table: string }[] = [];
  /** 옮긴 수식을 칸에 — 금액·백분율 모양 */
  const putFormula = (r: number, j: number, formula: string, format?: string) => {
    s = setCellValue(s, r, j, formula);
    const numFmt = format === 'currency' ? 'currency' : format === 'percent1' || format === 'percent2' ? 'percent' : undefined;
    if (numFmt) s = applyStyle(s, span(r, j, j), { numFmt });
  };

  // 섹션 순서대로
  const sections: string[] = [];
  fields.forEach((f) => !sections.includes(f.section ?? '') && sections.push(f.section ?? ''));
  let pendingHalf: FormField | null = null;
  let halfRow = -1;
  /** 짝을 못 찾은 반쪽 항목 — 값 칸을 줄 끝까지 넓힌다(오른쪽 절반이 이름 없는 빈 칸으로 남지 않게) */
  const flushHalf = () => {
    if (pendingHalf) {
      s = { ...s, merges: s.merges.filter((m) => !(m.startRow === halfRow && m.startCol === 1)) };
      merge(halfRow, 1, n - 1);
    }
    pendingHalf = null;
  };

  /**
   * 종속 선택으로 합칠 항목 묶음 — 같은 선택 칸(상위)의 값마다 하나씩 보이던 같은 이름의 선택 항목들
   * (지출결의 '분류': 식대면 sort_meal, 운반비면 sort_carr …). 칸 하나에 갈래별 항목으로 넣고, 상위 칸 오른쪽에 둔다
   */
  const parentOf = (f: FormField) => {
    const at = f.visibleIf?.indexOf(':') ?? -1;
    return at > 0 ? { key: f.visibleIf!.slice(0, at), when: f.visibleIf!.slice(at + 1) } : null;
  };
  const groups = new Map<string, FormField[]>();
  fields.forEach((f) => {
    const p = parentOf(f);
    const parent = p && fields.find((x) => x.key === p.key);
    if (f.type !== '선택' || !p || !parent || parent.type !== '선택') return;
    const id = `${p.key}|${f.section ?? ''}|${f.label}`;
    groups.set(id, [...(groups.get(id) ?? []), f]);
  });
  [...groups].forEach(([id, list]) => list.length < 2 && groups.delete(id));
  /** 묶인 항목 키 → 묶음 */
  const groupOf = new Map<string, FormField[]>();
  groups.forEach((list) => list.forEach((f) => groupOf.set(f.key, list)));

  /** 종속 선택 칸 하나 — 상위 칸이 반쪽 줄에 홀로 있으면 그 오른쪽, 아니면 새 줄 */
  function placeDependent(list: FormField[]) {
    const first = list[0];
    const parentKey = parentOf(first)!.key;
    const depends = {
      name: parentKey,
      branches: list.map((f) => ({ when: parentOf(f)!.when, options: f.options ?? [], key: f.key })),
    };
    const input = { type: 'select' as const, options: [...new Set(list.flatMap((f) => f.options ?? []))], depends };
    const put = (r: number, c1: number, c2: number) => {
      merge(r, c1, c2);
      const at = span(r, c1, c1);
      s = setApprovalProp(s, at, APPROVAL_NS.input, input);
      if (list.some((f) => f.required)) s = setApprovalProp(s, at, APPROVAL_NS.required, true);
      if (list.some((f) => f.isSecret)) s = setApprovalProp(s, at, APPROVAL_NS.secret, true);
    };
    if (pendingHalf && pendingHalf.key === parentKey) {
      label(halfRow, mid, first.label);
      put(halfRow, mid + 1, n - 1);
      pendingHalf = null;
      return;
    }
    flushHalf();
    const r = nextRow();
    label(r, 0, first.label);
    put(r, 1, n - 1);
    box(r, r);
    if (list.every((f) => f.hideOnExternal)) s = setRowMeta(s, APPROVAL_NS.extHide, r, true);
  }

  /** 항목 하나를 시트 줄로 */
  function placeField(f: FormField) {
    const group = groupOf.get(f.key);
    if (group) {
      if (group[0] === f) placeDependent(group);
      return;
    }
    // 문서 제목은 문서 정보 표의 제목 칸이 맡는다(문서 정보 표를 안 넣는 서식은 이 자리에 제목 칸)
    if (f.type === '문서제목') {
      if (withInfo) return;
      flushHalf();
      const r = nextRow();
      label(r, 0, f.label || '제목');
      merge(r, 1, n - 1);
      s = setApprovalProp(s, span(r, 1, 1), APPROVAL_NS.bind, 'doc.title');
      s = applyStyle(s, span(r, 1, 1), { bold: true });
      box(r, r);
      // 기존 항목의 '대외 문서에서 숨김'을 따른다(공문처럼 본문 제목을 거래처 문서에도 보이는 서식은 그대로 보임)
      extHide(r, f);
      return;
    }
    if (f.type === '안내문') {
      flushHalf();
      const r = nextRow();
      merge(r, 0, n - 1);
      s = setCellValue(s, r, 0, f.placeholder || f.label, { allowFormula: false });
      s = setApprovalProp(s, span(r, 0, 0), APPROVAL_NS.guide, true);
      return;
    }
    if (f.type === '회사정보') {
      flushHalf();
      const r = nextRow();
      merge(r, 0, n - 1);
      s = setApprovalProp(s, span(r, 0, 0), APPROVAL_NS.bind, 'doc.letterhead');
      extHide(r, f);
      return;
    }
    if (f.type === '직인') {
      flushHalf();
      const r = nextRow();
      merge(r, 0, n - 2);
      s = setCellValue(s, r, 0, f.label, { allowFormula: false });
      s = applyStyle(s, span(r, 0, 0), { bold: true, align: 'right', fontSize: 15 });
      s = setApprovalProp(s, span(r, n - 1, n - 1), APPROVAL_NS.seal, true);
      if (f.markId) s = setApprovalProp(s, span(r, n - 1, n - 1), APPROVAL_NS.sealMark, f.markId);
      s = { ...s, rowHeights: { ...s.rowHeights, [String(r)]: 76 } };
      return;
    }
    if (f.type === '표') {
      flushHalf();
      placeTable(f);
      return;
    }
    // 라벨·값 항목 — 반쪽은 한 줄에 둘
    if (f.width === 'half' && f.type !== '장문') {
      if (pendingHalf && (pendingHalf.visibleIf ?? null) === (f.visibleIf ?? null)) {
        label(halfRow, mid, f.label);
        value(halfRow, mid + 1, n - 1, f);
        extHide(halfRow, f);
        pendingHalf = null;
        return;
      }
      flushHalf();
      const r = nextRow();
      label(r, 0, f.label);
      value(r, 1, mid - 1, f);
      // 짝이 없으면 오른쪽 절반은 빈 라벨·값으로 남는다(테두리는 줄 전체)
      box(r, r);
      extHide(r, f);
      pendingHalf = f;
      halfRow = r;
      return;
    }
    flushHalf();
    const r = nextRow();
    label(r, 0, f.label);
    value(r, 1, n - 1, f);
    box(r, r);
    extHide(r, f);
  }

  for (const section of sections) {
    flushHalf();
    if (section) {
      const r = nextRow();
      merge(r, 0, n - 1);
      s = setCellValue(s, r, 0, section, { allowFormula: false });
      s = applyStyle(s, span(r, 0, 0), { bold: true, bg: SECTION_BG });
      box(r, r);
      const conds = new Set(fields.filter((x) => (x.section ?? '') === section).map((x) => x.visibleIf ?? ''));
      const only = conds.size === 1 ? [...conds][0] : '';
      if (only) condRows.push({ r, visibleIf: only });
    }
    const placedAsPartner = new Set<FormField>();
    for (const f of fields.filter((x) => (x.section ?? '') === section)) {
      if (placedAsPartner.has(f)) continue;
      const before = row;
      const partner = pairs.get(f);
      if (partner) {
        // 반쪽 너비 표 둘 — 기존 양식처럼 좌우로 나란히
        flushHalf();
        placeTablePair(f, partner);
        placedAsPartner.add(partner);
      } else placeField(f);
      // 조건부 항목(visibleIf '키:값') — 이 항목이 만든 행에 행 보이기 조건
      // 종속 선택으로 합친 항목은 조건 대신 갈래로(그 칸은 늘 보이고 항목만 바뀜)
      if (f.visibleIf && !groupOf.has(f.key)) for (let r = before; r < row; r++) condRows.push({ r, visibleIf: f.visibleIf });
    }
  }
  flushHalf();

  /**
   * 반쪽 너비 표 둘을 좌우로 나란히 — 같은 행에서 시작해 왼쪽 절반·오른쪽 절반에 놓는다(계약보고서 매출구분 | 매입구분).
   * 시트는 행을 함께 쓰므로 줄 추가(반복 구간)는 두 표의 품목 줄 범위가 같을 때만 둔다 — 한쪽만 늘릴 수는 없다
   */
  function placeTablePair(a: FormField, b: FormField): void {
    const start = row;
    const titleRow = !!(a.label || b.label);
    const left = placeTable(a, { c1: 0, w: mid, paired: true, titleRow });
    const leftEnd = row;
    row = start;
    const right = placeTable(b, { c1: mid, w: n - mid, paired: true, titleRow });
    row = Math.max(leftEnd, row);
    const names = [a.label, b.label].filter(Boolean).join('·') || '반복 구간';
    if (left.repeat && right.repeat && left.repeat.first === right.repeat.first && left.repeat.last === right.repeat.last) {
      s = setRepeatSection(s, left.repeat.first, left.repeat.last, names);
    } else if (left.repeat || right.repeat) {
      warnings.push(`나란히 놓은 표 '${names}'는 줄을 더하던 곳이 서로 달라 [행 추가] 구간을 두지 않았습니다(행을 함께 쓰므로 한쪽만 늘릴 수 없음) — 필요하면 두 표를 위아래로 옮긴 뒤 반복 구간으로 지정하세요.`);
    }
  }

  /**
   * '표' — 제목 줄 + 표 칸(병합·굵게·정렬·회색 바탕), 빈 칸은 입력 칸, 마지막 줄은 반복 구간.
   * at: 놓을 시트 열 범위(c1 부터 w 칸 — 기본은 시트 전체 폭). paired 면 반복 구간은 두지 않고 찾은 줄 범위(시트 행)만 돌려준다.
   * titleRow: 제목이 없어도 제목 줄 자리를 비운다(나란한 표와 첫 줄을 맞추려고)
   */
  function placeTable(
    f: FormField,
    at: { c1: number; w: number; paired?: boolean; titleRow?: boolean } = { c1: 0, w: n }
  ): { repeat: { first: number; last: number } | null } {
    const t = normalizeTablePayload(f.placeholder);
    const c1 = at.c1;
    const c2 = at.c1 + at.w - 1;
    if (f.label) {
      const r = nextRow();
      merge(r, c1, c2);
      s = setCellValue(s, r, c1, f.label, { allowFormula: false });
      s = applyStyle(s, span(r, c1, c1), { bold: true });
      // 표째 대외 숨김이면 제목 줄도(제목만 덩그러니 남지 않게)
      extHide(r, f);
    } else if (at.titleRow) nextRow();
    const top = row;
    // 표 열이 놓을 폭보다 적으면 기존 양식의 열 너비 비율대로 시트 열에 나눠 놓는다(spreadColumns)
    const spans = spreadColumns(t.cols.map((c) => legacyColWeight(t, c)), at.w);
    const colAt = spans.map((_, j) => c1 + spans.slice(0, j).reduce((a, x) => a + x, 0));
    const colEnd = (j: number) => colAt[j] + spans[j] - 1;
    if (f.label) tables.set(f.label.trim(), { top, cols: t.cols, rows: t.rows, colAt });
    const headerRows = t.legacyHeaderRow || t.cols.some((c) => t.cellStyles[`0:${c}`]?.bold) ? 1 : 0;
    const repeat = legacyRepeatRows(t, headerRows);
    /** 금액 수식(소계 등)이 든 열 — 그 열의 빈 입력 칸도 금액(쉼표)으로. 기존 표는 입력 칸에 금액 서식을 안 건 경우가 많다 */
    const currencyCols = new Set(
      Object.entries(t.cellFormulas)
        .filter(([, v]) => (v as { format?: string } | undefined)?.format === 'currency')
        .map(([k]) => k.slice(k.indexOf(':') + 1))
    );
    const untranslated: string[] = [];
    t.rows.forEach((tr, i) => {
      const r = nextRow();
      t.cols.forEach((tcol, tj) => {
        /** 이 칸이 놓이는 시트 열(여러 칸을 차지하면 합친다) */
        const j = colAt[tj];
        if (colEnd(tj) > j) merge(r, j, colEnd(tj));
        const text = String(tr[tcol] ?? '');
        const legacyFormula = t.cellFormulas[`${i}:${tcol}`] ?? (t.sumCell && t.sumCell.rIdx === i && t.sumCell.col === tcol ? { expression: '=SUM(ABOVE)' } : undefined);
        const at = { r: i, col: tcol, top, cols: t.cols, rows: t.rows, colAt };
        const formula = legacyFormula ? translateLegacyFormula(legacyFormula.expression, { ...at, tables }, legacyFormula.format) : null;
        if (formula) putFormula(r, j, formula, legacyFormula?.format);
        else {
          // 다른 표를 가리키는 식은 그 표가 아래에 있을 수 있어 표를 다 놓은 뒤 다시(그동안은 값)
          const expr = String(legacyFormula?.expression ?? '');
          if (legacyFormula && expr.includes('!')) deferred.push({ r, j, expr, format: legacyFormula.format, at, table: f.label || '표' });
          else if (legacyFormula) untranslated.push(`${colLetter(j)}${r + 1}`);
          if (text) s = setCellValue(s, r, j, text, { allowFormula: false });
        }
        const st = t.cellStyles[`${i}:${tcol}`];
        const patch: Partial<CellStyle> = {};
        if (st?.bold) patch.bold = true;
        // 금액·숫자 칸(금액 입력·금액/백분율 수식)은 오른쪽 정렬 — 기존 표는 칸을 모두 가운데로 두어 자릿수가 세로로 안 맞았다
        const numericCell = formula
          ? legacyFormula?.format === 'currency' || legacyFormula?.format === 'percent1' || legacyFormula?.format === 'percent2'
          : !legacyFormula && !st?.seal && st?.numFmt === 'currency' && (!text || parseNumber(text) !== null);
        if (numericCell) patch.align = 'right';
        else if (st?.align) patch.align = st.align;
        if (st?.bg === 'gray') patch.bg = LABEL_BG;
        if (st?.numFmt && st.numFmt !== 'general') patch.numFmt = st.numFmt;
        if (Object.keys(patch).length) s = applyStyle(s, span(r, j, j), patch);
        if (st?.seal) s = setApprovalProp(s, span(r, j, j), APPROVAL_NS.seal, true);
        // 입력 칸 — 수식·직인 칸이 아닌 표 칸 전부(머리 줄·미리 쓴 글자 칸 포함, 미리 쓴 글자는 기본값으로 남음).
        // 기존 '표'는 칸을 모두 고칠 수 있었고, 운영 문서를 보면 기안자가 실제로 많이 고쳐 썼다
        // (발주서 수주자·날짜·담당자 자리, 계약보고서 매출·매입 분류 이름 등) — 고정하면 지금처럼 못 쓴다
        if (!legacyFormula && !st?.seal) {
          // 금액 서식은 숫자 칸에만 — 기존 표는 줄·열째 금액 서식을 걸어 '매출(원)'·'단가' 같은 이름표 칸에도 붙어 있다
          // (금액 입력 칸이 되면 글자라서 '숫자가 아님'으로 빨갛게 뜬다)
          const numeric = !text || parseNumber(text) !== null;
          const currency = numeric && (st?.numFmt === 'currency' || (!text && i >= headerRows && currencyCols.has(tcol)));
          s = setApprovalProp(s, span(r, j, j), APPROVAL_NS.input, { type: currency ? 'currency' : 'text' });
          if (currency && st?.numFmt !== 'currency') s = applyStyle(s, span(r, j, j), { numFmt: 'currency', align: 'right' });
        }
      });
      if (f.hideOnExternal) s = setRowMeta(s, APPROVAL_NS.extHide, r, true);
    });
    // 표 안 병합
    t.merges.forEach((m) => {
      s = mergeRange(s, { r1: top + m.startRow, r2: top + m.startRow + m.rowSpan - 1, c1: colAt[m.startCol], c2: colEnd(m.startCol + m.colSpan - 1) });
    });
    const bottom = row - 1;
    const repeatAt = repeat && bottom >= top ? { first: top + repeat.first, last: top + repeat.last } : null;
    if (bottom >= top) {
      s = applyBorder(s, { r1: top, r2: bottom, c1, c2 }, 'all');
      // 기안자가 줄을 더하던 곳 — 품목처럼 같은 모양 줄이 이어지는 마지막 줄(legacyRepeatRow). 없으면 두지 않음.
      // 나란히 놓은 표는 두 표를 다 놓은 뒤 정한다(placeTablePair)
      if (repeatAt && !at.paired) s = setRepeatSection(s, repeatAt.first, repeatAt.last, f.label || '반복 구간');
      else if (!repeatAt && t.rows.length > headerRows) noRepeat.push(`'${f.label || '표'}'`);
    }
    if (untranslated.length) warnings.push(`'${f.label || '표'}'의 수식 중 ${untranslated.join(', ')}은(는) 옮기지 못해 값만 넣었습니다(다른 표를 가리키는 식 등) — 시트 수식으로 다시 넣어 주세요.`);
    return { repeat: repeatAt };
  }

  // 다른 표를 가리키던 수식 — 이제 모든 표 자리를 안다
  const unresolved = new Map<string, string[]>();
  for (const d of deferred) {
    const formula = translateLegacyFormula(d.expr, { ...d.at, tables }, d.format);
    if (formula) putFormula(d.r, d.j, formula, d.format);
    else unresolved.set(d.table, [...(unresolved.get(d.table) ?? []), `${colLetter(d.j)}${d.r + 1}`]);
  }
  unresolved.forEach((cells, table) =>
    warnings.push(`'${table}'의 수식 중 ${cells.join(', ')}은(는) 옮기지 못해 값만 넣었습니다(찾지 못한 표·줄을 가리키는 식) — 시트 수식으로 다시 넣어 주세요.`)
  );

  // 빈 마지막 줄(시작용 한 줄을 안 썼을 때) 정리는 하지 않는다 — 본문 아래 여유 줄
  if (row === 0) warnings.push('옮길 항목이 없습니다 — 빈 본문으로 만들었습니다.');
  if (noRepeat.length) warnings.push(`표 ${noRepeat.join(', ')}은(는) 줄이 정해진 표(줄마다 이름표가 다름)로 보고 [행 추가] 구간을 두지 않았습니다 — 기안자가 줄을 더해야 하는 표면 그 줄을 골라 반복 구간으로 지정하세요.`);

  // 행 보이기 조건 — 기존 visibleIf '키:값'. 조건 칸에는 기존 키를 칸 이름으로(선택 칸은 이미 붙어 있음)
  const missing = new Set<string>();
  condRows.forEach(({ r, visibleIf }) => {
    const at = visibleIf.indexOf(':');
    if (at < 0) return;
    const key = visibleIf.slice(0, at);
    const want = visibleIf.slice(at + 1);
    const src = valueAt.get(key);
    if (!src) return void missing.add(key);
    if (approvalCellProps(s, src.r, src.c).name !== key) s = setCellName(s, src.r, src.c, key);
    const prev = rowConditionOf(s, r);
    // 한 행에 두 항목(반쪽 짝)이 같은 조건 — 값은 하나로
    const values = prev?.name === key ? [...new Set([...prev.values, want])] : [want];
    s = setRowCondition(s, r, r, { name: key, values });
  });
  if (groups.size) warnings.push(`값에 따라 바뀌던 같은 이름의 선택 항목(${[...groups.values()].map((l) => `'${l[0].label}'`).join(', ')})은 칸 하나로 합쳐 기준 칸 값마다 항목이 바뀌게 했습니다.`);
  if (condRows.length) warnings.push('조건부로 보이던 항목은 행 보이기 조건으로 옮겼습니다 — 미리보기에서 값을 바꿔 보며 확인해 주세요.');
  if (missing.size) warnings.push(`조건 칸(${[...missing].join(', ')})을 찾지 못해 그 조건이 걸린 행은 항상 보입니다.`);

  if (withInfo && INFO_ITEMS.some((i) => hiddenHead.has(i))) {
    warnings.push('기존 서식에서 일부만 숨겼던 문서 정보 항목도 문서 정보 표에 들어 있습니다 — 필요 없으면 그 칸을 지우세요.');
  }
  s = insertDocHeader(s, {
    formTitle: !hiddenHead.has('docTitle'),
    closing: form.closing ?? undefined,
    logo: !hiddenHead.has('topBar'),
    info: withInfo,
    closingBlock: !hiddenHead.has('closing'),
  });
  return { sheet: fitColumnWidths(s, PAGE), link, warnings };
}

/** 글자 폭 어림(px, 12px 글꼴) — 변환은 화면 없이도 돌아야 해서(엑셀 불러오기·시험) 글자 종류로 어림한다 */
export function approxTextWidth(text: string, bold = false): number {
  const line = (t: string) =>
    [...t].reduce((w, ch) => w + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 12 : /[A-Z0-9%@#]/.test(ch) ? 7.5 : ch === ' ' ? 3.5 : 6.5), 0);
  const w = Math.max(0, ...text.split('\n').map(line));
  return bold ? w * 1.06 : w;
}

/**
 * 열 너비 — 고르게 나눈 너비에서 시작해, 한 열에만 든 글자(이름표 등)가 잘리는 열은 넓히고 여유 있는 열에서 덜어 낸다.
 * 여러 열을 합친 칸·수식 칸의 글자는 보지 않는다. 다 넓힐 자리가 없으면 필요한 너비 비율대로 나눈다(전체 폭은 그대로)
 */
export function fitColumnWidths(s: Sheet, total: number): Sheet {
  const PAD = 12;
  const MIN = 36;
  const CAP = 180;
  const wide = new Set<string>();
  for (const m of s.merges) {
    if (m.colSpan < 2) continue;
    for (let r = m.startRow; r < m.startRow + m.rowSpan; r++) for (let c = m.startCol; c < m.startCol + m.colSpan; c++) wide.add(`${r}:${c}`);
  }
  const need = s.cols.map((col, c) => {
    let w = MIN;
    s.rows.forEach((row, r) => {
      const t = String(row[col] ?? '');
      if (!t || wide.has(`${r}:${c}`) || s.formulas[`${r}:${col}`]) return;
      w = Math.max(w, Math.min(CAP, approxTextWidth(t, !!s.styles[`${r}:${col}`]?.bold) + PAD));
    });
    return w;
  });
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  let widths: number[];
  if (sum(need) > total) widths = need.map((w) => (w * total) / sum(need));
  else {
    const even = total / s.cols.length;
    widths = need.map((w) => Math.max(w, even));
    // 넓힌 만큼 여유 있는 열(필요보다 넓은 열)에서 여유에 비례해 덜어 낸다
    const over = sum(widths) - total;
    const spare = widths.map((w, c) => w - need[c]);
    if (over > 0 && sum(spare) > 0) widths = widths.map((w, c) => w - (over * spare[c]) / sum(spare));
  }
  return { ...s, colWidths: Object.fromEntries(s.cols.map((c, i) => [c, Math.floor(widths[i])])) };
}
