import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, th, td } from '../_mat';
import { useLabelTasks } from '@/features/labelTask/useLabelTasks';

const BARS = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 3, 2, 1];

/** 입고 라벨 발행 — 와이어프레임 wms-screens.jsx 정본. */
export default function MatLabelScreen() {
  const { data: rows = [], isLoading } = useLabelTasks();
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="입고 라벨 발행" sub="입고 라벨 발행 (Barcode/RFID Print)" actions={<ActionBar actions={['save']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="라벨 발행 대상" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">입고 자재 단위(Box·Pallet)</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['추적번호(Lot)', '품목', '단위', '수량', '라벨', '상태'].map((c, i) => <th key={c} className={th(i === 3 ? 'right' : i >= 4 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-[12px] text-ink3">{isLoading ? '불러오는 중…' : '라벨 발행 대상이 없습니다.'}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.lot} style={{ background: i === 0 ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: i === 0 ? C.teal : C.ink, borderLeft: i === 0 ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.lot}</td>
                  <td className={`${td('left')} font-mono text-[11px]`}>{r.code}</td>
                  <td className={td('left')}>{r.unit}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty}</td>
                  <td className={td('center')}><Pill tone={r.labelType === 'RFID' ? 'info' : 'mute'}>{r.labelType}</Pill></td>
                  <td className={td('center')}><Pill tone={r.status === '발행완료' ? 'ok' : 'warn'}>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="라벨 미리보기">
          <div className="rounded-lg bg-panel p-4" style={{ border: `1.5px solid ${C.ink}` }}>
            <div className="flex items-start justify-between pb-2" style={{ borderBottom: `2px solid ${C.ink}` }}>
              <div><div className="text-[9px] font-bold text-ink3">MATERIAL LOT</div><div className="font-mono text-[14px] font-extrabold text-ink">LOT-RAW-8821</div></div>
              <div className="grid h-11 w-11 place-items-center text-[8px] font-bold text-ink3" style={{ border: `1px solid ${C.ink}` }}>QR</div>
            </div>
            <div className="flex flex-col gap-1.5 py-2.5">
              {[['품목', 'WF-300-B'], ['단위', 'Pallet · 500 EA'], ['입고일', '2026-06-11'], ['협력사', '대성반도체']].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[11px]"><span className="text-ink3">{k}</span><span className="font-bold text-ink">{v}</span></div>
              ))}
            </div>
            <div className="flex h-[38px] gap-px pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
              {BARS.map((w, i) => <span key={i} style={{ width: w, background: i % 2 ? 'transparent' : C.ink }} />)}
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2"><ActionButton icon="refresh" label="재발행" /><ActionButton icon="download" label="라벨 출력" variant="primary" /></div>
        </Card>
      </div>
    </div>
  );
}
