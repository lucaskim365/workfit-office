import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { shortName } from '@/domain/pm/rules';
import { REV_BASIS, pctText } from '@/domain/pm/money';
import { cSum } from '@/domain/pm/quote';
import { man, manW, noPayC, payAmt, plYear } from '@/domain/pm/pl';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPl } from '@/features/pm/usePmPl';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { CfgModal } from './RulesView';
import { OhModal } from './MoneyModals';

/**
 * 사업 · 손익 › 월별 · 연간 손익 (money/pl, 데모 pMoneyPL 4574 · mnOhForm 4620) — 6-6.
 * 매출은 [매출 잡는 날짜] 기준 대금, 견적 매입은 매출이 잡히는 달에 같은 비율로, 원가 변경은 등록일에. 순수익 = 사업 이익 − 간접비.
 * 금액 화면이라 pm.manage 만 (PmScreen 이 막음).
 */
const card = 'rounded-xl border border-border bg-panel shadow-sm';
const pct = (a: number, b: number) => pctText(b ? a / b : null);
const th = 'px-3 py-2 text-left text-[11.5px] font-bold text-ink3';
const thR = 'px-3 py-2 text-right text-[11.5px] font-bold text-ink3 whitespace-nowrap';
const Td = ({ v }: { v: number }) => <td className="px-3 py-1.5 text-right tabular-nums">{v ? man(v) : <span className="text-ink3">-</span>}</td>;
const TdN = ({ v }: { v: number }) => <td className={`px-3 py-1.5 text-right font-bold tabular-nums ${v < 0 ? 'text-danger' : ''}`}>{v ? man(v) : <span className="text-ink3">-</span>}</td>;
const Check = ({ title }: { title: string }) => <Tag tone="warn" title={title}>확인 필요</Tag>;

export function PlView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const X = usePmPl(d);
  const mut = usePmMutations(people.me, people.nameOf);
  const [, setParams] = useSearchParams();
  const [Y0, setY] = useState('');
  const [modal, setModal] = useState<'oh' | 'cfg' | null>(null);
  const [msg, setMsg] = useState('');
  if (!d || !X) return <EmptyHint title="손익을 불러오는 중입니다" />;
  const Y = Y0 || d.today.slice(0, 4);
  const P = plYear(X, Y);
  const { R, T, cur, F, late, nod, m0 } = P;
  const cfg = X.cfg;
  const basis = (REV_BASIS.find((b) => b[0] === cfg.revBasis) ?? REV_BASIS[0])[1];
  const short = (id: string) => { const p = d.snap.projects.find((x) => x.id === id); return p ? shortName(p, d.snap.projects) : id; };
  const goSite = (k: string) => setParams(new URLSearchParams({ v: 'money/site', k }));
  const npc = noPayC(X);
  const kpi = (l: string, v: ReactNode, s: ReactNode, neg = false) => (
    <div className={`${card} px-4 py-3`}><div className="text-[11.5px] font-bold text-ink2">{l}</div><b className={`block text-[22px] leading-tight tabular-nums ${neg ? 'text-danger' : 'text-ink'}`}>{v}</b><div className="mt-0.5 text-[11px] text-ink3">{s}</div></div>
  );
  // 월별 막대: 매출(진한) + 예정 매출(옅은) · 점 = 순수익
  const mx = Math.max(1, ...R.map((r) => r.rev + r.plan), ...R.map((r) => Math.abs(r.net)));
  const h = (v: number) => Math.max(0, v) / mx * 100;

  return (
    <div className="space-y-3">
      <ScreenHead title="월별 · 연간 손익" desc={<>매출은 <b>{basis}</b> 기준, 견적 매입은 매출이 잡히는 달에 같은 비율로, 원가 변경은 등록일에 잡습니다 · 순수익 = 사업 이익 합계 − 간접비(회사 공통 비용)</>} />
      {msg && <div role="status" className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">{msg}</div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {P.ys.map((y) => <Button key={y} size="sm" variant={y === Y ? 'primary' : 'secondary'} onClick={() => setY(y)}>{y}년</Button>)}
        <span className="ml-1.5 text-[11.5px] text-ink2">매출 기준 <Check title="매출을 잡는 날짜 — 재무 담당자 확인 필요" /></span>
        <Button size="sm" variant="secondary" onClick={() => setModal('cfg')}>바꾸기</Button>
        <span className="flex-1" />
        <Button size="sm" onClick={() => setModal('oh')}>간접비 입력</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpi(`${Y}년 매출`, manW(T.rev), `아직 안 잡힌 올해 예정 매출 ${manW(T.plan)}`)}
        {kpi('사업 이익 (매출 − 매입 − 인건비)', manW(T.p), `매입 ${manW(T.buy)} · 인건비 ${manW(T.lab)}`)}
        {kpi('간접비 (회사 공통 비용)', manW(T.oh), <>{T.oh ? '입력한 달 · 기본 월 간접비 합' : '아직 입력 안 함'} <Check title="간접비에 무엇을 넣을지(관리직 급여 · 임대료 등) 재무 확인 필요" /></>)}
        {kpi(`${Y}년 순수익`, manW(T.net), `이번 달(${+d.today.slice(5, 7)}월) ${cur ? manW(cur.net) : '-'} · 이익률 ${pct(T.net, T.rev)}`, T.net < 0)}
      </div>

      <section className={`${card} px-4 py-3`} aria-label={`${Y}년 한눈에`}>
        <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
          <b className="text-[13px] text-ink">{Y}년 한눈에</b>
          <span className="flex items-center gap-1 text-ink2"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-teal" />매출</span>
          <span className="flex items-center gap-1 text-ink2"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-teal/30" />예정 매출</span>
          <span className="flex items-center gap-1 text-ink2"><i className="inline-block h-2.5 w-2.5 rounded-full bg-navy" />순수익</span>
          <span className="flex-1" /><small className="text-ink3">막대 위 숫자 = 매출 + 예정 (만원)</small>
        </div>
        <div className="mt-2 grid grid-cols-12 gap-1.5">
          {R.map((r) => (
            <div key={r.m} className={`flex flex-col items-center rounded-md px-0.5 py-1 ${r.m === m0 ? 'bg-teal-soft' : ''} ${r.m < m0 ? 'opacity-80' : ''}`} title={`${+r.m.slice(5)}월 · 매출 ${manW(r.rev)} · 예정 ${manW(r.plan)} · 순수익 ${manW(r.net)}`}>
              <span className="h-4 text-[10.5px] tabular-nums text-ink2">{r.rev + r.plan ? man(r.rev + r.plan) : ''}</span>
              <div className="relative flex h-28 w-full max-w-[34px] flex-col justify-end">
                <i className="block w-full rounded-t-sm bg-teal/30" style={{ height: `${h(r.plan)}%` }} />
                <i className="block w-full bg-teal" style={{ height: `${h(r.rev)}%` }} />
                {!!r.net && <em className={`absolute left-1/2 block h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full ${r.net < 0 ? 'bg-danger' : 'bg-navy'}`} style={{ bottom: `${h(Math.abs(r.net))}%` }} />}
              </div>
              <span className="mt-1 text-[11px] text-ink2">{+r.m.slice(5)}월</span>
            </div>
          ))}
        </div>
        {!(T.rev + T.plan) && <p className="mt-2 text-center text-[11.5px] text-ink3">올해 잡힌 매출 · 예정 매출이 아직 없어요 — 사업별 수익 › 대금에 단계를 넣으면 여기에 막대가 생깁니다</p>}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">{Y}년 월별</h3><span className="flex-1" /><span className="text-[11px] text-ink3">단위 만원 · 예정 매출 = 아직 매출로 안 잡힌 대금 (예정일, 없으면 추정일 · 지난 것은 이번 달)</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>월</th>{['매출', '예정 매출', '매입', '인건비', '사업 이익', '간접비', '순수익', '이익률'].map((x) => <th key={x} className={thR}>{x}</th>)}</tr></thead>
            <tbody>
              {R.map((r) => (
                <tr key={r.m} className={`border-b border-border ${r.m === m0 ? 'bg-teal-soft' : ''}`}>
                  <td className="px-3 py-1.5">{+r.m.slice(5)}월</td><Td v={r.rev} /><Td v={r.plan} /><Td v={r.buy} /><Td v={r.lab} /><Td v={r.p} /><Td v={r.oh} /><TdN v={r.net} /><td className="px-3 py-1.5 text-right tabular-nums">{pct(r.net, r.rev)}</td>
                </tr>
              ))}
              <tr className="bg-panel-alt font-bold"><td className="px-3 py-1.5">합계</td><Td v={T.rev} /><Td v={T.plan} /><Td v={T.buy} /><Td v={T.lab} /><Td v={T.p} /><Td v={T.oh} /><TdN v={T.net} /><td className="px-3 py-1.5 text-right tabular-nums">{pct(T.net, T.rev)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">앞으로 12개월 예상 매출</h3><span className="flex-1" /><span className="text-[11px] text-ink3">아직 매출로 안 잡힌 대금 · 예정일이 없으면 단계 이름으로 날짜 추정 (선급 → 협약 시작, 잔금 → 협약 종료)</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>월</th><th className={thR}>예정일 기준</th><th className={thR}>추정</th><th className={thR}>합계</th><th className={th}>대금</th></tr></thead>
            <tbody>
              {F.map((f, i) => (
                <tr key={f.m} className="border-b border-border">
                  <td className="whitespace-nowrap px-3 py-1.5">{f.m.slice(0, 4) !== m0.slice(0, 4) ? `${f.m.slice(2, 4)}년 ` : ''}{+f.m.slice(5)}월{i === 0 && !!late.length && <span className="ml-1 text-[11px] text-amber">+ 지난 예정 {late.length}건</span>}</td>
                  <Td v={f.fix} /><Td v={f.est} /><TdN v={f.fix + f.est} />
                  <td className="px-3 py-1.5 text-[11.5px]">{f.L.length ? f.L.map((o, j) => <span key={o.x.id}>{j ? ' · ' : ''}{short(o.x.projectId)} {o.x.name}{o.est && <span className="text-ink3"> (추정)</span>}</span>) : <span className="text-ink3">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!!npc.length && <div className="px-4 py-2 text-[11.5px] text-amber">대금 단계가 없는 계약 {npc.length}건 ({npc.map((c) => `${short(c.projectId)} ${c.name.length > 20 ? `${c.name.slice(0, 20)}…` : c.name} ${manW(cSum(c).rev)}`).join(' · ')}) — 여기서 빠져 있습니다. 사업별 수익 › 대금에서 넣어 주세요</div>}
        {!!nod.length && <div className="px-4 py-2 text-[11.5px] text-amber">날짜를 알 수 없는 대금 {nod.length}건 ({manW(nod.reduce((a, o) => a + payAmt(X, o.x), 0))}) — 사업별 수익 › 대금에서 예정일을 넣어 주세요</div>}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">{Y}년 사업별</h3><span className="flex-1" /><span className="text-[11px] text-ink3">간접비는 사업별로 나누지 않음 (배부 기준 확인 필요)</span></div>
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>사업</th>{['매출', '매입', '인건비', '사업 이익', '이익률'].map((x) => <th key={x} className={thR}>{x}</th>)}</tr></thead>
          <tbody>
            {P.bySite.length ? P.bySite.map((x) => (
              <tr key={x.p.id} className="cursor-pointer border-b border-border hover:bg-panel-alt" onClick={() => goSite(x.p.id)} title="누르면 이 사업의 사업별 수익">
                <td className="px-3 py-1.5"><ProjectTag>{short(x.p.id)}</ProjectTag> {x.p.company}</td><Td v={x.rev} /><Td v={x.buy} /><Td v={x.lab} /><Td v={x.p_} /><td className="px-3 py-1.5 text-right tabular-nums">{pct(x.p_, x.rev)}</td>
              </tr>
            )) : <tr><td colSpan={6} className="px-4 py-3 text-ink3">{Y}년에 잡힌 매출 · 비용이 없습니다 — 사업별 수익에서 대금의 세금계산서 발행일을 기록하면 모입니다</td></tr>}
          </tbody>
        </table>
      </section>

      {modal === 'oh' && <OhModal m={d.today.slice(0, 7)} oh={X.oh} cfg={cfg} onClose={() => setModal(null)} onSave={async (x, base) => { await mut.saveOh.mutateAsync({ ...x, base }); setMsg(`${x.m} 간접비 저장`); setModal(null); }} />}
      {modal === 'cfg' && <CfgModal c={cfg} onClose={() => setModal(null)} onSave={async (x, base) => { await mut.saveMoneyCfg.mutateAsync({ c: x, base }); setMsg('단가 · 계산 기준 저장'); setModal(null); }} />}
    </div>
  );
}
