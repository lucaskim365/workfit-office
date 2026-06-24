import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C, KpiGrid } from '../_qual';
import { useSpcCharts } from '@/features/spcChart/useSpcCharts';
import type { SpcChart } from '@/domain/spcChart/schema';

const SPC_ST: Record<string, Tone> = { 안정: 'ok', 주의: 'warn', 이탈: 'err' };

function SpcChart({ c }: { c: SpcChart }) {
  const W = 560, padL = 46, padR = 14;
  const N = c.mean.length;
  const xH = 150, rH = 96, gap = 16, topPad = 12;
  const iw = W - padL - padR;
  const x = (i: number) => padL + (iw / (N - 1)) * i;
  const fmt = (v: number) => v.toFixed(c.unit === 'g' || c.unit === 'N·m' ? 1 : 3);

  const panel = (vals: number[], ucl: number, cl: number, lcl: number, y0: number, ph: number) => {
    const margin = (ucl - lcl) * 0.35 || 1;
    const top = ucl + margin, bot = lcl - margin;
    const yy = (v: number) => y0 + ph - ((v - bot) / (top - bot)) * ph;
    return { yy, lines: [['UCL', ucl, C.err], ['CL', cl, C.ink3], ['LCL', lcl, C.err]] as [string, number, string][], pts: vals.map((v, i) => ({ x: x(i), y: yy(v), out: v > ucl || v < lcl })) };
  };

  const xb = panel(c.mean, c.xUcl, c.xCl, c.xLcl, topPad, xH);
  const rPanelY = topPad + xH + 34 + gap;
  const rb = panel(c.rng, c.rUcl, c.rCl, 0, rPanelY, rH);
  const H = rPanelY + rH + 26;

  const drawPanel = (p: ReturnType<typeof panel>, title: string, titleY: number) => (
    <g>
      <text x={padL} y={titleY} fontSize="9.5" fontWeight="800" fill={C.ink2}>{title} 관리도</text>
      {p.lines.map(([lbl, v, col], i) => (
        <g key={i}>
          <line x1={padL} y1={p.yy(v)} x2={W - padR} y2={p.yy(v)} stroke={col} strokeWidth="1" strokeDasharray={lbl === 'CL' ? '2 3' : '5 3'} />
          <text x={padL - 5} y={p.yy(v) + 3} textAnchor="end" fontSize="8" fontWeight="700" fill={col}>{lbl}</text>
          <text x={W - padR} y={p.yy(v) - 3} textAnchor="end" fontSize="7.5" fill={C.ink3}>{fmt(v)}</text>
        </g>
      ))}
      <polyline points={p.pts.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={C.navy} strokeWidth="1.6" strokeLinejoin="round" />
      {p.pts.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={pt.out ? 4 : 2.8} fill={pt.out ? C.err : '#fff'} stroke={pt.out ? C.err : C.navy} strokeWidth="1.6" />)}
    </g>
  );

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {drawPanel(xb, 'X̄', topPad - 2)}
      {drawPanel(rb, 'R', rPanelY - 8)}
      {c.mean.map((_, i) => (i % 3 === 0 || i === N - 1 ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="7.5" fill={C.ink3}>#{i + 1}</text> : null))}
    </svg>
  );
}

/** 관리도(Control Chart) 모니터링 — 와이어프레임 qual-spc-chart.jsx 정본. */
export default function QualSpcChartScreen() {
  const { data: charts = [], isLoading } = useSpcCharts();
  const [sel, setSel] = useState('BRK-OD');
  const cur = charts.find((c) => c.id === sel) || charts[0];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '모니터링 특성이 없습니다.'}</div>;
  }

  const ooc = charts.filter((c) => c.state === '이탈').length;
  const ruleViol = charts.reduce((s, c) => s + c.viol.length, 0);
  const stable = charts.filter((c) => c.state === '안정').length;
  const cpkAvg = (charts.reduce((s, c) => s + c.cpk, 0) / charts.length).toFixed(2);
  const fmt = (v: number) => v.toFixed(cur.unit === 'g' || cur.unit === 'N·m' ? 1 : 3);
  const stats: [string, number][] = [['X̄ UCL', cur.xUcl], ['X̄ CL', cur.xCl], ['X̄ LCL', cur.xLcl], ['R̄', cur.rCl], ['R UCL', cur.rUcl], ['Cpk', cur.cpk]];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">관리도(Control Chart) 모니터링</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 통계적 공정관리(SPC) / 관리도(Control Chart) 모니터링</p>
        </div>
        <ActionBar actions={[{ icon: 'compare', label: '관리한계 재산정' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['모니터링 특성', '' + charts.length, '개', C.ink],
        ['관리이탈(OOC)', '' + ooc, '개', C.err],
        ['규칙 위반', '' + ruleViol, '건', C.warn],
        ['관리상태 안정', '' + stable, '개', C.ok],
        ['평균 Cpk', cpkAvg, '', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_2fr]">
        {/* 특성 목록 */}
        <Card title="모니터링 특성" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{charts.length}개</span>}>
          <div className="flex flex-col">
            {charts.map((c, i) => {
              const on = c.id === sel;
              return (
                <div key={c.id} onClick={() => setSel(c.id)} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: i < charts.length - 1 ? `1px solid ${C.border}` : 'none', background: on ? C.tealSoft : '#fff', borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="text-[12px] font-extrabold" style={{ color: on ? C.teal : C.ink }}>{c.char}</span><Pill tone={SPC_ST[c.state]} solid={c.state === '이탈'}>{c.state}</Pill></div>
                    <div className="mt-0.5 text-[9px] text-ink3">{c.prod} · {c.proc}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block align-middle"><Sparkline data={c.mean} w={50} h={20} color={c.state === '이탈' ? C.err : c.state === '주의' ? C.warn : C.teal} /></span>
                    <div className="mt-px font-mono text-[9px] font-bold" style={{ color: c.cpk >= 1.33 ? C.ok : C.warn }}>Cpk {c.cpk}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 관리도 */}
        <Card title={`${cur.char} 관리도 (X̄–R, n=${cur.n})`} bodyClassName="p-0" action={<Pill tone={SPC_ST[cur.state]} solid={cur.state === '이탈'}>{cur.state}</Pill>}>
          <div className="flex border-b border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
            {stats.map(([k, v], i, a) => (
              <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className="font-mono text-[11.5px] font-extrabold" style={{ color: k === 'Cpk' ? (cur.cpk >= 1.33 ? C.ok : C.warn) : C.ink }}>{k === 'Cpk' ? v : fmt(v)}</div>
                <div className="mt-0.5 text-[8px] text-ink3">{k}{i < 5 ? ` (${cur.unit})` : ''}</div>
              </div>
            ))}
          </div>

          <div className="px-3 pb-1 pt-3"><SpcChart c={cur} /></div>

          <div className="border-t border-border px-4 py-3">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">관리 규칙 위반 (Western Electric)</div>
            {cur.viol.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: C.tealSoft }}>
                <span className="text-[13px]">✓</span><span className="text-[11px] font-bold" style={{ color: C.ok }}>관리 상태 안정 — 규칙 위반 없음</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {cur.viol.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: v[2] === 'err' ? '#fdf1ef' : '#fef6ec', border: `1px solid ${v[2] === 'err' ? C.err : C.warn}33` }}>
                    <span className="min-w-[48px] font-mono text-[9.5px] font-extrabold" style={{ color: v[2] === 'err' ? C.err : '#b5731f' }}>{v[0]}</span>
                    <span className="text-[11px] font-bold text-ink2">{v[1]}</span>
                    <span className="ml-auto"><Pill tone={v[2] === 'err' ? 'err' : 'warn'} solid={v[2] === 'err'}>{v[2] === 'err' ? 'OOC' : '규칙위반'}</Pill></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
