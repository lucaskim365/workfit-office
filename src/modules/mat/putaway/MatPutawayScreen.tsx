import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, th, td } from '../_mat';

const ROWS: string[][] = [
  ['LOT-RAW-8821', 'WF-300-B', '입고장', 'A-1-2-1', 'Pallet', '대기'],
  ['LOT-RAW-8822', 'WF-300-B', '입고장', 'A-1-2-2', 'Pallet', '대기'],
  ['LOT-CHM-0457', 'CHM-SL-05', '입고장', 'A-3-1-4', 'Box', '완료'],
  ['LOT-PKG-3320', 'PKG-BGA-14', '입고장', 'C-2-1-1', 'Pallet', '진행'],
];
const tone = (s: string): Tone => (s === '완료' ? 'ok' : s === '진행' ? 'info' : 'mute');

/** 적치 지시/등록 (Put-away) — 와이어프레임 wms-screens.jsx 정본. */
export default function MatPutawayScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="적치 지시/등록" sub="적치 지시/등록 (Put-away)" actions={<ActionBar actions={['save']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card title="적치 지시 목록" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">최적 보관 위치 자동 추천</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['추적번호', '품목', '현재위치', '추천 적치위치', '단위', '상태'].map((c, i) => <th key={c} className={th(i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i} style={{ background: i === 0 ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: i === 0 ? C.teal : C.ink, borderLeft: i === 0 ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                  <td className={`${td('left')} font-mono text-[11px]`}>{r[1]}</td>
                  <td className={`${td('left')} text-ink3`}>{r[2]}</td>
                  <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[11px] font-bold" style={{ color: C.teal, background: C.tealSoft }}>{r[3]}</span></td>
                  <td className={td('left')}>{r[4]}</td>
                  <td className={td('center')}><Pill tone={tone(r[5])}>{r[5]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="스캔 적치">
          <div className="flex flex-col gap-3 rounded-xl p-4" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
            <div className="text-center">
              <div className="text-[10.5px] font-semibold text-ink3">적치 대상</div>
              <div className="mt-0.5 font-mono text-[15px] font-extrabold text-ink">LOT-RAW-8821</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-[9px] bg-panel px-3.5 py-3" style={{ border: `1px solid ${C.borderHi}` }}>
              <span className="text-[15px]">▦</span><span className="flex-1 text-[11.5px] text-ink3">① 자재 라벨 스캔</span><span className="font-extrabold" style={{ color: C.ok }}>✓</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-[9px] bg-panel px-3.5 py-3" style={{ border: `1.5px solid ${C.teal}` }}>
              <span className="text-[15px]" style={{ color: C.teal }}>▤</span><span className="flex-1 text-[11.5px] font-semibold text-ink">② 위치 라벨 스캔 (A-1-2-1)</span>
            </div>
            <div className="flex justify-end"><ActionButton icon="save" label="적치 확정" variant="primary" /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
