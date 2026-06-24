import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { T } from '@/shared/theme/tokens';
import { Donut } from '@/shared/ui/charts/Donut';
import { GroupedBars } from '@/shared/ui/charts/GroupedBars';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { LINES, STATE_MIX, DOWN_REASONS, LINE_OUTPUT, UTIL_TREND, UTIL_LABELS, type LineCard, type LineState } from './mock';

const STATE: Record<LineState, { dot: string; tone: Tone; solid: boolean }> = {
  가동: { dot: T.teal, tone: 'ok', solid: false },
  정지: { dot: T.err, tone: 'err', solid: true },
  대기: { dot: T.warn, tone: 'warn', solid: false },
};

function LineTile({ l }: { l: LineCard }) {
  const s = STATE[l.state];
  const pct = Math.min(Math.round((l.actual / l.plan) * 100), 100);
  const barC = l.state === '정지' ? T.err : pct >= 90 ? T.teal : pct >= 70 ? T.blue : T.warn;
  return (
    <div className="flex flex-col gap-3 rounded-[11px] border border-border bg-panel p-4" style={{ borderLeft: `3px solid ${s.dot}` }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.dot, boxShadow: l.state === '가동' ? `0 0 0 3px ${T.teal}22` : 'none' }} />
          <div>
            <div className="text-[13px] font-extrabold text-ink">{l.name}</div>
            <div className="text-[10px] font-semibold text-ink3">{l.proc} · {l.shift}</div>
          </div>
        </div>
        <Pill tone={s.tone} solid={s.solid}>{l.state}</Pill>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-ink2">생산 품목</span>
        <span className="font-mono text-[11px] font-bold text-ink">{l.product}</span>
      </div>

      {l.state === '정지' ? (
        <div className="flex items-center justify-between rounded-[7px] px-3 py-2 text-[11px]" style={{ background: '#fdecea' }}>
          <span className="font-bold" style={{ color: T.err }}>⏸ {l.reason}</span>
          <span className="font-extrabold tabular-nums" style={{ color: T.err }}>{l.downMin}분 경과</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-ink2">OEE / 가동시간</span>
          <span className="font-bold text-ink"><span className="tabular-nums" style={{ color: T.teal }}>{l.oee}%</span> · {l.runtime}</span>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between text-[10.5px]">
          <span className="font-semibold text-ink3">생산 진척</span>
          <span className="font-bold tabular-nums text-ink2">{l.actual.toLocaleString()} / {l.plan.toLocaleString()} EA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-[8px] flex-1 rounded" style={{ background: T.bgDeep }}><div className="h-full rounded" style={{ width: `${pct}%`, background: barC }} /></div>
          <span className="w-9 text-right text-[11px] font-extrabold tabular-nums text-ink">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

/** 라인 가동 현황 — 통합 모니터링 디자인 언어로 신규 구성(전용 와이어프레임 부재). */
export default function LineStatusScreen() {
  const running = LINES.filter((l) => l.state === '가동');
  const avgOee = (running.reduce((s, l) => s + l.oee, 0) / running.length).toFixed(1);
  const todayOut = LINES.reduce((s, l) => s + l.actual, 0);
  const stopped = LINES.filter((l) => l.state === '정지').length;

  return (
    <div className="flex flex-col gap-3.5">
      {/* 페이지 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">라인 가동 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">운영 현황 / 라인별 가동·정지 상태</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink3">
          <span className="rounded-md bg-blue-soft px-3 py-1.5 font-bold text-navy">[WorkFit] M-line · Fab1</span>
          <span className="tabular-nums">최근 갱신 14:25 · 자동 30초</span>
        </div>
      </div>

      {/* KPI 행 */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="가동 라인" value={`${running.length}/${LINES.length}`} unit="라인" tone="teal" /></Card>
        <Card><Kpi label="평균 OEE" value={avgOee} unit="%" /></Card>
        <Card><Kpi label="정지 라인" value={String(stopped)} unit="라인" /></Card>
        <Card><Kpi label="금일 생산(양품)" value={todayOut.toLocaleString()} unit="EA" tone="blue" /></Card>
      </div>

      {/* 라인 카드 그리드 */}
      <Card title="라인별 실시간 가동 현황" bodyClassName="p-0">
        <div className="grid grid-cols-1 gap-3.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {LINES.map((l) => <LineTile key={l.name} l={l} />)}
        </div>
      </Card>

      {/* 분석 행 */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.3fr_1fr]">
        <Card title="가동 상태 구성">
          <div className="flex items-center gap-3.5">
            <Donut data={STATE_MIX} centerTop={`${running.length}/${LINES.length}`} centerSub="가동" />
            <div className="flex flex-1 flex-col gap-2.5">
              {STATE_MIX.map((e) => (
                <div key={e.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: e.c }} />
                  <span className="flex-1 font-semibold text-ink2">{e.name}</span>
                  <span className="font-bold text-ink">{e.v}라인</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="라인별 금일 계획 대비 실적">
          <GroupedBars data={LINE_OUTPUT} series={[{ key: '계획', c: T.c5 }, { key: '실적', c: T.teal }]} h={230} />
          <div className="mt-2 flex gap-3.5">
            {([['계획', T.c5], ['실적', T.teal]] as const).map(([t, c]) => (
              <span key={t} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />{t}</span>
            ))}
          </div>
        </Card>

        <Card title="비가동 사유 (분)">
          <RankBars rows={DOWN_REASONS} />
        </Card>
      </div>

      {/* 시간대 추이 */}
      <Card title="시간대별 종합 가동률 추이 (%)">
        <LineChart series={[{ data: UTIL_TREND, c: T.teal }]} labels={UTIL_LABELS} h={150} max={100} area />
      </Card>
    </div>
  );
}
