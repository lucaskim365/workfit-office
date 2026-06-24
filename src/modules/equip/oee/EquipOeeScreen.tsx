import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField } from '@/shared/ui/FilterBar';
import { Gauge } from '@/shared/ui/charts/Gauge';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { ReadSelect } from '@/modules/prod/_bits';
import { T } from '@/shared/theme/tokens';
import { useOeeEquipments } from '@/features/oeeEquipment/useOeeEquipments';
import type { OeeEquipment } from '@/domain/oeeEquipment/schema';

const OEE = { total: 84.2, avail: 92.5, perf: 95.1, qual: 95.7, dT: 2.3, dA: 1.1, dP: -0.4, dQ: 0.6 };
const TREND_LABELS = ['05.28', '', '05.30', '', '06.01', '', '06.03', '', '06.05', '', '06.07', '', '06.09', '06.10'];
const TREND_OEE = [80.1, 81.4, 79.8, 82.0, 83.1, 81.9, 82.7, 84.0, 83.5, 82.2, 84.8, 85.1, 83.9, 84.2];
const TREND_TARGET = TREND_LABELS.map(() => 85);

const LOSSES = [
  { label: '고장 정지', v: 124, c: '#e0564f', grp: '가용성' },
  { label: '준비 · 교체', v: 86, c: '#ef8f43', grp: '가용성' },
  { label: '순간 정지 · 공회전', v: 52, c: '#3a6ee0', grp: '성능' },
  { label: '속도 저하', v: 41, c: '#6f8fe6', grp: '성능' },
  { label: '공정 불량 · 재작업', v: 28, c: '#17a89a', grp: '품질' },
  { label: '초기 수율 (가동 직후)', v: 17, c: '#4cc3b4', grp: '품질' },
];
const LOSS_TOTAL = LOSSES.reduce((s, l) => s + l.v, 0);

/** 설비별 OEE 행 + 파생 OEE(가용성×성능×품질). */
type EqOee = OeeEquipment & { oee: number };
const withOee = (e: OeeEquipment): EqOee => ({ ...e, oee: +((e.a / 100) * (e.p / 100) * (e.q / 100) * 100).toFixed(1) });

const LINE_OEE = [
  { line: 'A라인', oee: 87.0, eq: 3 },
  { line: 'B라인', oee: 79.2, eq: 2 },
  { line: 'C라인', oee: 72.1, eq: 2 },
];

const oeeColor = (v: number) => (v >= 85 ? T.ok : v >= 75 ? T.warn : T.err);
const oeeTextColor = (v: number) => (v >= 85 ? 'text-ok' : v >= 75 ? 'text-amber' : 'text-danger');

function CompBar({ label, value, delta, color }: { label: string; value: number; delta: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] font-bold text-ink2">{label}</span>
        <span className="flex items-baseline gap-1">
          <span className="text-[18px] font-extrabold tabular-nums text-ink">{value}<span className="text-[10px] text-ink3">%</span></span>
          <span className={`text-[10.5px] font-bold ${delta >= 0 ? 'text-ok' : 'text-danger'}`}>{delta >= 0 ? '▲' : '▼'}{Math.abs(delta)}</span>
        </span>
      </div>
      <div className="h-[9px] overflow-hidden rounded-md border border-border bg-panel-alt">
        <div className="h-full rounded-md" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

/** 종합 설비 효율(OEE) 현황 — 와이어프레임 equip-oee.jsx 정본. */
export default function EquipOeeScreen() {
  const { data: eqRows = [], isLoading } = useOeeEquipments();
  const EQ_OEE: EqOee[] = eqRows.map(withOee);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">종합 설비 효율 (OEE) 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 상태 모니터링 / 종합 설비 효율(OEE) 현황</p>
        </div>
        <ActionBar actions={['refresh', 'compare', 'download']} />
      </div>

      <FilterBar onSearch={() => {}} right={<span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok" /><span className="text-[11px] text-ink3">실시간 · 5분 자동 갱신</span></span>}>
        <FilterField label="라인"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="설비 유형"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="교대조"><ReadSelect value="전체 (주/야)" w={120} /></FilterField>
        <FilterField label="기간"><ReadSelect value="2026-06-10 (일)" w={150} /></FilterField>
      </FilterBar>

      {/* KPI 히어로 */}
      <Card bodyClassName="p-0">
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-[300px_1fr]">
          <div className="flex flex-col items-center justify-center gap-1 border-b border-border bg-panel-alt px-[18px] py-[22px] lg:border-b-0 lg:border-r">
            <span className="text-[12px] font-bold text-ink2">종합 설비 효율 (OEE)</span>
            <Gauge value={OEE.total} max={100} size={184} color={T.teal} />
            <div className="-mt-1.5 flex items-center gap-2">
              <span className="text-[11px] font-bold text-ok">▲ {OEE.dT}%p</span>
              <span className="text-[11px] text-ink3">vs 전일</span>
              <Pill tone="warn">목표 85% 대비 −0.8</Pill>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 px-6 py-5">
            <div className="flex items-center gap-2.5 text-[12.5px] font-bold text-ink2">
              OEE 구성 <span className="font-mono text-[11.5px] font-semibold text-ink3">= 가용성 × 성능 × 품질</span>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <CompBar label="가용성 (Availability)" value={OEE.avail} delta={OEE.dA} color={T.teal} />
              <CompBar label="성능 (Performance)" value={OEE.perf} delta={OEE.dP} color={T.blue} />
              <CompBar label="품질 (Quality)" value={OEE.qual} delta={OEE.dQ} color={T.ok} />
            </div>
            <div className="flex flex-wrap gap-6 border-t border-dashed border-border pt-1">
              {([['계획 가동시간', '1,320 분'], ['실제 가동', '1,221 분'], ['총 정지 손실', `${LOSS_TOTAL} 분`], ['양품 / 투입', '4,182 / 4,372 EA']] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-ink3">{k}</span>
                  <span className="text-[13.5px] font-extrabold tabular-nums text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">
        <Card title="OEE 추이 (최근 14일)" action={<span className="flex gap-3 text-[10.5px]"><span className="flex items-center gap-1 text-ink2"><span className="h-[3px] w-3 rounded-sm bg-teal" />OEE</span><span className="flex items-center gap-1 text-ink3"><span className="h-[3px] w-3 rounded-sm bg-ink3" />목표 85%</span></span>}>
          <LineChart w={560} h={210} grid={4} max={100} area labels={TREND_LABELS} series={[{ data: TREND_OEE, c: T.teal }, { data: TREND_TARGET, c: T.ink3 }]} />
        </Card>

        <Card title="6대 로스 분석 (손실 시간)" action={<span className="text-[11px] font-bold text-danger">총 {LOSS_TOTAL}분</span>}>
          <div className="flex flex-col gap-2.5">
            {LOSSES.map((l) => (
              <div key={l.label} className="flex items-center gap-2.5">
                <span className="w-[38px] text-[9px] font-bold text-ink3">{l.grp}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex justify-between">
                    <span className="truncate text-[11px] font-semibold text-ink">{l.label}</span>
                    <span className="text-[11px] font-extrabold tabular-nums text-ink2">{l.v}분 · {Math.round((l.v / LOSS_TOTAL) * 100)}%</span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded bg-panel-alt">
                    <div className="h-full rounded" style={{ width: `${(l.v / LOSSES[0].v) * 100}%`, background: l.c }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_300px]">
        <Card title="설비별 OEE 비교" action={<span className="text-[10.5px] text-ink3">OEE 내림차순 · {EQ_OEE.length}대</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['#', '설비', '상태', '가용성', '성능', '품질', 'OEE', '6일 추이'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 0 || i === 2 || i === 7 ? 'text-center' : i >= 3 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EQ_OEE.length === 0 && (
                  <tr><td colSpan={8} className="px-2.5 py-10 text-center text-[12px] text-ink3">{isLoading ? '불러오는 중…' : '설비 OEE 데이터가 없습니다.'}</td></tr>
                )}
                {EQ_OEE.map((e, i) => (
                  <tr key={e.code} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className={`border-b border-border px-2.5 py-2 text-center font-extrabold ${i < 3 ? 'text-navy' : 'text-ink3'}`}>{i + 1}</td>
                    <td className="border-b border-border px-2.5 py-2">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-bold text-ink">{e.name}</span>
                        <span className="font-mono text-[9.5px] text-ink3">{e.code} · {e.line}라인</span>
                      </div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2 text-center"><span className={`inline-block h-2 w-2 rounded-full ${e.st === '가동' ? 'bg-ok' : e.st === '대기' ? 'bg-blue' : e.st === '정지' ? 'bg-amber' : 'bg-danger'}`} /></td>
                    <td className="border-b border-border px-2.5 py-2 text-right tabular-nums text-ink2">{e.a}%</td>
                    <td className="border-b border-border px-2.5 py-2 text-right tabular-nums text-ink2">{e.p}%</td>
                    <td className="border-b border-border px-2.5 py-2 text-right tabular-nums text-ink2">{e.q}%</td>
                    <td className="border-b border-border px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 min-w-[50px] flex-1 overflow-hidden rounded bg-panel-alt">
                          <div className="h-full rounded" style={{ width: `${e.oee}%`, background: oeeColor(e.oee) }} />
                        </div>
                        <span className={`w-[42px] text-right text-[12.5px] font-extrabold tabular-nums ${oeeTextColor(e.oee)}`}>{e.oee}</span>
                      </div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2 text-center"><Sparkline data={e.tr} w={62} h={20} color={oeeColor(e.oee)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="라인별 OEE">
          <div className="flex flex-col gap-4">
            {LINE_OEE.map((l) => (
              <div key={l.line} className="flex items-center gap-3">
                <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${oeeColor(l.oee)} ${l.oee * 3.6}deg, var(--color-panel-alt) 0)` }}>
                  <div className="grid h-[38px] w-[38px] place-items-center rounded-full bg-panel text-[12px] font-extrabold text-ink">{l.oee}</div>
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-extrabold text-ink">{l.line}</span>
                  <span className="text-[10.5px] text-ink3">설비 {l.eq}대 · OEE {l.oee}%</span>
                </div>
                <Pill tone={l.oee >= 85 ? 'ok' : l.oee >= 75 ? 'info' : 'warn'}>{l.oee >= 85 ? '우수' : l.oee >= 75 ? '보통' : '개선'}</Pill>
              </div>
            ))}
            <div className="mt-0.5 rounded-[9px] border border-border bg-panel-alt p-3 text-[11px] leading-relaxed text-ink2">
              <b className="text-danger">C라인</b> Thermal 05 고장으로 OEE 저하. 보전 완료 시 <b className="text-ok">+12%p</b> 회복 예상.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
