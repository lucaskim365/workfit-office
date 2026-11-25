import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { shortName } from '@/domain/pm/rules';
import { isDrop } from '@/domain/pm/site';
import { pctText } from '@/domain/pm/money';
import { cSum, type PmContract } from '@/domain/pm/quote';
import { usePmDerived } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { QuoteView } from './QuoteView';

/**
 * 사업 · 손익 › 사업별 수익 (money/site, 데모 pMoneySite 4499) — 6-5 에서는 견적 작성으로 들어가는 곳까지:
 * 왼쪽 사업 고르기 · 계약 · 견적 표(항목 펼치기 · [견적 열기]) · [+ 견적 작성]. 주소 `&qt=new` · `&qt=<계약 ID>` = 견적 작성 화면.
 * '매출 − 원가 = 이익' 식 · 사업 목록의 금액 · 이익률 · 재원 · 대금 · 원가 변경 탭은 6-6.
 * 금액 화면이라 pm.manage 만 (PmScreen 이 막음).
 */
const card = 'rounded-xl border border-border bg-panel shadow-sm';
const man = (n: number) => Math.round(n / 10000).toLocaleString();
const pct = (a: number, b: number) => pctText(b ? a / b : null);
const numTd = 'px-3 py-2 text-right align-top tabular-nums';

export function SiteMoneyView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const [params, setParams] = useSearchParams();
  const [msg, setMsg] = useState('');
  if (!d) return <EmptyHint title="사업별 수익을 불러오는 중입니다" />;
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
  const cs = snap.contracts.filter((c) => c.projectId === s.id);
  const est = cs.reduce((a, c) => { const x = cSum(c); return { rev: a.rev + x.rev, buy: a.buy + x.buy }; }, { rev: 0, buy: 0 });

  return (
    <div className="space-y-3">
      <ScreenHead title="사업별 수익" desc="사업마다 견적 매출 · 매입 · 이익과 계약 기준 원가 · 이익을 봅니다 (최종 견적서 매입 = 원가, 바뀐 금액만 따로 적음) · 견적은 [+ 견적 작성]에서 품목으로 넣고 회사 양식 엑셀로 내보냅니다.">
        <Button onClick={() => open('new')} title="품목을 넣어 견적을 만들고 회사 양식 엑셀로 내보냅니다">+ 견적 작성</Button>
      </ScreenHead>
      {msg && <div role="status" className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">{msg}</div>}
      <div className="grid items-start gap-3 lg:grid-cols-[220px_1fr]">
        <aside className={`${card} p-2`} aria-label="사업">
          <div className="px-2 pb-1.5 pt-1 text-[11.5px] font-bold text-ink3">사업 <span>{ss.length}</span></div>
          <div className="flex flex-col gap-1">
            {ss.map((x) => {
              const n = snap.contracts.filter((c) => c.projectId === x.id).length;
              return (
                <button key={x.id} type="button" onClick={() => { setMsg(''); setParams(new URLSearchParams({ v: 'money/site', k: x.id })); }}
                  className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-[12px] ${x.id === s.id ? 'border-teal bg-teal-soft font-bold text-teal' : 'border-transparent text-ink2 hover:bg-panel-alt'}`}>
                  <span>{short(x.id)}</span><span className="text-[11px] text-ink3">{n ? `견적 ${n}건` : '견적 없음'}</span>
                </button>
              );
            })}
          </div>
        </aside>
        <div className="space-y-3">
          <section className={card}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">계약 · 견적</h3><span className="text-[11.5px] text-ink3">{s.company} · 단위 만원</span></div>
            {cs.length ? (
              <table className="w-full text-[12.5px]">
                <thead className="border-b border-border bg-panel-alt"><tr><th className="px-3 py-2 text-left text-[11.5px] font-bold text-ink3">계약</th>{['매출', '매입', '이익', '이익률'].map((h) => <th key={h} className="px-3 py-2 text-right text-[11.5px] font-bold text-ink3">{h}</th>)}<th /></tr></thead>
                <tbody>
                  {cs.map((c) => <ContractRow key={c.id} c={c} onOpen={() => open(c.id)} />)}
                  <tr className="bg-panel-alt font-bold"><td className="px-3 py-2">합계</td><td className={numTd}>{man(est.rev)}</td><td className={numTd}>{man(est.buy)}</td><td className={numTd}>{man(est.rev - est.buy)}</td><td className={numTd}>{pct(est.rev - est.buy, est.rev)}</td><td /></tr>
                </tbody>
              </table>
            ) : <p className="px-4 py-4 text-[12px] text-ink3">아직 계약 · 견적이 없습니다. [+ 견적 작성]으로 품목을 넣어 주세요.</p>}
          </section>
          <p className="px-1 text-[11.5px] text-ink3">매출 − 원가 = 이익 · 재원 · 대금 · 원가 변경은 다음 단계(6-6)에서 이 화면에 옮깁니다.</p>
        </div>
      </div>
    </div>
  );
}

/** 계약 한 줄 — 항목별 상세는 접어 둠 (데모 cRow) */
function ContractRow({ c, onOpen }: { c: PmContract; onOpen: () => void }) {
  const t = cSum(c);
  const L = c.lines.filter((l) => l.rev || l.buy);
  return (
    <tr className="border-b border-border">
      <td className="px-3 py-2 align-top">
        <b>{c.name}</b> <Tag tone={c.kind === '정부지원' ? 'run' : 'plain'}>{c.kind}</Tag> <Tag tone={c.status === '계약' ? 'ok' : 'plain'}>{c.status}</Tag>{!c.conf && <> <Tag tone="warn" title={c.note}>확인 필요</Tag></>}
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
