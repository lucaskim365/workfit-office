import { Card } from '@/shared/ui/Card';
import { C, RHead, RParam, MKpis, FField, FSel } from '../_report';
import { getExecDashboardData } from '@/modules/exec/mock';

const AL: Record<string, string> = { right: 'text-right', center: 'text-center', left: 'text-left' };
const th = (al: string) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: string) => `whitespace-nowrap border-b border-border px-3 py-2.5 ${AL[al]}`;

const gBg = (g: string) => (g === 'A' ? C.tealSoft : g === 'B' ? C.blueSoft : C.bgDeep);
const gFg = (g: string) => (g === 'A' ? C.teal : g === 'B' ? C.blue : C.warn);

/**
 * 부서/라인 스코어카드 — 와이어프레임 report-exec.jsx 정본.
 * 데이터는 경영 대시보드와 동일한 단일 소스(getExecDashboardData). 계획서 P4.
 */
export default function ReportScorecardScreen() {
  const d = getExecDashboardData();
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="부서/라인 스코어카드" sub="경영 대시보드 / 부서·라인 스코어카드" type="R3" />
      <RParam period={d.period}><FField label="조직"><FSel value="전체" w={80} /></FField></RParam>
      <MKpis items={d.scorecardKpis} />
      <Card title="조직 단위 종합 성과 (목표 대비 달성률)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">가중: 생산40·품질30·설비20·납기10</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['조직', '생산', '품질', '설비(OEE)', '납기', '종합점수', '등급'].map((c, i) => <th key={c} className={th(i >= 1 && i <= 5 ? 'right' : i === 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {d.scorecardRows.map((r, i) => (
              <tr key={r.org} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                <td className={`${td('left')} font-bold text-ink`}>{r.org}</td>
                {[r.prod, r.qual, r.oee, r.due].map((v, k) => <td key={k} className={`${td('right')} tabular-nums text-ink2`}>{v}</td>)}
                <td className={`${td('right')} font-extrabold tabular-nums text-ink`}>{r.score}</td>
                <td className={td('center')}><span className="inline-grid h-6 w-6 place-items-center rounded-[7px] text-[11px] font-extrabold" style={{ background: gBg(r.grade), color: gFg(r.grade) }}>{r.grade}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
