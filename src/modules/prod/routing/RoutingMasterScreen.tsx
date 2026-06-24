import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';
import { type RoutingStep } from '@/domain/routing/schema';
import { useRoutings } from '@/features/routing/useRoutings';

const KIND_TONE: Record<RoutingStep['kind'], Tone> = { 가공: 'info', 검사: 'warn', 이동: 'mute' };
const KIND_C: Record<RoutingStep['kind'], string> = { 가공: T.blue, 검사: T.warn, 이동: T.ink3 };

/** 공정(Routing) 마스터 — 데이터: features/routing/useRoutings (header-line). */
export default function RoutingMasterScreen() {
  const [sel, setSel] = useState('CN-ASM-100');
  const { data: routings = [] } = useRoutings();
  const prod = routings.find((p) => p.code === sel) ?? routings[0];
  const ops = prod?.steps ?? [];
  const totalCt = ops.reduce((s, o) => s + o.ct, 0);
  const totalSetup = ops.reduce((s, o) => s + o.setup, 0);
  const maxCt = ops.length ? Math.max(...ops.map((o) => o.ct)) : 0;
  const bottleneck = ops.find((o) => o.ct === maxCt);
  const rolledYield = ops.reduce((s, o) => (s * o.yield) / 100, 1) * 100;

  const kpis: Array<[string, string, string, string]> = [
    ['등록 라우팅', String(routings.length), '종', 'text-ink'],
    ['공정 수', String(ops.length), 'OP', 'text-ink'],
    ['총 표준 C/T', String(totalCt), '초', 'text-teal'],
    ['병목 공정', bottleneck ? `${bottleneck.op} ${bottleneck.ct}s` : '-', '', 'text-danger'],
    ['누적 수율(RTY)', rolledYield.toFixed(1), '%', 'text-ink'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공정(Routing) 마스터</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산 기준정보 / 공정(Routing) 마스터</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '공정 추가', variant: 'primary' }, 'save', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c], i) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`font-extrabold tracking-tight tabular-nums ${c} ${i === 3 ? 'text-base' : 'text-2xl'}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[250px_1fr]">
        <Card title="제품 / 라우팅" bodyClassName="p-0">
          <div className="py-1.5">
            {routings.map((p) => {
              const on = p.code === sel;
              const cnt = p.steps.length;
              return (
                <button key={p.code} onClick={() => setSel(p.code)} className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{p.name}</div>
                    <div className="mt-0.5 font-mono text-[9.5px] text-ink3">{p.code} · {p.line}</div>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-blue-soft px-1.5 py-0.5 text-[9.5px] font-bold text-blue">Rev {p.rev}</span>
                    <div className="mt-1 text-[9px] text-ink3">{cnt} OP</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="공정 흐름도" action={<span className="text-[10.5px] text-ink3">{prod?.name} <span className="font-mono">· Rev {prod?.rev}</span></span>}>
            <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
              {ops.map((o, i) => {
                const isBn = o.ct === maxCt;
                return (
                  <Fragment key={o.op}>
                    <div className={`min-w-[96px] flex-1 rounded-[10px] border-[1.5px] p-2.5 ${isBn ? 'border-danger bg-[#fdecea]' : 'border-border bg-panel'}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-1.5">
                        <span className="font-mono text-[9.5px] font-extrabold text-ink3">{o.op}</span>
                        {isBn ? (
                          <span className="whitespace-nowrap rounded bg-danger px-1.5 py-px text-[8.5px] font-extrabold text-white">병목</span>
                        ) : (
                          <span className="h-[7px] w-[7px] rounded-sm" style={{ background: KIND_C[o.kind] }} />
                        )}
                      </div>
                      <div className="mb-1.5 text-[11.5px] font-bold leading-tight text-ink">{o.name}</div>
                      <div className={`font-mono text-[13px] font-extrabold ${isBn ? 'text-danger' : 'text-teal'}`}>{o.ct}s</div>
                      <div className="mt-0.5 truncate text-[9px] text-ink3">{o.eq}</div>
                    </div>
                    {i < ops.length - 1 && <div className="flex flex-shrink-0 items-center px-1 text-[14px] text-ink3">→</div>}
                  </Fragment>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5 text-[10.5px]">
              <span className="text-ink3">총 표준시간 <b className="font-mono text-ink">{totalCt}s</b> · Setup <b className="font-mono text-ink2">{totalSetup}분</b></span>
              <span className="text-ink3">라인 택트(병목) <b className="font-mono text-danger">{maxCt}s/EA</b></span>
              <div className="ml-auto flex gap-3">
                {(['가공', '검사'] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5 font-semibold text-ink2">
                    <span className="h-2 w-2 rounded-sm" style={{ background: KIND_C[k] }} />{k}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card title="공정 순서 상세" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {['공정', '구분', '작업장 / 설비', 'Setup(분)', '표준 C/T(초)', '인원', '공정수율'].map((h, i) => (
                      <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 || i === 6 ? 'text-right' : i === 1 || i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ops.map((o, i) => {
                    const isBn = o.ct === maxCt;
                    return (
                      <tr key={o.op} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                        <td className="border-b border-border px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-8 font-mono text-[9.5px] font-extrabold text-ink3">{o.op}</span>
                            <span className="font-bold text-ink">{o.name}</span>
                          </div>
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={KIND_TONE[o.kind]}>{o.kind}</Pill></td>
                        <td className="border-b border-border px-3 py-2.5">
                          <span className="font-mono text-[10.5px] text-ink2">{o.wc}</span>
                          <div className="mt-0.5 text-[9.5px] text-ink3">{o.eq}</div>
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{o.setup}</td>
                        <td className="border-b border-border px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 min-w-[70px] flex-1 rounded bg-bg-deep">
                              <div className="h-full rounded" style={{ width: `${(o.ct / maxCt) * 100}%`, background: isBn ? T.err : T.teal }} />
                            </div>
                            <span className={`w-8 text-right font-mono font-extrabold ${isBn ? 'text-danger' : 'text-ink'}`}>{o.ct}</span>
                          </div>
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-center font-mono text-ink2">{o.crew}명</td>
                        <td className={`border-b border-border px-3 py-2.5 text-right font-mono font-bold ${o.yield < 98 ? 'text-amber' : 'text-ink2'}`}>{o.yield}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border bg-panel-alt px-4 py-2.5">
              <span className="text-[10.5px] text-ink3">{ops.length}개 공정 · 누적 수율(RTY) <b className="text-ink2">{rolledYield.toFixed(1)}%</b></span>
              <span className="text-[11px] text-ink3">병목 <b className="text-danger">{bottleneck?.op} {bottleneck?.name}</b> — 라인 능력 결정 공정</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
