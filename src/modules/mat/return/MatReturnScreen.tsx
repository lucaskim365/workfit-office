import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [no: string, code: string, name: string, type: string, target: string, qty: string, reason: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['RT-260611-01', 'CHM-GAS-02', '공정 가스', '협력사 반품', '대한가스', '15', '품질 불량', '처리완료', true],
  ['RT-260611-02', 'RES-PR-22', '포토레지스트', '창고 환수', '내부창고', '12', '잔여 자재', '진행중'],
  ['RT-260610-08', 'WF-200-A', '200mm 웨이퍼', '협력사 반품', '동진정밀', '50', '규격 불일치', '처리완료'],
];
const tone = (s: string): Tone => (s === '처리완료' ? 'ok' : 'warn');

/** 반품/환수 관리 — 와이어프레임 wms-screens.jsx 정본. */
export default function MatReturnScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="반품/환수 관리" sub="반품/환수 관리 (Return Management)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['반품/환수', '8', '건'], ['협력사 반품', '5', '건'], ['창고 환수', '3', '건'], ['처리완료', '6', '건', 'teal']]} />
      <Card title="반품 · 환수 내역" bodyClassName="p-0">
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['반품번호', '품목', '유형', '대상', '수량', '사유', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[8] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[8] ? C.teal : C.ink, borderLeft: r[8] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r[1]}</span> <span className="text-[10.5px] text-ink3">{r[2]}</span></td>
                <td className={td('left')}><Pill tone={r[3] === '협력사 반품' ? 'warn' : 'info'}>{r[3]}</Pill></td>
                <td className={td('left')}>{r[4]}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[5]}</td>
                <td className={td('left')}>{r[6]}</td>
                <td className={td('center')}><Pill tone={tone(r[7])}>{r[7]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
