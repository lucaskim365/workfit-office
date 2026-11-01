import { z } from 'zod';

/*
  결재서식 '자동번호' 칸 — 서식마다 관리자가 번호 모양을 정하고, 상신할 때 counters 채널에서 원자 발급한다.
  재상신(반려·회수 뒤)은 이미 받은 번호를 그대로 둔다. 결재 문서번호(AP-…)와는 별개다.
*/

export const AUTO_NUMBER_DATE_PARTS = ['NONE', 'YYYY', 'YY', 'YYYYMM', 'YYMM', 'YYMMDD'] as const;
export type AutoNumberDatePart = (typeof AUTO_NUMBER_DATE_PARTS)[number];
export const AUTO_NUMBER_DATE_PART_LABEL: Record<AutoNumberDatePart, string> = {
  NONE: '날짜 없음',
  YYYY: '연도 (2026)',
  YY: '연도 (26)',
  YYYYMM: '연월 (202611)',
  YYMM: '연월 (2611)',
  YYMMDD: '연월일 (261101)',
};

export const AUTO_NUMBER_RESETS = ['NEVER', 'YEAR', 'MONTH', 'DAY'] as const;
export type AutoNumberReset = (typeof AUTO_NUMBER_RESETS)[number];
export const AUTO_NUMBER_RESET_LABEL: Record<AutoNumberReset, string> = {
  NEVER: '계속 이어서',
  YEAR: '매년 1번부터',
  MONTH: '매달 1번부터',
  DAY: '매일 1번부터',
};

export const autoNumberConfigSchema = z.object({
  /** 앞에 붙는 글(예: 'PO', '견적'). 비우면 날짜·순번만 */
  prefix: z.string().trim().max(20).regex(/^[0-9A-Za-z가-힣_]*$/, '접두어는 글자·숫자·밑줄만 쓸 수 있습니다.').default(''),
  datePart: z.enum(AUTO_NUMBER_DATE_PARTS).default('YYYY'),
  /** 순번 자릿수(앞을 0으로 채움) */
  digits: z.number().int().min(1).max(8).default(4),
  reset: z.enum(AUTO_NUMBER_RESETS).default('YEAR'),
});
export type AutoNumberConfig = z.infer<typeof autoNumberConfigSchema>;

export const DEFAULT_AUTO_NUMBER: AutoNumberConfig = { prefix: '', datePart: 'YYYY', digits: 4, reset: 'YEAR' };

const pad = (n: number, len: number) => String(n).padStart(len, '0');

function dateParts(d: Date) {
  const yyyy = String(d.getFullYear());
  const mm = pad(d.getMonth() + 1, 2);
  const dd = pad(d.getDate(), 2);
  return { yyyy, yy: yyyy.slice(2), mm, dd };
}

function datePartText(part: AutoNumberDatePart, d: Date): string {
  const { yyyy, yy, mm, dd } = dateParts(d);
  switch (part) {
    case 'NONE':
      return '';
    case 'YYYY':
      return yyyy;
    case 'YY':
      return yy;
    case 'YYYYMM':
      return `${yyyy}${mm}`;
    case 'YYMM':
      return `${yy}${mm}`;
    case 'YYMMDD':
      return `${yy}${mm}${dd}`;
  }
}

/** 'PO-2026-0001' — 접두어·날짜·순번을 '-'로 잇는다(빈 부분은 뺀다) */
export function formatAutoNumber(config: AutoNumberConfig, date: Date, seq: number): string {
  return [config.prefix.trim(), datePartText(config.datePart, date), pad(seq, config.digits)].filter(Boolean).join('-');
}

/** 순번이 다시 1부터 시작하는 묶음 — 초기화 주기별 */
export function autoNumberPeriodKey(reset: AutoNumberReset, date: Date): string {
  const { yyyy, mm, dd } = dateParts(date);
  switch (reset) {
    case 'NEVER':
      return 'ALL';
    case 'YEAR':
      return yyyy;
    case 'MONTH':
      return `${yyyy}${mm}`;
    case 'DAY':
      return `${yyyy}${mm}${dd}`;
  }
}

/** FNV-1a 32비트 → 36진 — 한글 서식 코드도 counters 문서 ID(영숫자)에 쓸 수 있게 */
function hash36(text: string): string {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * counters 채널 — 'AN-<해시>-<묶음>'(36자 이내). 해시에는 서식·칸·번호 모양을 모두 넣어
 * 관리자가 모양을 바꾸면 새 순번으로 시작한다(바꾸기 전 번호와 겹치지 않는다).
 */
export function autoNumberChannel(formCode: string, fieldKey: string, config: AutoNumberConfig, date: Date): string {
  const shape = [formCode, fieldKey, config.prefix.trim(), config.datePart, config.reset].join('|');
  return `AN-${hash36(shape)}-${autoNumberPeriodKey(config.reset, date)}`;
}

/** 서식 편집기 미리보기 — 오늘 기준 첫 번호 */
export const autoNumberPreview = (config: AutoNumberConfig, date = new Date()) => formatAutoNumber(config, date, 1);

/** visibleIf('상위키:값') — 탭·선택에 따라 숨은 칸이면 번호를 매기지 않는다 */
export function isFieldVisible(visibleIf: string | null | undefined, values: Record<string, unknown>): boolean {
  if (!visibleIf) return true;
  const at = visibleIf.indexOf(':');
  if (at < 0) return true;
  const key = visibleIf.slice(0, at);
  const expected = visibleIf.slice(at + 1);
  return String(values[key] ?? '') === expected;
}
