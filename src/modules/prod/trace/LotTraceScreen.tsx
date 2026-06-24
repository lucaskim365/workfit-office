import { Card } from '@/shared/ui/Card';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField } from '@/shared/ui/FilterBar';
import { ReadSelect } from '../_bits';
import { useProdLotTraces } from '@/features/prodLotTrace/useProdLotTraces';

const FWD = [
  { op: 'OP-10 입고/세정', eq: 'CLEAN', worker: '이순신', t: '06-09 08:12', mat: 'LOT-RAW-8821' },
  { op: 'OP-20 포토(노광)', eq: 'PHO05', worker: '홍길동', t: '06-09 09:40', mat: 'RES-PR-22' },
  { op: 'OP-30 식각(Etch)', eq: 'ETCH01', worker: '강감찬', t: '06-09 11:05', mat: 'CHM-GAS-02' },
  { op: 'OP-50 CMP 연마', eq: 'CMP02', worker: '유관순', t: '06-09 13:22', mat: 'CHM-SL-05' },
  { op: 'OP-60 검사', eq: 'INS-VIS', worker: '안중근', t: '06-09 14:48', mat: '—' },
];

const SUMMARY: Array<[string, string, boolean]> = [
  ['완제품 LOT', 'LOT-A2301', false],
  ['품목', 'WF-300-B', false],
  ['수량', '480 EA', false],
  ['생산일', '2026-06-09', false],
  ['최종 판정', '합격', true],
];

/** 생산 이력 추적 — 정/역방향 LOT 계보. 와이어프레임 prod-screens-2.LotTraceContent 정본. */
export default function LotTraceScreen() {
  const { data: mats = [] } = useProdLotTraces();
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">생산 이력 추적</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산 이력 추적 (Lot Traceability)</p>
        </div>
        <ActionBar actions={['download']} />
      </div>

      <FilterBar right={<ActionButton icon="search" label="추적" variant="primary" />}>
        <FilterField label="추적 LOT">
          <span className="inline-flex h-8 w-[180px] items-center rounded-md border border-border-hi bg-panel px-3 font-mono text-[12px] font-bold text-ink">LOT-A2301</span>
        </FilterField>
        <FilterField label="방향"><ReadSelect value="정방향 추적" w={130} /></FilterField>
      </FilterBar>

      <Card>
        <div className="flex flex-wrap items-center gap-6">
          {SUMMARY.map(([k, v, ok], i) => (
            <div key={k}>
              <div className="text-[10.5px] font-semibold text-ink3">{k}</div>
              <div className={`mt-0.5 text-[14px] font-extrabold ${ok ? 'text-ok' : 'text-ink'} ${i <= 1 ? 'font-mono' : ''}`}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <Card title="공정 이력 (BOP — 정방향)" action={<span className="text-[10.5px] text-ink3">공정 · 설비 · 작업자 추적</span>}>
          <div className="flex flex-col">
            {FWD.map((s, i) => (
              <div key={s.op} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className="h-3 w-3 rounded-full border-2 border-white bg-teal ring-2 ring-teal" />
                  {i < FWD.length - 1 && <span className="w-0.5 flex-1 bg-border" style={{ minHeight: 28 }} />}
                </div>
                <div className="flex-1 pb-[18px]">
                  <div className="flex justify-between">
                    <span className="text-[12.5px] font-bold text-ink">{s.op}</span>
                    <span className="text-[10.5px] tabular-nums text-ink3">{s.t}</span>
                  </div>
                  <div className="mt-1 flex gap-3.5 text-[11px] text-ink2">
                    <span>설비 <b className="font-mono text-ink">{s.eq}</b></span>
                    <span>작업자 <b className="text-ink">{s.worker}</b></span>
                    {s.mat !== '—' && <span>투입 <b className="font-mono text-ink">{s.mat}</b></span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="투입 자재 계보 (BOM — 역방향)">
          <div className="flex flex-col gap-2">
            {mats.map((m, i) => (
              <div key={m.mat} className="flex items-center gap-2.5 rounded-lg border border-border bg-panel-alt px-3 py-2.5">
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-teal-soft text-[11px] font-extrabold text-teal">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-bold text-ink">{m.name} <span className="font-mono text-[10px] text-ink3">{m.mat}</span></div>
                  <div className="mt-px text-[10px] text-ink3"><span className="font-mono">{m.lot}</span> · {m.vendor}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
