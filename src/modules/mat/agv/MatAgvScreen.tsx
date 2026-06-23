import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, th, td } from '../_mat';

const ROBOTS = [
  { id: 'AGV-01', task: 'A-1-2-1 → C-라인대기', bat: 86, st: '이동중' },
  { id: 'AGV-02', task: '입고장 → A-3-1-4', bat: 64, st: '이동중' },
  { id: 'AMR-03', task: '대기', bat: 42, st: '대기' },
  { id: 'AGV-04', task: '충전중', bat: 18, st: '충전' },
];
const stTone = (s: string): Tone => (s === '이동중' ? 'ok' : s === '충전' ? 'warn' : 'mute');
const dotC = (s: string) => (s === '이동중' ? C.ok : s === '충전' ? C.warn : C.ink3);

type Row = [no: string, robot: string, from: string, to: string, time: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['MV-260611-44', 'AGV-01', 'A-1-2-1', 'C-라인대기', '14:25', '이동중', true],
  ['MV-260611-43', 'AGV-02', '입고장', 'A-3-1-4', '14:22', '이동중'],
  ['MV-260611-42', 'AMR-03', 'C-2-1-1', 'D-출하대기', '14:10', '완료'],
  ['MV-260611-41', 'AGV-01', '입고장', 'A-1-2-1', '13:55', '완료'],
];
const tone = (s: string): Tone => (s === '완료' ? 'ok' : 'info');

/** AGV/AMR 연동 관리 — 와이어프레임 wms-screens-3.jsx 정본. */
export default function MatAgvScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="AGV/AMR 연동 관리" sub="AGV/AMR 연동 관리 (Mobile Robot)" actions={<ActionBar actions={['refresh', 'download']} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ROBOTS.map((r) => (
          <Card key={r.id}>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: dotC(r.st) }} /><span className="font-mono text-[12.5px] font-extrabold text-ink">{r.id}</span></span>
              <Pill tone={stTone(r.st)}>{r.st}</Pill>
            </div>
            <div className="mb-2 min-h-[30px] text-[10.5px] font-semibold text-ink2">{r.task}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-ink3">배터리</span>
              <div className="h-1.5 flex-1 rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: `${r.bat}%`, background: r.bat <= 20 ? C.err : r.bat <= 50 ? C.warn : C.teal }} /></div>
              <span className="text-[10.5px] font-bold tabular-nums text-ink2">{r.bat}%</span>
            </div>
          </Card>
        ))}
      </div>
      <Card title="물류 이동 명령 이력" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">출발지-목적지 명령 하향 전송</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['이동번호', '로봇', '출발지', '목적지', '지시시각', '상태'].map((c, i) => <th key={c} className={th(i === 4 || i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[6] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[6] ? C.teal : C.ink, borderLeft: r[6] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[1]}</td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] text-ink2" style={{ background: C.bgDeep }}>{r[2]}</span></td>
                <td className={td('left')}><span className="rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] font-bold" style={{ color: C.teal, background: C.tealSoft }}>{r[3]}</span></td>
                <td className={`${td('center')} tabular-nums text-ink3`}>{r[4]}</td>
                <td className={td('center')}><Pill tone={tone(r[5])}>{r[5]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
