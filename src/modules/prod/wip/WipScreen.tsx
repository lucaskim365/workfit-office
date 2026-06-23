import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { RankBars, type RankRow } from '@/shared/ui/charts/RankBars';
import { T } from '@/shared/theme/tokens';

const ROWS: Array<[string, string, string, string, string, string, string]> = [
  ['LOT-A2301', 'WF-300-B', 'OP-30 식각', 'ETCH01', '480', '2h 12m', '정상'],
  ['LOT-A2302', 'WF-300-B', 'OP-50 CMP', 'CMP02', '500', '0h 48m', '정상'],
  ['LOT-B5510', 'PKG-BGA-14', 'OP-40 증착', 'DEP03', '320', '4h 35m', '지연'],
  ['LOT-C7720', 'MOD-CAM-02', 'OP-20 포토', 'PHO05', '180', '1h 05m', '정상'],
  ['LOT-A2298', 'WF-200-A', 'OP-60 검사', 'INS-VIS', '410', '5h 50m', '병목'],
];

const DIST: RankRow[] = [
  { label: 'OP-60 검사', v: 620, c: T.err },
  { label: 'OP-40 증착', v: 480, c: T.warn },
  { label: 'OP-30 식각', v: 360, c: T.teal },
  { label: 'OP-50 CMP', v: 280, c: T.teal },
  { label: 'OP-20 포토', v: 200, c: T.c5 },
];

const tone = (s: string): Tone => (s === '정상' ? 'ok' : s === '지연' ? 'warn' : 'err');

/** WIP 재공 관리 — 와이어프레임 prod-screens.WipContent 정본. */
export default function WipScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">WIP 재공 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / WIP 재공 관리 (Work-In-Process)</p>
        </div>
        <ActionBar actions={['refresh', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="총 재공(WIP)" value="1,940" unit="EA" /></Card>
        <Card><Kpi label="진행 LOT" value="24" unit="건" /></Card>
        <Card><Kpi label="평균 체류시간" value="2.8" unit="h" tone="teal" /></Card>
        <Card><Kpi label="병목 공정" value="1" unit="건" /></Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        <Card title="공정별 재공 추적" action={<span className="text-[10.5px] text-ink3">실시간 위치·수량·체류시간</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['LOT 번호', '품목', '현재 공정', '설비', '수량', '체류시간', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 4 || i === 5 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={r[0]} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] font-bold text-ink">{r[0]}</td>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] text-ink2">{r[1]}</td>
                    <td className="border-b border-border px-3 py-2.5 font-semibold text-ink">{r[2]}</td>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] text-ink2">{r[3]}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-bold tabular-nums text-ink">{r[4]}</td>
                    <td className={`border-b border-border px-3 py-2.5 text-right font-semibold tabular-nums ${r[6] === '병목' ? 'text-danger' : 'text-ink2'}`}>{r[5]}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={tone(r[6])} solid={r[6] === '병목'}>{r[6]}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="공정별 재공 분포">
          <RankBars rows={DIST} />
          <div className="mt-3.5 rounded-lg bg-[#fdeceb] px-3 py-2.5 text-[10.5px] font-semibold leading-relaxed text-danger">
            ⚠ OP-60 검사 공정에 재공 집중 — 병목 발생. 검사 설비 증설 또는 우선순위 조정 필요.
          </div>
        </Card>
      </div>
    </div>
  );
}
