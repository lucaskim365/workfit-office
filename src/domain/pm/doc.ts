import { diffDays } from './rules';
import { isPre } from './site';
import { PM_DOC_STATES, type PmDoc, type PmTask } from './schema';
import type { PmTicket } from './ticket';

/**
 * 산출물 — 점검 · 요구사항 · 산출물 › 산출물 (데모 pDoc 4258 · DOC_ST 4256 · docOf 4257).
 * 산출물 = 업무 목록의 '산출물' 칸이 적힌 업무. 상태는 사람이 [미작성 | 작성중 | 제출] 로 고르거나 파일을 올리면 '제출완료'.
 * 고른 적 없으면: 업무 티켓에 파일이 있으면 '작성중', 아니면 '미작성' (auto).
 */

export const DOC_ST = PM_DOC_STATES;
export type DocSt = (typeof DOC_ST)[number];

export interface DocState {
  st: DocSt;
  file: string;
  /** 사람이 고른 적 없음 (티켓 파일로 판단) */
  auto: boolean;
  date?: string;
  by?: string;
}

/** 산출물 상태 (docOf) — 고른 기록 → 업무 티켓 파일 → 미작성 */
export function docOf(t: PmTask, docs: ReadonlyMap<string, PmDoc>, ticket?: PmTicket): DocState {
  const d = docs.get(t.id);
  if (d && d.st) return { st: d.st, file: d.file, auto: false, date: d.date, by: d.by };
  return { st: ticket && ticket.files.length ? '작성중' : '미작성', file: '', auto: true };
}

/** 산출물 목록 필터 (UI.doc) — 단계: main = 협약 이후 전체 · all · 단계 이름 / 상태: open = 미제출 · all · 상태 */
export interface DocFilter {
  stage: string;
  st: 'open' | 'all' | DocSt;
  ms: boolean;
  q: string;
}
export const DOC_FILTER_DEFAULT: DocFilter = { stage: 'main', st: 'open', ms: false, q: '' };

/** 이 사업 산출물 업무 (all = 산출물 칸이 있는 업무, 화면 순서) */
export const docTasks = (ts: readonly PmTask[]) => ts.filter((t) => !!t.output);

/** 필터에 맞는 산출물 (pDoc list) */
export function docFilter(all: readonly PmTask[], f: DocFilter, st: (t: PmTask) => DocSt): PmTask[] {
  const q = f.q.trim().toLowerCase();
  return all.filter((t) =>
    (f.stage === 'all' || (f.stage === 'main' ? !isPre(t) : t.stage === f.stage))
    && (!f.ms || t.milestone)
    && (f.st === 'all' || (f.st === 'open' ? st(t) !== '제출완료' : st(t) === f.st))
    && (!q || `${t.output} ${t.name} ${t.code}`.toLowerCase().includes(q)));
}

export interface DocSummary {
  n: number;
  done: number;
  wip: number;
  none: number;
  /** 단계 칸 — 산출물 업무가 있는 단계 (처음 나온 순) */
  stages: Array<{ name: string; n: number; d: number }>;
}
/** 위 '감리 제출 n / 전체' · 상태 띠 · 단계 칸 (pDoc hero) — 전체 산출물 업무 기준 (협약 이전 포함, 데모 그대로) */
export function docSummary(all: readonly PmTask[], st: (t: PmTask) => DocSt): DocSummary {
  const done = all.filter((t) => st(t) === '제출완료').length;
  const wip = all.filter((t) => st(t) === '작성중').length;
  const names = [...new Set(all.map((t) => t.stage))];
  return {
    n: all.length, done, wip, none: all.length - done - wip,
    stages: names.map((name) => { const g = all.filter((t) => t.stage === name); return { name, n: g.length, d: g.filter((t) => st(t) === '제출완료').length }; }),
  };
}

/** 마감이 7일 안이고 미제출 (rowH soon) — 지났으면 bad */
export function docDueTone(t: PmTask, st: DocSt, today: string): '' | 'warn' | 'bad' {
  if (st === '제출완료' || isPre(t) || !t.end) return '';
  const left = diffDays(today, t.end);
  return left > 7 ? '' : left < 0 ? 'bad' : 'warn';
}
