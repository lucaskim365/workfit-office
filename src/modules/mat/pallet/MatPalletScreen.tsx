import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [id: string, type: string, item: string, lot: string, loc: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['PLT-0012', 'Pallet', 'WF-300-B', 'LOT-RAW-8821', 'A-1-2-1', '사용중', true],
  ['PLT-0013', 'Pallet', 'WF-300-B', 'LOT-RAW-8822', 'A-1-2-2', '사용중'],
  ['CRT-0044', '대차', 'CHM-SL-05', 'LOT-CHM-0457', 'C-라인대기', '사용중'],
  ['MAG-0102', '매거진', '—', '—', '대차장', '공용기'],
  ['PLT-0009', 'Pallet', '—', '—', '대차장', '공용기'],
];
const tone = (s: string): Tone => (s === '사용중' ? 'info' : 'mute');

/** 대차/파레트 관리 — 와이어프레임 wms-screens-3.jsx 정본. */
export default function MatPalletScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="대차/파레트 관리" sub="대차/파레트 관리 (Pallet/Container)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['총 용기', '320', '개'], ['사용중', '214', '개'], ['공용기', '98', '개', 'teal'], ['점검 필요', '8', '개']]} />
      <Card title="이동 용기 추적" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">용기-자재 매핑 현황</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['용기번호', '용기 유형', '적재 품목', '적재 Lot', '현재 위치', '상태'].map((c, i) => <th key={c} className={th(i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[6] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[6] ? C.teal : C.ink, borderLeft: r[6] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={td('left')}><Pill tone="mute">{r[1]}</Pill></td>
                <td className={`${td('left')} font-semibold ${r[2] === '—' ? 'text-ink3' : 'font-mono text-[11px] text-ink'}`}>{r[2]}</td>
                <td className={`${td('left')} ${r[3] === '—' ? 'text-ink3' : 'font-mono text-[11px]'}`}>{r[3]}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] text-ink2" style={{ background: C.bgDeep }}>{r[4]}</span></td>
                <td className={td('center')}><Pill tone={tone(r[5])}>{r[5]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
