import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField } from '@/shared/ui/FilterBar';
import { ReadSelect, ProgBar } from '../_bits';
import { useProdPlans } from '@/features/prodPlan/useProdPlans';
import type { ProdPlan } from '@/domain/prodPlan/schema';

const ST_TONE: Record<ProdPlan['status'], Tone> = { 확정: 'ok', 검토: 'info', 수신: 'mute' };
const LOADS: Array<[string, number]> = [['M-Line', 92], ['P-Line', 78], ['A-Line', 64]];

/** 생산계획 관리 — 와이어프레임 prod-screens.ProdPlanContent 정본. */
export default function ProdPlanScreen() {
  const { data: plans = [], isLoading } = useProdPlans();
  const [sel, setSel] = useState('PL-260611-01');

  if (!plans.length) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '생산 계획이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">생산계획 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산계획 관리</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '계획 추가' }, 'save', 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => {}} right={<ActionButton icon="download" label="ERP 계획 수신" accent="excel" />}>
        <FilterField label="계획일자"><ReadSelect value="2026-06-11" w={130} /></FilterField>
        <FilterField label="라인"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="교대"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="상태"><ReadSelect value="전체" w={90} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="수신 계획" value="5" unit="건" /></Card>
        <Card><Kpi label="확정" value="2" unit="건" tone="teal" /></Card>
        <Card><Kpi label="계획 수량" value="15,700" unit="EA" /></Card>
        <Card><Kpi label="라인 부하율" value="92" unit="%" /></Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        <Card title="생산 계획 (일별 / 교대별)" action={<span className="text-[10.5px] text-ink3">ERP 수신 계획 기준</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['계획번호', '품목', '라인', '교대', '계획수량', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 4 ? 'text-right' : i >= 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const on = p.no === sel;
                  return (
                    <tr key={p.no} onClick={() => setSel(p.no)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3 py-2.5 font-mono text-[11px] font-bold ${on ? 'text-teal' : 'text-ink'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{p.no}</td>
                      <td className="px-3 py-2.5"><span className="font-mono text-[11px] font-semibold text-ink">{p.code}</span> <span className="text-[10.5px] text-ink3">{p.name}</span></td>
                      <td className="px-3 py-2.5 text-center text-ink2">{p.line}</td>
                      <td className="px-3 py-2.5 text-center text-ink2">{p.shift}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{p.qty}</td>
                      <td className="px-3 py-2.5 text-center"><Pill tone={ST_TONE[p.status]}>{p.status}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="라인 부하 현황">
          <div className="flex flex-col gap-3.5">
            {LOADS.map(([line, v]) => (
              <div key={line}>
                <div className="mb-1.5 flex justify-between">
                  <span className="text-[11.5px] font-bold text-ink">{line}</span>
                  <span className="text-[11px] font-bold text-ink2">{v}%</span>
                </div>
                <ProgBar v={v} />
              </div>
            ))}
            <div className="my-0.5 h-px bg-border" />
            <p className="text-[10.5px] leading-relaxed text-ink3">ERP 수신 계획을 라인 가용 능력(CAPA)에 맞춰 배분하고, 교대별로 세부 수량을 확정합니다.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
