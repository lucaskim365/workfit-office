import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [no: string, wo: string, target: string, kit: string, kinds: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['IS-260611-21', 'WO-260611-021', 'M-Line 작업장1', '키트 A', '5종', '불출완료', true],
  ['IS-260611-22', 'WO-260611-022', 'M-Line 작업장2', '키트 B', '4종', '불출완료'],
  ['IS-260611-15', 'WO-260611-015', 'P-Line 작업장1', '키트 C', '6종', '준비중'],
];
const tone = (s: string): Tone => (s === '불출완료' ? 'ok' : 'warn');

/** 생산 불출 관리 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatIssuingScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="생산 불출 관리" sub="생산 불출 관리 (Kitting/Issuing)" actions={<ActionBar actions={['save', 'download']} />} />
      <MKpis items={[['금일 불출', '21', '건'], ['불출완료', '18', '건', 'teal'], ['키팅 대기', '3', '건'], ['불출 자재', '94', '종']]} />
      <Card title="라인 불출 / 키팅 현황" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">피킹 자재 → 생산 부서 소유권 전환</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['불출번호', '작업지시', '불출 대상', '키트', '자재 종수', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[6] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[6] ? C.teal : C.ink, borderLeft: r[6] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r[1]}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r[2]}</td>
                <td className={td('left')}><Pill tone="info">{r[3]}</Pill></td>
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
