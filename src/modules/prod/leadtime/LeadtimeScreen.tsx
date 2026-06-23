import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Donut } from '@/shared/ui/charts/Donut';
import { ReadSelect } from '../_bits';
import { T } from '@/shared/theme/tokens';

const COMP = [
  { key: 'wait', label: '대기', c: T.warn },
  { key: 'setup', label: '셋업', c: T.c4 },
  { key: 'proc', label: '가공(VA)', c: T.teal },
  { key: 'insp', label: '검사', c: T.blue },
] as const;

interface Op {
  op: string;
  name: string;
  wait: number;
  setup: number;
  proc: number;
  insp: number;
}
const OPS: Op[] = [
  { op: 'OP10', name: '사출 성형', wait: 45, setup: 30, proc: 60, insp: 10 },
  { op: 'OP20', name: '디버링/검사', wait: 70, setup: 5, proc: 20, insp: 15 },
  { op: 'OP30', name: '터미널 압착', wait: 55, setup: 25, proc: 40, insp: 8 },
  { op: 'OP40', name: '본체 조립', wait: 120, setup: 10, proc: 90, insp: 12 },
  { op: 'OP50', name: '기능 검사', wait: 40, setup: 8, proc: 35, insp: 30 },
  { op: 'OP60', name: '포장', wait: 25, setup: 5, proc: 18, insp: 5 },
];

const total = (o: Op) => o.wait + o.setup + o.proc + o.insp;
const va = (o: Op) => Math.round((o.proc / total(o)) * 100);
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

function LtBar({ o, max }: { o: Op; max: number }) {
  const t = total(o);
  return (
    <div className="flex h-[22px] min-w-[40px] overflow-hidden rounded-[5px]" style={{ width: `${(t / max) * 100}%` }}>
      {COMP.map((c) => {
        const v = o[c.key];
        if (v <= 0) return null;
        return (
          <div key={c.key} title={`${c.label} ${v}분`} className="flex items-center justify-center" style={{ width: `${(v / t) * 100}%`, background: c.c }}>
            {v / t >= 0.18 && <span className={`font-mono text-[8.5px] font-bold ${c.key === 'setup' ? 'text-ink' : 'text-white'}`}>{v}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** 공정별 리드타임 분석 — 와이어프레임 leadtime.jsx 정본. */
export default function LeadtimeScreen() {
  const maxTotal = Math.max(...OPS.map(total));
  const grandTotal = OPS.reduce((s, o) => s + total(o), 0);
  const sumBy = (k: keyof Op) => OPS.reduce((s, o) => s + (o[k] as number), 0);
  const waitSum = sumBy('wait');
  const procSum = sumBy('proc');
  const vaEff = +((procSum / grandTotal) * 100).toFixed(1);
  const bottleneck = OPS.reduce((a, b) => (total(b) > total(a) ? b : a));
  const donut = COMP.map((c) => ({ name: c.label, v: sumBy(c.key), c: c.c }));

  const kpis: Array<[string, string, string, string]> = [
    ['총 생산 리드타임', (grandTotal / 60).toFixed(1), 'h', 'text-ink'],
    ['평균 대기시간', String(Math.round(waitSum / OPS.length)), '분', 'text-amber'],
    ['평균 가공시간', String(Math.round(procSum / OPS.length)), '분', 'text-teal'],
    ['가공 효율(VA)', String(vaEff), '%', vaEff < 40 ? 'text-amber' : 'text-teal'],
    ['병목 공정', `${bottleneck.op} ${total(bottleneck)}분`, '', 'text-danger'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공정별 리드타임 분석</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 추적·분석 / 공정별 리드타임 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <ReadSelect value="커넥터 어셈블리" w={120} />
          <ReadSelect value="최근 30일" w={92} />
          <ActionBar actions={['compare', 'download']} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c], i) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`font-extrabold tracking-tight tabular-nums ${c} ${i === 4 ? 'text-[15px]' : 'text-2xl'}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[1fr_300px]">
        <Card
          title="공정별 리드타임 분해"
          action={
            <div className="flex gap-3 text-[10px]">
              {COMP.map((c) => (
                <span key={c.key} className="flex items-center gap-1.5 font-semibold text-ink2">
                  <span className="h-[9px] w-[9px] rounded-sm" style={{ background: c.c }} />
                  {c.label}
                </span>
              ))}
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            {OPS.map((o) => {
              const isBn = o.op === bottleneck.op;
              return (
                <div key={o.op}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ink">
                      <span className="mr-1.5 font-mono text-[9.5px] text-ink3">{o.op}</span>{o.name}
                      {isBn && <span className="ml-2 rounded bg-danger px-1.5 py-px text-[8.5px] font-extrabold text-white">병목</span>}
                    </span>
                    <span className={`font-mono text-[11px] font-extrabold ${isBn ? 'text-danger' : 'text-ink'}`}>{fmtMin(total(o))}</span>
                  </div>
                  <LtBar o={o} max={maxTotal} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="시간 구성">
          <div className="flex flex-col items-center gap-3">
            <Donut data={donut} size={134} thickness={22} centerTop={`${vaEff}%`} centerSub="부가가치(VA)" />
            <div className="flex w-full flex-col gap-1.5">
              {donut.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: d.c }} />
                  <span className="flex-1 text-[11px] font-semibold text-ink2">{d.name}</span>
                  <span className="font-mono text-[11px] font-bold text-ink">{d.v}분</span>
                  <span className="w-[30px] text-right text-[9.5px] text-ink3">{Math.round((d.v / grandTotal) * 100)}%</span>
                </div>
              ))}
            </div>
            <div className="mt-0.5 flex w-full items-center gap-1.5 border-t border-border pt-2.5 text-[10px] text-ink2">
              <span className="text-[12px]">⚠</span>
              <span>대기시간이 전체의 <b className="text-amber">{Math.round((waitSum / grandTotal) * 100)}%</b> — 비부가가치 단축 여지 큼</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="공정별 리드타임 상세" action={<span className="text-[10px] text-ink3">단위: 분 · 가공효율 = 가공 ÷ 총 L/T</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['공정', '대기', '셋업', '가공', '검사', '총 L/T', '가공효율', '상태'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 1 && i <= 6 ? 'text-right' : i === 7 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OPS.map((o, i) => {
                const t = total(o);
                const v = va(o);
                const isBn = o.op === bottleneck.op;
                const st = isBn ? '병목' : o.wait / t >= 0.5 ? '대기과다' : v >= 45 ? '양호' : '정상';
                const tone: Tone = st === '병목' ? 'err' : st === '대기과다' ? 'warn' : st === '양호' ? 'ok' : 'info';
                return (
                  <tr key={o.op} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5"><span className="mr-1.5 font-mono text-[9.5px] text-ink3">{o.op}</span><b className="text-ink">{o.name}</b></td>
                    <td className={`border-b border-border px-3 py-2.5 text-right font-mono font-bold ${o.wait / t >= 0.5 ? 'text-amber' : 'text-ink2'}`}>{o.wait}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{o.setup}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-teal">{o.proc}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{o.insp}</td>
                    <td className={`border-b border-border px-3 py-2.5 text-right font-mono font-extrabold ${isBn ? 'text-danger' : 'text-ink'}`}>{t}</td>
                    <td className={`border-b border-border px-3 py-2.5 text-right font-mono font-bold ${v < 40 ? 'text-amber' : 'text-ink2'}`}>{v}%</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={tone}>{st}</Pill></td>
                  </tr>
                );
              })}
              <tr className="bg-panel-alt">
                <td className="border-b border-border px-3 py-2.5 font-extrabold text-ink">합계</td>
                <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-amber">{sumBy('wait')}</td>
                <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-ink2">{sumBy('setup')}</td>
                <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-teal">{sumBy('proc')}</td>
                <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-ink2">{sumBy('insp')}</td>
                <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-ink">{grandTotal}</td>
                <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-ink">{vaEff}%</td>
                <td className="border-b border-border px-3 py-2.5 text-center">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
