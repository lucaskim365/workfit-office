import { useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { monthDay } from '@/domain/pm/rules';
import {
  CI_KIND_NM, PL_CATS, QT_SECS, QT_SEC_NM, ciKind, ciMargin, ciRange, descHead, fmtW, fmtW0, itemCheck, itemDraft, itemFromDraft, itemList, pctText,
  type ItemDraft, type ItemFilter, type PmItem, type QtSec,
} from '@/domain/pm/money';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { PARTIAL_LOCK_MSG, usePmPartialLock } from '@/features/pm/pmSaveBus';

/**
 * 기준정보 › 품목 · 단가 (money/items, 데모 pMoneyItems 4980 · ciList 4992 · ciForm 5009) — 6-4.
 * 견적에 넣는 장비 · 소프트웨어 목록. 기본 단가 = 가장 최근 견적 단가, 지난 견적 단가는 기록으로. 견적 작성의 [품목에서 고르기]는 6-5.
 * 금액 화면이라 pm.manage 만 (메뉴 · 주소 모두 PmScreen 이 막음).
 */
const card = 'rounded-xl border border-border bg-panel shadow-sm';
const th = 'px-3 py-2 text-left text-[11.5px] font-bold text-ink3 whitespace-nowrap';
const td = 'px-3 py-2 align-top text-[12px]';
const sel = 'rounded border border-border bg-panel px-2 py-1 text-[12px]';
const inp = 'w-full rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function F({ label, req, full, bad, children }: { label: string; req?: boolean; full?: boolean; bad?: boolean; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${full ? 'sm:col-span-2' : ''}`}>
      <span>{label}{req && <span className="text-danger"> *</span>}</span>
      <div className={bad ? 'rounded ring-2 ring-danger' : ''}>{children}</div>
    </label>
  );
}
const Cost = ({ it }: { it: PmItem }) => (it.pass ? <span className="text-[11px] text-ink3">그대로</span> : it.cost != null ? <>{fmtW0(it.cost)}</> : <Tag tone="warn">확인 필요</Tag>);

export function ItemsView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const [f, setF] = useState<ItemFilter>({ sec: '', kind: '', cat: '', q: '' });
  const [edit, setEdit] = useState<PmItem | 'new' | null>(null);
  const [msg, setMsg] = useState('');
  if (!d) return <EmptyHint title="품목을 불러오는 중입니다" />;
  const all = d.snap.items;
  const L = itemList(all, f);
  const set = <K extends keyof ItemFilter>(k: K, v: ItemFilter[K]) => setF((o) => ({ ...o, [k]: v }));

  return (
    <div className="space-y-3">
      <ScreenHead title="품목 · 단가" desc="견적에 넣는 장비 · 소프트웨어 목록입니다. 한 번 등록해 두면 견적 작성에서 [품목에서 고르기]로 넣을 수 있습니다. 기본 단가는 가장 최근 견적 단가이고, 지난 견적 단가는 기록으로 남습니다.">
        <Button onClick={() => setEdit('new')}>+ 품목 추가</Button>
      </ScreenHead>
      {msg && <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">{msg}</div>}
      <section className={card}>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
          <select className={sel} value={f.sec} onChange={(e) => set('sec', e.target.value as ItemFilter['sec'])} aria-label="구분"><option value="">모든 구분</option>{QT_SECS.map((k) => <option key={k} value={k}>{QT_SEC_NM[k]}</option>)}</select>
          <select className={sel} value={f.kind} onChange={(e) => set('kind', e.target.value)} aria-label="종류"><option value="">모든 종류</option>{CI_KIND_NM.map((k) => <option key={k}>{k}</option>)}</select>
          <select className={sel} value={f.cat} onChange={(e) => set('cat', e.target.value)} aria-label="표지 분류"><option value="">모든 표지 분류</option>{PL_CATS.map((c) => <option key={c}>{c}</option>)}</select>
          <input className={`${sel} w-[260px]`} placeholder="품목 · 사양 · 견적 이름 검색" value={f.q} onChange={(e) => set('q', e.target.value)} />
          <span className="flex-1" />
          <span className="text-[11px] text-ink3">{L.length}개 / 전체 {all.length}개</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>품목</th><th className={th}>세부 사양</th><th className={th}>단위</th><th className={`${th} text-right`}>공급단가</th><th className={`${th} text-right`}>매입단가</th><th className={`${th} text-right`}>이익률</th><th className={th}>지난 견적</th></tr></thead>
            <tbody>
              {L.length ? L.map((it) => {
                const h = it.hist;
                const rg = ciRange(it);
                return (
                  <tr key={it.id} onClick={() => setEdit(it)} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-panel-alt">
                    <td className={td}><b>{it.name}</b>{it.vary && <> <Tag tone="warn" title="현장마다 범위가 달라 금액이 크게 다름 — 고른 뒤 금액 확인">현장마다 다름</Tag></>}
                      <div className="text-[11px] text-ink3">{QT_SEC_NM[it.sec]} · {ciKind(it)}{it.grp ? ` · ${trunc(it.grp, 24)}` : ''}</div></td>
                    <td className={`${td} max-w-[280px] text-[11.5px] text-ink2`}>{trunc(descHead(it.desc), 60)}</td>
                    <td className={`${td} text-[11.5px]`}>{it.unit}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtW(it.price)}</td>
                    <td className={`${td} text-right tabular-nums`}><Cost it={it} /></td>
                    <td className={`${td} text-right tabular-nums`}>{pctText(ciMargin(it))}</td>
                    <td className={`${td} text-[11.5px]`}>{h.length ? <>{h[0].src} {h[0].date ? monthDay(h[0].date) : ''}{h.length > 1 && <span className="text-ink3"> 외 {h.length - 1}건</span>}{rg && <div className="text-ink3">{rg}</div>}</> : <span className="text-ink3">-</span>}</td>
                  </tr>
                );
              }) : <tr><td colSpan={7}><EmptyHint title="조건에 맞는 품목이 없습니다" /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {edit && <ItemModal it={edit === 'new' ? null : edit} onClose={() => setEdit(null)}
        onSave={async (x) => { await mut.saveItem.mutateAsync(x); setMsg(edit === 'new' ? `품목 추가 — ${x.name}` : `품목 수정 — ${x.name}`); setEdit(null); }}
        onRemove={async (x) => { await mut.removeItem.mutateAsync(x.id); setMsg(`품목 삭제 — ${x.name}`); setEdit(null); }} />}
    </div>
  );
}

/** 품목 추가 · 수정 창 (ciForm) — 금액은 원, 지난 견적 표 */
function ItemModal({ it, onSave, onRemove, onClose }: { it: PmItem | null; onSave: (x: PmItem) => Promise<void>; onRemove: (x: PmItem) => Promise<void>; onClose: () => void }) {
  const isNew = !it;
  const lock = usePmPartialLock() && isNew;
  const [v, setV] = useState<ItemDraft>(() => itemDraft(it));
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof ItemDraft>(k: K, x: ItemDraft[K]) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    const e = itemCheck(v);
    if (e) { setErr(e); return; }
    setErr(null);
    try { await onSave(itemFromDraft(v, it, it?.id ?? '')); } catch (x) { setErr([(x as Error).message || '저장하지 못했습니다', '']); }
  };
  const del = async () => {
    if (!it || !confirm(`'${it.name}' 품목을 목록에서 지울까요? 이미 만든 견적은 그대로입니다.`)) return;
    try { await onRemove(it); } catch (x) { setErr([(x as Error).message || '지우지 못했습니다', '']); }
  };
  const bad = (f: string) => err?.[1] === f;
  const h = it?.hist ?? [];
  return (
    <Modal open onClose={onClose} width={760} title={isNew ? '품목 추가' : '품목 수정'}
      footer={(
        <div className="flex w-full items-center gap-2">
          {!isNew && <Button variant="secondary" onClick={() => void del()}>삭제</Button>}
          <span className="flex-1 text-right text-[12px] font-bold text-danger" role="alert">{lock ? PARTIAL_LOCK_MSG : err?.[0] ?? ''}</span>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button disabled={lock} onClick={() => void save()}>저장</Button>
        </div>
      )}>
      <p className="mb-2 text-[12px] text-ink2">{isNew
        ? <>견적에 자주 넣는 장비 · 소프트웨어를 등록합니다. 금액은 <b>원</b> 단위(VAT 별도). 매입단가를 모르면 비워 두면 '확인 필요'로 보입니다.</>
        : '여기서 고친 단가는 앞으로 고르는 견적의 기본값이 됩니다. 이미 만든 견적은 바뀌지 않습니다.'}</p>
      {h.length > 0 && (
        <table className="mb-3 w-full text-[11.5px]">
          <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>지난 견적</th><th className={th}>날짜</th><th className={`${th} text-right`}>수량</th><th className={`${th} text-right`}>공급단가</th><th className={`${th} text-right`}>매입단가</th></tr></thead>
          <tbody>{h.map((x, i) => (
            <tr key={i} className="border-b border-border last:border-b-0"><td className="px-3 py-1">{x.src}</td><td className="px-3 py-1 tabular-nums">{x.date}</td><td className="px-3 py-1 text-right tabular-nums">{x.qty || ''}</td><td className="px-3 py-1 text-right tabular-nums">{fmtW(x.price)}</td><td className="px-3 py-1 text-right tabular-nums">{x.cost == null ? <span className="text-ink3">-</span> : fmtW0(x.cost)}</td></tr>
          ))}</tbody>
        </table>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="품목 이름" req full bad={bad('name')}><input className={inp} value={v.name} placeholder="예: 키오스크 Panel PC" onChange={(e) => set('name', e.target.value)} /></F>
        <F label="구분"><select className={inp} value={v.sec} onChange={(e) => set('sec', e.target.value as QtSec)}>{QT_SECS.map((k) => <option key={k} value={k}>{QT_SEC_NM[k]}</option>)}</select></F>
        <F label="종류 (고르기 창에서 묶는 단위)"><select className={inp} value={v.kind} onChange={(e) => set('kind', e.target.value)}>{CI_KIND_NM.map((k) => <option key={k}>{k}</option>)}</select></F>
        <F label="표지 분류 (견적서 표지 칸)"><select className={inp} value={v.cat} onChange={(e) => set('cat', e.target.value)}>{PL_CATS.map((c) => <option key={c}>{c}</option>)}</select></F>
        <F label="단위"><input className={inp} value={v.unit} placeholder="set / EA / 식 / m" onChange={(e) => set('unit', e.target.value)} /></F>
        <F label="공급단가 (원)" req bad={bad('price')}><input type="number" min={0} className={inp} value={v.price} onChange={(e) => set('price', e.target.value)} /></F>
        <F label="매입단가 (원, 협력사 견적)" bad={bad('cost')}><input type="number" min={0} className={inp} value={v.cost} onChange={(e) => set('cost', e.target.value)} /></F>
        <F label="협력사"><input className={inp} value={v.vendor} placeholder="예: ㈜루시안" onChange={(e) => set('vendor', e.target.value)} /></F>
        <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={v.pass} onChange={(e) => set('pass', e.target.checked)} />기타비용처럼 받은 금액 그대로 냄 (매입 = 공급금액)</label>
        <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={v.vary} onChange={(e) => set('vary', e.target.checked)} />현장마다 금액이 크게 다름 (네트워크 공사 등)</label>
        <F label="세부 사양 (견적서 세부 내역에 그대로 들어감)" full><textarea className={`${inp} min-h-[90px]`} value={v.desc} onChange={(e) => set('desc', e.target.value)} /></F>
        <F label="비고" full><input className={inp} value={v.note} onChange={(e) => set('note', e.target.value)} /></F>
      </div>
    </Modal>
  );
}
