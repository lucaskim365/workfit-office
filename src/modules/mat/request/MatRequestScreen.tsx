import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [no: string, wo: string, code: string, line: string, qty: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['MR-260611-21', 'WO-260611-021', 'WF-300-B', 'M-Line', '2,500', '승인', true],
  ['MR-260611-22', 'WO-260611-021', 'CHM-SL-05', 'M-Line', '40', '승인'],
  ['MR-260611-18', 'WO-260611-018', 'WF-200-A', 'M-Line', '3,200', '대기'],
  ['MR-260611-15', 'WO-260611-015', 'PKG-BGA-14', 'P-Line', '2,500', '대기'],
];
const tone = (s: string): Tone => (s === '승인' ? 'ok' : 'mute');

/** 자재 청구/요청 관리 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatRequestScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="자재 청구/요청 관리" sub="자재 청구/요청 관리 (Material Request)" actions={<ActionBar actions={['save', 'download']} />} />
      <MKpis items={[['금일 청구', '24', '건'], ['승인', '18', '건', 'teal'], ['대기', '6', '건'], ['청구 품목', '32', '종']]} />
      <Card title="작업지시 기준 자재 청구 (BOM 소요량)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">현장 라인 → 창고 요청</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['청구번호', '작업지시', '품목', '요청 라인', '소요량', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[6] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[6] ? C.teal : C.ink, borderLeft: r[6] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r[1]}</td>
                <td className={`${td('left')} font-mono text-[11px] font-semibold text-ink`}>{r[2]}</td>
                <td className={td('left')}>{r[3]}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[4]}</td>
                <td className={td('center')}><Pill tone={tone(r[5])}>{r[5]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
