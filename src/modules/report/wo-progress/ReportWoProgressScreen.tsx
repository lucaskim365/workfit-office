import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { C, RHead, RParam, MKpis, ProgBar, FField, FSel } from '../_report';

const AL: Record<string, string> = { right: 'text-right', center: 'text-center', left: 'text-left' };
const th = (al: string) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: string) => `whitespace-nowrap border-b border-border px-3 py-2.5 ${AL[al]}`;

type Row = [wo: string, prod: string, line: string, qty: number, done: number, status: string];
const rows: Row[] = [
  ['WO-260621-021', 'MX-200', 'M-Line 1', 4800, 3120, '진행'],
  ['WO-260621-024', 'MX-310', 'M-Line 2', 3600, 3600, '완료'],
  ['WO-260621-018', 'PKG-BGA', 'A-Line', 6000, 5400, '진행'],
  ['WO-260621-030', 'MX-200', 'M-Line 1', 4800, 480, '지연'],
  ['WO-260620-119', 'PKG-BGA', 'A-Line', 6000, 6000, '완료'],
];
const tone = (s: string): Tone => (s === '완료' ? 'ok' : s === '지연' ? 'err' : 'info');

/** 작업지시 진척 현황 — 와이어프레임 report-prod.jsx 정본. */
export default function ReportWoProgressScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="작업지시 진척 현황" sub="생산 리포트 / 작업지시 진척 (WO Progress)" type="R3" />
      <RParam period="실시간"><FField label="상태"><FSel /></FField><FField label="라인"><FSel /></FField></RParam>
      <MKpis items={[['진행 중 WO', '18', '건'], ['완료', '42', '건', 'teal'], ['지연', '3', '건'], ['평균 진척률', '74.5', '%']]} />
      <Card title="작업지시별 진척률" bodyClassName="p-0">
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['작업지시', '제품', '라인', '지시량', '진척', '진척률', '상태'].map((c, i) => <th key={c} className={th(i === 3 ? 'right' : i >= 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = Math.round((r[4] / r[3]) * 100);
              return (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                  <td className={`${td('left')} font-mono text-[11px] text-ink2`}>{r[1]}</td>
                  <td className={`${td('left')} text-ink2`}>{r[2]}</td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r[3].toLocaleString()}</td>
                  <td className={td('left')} style={{ width: 130 }}><ProgBar v={pct} color={r[5] === '지연' ? C.err : r[5] === '완료' ? C.ok : C.teal} /></td>
                  <td className={`${td('center')} font-bold tabular-nums text-ink`}>{pct}%</td>
                  <td className={td('center')}><Pill tone={tone(r[5])} solid={r[5] === '지연'}>{r[5]}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
