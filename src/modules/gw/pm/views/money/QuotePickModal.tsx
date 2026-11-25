import { Fragment, useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { CI_KIND_NM, QT_SEC_NM, ciKind, ciMargin, ciUse, descHead, fmtW, fmtW0, pctText, type PmItem, type QtSec } from '@/domain/pm/money';
import { pickList, pickToLine, qNum, type PmQuoteItem } from '@/domain/pm/quote';
import { Tag } from '../wbs/parts';

/**
 * 견적 작성 › [품목에서 고르기] (데모 qPick 5023 · qPickList 5024 · qPickModal 5040 · qPickGo 5051) — 6-5.
 * 체크하고 수량을 넣은 뒤 [넣기] — 단가 · 매입단가 · 세부 사양이 그대로 들어가고, 넣은 뒤엔 이 견적에서만 고침 (목록 단가는 안 바뀜).
 * 종류를 바꾸거나 검색해도 체크한 것은 남음 (데모 qPickKeep).
 */
const th = 'px-2 py-1.5 text-left text-[11.5px] font-bold text-ink3 whitespace-nowrap';
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function QuotePickModal({ sec, items, onPick, onClose }: { sec: QtSec; items: readonly PmItem[]; onPick: (lines: PmQuoteItem[], warn: boolean) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [freq, setFreq] = useState(false);
  const [all, setAll] = useState(false);
  const [kind, setKind] = useState('');
  const [sel, setSel] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const P = pickList(items, { sec, q, all, freq, kind });
  const kinds = CI_KIND_NM.filter((k) => P.cnt[k]);
  const n = Object.keys(sel).length;
  const go = () => {
    const ids = Object.keys(sel);
    if (!ids.length) { setErr('넣을 품목을 체크해 주세요'); return; }
    const picked = ids.map((id) => items.find((x) => x.id === id)).filter((x): x is PmItem => !!x);
    onPick(picked.map((it) => pickToLine(it, all ? it.sec : sec, qNum(sel[it.id]) || 1)), picked.some((it) => !it.pass && it.cost == null));
  };
  const toggle = (id: string, on: boolean) => setSel((s) => { const x = { ...s }; if (on) x[id] = x[id] ?? '1'; else delete x[id]; return x; });

  let last = '';
  const table = !P.rows.length
    ? <p className="px-3 py-4 text-[12px] text-ink3">맞는 품목이 없습니다 — 기준정보 › 품목 · 단가에서 추가하거나, [+ 직접 줄 추가]로 직접 쓰세요.</p>
    : (
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 z-[1] border-b border-border bg-panel-alt"><tr><th className={`${th} w-[34px]`} /><th className={th}>품목</th><th className={`${th} w-[90px]`}>수량</th><th className={`${th} text-right`}>공급단가</th><th className={`${th} text-right`}>매입단가</th><th className={`${th} text-right`}>이익률</th><th className={th}>쓰인 견적</th></tr></thead>
        <tbody>
          {P.rows.map((it) => {
            const kd = ciKind(it);
            const u = ciUse(it);
            const head = kd !== last && !P.kind;
            last = kd;
            const on = it.id in sel;
            return (
              <Fragment key={it.id}>
                {head && <tr><td colSpan={7} className="bg-panel-alt px-3 py-1.5 text-[12.5px] font-bold">{kd} <span className="font-normal text-ink3">{P.cnt[kd]}</span></td></tr>}
                <tr className="border-b border-border">
                  <td className="px-2 py-1.5 align-top"><input type="checkbox" className="h-4 w-4" checked={on} aria-label={`${it.name} 고르기`} onChange={(e) => toggle(it.id, e.target.checked)} /></td>
                  <td className="px-2 py-1.5 align-top"><b>{it.name}</b>{u >= 2 && <> <Tag tone="run" title="여러 견적에 쓰인 품목">★자주</Tag></>}{it.vary && <> <Tag tone="warn">현장마다 다름</Tag></>}
                    <div className="text-[11px] text-ink3">{trunc(descHead(it.desc), 46)}</div></td>
                  <td className="px-2 py-1.5 align-top whitespace-nowrap"><input className="w-[56px] rounded border border-border bg-panel px-1.5 py-1 text-right text-[12px]" value={sel[it.id] ?? '1'} aria-label={`${it.name} 수량`}
                    onChange={(e) => { const v = e.target.value; setSel((s) => ({ ...s, [it.id]: v })); }} /> <span className="text-[11px] text-ink3">{it.unit}</span></td>
                  <td className="px-2 py-1.5 text-right align-top tabular-nums">{fmtW(it.price)}</td>
                  <td className="px-2 py-1.5 text-right align-top tabular-nums">{it.pass ? <span className="text-[11px] text-ink3">그대로</span> : it.cost != null ? fmtW0(it.cost) : <Tag tone="warn">확인 필요</Tag>}</td>
                  <td className="px-2 py-1.5 text-right align-top tabular-nums">{pctText(ciMargin(it))}</td>
                  <td className="px-2 py-1.5 align-top text-[11.5px]">{u > 1 ? <><b>{u}곳</b> <span className="text-ink3">{it.hist[0].src} 외</span></> : it.hist[0] ? it.hist[0].src : '-'}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    );
  const navBtn = (v: string, l: string, c: number) => (
    <button key={v || 'all'} type="button" onClick={() => setKind(v)}
      className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-[12px] font-bold ${P.kind === v ? 'border-teal bg-teal-soft text-teal' : 'border-border bg-panel text-ink2 hover:bg-panel-alt'}`}>
      <span>{l}</span><span className={P.kind === v ? '' : 'text-ink3'}>{c}</span>
    </button>
  );
  return (
    <Modal open onClose={onClose} width={1080} title={`품목에서 고르기 — ${QT_SEC_NM[sec]}`}
      footer={(
        <div className="flex w-full items-center gap-2">
          <span className="text-[11.5px] text-ink3">목록 관리: 기준정보 › 품목 · 단가</span>
          <span className="flex-1 text-right text-[12px] font-bold text-danger" role="alert">{err}</span>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={go}>{n ? `${n}개 넣기` : '넣기'}</Button>
        </div>
      )}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <input className="min-w-[240px] flex-1 rounded border border-border bg-panel px-2 py-1.5 text-[12.5px]" placeholder="품목 · 사양 검색" value={q} autoFocus onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1 whitespace-nowrap text-[12px]" title="여러 견적에 쓰인 품목만"><input type="checkbox" checked={freq} onChange={(e) => setFreq(e.target.checked)} /> 자주 쓰는 것만</label>
        <label className="flex items-center gap-1 whitespace-nowrap text-[12px]"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> 다른 구분도 보기</label>
      </div>
      <p className="mb-2 text-[11.5px] text-ink2">체크하고 수량을 넣은 뒤 [넣기] — 단가 · 매입단가 · 세부 사양이 그대로 들어가고, 넣은 뒤에도 이 견적에서만 고칠 수 있습니다 (목록 단가는 안 바뀜)</p>
      <div className="max-h-[52vh] overflow-auto">
        {kinds.length > 1
          ? <div className="grid grid-cols-[200px_1fr] items-start gap-3.5"><div className="sticky top-0 flex flex-col gap-1">{navBtn('', '전체', P.all)}{kinds.map((k) => navBtn(k, k, P.cnt[k]))}</div><div>{table}</div></div>
          : table}
      </div>
    </Modal>
  );
}
