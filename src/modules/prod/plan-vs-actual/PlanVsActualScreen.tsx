import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { GroupedBars } from '@/shared/ui/charts/GroupedBars';
import { Gauge } from '@/shared/ui/charts/Gauge';
import { ReadSelect } from '../_bits';
import { T } from '@/shared/theme/tokens';

const DAYS = [
  { label: '06-15', plan: 5000, actual: 4850 },
  { label: '06-16', plan: 5200, actual: 5100 },
  { label: '06-17', plan: 4800, actual: 4600 },
  { label: '06-18', plan: 5500, actual: 5500 },
  { label: '06-19', plan: 5300, actual: 5150 },
  { label: '06-20', plan: 5400, actual: 5300 },
  { label: '06-21', plan: 5600, actual: 5200 },
];

interface Item {
  code: string;
  name: string;
  line: string;
  plan: number;
  actual: number;
  delay: number;
}
const ITEMS: Item[] = [
  { code: 'BR-KIT-2T', name: '브래킷 키트', line: '프레스 라인', plan: 15000, actual: 15300, delay: 0 },
  { code: 'TM-PIN-16', name: '터미널 핀', line: '프레스 라인', plan: 60000, actual: 58800, delay: 0 },
  { code: 'CN-ASM-100', name: '커넥터 어셈블리', line: '조립 라인', plan: 12000, actual: 11400, delay: 1 },
  { code: 'SN-MOD-200', name: '센서 모듈', line: 'SMT 라인', plan: 8000, actual: 7600, delay: 1 },
  { code: 'HS-CAP-06', name: '하우징 캡', line: '사출 라인', plan: 6000, actual: 5200, delay: 2 },
];

const achieve = (it: Item) => +((it.actual / it.plan) * 100).toFixed(1);
const state = (it: Item) => { const a = achieve(it); return a >= 100 ? '달성' : a >= 95 ? '양호' : a >= 90 ? '미달' : '부진'; };
const stTone = (s: string): Tone => (s === '달성' ? 'ok' : s === '양호' ? 'info' : s === '미달' ? 'warn' : 'err');
const barColor = (a: number) => (a >= 100 ? T.ok : a >= 95 ? T.teal : a >= 90 ? T.warn : T.err);

/** 계획 대비 실적 분석 — 와이어프레임 plan-vs-actual.jsx 정본. */
export default function PlanVsActualScreen() {
  const items = [...ITEMS].sort((a, b) => achieve(b) - achieve(a));
  const totalPlan = ITEMS.reduce((s, it) => s + it.plan, 0);
  const totalActual = ITEMS.reduce((s, it) => s + it.actual, 0);
  const overall = +((totalActual / totalPlan) * 100).toFixed(1);
  const diff = totalActual - totalPlan;

  const kpis: Array<[string, string, string, string]> = [
    ['계획 수량', totalPlan.toLocaleString(), 'EA', 'text-ink'],
    ['실적 수량', totalActual.toLocaleString(), 'EA', 'text-teal'],
    ['종합 달성률', String(overall), '%', overall >= 95 ? 'text-teal' : 'text-amber'],
    ['미달 품목', '2', '종', 'text-amber'],
    ['지연 품목', '3', '종', 'text-danger'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">계획 대비 실적 분석</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 추적·분석 / 계획 대비 실적 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <ReadSelect value="최근 7일" w={92} />
          <ReadSelect value="전체 라인" w={92} />
          <ActionBar actions={['compare', 'download']} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c]) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${c}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[1fr_300px]">
        <Card
          title="일별 계획 vs 실적"
          action={
            <div className="flex gap-3.5 text-[10.5px]">
              <span className="flex items-center gap-1.5 font-semibold text-ink2"><span className="h-[9px] w-2.5 rounded-sm" style={{ background: T.c5 }} />계획</span>
              <span className="flex items-center gap-1.5 font-semibold text-ink2"><span className="h-[9px] w-2.5 rounded-sm bg-teal" />실적</span>
            </div>
          }
        >
          <GroupedBars data={DAYS} series={[{ key: 'plan', c: T.c5 }, { key: 'actual', c: T.teal }]} w={620} h={240} grid={4} />
        </Card>

        <Card title="종합 달성률">
          <div className="flex flex-col items-center">
            <Gauge value={overall} max={100} label="달성률 (%)" size={150} color={overall >= 95 ? T.teal : T.warn} />
          </div>
          <div className="mt-2 flex flex-col gap-2.5">
            {([['계획', totalPlan, 'text-ink3'], ['실적', totalActual, 'text-teal'], ['차이', diff, diff < 0 ? 'text-danger' : 'text-ok']] as const).map(([k, v, c], i) => (
              <div key={k} className={`flex items-center justify-between pb-1.5 ${i < 2 ? 'border-b border-border' : ''}`}>
                <span className="text-[11px] font-semibold text-ink3">{k}</span>
                <span className={`font-mono text-[13px] font-extrabold ${c}`}>{v > 0 && k === '차이' ? '+' : ''}{v.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="제품별 계획 대비 실적" action={<span className="text-[10px] text-ink3">달성률 내림차순</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['제품 / 라인', '계획', '실적', '차이', '달성률', '지연', '상태'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 1 && i <= 3 ? 'text-right' : i >= 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const a = achieve(it);
                const d = it.actual - it.plan;
                return (
                  <tr key={it.code} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{it.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{it.code} · {it.line}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{it.plan.toLocaleString()}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink">{it.actual.toLocaleString()}</td>
                    <td className={`border-b border-border px-3 py-2.5 text-right font-mono font-bold ${d < 0 ? 'text-danger' : 'text-ok'}`}>{d > 0 ? '+' : ''}{d.toLocaleString()}</td>
                    <td className="border-b border-border px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="relative h-2 min-w-[70px] flex-1 rounded bg-bg-deep">
                          <div className="h-full rounded" style={{ width: `${Math.min(a, 100)}%`, background: barColor(a) }} />
                          <div className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-px bg-navy" style={{ left: '100%' }} />
                        </div>
                        <span className={`w-[42px] text-right font-mono font-extrabold ${a >= 95 ? 'text-ink' : 'text-danger'}`}>{a}%</span>
                      </div>
                    </td>
                    <td className={`border-b border-border px-3 py-2.5 text-center font-mono font-bold ${it.delay > 0 ? 'text-danger' : 'text-ink3'}`}>{it.delay > 0 ? `${it.delay}일` : '–'}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(state(it))}>{state(it)}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
