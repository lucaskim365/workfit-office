import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { FUND_SRC, ruleText, type PmFundRule, type PmMoneyCfg } from '@/domain/pm/money';
import { pmFundSchema, type FundKey, type FundOf, type PmContract, type PmFund, type PmPay } from '@/domain/pm/quote';
import { COST_CATS, costCheck, manToWon, payCheck, wonToMan, type PmCost, type PmOh } from '@/domain/pm/pl';
import { F, Foot, inp } from './RulesView';

/**
 * 사업별 수익 · 손익 입력 창 (데모 mnFundForm 4658 · mnPayForm 4668 · mnCostForm 4679 · mnOhForm 4620) — 6-6.
 * 금액 칸은 데모처럼 만원 (클라우드 월 단가만 원), 저장은 원 정수.
 */
type Err = [string, string] | null;
const errText = (e: unknown) => (e as Error).message || '저장하지 못했습니다';

/** 재원 수정 (mnFundForm) — 지원 기준을 고르면 비율 · 상한으로 계산, 확정 금액이 있으면 그것이 우선 */
export function FundModal({ short, F: FO, rules, cfg, onSave, onClose }: { short: string; F: FundOf; rules: readonly PmFundRule[]; cfg: PmMoneyCfg; onSave: (f: PmFund) => Promise<void>; onClose: () => void }) {
  const f = FO.f;
  const [v, setV] = useState({
    rule: f.rule || (FO.auto && FO.r ? FO.r.id : ''),
    man: f.man ? String(f.man / 10000) : '',
    cloudMo: f.cloudMonthly == null ? '' : String(f.cloudMonthly),
    cloudM: f.cloudM == null ? '' : String(f.cloudM),
    fix: Object.fromEntries(FUND_SRC.map(([k]) => [k, wonToMan(f.fix[k])])) as Record<FundKey, string>,
    fixNote: f.fixNote,
  });
  const [err, setErr] = useState<Err>(null);
  const num = (s: string) => s.trim() === '' || +s >= 0;
  const save = async () => {
    for (const [k, s] of [['man', v.man], ['cloudMo', v.cloudMo], ['cloudM', v.cloudM], ...FUND_SRC.map(([k]) => [`x${k}`, v.fix[k]])] as Array<[string, string]>) if (!num(s)) { setErr(['0 이상 숫자로 넣어 주세요', k]); return; }
    const fix: PmFund['fix'] = {};
    for (const [k] of FUND_SRC) { const w = manToWon(v.fix[k]); if (w != null) fix[k] = w; }
    setErr(null);
    try {
      await onSave(pmFundSchema.parse({ ...f, rule: v.rule, ruleSet: true, man: Math.round((+v.man || 0) * 10000), cloudMonthly: v.cloudMo.trim() === '' ? null : +v.cloudMo, cloudM: v.cloudM.trim() === '' ? null : +v.cloudM, fix, fixNote: v.fixNote.trim() }));
    } catch (e) { setErr([errText(e), '']); }
  };
  const bad = (k: string) => err?.[1] === k;
  return (
    <Modal open onClose={onClose} width={640} title={`재원 수정 — ${short}`} footer={<Foot err={err?.[0] ?? ''} onClose={onClose} onSave={() => void save()} />}>
      <p className="mb-3 text-[12px] text-ink2">지원 기준을 고르면 비율 · 상한으로 계산합니다. 사업계획서 · 협약서에 <b>확정 금액</b>이 있으면 넣어 주세요 (만원) — 계산값보다 우선합니다.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="지원 기준" full>
          <select className={inp} value={v.rule} onChange={(e) => setV({ ...v, rule: e.target.value })}>
            <option value="">선택 안 함</option>
            {rules.map((r) => <option key={r.id} value={r.id}>{ruleText(r)}{r.conf ? '' : ' (확인 필요)'}</option>)}
          </select>
        </F>
        <F label="인력 현물 (만원)" bad={bad('man')}><input type="number" min={0} className={inp} value={v.man} onChange={(e) => setV({ ...v, man: e.target.value })} /></F>
        <F label={`클라우드 월 단가 (원, 비우면 ${cfg.cloudMonthly.toLocaleString()})`} bad={bad('cloudMo')}><input type="number" min={0} className={inp} value={v.cloudMo} onChange={(e) => setV({ ...v, cloudMo: e.target.value })} /></F>
        <F label={`클라우드 개월 수 (비우면 ${cfg.cloudMonths})`} bad={bad('cloudM')}><input type="number" min={0} className={inp} value={v.cloudM} onChange={(e) => setV({ ...v, cloudM: e.target.value })} /></F>
        <div className="border-t border-border pt-2 text-[12px] font-bold text-ink sm:col-span-2">확정 금액 (만원) <span className="font-normal text-ink3">비우면 계산값 사용</span></div>
        {FUND_SRC.map(([k, nm]) => (
          <F key={k} label={`${nm} 확정`} bad={bad(`x${k}`)}><input type="number" min={0} className={inp} value={v.fix[k]} onChange={(e) => setV({ ...v, fix: { ...v.fix, [k]: e.target.value } })} /></F>
        ))}
        <F label="확정 금액 출처" full><input className={inp} value={v.fixNote} placeholder="예: 협약서 사업비 총괄표" onChange={(e) => setV({ ...v, fixNote: e.target.value })} /></F>
      </div>
    </Modal>
  );
}

/** 대금 단계 추가 · 수정 (mnPayForm) — 금액을 비우면 계약 매출 × 비율 */
export function PayModal({ p, projectId, cs, onSave, onRemove, onClose }: { p: PmPay | null; projectId: string; cs: readonly PmContract[]; onSave: (p: PmPay) => Promise<void>; onRemove: (id: string) => Promise<void>; onClose: () => void }) {
  const [v, setV] = useState({ cid: p?.cid ?? cs[0]?.id ?? '', name: p?.name ?? '', rate: p && p.rate ? String(p.rate) : '', amt: wonToMan(p?.amt), due: p?.due ?? '', inv: p?.inv ?? '', paid: p?.paid ?? '' });
  const [err, setErr] = useState<Err>(null);
  const set = <K extends keyof typeof v>(k: K, x: string) => setV((o) => ({ ...o, [k]: x }));
  const save = async () => {
    const e = payCheck(v);
    if (e) { setErr(e); return; }
    setErr(null);
    try { await onSave({ id: p?.id ?? '', projectId, cid: v.cid, name: v.name.trim(), rate: +v.rate || 0, amt: manToWon(v.amt), due: v.due, inv: v.inv, paid: v.paid }); } catch (x) { setErr([errText(x), '']); }
  };
  const bad = (k: string) => err?.[1] === k;
  return (
    <Modal open onClose={onClose} width={600} title={p ? '대금 단계 수정' : '대금 단계 추가'} footer={<Foot err={err?.[0] ?? ''} onDel={p ? () => void onRemove(p.id) : undefined} onClose={onClose} onSave={() => void save()} />}>
      <p className="mb-3 text-[12px] text-ink2">금액을 비우면 계약 매출 × 비율로 계산합니다. 세금계산서 발행일 · 입금일을 넣으면 월별 손익에 매출로 잡힙니다.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="계약" bad={bad('cid')}><select className={inp} value={v.cid} onChange={(e) => set('cid', e.target.value)}>{cs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
        <F label="단계" req bad={bad('name')}><input className={inp} value={v.name} placeholder="예: 선급금 50%" onChange={(e) => set('name', e.target.value)} /></F>
        <F label="비율 (%)" bad={bad('rate')}><input type="number" min={0} max={100} className={inp} value={v.rate} onChange={(e) => set('rate', e.target.value)} /></F>
        <F label="금액 (만원, 직접 입력)" bad={bad('amt')}><input type="number" min={0} className={inp} value={v.amt} onChange={(e) => set('amt', e.target.value)} /></F>
        <F label="예정일"><input type="date" className={inp} value={v.due} onChange={(e) => set('due', e.target.value)} /></F>
        <F label="세금계산서 발행일"><input type="date" className={inp} value={v.inv} onChange={(e) => set('inv', e.target.value)} /></F>
        <F label="입금일"><input type="date" className={inp} value={v.paid} onChange={(e) => set('paid', e.target.value)} /></F>
      </div>
    </Modal>
  );
}

/** 원가 변경 등록 · 수정 (mnCostForm) — 최종 견적서 매입과 달라진 금액만, 늘면 + 줄면 − */
export function CostModal({ c, projectId, short, today, onSave, onRemove, onClose }: { c: PmCost | null; projectId: string; short: string; today: string; onSave: (c: PmCost) => Promise<void>; onRemove: (id: string) => Promise<void>; onClose: () => void }) {
  const [v, setV] = useState({ date: c?.date ?? today, cat: c?.cat ?? COST_CATS[0], amt: c ? String(c.amt / 10000) : '', vendor: c?.vendor ?? '', desc: c?.desc ?? '' });
  const [err, setErr] = useState<Err>(null);
  const set = <K extends keyof typeof v>(k: K, x: string) => setV((o) => ({ ...o, [k]: x }));
  const save = async () => {
    const e = costCheck(v);
    if (e) { setErr(e); return; }
    setErr(null);
    try { await onSave({ id: c?.id ?? '', projectId, date: v.date, cat: v.cat, amt: Math.round(+v.amt * 10000), vendor: v.vendor.trim(), desc: v.desc.trim() }); } catch (x) { setErr([errText(x), '']); }
  };
  const bad = (k: string) => err?.[1] === k;
  return (
    <Modal open onClose={onClose} width={600} title={c ? '원가 변경 수정' : `원가 변경 등록 — ${short}`} footer={<Foot err={err?.[0] ?? ''} onDel={c ? () => void onRemove(c.id) : undefined} onClose={onClose} onSave={() => void save()} />}>
      <p className="mb-3 text-[12px] text-ink2">최종 견적서 매입과 달라진 금액만 넣습니다. 늘면 +, 줄면 − (예: 장비 추가 +300, 수량 축소 −120).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="날짜" req bad={bad('date')}><input type="date" className={inp} value={v.date} onChange={(e) => set('date', e.target.value)} /></F>
        <F label="분류"><select className={inp} value={v.cat} onChange={(e) => set('cat', e.target.value)}>{COST_CATS.map((x) => <option key={x}>{x}</option>)}</select></F>
        <F label="바뀐 금액 (만원, VAT 별도, 줄면 −)" req bad={bad('amt')}><input type="number" step={0.1} className={inp} value={v.amt} onChange={(e) => set('amt', e.target.value)} /></F>
        <F label="거래처"><input className={inp} value={v.vendor} onChange={(e) => set('vendor', e.target.value)} /></F>
        <F label="내용" full><input className={inp} value={v.desc} placeholder="예: 산업용 PC 8대" onChange={(e) => set('desc', e.target.value)} /></F>
      </div>
    </Modal>
  );
}

/** 간접비 입력 (mnOhForm) — 달마다, 비우면 기본 월 간접비 */
export function OhModal({ m, oh, cfg, onSave, onClose }: { m: string; oh: readonly PmOh[]; cfg: PmMoneyCfg; onSave: (x: { m: string; amt: number | null; memo: string; def: number | null }) => Promise<void>; onClose: () => void }) {
  const o = oh.find((x) => x.id === m);
  const [v, setV] = useState({ m, amt: wonToMan(o?.amt), memo: o?.memo ?? '', def: cfg.ohDefault ? String(cfg.ohDefault / 10000) : '' });
  const [err, setErr] = useState<Err>(null);
  const set = <K extends keyof typeof v>(k: K, x: string) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    if (!/^\d{4}-\d{2}$/.test(v.m.trim())) { setErr(['달은 2026-11처럼 넣어 주세요', 'm']); return; }
    for (const k of ['amt', 'def'] as const) if (v[k].trim() !== '' && !(+v[k] >= 0)) { setErr(['0 이상 숫자로 넣어 주세요', k]); return; }
    setErr(null);
    try { await onSave({ m: v.m.trim(), amt: manToWon(v.amt), memo: v.memo, def: manToWon(v.def) }); } catch (x) { setErr([errText(x), '']); }
  };
  const bad = (k: string) => err?.[1] === k;
  return (
    <Modal open onClose={onClose} width={600} title="간접비 입력 (회사 공통 비용)" footer={<Foot err={err?.[0] ?? ''} onClose={onClose} onSave={() => void save()} />}>
      <p className="mb-3 text-[12px] text-ink2">사업에 직접 들어가지 않는 회사 비용(관리직 급여, 임대료, 공통 운영비 등)을 달마다 넣습니다. 비워 두면 [단가 · 계산 기준]의 <b>기본 월 간접비</b>를 씁니다. 무엇을 넣을지는 재무 확인 필요.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="달 (YYYY-MM)" req bad={bad('m')}><input className={inp} value={v.m} placeholder="예: 2026-11" onChange={(e) => set('m', e.target.value)} /></F>
        <F label="이 달 간접비 (만원)" bad={bad('amt')}><input type="number" min={0} step={0.1} className={inp} value={v.amt} onChange={(e) => set('amt', e.target.value)} /></F>
        <F label="내용" full><input className={inp} value={v.memo} placeholder="예: 관리직 급여 3명 + 사무실 임대료" onChange={(e) => set('memo', e.target.value)} /></F>
        <div className="border-t border-border pt-2 text-[12px] font-bold text-ink sm:col-span-2">기본값</div>
        <F label="기본 월 간접비 (만원) — 입력 안 한 지난달에 적용" full bad={bad('def')}><input type="number" min={0} step={0.1} className={inp} value={v.def} onChange={(e) => set('def', e.target.value)} /></F>
      </div>
    </Modal>
  );
}
