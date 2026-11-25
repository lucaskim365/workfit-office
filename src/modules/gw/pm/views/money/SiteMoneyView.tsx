import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { shortName } from '@/domain/pm/rules';
import { isDrop } from '@/domain/pm/site';
import { pctText, wonText } from '@/domain/pm/money';
import { cSum, cloudMo, fundOf, type FundCtx, type PmContract, type PmPay } from '@/domain/pm/quote';
import { kosaH, man, manW, noPayC, payAmt, plOf, siteChip, siteHead, type PmCost } from '@/domain/pm/pl';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPl } from '@/features/pm/usePmPl';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { QuoteView } from './QuoteView';
import { CostModal, FundModal, PayModal } from './MoneyModals';

/**
 * 사업 · 손익 › 사업별 수익 (money/site, 데모 pMoneySite 4499) — 6-5 입구 + 6-6 나머지.
 * 왼쪽 사업 목록(매출 · 이익률 막대) · 위 '매출 − 원가 = 이익' 식 · 계약 · 견적 표 · 탭(재원 · 대금 · 원가 변경 + 직원 인건비).
 * 주소 `&qt=new` · `&qt=<계약 ID>` = 견적 작성 화면. 금액 화면이라 pm.manage 만 (PmScreen 이 막음).
 */
const card = 'rounded-xl border border-border bg-panel shadow-sm';
const pct = (a: number, b: number) => pctText(b ? a / b : null);
const numTd = 'px-3 py-2 text-right align-top tabular-nums';
const th = 'px-3 py-2 text-left text-[11.5px] font-bold text-ink3';
const thR = 'px-3 py-2 text-right text-[11.5px] font-bold text-ink3';
const Check = ({ title }: { title?: string }) => <Tag tone="warn" title={title || '확인 필요'}>확인 필요</Tag>;
type Tab = 'fund' | 'pay' | 'cost';

export function SiteMoneyView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const X = usePmPl(d);
  const mut = usePmMutations(people.me, people.nameOf);
  const [params, setParams] = useSearchParams();
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<Tab>('fund');
  const [modal, setModal0] = useState<{ kind: 'fund' } | { kind: 'pay'; p: PmPay | null } | { kind: 'cost'; c: PmCost | null } | null>(null);
  const [warn, setWarn] = useState('');
  // 창을 열면 지난 저장 안내 줄은 지움 (창 안 오류와 섞이지 않게)
  const setModal = (x: typeof modal) => { if (x) setMsg(''); setModal0(x); };
  if (!d || !X) return <EmptyHint title="사업별 수익을 불러오는 중입니다" />;
  const { snap } = d;
  const ss = [...snap.projects].filter((p) => !isDrop(p)).sort((a, b) => a.order - b.order);
  const has = (id: string) => snap.contracts.some((c) => c.projectId === id);
  const kP = params.get('k');
  const s = ss.find((p) => p.id === kP) ?? ss.find((p) => has(p.id)) ?? ss[0];
  if (!s) return <EmptyHint title="등록된 사업이 없습니다" hint="기준정보 › 사업에서 [+ 사업 등록]으로 사업을 넣으면 여기서 견적을 만들 수 있습니다." />;
  const open = (qt: string) => { setMsg(''); setParams(new URLSearchParams({ v: 'money/site', k: s.id, qt })); window.scrollTo(0, 0); };
  const qt = params.get('qt');
  if (qt) return <QuoteView projectId={s.id} cid={qt} onBack={(m) => { setMsg(m); setParams(new URLSearchParams({ v: 'money/site', k: s.id })); }} />;

  const short = (id: string) => { const p = snap.projects.find((x) => x.id === id); return p ? shortName(p, snap.projects) : id; };
  const k = s.id;
  const P = plOf(X, k);
  const H = siteHead(P);
  const fctx: FundCtx = { projects: snap.projects, plans: snap.plans, rules: snap.fundRules, cfg: snap.moneyCfg, contracts: snap.contracts, funds: snap.funds, today: d.today };
  const FO = fundOf(fctx, k);
  const cfg = snap.moneyCfg;
  const pays = snap.pays.filter((x) => x.projectId === k);
  const costs = snap.costs.filter((x) => x.projectId === k).sort((a, b) => (a.date < b.date ? 1 : -1));
  const noPay = noPayC(snap, k);
  const done = (m: string) => { setMsg(m); setModal(null); };
  const tabs: Array<[Tab, string]> = [['fund', '재원'], ['pay', `대금 ${pays.length}`], ['cost', `원가 변경 ${costs.length || ''}`.trim()]];
  const planVer = FO.plan?.ver ?? '';

  return (
    <div className="space-y-3">
      <ScreenHead title="사업별 수익" desc="사업마다 견적 매출 · 매입 · 이익과 계약 기준 원가 · 이익을 봅니다 (최종 견적서 매입 = 원가, 바뀐 금액만 따로 적음) · 견적은 [+ 견적 작성]에서 품목으로 넣고 회사 양식 엑셀로 내보냅니다.">
        <Button onClick={() => open('new')} title="품목을 넣어 견적을 만들고 회사 양식 엑셀로 내보냅니다">+ 견적 작성</Button>
      </ScreenHead>
      {msg && <div role="status" className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">{msg}</div>}
      {warn && <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger">{warn}</div>}
      <div className="grid items-start gap-3 lg:grid-cols-[230px_1fr]">
        <aside className={`${card} p-2`} aria-label="사업">
          <div className="px-2 pb-1.5 pt-1 text-[11.5px] font-bold text-ink3">사업 <span>{ss.length}</span></div>
          <div className="flex flex-col gap-1">
            {ss.map((x) => {
              const c = siteChip(X, x.id);
              const r = c.has && c.rv ? c.pr / c.rv : null;
              return (
                <button key={x.id} type="button" onClick={() => { setMsg(''); setWarn(''); setParams(new URLSearchParams({ v: 'money/site', k: x.id })); }}
                  className={`rounded-md border px-2.5 py-1.5 text-left text-[12px] ${x.id === s.id ? 'border-teal bg-teal-soft' : 'border-transparent hover:bg-panel-alt'}`}>
                  <div className="flex items-center gap-1.5">
                    <ProjectTag>{short(x.id)}</ProjectTag>
                    <span className="flex-1 truncate text-[11.5px] text-ink2">{c.has ? manW(c.rv) : '견적 없음'}{c.estOnly && <em className="ml-1 not-italic text-[10.5px] text-ink3">견적</em>}</span>
                    <b className={`text-[12px] tabular-nums ${r != null && r < 0.2 ? 'text-danger' : 'text-ink'}`}>{r != null ? pctText(r) : '-'}</b>
                  </div>
                  {r != null && <span className="mt-1 block h-1 rounded-full bg-border"><i className="block h-full rounded-full bg-teal" style={{ width: `${Math.max(0, Math.min(100, r * 100))}%` }} /></span>}
                </button>
              );
            })}
          </div>
        </aside>
        <div className="space-y-3">
          <section className={`${card} px-4 py-3`} aria-label="매출 · 원가 · 이익">
            <div className="flex flex-wrap items-center gap-2">
              <ProjectTag>{short(k)}</ProjectTag>
              <h3 className="text-[14px] font-bold text-ink">{s.company}</h3>
              <span className="text-[11.5px] text-ink3">{s.biz}</span>
              <span className="flex-1" />
              {H.est && H.r ? <Tag tone="warn">계약 전 · 견적 기준</Tag> : H.r ? <Tag tone="run">계약 {H.nSig}건</Tag> : null}
            </div>
            {H.r ? (
              <>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <Eq l="매출" v={manW(H.r)} /><span className="pb-1 text-[18px] text-ink3">−</span><Eq l="원가" v={manW(H.c)} /><span className="pb-1 text-[18px] text-ink3">=</span>
                  <Eq l={<>이익 <em className="not-italic text-teal">{pct(H.p, H.r)}</em></>} v={manW(H.p)} neg={H.p < 0} />
                </div>
                <div className="mt-2 flex h-5 overflow-hidden rounded-md text-[10.5px] font-bold text-white">
                  <i className="flex items-center overflow-hidden whitespace-nowrap bg-ink3 px-1.5 not-italic" style={{ width: `${H.cw}%` }}>원가 {Math.round(H.cw)}%</i>
                  <i className="flex items-center overflow-hidden whitespace-nowrap bg-teal px-1.5 not-italic" style={{ width: `${100 - H.cw}%` }}>이익 {Math.round(100 - H.cw)}%</i>
                </div>
                <div className="mt-2 text-[11.5px] text-ink2">
                  {H.est ? `견적 ${P.cs.length}건 — 견적이 '계약'이 되면 계약 기준으로 바뀝니다`
                    : `원가 = 최종 견적 매입 ${manW(P.base)}${P.chg ? ` ${P.chg > 0 ? '+' : '−'} 변경 ${manW(Math.abs(P.chg))}` : ' · 변경 없음'}${P.lab.amt ? ` + 인건비 ${manW(P.lab.amt)}` : ''}${H.estOnly ? ` · 아직 계약 전인 견적 ${manW(H.estOnly)} 별도` : ''}${cfg.laborOn ? '' : ' · 직원 인건비 빠짐'}`}
                </div>
              </>
            ) : <p className="mt-2 text-[12px] text-ink3">아직 견적 · 계약이 없어요. [+ 견적 작성]으로 품목을 넣으면 매출 · 원가 · 이익이 여기에 계산됩니다.</p>}
          </section>

          <section className={card}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">계약 · 견적</h3><span className="text-[11.5px] text-ink3">{s.company} · 단위 만원</span></div>
            {P.cs.length ? (
              <table className="w-full text-[12.5px]">
                <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>계약</th>{['매출', '매입', '이익', '이익률'].map((h) => <th key={h} className={thR}>{h}</th>)}<th /></tr></thead>
                <tbody>
                  {P.cs.map((c) => <ContractRow key={c.id} c={c} onOpen={() => open(c.id)} />)}
                  <tr className="bg-panel-alt font-bold"><td className="px-3 py-2">합계</td><td className={numTd}>{man(P.est.rev)}</td><td className={numTd}>{man(P.est.buy)}</td><td className={numTd}>{man(P.estP)}</td><td className={numTd}>{pct(P.estP, P.est.rev)}</td><td /></tr>
                </tbody>
              </table>
            ) : <p className="px-4 py-4 text-[12px] text-ink3">아직 계약 · 견적이 없습니다. [+ 견적 작성]으로 품목을 넣어 주세요.</p>}
          </section>

          <div className="flex gap-1" role="tablist">
            {tabs.map(([v, l]) => <Button key={v} size="sm" variant={tab === v ? 'primary' : 'secondary'} onClick={() => setTab(v)} aria-selected={tab === v}>{l}</Button>)}
          </div>

          {tab === 'fund' && (FO.none
            ? <section className={`${card} px-4 py-3 text-[12px] text-ink3`}>견적서나 사업계획서가 아직 없어 사업비 구성을 계산할 수 없습니다 — [+ 견적 작성]으로 견적을 넣거나 사업계획서를 등록해 주세요.</section>
            : (
              <section className={card}>
                <div className="flex items-center border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">사업비 구성 (재원)</h3><span className="flex-1" /><Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'fund' })}>재원 수정</Button></div>
                <div className="px-4 py-3">
                  <div className="mb-2 text-[11.5px] text-ink2">
                    지원 기준: <b>{FO.r ? `${FO.r.year} · ${FO.r.region}${FO.r.sigungu ? ` (${FO.r.sigungu})` : ''} · ${FO.r.biz}` : '선택 안 함'}</b>
                    {FO.auto && <> <Tag tone="run" title="사업구분 · 시작 연도로 자동 선택">자동</Tag></>}
                    {!!FO.regN && <span> · {FO.reg} 추가 지원 기준 {FO.regN}개 — 선정됐으면 [재원 수정]에서 고르세요</span>}
                    {FO.r && !FO.r.conf && <> <Check title={FO.r.src} /></>}
                    {FO.r?.src && <span className="text-ink3"> · {FO.r.src}</span>}
                  </div>
                  <table className="w-full text-[12px]">
                    <thead className="border-b border-border"><tr><th className={th}>구분</th><th className={th}>기준</th><th className={thR}>계산 (만원)</th><th className={thR}>적용 (만원)</th></tr></thead>
                    <tbody>
                      {FO.usePlan
                        ? <tr className="border-b border-border"><td className="px-3 py-1.5">총사업비 · 현물</td><td className="px-3 py-1.5 text-[11.5px] text-ink2" colSpan={2}>견적이 아직 없어 <b>사업계획서 {planVer} 4.1 총괄</b> 값을 씀 · 현물 {man(FO.planKind)}만</td><td className={numTd}>{man(FO.planTot)}</td></tr>
                        : <>
                          <tr className="border-b border-border"><td className="px-3 py-1.5">구축금액</td><td className="px-3 py-1.5 text-[11.5px] text-ink2">정부지원 계약 견적 합계</td><td /><td className={numTd}>{man(FO.build)}</td></tr>
                          <tr className="border-b border-border"><td className="px-3 py-1.5">인력 현물</td><td className="px-3 py-1.5 text-[11.5px] text-ink2">도입기업 투입 인력</td><td /><td className={numTd}>{man(FO.man)}</td></tr>
                          <tr className="border-b border-border"><td className="px-3 py-1.5">클라우드 현물</td><td className="px-3 py-1.5 text-[11.5px] text-ink2">월 {(cloudMo(FO.f, cfg) / 10000).toLocaleString()}만 × {FO.f.cloudM ?? cfg.cloudMonths}개월</td><td /><td className={numTd}>{man(FO.cloud)}</td></tr>
                        </>}
                      <tr className="border-b border-border bg-panel-alt font-bold"><td className="px-3 py-1.5">총사업비</td>
                        <td className="px-3 py-1.5 text-[11.5px]">{FO.planTot ? (Math.abs(FO.planTot - FO.total) < 1000 ? <span className="text-ok">✓ 사업계획서 총괄과 같음</span> : <span className="text-amber">사업계획서 총괄 {man(FO.planTot)}만과 다름</span>) : null}</td><td /><td className={numTd}>{man(FO.total)}</td></tr>
                      {FO.rows.map((x) => (
                        <tr key={x.key} className="border-b border-border">
                          <td className="px-3 py-1.5">{x.name} 지원금</td>
                          <td className="px-3 py-1.5 text-[11.5px] text-ink2">{x.rate == null ? '비율 확인 필요' : `${x.rate}%`}{x.cap != null && ` · 최대 ${wonText(x.cap)}`}</td>
                          <td className={numTd}>{x.calc == null ? '-' : man(x.calc)}</td>
                          <td className={numTd}>{x.use == null ? <Check /> : man(x.use)}{x.fromPlan ? <> <Tag tone="run" title={`사업계획서 ${planVer} 4.1 총괄의 정부지원금`}>계획서</Tag></> : x.fix != null ? <> <Tag tone="run" title={FO.f.fixNote || '확정 금액'}>확정</Tag></> : null}</td>
                        </tr>
                      ))}
                      <tr className="bg-panel-alt font-bold"><td className="px-3 py-1.5">도입기업 자부담 (현금)</td><td className="px-3 py-1.5 text-[11.5px] font-normal text-ink2">총사업비 − 지원금 − 현물</td><td /><td className={numTd}>{FO.unknown ? <Check /> : man(FO.self)}</td></tr>
                    </tbody>
                  </table>
                  {FO.f.fixNote && <div className="mt-1.5 text-[11px] text-ink3">확정: {FO.f.fixNote}</div>}
                </div>
              </section>
            ))}

          {tab === 'pay' && (
            <section className={card}>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">대금 일정</h3><span className="text-[11px] text-ink3">견적서 지불조건 · 세금계산서는 시스템별 설치 후 발행</span><span className="flex-1" />
                <Button size="sm" variant="secondary" onClick={() => { if (!P.cs.length) { setWarn('먼저 계약 · 견적을 추가해 주세요'); return; } setWarn(''); setModal({ kind: 'pay', p: null }); }}>+ 대금 추가</Button></div>
              <table className="w-full text-[12px]">
                <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>계약</th><th className={th}>단계</th><th className={thR}>금액 (만원)</th><th className={th}>예정일</th><th className={th}>세금계산서</th><th className={th}>입금</th></tr></thead>
                <tbody>
                  {pays.map((x) => {
                    const c = snap.contracts.find((y) => y.id === x.cid);
                    return (
                      <tr key={x.id} className="cursor-pointer border-b border-border hover:bg-panel-alt" onClick={() => setModal({ kind: 'pay', p: x })} title="눌러서 고치기">
                        <td className="px-3 py-1.5 text-[11.5px]">{c ? c.name : '-'}</td><td className="px-3 py-1.5">{x.name}</td><td className={numTd}>{man(payAmt(snap, x))}</td>
                        <td className="px-3 py-1.5 text-[11.5px]">{x.due || <span className="text-ink3">미정</span>}</td>
                        <td className="px-3 py-1.5 text-[11.5px]">{x.inv || <span className="text-ink3">-</span>}</td>
                        <td className="px-3 py-1.5 text-[11.5px]">{x.paid ? <span className="text-ok">✓ {x.paid}</span> : <span className="text-ink3">-</span>}</td>
                      </tr>
                    );
                  })}
                  {noPay.map((c) => <tr key={c.id} className="border-b border-border"><td className="px-3 py-1.5 text-[11.5px]">{c.name}</td><td colSpan={5} className="px-3 py-1.5 text-[11.5px] text-amber">대금 단계 없음 — 예상 매출 · 월별 손익에서 {manW(cSum(c).rev)}이 빠집니다. 지불조건(선급 · 잔금 등)을 확인해 [+ 대금 추가]로 넣어 주세요</td></tr>)}
                  {!pays.length && !noPay.length && <tr><td colSpan={6} className="px-4 py-3 text-ink3">대금 단계가 없습니다</td></tr>}
                </tbody>
              </table>
            </section>
          )}

          {tab === 'cost' && (
            <>
              <section className={card}>
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">원가 변경</h3><span className="text-[11px] text-ink3">최종 견적서의 매입 {man(P.base)}만을 원가로 봄 · 도입기업 요청 등으로 바뀐 금액만 적음 (줄면 −)</span><span className="flex-1" />
                  <Button size="sm" onClick={() => setModal({ kind: 'cost', c: null })}>+ 변경 등록</Button></div>
                <table className="w-full text-[12px]">
                  <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>날짜</th><th className={th}>분류</th><th className={th}>내용</th><th className={th}>거래처</th><th className={thR}>금액 (만원)</th></tr></thead>
                  <tbody>
                    {costs.length ? costs.map((x) => (
                      <tr key={x.id} className="cursor-pointer border-b border-border hover:bg-panel-alt" onClick={() => setModal({ kind: 'cost', c: x })} title="눌러서 고치기">
                        <td className="px-3 py-1.5 text-[11.5px]">{x.date}</td><td className="px-3 py-1.5 text-[11.5px]">{x.cat}</td><td className="px-3 py-1.5">{x.desc}</td><td className="px-3 py-1.5 text-[11.5px] text-ink2">{x.vendor}</td>
                        <td className={numTd}>{x.amt > 0 ? '+' : ''}{man(x.amt)}</td>
                      </tr>
                    )) : <tr><td colSpan={5} className="px-4 py-3 text-ink3">변경 없음 — 원가 = 견적 매입 그대로</td></tr>}
                  </tbody>
                </table>
              </section>
              {!cfg.laborOn
                ? <section className={`${card} px-4 py-3 text-[12px] text-ink2`}>직원 인건비는 아직 반영하지 않습니다 — 회사 견적서와 같은 방식 (계산 방식 · 단가가 정해지면 기준정보 › 지원 기준 · 단가에서 켭니다)</section>
                : (
                  <section className={card}>
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">직원 인건비</h3><span className="text-[11px] text-ink3">업무계획 시간 × {cfg.kosaName} {cfg.kosaMonthly.toLocaleString()}원 ÷ {cfg.workH}h</span><Check title="인건비 단가 기준 확인 필요" /></div>
                    <table className="w-full text-[12px]">
                      <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>사람</th><th className={thR}>시간</th><th className={thR}>인건비 (만원)</th></tr></thead>
                      <tbody>
                        {Object.keys(P.lab.per).length ? Object.entries(P.lab.per).sort((a, b) => b[1] - a[1]).map(([w, h]) => (
                          <tr key={w} className="border-b border-border"><td className="px-3 py-1.5">{people.nameOf(w)}</td><td className={numTd}>{h}h</td><td className={numTd}>{man(h * kosaH(cfg))}</td></tr>
                        )) : <tr><td colSpan={3} className="px-4 py-3 text-ink3">이 사업에 시간이 기록된 업무가 없습니다 — 업무계획의 '시간' 칸을 적으면 여기에 모입니다</td></tr>}
                      </tbody>
                    </table>
                  </section>
                )}
            </>
          )}
        </div>
      </div>
      {modal?.kind === 'fund' && <FundModal short={short(k)} F={FO} rules={snap.fundRules} cfg={cfg} onClose={() => setModal(null)} onSave={async (f) => { await mut.saveFund.mutateAsync(f); done('재원 저장'); }} />}
      {modal?.kind === 'pay' && <PayModal p={modal.p} projectId={k} cs={P.cs} onClose={() => setModal(null)}
        onSave={async (p) => { await mut.savePay.mutateAsync(p); done(modal.p ? '대금 단계 수정' : '대금 단계 추가'); }}
        onRemove={async (id) => { await mut.removePay.mutateAsync(id); done('대금 단계 삭제'); }} />}
      {modal?.kind === 'cost' && <CostModal c={modal.c} projectId={k} short={short(k)} today={d.today} onClose={() => setModal(null)}
        onSave={async (c) => { await mut.saveCost.mutateAsync(c); done(modal.c ? '원가 변경 수정' : '원가 변경 등록'); }}
        onRemove={async (id) => { await mut.removeCost.mutateAsync(id); done('원가 변경 삭제'); }} />}
    </div>
  );
}

const Eq = ({ l, v, neg }: { l: ReactNode; v: string; neg?: boolean }) => (
  <div><small className="block text-[11px] font-bold text-ink3">{l}</small><b className={`text-[20px] leading-tight tabular-nums ${neg ? 'text-danger' : 'text-ink'}`}>{v}</b></div>
);

/** 계약 한 줄 — 항목별 상세는 접어 둠 (데모 cRow) */
function ContractRow({ c, onOpen }: { c: PmContract; onOpen: () => void }) {
  const t = cSum(c);
  const L = c.lines.filter((l) => l.rev || l.buy);
  return (
    <tr className="border-b border-border">
      <td className="px-3 py-2 align-top">
        <b>{c.name}</b> <Tag tone={c.kind === '정부지원' ? 'run' : 'plain'}>{c.kind}</Tag> <Tag tone={c.status === '계약' ? 'ok' : 'plain'}>{c.status}</Tag>{!c.conf && <> <Check title={c.note} /></>}
        <details className="mt-1">
          <summary className="cursor-pointer text-[11.5px] text-ink2">항목 {L.length}개 보기{c.note ? ` · ${c.note.length > 40 ? `${c.note.slice(0, 40)}…` : c.note}` : ''}</summary>
          <table className="mt-1.5 w-full text-[11.5px]">
            <thead className="border-b border-border"><tr><th className="px-2 py-1 text-left text-ink3">항목</th>{['매출', '매입', '이익', '이익률'].map((h) => <th key={h} className="px-2 py-1 text-right text-ink3">{h}</th>)}</tr></thead>
            <tbody>{L.map((l) => <tr key={l.cat} className="border-b border-border last:border-b-0"><td className="px-2 py-1">{l.cat}</td><td className="px-2 py-1 text-right tabular-nums">{man(l.rev)}</td><td className="px-2 py-1 text-right tabular-nums">{man(l.buy)}</td><td className="px-2 py-1 text-right tabular-nums">{man(l.rev - l.buy)}</td><td className="px-2 py-1 text-right tabular-nums">{pct(l.rev - l.buy, l.rev)}</td></tr>)}</tbody>
          </table>
          {c.note && <div className="mt-1 text-[11px] text-ink3">{c.note}</div>}
        </details>
      </td>
      <td className={numTd}>{man(t.rev)}</td><td className={numTd}>{man(t.buy)}</td><td className={numTd}>{man(t.rev - t.buy)}</td><td className={numTd}>{pct(t.rev - t.buy, t.rev)}</td>
      <td className="whitespace-nowrap px-3 py-2 align-top"><Button size="sm" variant="secondary" onClick={onOpen} title={c.q ? `견적 품목 ${c.q.items.length}개 · 견적일 ${c.q.date || '-'}` : '품목 없이 항목별 금액만 있음'}>견적 열기</Button></td>
    </tr>
  );
}
