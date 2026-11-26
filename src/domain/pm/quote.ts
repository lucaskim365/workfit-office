import { z } from 'zod';
import type { PmProject } from './schema';
import { planSum, type PmPlan } from './site';
import { FUND_SRC, PL_CATS, ciKind, ciKindSort, ciNorm, ciUse, ruleText, wonText, type PmFundRule, type PmItem, type PmMoneyCfg, type QtSec } from './money';

/**
 * 견적 작성 · 계약 · 재원 · 대금 (데모 4713~5090 '견적 작성 · 엑셀 내보내기' · fundOf 4460 · moneySeed 4422 · moneySeed2 5151) — 6-5.
 * 견적은 품목 단위로 작성 → 계약 매출 · 매입(lines)과 사업비 현황(fundOf)이 같은 데이터에서 계산된다.
 * 금액은 원 (데모도 견적은 원). 지원 기준표 상한은 6-4 에서 이미 원으로 바꿈.
 * 사업별 수익 · 손익(6-6)이 계약 · 재원 · 대금을 그대로 쓴다.
 */

export const QT_SEC_TITLE: ReadonlyArray<readonly [QtSec, string]> = [['sw', '1. 소프트웨어'], ['hw', '2. 하드웨어'], ['etc', '3. 기타비용']];
/** 줄을 새로 넣을 때 표지 분류 (데모 QT_CAT0) */
export const QT_CAT0: Record<QtSec, string> = { sw: 'MES개발비', hw: '디바이스', etc: '기타(임치·정산·교육)' };
export const ETC_CAT = '기타(임치·정산·교육)';
/** '1,234' · 빈 칸 → 숫자 (데모 qNum) */
export const qNum = (v: unknown) => (typeof v === 'number' ? v : +String(v ?? '').replace(/[^\d.-]/g, '') || 0);

// ── 견적 · 계약 ─────────────────────────────────────
export const pmQuoteItemSchema = z.object({
  sec: z.enum(['sw', 'hw', 'etc']),
  /** 품목 · 단가 목록에서 고른 품목 ID (없으면 직접 쓴 줄) */
  pid: z.string().default(''),
  name: z.string().default(''),
  desc: z.string().default(''),
  qty: z.number().default(1),
  unit: z.string().default(''),
  /** 공급단가 · 매입단가 (원, VAT 별도) */
  price: z.number().default(0),
  cost: z.number().default(0),
  /** 받은 금액 그대로 냄 (기타비용 — 매입 = 공급금액) */
  pass: z.boolean().default(false),
  note: z.string().default(''),
  /** 견적서 표지 분류 */
  cat: z.string(),
});
export type PmQuoteItem = z.infer<typeof pmQuoteItemSchema>;

export const pmQuoteSchema = z.object({
  date: z.string().default(''),
  no: z.string().default(''),
  /** 수신 · 참조 · 담당자 */
  to: z.string().default(''),
  ref: z.string().default(''),
  mgr: z.string().default(''),
  valid: z.string().default(''),
  /** 지불조건 — 새 견적 저장 때 '선급금 50%' 같은 글에서 대금 단계를 만듦 */
  pay: z.string().default(''),
  /** Project (견적 제목) */
  proj: z.string().default(''),
  /** 한 줄에 하나, 비우면 회사 기본 문구 */
  remarks: z.string().default(''),
  items: z.array(pmQuoteItemSchema).default([]),
});
export type PmQuote = z.infer<typeof pmQuoteSchema>;

const lineSchema = z.object({ cat: z.string(), rev: z.number().int(), buy: z.number().int() });
export type PmContractLine = z.infer<typeof lineSchema>;
export const pmContractSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['정부지원', '자체']).default('정부지원'),
  status: z.enum(['견적', '계약']).default('견적'),
  /** 금액 확인됨 (아니면 '확인 필요') */
  conf: z.boolean().default(true),
  note: z.string().default(''),
  /** 품목 견적 — 없으면 항목별 금액만 있는 예전 계약(신광) */
  q: pmQuoteSchema.nullable().default(null),
  /** 표지 분류별 매출 · 매입 (원) */
  lines: z.array(lineSchema).default([]),
});
export type PmContract = z.infer<typeof pmContractSchema>;

// ── 재원 (사업마다, 데모 S.money.fund) ─────────────────
const fixSchema = z.object({ gov: z.number().optional(), do: z.number().optional(), si: z.number().optional(), etc: z.number().optional() });
export type FundKey = (typeof FUND_SRC)[number][0];
export const pmFundSchema = z.object({
  /** 사업 ID */
  id: z.string().min(1),
  /** 고른 지원 기준 ID ('' = 사업구분 · 연도로 자동) */
  rule: z.string().default(''),
  /** 사람이 기준을 고름 */
  ruleSet: z.boolean().default(false),
  /** ④ 인력 현물 (원) */
  man: z.number().default(0),
  /** ⑤ 클라우드 월 단가 · 개월 수 — null 이면 단가 · 계산 기준 값 */
  cloudMonthly: z.number().nullable().default(null),
  cloudM: z.number().nullable().default(null),
  /** 확정 금액 (원) — 계약서 · 계획서 금액이 있으면 계산보다 우선 */
  fix: fixSchema.default({}),
  fixNote: z.string().default(''),
});
export type PmFund = z.infer<typeof pmFundSchema>;

// ── 대금 일정 (데모 S.money.pays — 화면은 6-6) ─────────────
export const pmPaySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  /** 계약 ID */
  cid: z.string(),
  name: z.string(),
  /** 계약 금액의 % — 금액(amt)이 있으면 그것 */
  rate: z.number().default(0),
  amt: z.number().nullable().default(null),
  due: z.string().default(''),
  inv: z.string().default(''),
  paid: z.string().default(''),
});
export type PmPay = z.infer<typeof pmPaySchema>;

// ── 계산 ────────────────────────────────────────────
/** 새 줄 (데모 qIt) */
export const qIt = (sec: QtSec, o: Partial<PmQuoteItem> = {}): PmQuoteItem => ({
  sec, pid: '', name: '', desc: '', qty: 1, unit: sec === 'sw' ? '식' : 'set', price: 0, cost: 0, pass: sec === 'etc', note: '', cat: QT_CAT0[sec], ...o,
});
/** 공급금액 = 수량 × 공급단가 */
export const qAmt = (it: Pick<PmQuoteItem, 'qty' | 'price'>) => qNum(it.qty) * qNum(it.price);
/** 매입: '그대로'(기타비용) = 공급금액, 나머지 = 수량 × 매입단가 (협력사 견적, NEGO 후) */
export const qBuy = (it: Pick<PmQuoteItem, 'qty' | 'price' | 'cost' | 'pass'>) => (it.pass ? qAmt(it) : qNum(it.qty) * qNum(it.cost));
/** 표지 분류별 매출 · 매입 (원 반올림) */
export function qLines(q: Pick<PmQuote, 'items'>): PmContractLine[] {
  const sum: Record<string, { rev: number; buy: number }> = {};
  for (const it of q.items) { const x = (sum[it.cat] ??= { rev: 0, buy: 0 }); x.rev += qAmt(it); x.buy += qBuy(it); }
  return PL_CATS.map((cat) => ({ cat, rev: Math.round(sum[cat]?.rev ?? 0), buy: Math.round(sum[cat]?.buy ?? 0) }));
}
export const cSum = (c: Pick<PmContract, 'lines'>) => c.lines.reduce((a, l) => ({ rev: a.rev + l.rev, buy: a.buy + l.buy }), { rev: 0, buy: 0 });
/** 새 견적 — 빈 상태로 시작, 줄은 [품목에서 고르기]로 (11/10 사용자 결정) */
export const qNew = (today: string): PmQuote => ({
  date: today, no: `Workfit-SF${today.replace(/-/g, '')}-001`, to: '', ref: '', mgr: '', valid: '견적일로부터 1개월', pay: '현금결제 조건 / 선급금 50%, 잔금 50%', proj: '', remarks: '', items: [],
});
/** 품목 없이 항목별 금액만 있는 예전 계약(신광) → 항목마다 한 줄 */
export function qFromLines(c: Pick<PmContract, 'lines'>, today: string): PmQuote {
  const sw = ['MES개발비', '전처리', '경비'];
  return { ...qNew(today), date: '', no: '', pay: '', items: c.lines.filter((l) => l.rev || l.buy).map((l) => qIt(sw.includes(l.cat) ? 'sw' : /^기타/.test(l.cat) ? 'etc' : 'hw', { name: l.cat, cat: l.cat, unit: '식', price: l.rev, cost: l.buy, pass: false })) };
}

/** 견적 작성 화면 값 (데모 UI.qe) */
export interface QuoteDraft {
  /** 고치는 계약 ID (새 견적이면 '') */
  cid: string;
  projectId: string;
  name: string;
  kind: PmContract['kind'];
  status: PmContract['status'];
  note: string;
  /** 품목 없는 예전 계약을 줄로 바꿔 보여 줌 */
  conv: boolean;
  q: PmQuote;
  /** 사업비 현황 칸 — local = ⑥ 지방비 확정(원, 비우면 null) */
  f: { rule: string; man: number; cloudMonthly: number; cloudM: number; local: number | null };
}
/** 견적 열기 (데모 qOpen) */
export function quoteDraft(c: PmContract | null, projectId: string, fund: PmFund | undefined, cfg: PmMoneyCfg, today: string): QuoteDraft {
  const f = fund ?? pmFundSchema.parse({ id: projectId });
  return {
    cid: c?.id ?? '', projectId, name: c?.name ?? '', kind: c?.kind ?? '정부지원', status: c?.status ?? '견적', note: c?.note ?? '', conv: !!c && !c.q,
    q: structuredClone(c ? c.q ?? qFromLines(c, today) : qNew(today)),
    f: { rule: f.ruleSet ? f.rule : '', man: f.man || 0, cloudMonthly: f.cloudMonthly ?? cfg.cloudMonthly, cloudM: f.cloudM ?? cfg.cloudMonths, local: f.fix.do ?? null },
  };
}

// ── 지원 기준 고르기 · 사업비 구성 (fundOf) ─────────────────
/** 지역 (데모 REGIONS · regionOf — 사업 소재지 → 계획서 지역) */
const REGIONS: ReadonlyArray<readonly [string, string]> = [['경남', '경상남도|경남'], ['경북', '경상북도|경북'], ['전북', '전라북도|전북'], ['전남', '전라남도|전남'], ['충남', '충청남도|충남'], ['충북', '충청북도|충북'], ['경기', '경기'], ['강원', '강원'], ['광주', '광주'], ['부산', '부산'], ['대구', '대구'], ['울산', '울산'], ['대전', '대전'], ['인천', '인천'], ['서울', '서울'], ['세종', '세종'], ['제주', '제주']];
export const regionOf = (p: PmProject | undefined, plan: PmPlan | undefined) => {
  const t = (p && (p.region || plan?.region)) || '';
  return REGIONS.find(([, re]) => new RegExp(re).test(t))?.[0] ?? '';
};
export const bizKey = (b: string) => {
  const s = String(b ?? '').replace(/\s/g, '');
  return /부처협업/.test(s) ? '부처협업형' : /제조AI/i.test(s) ? '제조AI특화' : /자율형/.test(s) ? '자율형공장' : /상생/.test(s) ? '대중소상생형' : /지역특화/.test(s) ? '지역특화형' : /일반형|정부형/.test(s) ? '정부형' : '';
};
/** 지원 기준 자동 선택: 사업구분 + 시작 연도로 '전국' 기준만 (지방비는 사람이 고름) */
export function autoRule(p: PmProject | undefined, rules: readonly PmFundRule[], today: string): PmFundRule | null {
  if (!p) return null;
  const key = bizKey(p.biz);
  const yr = +(p.start || today).slice(0, 4);
  if (!key) return null;
  const rs = rules.filter((r) => r.region === '전국' && r.biz.replace(/\s/g, '').startsWith(key));
  return rs.find((r) => r.year === yr) ?? [...rs].sort((a, b) => b.year - a.year)[0] ?? null;
}

export interface FundCtx {
  projects: readonly PmProject[];
  plans: Record<string, PmPlan>;
  rules: readonly PmFundRule[];
  cfg: PmMoneyCfg;
  contracts: readonly PmContract[];
  funds: readonly PmFund[];
  today: string;
}
export interface FundRow { key: FundKey; name: string; rate: number | null; cap: number | null; calc: number | null; fix: number | null; fromPlan: boolean; use: number | null }
export interface FundOf {
  f: PmFund; r: PmFundRule | null; auto: boolean; reg: string; regN: number; none: boolean; build: number; cloud: number; man: number;
  usePlan: boolean; planKind: number; total: number; planTot: number; plan: PmPlan | null; rows: FundRow[]; self: number; unknown: boolean;
}
/** 견적 화면의 저장 전 값 (데모 qOv 결과) */
export interface FundOverride { f: PmFund; solo: boolean; noPlan: boolean; cs: PmContract[] }

export const cloudMo = (f: PmFund, cfg: PmMoneyCfg) => f.cloudMonthly ?? cfg.cloudMonthly;
export const cloudAmt = (f: PmFund, cfg: PmMoneyCfg) => cloudMo(f, cfg) * (f.cloudM ?? cfg.cloudMonths);
const hasFix = (f: PmFund, k: FundKey) => f.fix[k] != null;

/** 사업비 구성: 총사업비 = 정부지원 계약 견적 합계 + 인력 현물 + 클라우드 현물 → 재원별 = min(총사업비 × 비율, 상한), 확정 금액이 있으면 그것 (데모 fundOf) */
export function fundOf(c: FundCtx, k: string, ov?: FundOverride): FundOf {
  const f = ov ? ov.f : c.funds.find((x) => x.id === k) ?? pmFundSchema.parse({ id: k });
  const CS = ov ? ov.cs : c.contracts;
  const st = c.projects.find((x) => x.id === k);
  const auto = !f.rule && !f.ruleSet ? autoRule(st, c.rules, c.today) : null;
  const r = c.rules.find((x) => x.id === f.rule) ?? auto;
  const reg = regionOf(st, c.plans[k]);
  const regN = reg ? c.rules.filter((x) => x.region === reg).length : 0;
  const build = CS.filter((x) => x.projectId === k && x.kind === '정부지원').reduce((a, x) => a + cSum(x).rev, 0);
  const pl = ov && ov.noPlan ? null : c.plans[k] ?? null;
  const hasB = !!(pl && pl.budget);
  // 계획서 4.1 총괄 (천원 → 원)
  const planGov = hasB ? planSum(pl!, 2) * 1000 : 0;
  const planTot = hasB ? planSum(pl!) * 1000 : 0;
  const planKind = hasB ? planSum(pl!, 1) * 1000 : 0;
  // 견적이 아직 없으면 사업계획서 총괄의 총사업비 · 현물을 그대로 씀
  const none = !build && !planTot;
  const usePlan = !build && !!planTot;
  const cloud = usePlan || none ? 0 : cloudAmt(f, c.cfg);
  const total = usePlan ? planTot : build + (f.man || 0) + cloud;
  const inKind = usePlan ? planKind : (f.man || 0) + cloud;
  const rows: FundRow[] = [];
  for (const [key, nm] of FUND_SRC) {
    const v = r ? r[key] : null;
    if (!v && !f.fix[key] && !(key === 'gov' && planGov)) continue;
    const rate = v ? v.rate : null;
    const cap = v ? v.cap : null;
    const name = key === 'etc' && r?.etc ? r.etc.name : nm;
    const calc = rate == null ? null : Math.min(total * rate / 100, cap == null ? Infinity : cap);
    const plan = key === 'gov' && planGov ? planGov : 0;
    const fix = hasFix(f, key) ? f.fix[key]! : plan || null;
    rows.push({ key, name, rate, cap, calc, fix, fromPlan: !!plan && !hasFix(f, key), use: fix != null ? fix : calc });
  }
  if (r && r.capLocal) {
    const loc = rows.filter((x) => x.key === 'do' || x.key === 'si');
    const sum = loc.reduce((a, x) => a + (x.use || 0), 0);
    // 데모 그대로: 비율을 모르는 칸(null)도 0 으로 나눠 잡힘
    if (sum > r.capLocal) for (const x of loc) if (x.fix == null) x.use = (x.use ?? 0) * r.capLocal / sum;
  }
  const sup = rows.reduce((a, x) => a + (x.use || 0), 0);
  const unknown = rows.some((x) => x.use == null);
  return { f, r, auto: !!auto, reg, regN, none, build, cloud, man: usePlan ? 0 : f.man || 0, usePlan, planKind, total, planTot, plan: pl, rows, self: total - sup - inKind, unknown };
}

/** 사업에 이 견적 말고 다른 정부지원 계약 (있으면 이 견적 금액만으로 계산 — 11/10 신광 시험 견적이 기존 계약과 합쳐지던 문제) */
export const qOthers = (contracts: readonly PmContract[], E: QuoteDraft) => contracts.filter((x) => x.projectId === E.projectId && x.kind === '정부지원' && x.id !== E.cid);
export function qOv(c: FundCtx, E: QuoteDraft): FundOverride {
  const base = c.funds.find((x) => x.id === E.projectId) ?? pmFundSchema.parse({ id: E.projectId });
  const solo = !qOthers(c.contracts, E).length;
  const fix: PmFund['fix'] = solo ? { ...base.fix } : {};
  if (E.f.local != null) fix.do = E.f.local; else delete fix.do;
  const f: PmFund = { ...base, rule: E.f.rule, ruleSet: !!E.f.rule, man: qNum(E.f.man), cloudMonthly: qNum(E.f.cloudMonthly), cloudM: qNum(E.f.cloudM), fix };
  return { f, solo, noPlan: !solo, cs: [{ id: '__draft', projectId: E.projectId, name: E.name || '-', kind: E.kind, status: E.status, conf: true, note: '', q: null, lines: qLines(E.q) }] };
}

/** 사업비 현황 ①~⑧ 한 줄 — l = 이름, v = 금액(원, null = 확인 필요), n = 기준, b = 굵게 */
export interface FundLine { l: string; v: number | null; n: string; b?: boolean }
/** 사업비 현황 ①~⑧ — 화면 · 엑셀이 같은 줄을 씀 (데모 qFundRows) */
export function qFundRows(F: FundOf, cfg: PmMoneyCfg): FundLine[] {
  const g = F.rows.find((x) => x.key === 'gov');
  const loc = F.rows.filter((x) => x.key === 'do' || x.key === 'si');
  const ex = F.rows.filter((x) => x.key === 'etc');
  const why = (x: FundRow | undefined) => (!x ? '-' : x.fromPlan ? '사업계획서 확정 금액' : x.fix != null ? '확정 금액' : x.rate == null ? '비율 확인 필요' : `① X ${x.rate}%${x.cap != null ? `(최대 ${wonText(x.cap)})` : ''}`);
  const mo = cloudMo(F.f, cfg);
  const mm = F.f.cloudM ?? cfg.cloudMonths;
  const lu = loc.some((x) => x.use == null) ? null : loc.reduce((a, x) => a + x.use!, 0);
  return [
    { l: '① 사업금액', v: F.total, n: '② + ④ + ⑤', b: true },
    { l: '② 구축금액', v: F.build, n: '워크핏㈜ 견적금액' },
    { l: '③ 정부지원금', v: g ? g.use : null, n: why(g) + (F.r ? ` · ${ruleText(F.r)}` : '') },
    { l: '④ 인력지원금(현물)', v: F.man, n: '도입기업 투입인력 현물인건비' },
    { l: '⑤ 클라우드 지원금(현물)', v: F.cloud, n: F.cloud ? `${mo.toLocaleString()}원*${mm}개월` : '없음' },
    { l: '⑥ 지방비 지원금', v: loc.length ? lu : 0, n: loc.length ? loc.map(why).join(' · ') : '① X 지원비율 지자체 예산에 따라 변동 가능' },
    ...ex.map((x) => ({ l: `⑥ ${x.name} 지원금`, v: x.use, n: why(x) })),
    { l: '⑦ 도입기업 실제 자부담금', v: F.unknown ? null : F.self, n: '① - (③ + ④ + ⑤ + ⑥)', b: true },
    { l: '⑧ 착수금', v: F.unknown ? null : F.self, n: 'RCMS 계좌에 송금' },
  ];
}

// ── 품목에서 고르기 · 직접 쓴 줄 등록 · 지난 견적 쌓기 ─────────
export interface PickFilter { sec: QtSec; q: string; all: boolean; freq: boolean; kind: string }
/** [품목에서 고르기] 목록 (데모 qPickList) — 종류별 개수 · 고른 종류의 줄 */
export function pickList(items: readonly PmItem[], P: PickFilter) {
  const q = ciNorm(P.q);
  const L0 = items.filter((it) => (P.all || it.sec === P.sec) && (!q || ciNorm(it.name + it.desc + it.grp).includes(q)) && (!P.freq || ciUse(it) >= 2));
  const cnt: Record<string, number> = {};
  for (const it of L0) { const k = ciKind(it); cnt[k] = (cnt[k] ?? 0) + 1; }
  const kind = P.kind && cnt[P.kind] ? P.kind : '';
  return { all: L0.length, cnt, kind, rows: L0.filter((it) => !kind || ciKind(it) === kind).sort(ciKindSort) };
}
/** 고른 품목 → 견적 줄 (데모 qPickGo — 단가 · 매입 · 사양 그대로, 넣은 뒤엔 이 견적에서만 고침) */
export const pickToLine = (it: PmItem, sec: QtSec, qty: number): PmQuoteItem => qIt(sec, {
  pid: it.id, name: it.name, desc: it.desc, qty: qty || 1, unit: it.unit, price: it.price, cost: it.pass ? 0 : it.cost ?? 0, pass: it.pass, cat: it.cat, note: it.note,
});
/** 직접 쓴 줄 중 목록에 없는 것 — 이름 · 금액이 있고, 사업마다 다른 MES 개발 줄은 뺌 (데모 qNewRows) */
export const qNewRows = (items: readonly PmItem[], q: Pick<PmQuote, 'items'>) => q.items.filter((it) => !it.pid && String(it.name).trim() && qNum(it.price)
  && !(it.sec === 'sw' && it.cat === 'MES개발비') && !items.some((c) => ciNorm(c.name) === ciNorm(it.name)));
/** 견적 줄 → 새 품목 (데모 qRegRows — 지난 견적 1줄과 함께) */
export const lineToItem = (it: PmQuoteItem, id: string, src: string, date: string): PmItem => ({
  id, name: String(it.name).replace(/\s*\n\s*/g, ' ').trim(), sec: it.sec, kind: '', cat: it.cat, unit: it.unit, desc: it.desc, price: Math.round(qNum(it.price)),
  cost: it.pass ? null : Math.round(qNum(it.cost)) || null, pass: it.pass, vendor: '', grp: '', vary: false, note: it.note,
  hist: [{ src, date, price: Math.round(qNum(it.price)), cost: it.pass ? null : Math.round(qNum(it.cost)) || null, qty: qNum(it.qty), cid: '' }],
});
/**
 * 견적 저장 때: 고른 품목의 지난 견적에 이 견적을 남기고, 가장 최근이면 기본 단가도 이 값 (데모 qHist — 기본 = 가장 최근 견적 단가).
 * 데모와 다름 (7-1, 설계 5.7.0 · 6.1 — 11/25 사용자 결정): 매입단가 '확인 필요'(null) 품목을 고르면 견적 줄 매입이 0 으로 들어감 →
 * 그 줄 매입이 0 이면 목록 매입단가를 0 으로 바꾸지 않고('확인 필요' 그대로 · 이익률 100% 로 안 보이게), 지난 견적 줄 매입도 0 대신 '-'(null).
 * 공급단가 · 지난 견적 쌓기는 그대로.
 */
export function qHist(items: PmItem[], c: PmContract, src: string, today: string) {
  if (!c.q) return;
  const date = c.q.date || today;
  for (const it of c.q.items) {
    if (!it.pid) continue;
    const ci = items.find((x) => x.id === it.pid);
    if (!ci) continue;
    const cost = Math.round(qNum(it.cost));
    const unknown = !it.pass && !cost && ci.cost == null;
    ci.hist = ci.hist.filter((h) => h.cid !== c.id);
    ci.hist.push({ cid: c.id, src, date, price: Math.round(qNum(it.price)), cost: it.pass || unknown ? null : cost, qty: qNum(it.qty) });
    ci.hist.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (ci.hist[0].cid === c.id) { ci.price = Math.round(qNum(it.price)); if (!it.pass && !unknown) ci.cost = cost; }
  }
}
/** 새 견적의 지불조건(선급금 50%, 잔금 50% 등) → 대금 단계 이름 · 비율 */
export const paysFromTerms = (pay: string) => [...String(pay ?? '').matchAll(/([가-힣]+금)\s*(\d+)\s*%/g)].map((m) => ({ name: `${m[1]} ${m[2]}%`, rate: +m[2] }));
/** 저장 전 확인 (데모 qSave) */
export function quoteCheck(E: QuoteDraft): [string, 'name' | 'items'] | null {
  if (!E.name.trim()) return ['계약 이름을 넣어 주세요', 'name'];
  if (!E.q.items.some((it) => qAmt(it))) return ['금액이 있는 품목이 하나도 없습니다', 'items'];
  return null;
}

// ── 처음 값 (데모 moneySeed 신광 · moneySeed2 효광(제조AI)) ─────────
export interface MoneySeed { contracts: PmContract[]; funds: PmFund[]; pays: PmPay[] }
const ESC = '■ 업무수행과제\n ▪ 사업신청서 작성   ▪ 사업계획서 작성\n ▪ 스마트공장 신청 및 접수   ▪ 기술성평가 수검\n ▪ 현장점검 수검   ▪ 원가계산 자료 작성 및 제출\n ▪ 과제협약   ▪ 착수계 작성 및 사업 일정표 작성\n ▪ 각종 회의록 작성   ▪ 일일 / 주간 / 월간 업무수행일지 작성\n ▪ 중간점검보고서 작성   ▪ 완료점검보고서 작성\n ▪ 사업감리 수행   ▪ 지방비 공고 확인 및 지원 신청서 작성 등';
export function seedMoney(projects: readonly PmProject[]): MoneySeed {
  const out: MoneySeed = { contracts: [], funds: [], pays: [] };
  const pay = (id: string, projectId: string, cid: string, name: string, rate: number) => out.pays.push(pmPaySchema.parse({ id, projectId, cid, name, rate }));
  // 신광테크 첫 사례 — 프관/돈/(주)신광테크_MES 시스템 구축 총괄견적_내부용.xlsx '표지' · '사업비 정리' 시트 값
  const s = projects.find((p) => /신광/.test(p.company));
  if (s) {
    const L = (o: Record<string, [number, number]>) => PL_CATS.map((cat) => ({ cat, rev: (o[cat] ?? [0, 0])[0], buy: (o[cat] ?? [0, 0])[1] }));
    out.contracts.push(pmContractSchema.parse({ id: 'C1', projectId: s.id, name: '부처협업형 정부지원 MES 구축', kind: '정부지원', status: '계약', conf: true, note: '총괄견적_내부용 · 신광테크_부처협업형 시트',
      lines: L({ 'MES개발비': [175000000, 0], '전처리': [5000000, 2310000], '경비': [15000000, 0], 'PLC제어': [0, 12000000], '디바이스': [82660000, 90800000], '산업보안(OT/IT)': [800000, 0], '계측기 · 자동화': [0, 54000000], 'PLC': [78500000, 81900000], '네트워크': [33500000, 30500000], [ETC_CAT]: [2360000, 2360000] }) }));
    out.contracts.push(pmContractSchema.parse({ id: 'C2', projectId: s.id, name: '자체 추가계약 (MES 추가 개발 · 키오스크)', kind: '자체', status: '계약', conf: false,
      note: '금액이 파일마다 다름 — 표지 2억 2,120만 · 사업비 정리 1억 9,200만+키오스크 2,920만 · 추가계약 견적서 3억 4,408만. 계약서 금액 확인 필요 (지금은 표지 값)',
      lines: L({ 'MES개발비': [155000000, 0], '디바이스': [29200000, 28350000], 'PLC': [22000000, 21000000], '네트워크': [15000000, 10830000] }) }));
    out.funds.push(pmFundSchema.parse({ id: s.id, rule: 'F2', man: 0, fix: { gov: 194400000 }, fixNote: '사업비 정리 시트의 정부지원금 (총사업비의 정확히 50%가 아님)' }));
    pay('D1', s.id, 'C1', '선급금 50%', 50); pay('D2', s.id, 'C1', '잔금 50%', 50);
  }
  // 효광(제조AI) 최종 견적 — 프관/돈/효광(제조AI)/(주)효광_견적자료(제조AI_도입장비 서버포함) 20260508_V1.0.xlsx 품목 그대로 (합계 381,960,000 · 매입 150,050,000).
  // 정부지원금은 견적서가 아니라 이후 사업계획서 V2.0(지원금 감액) — fundOf 가 계획서 4.1 총괄 값을 자동으로 씀
  const h = projects.find((p) => /효광/.test(p.company) && /제조\s*AI/i.test(p.biz));
  if (h) {
    const q: PmQuote = { date: '2026-05-08', no: 'Workfit-SF20260508-001', to: '㈜효광', ref: '최지희 이사님', mgr: 'AX사업부 영업팀 홍형표 팀장', valid: '견적일로부터 1개월', pay: '현금결제 조건 / 선급금 50%, 잔금 50%', proj: '2026년 제조AI 특화형 스마트팩토리 지원 구축 견적', remarks: '',
      items: [qIt('sw', { name: 'AI 개발\n(제조 AI특화)', price: 180000000, note: 'AI 분석모델\n신규개발 포함', desc: '■ AI 검색 엔진 \n ▪ AI 분석모델 ▪ AI 예측  ▪ AI 데이터  ▪ AI 최적화  ▪ AI예지보전\n ▪ MLOps ▪ 운영지원  ▪ 보안관리  ▪ 피드백관리 ▪ 데이터기능\n ▪ 이상징후 · 불량예측 · 라벨링 · 학습데이터 · 원인분석 · 가이드 \n ▪ 조건추천 · 에이전트 · 고장예지 · 모델운영 · 알람' }),
        qIt('sw', { name: '스마트팩토리\n진행경비', cat: '경비', unit: 'set', price: 15000000, desc: ESC }),
        qIt('hw', { name: '반자동조립 및 비전검사기', cat: '설비', price: 100000000, cost: 100000000, desc: '■ 반자동조립·비전검사기 \n • Main Control : 산업용 PC(Advantechi7(Win10))\n • Sub Control : LS-PLC( CPU & A/D, I/O)\n • Display & Control : 24” Touch Monitor \n • Vision Camera:5M급 4Set(조명 포함)\n • Load Cell : 0~50Kg 인장 압축 하중 측정(A/D방식 4~20mA)\n • Torque Sensor : 토크 값 확인 후 선정(A/D방식 0~20mA)\n • Current Sensor : 0~5A 측정용(A/D방식 0~5V)\n • 점등센서 : 점등 검사용 (A/D방식 0~5V)' }),
        qIt('hw', { name: 'AI 시스템 서버', price: 84600000, cost: 47690000, desc: "■ Supermicro AS-2126HS-TN\n ▪ CPU: AMD EPYC 9115 16Core\n ▪ RAM: 32GB DDR5-6400\n ▪ Storage OS SSD: 480GB SATA SSD ×2 (RAID1)\n ▪ Storage DATA: 3.84TB SATA SSD × 4EA\n ▪ GPU: NVIDIA L40S, PCIe Gen5 슬롯 장착, 300W, 48GB 패시브\n ▪ SMC : SMC System Management Software Suite Node License\n■ windows Sever 2025 DSP  (5 CAL)\n■ DBMS\n ▪ SQL Server 2022 Standard Edition 'SQL Server 2022 - 1 User 5CAL" }),
        qIt('etc', { name: '교육비', desc: ' ▪ 스마트공장 의무 교육', price: 1000000 }), qIt('etc', { name: '기술임치비용', desc: ' ▪ MES 프로그램 기술임치(2년)', price: 450000 }), qIt('etc', { name: '회계법인정산수수료', desc: ' ▪ 회계정산 수수료', price: 910000 })] };
    out.contracts.push(pmContractSchema.parse({ id: 'C3', projectId: h.id, name: '제조AI 특화 스마트공장 구축', kind: '정부지원', status: '계약', conf: true, note: '(주)효광_견적자료 20260508 V1.0 · 정부지원금은 사업계획서 V2.0(지원금 감액) 값', q, lines: qLines(q) }));
    out.funds.push(pmFundSchema.parse({ id: h.id, rule: '', man: 18000000, cloudMonthly: 0, cloudM: 0 }));
    pay('D3', h.id, 'C3', '선급금 50%', 50); pay('D4', h.id, 'C3', '잔금 50%', 50);
  }
  return out;
}
