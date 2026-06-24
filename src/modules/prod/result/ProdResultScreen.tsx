import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { DetailField } from '@/shared/ui/DetailField';
import { useProductionResults } from '@/features/productionResult/useProductionResults';

/** 생산실적 등록 — 와이어프레임 prod-screens-2.ProdResultContent 정본. */
export default function ProdResultScreen() {
  const { data: results = [], isLoading } = useProductionResults();
  const [sel, setSel] = useState('WO-260611-021');
  const cur = results.find((r) => r.no === sel) ?? results[0];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '생산실적이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">생산실적 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산실적 등록 (Production Result)</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '실적 추가' }, 'save', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="당일 양품" value="4,885" unit="EA" tone="teal" /></Card>
        <Card><Kpi label="당일 불량" value="71" unit="EA" /></Card>
        <Card><Kpi label="불량률" value="1.43" unit="%" /></Card>
        <Card><Kpi label="직행률(FPY)" value="96.8" unit="%" tone="teal" /></Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        <Card title="작업지시별 실적" action={<span className="text-[10.5px] text-ink3">자동화 라인 PLC 연동 자동 집계</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['지시번호', '품목', '지시', '양품', '불량', '주요 불량', '집계'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 2 && i <= 4 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const on = r.no === sel;
                  return (
                    <tr key={r.no} onClick={() => setSel(r.no)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3 py-2.5 font-mono text-[11px] font-bold ${on ? 'text-teal' : 'text-ink'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{r.no}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-ink2">{r.code}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{r.order}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-teal">{r.good}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-danger">{r.bad}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-ink2">{r.defect}</td>
                      <td className="px-3 py-2.5 text-center"><Pill tone={r.agg.includes('자동') ? 'info' : 'mute'}>{r.agg}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="실적 입력">
          <div className="flex flex-col gap-3">
            <DetailField label="지시번호" value={cur.no} mono />
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="양품" value={cur.good} mono />
              <DetailField label="불량" value={cur.bad} mono />
            </div>
            <DetailField label="불량유형" select value={`${cur.defect} Scratch`} />
            <DetailField label="작업자" value="홍길동" />
            <div className="rounded-lg bg-blue-soft px-3 py-2.5 text-[10.5px] font-semibold leading-relaxed text-navy">
              ℹ 자동화 라인은 설비 PLC 데이터와 연동하여 양품·불량 수량이 자동 집계됩니다.
            </div>
            <div className="flex justify-end">
              <ActionButton icon="save" label="실적 저장" variant="primary" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
