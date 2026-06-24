import { Card } from '@/shared/ui/Card';
import { C, RHead, RParam, MKpis, FField, FSel } from '../_report';

const AL: Record<string, string> = { right: 'text-right', center: 'text-center', left: 'text-left' };
const th = (al: string) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: string) => `whitespace-nowrap border-b border-border px-3 py-2.5 ${AL[al]}`;

type Row = [org: string, prod: number, qual: number, oee: number, due: number, score: string, grade: string];
const rows: Row[] = [
  ['M-Line 1', 98, 97, 88, 99, '95.5', 'A'],
  ['M-Line 2', 96, 96, 85, 98, '93.8', 'A'],
  ['A-Line', 96, 95, 84, 97, '93.0', 'B'],
  ['가공팀', 97, 98, 90, 96, '95.3', 'A'],
  ['조립팀', 95, 94, 82, 95, '91.5', 'B'],
];
const gBg = (g: string) => (g === 'A' ? C.tealSoft : g === 'B' ? C.blueSoft : C.bgDeep);
const gFg = (g: string) => (g === 'A' ? C.teal : g === 'B' ? C.blue : C.warn);

/** 부서/라인 스코어카드 — 와이어프레임 report-exec.jsx 정본. */
export default function ReportScorecardScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="부서/라인 스코어카드" sub="경영 대시보드 / 부서·라인 스코어카드" type="R3" />
      <RParam period="2026-06 (월간)"><FField label="조직"><FSel value="전체" w={80} /></FField></RParam>
      <MKpis items={[['평가 조직', '12', '개'], ['A 등급', '7', '개', 'teal'], ['목표 달성', '83', '%'], ['전월비', '+1.8', '%p']]} />
      <Card title="조직 단위 종합 성과 (목표 대비 달성률)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">가중: 생산40·품질30·설비20·납기10</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['조직', '생산', '품질', '설비(OEE)', '납기', '종합점수', '등급'].map((c, i) => <th key={c} className={th(i >= 1 && i <= 5 ? 'right' : i === 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                <td className={`${td('left')} font-bold text-ink`}>{r[0]}</td>
                {[1, 2, 3, 4].map((k) => <td key={k} className={`${td('right')} tabular-nums text-ink2`}>{r[k]}</td>)}
                <td className={`${td('right')} font-extrabold tabular-nums text-ink`}>{r[5]}</td>
                <td className={td('center')}><span className="inline-grid h-6 w-6 place-items-center rounded-[7px] text-[11px] font-extrabold" style={{ background: gBg(r[6]), color: gFg(r[6]) }}>{r[6]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
