import { z } from 'zod';
import type { PmProject } from './schema';
import { addDays, diffDays } from './rules';
import type { PmMoneyCfg } from './money';
import { cSum, type PmContract, type PmPay } from './quote';
import type { HourRow } from './team';

/**
 * 사업별 수익 · 월별 · 연간 손익 (데모 plOf 4482 · laborOf 4477 · pMoneySite 4499 · noPayC~payGuess 4562~4573 · pMoneyPL 4574 · ovPct 4452) — 6-6.
 * 원가 = 계약된 견적의 매입(최종 견적서 = 확정 원가) ± 원가 변경. 매출은 대금 단계의 [매출 잡는 날짜] 기준.
 * 금액은 원. 계산은 데모 그대로 (반올림 없음 — 화면이 만원 · 억원으로 보여 줄 때만 반올림).
 */

// ── 원가 변경 (데모 S.money.costs) · 간접비 (S.money.oh) ─────────
export const COST_CATS = ['장비 · HW 매입', '외주 용역', 'SW 구입', '출장 · 경비', '기타'] as const;
export const pmCostSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  date: z.string().min(1),
  cat: z.string().default(COST_CATS[0]),
  /** 바뀐 금액 (원, VAT 별도, 줄면 −) */
  amt: z.number().int(),
  vendor: z.string().default(''),
  desc: z.string().default(''),
});
export type PmCost = z.infer<typeof pmCostSchema>;

/** 달마다 간접비 (회사 공통 비용) — id = 'YYYY-MM' */
export const pmOhSchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}$/),
  /** 원 — null 이면 그 달은 기본 월 간접비 */
  amt: z.number().int().nullable().default(null),
  memo: z.string().default(''),
  by: z.string().default(''),
  at: z.string().default(''),
});
export type PmOh = z.infer<typeof pmOhSchema>;

export interface PlCtx {
  projects: readonly PmProject[];
  contracts: readonly PmContract[];
  pays: readonly PmPay[];
  costs: readonly PmCost[];
  oh: readonly PmOh[];
  cfg: PmMoneyCfg;
  /** 업무계획 '시간' 칸에 적은 것 (hoursRows) */
  hours: readonly HourRow[];
  today: string;
}

/** 시간당 인건비 — 직원 인건비 반영이 꺼져 있으면 0 (kosaH) */
export const kosaH = (cfg: PmMoneyCfg) => (cfg.laborOn && cfg.workH ? cfg.kosaMonthly / cfg.workH : 0);

/** 인건비 = 업무계획 '시간' × 시간당 단가 — 시간을 안 적은 일은 빠짐 (laborOf) */
export function laborOf(X: PlCtx, k: string, from = '0000', to = '9999') {
  const R = X.hours.filter((r) => r.d >= from && r.d <= to && r.projectId === k);
  const h = R.reduce((a, r) => a + r.h, 0);
  const per: Record<string, number> = {};
  for (const r of R) per[r.who] = (per[r.who] ?? 0) + r.h;
  return { h, amt: h * kosaH(X.cfg), per, rows: R };
}

export interface PlOf {
  cs: PmContract[];
  /** 모든 견적(계약 전 포함) 매출 · 매입 */
  est: { rev: number; buy: number };
  estP: number;
  /** 계약된 견적의 매입 */
  base: number;
  /** 원가 변경 합 (±) */
  chg: number;
  buyAct: number;
  lab: ReturnType<typeof laborOf>;
  /** 계약 매출 */
  rev: number;
  withLabor: number;
}
/** 사업 하나의 손익 (plOf) */
export function plOf(X: PlCtx, k: string): PlOf {
  const cs = X.contracts.filter((c) => c.projectId === k);
  const sig = cs.filter((c) => c.status === '계약');
  const est = cs.reduce((a, c) => { const x = cSum(c); return { rev: a.rev + x.rev, buy: a.buy + x.buy }; }, { rev: 0, buy: 0 });
  const base = sig.reduce((a, c) => a + cSum(c).buy, 0);
  const chg = X.costs.filter((x) => x.projectId === k).reduce((a, x) => a + x.amt, 0);
  const lab = laborOf(X, k);
  const rev = sig.reduce((a, c) => a + cSum(c).rev, 0);
  return { cs, est, estP: est.rev - est.buy, base, chg, buyAct: base + chg, lab, rev, withLabor: est.rev - est.buy - lab.amt };
}

/** 왼쪽 사업 목록 한 칸 — 계약 매출이 있으면 계약 기준, 없으면 견적 기준 (pMoneySite chips) */
export function siteChip(X: PlCtx, k: string) {
  const p = plOf(X, k);
  const rv = p.rev || p.est.rev;
  const pr = p.rev ? p.rev - p.buyAct - p.lab.amt : p.estP;
  const has = X.contracts.some((c) => c.projectId === k);
  return { rv, pr, has, estOnly: has && !p.rev };
}

/** 위 '매출 − 원가 = 이익' 식 (pMoneySite kpis) — 계약 매출이 있으면 계약 기준(원가 = 매입 ± 변경 + 인건비), 없으면 견적 기준 */
export function siteHead(P: PlOf) {
  const actCost = P.buyAct + P.lab.amt;
  const hv = P.rev ? { r: P.rev, c: actCost, p: P.rev - actCost, est: false } : { r: P.est.rev, c: P.est.buy, p: P.estP, est: true };
  const cw = hv.r ? Math.max(0, Math.min(100, hv.c / hv.r * 100)) : 0;
  return { ...hv, cw, estOnly: P.est.rev - P.rev, nSig: P.cs.filter((c) => c.status === '계약').length };
}

/** 계약은 됐는데 대금 단계가 하나도 없는 계약 — 예상 매출에서 빠지므로 화면에 알림 (noPayC) */
export const noPayC = (X: Pick<PlCtx, 'contracts' | 'pays'>, k?: string) =>
  X.contracts.filter((c) => (!k || c.projectId === k) && c.status === '계약' && cSum(c).rev && !X.pays.some((x) => x.cid === c.id));
/** 대금 금액 — 직접 넣은 금액, 없으면 계약 매출 × 비율 (payAmt) */
export const payAmt = (X: Pick<PlCtx, 'contracts'>, x: PmPay) => {
  if (x.amt != null) return x.amt;
  const c = X.contracts.find((y) => y.id === x.cid);
  return c ? cSum(c).rev * (x.rate || 0) / 100 : 0;
};
/** 매출로 잡는 날 (revDate) — 단가 · 계산 기준의 '매출 잡는 날짜' */
export const revDate = (cfg: PmMoneyCfg, x: PmPay) => ({ inv: x.inv, paid: x.paid, due: x.due })[cfg.revBasis] || '';
/** 견적 매입은 매출이 잡히는 달에 같은 비율로: 대금 금액 × (계약 매입 ÷ 계약 매출) (payBuy) */
export const payBuy = (X: Pick<PlCtx, 'contracts'>, x: PmPay) => {
  const c = X.contracts.find((y) => y.id === x.cid);
  if (!c || c.status !== '계약') return 0;
  const t = cSum(c);
  return t.rev ? payAmt(X, x) * t.buy / t.rev : 0;
};
/** 그 달 간접비 — 입력값, 없으면 기본 월 간접비(지난달 · 이번 달만) (ohOf) */
export const ohOf = (X: Pick<PlCtx, 'oh' | 'cfg' | 'today'>, m: string) => {
  const o = X.oh.find((x) => x.id === m);
  return o && o.amt != null ? o.amt : m <= X.today.slice(0, 7) ? X.cfg.ohDefault ?? 0 : 0;
};
/** 대금 예정일이 비어 있으면 단계 이름으로 날짜 추정: 선급 · 착수 → 협약 시작, 중도 → 가운데, 잔금 · 완료 → 협약 종료 (payGuess) */
export function payGuess(X: Pick<PlCtx, 'projects'>, x: PmPay): { d: string; est: boolean } {
  if (x.due) return { d: x.due, est: false };
  const s = X.projects.find((p) => p.id === x.projectId);
  const n = x.name || '';
  const d = !s ? '' : /선급|착수|계약금/.test(n) ? s.start : /잔금|완료|준공|검수/.test(n) ? s.end
    : /중도/.test(n) && s.start && s.end ? addDays(s.start, Math.round(diffDays(s.start, s.end) / 2)) : '';
  return { d: d || '', est: true };
}

/** 통합 사업 현황 '견적 이익률' (ovPct) — 계약 · 견적이 없으면 null */
export function ovPct(X: Pick<PlCtx, 'contracts'>, k: string) {
  const cs = X.contracts.filter((c) => c.projectId === k);
  if (!cs.length) return null;
  const t = cs.reduce((a, c) => { const x = cSum(c); return { rev: a.rev + x.rev, buy: a.buy + x.buy }; }, { rev: 0, buy: 0 });
  return { rev: t.rev, prof: t.rev - t.buy, pct: t.rev ? (t.rev - t.buy) / t.rev : null };
}

// ── 월별 · 연간 손익 (pMoneyPL) ─────────────────────────
export interface PlMonth { m: string; rev: number; plan: number; buy: number; lab: number; p: number; oh: number; net: number }
export interface PlFuture { m: string; fix: number; est: number; L: Array<{ x: PmPay; d: string; est: boolean }> }
export interface PlYear {
  Y: string;
  R: PlMonth[];
  T: Omit<PlMonth, 'm'>;
  cur: PlMonth | undefined;
  /** 연도 단추 */
  ys: string[];
  bySite: Array<{ p: PmProject; rev: number; buy: number; lab: number; p_: number }>;
  F: PlFuture[];
  /** 지난 예정 (이번 달에 모음) · 날짜를 알 수 없는 대금 */
  late: Array<{ x: PmPay; d: string; est: boolean }>;
  nod: Array<{ x: PmPay; d: string; est: boolean }>;
  m0: string;
}
const mPlus = (m0: string, i: number) => { const d = new Date(+m0.slice(0, 4), +m0.slice(5) - 1 + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export function plYear(X: PlCtx, Y: string): PlYear {
  const ms = Array.from({ length: 12 }, (_, i) => `${Y}-${String(i + 1).padStart(2, '0')}`);
  const rd = (x: PmPay) => revDate(X.cfg, x);
  const m0 = X.today.slice(0, 7);
  const revM = (m: string) => X.pays.filter((x) => rd(x).startsWith(m)).reduce((a, x) => a + payAmt(X, x), 0);
  // 예정 매출 = 아래 '앞으로 12개월'과 같은 기준: 예정일, 없으면 단계 이름으로 추정한 날. 이미 지난 예정은 이번 달로
  const planMon = (x: PmPay) => { const g = payGuess(X, x); return !g.d ? '' : g.d.slice(0, 7) < m0 ? m0 : g.d.slice(0, 7); };
  const planM = (m: string) => X.pays.filter((x) => !rd(x) && planMon(x) === m).reduce((a, x) => a + payAmt(X, x), 0);
  const buyM = (m: string) => X.costs.filter((x) => x.date.startsWith(m)).reduce((a, x) => a + x.amt, 0) + X.pays.filter((x) => rd(x).startsWith(m)).reduce((a, x) => a + payBuy(X, x), 0);
  const labM = (m: string) => X.hours.filter((r) => r.d >= `${m}-01` && r.d <= `${m}-31` && r.projectId).reduce((a, r) => a + r.h, 0) * kosaH(X.cfg);
  const R: PlMonth[] = ms.map((m) => { const rev = revM(m), buy = buyM(m), lab = labM(m), oh = ohOf(X, m), p = rev - buy - lab; return { m, rev, plan: planM(m), buy, lab, p, oh, net: p - oh }; });
  const T = R.reduce((a, r) => ({ rev: a.rev + r.rev, plan: a.plan + r.plan, buy: a.buy + r.buy, lab: a.lab + r.lab, p: a.p + r.p, oh: a.oh + r.oh, net: a.net + r.net }), { rev: 0, plan: 0, buy: 0, lab: 0, p: 0, oh: 0, net: 0 });
  const cur = R.find((r) => r.m === m0);
  const ty = X.today.slice(0, 4);
  const ys = [...new Set([ty, String(+ty - 1), ...X.pays.map((x) => (rd(x) || x.due).slice(0, 4)).filter(Boolean)])].sort();
  const bySite = X.projects.map((p) => {
    const mine = X.pays.filter((x) => x.projectId === p.id && rd(x).startsWith(Y));
    const rev = mine.reduce((a, x) => a + payAmt(X, x), 0);
    const buy = X.costs.filter((x) => x.projectId === p.id && x.date.startsWith(Y)).reduce((a, x) => a + x.amt, 0) + mine.reduce((a, x) => a + payBuy(X, x), 0);
    const lab = laborOf(X, p.id, `${Y}-01-01`, `${Y}-12-31`).amt;
    return { p, rev, buy, lab, p_: rev - buy - lab };
  }).filter((x) => x.rev || x.buy || x.lab);
  // 앞으로 12개월 예상 매출: 아직 매출로 안 잡힌 대금 (예정일, 없으면 추정일)
  const fut = Array.from({ length: 12 }, (_, i) => mPlus(m0, i));
  const open = X.pays.filter((x) => !rd(x)).map((x) => ({ x, ...payGuess(X, x) }));
  const late = open.filter((o) => o.d && o.d.slice(0, 7) < m0);
  const nod = open.filter((o) => !o.d);
  const F = fut.map((m, i) => {
    const L = open.filter((o) => o.d && (o.d.slice(0, 7) === m || (i === 0 && o.d.slice(0, 7) < m0)));
    return { m, fix: L.filter((o) => !o.est).reduce((a, o) => a + payAmt(X, o.x), 0), est: L.filter((o) => o.est).reduce((a, o) => a + payAmt(X, o.x), 0), L };
  });
  return { Y, R, T, cur, ys, bySite, F, late, nod, m0 };
}

// ── 보여 주기 ─────────────────────────────────────
/** 원 → 만원 표 숫자 (man) */
export const man = (n: number | null | undefined) => (n == null ? '-' : Math.round(n / 10000).toLocaleString());
/** 원 → '3.93억원' · '1,234만원' (manW) */
export const manW = (n: number) => {
  n = +n || 0;
  const a = Math.abs(n);
  return `${n < 0 ? '−' : ''}${a >= 1e8 ? (a / 1e8).toFixed(2).replace(/\.?0+$/, '') + '억' : Math.round(a / 1e4).toLocaleString() + '만'}원`;
};

// ── 입력 창 값 ─────────────────────────────────────
/** 대금 단계 창 확인 (mnPayForm) */
export function payCheck(v: { cid: string; name: string; rate: string; amt: string }): [string, string] | null {
  if (!v.cid) return ['계약을 골라 주세요', 'cid'];
  if (!v.name.trim()) return ['단계 이름을 넣어 주세요', 'name'];
  if (v.rate.trim() !== '' && !(+v.rate >= 0 && +v.rate <= 100)) return ['비율은 0~100 사이로 넣어 주세요', 'rate'];
  if (v.amt.trim() !== '' && !(+v.amt >= 0)) return ['금액은 0 이상으로 넣어 주세요', 'amt'];
  return null;
}
/** 원가 변경 창 확인 (mnCostForm) — 날짜 · 금액 필수 */
export function costCheck(v: { date: string; amt: string }): [string, string] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return ['날짜를 넣어 주세요', 'date'];
  if (v.amt.trim() === '' || !Number.isFinite(+v.amt)) return ['바뀐 금액을 넣어 주세요 (줄면 −)', 'amt'];
  return null;
}
/** 만원 칸 → 원 (데모 Math.round(x × 10000)) — 비우면 null */
export const manToWon = (s: string) => (s.trim() === '' ? null : Math.round(+s * 10000));
/** 원 → 만원 칸 (비우면 '') */
export const wonToMan = (n: number | null | undefined) => (n == null ? '' : String(n / 10000));
