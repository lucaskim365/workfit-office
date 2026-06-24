import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, Bar, th, td } from '../_mat';
import { usePickingList } from '@/features/pickingList/usePickingList';

/** 피킹 지시/작업 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatPickingScreen() {
  const { data: rows = [], isLoading } = usePickingList();

  if (rows.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '피킹 리스트가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="피킹 지시/작업" sub="피킹 지시/작업 (Picking Management)" actions={<ActionBar actions={['save', 'download']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card title="피킹 리스트 (FIFO 지정)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">MR-260611-21 · 선입선출 최적 Lot</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['순번', '품목', '지정 Lot', '피킹 위치', '입고일', '수량', '룰'].map((c, i) => <th key={c} className={th(i === 5 ? 'right' : i === 0 || i === 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ background: i === 0 ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('center')} font-extrabold tabular-nums`} style={{ color: C.navy, borderLeft: i === 0 ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.seq}</td>
                  <td className={`${td('left')} font-mono text-[11px] font-semibold text-ink`}>{r.code}</td>
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: C.teal }}>{r.lot}</td>
                  <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] text-ink2" style={{ background: C.bgDeep }}>{r.loc}</span></td>
                  <td className={`${td('left')} tabular-nums text-ink3`}>{r.inDate}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty}</td>
                  <td className={td('center')}><Pill tone="info">{r.rule}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="피킹 진행">
          <div className="flex flex-col gap-3">
            <div className="rounded-[10px] py-3.5 text-center" style={{ background: C.panelAlt }}>
              <div className="text-[29px] font-extrabold" style={{ color: C.teal }}>1 / 3</div>
              <div className="text-[11px] font-semibold text-ink3">피킹 진행</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-[9px] bg-panel px-3.5 py-3" style={{ border: `1.5px solid ${C.teal}` }}>
              <span className="text-[15px]" style={{ color: C.teal }}>▦</span>
              <div className="flex-1">
                <div className="text-[11.5px] font-bold text-ink">A-1-1-1 · LOT-RAW-8810</div>
                <div className="text-[10px] text-ink3">WF-300-B · 2,500 EA 피킹</div>
              </div>
            </div>
            <Bar v={(1 / 3) * 100} />
            <div className="flex justify-end"><ActionButton icon="save" label="피킹 완료" variant="primary" /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
