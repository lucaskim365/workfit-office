import { z } from 'zod';

/**
 * 사업 · 손익 기준정보 (데모 4386~ '사업 · 손익' · pMoneyRules 4631 · pMoneyItems 4980) — 6-4.
 * - 지원 기준 · 단가: 클라우드 · 인건비 단가 · 매출 잡는 날짜(cfg) + 정부 · 지자체 지원 기준표(rules, 데모 FUND_SEED 13줄)
 * - 품목 · 단가: 견적에 넣는 장비 · 소프트웨어 목록(items, 데모 QT_CAT_SEED 89개 — 견적서 6건에서 뽑음)
 * 금액은 모두 원 정수로 저장 (데모는 지원 기준표 상한만 만원 → ×10,000). 화면 · 입력 칸은 데모처럼 상한 · 간접비는 만원.
 * 견적 작성(6-5) · 사업별 수익 · 재원(6-6)이 이 값을 씀.
 */

/** 견적서 표지 분류 (데모 PL_CATS) */
export const PL_CATS = ['MES개발비', '전처리', '경비', '설비', 'PLC제어', '디바이스', '산업보안(OT/IT)', '계측기 · 자동화', 'PLC', '네트워크', '기타(임치·정산·교육)'] as const;
/** 재원 (데모 FUND_SRC) */
export const FUND_SRC = [['gov', '정부'], ['do', '도비'], ['si', '시군비'], ['etc', '기타']] as const;
/** 매출 잡는 날짜 (데모 REV_BASIS) */
export const REV_BASIS = [['inv', '세금계산서 발행일'], ['paid', '입금일'], ['due', '대금 예정일']] as const;
export type RevBasis = (typeof REV_BASIS)[number][0];

// ── 단가 · 계산 기준 (데모 S.money.cfg) ─────────────────
export const pmMoneyCfgSchema = z.object({
  /** 클라우드 현물 월 단가 (원) · 기본 개월 수 */
  cloudMonthly: z.number().int().min(0).default(150000),
  cloudMonths: z.number().int().min(0).default(36),
  /** 인건비 단가 (원/월) · 이름 · 월 근무시간 */
  kosaMonthly: z.number().int().min(0).default(7754124),
  kosaName: z.string().default('2026 KOSA 응용SW개발자 월평균'),
  workH: z.number().min(1).default(209),
  revBasis: z.enum(['inv', 'paid', 'due']).default('inv'),
  /** 직원 인건비 반영 (업무계획 시간 × 단가) — 데모 기본 꺼짐 */
  laborOn: z.boolean().default(false),
  /** 기본 월 간접비 (원, 비우면 null) — 입력 창은 6-6 손익 */
  ohDefault: z.number().int().nullable().default(null),
});
export type PmMoneyCfg = z.infer<typeof pmMoneyCfgSchema>;
export const defaultMoneyCfg = (): PmMoneyCfg => pmMoneyCfgSchema.parse({});

// ── 정부 · 지자체 지원 기준 (데모 S.money.rules) ─────────
/** 비율(%, 모르면 null = '비율?') · 상한(원, 없거나 모르면 null). 칸 자체가 없으면 null */
const pairSchema = z.object({ rate: z.number().nullable(), cap: z.number().int().nullable() });
export type FundPair = z.infer<typeof pairSchema>;
export const pmFundRuleSchema = z.object({
  id: z.string().min(1),
  year: z.number().int(),
  region: z.string().min(1),
  /** 시군 (해당 시) */
  sigungu: z.string().default(''),
  biz: z.string().min(1),
  gov: pairSchema.nullable().default(null),
  do: pairSchema.nullable().default(null),
  si: pairSchema.nullable().default(null),
  /** 기타 재원 (예: 대기업(삼성)) */
  etc: pairSchema.extend({ name: z.string() }).nullable().default(null),
  /** 도비 + 시군비 합계 상한 (원) */
  capLocal: z.number().int().nullable().default(null),
  /** 공고 원문으로 확인함 */
  conf: z.boolean().default(false),
  src: z.string().default(''),
  url: z.string().default(''),
});
export type PmFundRule = z.infer<typeof pmFundRuleSchema>;

const NOTICE_URL = 'https://grant-documents.thevc.kr/282603_251031+(%EC%A0%9C2025-574%ED%98%B8)+26%EB%85%84+%EC%8A%A4%EB%A7%88%ED%8A%B8%EC%A0%9C%EC%A1%B0%ED%98%81%EC%8B%A0+%EC%A7%80%EC%9B%90%EC%82%AC%EC%97%85+%ED%86%B5%ED%95%A9%EA%B3%B5%EA%B3%A0(%EC%88%98%EC%A0%95).pdf';
/** 데모 [비율, 상한(만원)] → 원 */
const P = (rate: number | '', capMan: number | ''): FundPair => ({ rate: rate === '' ? null : rate, cap: capMan === '' ? null : capMan * 10000 });
/** 지원 기준표 처음 값 (데모 FUND_SEED 4396 — 2026 스마트 제조혁신 통합공고 · 지역 공고 · 기사 · 회사 견적, 11/9 조사) */
export function seedFundRules(): PmFundRule[] {
  const R = (o: Partial<PmFundRule> & Pick<PmFundRule, 'id' | 'region' | 'biz'>) => pmFundRuleSchema.parse({ year: 2026, ...o });
  return [
    R({ id: 'F1', region: '전국', biz: '정부형', gov: P(50, 20000), conf: true, src: '통합공고 1쪽', url: NOTICE_URL }),
    R({ id: 'F2', region: '전국', biz: '부처협업형', gov: P(50, 20000), conf: true, src: '통합공고 1쪽', url: NOTICE_URL }),
    R({ id: 'F3', region: '전국', biz: '제조AI특화', gov: P(50, 20000), conf: true, src: '통합공고 1쪽', url: NOTICE_URL }),
    R({ id: 'F4', region: '전국', biz: '자율형공장', gov: P(50, 60000), conf: true, src: '통합공고 1쪽', url: NOTICE_URL }),
    R({ id: 'F5', region: '전국', biz: '대중소상생형', gov: P(30, 12000), conf: true, src: '통합공고 1쪽', url: NOTICE_URL }),
    R({ id: 'F6', region: '전국', biz: '지역특화형 (고도화)', gov: P(50, 20000), do: P('', ''), src: '통합공고 5쪽 — 지자체 30~0%, 과제당 총사업비 4억 · 지역 공고 확인', url: NOTICE_URL }),
    R({ id: 'F7', region: '경남', biz: '부처협업형 + 경남 지방비', gov: P(50, 20000), do: P(10, 4000), src: '한황산업 견적자료(2026.08) 기준 — 공고 원문 미확인' }),
    R({ id: 'F8', region: '경남', sigungu: '창원·진주·김해·양산', biz: '경남 AI 스마트공장', do: P(35, ''), si: P(35, ''), capLocal: 40000 * 10000, conf: true, src: '경남TP 추가 공고 요약 (자부담 30%, 최대 4억)', url: 'https://thevc.kr/grants/00fb4db6d3b13f2443af973a' }),
    R({ id: 'F9', region: '경남', biz: '경남형 기초구축', do: P(30, 3600), si: P(30, 3600), conf: true, src: '기사 — 총사업비 1.2억 이내, 도비·군비 각 3,600만', url: 'https://www.naewoeilbo.com/news/articleView.html?idxno=2418517' }),
    R({ id: 'F10', region: '광주', biz: '대중소상생형(삼성형) + 광주 시비', gov: P(30, 15000), si: P(20, 2000), etc: { name: '대기업(삼성)', ...P(30, '') }, src: '공고 요약 — 정부:삼성:기업 3:3:4, 시비 20%(기초 최대 2천만) · 고도화 상한 미확인', url: 'https://app.rndcircle.io/gov-grant/a6163e1e-c68d-491b-9e0a-a3628c591829' }),
    R({ id: 'F11', region: '경기', biz: '경기도형 기초 구축', do: P('', 5000), src: '경기도 공고 — 최대 5천만 · 도비/시군비 비율 미확인', url: 'https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000118448' }),
    R({ id: 'F12', region: '전북', biz: '전북형 JS2 (기초2)', do: P(80, 8000), conf: true, src: '전북형 운영매뉴얼 2026.01 — JS1 0.4억 · JS2 0.8억 · JS3 1.4억(70%)', url: 'https://grant-documents.thevc.kr/download/291905_3.%EC%A0%84%EB%B6%81%ED%98%95%EC%8A%A4%EB%A7%88%ED%8A%B8%EC%A0%9C%EC%A1%B0%ED%98%81%EC%8B%A0%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EC%9A%B4%EC%98%81%EB%A7%A4%EB%89%B4%EC%96%BC(2026.02.01).pdf' }),
    R({ id: 'F13', region: '경북', biz: '경북 지역특화형 기초', do: P(60, ''), src: '경북TP 보도 — 총사업비의 최대 60% · 상한 미확인', url: 'https://www.idaegu.com/news/articleView.html?idxno=662674' }),
  ];
}

/** 표 순서 (pMoneyRules): 최근 연도 → 전국 먼저 → 지역 이름 순 (같으면 넣은 순) */
export const sortRules = (rs: readonly PmFundRule[]) =>
  [...rs].sort((a, b) => b.year - a.year || (a.region === '전국' ? (b.region === '전국' ? 0 : -1) : b.region === '전국' ? 1 : a.region.localeCompare(b.region)));
/** 만원 → '2억원' · '3,600만원' (데모 won, 값은 원으로 받음) */
export function wonText(w: number | null): string {
  if (w == null) return '미입력';
  const n = w / 10000;
  return n >= 10000 ? `${(n / 10000).toFixed(n % 10000 ? 1 : 0)}억원` : `${n.toLocaleString()}만원`;
}
/** 사업 개요 · 재원 창에 보이는 기준 이름 (데모 ruleTxt) */
export const ruleText = (r: PmFundRule | null | undefined) => (r ? `${r.year} · ${r.region}${r.sigungu ? ` (${r.sigungu})` : ''} · ${r.biz}` : '선택 안 함');

/** 지원 기준 입력 창 값 (mnRuleForm) — 비율 %, 상한 만원, 빈 칸 = '' */
export interface RuleDraft {
  year: string; region: string; sigungu: string; biz: string;
  govR: string; govC: string; doR: string; doC: string; siR: string; siC: string; capLocal: string;
  etcN: string; etcR: string; etcC: string; src: string; url: string; conf: boolean;
}
const s = (v: number | null | undefined) => (v == null ? '' : String(v));
export function ruleDraft(r: PmFundRule | null, year: number): RuleDraft {
  const man = (w: number | null | undefined) => (w == null ? '' : String(w / 10000));
  return {
    year: String(r ? r.year : year), region: r?.region ?? '', sigungu: r?.sigungu ?? '', biz: r?.biz ?? '',
    govR: s(r?.gov?.rate), govC: man(r?.gov?.cap), doR: s(r?.do?.rate), doC: man(r?.do?.cap), siR: s(r?.si?.rate), siC: man(r?.si?.cap),
    capLocal: r?.capLocal ? man(r.capLocal) : '', etcN: r?.etc?.name ?? '', etcR: s(r?.etc?.rate), etcC: man(r?.etc?.cap),
    src: r?.src ?? '', url: r?.url ?? '', conf: !!r?.conf,
  };
}
/** 입력 확인 → [글, 칸] 또는 null */
export function ruleCheck(v: RuleDraft): [string, keyof RuleDraft] | null {
  if (!v.year.trim() || !Number.isInteger(+v.year) || +v.year < 2020) return ['연도를 2020 이상으로 넣어 주세요', 'year'];
  if (!v.region.trim()) return ['지역을 넣어 주세요', 'region'];
  if (!v.biz.trim()) return ['사업 종류를 넣어 주세요', 'biz'];
  for (const k of ['govR', 'doR', 'siR', 'etcR'] as const) if (v[k].trim() && !(+v[k] >= 0 && +v[k] <= 100)) return ['비율은 0~100 사이로 넣어 주세요', k];
  for (const k of ['govC', 'doC', 'siC', 'etcC', 'capLocal'] as const) if (v[k].trim() && !(+v[k] >= 0)) return ['상한은 0 이상 숫자로 넣어 주세요', k];
  return null;
}
/** 창 값 → 기준 (데모 onSubmit: 비율 · 상한이 둘 다 비면 그 재원 없음, 기타는 이름이 있어야). 새로 만들 때 id = '' → 저장소가 붙임 */
export function ruleFromDraft(v: RuleDraft, id: string): PmFundRule {
  const num = (x: string) => (x.trim() === '' ? null : +x);
  const won = (x: string) => (x.trim() === '' ? null : Math.round(+x * 10000));
  const pair = (r: string, c: string): FundPair | null => (r.trim() === '' && c.trim() === '' ? null : { rate: num(r), cap: won(c) });
  return pmFundRuleSchema.extend({ id: z.string() }).parse({
    id, year: +v.year, region: v.region.trim(), sigungu: v.sigungu.trim(), biz: v.biz.trim(),
    gov: pair(v.govR, v.govC), do: pair(v.doR, v.doC), si: pair(v.siR, v.siC),
    etc: v.etcN.trim() ? { name: v.etcN.trim(), rate: num(v.etcR), cap: won(v.etcC) } : null,
    capLocal: won(v.capLocal), conf: v.conf, src: v.src.trim(), url: v.url.trim(),
  });
}

// ── 품목 · 단가 (데모 S.money.items) ───────────────────
export const QT_SECS = ['sw', 'hw', 'etc'] as const;
export type QtSec = (typeof QT_SECS)[number];
export const QT_SEC_NM: Record<QtSec, string> = { sw: '소프트웨어', hw: '하드웨어', etc: '기타비용' };

const itemHistSchema = z.object({
  /** 견적 이름 (사업 짧은 이름 · 견적처) */
  src: z.string(),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  price: z.number().int(),
  cost: z.number().int().nullable(),
  qty: z.number(),
  /** 앱에서 만든 견적이면 그 견적 ID (6-5) */
  cid: z.string().default(''),
});
export const pmItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sec: z.enum(QT_SECS),
  /** 종류 — 비우면 이름으로 자동(ciKind), 품목 수정에서 고르면 그 값 */
  kind: z.string().default(''),
  /** 견적서 표지 분류 */
  cat: z.string(),
  unit: z.string().default(''),
  /** 세부 사양 (견적서 세부 내역에 그대로) */
  desc: z.string().default(''),
  /** 공급단가 · 매입단가 (원, VAT 별도) — 매입을 모르면 null = '확인 필요' */
  price: z.number().int().min(0),
  cost: z.number().int().nullable().default(null),
  /** 기타비용처럼 받은 금액 그대로 냄 (매입 = 공급금액) */
  pass: z.boolean().default(false),
  vendor: z.string().default(''),
  /** 견적서에서 묶여 있던 줄 이름 */
  grp: z.string().default(''),
  /** 현장마다 금액이 크게 다름 */
  vary: z.boolean().default(false),
  note: z.string().default(''),
  /** 지난 견적 (가장 최근이 앞) */
  hist: z.array(itemHistSchema).default([]),
});
export type PmItem = z.infer<typeof pmItemSchema>;

/** 품목 종류 — 위에서부터 먼저 맞는 것 (데모 CI_KINDS) */
const CI_KINDS: ReadonlyArray<readonly [string, RegExp]> = [
  ['프로그램·용역', /프로그램|용역|작업비|수정작업|진행\s*경비|전처리/], ['네트워크·공사', /N\/W|네트워크|케이블|Hub|컨버터|공사|부자재|구성비/],
  ['PLC·제어·설비', /PLC|설비|I\/F|제어|MCC|EOCR|클립형 CT|비전검사기|Joint|전원공급|통신 ?모듈/],
  ['단말·키오스크', /키오스크|PDA|태블릿|Panel PC/], ['현황판·디스플레이', /현황판|TV|모니터(?!링)|전광판|디스플레이|표시등|Indicator/],
  ['PC·서버', /PC|서버|워크스테이션|엣지|미들웨어/], ['프린터·스캐너', /프린터|스캐너|바코드|RF|카드|인쇄/],
  ['센서·계측', /센서|Radar|측정|로드셀|캘리퍼스|계측|리미트|브라켓/], ['카메라·CCTV', /카메라|CCTV|인터폰/], ['교육·임치·정산', /교육|임치|정산/],
];
/** 보이는 순서: 자주 고르는 장비부터 (데모 CI_KIND_NM) */
export const CI_KIND_NM = ['단말·키오스크', 'PC·서버', '프린터·스캐너', '현황판·디스플레이', '센서·계측', '카메라·CCTV', 'PLC·제어·설비', '네트워크·공사', '프로그램·용역', '교육·임치·정산', '기타'] as const;

export const ciKind = (it: Pick<PmItem, 'kind' | 'name'>) => it.kind || (CI_KINDS.find(([, re]) => re.test(it.name)) ?? ['기타'])[0];
/** 몇 군데 견적에 쓰였나 (같은 곳 추가계약은 하나로) */
export const ciUse = (it: Pick<PmItem, 'hist'>) => new Set(it.hist.map((h) => String(h.src).replace(/ 추가계약$/, ''))).size;
export const ciSort = (a: PmItem, b: PmItem) => ciUse(b) - ciUse(a) || String(b.hist[0]?.date ?? '').localeCompare(String(a.hist[0]?.date ?? '')) || a.name.localeCompare(b.name);
export const ciKindSort = (a: PmItem, b: PmItem) => CI_KIND_NM.indexOf(ciKind(a) as (typeof CI_KIND_NM)[number]) - CI_KIND_NM.indexOf(ciKind(b) as (typeof CI_KIND_NM)[number]) || ciSort(a, b);
export const ciNorm = (s: string) => String(s ?? '').replace(/\s+/g, '').toLowerCase();
/** 이익률 (그대로 내는 품목 = 0, 매입 모르면 null) */
export const ciMargin = (it: Pick<PmItem, 'pass' | 'cost' | 'price'>) => (it.pass ? 0 : it.cost != null && it.price ? (it.price - it.cost) / it.price : null);
export const pctText = (m: number | null) => (m == null ? '-' : `${Math.round(m * 1000) / 10}%`);
/** 원 → '1,234,000' (0 · 빈 값 = '') */
export const fmtW = (n: number | null | undefined) => (n ? Math.round(n).toLocaleString() : '');
export const fmtW0 = (n: number | null | undefined) => (n === 0 ? '0' : fmtW(n));
/** 지난 견적 단가 범위 (둘 이상이고 다를 때) */
export const ciRange = (it: Pick<PmItem, 'hist'>) => {
  const ps = it.hist.map((h) => h.price).filter(Boolean);
  return ps.length > 1 && Math.min(...ps) !== Math.max(...ps) ? `${fmtW(Math.min(...ps))} ~ ${fmtW(Math.max(...ps))}` : '';
};
/** 세부 사양 첫 줄 (머리 기호 · '1)' 빼고) */
export const descHead = (d: string) => String(d ?? '').split('\n')[0].replace(/^[■▪•\s]*(\d+\)\s*)?/, '');

export interface ItemFilter { sec: '' | QtSec; kind: string; cat: string; q: string }
/** 목록 거르기 · 순서 (ciList): 구분 · 종류 · 표지 분류 · 검색(이름 · 사양 · 묶음 · 견적 이름) → 소프트웨어 · 하드웨어 · 기타 → 종류 순 → 자주 쓰인 순 */
export function itemList(items: readonly PmItem[], f: ItemFilter): PmItem[] {
  const q = ciNorm(f.q);
  return items
    .filter((it) => (!f.sec || it.sec === f.sec) && (!f.cat || it.cat === f.cat) && (!f.kind || ciKind(it) === f.kind)
      && (!q || ciNorm(it.name + it.desc + it.grp + it.hist.map((h) => h.src).join('')).includes(q)))
    .sort((a, b) => QT_SECS.indexOf(a.sec) - QT_SECS.indexOf(b.sec) || ciKindSort(a, b));
}

/** 품목 입력 창 값 (ciForm) — 금액은 원 */
export interface ItemDraft { name: string; sec: QtSec; kind: string; cat: string; unit: string; price: string; cost: string; vendor: string; pass: boolean; vary: boolean; desc: string; note: string }
export const itemDraft = (it: PmItem | null): ItemDraft => (it
  ? { name: it.name, sec: it.sec, kind: ciKind(it), cat: it.cat, unit: it.unit, price: String(it.price), cost: it.cost == null ? '' : String(it.cost), vendor: it.vendor, pass: it.pass, vary: it.vary, desc: it.desc, note: it.note }
  : { name: '', sec: 'hw', kind: '기타', cat: '디바이스', unit: 'set', price: '', cost: '', vendor: '', pass: false, vary: false, desc: '', note: '' });
export function itemCheck(v: ItemDraft): [string, keyof ItemDraft] | null {
  if (!v.name.trim()) return ['품목 이름을 넣어 주세요', 'name'];
  if (v.price.trim() === '' || !(+v.price >= 0)) return ['공급단가를 0 이상 숫자로 넣어 주세요', 'price'];
  if (v.cost.trim() !== '' && !(+v.cost >= 0)) return ['매입단가는 0 이상 숫자로 넣어 주세요', 'cost'];
  return null;
}
/** 창 값 → 품목 (데모 onSubmit — 묶음 · 지난 견적은 그대로 둠). 새로 만들 때 id = '' → 저장소가 붙임 */
export function itemFromDraft(v: ItemDraft, base: PmItem | null, id: string): PmItem {
  return pmItemSchema.extend({ id: z.string() }).parse({
    ...(base ?? { grp: '', hist: [] }), id,
    name: v.name.trim(), sec: v.sec, kind: v.kind, cat: v.cat, unit: v.unit.trim(), price: Math.round(+v.price || 0),
    cost: v.cost.trim() === '' ? null : Math.round(+v.cost), vendor: v.vendor.trim(), pass: v.pass, vary: v.vary, desc: v.desc, note: v.note.trim(),
  });
}
