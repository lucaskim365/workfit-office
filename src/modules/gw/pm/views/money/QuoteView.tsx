import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { shortName } from '@/domain/pm/rules';
import { PL_CATS, ciNorm, fmtW, fmtW0, pctText, ruleText, type QtSec } from '@/domain/pm/money';
import {
  QT_SEC_TITLE, fundOf, qAmt, qBuy, qFundRows, qIt, qLines, qNewRows, qNum, qOthers, qOv, quoteCheck, quoteDraft, type FundCtx, type PmQuote, type PmQuoteItem, type QuoteDraft,
} from '@/domain/pm/quote';
import { fillMyungsung } from '@/domain/pm/quoteDemo';
import { buildQuoteXlsx, quoteFileName } from '@/data/pm/quoteXlsx';
import tplUrl from '@/data/pm/seed/quote-template.xlsx?url';
import type { PmSnapshot } from '@/data/pm/pm.store';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { QuotePickModal } from './QuotePickModal';

/**
 * 사업 · 손익 › 사업별 수익 › 견적 작성 (데모 pQuote 4746 · qRefresh 4781 · qInput 4812 · qSave 4825 · qExport 5070) — 6-5.
 * 품목을 넣으면 공급금액 · 매입 · 이익과 표지 요약, 사업비 현황(①~⑧)이 바로 계산된다. 저장하면 계약 · 견적이 되고,
 * [엑셀로 내보내기]는 회사 견적서 양식으로 같은 숫자를 뽑는다. 금액 화면이라 pm.manage 만 (PmScreen 이 막음).
 */
const card = 'rounded-xl border border-border bg-panel shadow-sm';
const th = 'px-1.5 py-2 text-left text-[11.5px] font-bold text-ink3';
const td = 'px-1.5 py-1.5 align-top';
const inp = 'w-full min-w-0 rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';
const w = (n: number) => Math.round(n).toLocaleString();

function Fld({ label, span, children }: { label: string; span?: string; children: ReactNode }) {
  return <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${span ?? ''}`}><span>{label}</span>{children}</label>;
}
/** 금액 칸 — 고칠 땐 그대로, 나오면 '1,234,000' (데모 qm · focusout fmtW) */
function Num({ value, onChange, zero, right = true, placeholder, label }: { value: number | null; onChange: (v: number | null) => void; zero?: boolean; right?: boolean; placeholder?: string; label?: string }) {
  const show = (v: number | null) => (v == null ? '' : zero ? fmtW0(v) : fmtW(v));
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <input className={`${inp} ${right ? 'text-right tabular-nums' : ''}`} value={txt ?? show(value)} placeholder={placeholder} aria-label={label}
      onFocus={() => setTxt(show(value))} onBlur={() => setTxt(null)}
      onChange={(e) => { setTxt(e.target.value); onChange(e.target.value.trim() === '' ? null : qNum(e.target.value)); }} />
  );
}

export function QuoteView({ projectId, cid, onBack }: { projectId: string; cid: string; onBack: (msg: string) => void }) {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  if (!d) return <EmptyHint title="견적을 불러오는 중입니다" />;
  const p = d.snap.projects.find((x) => x.id === projectId);
  const c = cid && cid !== 'new' ? d.snap.contracts.find((x) => x.id === cid) : null;
  if (!p || (cid !== 'new' && !c)) return <EmptyHint title="견적을 찾을 수 없습니다" hint={<button className="font-bold text-teal underline" onClick={() => onBack('')}>사업별 수익으로 돌아가기</button>} />;
  return <QuoteEditor key={`${projectId}|${cid}`} snap={d.snap} today={d.today} projectId={projectId} cid={c?.id ?? ''} onBack={onBack} />;
}

function QuoteEditor({ snap, today, projectId, cid, onBack }: { snap: PmSnapshot; today: string; projectId: string; cid: string; onBack: (msg: string) => void }) {
  const people = usePmPeople();
  const mut = usePmMutations(people.me, people.nameOf);
  const p = snap.projects.find((x) => x.id === projectId)!;
  const short = shortName(p, snap.projects);
  const [E, setE] = useState<QuoteDraft>(() => quoteDraft(snap.contracts.find((x) => x.id === cid) ?? null, projectId, snap.funds.find((f) => f.id === projectId), snap.moneyCfg, today));
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState<QtSec | null>(null);
  const [busy, setBusy] = useState(false);
  const ctx: FundCtx = useMemo(() => ({ projects: snap.projects, plans: snap.plans, rules: snap.fundRules, cfg: snap.moneyCfg, contracts: snap.contracts, funds: snap.funds, today }), [snap, today]);

  const upd = (fn: (x: QuoteDraft) => QuoteDraft) => { setE(fn); setDirty(true); setErr(''); };
  const setQ = <K extends keyof PmQuote>(k: K, v: PmQuote[K]) => upd((x) => ({ ...x, q: { ...x.q, [k]: v } }));
  const setIt = (i: number, patch: Partial<PmQuoteItem>) => upd((x) => ({ ...x, q: { ...x.q, items: x.q.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } }));
  const setF = <K extends keyof QuoteDraft['f']>(k: K, v: QuoteDraft['f'][K]) => upd((x) => ({ ...x, f: { ...x.f, [k]: v } }));
  const say = (m: string) => { setMsg(m); setErr(''); };

  const q = E.q;
  const ov = qOv(ctx, E);
  const F = fundOf(ctx, projectId, ov);
  const R = qFundRows(F, snap.moneyCfg);
  const oth = qOthers(snap.contracts, E);
  const L = qLines(q).filter((l) => l.rev || l.buy);
  const T = L.reduce((a, l) => ({ rev: a.rev + l.rev, buy: a.buy + l.buy }), { rev: 0, buy: 0 });
  const newRows = qNewRows(snap.items, q);
  const itemIds = new Set(snap.items.map((x) => x.id));

  const save = async () => {
    const e = quoteCheck(E);
    if (e) { setErr(e[0]); return; }
    setBusy(true);
    try { const r = await mut.saveQuote.mutateAsync({ E, src: short }); onBack(r.isNew ? '견적을 저장했습니다' : '견적을 고쳤습니다'); }
    catch (x) { setErr((x as Error).message || '저장하지 못했습니다'); }
    finally { setBusy(false); }
  };
  const back = () => { if (dirty && !confirm('저장하지 않은 내용이 있습니다. 나갈까요?')) return; onBack(''); };
  const delC = async () => {
    const cur = snap.contracts.find((x) => x.id === E.cid);
    if (!cur || !confirm(`'${cur.name}' 계약 · 견적과 연결된 대금 일정을 삭제할까요?`)) return;
    try { await mut.removeContract.mutateAsync(cur.id); onBack('계약 · 견적 삭제'); } catch (x) { setErr((x as Error).message || '지우지 못했습니다'); }
  };
  const delRow = (i: number) => {
    const it = q.items[i];
    if ((it.name || qAmt(it)) && !confirm(`'${String(it.name || '').split(/\r?\n/)[0]}' 줄을 지울까요?`)) return;
    upd((x) => ({ ...x, q: { ...x.q, items: x.q.items.filter((_, j) => j !== i) } }));
  };
  /** 직접 쓴 줄 → 품목 · 단가 목록 (qReg1 · qRegister) — 목록에 같은 이름이 있으면 그 품목과 연결만 */
  const reg = async (idx: number[]) => {
    const ids = await mut.registerItems.mutateAsync({ lines: idx.map((i) => q.items[i]), src: short, date: q.date || today });
    upd((x) => ({ ...x, q: { ...x.q, items: x.q.items.map((it, j) => { const k = idx.indexOf(j); return k >= 0 ? { ...it, pid: ids[k] } : it; }) } }));
    return ids.length;
  };
  const reg1 = async (i: number) => {
    const it = q.items[i];
    if (!String(it.name || '').trim() || !qNum(it.price)) { setErr('품목 이름과 공급단가를 먼저 넣어 주세요'); return; }
    const ex = snap.items.find((x) => ciNorm(x.name) === ciNorm(it.name));
    if (ex) { setIt(i, { pid: ex.id }); say(`'${ex.name}'은(는) 이미 목록에 있어 그 품목과 연결했습니다 (목록 단가는 그대로)`); return; }
    try { await reg([i]); say(`'${String(it.name).split('\n')[0]}'을(를) 기준정보 › 품목 · 단가에 추가했습니다`); } catch (x) { setErr((x as Error).message); }
  };
  const regAll = async () => {
    if (!newRows.length) return;
    if (!confirm(`목록에 없는 줄 ${newRows.length}개를 모두 기준정보(품목 · 단가)에 추가할까요?\n\n${newRows.map((it) => `· ${String(it.name).split('\n')[0]}`).join('\n')}\n\n일부만 넣으려면 줄마다 있는 [+ 기준정보 추가]를 누르세요.`)) return;
    try { const n = await reg(newRows.map((it) => q.items.indexOf(it))); say(`품목 ${n}개를 기준정보에 추가했습니다`); } catch (x) { setErr((x as Error).message); }
  };
  const exportXlsx = async () => {
    setBusy(true);
    try {
      const tpl = new Uint8Array(await (await fetch(tplUrl)).arrayBuffer());
      const x = { q, kind: E.kind, short, company: p.company, fund: E.kind === '정부지원' ? F : null, fundRows: R, today };
      const bytes = await buildQuoteXlsx(tpl, x);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url; a.download = quoteFileName(x);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      say('엑셀 견적서를 내려받았습니다 — 화면 값 그대로 (저장은 따로)');
    } catch (e) { setErr(`엑셀을 만들지 못했습니다: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  const fillTest = () => {
    if (dirty && q.items.some((it) => qAmt(it)) && !confirm('지금 입력한 품목을 지우고 테스트 값(명성ENG 견적서)으로 채울까요? 저장 전까지는 아무것도 바뀌지 않습니다.')) return;
    const r = snap.fundRules.find((x) => x.region === '전국' && /부처협업형/.test(x.biz))?.id ?? '';
    upd((x) => fillMyungsung(x, r));
    say('테스트 값(명성ENG 견적서)을 채웠습니다 — 합계 368,981,000원이 나오면 정상');
  };

  const sel = (v: string, opts: ReadonlyArray<string | readonly [string, string]>, on: (v: string) => void, label: string) => (
    <select className={inp} value={v} onChange={(e) => on(e.target.value)} aria-label={label}>
      {opts.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return <option key={val} value={val}>{lab}</option>; })}
    </select>
  );
  const txt = (v: string, on: (v: string) => void, ph = '', type = 'text') => <input type={type} className={inp} value={v} placeholder={ph} onChange={(e) => on(e.target.value)} />;

  return (
    <div className="space-y-3">
      <ScreenHead title={`견적 작성 — ${short}`} desc="품목을 넣으면 공급금액 · 매입 · 이익과 표지 요약, 사업비 현황(①~⑧)이 바로 계산됩니다. 저장하면 사업별 수익 · 월별 손익 · 통합 사업 현황에 그대로 반영되고, [엑셀로 내보내기]는 회사 견적서 양식으로 같은 숫자를 뽑습니다.">
        <Button variant="secondary" onClick={back}>사업별 수익으로</Button>
        {import.meta.env.DEV && <Button variant="secondary" onClick={fillTest} title="개발 서버 전용 — 명성ENG 견적서(2026-11-06) 값을 그대로 채움. 내보낸 엑셀을 원본과 비교해 볼 수 있음">테스트 값 채우기</Button>}
        <Button variant="secondary" disabled={busy} onClick={() => void exportXlsx()} title="회사 견적서 양식(명성ENG 11/6 기준)으로 내려받기 — 화면에 보이는 값 그대로">엑셀로 내보내기</Button>
        <Button disabled={busy} onClick={() => void save()}>저장</Button>
      </ScreenHead>
      {(err || msg) && <div role={err ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-[12px] font-bold ${err ? 'border-danger/30 bg-danger/10 text-danger' : 'border-ok/30 bg-ok/10 text-ok'}`}>{err || msg}</div>}

      <section className={card}>
        <div className="flex items-center border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">견적서 정보</h3><span className="flex-1" />{E.cid && <Button size="sm" variant="secondary" onClick={() => void delC()}>계약 · 견적 삭제</Button>}</div>
        <div className="px-4 py-3">
          {E.conv && <div className="mb-2.5 rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-[12px] text-ink2">이 계약은 품목 없이 항목별 금액만 있어서 항목마다 한 줄로 바꿔 보여 줍니다. 저장하면 이 줄들이 견적 품목이 됩니다.</div>}
          <div className="grid gap-2.5 sm:grid-cols-4">
            <Fld label="계약 이름 *">{txt(E.name, (v) => upd((x) => ({ ...x, name: v })), '예: 부처협업형 정부지원 MES 구축')}</Fld>
            <Fld label="종류">{sel(E.kind, ['정부지원', '자체'], (v) => upd((x) => ({ ...x, kind: v as QuoteDraft['kind'] })), '종류')}</Fld>
            <Fld label="상태">{sel(E.status, ['견적', '계약'], (v) => upd((x) => ({ ...x, status: v as QuoteDraft['status'] })), '상태')}</Fld>
            <Fld label="견적일">{txt(q.date, (v) => setQ('date', v), '', 'date')}</Fld>
            <Fld label="견적번호">{txt(q.no, (v) => setQ('no', v))}</Fld>
            <Fld label="수신">{txt(q.to, (v) => setQ('to', v), '예: ㈜효광')}</Fld>
            <Fld label="참조">{txt(q.ref, (v) => setQ('ref', v), '예: 최지희 이사님')}</Fld>
            <Fld label="담당자">{txt(q.mgr, (v) => setQ('mgr', v), '예: AX영업팀 홍형표 팀장')}</Fld>
            <Fld label="유효기간">{txt(q.valid, (v) => setQ('valid', v))}</Fld>
            <Fld label="지불조건" span="sm:col-span-2">{txt(q.pay, (v) => setQ('pay', v))}</Fld>
            <Fld label="메모">{txt(E.note, (v) => upd((x) => ({ ...x, note: v })))}</Fld>
            <Fld label="Project (견적 제목)" span="sm:col-span-4">{txt(q.proj, (v) => setQ('proj', v), '예: 2027년 스마트팩토리 지원 MES 구축 견적의 건')}</Fld>
          </div>
        </div>
      </section>

      {QT_SEC_TITLE.map(([sec, title]) => {
        const rows = q.items.map((it, i) => [it, i] as const).filter(([it]) => it.sec === sec);
        const a = rows.reduce((s, [it]) => s + qAmt(it), 0);
        const b = rows.reduce((s, [it]) => s + qBuy(it), 0);
        return (
          <section key={sec} className={card} aria-label={title}>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
              <h3 className="text-[13px] font-bold">{title}</h3>
              <span className="text-[11.5px] text-ink3">소계 {w(a)}원 · 매입 {w(b)}원 · 이익 {w(a - b)}원</span>
              <span className="flex-1" />
              <Button size="sm" variant="primary" onClick={() => setPick(sec)} title="기준정보 › 품목 · 단가에 등록된 장비 · 소프트웨어에서 골라 넣기">품목에서 고르기</Button>
              <Button size="sm" variant="secondary" onClick={() => upd((x) => ({ ...x, q: { ...x.q, items: [...x.q.items, qIt(sec)] } }))} title="목록에 없는 것을 직접 쓰기">+ 직접 줄 추가</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-[12.5px]">
                <colgroup><col className="w-[13%]" /><col /><col className="w-[5%]" /><col className="w-[5.5%]" /><col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[11%]" /><col className="w-[9.5%]" /><col className="w-[11%]" /><col className="w-[6%]" /><col className="w-[6%]" /></colgroup>
                <thead className="border-b border-border bg-panel-alt"><tr>
                  <th className={th}>품목</th><th className={th}>세부 내역</th><th className={th}>수량</th><th className={th}>단위</th><th className={`${th} text-right`}>공급단가</th><th className={`${th} text-right`}>공급금액</th>
                  <th className={`${th} text-right`} title="협력사 견적 단가 (NEGO 후). 매입 = 수량 × 매입 단가">매입 단가</th><th className={`${th} text-right`}>매입</th><th className={th}>표지 분류</th><th className={th}>비고</th><th className={th} />
                </tr></thead>
                <tbody>
                  {rows.length ? rows.map(([it, i]) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className={td}>
                        <textarea className={`${inp} resize-y`} rows={2} value={it.name} aria-label="품목" onChange={(e) => setIt(i, { name: e.target.value })} />
                        {it.pid && itemIds.has(it.pid)
                          ? <div className="mt-0.5 text-[11px] text-ink3" title="기준정보 › 품목 · 단가에 있는 품목">✓ 목록 품목</div>
                          : <Button size="sm" variant="primary" block onClick={() => void reg1(i)} title="이 줄을 기준정보 › 품목 · 단가에 등록 — 다음 견적부터 [품목에서 고르기]로 쓸 수 있음">+ 기준정보 추가</Button>}
                      </td>
                      <td className={td}><textarea className={`${inp} resize-y text-[12px] leading-snug`} rows={3} value={it.desc} aria-label="세부 내역" onChange={(e) => setIt(i, { desc: e.target.value })} /></td>
                      <td className={td}><Num value={it.qty} zero label="수량" onChange={(v) => setIt(i, { qty: v ?? 0 })} /></td>
                      <td className={td}><input className={inp} value={it.unit} aria-label="단위" onChange={(e) => setIt(i, { unit: e.target.value })} /></td>
                      <td className={td}><Num value={it.price} label="공급단가" onChange={(v) => setIt(i, { price: v ?? 0 })} /></td>
                      <td className={`${td} pt-3 text-right tabular-nums`}>{w(qAmt(it))}</td>
                      <td className={td}>
                        {sec === 'etc' && <label className="flex items-center gap-1 whitespace-nowrap text-[11.5px]" title="받은 금액을 그대로 냄 (매입 = 공급금액)"><input type="checkbox" checked={it.pass} onChange={(e) => setIt(i, { pass: e.target.checked })} /> 그대로</label>}
                        {!it.pass && <Num value={it.cost} label="매입 단가" onChange={(v) => setIt(i, { cost: v ?? 0 })} />}
                      </td>
                      <td className={`${td} pt-3 text-right tabular-nums`}>{w(qBuy(it))}</td>
                      <td className={td}>{sel(it.cat, PL_CATS, (v) => setIt(i, { cat: v }), '표지 분류')}</td>
                      <td className={td}><input className={inp} value={it.note} aria-label="비고" onChange={(e) => setIt(i, { note: e.target.value })} /></td>
                      <td className={td}><Button size="sm" variant="secondary" onClick={() => delRow(i)} title="이 줄 삭제">삭제</Button></td>
                    </tr>
                  )) : <tr><td colSpan={11} className="px-4 py-3 text-[12px] text-ink3">줄이 없습니다 — [품목에서 고르기]로 넣거나, 목록에 없으면 [+ 직접 줄 추가]</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {newRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-[12px] text-ink2">
          <span className="flex-1">직접 쓴 줄 중 품목 목록에 없는 것이 <b>{newRows.length}개</b> 있습니다 ({newRows.map((it) => String(it.name).split('\n')[0]).slice(0, 4).join(', ')}{newRows.length > 4 ? ' …' : ''}). 줄마다 [+ 기준정보 추가]로 골라 넣거나, 한 번에 모두 넣을 수 있습니다.</span>
          <Button size="sm" variant="secondary" onClick={() => void regAll()}>모두 기준정보에 추가</Button>
        </div>
      )}

      <section className={card}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">표지 요약</h3><span className="text-[11.5px] text-ink3">표지 분류별 매출 · 매입 · 이익</span><span className="flex-1" /><b className="tabular-nums">합계 1+2+3 (VAT 별도) {w(T.rev)}원</b></div>
        <table className="w-full text-[12.5px]">
          <thead className="border-b border-border bg-panel-alt"><tr><th className="px-4 py-2 text-left text-[11.5px] font-bold text-ink3">분류</th>{['매출 (원)', '매입 (원)', '이익 (원)', '이익률'].map((h) => <th key={h} className="px-4 py-2 text-right text-[11.5px] font-bold text-ink3">{h}</th>)}</tr></thead>
          <tbody>
            {L.map((l) => <tr key={l.cat} className="border-b border-border"><td className="px-4 py-1.5">{l.cat}</td><td className="px-4 py-1.5 text-right tabular-nums">{w(l.rev)}</td><td className="px-4 py-1.5 text-right tabular-nums">{w(l.buy)}</td><td className="px-4 py-1.5 text-right tabular-nums">{w(l.rev - l.buy)}</td><td className="px-4 py-1.5 text-right tabular-nums">{pctText(l.rev ? (l.rev - l.buy) / l.rev : null)}</td></tr>)}
            <tr className="bg-panel-alt font-bold"><td className="px-4 py-1.5">합계</td><td className="px-4 py-1.5 text-right tabular-nums">{w(T.rev)}</td><td className="px-4 py-1.5 text-right tabular-nums">{w(T.buy)}</td><td className="px-4 py-1.5 text-right tabular-nums">{w(T.rev - T.buy)}</td><td className="px-4 py-1.5 text-right tabular-nums">{pctText(T.rev ? (T.rev - T.buy) / T.rev : null)}</td></tr>
          </tbody>
        </table>
      </section>

      {E.kind === '정부지원' && (
        <section className={card}>
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">사업비 현황</h3><span className="text-[11.5px] text-ink3">견적서 아래 표 · 재원 탭과 같은 계산</span></div>
          <div className="space-y-2.5 px-4 py-3">
            <div className="grid gap-2.5 sm:grid-cols-4">
              <Fld label="지원 기준" span="sm:col-span-2">{sel(E.f.rule, [['', '자동 (사업구분 · 연도)'], ...snap.fundRules.map((r) => [r.id, ruleText(r) + (r.conf ? '' : ' (확인 필요)')] as const)], (v) => setF('rule', v), '지원 기준')}</Fld>
              <Fld label="④ 인력 현물 (원)"><Num value={E.f.man} zero placeholder="예: 18,000,000" onChange={(v) => setF('man', v ?? 0)} /></Fld>
              <Fld label="⑥ 지방비 확정 (원, 비우면 지원 기준)"><Num value={E.f.local} onChange={(v) => setF('local', v)} /></Fld>
              <Fld label="⑤ 클라우드 월 단가 (원)"><Num value={E.f.cloudMonthly} zero placeholder="예: 150,000 / 350,000(NHN)" onChange={(v) => setF('cloudMonthly', v ?? 0)} /></Fld>
              <Fld label="⑤ 클라우드 개월 수"><input type="number" min={0} className={inp} value={E.f.cloudM} onChange={(e) => setF('cloudM', qNum(e.target.value))} /></Fld>
            </div>
            {!ov.solo && <div className="rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-[12px] text-ink2">이 사업에는 다른 정부지원 계약({oth.map((x) => x.name).join(', ')})이 있어 <b>이 견적 금액만</b>으로 계산합니다. 사업에 넣어 둔 확정 금액 · 계획서 금액은 쓰지 않고, 저장해도 사업 재원은 바뀌지 않습니다. 사업 전체 재원은 사업별 수익 › 재원 탭에서 봅니다.</div>}
            <table className="w-full text-[12.5px]">
              <thead className="border-b border-border bg-panel-alt"><tr><th className="px-3 py-2 text-left text-[11.5px] font-bold text-ink3">구분</th><th className="px-3 py-2 text-right text-[11.5px] font-bold text-ink3">금액 (원)</th><th className="px-3 py-2 text-left text-[11.5px] font-bold text-ink3">기준</th></tr></thead>
              <tbody>{R.map((r) => (
                <tr key={r.l} className={`border-b border-border last:border-b-0 ${r.b ? 'bg-panel-alt font-bold' : ''}`}>
                  <td className="px-3 py-1.5">{r.l}</td><td className="px-3 py-1.5 text-right tabular-nums">{r.v == null ? <Tag tone="warn">확인 필요</Tag> : w(r.v)}</td><td className="px-3 py-1.5 text-[11.5px] font-normal text-ink2">{r.n}</td>
                </tr>
              ))}</tbody>
            </table>
            {F.planTot ? (Math.abs(F.planTot - F.total) >= 1000
              ? <div className="text-[11.5px] font-bold text-amber">사업계획서 총괄 {w(F.planTot)}원과 {w(Math.abs(F.planTot - F.total))}원 다릅니다</div>
              : <div className="text-[11.5px] font-bold text-ok">✓ 사업계획서 총괄과 같음</div>) : null}
          </div>
        </section>
      )}

      <section className={card}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold">Remarks</h3><span className="text-[11.5px] text-ink3">한 줄에 하나 · 비우면 회사 기본 문구 (1) 시스템별 설치 후 세금계산서 발행함 …)</span></div>
        <div className="px-4 py-3"><textarea className={inp} rows={3} value={q.remarks} aria-label="Remarks" onChange={(e) => setQ('remarks', e.target.value)} /></div>
      </section>

      {pick && <QuotePickModal sec={pick} items={snap.items} onClose={() => setPick(null)}
        onPick={(lines, warn) => { upd((x) => ({ ...x, q: { ...x.q, items: [...x.q.items, ...lines] } })); setPick(null); say(`${lines.length}개 넣었습니다${warn ? ' — 매입단가가 없는 품목은 매입 0으로 들어갔으니 확인해 주세요' : ''}`); }} />}
    </div>
  );
}
