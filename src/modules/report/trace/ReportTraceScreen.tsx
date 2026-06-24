import { Card } from '@/shared/ui/Card';
import { ActionButton } from '@/shared/ui/ActionBar';
import { C, RHead, RParam, RTraceTree, FField, FSel, type TraceNode } from '../_report';

const root: TraceNode = {
  label: 'LOT-OUT-2206-031', sub: 'MX-200 · 출하 600EA', tone: 'out', tag: '출하',
  children: [
    { label: 'WO-260619-088', sub: '조립 공정', tone: 'wip', tag: '작업지시', children: [
      { label: 'LOT-RAW-8821', sub: 'WF-300-B · 웨이퍼', tone: 'in', tag: '투입자재' },
      { label: 'LOT-PKG-3320', sub: 'PKG-BGA-14 · 기판', tone: 'in', tag: '투입자재' },
      { label: 'LOT-RES-1120', sub: 'RES-PR-22 · 레지스트', tone: 'def', tag: '불량혼입 의심' },
    ] },
    { label: 'WO-260618-072', sub: '가공 공정', tone: 'wip', tag: '작업지시', children: [
      { label: 'LOT-CHM-0457', sub: 'CHM-SL-05 · 슬러리', tone: 'in', tag: '투입자재' },
    ] },
  ],
};
const legend: [string, string][] = [['출하', C.teal], ['작업지시', C.warn], ['투입자재', C.blue], ['불량 의심', C.err]];
const summary: [string, string][] = [['연결 작업지시', '2건'], ['투입 자재 Lot', '4종'], ['관련 설비', 'ETCH-01, BOND-05'], ['불량 의심 Lot', 'LOT-RES-1120'], ['영향 출하 로트', '1건 (600EA)']];

/** 로트 추적 계보 — 와이어프레임 report-trace.jsx 정본. */
export default function ReportTraceScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="로트 추적 계보" sub="추적·규제 리포트 / 로트 추적 계보 (Genealogy)" type="R4" />
      <RParam period="필요 시"><FField label="추적방향"><FSel value="역방향(출하→자재)" w={150} /></FField><FField label="로트"><FSel value="LOT-OUT-2206-031" w={160} /></FField></RParam>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card title="로트 계보 트리 (출하 로트 → 투입 자재)" action={<span className="text-[10.5px] font-bold" style={{ color: C.err }}>⚠ 불량혼입 경로 강조</span>}>
          <RTraceTree root={root} />
          <div className="mt-4 flex gap-4 border-t border-border pt-3">
            {legend.map((l) => (
              <span key={l[0]} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink2"><span className="h-[9px] w-[9px] rounded-full" style={{ background: l[1] }} />{l[0]}</span>
            ))}
          </div>
        </Card>
        <Card title="추적 요약" bodyClassName="p-0">
          <div className="flex flex-col gap-3 p-4">
            {summary.map((r, i) => (
              <div key={r[0]} className="flex justify-between pb-2 text-[11.5px]" style={{ borderBottom: i < 4 ? `1px solid ${C.border}` : 'none' }}>
                <span className="font-semibold text-ink3">{r[0]}</span>
                <span className={`font-bold ${r[1].includes('-') ? 'font-mono text-[11px]' : ''}`} style={{ color: r[1].includes('RES') ? C.err : C.ink }}>{r[1]}</span>
              </div>
            ))}
            <div className="mt-1 flex gap-2">
              <ActionButton icon="download" label="회수 대상 추출" accent="excel" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
