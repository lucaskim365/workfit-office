import { useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { REV_BASIS, pmMoneyCfgSchema, ruleCheck, ruleDraft, ruleFromDraft, sortRules, wonText, type FundPair, type PmFundRule, type PmMoneyCfg, type RevBasis, type RuleDraft } from '@/domain/pm/money';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { PARTIAL_LOCK_MSG, usePmPartialLock } from '@/features/pm/pmSaveBus';

/**
 * 기준정보 › 지원 기준 · 단가 (money/rules, 데모 pMoneyRules 4631 · mnCfgForm 4690 · mnRuleForm 4697) — 6-4.
 * 단가 · 계산 기준(클라우드 · 인건비 · 매출 잡는 날짜 · 간접비) + 정부 · 지자체 지원 기준표. 금액 화면이라 pm.manage 만 (메뉴 · 주소 모두 PmScreen 이 막음).
 */
const card = 'rounded-xl border border-border bg-panel shadow-sm';
const th = 'px-3 py-2 text-left text-[11.5px] font-bold text-ink3 whitespace-nowrap';
const td = 'px-3 py-2 align-top text-[12px]';
export const inp = 'w-full rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';

export function F({ label, req, full, bad, children }: { label: string; req?: boolean; full?: boolean; bad?: boolean; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${full ? 'sm:col-span-2' : ''}`}>
      <span>{label}{req && <span className="text-danger"> *</span>}</span>
      <div className={bad ? 'rounded ring-2 ring-danger' : ''}>{children}</div>
    </label>
  );
}
export const Foot = ({ err, onDel, onClose, onSave, lock }: { err: string; onDel?: () => void; onClose: () => void; onSave: () => void; lock?: boolean }) => (
  <div className="flex w-full items-center gap-2">
    {onDel && <Button variant="secondary" onClick={onDel}>삭제</Button>}
    <span className="flex-1 text-right text-[12px] font-bold text-danger" role="alert">{lock ? PARTIAL_LOCK_MSG : err}</span>
    <Button variant="secondary" onClick={onClose}>취소</Button>
    <Button disabled={lock} onClick={onSave}>저장</Button>
  </div>
);
const Check = () => <Tag tone="warn" title="확인 필요">확인 필요</Tag>;

/** 비율 · 상한 칸 (데모 cell) */
const Cell = ({ v }: { v: FundPair | null }) => (!v ? <span className="text-ink3">-</span> : (
  <>{v.rate == null ? <Tag tone="warn">비율?</Tag> : `${v.rate}%`}{v.cap != null && <span className="text-[11px] text-ink2"> 최대 {wonText(v.cap)}</span>}</>
));

export function RulesView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const [cfgOn, setCfgOn] = useState(false);
  const [edit, setEdit] = useState<PmFundRule | 'new' | null>(null);
  const [msg, setMsg] = useState('');
  if (!d) return <EmptyHint title="지원 기준을 불러오는 중입니다" />;
  const c = d.snap.moneyCfg;
  const rs = sortRules(d.snap.fundRules);
  const perH = Math.round(c.workH ? c.kosaMonthly / c.workH : 0);

  return (
    <div className="space-y-3">
      <ScreenHead title="지원 기준 · 단가" desc="사업비 계산에 쓰는 정부 · 지자체 지원 기준과 클라우드 · 인건비 단가입니다. 연도 · 지역 · 사업 종류마다 다르므로 공고를 보고 채우고, 확인 안 된 줄은 '확인 필요'로 남깁니다.">
        <Button onClick={() => setEdit('new')}>+ 지원 기준 추가</Button>
      </ScreenHead>
      {msg && <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">{msg}</div>}
      <section className={card}>
        <div className="flex items-center border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">단가 · 계산 기준</h3><span className="flex-1" /><Button size="sm" variant="secondary" onClick={() => setCfgOn(true)}>수정</Button></div>
        <div className="grid gap-4 px-4 py-3 text-[12px] sm:grid-cols-4">
          <div><div className="text-[11px] text-ink3">클라우드 현물</div><b>월 {c.cloudMonthly.toLocaleString()}원 × {c.cloudMonths}개월</b><div className="text-[11px] text-ink3">NHN 클라우드 기준 · 바뀔 수 있음</div></div>
          <div><div className="text-[11px] text-ink3">직원 인건비</div><b>{c.laborOn ? `${c.kosaMonthly.toLocaleString()}원/월` : '반영 안 함 (회사 확인 후)'}</b><div className="text-[11px] text-ink3">{c.kosaName} ÷ {c.workH}h = 시간당 {perH.toLocaleString()}원 <Check /></div></div>
          <div><div className="text-[11px] text-ink3">매출 잡는 날짜</div><b>{(REV_BASIS.find((b) => b[0] === c.revBasis) ?? REV_BASIS[0])[1]}</b><div className="text-[11px] text-ink3">견적서: 시스템별 설치 후 세금계산서 발행 <Check /></div></div>
          <div><div className="text-[11px] text-ink3">간접비</div><b>반영 안 함</b><div className="text-[11px] text-ink3">배부 기준 정해지면 추가 <Check /></div></div>
        </div>
      </section>
      <section className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">정부 · 지자체 지원 기준</h3><span className="flex-1" /><span className="text-[11px] text-ink3">사업에서 하나를 골라 쓰고, 계약서 · 계획서의 확정 금액이 있으면 그 금액이 우선</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>연도</th><th className={th}>지역</th><th className={th}>사업 종류</th><th className={th}>정부</th><th className={th}>도비</th><th className={th}>시군비</th><th className={th}>기타</th><th className={th}>출처</th><th className={th} /></tr></thead>
            <tbody>
              {rs.length ? rs.map((r) => (
                <tr key={r.id} onClick={() => setEdit(r)} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-panel-alt">
                  <td className={`${td} tabular-nums`}>{r.year}</td>
                  <td className={td}>{r.region}{r.sigungu && <div className="text-[11px] text-ink3">{r.sigungu}</div>}</td>
                  <td className={td}>{r.biz}</td>
                  <td className={`${td} whitespace-nowrap`}><Cell v={r.gov} /></td>
                  <td className={`${td} whitespace-nowrap`}><Cell v={r.do} /></td>
                  <td className={`${td} whitespace-nowrap`}><Cell v={r.si} /></td>
                  <td className={td}>{r.etc ? <span className="whitespace-nowrap">{r.etc.name} <Cell v={r.etc} /></span> : <span className="text-ink3">-</span>}{!!r.capLocal && <div className="text-[11px] text-ink2">지자체 합계 최대 {wonText(r.capLocal)}</div>}</td>
                  <td className={`${td} max-w-[260px] text-[11.5px]`}>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline" onClick={(e) => e.stopPropagation()}>{r.src || '링크'}</a> : r.src}</td>
                  <td className={td}>{r.conf ? <Tag tone="ok">확인</Tag> : <Check />}</td>
                </tr>
              )) : <tr><td colSpan={9}><EmptyHint title="지원 기준이 없습니다 — [+ 지원 기준 추가]로 넣어 주세요" /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {cfgOn && <CfgModal c={c} onClose={() => setCfgOn(false)} onSave={async (x) => { await mut.saveMoneyCfg.mutateAsync(x); setMsg('단가 · 계산 기준 저장'); setCfgOn(false); }} />}
      {edit && <RuleModal r={edit === 'new' ? null : edit} year={+d.today.slice(0, 4)} onClose={() => setEdit(null)}
        onSave={async (r) => { await mut.saveFundRule.mutateAsync(r); setMsg(edit === 'new' ? '지원 기준 추가' : '지원 기준 수정'); setEdit(null); }}
        onRemove={async (id) => { await mut.removeFundRule.mutateAsync(id); setMsg('지원 기준 삭제'); setEdit(null); }} />}
    </div>
  );
}

/** 단가 · 계산 기준 창 (mnCfgForm) */
export function CfgModal({ c, onSave, onClose }: { c: PmMoneyCfg; onSave: (c: PmMoneyCfg) => Promise<void>; onClose: () => void }) {
  const [v, setV] = useState({ cloudMonthly: String(c.cloudMonthly), cloudMonths: String(c.cloudMonths), kosaName: c.kosaName, kosaMonthly: String(c.kosaMonthly), workH: String(c.workH), revBasis: c.revBasis, laborOn: c.laborOn });
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    for (const k of ['cloudMonthly', 'cloudMonths', 'kosaMonthly'] as const) if (v[k].trim() === '' || !(+v[k] >= 0)) { setErr(['0 이상 숫자로 넣어 주세요', k]); return; }
    if (!(+v.workH >= 1)) { setErr(['월 근무시간은 1 이상으로 넣어 주세요', 'workH']); return; }
    setErr(null);
    try { await onSave(pmMoneyCfgSchema.parse({ ...c, cloudMonthly: Math.round(+v.cloudMonthly), cloudMonths: Math.round(+v.cloudMonths), kosaName: v.kosaName.trim(), kosaMonthly: Math.round(+v.kosaMonthly), workH: +v.workH, revBasis: v.revBasis, laborOn: v.laborOn })); } catch (e) { setErr([(e as Error).message || '저장하지 못했습니다', '']); }
  };
  const bad = (f: string) => err?.[1] === f;
  return (
    <Modal open onClose={onClose} width={640} title="단가 · 계산 기준" footer={<Foot err={err?.[0] ?? ''} onClose={onClose} onSave={() => void save()} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="클라우드 월 단가 (원)" bad={bad('cloudMonthly')}><input type="number" min={0} className={inp} value={v.cloudMonthly} onChange={(e) => set('cloudMonthly', e.target.value)} /></F>
        <F label="클라우드 기본 개월 수" bad={bad('cloudMonths')}><input type="number" min={0} className={inp} value={v.cloudMonths} onChange={(e) => set('cloudMonths', e.target.value)} /></F>
        <F label="인건비 단가 이름" full><input className={inp} value={v.kosaName} onChange={(e) => set('kosaName', e.target.value)} /></F>
        <F label="인건비 월 단가 (원)" bad={bad('kosaMonthly')}><input type="number" min={0} className={inp} value={v.kosaMonthly} onChange={(e) => set('kosaMonthly', e.target.value)} /></F>
        <F label="월 근무시간 (h)" bad={bad('workH')}><input type="number" min={1} className={inp} value={v.workH} onChange={(e) => set('workH', e.target.value)} /></F>
        <F label="매출 잡는 날짜"><select className={inp} value={v.revBasis} onChange={(e) => set('revBasis', e.target.value as RevBasis)}>{REV_BASIS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
        <label className="flex items-center gap-2 self-end text-[12px] text-ink2"><input type="checkbox" checked={v.laborOn} onChange={(e) => set('laborOn', e.target.checked)} />직원 인건비 반영 (업무계획 시간 × 단가)</label>
      </div>
    </Modal>
  );
}

/** 지원 기준 추가 · 수정 창 (mnRuleForm) — 비율 %, 상한 만원 */
function RuleModal({ r, year, onSave, onRemove, onClose }: { r: PmFundRule | null; year: number; onSave: (r: PmFundRule) => Promise<void>; onRemove: (id: string) => Promise<void>; onClose: () => void }) {
  const isNew = !r;
  const lock = usePmPartialLock() && isNew;
  const [v, setV] = useState<RuleDraft>(() => ruleDraft(r, year));
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof RuleDraft>(k: K, x: RuleDraft[K]) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    const e = ruleCheck(v);
    if (e) { setErr(e); return; }
    setErr(null);
    try { await onSave(ruleFromDraft(v, r?.id ?? '')); } catch (x) { setErr([(x as Error).message || '저장하지 못했습니다', '']); }
  };
  // 이 기준을 쓰는 사업을 묻는 확인은 사업 재원(6-6)이 생기면 더함 — 지금은 쓰는 사업이 없음
  const del = async () => {
    if (!r || !confirm(`'${r.biz}' 지원 기준을 지울까요?`)) return;
    try { await onRemove(r.id); } catch (x) { setErr([(x as Error).message || '지우지 못했습니다', '']); }
  };
  const bad = (f: string) => err?.[1] === f;
  const num = (k: keyof RuleDraft, label: string, max?: number) => (
    <F label={label} bad={bad(k)}><input type="number" min={0} max={max} className={inp} value={v[k] as string} onChange={(e) => set(k, e.target.value)} /></F>
  );
  return (
    <Modal open onClose={onClose} width={720} title={isNew ? '지원 기준 추가' : '지원 기준 수정'} footer={<Foot lock={lock} err={err?.[0] ?? ''} onDel={isNew ? undefined : () => void del()} onClose={onClose} onSave={() => void save()} />}>
      <p className="mb-3 text-[12px] text-ink2">비율은 총사업비 대비 %, 상한은 <b>만원</b>. 모르는 칸은 비워 두면 '확인 필요'로 보입니다.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="연도" req bad={bad('year')}><input type="number" min={2020} className={inp} value={v.year} onChange={(e) => set('year', e.target.value)} /></F>
        <F label="지역" req bad={bad('region')}><input className={inp} value={v.region} placeholder="예: 경남 / 전국" onChange={(e) => set('region', e.target.value)} /></F>
        <F label="시군 (해당 시)"><input className={inp} value={v.sigungu} placeholder="예: 창원·김해" onChange={(e) => set('sigungu', e.target.value)} /></F>
        <F label="사업 종류" req bad={bad('biz')}><input className={inp} value={v.biz} placeholder="예: 부처협업형 + 경남 지방비" onChange={(e) => set('biz', e.target.value)} /></F>
        {num('govR', '정부 비율 (%)', 100)}{num('govC', '정부 상한 (만원)')}
        {num('doR', '도비 비율 (%)', 100)}{num('doC', '도비 상한 (만원)')}
        {num('siR', '시군비 비율 (%)', 100)}{num('siC', '시군비 상한 (만원)')}
        {num('capLocal', '도비+시군비 합계 상한 (만원)')}
        <F label="기타 재원 이름"><input className={inp} value={v.etcN} placeholder="예: 대기업(삼성)" onChange={(e) => set('etcN', e.target.value)} /></F>
        {num('etcR', '기타 비율 (%)', 100)}{num('etcC', '기타 상한 (만원)')}
        <F label="출처" full><input className={inp} value={v.src} placeholder="예: 2026 경남 스마트공장 공고 3쪽" onChange={(e) => set('src', e.target.value)} /></F>
        <F label="공고 링크" full><input className={inp} value={v.url} onChange={(e) => set('url', e.target.value)} /></F>
        <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={v.conf} onChange={(e) => set('conf', e.target.checked)} />공고 원문으로 확인함</label>
      </div>
    </Modal>
  );
}
