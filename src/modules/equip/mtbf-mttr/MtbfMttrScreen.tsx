import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { Gauge } from '@/shared/ui/charts/Gauge';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C } from '../_maint';

const MM_MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월'];
const MM_MTBF = [318, 342, 356, 351, 388, 412];
const MM_MTTR = [3.4, 3.2, 3.0, 3.1, 2.8, 2.7];

interface Eq { name: string; line: string; run: number; fail: number; repair: number; trend: number[] }
const MM_EQ: Eq[] = [
  { name: 'Thermal 05호기', line: '확산', run: 1900, fail: 2, repair: 5.0, trend: [880, 910, 930, 920, 940, 950] },
  { name: '프레스 01호기', line: '성형', run: 1880, fail: 3, repair: 6.6, trend: [540, 560, 600, 590, 615, 627] },
  { name: 'CMP 02호기', line: '평탄화', run: 1840, fail: 4, repair: 9.2, trend: [410, 430, 445, 440, 455, 460] },
  { name: 'Depo 03호기', line: '증착', run: 1820, fail: 5, repair: 14.0, trend: [300, 320, 340, 350, 358, 364] },
  { name: '사출 03호기', line: '성형', run: 1700, fail: 6, repair: 12.0, trend: [250, 260, 270, 275, 280, 283] },
  { name: 'Etch 01호기', line: '식각', run: 1760, fail: 7, repair: 21.0, trend: [210, 225, 240, 235, 248, 251] },
  { name: 'Implant 02호기', line: '주입', run: 1680, fail: 9, repair: 36.0, trend: [160, 170, 180, 175, 185, 187] },
  { name: 'Clean 04호기', line: '세정', run: 1600, fail: 11, repair: 49.5, trend: [120, 130, 140, 135, 142, 145] },
];
const mtbf = (e: Eq) => Math.round(e.run / e.fail);
const mttr = (e: Eq) => +(e.repair / e.fail).toFixed(1);
const avail = (e: Eq) => +((mtbf(e) / (mtbf(e) + mttr(e))) * 100).toFixed(1);
const grade = (e: Eq) => { const a = avail(e); return a >= 99.5 ? '우수' : a >= 99 ? '양호' : a >= 98 ? '주의' : '관리'; };
const gradeTone = (g: string): Tone => (g === '우수' ? 'ok' : g === '양호' ? 'info' : g === '주의' ? 'warn' : 'err');
const TONE_C: Record<string, string> = { ok: C.ok, info: C.blue, warn: C.warn, err: C.err };

function Sel({ value, w }: { value: string; w?: number }) {
  return <span className="inline-flex items-center justify-between gap-3.5 rounded-[7px] border border-border-hi bg-panel px-3 py-[7px] text-[11.5px] font-semibold whitespace-nowrap text-ink" style={{ minWidth: w }}>{value} <span className="text-[8px] text-ink3">▾</span></span>;
}

/** MTBF / MTTR 분석 — 와이어프레임 mtbf-mttr.jsx 정본. */
export default function MtbfMttrScreen() {
  const eqs = [...MM_EQ].sort((a, b) => mtbf(b) - mtbf(a));
  const avgMtbf = Math.round(MM_EQ.reduce((s, e) => s + mtbf(e), 0) / MM_EQ.length);
  const avgMttr = +(MM_EQ.reduce((s, e) => s + mttr(e), 0) / MM_EQ.length).toFixed(1);
  const avgAvail = +(MM_EQ.reduce((s, e) => s + avail(e), 0) / MM_EQ.length).toFixed(1);
  const totalFail = MM_EQ.reduce((s, e) => s + e.fail, 0);
  const momMtbf = Math.round(((MM_MTBF[5] - MM_MTBF[4]) / MM_MTBF[4]) * 100);
  const maxBars = Math.max(...MM_EQ.map(mtbf)) * 1.1;

  const KPI: [string, string, string, string, number | null][] = [
    ['평균 MTBF', '' + avgMtbf, 'h', C.teal, null],
    ['평균 MTTR', '' + avgMttr, 'h', C.blue, null],
    ['설비 가용도', '' + avgAvail, '%', C.ink, null],
    ['총 고장 건수', '' + totalFail, '건', C.ink, null],
    ['MTBF 개선(MoM)', '' + Math.abs(momMtbf), '%', C.ink, momMtbf],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">MTBF / MTTR 분석</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 분석 및 통계 리포트 / MTBF·MTTR 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <Sel value="최근 6개월" w={100} /><Sel value="전체 라인" w={92} />
          <ActionBar actions={['compare', 'download']} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPI.map(([l, v, u, c, delta]) => (
          <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[24px] font-extrabold tracking-tight tabular-nums" style={{ color: c }}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
              {delta != null && <span className="ml-0.5 text-[11px] font-bold" style={{ color: delta >= 0 ? C.ok : C.err }}>{delta >= 0 ? '▲' : '▼'}{Math.abs(delta)}%</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[1fr_300px]">
        <Card
          title="MTBF / MTTR 월별 추이"
          action={
            <div className="flex gap-3.5 text-[10.5px]">
              <span className="flex items-center gap-1.5 font-semibold text-ink2"><span className="h-[3px] w-2.5 rounded-sm" style={{ background: C.teal }} />MTBF (h)</span>
              <span className="flex items-center gap-1.5 font-semibold text-ink2"><span className="h-[3px] w-2.5 rounded-sm" style={{ background: C.blue }} />MTTR (h)</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[10.5px] font-bold text-ink3">MTBF — 평균 고장 간격</div>
              <LineChart series={[{ data: MM_MTBF, c: C.teal }]} labels={MM_MONTHS} h={150} area />
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-bold text-ink3">MTTR — 평균 수리 시간</div>
              <LineChart series={[{ data: MM_MTTR, c: C.blue }]} labels={MM_MONTHS} h={150} area />
            </div>
          </div>
        </Card>

        <Card title="설비 가용도">
          <div className="flex flex-col items-center">
            <Gauge value={avgAvail} max={100} label="평균 Availability (%)" size={150} color={C.teal} />
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {([['우수', 'ok'], ['양호', 'info'], ['주의', 'warn'], ['관리', 'err']] as const).map(([g, t]) => {
              const cnt = MM_EQ.filter((e) => grade(e) === g).length;
              return (
                <div key={g} className="flex items-center gap-2">
                  <Pill tone={t}>{g}</Pill>
                  <div className="h-1.5 flex-1 rounded-[3px]" style={{ background: C.bgDeep }}>
                    <div className="h-full rounded-[3px]" style={{ width: `${(cnt / MM_EQ.length) * 100}%`, background: TONE_C[t] }} />
                  </div>
                  <span className="w-6 text-right text-[11px] font-bold tabular-nums text-ink2">{cnt}대</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="설비별 MTBF / MTTR 상세" bodyClassName="p-0" action={<span className="text-[10px] text-ink3">분석 기간 가동시간 기준 · 내림차순(MTBF)</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {[['설비 / 라인', 'text-left'], ['가동시간(h)', 'text-right'], ['고장(건)', 'text-right'], ['MTBF', 'text-left'], ['수리시간(h)', 'text-right'], ['MTTR(h)', 'text-right'], ['가용도', 'text-right'], ['6개월 추이', 'text-center'], ['등급', 'text-center']].map(([h, al]) => (
                <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eqs.map((e, i) => {
              const mb = mtbf(e), mt = mttr(e), av = avail(e), g = grade(e);
              return (
                <tr key={e.name} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{e.name}</div><div className="mt-px text-[9.5px] text-ink3">{e.line}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{e.run.toLocaleString()}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: e.fail >= 9 ? C.err : e.fail >= 6 ? C.warn : C.ink2 }}>{e.fail}</td>
                  <td className="border-b border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-[7px] min-w-[56px] flex-1 rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: `${Math.min((mb / maxBars) * 100, 100)}%`, background: C.teal }} /></div>
                      <span className="w-[34px] text-right font-mono font-extrabold text-ink">{mb}</span>
                    </div>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{e.repair}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: mt >= 4 ? C.err : mt >= 3 ? C.warn : C.ink }}>{mt}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold" style={{ color: av >= 99 ? C.ink : C.warn }}>{av}%</td>
                  <td className="border-b border-border px-3 py-2.5 text-center align-middle"><span className="inline-block"><Sparkline data={e.trend} w={72} h={22} color={C.teal} /></span></td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={gradeTone(g)}>{g}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
          <span className="text-[10.5px] text-ink3">MTBF = 가동시간 ÷ 고장건수 · MTTR = 총 수리시간 ÷ 고장건수 · 가용도 = MTBF ÷ (MTBF + MTTR)</span>
          <span className="ml-auto text-[11px] text-ink3">최저 MTBF <b style={{ color: C.err }}>Clean 04호기 {mtbf(MM_EQ[7])}h</b> — 집중 관리 권고</span>
        </div>
      </Card>
    </div>
  );
}
