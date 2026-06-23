import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill } from '@/shared/ui/Pill';
import { T } from '@/shared/theme/tokens';
import { Donut } from '@/shared/ui/charts/Donut';
import { GroupedBars } from '@/shared/ui/charts/GroupedBars';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import {
  KPIS,
  TARGET_ACTUAL,
  EQUIP_STATUS,
  DEFECTS,
  ALARMS,
  INSP_INCOMING,
  INSP_SHIP,
  SPARK,
  type InspSummary,
} from './mock';

function Legend({ items }: { items: Array<{ c: string; t: string }> }) {
  return (
    <div className="flex gap-3.5">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink2">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.c }} />
          {it.t}
        </span>
      ))}
    </div>
  );
}

function InspMini({ title, d }: { title: string; d: InspSummary }) {
  const cells: Array<[string, number]> = [
    ['계획', d.계획],
    ['완료', d.완료],
    ['진행', d.진행],
    ['불합격', d.불합격],
  ];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11.5px] font-bold text-ink">{title}</span>
        <Pill tone={d.합격률 >= 95 ? 'ok' : 'warn'}>합격률 {d.합격률}%</Pill>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {cells.map(([l, v]) => (
          <div key={l} className="rounded-[7px] bg-panel-alt px-1 py-2 text-center">
            <div
              className={`text-base font-extrabold ${
                l === '불합격' && v > 0 ? 'text-danger' : 'text-ink'
              }`}
            >
              {v}
            </div>
            <div className="text-[9.5px] font-semibold text-ink3">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 통합 모니터링 대시보드 — 와이어프레임 dash-a.jsx(DashV1) 본문 정본 이관. */
export default function DashboardScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      {/* 페이지 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">통합 모니터링</h1>
          <p className="mt-0.5 text-xs text-ink3">운영 현황 / 실시간 대시보드</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink3">
          <span className="rounded-md bg-blue-soft px-3 py-1.5 font-bold text-navy">
            [WorkFit] M-line · Fab1
          </span>
          <span className="tabular-nums">최근 갱신 14:25 · 자동 30초</span>
        </div>
      </div>

      {/* KPI 행 */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {KPIS.map((k, i) => (
          <Card key={k.label} bodyClassName="flex items-center justify-between">
            <Kpi {...k} />
            <Sparkline data={SPARK} color={i % 2 ? T.blue : T.teal} />
          </Card>
        ))}
      </div>

      {/* 2행: 목표 대비 실적 + 실시간 알람 */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        <Card
          title="목표 대비 실적 현황"
          action={<Legend items={[{ c: T.c5, t: '목표' }, { c: T.teal, t: '실적' }]} />}
        >
          <GroupedBars
            data={TARGET_ACTUAL}
            series={[
              { key: '목표', c: T.c5 },
              { key: '실적', c: T.teal },
            ]}
            w={620}
            h={250}
          />
        </Card>

        <Card
          title="실시간 알람"
          action={<span className="text-[10px] font-semibold text-blue">전체 보기</span>}
        >
          <div className="flex flex-col gap-2">
            {ALARMS.map((a, i) => (
              <div
                key={a.code}
                className={`flex items-start gap-2.5 ${
                  i < ALARMS.length - 1 ? 'border-b border-border pb-2' : ''
                }`}
              >
                <Pill tone={a.tone} solid>
                  {a.tag}
                </Pill>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] font-semibold text-ink">{a.msg}</div>
                  <div className="text-[10px] text-ink3">
                    {a.code} · {a.t}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 3행: 설비 가동 + 결함 TOP5 + 검사 요약 */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.3fr_1fr]">
        <Card title="설비 가동 현황">
          <div className="flex items-center gap-3.5">
            <Donut data={EQUIP_STATUS} centerTop="62%" centerSub="가동률" />
            <div className="flex flex-1 flex-col gap-2.5">
              {EQUIP_STATUS.map((e) => (
                <div key={e.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: e.c }} />
                  <span className="flex-1 font-semibold text-ink2">{e.name}</span>
                  <span className="font-bold text-ink">{e.v}대</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="주간 결함 코드 TOP 5">
          <RankBars rows={DEFECTS} />
        </Card>

        <Card title="검사 현황 요약">
          <InspMini title="수입검사" d={INSP_INCOMING} />
          <div className="my-3 h-px bg-border" />
          <InspMini title="출하검사" d={INSP_SHIP} />
        </Card>
      </div>
    </div>
  );
}
