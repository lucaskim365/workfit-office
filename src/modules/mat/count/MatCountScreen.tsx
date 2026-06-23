import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, FInput, th, td } from '../_mat';

const ROWS: string[][] = [
  ['WF-300-B', 'A-1-1-1', '8,420', '8,420', '0', '일치'],
  ['WF-200-A', 'A-1-2-1', '3,100', '3,085', '-15', '차이'],
  ['CHM-SL-05', 'A-3-1-4', '142', '142', '0', '일치'],
  ['RES-PR-22', 'A-3-2-2', '38', '40', '+2', '차이'],
  ['PKG-BGA-14', 'C-2-1-1', '5,200', '미실사', '—', '대기'],
];
const tone = (s: string): Tone => (s === '일치' ? 'ok' : s === '차이' ? 'warn' : 'mute');
const diffColor = (d: string) => (d === '0' ? C.ink3 : d === '—' ? C.ink3 : d[0] === '-' ? C.err : C.warn);

/** 재고 실사 계획/등록 — 와이어프레임 wms-screens-3.jsx 정본. */
export default function MatCountScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="재고 실사 계획/등록" sub="재고 실사 계획/등록 (Physical Counting)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <FBar>
        <FField label="실사번호"><FInput ph="PC-260611-01" w={150} /></FField>
        <FField label="구역"><FSel value="A-Zone" w={110} /></FField>
        <FField label="유형"><FSel value="정기 실사" w={110} /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="refresh" label="전산재고 홀딩" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['실사 대상', '86', '품목'], ['실사 완료', '72', '품목', 'teal'], ['차이 발생', '8', '품목'], ['미실사', '14', '품목']]} />
      <Card title="실사 등록 (PDA 스캔 입력)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">전산 vs 실물 대조</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['품목', '위치', '전산재고', '실사수량', '차이', '상태'].map((c, i) => <th key={c} className={th(i >= 2 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] text-ink2" style={{ background: C.bgDeep }}>{r[1]}</span></td>
                <td className={`${td('right')} tabular-nums`}>{r[2]}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[3]}</td>
                <td className={`${td('right')} font-extrabold tabular-nums`} style={{ color: diffColor(r[4]) }}>{r[4]}</td>
                <td className={td('center')}><Pill tone={tone(r[5])}>{r[5]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
