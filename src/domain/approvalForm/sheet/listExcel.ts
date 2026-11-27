/**
 * 목록 엑셀 올리기 — 카드사 이용내역처럼 다른 곳에서 받은 엑셀의 줄들을 서식의 표(반복 구간)에 채운다.
 * [엑셀로 받기]로 받은 파일은 칸 자리로 맞추고(draftExcel.ts), 그 밖의 파일은 여기서 '열 제목'으로 맞춘다.
 *
 * - 표 머리글: 표(반복 구간) 바로 위 줄의 글자, 비었으면 그 위 2줄까지. 머리글 칸이 기안자가 고칠 수 있는 입력 칸이어도 머리글이다
 *   (개인 경비 사용 신청서는 머리글 줄이 입력 칸) — 기안자가 고쳐 쓴 머리글이면 고친 글자로 맞춘다
 * - 열 제목 줄: 엑셀 위쪽에서 서식 표의 머리글과 같은 글자가 가장 많이 든 줄. 그 위·아래로 붙은 제목 줄(두 줄 제목)도 함께 본다
 * - 열 맞추기: ① 머리글과 같은 글자 ② 서식별로 정한 다른 이름(aliases — 날짜 = 이용일자) ③ 한쪽이 다른 쪽을 품은 글자(하나뿐일 때만)
 *   맞추는 글자는 관련 문서 가져오기와 같다(normalizeLabel — 빈칸·괄호 기호 무시) + 영문 대소문자 무시
 * - 번호 열(서식에 1, 2, 3…을 미리 적어 둔 열, 머리글 NO·순번)은 엑셀 값을 받지 않고 늘 1, 2, 3…
 * - 줄은 날짜 열(날짜 칸이거나 값이 모두 날짜인 첫 열) 오름차순으로 놓는다. 날짜가 없는 줄은 맨 뒤.
 *   날짜가 같은 줄은 엑셀 차례 그대로 — 엑셀이 최근 것부터 적힌 목록(카드사 이용내역)이면 거꾸로(같은 날 안에서도 먼저 쓴 것부터)
 * - 표의 줄 수는 엑셀 줄 수에 맞춘다(늘리거나 줄임). 표에 이미 쓴 내용은 지워지고 엑셀 내용으로 바뀐다(엑셀에 없는 열은 빈 칸).
 *   표 밖의 값, 표 안에서 엑셀로 못 받는 칸(선택 창 칸·시스템이 채우는 칸)의 값은 그대로
 * - 엑셀에서 숨긴 줄(필터로 가린 줄)은 받지 않고 알린다
 * - 내용 줄은 열 제목 아래로 이어진 줄까지 — 통째로 빈 줄을 만나면 멈춘다. 합계 줄('합계(2건)', '국내 소계')은 받지 않는다
 * - 서식을 [엑셀로 받기]로 받은 모양인데 숨은 표시만 사라진 파일은 받지 않고 다시 받게 알린다(목록으로 받으면 표 밖 값이 버려진다)
 */
import { cellKey, type Sheet } from '@/lib/sheet/core';
import { applyValues, approvalCellProps, draftInputOf, draftOptions, isDirectInputOption, type CellInput, type SheetValues } from './approvalSheet';
import { convert, fillable, findUser, listOf, remap, rowPlan, splitNames, type XlsxPeople } from './draftExcel';
import { LABEL_UP_ROWS, normalizeLabel } from './labelMatch';
import { MAX_EXTRA_ROWS, expandRepeats, extraRowCount, repeatSections, type RepeatSection, type RowExtras } from './repeatRows';

/** 서식 열 머리글 → 엑셀에서 같은 열로 볼 다른 제목들 */
export type ListXlsxAliases = Record<string, readonly string[]>;

/** 카드 이용내역(카드사 엑셀)의 열 제목 — 법인카드 사용 내역서·개인 경비 사용 신청서의 표 머리글과 짝 */
const CARD_STATEMENT_ALIASES: ListXlsxAliases = {
  날짜: ['이용일자'],
  금액: ['매출금액'],
  사용처: ['가맹점명'],
  참석자: ['사용자'],
  '고객 및 협력사': ['거래처'],
  기타: ['비고'],
};
/** 카드 이용내역을 올려 쓰는 서식 — 코드는 관리자가 정하므로 이름으로도 찾는다. 이름을 품으면 같은 서식으로 본다(복사해 만든 '(운영본) 개인 경비 사용 신청서') */
const CARD_STATEMENT_FORMS = [
  { code: '법인카드', name: '법인카드 사용 내역서' },
  { code: '개인경비', name: '개인 경비 사용 신청서' },
];

/** 이 서식에 쓸 '다른 이름' — 정해 둔 서식이 아니면 없음(같은 글자·품은 글자로만 맞춘다) */
export function listXlsxAliasesOf(form: { code: string; name: string }): ListXlsxAliases | undefined {
  const bare = (t: string) => t.replace(/\s+/g, '');
  return CARD_STATEMENT_FORMS.some((f) => f.code === form.code || bare(form.name).includes(bare(f.name))) ? CARD_STATEMENT_ALIASES : undefined;
}

/** 열 제목을 찾는 범위 — 엑셀 위에서 이만큼의 줄 */
const HEADER_SCAN_ROWS = 50;
/** 번호 열로 보는 머리글 */
const NUMBER_LABELS = new Set(['no', 'no.', '순번', '연번']);
/** 합계 줄로 보는 첫 글자 */
const TOTAL_LABELS = ['합계', '총계', '소계', 'total'];

const norm = (text: unknown) => normalizeLabel(String(text ?? '')).toLowerCase();
const shown = (text: unknown) => String(text ?? '').trim().replace(/\s+/g, ' ');

/**
 * 줄 차례를 정할 날짜 — 글자 앞머리의 날짜('2026.11.17', '2026-11-17 13:20', '20261117'). 날짜가 아니면 null.
 * 앞 10자가 'YYYY-MM-DD'(날짜 칸에 넣는 값), 시각이 붙어 있으면 그 뒤에 ' HH:MM'(같은 날 안의 차례)
 */
function dateKey(text: string): string | null {
  const t = text.trim();
  const m = t.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)/) ?? t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const time = t.slice(m[0].length).match(/(\d{1,2}):(\d{2})/);
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}${time ? ` ${time[1].padStart(2, '0')}:${time[2]}` : ''}`;
}

/** 날짜가 없는 줄의 차례 — 어느 날짜보다 뒤 */
const NO_DATE = '9999-99-99';

/** 표의 한 열 — 기안자가 쓰는 칸이 있는 열 */
interface FormColumn {
  c: number;
  input: CellInput;
  /** 머리글(보이는 글자)과 맞추는 글자 */
  label: string;
  key: string;
  /** 번호 열 — 엑셀 값을 받지 않는다 */
  numbering: boolean;
  /** 맞추는 글자들 — 머리글과 다른 이름 */
  aliases: string[];
}

/**
 * 표 한 열의 머리글 — 표 첫 줄(first) 위쪽에서 가장 가까운 글자(LABEL_UP_ROWS 줄까지).
 * 관련 문서 가져오기의 라벨(cellLabel)과 달리 입력 칸의 글자도 머리글로 본다 — 여기서는 표 바로 위 줄이 머리글 줄임을 안다.
 * 수식·저절로 채워지는 칸, 이 열보다 넓게 병합된 글자(표 이름 '상세내역')를 만나면 머리글 없음
 */
function columnHeader(s: Sheet, first: number, c: number): string {
  const mergeAt = (r: number) => s.merges.find((m) => r >= m.startRow && r < m.startRow + m.rowSpan && c >= m.startCol && c < m.startCol + m.colSpan);
  const span = mergeAt(first)?.colSpan ?? 1;
  for (let rr = first - 1; rr >= Math.max(0, first - LABEL_UP_ROWS); rr--) {
    const m = mergeAt(rr);
    const r = m ? m.startRow : rr;
    const cc = m ? m.startCol : c;
    const p = approvalCellProps(s, r, cc);
    if (s.formulas[cellKey(r, s.cols[cc])] !== undefined || p.bind || p.autoNo) return '';
    const text = String(s.rows[r]?.[s.cols[cc]] ?? '');
    if (!normalizeLabel(text)) continue;
    return (m?.colSpan ?? 1) > span ? '' : shown(text);
  }
  return '';
}

/** 표의 열들 — screen 은 지금 화면(값을 얹은 시트), screenFirst 는 거기서 이 표의 첫 줄 */
function formColumns(template: Sheet, sec: RepeatSection, skipNames: readonly string[], aliases: ListXlsxAliases, screen: Sheet, screenFirst: number): FormColumn[] {
  const aliasOf = new Map(Object.entries(aliases).map(([label, list]) => [norm(label), list.map(norm).filter(Boolean)]));
  const out: FormColumn[] = [];
  template.cols.forEach((col, c) => {
    const input = fillable(template, sec.first, c, skipNames);
    if (!input) return;
    const label = columnHeader(screen, screenFirst, c);
    const key = norm(label);
    let sequential = true;
    for (let r = sec.first; r <= sec.last; r++) if (!draftInputOf(template, r, c) || String(template.rows[r]?.[col] ?? '').trim() !== String(r - sec.first + 1)) sequential = false;
    // 미리 적은 1, 2, 3…은 두 줄 이상일 때만 번호로 본다 — 한 줄짜리 표의 '수량 1'은 번호가 아니다
    out.push({ c, input, label, key, numbering: (sequential && sec.last > sec.first) || NUMBER_LABELS.has(key), aliases: aliasOf.get(key) ?? [] });
  });
  return out;
}

/** 한쪽이 다른 쪽을 품은 글자인가('사용처' ⊂ '사용처(가맹점)') — 한 글자짜리는 보지 않는다 */
/** 긴 글(엑셀 맨 위 제목 '법인카드 이용 내역 (금액 단위: 원)')이 머리글 낱말을 품은 것은 같은 열이 아니다 — 길이가 3배를 넘으면 보지 않는다 */
const contains = (a: string, b: string) =>
  a.length >= 2 && b.length >= 2 && Math.max(a.length, b.length) <= Math.min(a.length, b.length) * 3 && (a.includes(b) || b.includes(a));

/**
 * 엑셀 한 줄에 서식 열의 머리글이 몇 열이나 들었는가 — 같은 글자·다른 이름, loose 면 품은 글자도.
 * 제목 줄을 고를 때는 loose(다른 이름을 정하지 않은 서식도 찾게), 그 위·아래 줄을 제목으로 붙일 때는 같은 글자만(내용 줄을 삼키지 않게)
 */
function headerScore(xlsx: Sheet, x: number, columns: FormColumn[], loose: boolean): number {
  const texts = [...new Set(xlsx.cols.map((col) => norm(xlsx.rows[x]?.[col])).filter(Boolean))];
  return columns.filter((f) => !f.numbering && f.key && texts.some((t) => t === f.key || f.aliases.includes(t) || (loose && contains(t, f.key)))).length;
}

/**
 * 합계 줄인가 — 줄의 첫 글자로 본다.
 * 첫 글자가 받는 열(사용처 등)에 있으면 합계 낱말 그대로일 때만 — '야근 식대 합계'·'Total Wine' 같은 내용을 빼지 않게.
 * 받지 않는 열(엑셀 NO 등)에 있으면 합계 낱말로 시작하거나 끝나는 글, '총 3건' 같은 맺음 글도 합계 줄
 */
function isTotalText(text: string, inMappedColumn: boolean): boolean {
  const k = norm(text);
  if (k === '계' || TOTAL_LABELS.includes(k)) return true;
  return !inMappedColumn && (k.startsWith('총') || TOTAL_LABELS.some((w) => k.startsWith(w) || k.endsWith(w)));
}

/**
 * [엑셀로 받기]로 받은 양식인데 숨은 표시가 사라진 파일인가 — 서식의 표 밖 글자(문서번호·정산기간…)가 거의 그대로 들어 있으면.
 * 그런 파일을 목록 엑셀로 받으면 표 밖에 쓴 값이 버려지고 빈 줄까지 표의 줄로 들어온다
 */
function looksLikeDraftFile(template: Sheet, xlsx: Sheet, headerKeys: ReadonlySet<string>): boolean {
  const sections = repeatSections(template);
  const labels = new Set<string>();
  template.rows.forEach((row, r) => {
    if (sections.some((s) => r >= s.first && r <= s.last)) return;
    template.cols.forEach((col, c) => {
      const p = approvalCellProps(template, r, c);
      if (p.input || p.bind || p.autoNo || template.formulas[cellKey(r, col)] !== undefined) return;
      const k = norm(row[col]);
      if (k.length >= 2 && !headerKeys.has(k)) labels.add(k);
    });
  });
  if (labels.size < 3) return false;
  const inFile = new Set(xlsx.rows.flatMap((row) => xlsx.cols.map((col) => norm(row[col]))));
  return [...labels].filter((k) => inFile.has(k)).length >= labels.size * 0.8;
}

export interface ListXlsxFillInput {
  template: Sheet;
  /** 지금 문서의 줄 수·값·사람 칸 ID */
  extras: RowExtras;
  values: SheetValues;
  refs: SheetValues;
  /** 올린 파일 — importXlsx 의 시트 */
  xlsx: Sheet;
  skipNames?: readonly string[];
  /** 조직도 — 없으면 사람·부서 칸은 받지 않는다 */
  people?: XlsxPeople;
  aliases?: ListXlsxAliases;
}

export type ListXlsxFillResult =
  | { ok: false; error: string }
  | {
      ok: true;
      extras: RowExtras;
      values: SheetValues;
      refs: SheetValues;
      /** 엑셀 값을 얹기 전 — 지금 화면의 값·사람 칸 ID 를 새 줄 번호로 옮긴 것(미리보기에서 칸별로 되돌릴 때 쓴다) */
      base: SheetValues;
      baseRefs: SheetValues;
      /** 채운 표 이름과 줄 수 */
      table: string;
      rows: number;
      /** 표에서 늘어난(음수면 줄어든) 줄 수 */
      rowDelta: number;
      /** 맞춘 열 — 서식 머리글과 엑셀 열 제목 */
      columns: { label: string; header: string }[];
      /** 줄 차례를 정한 날짜 열의 머리글(없으면 엑셀 차례 그대로) */
      sortedBy?: string;
      /** 번호 열이 있어 1, 2, 3…으로 다시 매겼는가 */
      numbered: boolean;
      notes: string[];
    };

/** 올린 엑셀의 줄들을 서식의 표에 */
export function fillFromListXlsx({ template, extras, values, refs, xlsx, skipNames = [], people, aliases = {} }: ListXlsxFillInput): ListXlsxFillResult {
  const sections = repeatSections(template);
  if (sections.length === 0) return { ok: false, error: '이 서식에는 줄을 늘려 쓰는 표가 없어 목록 엑셀을 올릴 수 없습니다. [엑셀로 받기]로 양식을 받아 그 파일에 써 주세요.' };

  // 머리글은 지금 화면에서 읽는다 — 머리글 칸이 입력 칸이면 기안자가 고쳐 썼을 수 있다
  const screen = applyValues(expandRepeats(template, extras), values, { recalc: false });
  const screenSections = repeatSections(screen);
  const columnsOf = (sec: RepeatSection) => formColumns(template, sec, skipNames, aliases, screen, screenSections.find((x) => x.id === sec.id)?.first ?? sec.first);
  const headerKeys = new Set(sections.flatMap((sec) => columnsOf(sec).map((f) => f.key)));
  if (looksLikeDraftFile(template, xlsx, headerKeys)) {
    return { ok: false, error: '이 서식을 [엑셀로 받기]로 받은 파일로 보이는데, 파일 안의 숨은 표시가 사라져 칸 자리를 찾을 수 없습니다. [엑셀로 받기]로 양식을 다시 받아 그 파일에 써 주세요.' };
  }
  // 열 제목 줄 — 표마다 머리글이 가장 많이 맞는 줄(같으면 위쪽 줄, 위쪽 표)
  let best: { sec: RepeatSection; columns: FormColumn[]; row: number; score: number } | undefined;
  const scan = Math.min(xlsx.rows.length, HEADER_SCAN_ROWS);
  for (const sec of sections) {
    const columns = columnsOf(sec);
    for (let x = 0; x < scan; x++) {
      const score = headerScore(xlsx, x, columns, true);
      if (score > (best?.score ?? 0)) best = { sec, columns, row: x, score };
    }
  }
  const need = (columns: FormColumn[]) => Math.min(2, columns.filter((f) => !f.numbering && f.key).length);
  if (!best || best.score < need(best.columns)) {
    const labels = sections.flatMap((sec) => columnsOf(sec).filter((f) => !f.numbering && f.label).map((f) => f.label));
    return { ok: false, error: `엑셀에서 표의 열 제목을 찾지 못했습니다. 엑셀 첫 줄에 서식 표와 같은 제목(${listOf(labels)})을 적어 주세요.\n칸 자리 그대로 채우려면 [엑셀로 받기]로 양식을 받아 그 파일에 써 주세요.` };
  }
  const { sec, columns } = best;
  // 제목이 두 줄이면(위에 서식 머리글, 아래에 카드사 제목) 둘 다 제목 — 머리글과 같은 글자(다른 이름)가 둘 이상 든 붙은 줄까지
  let top = best.row;
  let bottom = best.row;
  while (top > 0 && headerScore(xlsx, top - 1, columns, false) >= 2) top--;
  while (bottom + 1 < scan && headerScore(xlsx, bottom + 1, columns, false) >= 2) bottom++;

  // 엑셀 열마다 제목 글자(제목 줄들에서)
  const headers = xlsx.cols.map((col) => {
    const texts: string[] = [];
    for (let x = top; x <= bottom; x++) if (norm(xlsx.rows[x]?.[col])) texts.push(shown(xlsx.rows[x]?.[col]));
    return { keys: texts.map(norm), text: texts[texts.length - 1] ?? '' };
  });
  /** 서식 열(c) → 엑셀 열 번호. 엑셀 열 하나는 한 번만 쓴다 */
  const mapped = new Map<number, number>();
  const used = new Set<number>();
  const targets = columns.filter((f) => !f.numbering && f.key);
  const pick = (find: (f: FormColumn) => number[], uniqueOnly: boolean) => {
    for (const f of targets) {
      if (mapped.has(f.c)) continue;
      const hits = find(f).filter((x) => !used.has(x));
      if (hits.length === 0 || (uniqueOnly && hits.length > 1)) continue;
      mapped.set(f.c, hits[0]);
      used.add(hits[0]);
    }
  };
  const colsWhere = (ok: (keys: string[]) => boolean) => headers.flatMap((h, x) => (ok(h.keys) ? [x] : []));
  pick((f) => colsWhere((keys) => keys.includes(f.key)), false);
  pick((f) => colsWhere((keys) => keys.some((k) => f.aliases.includes(k))), false);
  pick((f) => colsWhere((keys) => keys.some((k) => contains(k, f.key))), true);

  // 내용 줄 — 제목 줄 아래로 이어진 줄들. 통째로 빈 줄을 만나면 거기까지(그 아래 메모·다른 표는 받지 않고 알린다).
  // 합계 줄과 맞춘 열이 모두 빈 줄은 뺀다
  const cell = (x: number, xc: number) => String(xlsx.rows[x]?.[xlsx.cols[xc]] ?? '');
  const mappedCols = [...mapped.values()];
  const notes: string[] = [];
  let data: number[] = [];
  let hidden = 0;
  for (let x = bottom + 1; x < xlsx.rows.length; x++) {
    // 엑셀에서 숨긴 줄(필터로 가린 줄 포함)은 받지 않는다 — 보이는 것만 올린다고 여긴다
    if (xlsx.rowHeights[String(x)] === 0) {
      hidden++;
      continue;
    }
    const firstCol = xlsx.cols.findIndex((col) => String(xlsx.rows[x]?.[col] ?? '').trim() !== '');
    const firstText = firstCol < 0 ? undefined : cell(x, firstCol).trim();
    if (firstText === undefined) {
      if (data.length === 0) continue;
      let below = 0;
      for (let y = x + 1; y < xlsx.rows.length; y++) if (xlsx.cols.some((col) => String(xlsx.rows[y]?.[col] ?? '').trim() !== '')) below++;
      if (below) notes.push(`빈 줄 아래에 있는 ${below}줄은 받지 않았습니다. 받으려면 엑셀에서 빈 줄을 지워 주세요.`);
      break;
    }
    if (isTotalText(firstText, mappedCols.includes(firstCol)) || mappedCols.every((xc) => cell(x, xc).trim() === '')) continue;
    data.push(x);
  }
  if (data.length === 0) return { ok: false, error: '엑셀의 열 제목 아래에 받을 내용 줄이 없습니다.' };
  if (hidden) notes.push(`엑셀에서 숨긴 줄(필터로 가린 줄) ${hidden}줄은 받지 않았습니다.`);

  // 날짜 오름차순 — 값이 거의 다 날짜인 첫 열(날짜가 아닌 값은 한 줄, 또는 20%까지). 날짜를 읽지 못한 줄은 맨 뒤로 보내고 알린다
  const sortCol = targets.find((f) => {
    const xc = mapped.get(f.c);
    if (xc === undefined) return false;
    const texts = data.map((x) => cell(x, xc).trim()).filter(Boolean);
    const dates = texts.filter((t) => dateKey(t) !== null).length;
    return dates > 0 && texts.length - dates <= Math.max(1, texts.length * 0.2);
  });
  if (sortCol) {
    const xc = mapped.get(sortCol.c)!;
    const keyOf = (x: number) => dateKey(cell(x, xc)) ?? NO_DATE;
    // 최근 것부터 적힌 목록이면 뒤집어 놓고 차례를 정한다 — 같은 날 안의 줄도 먼저 쓴 것이 위로
    const dated = data.map((x) => dateKey(cell(x, xc))).filter((k): k is string => k !== null);
    if (dated.length > 1 && dated[0] !== dated[dated.length - 1] && dated.every((k, i) => i === 0 || k <= dated[i - 1])) data.reverse();
    data = data.map((x, i) => ({ x, i, k: keyOf(x) })).sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i)).map((e) => e.x);
    if (dated.length < data.length) notes.push(`'${sortCol.label}' 열의 값을 날짜로 읽지 못한 ${data.length - dated.length}줄은 맨 뒤에 놓았습니다.`);
  }

  const tplLen = sec.last - sec.first + 1;
  if (data.length > tplLen + MAX_EXTRA_ROWS) {
    notes.push(`'${sec.label}' 표는 ${tplLen + MAX_EXTRA_ROWS}줄까지만 받았습니다(엑셀 ${data.length}줄).`);
    data = data.slice(0, tplLen + MAX_EXTRA_ROWS);
  }

  // 표의 줄 수를 엑셀 줄 수로 — 값·사람 칸 ID 는 제 줄을 따라간다(표 밖 줄은 그대로, 표의 줄은 같은 차례 줄로).
  // 표에서 기안자가 쓰는 칸은 아래에서 모두 새로 채우므로, 남는 것은 엑셀로 못 받는 칸(선택 창 칸·시스템이 채우는 칸)의 값뿐이다
  const nextExtras: RowExtras = { ...extras };
  if (data.length === tplLen) delete nextExtras[sec.id];
  else nextExtras[sec.id] = data.length - tplLen;
  const prefix = `s${sec.id}:`;
  const now = rowPlan(template, extras);
  const next = rowPlan(template, nextExtras);
  const base = remap(values, now, next);
  const baseRefs = remap(refs, now, next);
  const out = { ...base };
  const nextRefs = { ...baseRefs };
  const shape = expandRepeats(template, nextExtras);
  const first = next.indexOf(`${prefix}0`);

  const byCol = new Map(columns.map((f) => [f.c, f]));
  const unreadable: string[] = [];
  const noUser: string[] = [];
  const manyUsers: string[] = [];
  const skipped: string[] = [];
  const selects: { r: number; c: number; key: string; label: string }[] = [];
  data.forEach((x, k) => {
    const r = first + k;
    shape.cols.forEach((col, c) => {
      const input = fillable(shape, r, c, skipNames);
      if (!input) return;
      const key = cellKey(r, col);
      delete nextRefs[key];
      const f = byCol.get(c);
      if (f?.numbering) {
        out[key] = String(k + 1);
        return;
      }
      // 엑셀에 없는 열은 빈 칸 — 틀에 미리 쓴 글자가 비쳐 보이지 않게
      out[key] = '';
      const xc = mapped.get(c);
      const text = xc === undefined ? '' : cell(x, xc);
      if (!f || text.trim() === '') return;
      const caption = `${f.label} ${k + 1}번째 줄(${shown(text)})`;
      if (input.type === 'user' || input.type === 'users' || input.type === 'dept') {
        if (!people) return void skipped.push(caption);
        if (input.type === 'dept') {
          if (people.depts.includes(text.trim())) out[key] = text.trim();
          else noUser.push(caption);
          return;
        }
        const found = (input.type === 'users' ? splitNames(text) : [text]).map((t) => findUser(t, people));
        if (found.includes('many')) manyUsers.push(caption);
        if (found.includes('none')) noUser.push(caption);
        const hits = found.filter((h): h is { text: string; id: string } => typeof h === 'object');
        if (hits.length !== found.length || hits.length === 0) return;
        out[key] = hits.map((h) => h.text).join(', ');
        nextRefs[key] = hits.map((h) => h.id).join(',');
        return;
      }
      // 날짜 칸 — 정렬과 같은 눈으로 읽는다(시각이 붙은 날짜·8자리 날짜도)
      const v = input.type === 'date' ? (dateKey(text)?.slice(0, 10) ?? null) : convert(input, text);
      if (v === null) return void unreadable.push(caption);
      out[key] = v;
      if (input.type === 'select') selects.push({ r, c, key, label: caption });
    });
  });

  // 선택 칸 — 고를 수 있는 항목(종속 선택은 기준 칸 값에 맞는 갈래)에 없는 값은 받지 않는다
  const filled = applyValues(shape, out, { recalc: false });
  const badSelect: string[] = [];
  for (const s of selects) {
    const input = draftInputOf(filled, s.r, s.c);
    if (!out[s.key] || !input) continue;
    const options = draftOptions(filled, input);
    if (options.includes(out[s.key]) || options.some(isDirectInputOption)) continue;
    badSelect.push(s.label);
    out[s.key] = '';
  }

  const missing = targets.filter((f) => !mapped.has(f.c)).map((f) => f.label);
  if (missing.length) notes.push(`엑셀에 같은 제목의 열이 없어 비워 둔 열: ${listOf(missing)}`);
  if (unreadable.length) notes.push(`칸 종류(숫자·날짜 등)에 맞지 않는 값이라 받지 않았습니다: ${listOf(unreadable)}`);
  if (badSelect.length) notes.push(`고를 수 있는 항목이 아니라 받지 않았습니다: ${listOf(badSelect)}`);
  if (noUser.length) notes.push(`조직도에서 찾지 못한 이름이라 받지 않았습니다: ${listOf(noUser)}`);
  if (manyUsers.length) notes.push(`같은 이름이 여럿이라 받지 않았습니다. '이름 (부서)'로 적어 주세요: ${listOf(manyUsers)}`);
  if (skipped.length) notes.push(`사람·부서 칸은 받지 못했습니다. 화면에서 골라 주세요: ${listOf(skipped)}`);

  return {
    ok: true,
    extras: nextExtras,
    values: out,
    refs: nextRefs,
    base,
    baseRefs,
    table: sec.label,
    rows: data.length,
    rowDelta: data.length - (tplLen + extraRowCount(extras, sec)),
    columns: targets.filter((f) => mapped.has(f.c)).map((f) => ({ label: f.label, header: headers[mapped.get(f.c)!].text })),
    sortedBy: sortCol?.label,
    numbered: columns.some((f) => f.numbering),
    notes,
  };
}
