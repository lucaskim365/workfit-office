import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [no: string, code: string, from: string, to: string, qty: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['TR-260611-05', 'WF-300-B', 'A-1-2-1', 'C-라인대기', '500', '진행', true],
  ['TR-260611-04', 'CHM-SL-05', 'A-3-1-4', 'C-라인대기', '20', '완료'],
  ['TR-260611-03', 'PKG-BGA-14', 'C-2-1-1', 'D-출하대기', '300', '완료'],
  ['TR-260611-02', 'RES-PR-22', 'A-3-2-1', 'C-라인대기', '10', '취소'],
];
const tone = (s: string): Tone => (s === '완료' ? 'ok' : s === '진행' ? 'info' : 'mute');

/** 창고 간 이송 등록 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatTransferScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="창고 간 이송 등록" sub="창고 간 이송 등록 (Location Transfer)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['금일 이송', '18', '건'], ['진행중', '4', '건'], ['완료', '13', '건', 'teal'], ['이송 수량', '2,840', 'EA']]} />
      <Card title="내부 위치 이송 이력" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">실시간 위치 변경 반영</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['이송번호', '품목', '출발 위치', '도착 위치', '수량', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[6] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[6] ? C.teal : C.ink, borderLeft: r[6] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[11px] font-semibold text-ink`}>{r[1]}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] text-ink2" style={{ background: C.bgDeep }}>{r[2]}</span></td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] font-bold" style={{ color: C.teal, background: C.tealSoft }}>{r[3]}</span></td>
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
