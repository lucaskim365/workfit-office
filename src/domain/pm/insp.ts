import { addDays, diffDays, monthDay } from './rules';
import type { PmFixItem, PmTask } from './schema';
import { fnLinks, fnSt, govItems, govRec, isDrop, isPre, siteStats, type FnLink, type GovItem, type SiteCtx, type SiteStats } from './site';
import type { DocSt } from './doc';

/**
 * 점검 · 감리 대비 — 점검 · 요구사항 · 산출물 › 점검 · 감리 대비 (데모 inspInfo 7108 · pInsp 7134 · inspDetail 7168).
 * 정부사업마다 다음 중간점검 · 최종점검(감리) · 보완 재점검과 그때까지 무엇이 준비 안 됐는지.
 * 새 입력 칸 없음 — 점검 일정 · 판정 기록, 계획서 약속 기능, 보완 지적 사항, 산출물 제출 상태를 모아서 봄.
 */

export const INSP_IDS = ['g_mid', 'g_mid_fix', 'g_audit', 'g_audit_fix'] as const;
export const INSP_NM: Record<string, string> = { g_mid: '중간점검', g_mid_fix: '중간점검 보완 · 재점검', g_audit: '최종점검 (감리)', g_audit_fix: '최종점검 보완 · 재확인' };

export type InspLv = 'bad' | 'warn' | 'ok' | 'none';
export const INSP_LV: Record<InspLv, string> = { bad: '위험', warn: '주의', ok: '양호', none: '점검 끝' };

export interface InspFix extends PmFixItem {
  /** 어느 점검의 지적 사항 */
  pid: string;
  pnm: string;
}

export interface InspInfo {
  c: SiteCtx;
  /** 다음 점검 (결과 기록 전인 첫 점검). 없으면 점검 끝 */
  g: GovItem | null;
  days: number | null;
  /** 지난 점검 판정 (마지막으로 기록된 점검) */
  last: { nm: string; v: string; d: string } | null;
  /** 계획서 약속 기능 (기존 기능 제외). 계획서 없으면 null */
  dev: FnLink[] | null;
  fnDone: number;
  fnLate: FnLink[];
  fnNone: FnLink[];
  /** 보완 지적 사항 중 확인 안 된 것 */
  gi: InspFix[];
  ps: SiteStats;
  /** 산출물 업무 (협약 이후) · 그중 미제출 */
  outs: PmTask[];
  outLeft: PmTask[];
  isAudit: boolean;
  readyOk: boolean;
  probs: string[];
  lv: InspLv;
  /** 점검일이 지나 결과 기록 버튼 */
  recBtn: boolean;
}

/** 사업 1개 점검 준비 상태 (inspInfo). 탈락 · 관리기준 없는 사업(정부사업 아님 · 협약 기간 없음)은 null */
export function inspInfo(c: SiteCtx, planFns: ReadonlyArray<readonly [string, string, string]> | undefined, docSt: (t: PmTask) => DocSt): InspInfo | null {
  const L = !isDrop(c.p) && govItems(c);
  if (!L) return null;
  const g = L.find((x) => (INSP_IDS as readonly string[]).includes(x.id) && !govRec(c, x)) ?? null;
  const R = c.gov;
  const lastId = [...INSP_IDS].reverse().find((id) => R.get(id)?.v);
  const last = lastId ? { nm: INSP_NM[lastId], v: R.get(lastId)!.v, d: R.get(lastId)!.date } : null;
  const fl = fnLinks(c, planFns);
  const dev = fl ? fl.filter((f) => f.kind !== '기존') : null;
  const fnDone = dev ? dev.filter((f) => fnSt(c, f) === '완료').length : 0;
  const fnLate = dev ? dev.filter((f) => fnSt(c, f) === '지연') : [];
  const fnNone = dev ? dev.filter((f) => fnSt(c, f) === '연결 없음') : [];
  const gi: InspFix[] = [];
  for (const [id, r] of R) for (const it of r.items) if (it.st !== '확인') gi.push({ ...it, pid: id, pnm: INSP_NM[id] ?? id });
  const ps = siteStats(c);
  const outs = c.ts.filter((t) => t.output && !isPre(t));
  const outLeft = outs.filter((t) => docSt(t) !== '제출완료');
  const isAudit = !!g && /^g_audit/.test(g.id);
  const ready = L.find((x) => x.id === 'g_ready');
  const readyOk = !ready || !!govRec(c, ready);
  const days = g && g.due ? diffDays(c.today, g.due) : null;
  const probs: string[] = [];
  // 최종점검 준비 · 산출물은 점검 60일 전부터 따짐
  const near = days != null && days <= 60;
  if (days != null && days < 0) probs.push('점검일 지남 — 결과 기록 필요');
  // 모든 정부사업 공통 (2026-11-09): 점검 일정이 규정 기한보다 늦으면 · 점검 전에 끝났어야 할 업무가 지연 중이면 준비 부족
  const lawLate = g && g.lawDue && g.due > g.lawDue ? diffDays(g.lawDue, g.due) : 0;
  if (lawLate) probs.push(`점검 일정이 규정(${monthDay(g!.lawDue!)})보다 ${lawLate}일 늦음`);
  const wbsLate = g && g.due ? ps.late.filter((t) => !t.end || t.end <= g.due) : [];
  if (wbsLate.length) probs.push(`지연 업무 ${wbsLate.length}`);
  if (fnLate.length) probs.push(`약속 기능 지연 ${fnLate.length}`);
  if (gi.length) probs.push(`보완 미조치 ${gi.length}`);
  if (isAudit && near && !readyOk) probs.push('최종점검 준비 안 끝남');
  if (isAudit && near && outLeft.length) probs.push(`산출물 미제출 ${outLeft.length}`);
  const lv: InspLv = !g ? 'none' : !probs.length ? 'ok' : days != null && days <= 14 ? 'bad' : 'warn';
  return { c, g, days, last, dev, fnDone, fnLate, fnNone, gi, ps, outs, outLeft, isAudit, readyOk, probs, lv, recBtn: days != null && days < 0 };
}

export interface InspBoard {
  /** 남은 점검 — 점검일 가까운 순 (날짜 없으면 뒤) */
  up: InspInfo[];
  /** 점검을 모두 마친 사업 */
  fin: InspInfo[];
  nBad: number;
  nWarn: number;
  /** 30일 안 (지난 것 포함 — 데모 days <= 30) */
  soon: number;
  /** 보완 미조치 합 (점검 끝난 사업 포함) */
  nGi: number;
}
/** 화면 위 숫자 (pInsp) */
export function inspBoard(all: readonly InspInfo[]): InspBoard {
  const up = all.filter((x) => x.g).sort((a, b) => ((a.g!.due || '9') < (b.g!.due || '9') ? -1 : (a.g!.due || '9') > (b.g!.due || '9') ? 1 : 0));
  return {
    up, fin: all.filter((x) => !x.g),
    nBad: up.filter((x) => x.lv === 'bad').length,
    nWarn: up.filter((x) => x.lv === 'warn').length,
    soon: up.filter((x) => x.days != null && x.days <= 30).length,
    nGi: all.reduce((s, x) => s + x.gi.length, 0),
  };
}

/** 일정 띠 — 한 달 전 ~ 200일 뒤, 위치 % (pInsp strip) */
export function inspSpan(today: string) {
  const a = addDays(today, -30);
  const b = addDays(today, 200);
  const W = diffDays(a, b);
  const P = (d: string) => Math.max(0, Math.min(100, (diffDays(a, d) / W) * 100));
  const mons: Array<[number, string]> = [];
  const d = new Date(`${a}T00:00:00`);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  for (;;) {
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    if (s > b) break;
    mons.push([P(s), `${d.getMonth() + 1}월`]);
    d.setMonth(d.getMonth() + 1);
  }
  return { a, b, P, mons };
}
