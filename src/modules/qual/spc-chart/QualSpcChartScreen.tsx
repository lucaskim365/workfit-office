import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C, KpiGrid } from '../_qual';

const SPC_ST: Record<string, Tone> = { 안정: 'ok', 주의: 'warn', 이탈: 'err' };

interface Char { id: string; prod: string; code: string; char: string; unit: string; proc: string; n: number; state: string; cpk: number; xUcl: number; xCl: number; xLcl: number; rUcl: number; rCl: number; mean: number[]; rng: number[]; viol: [string, string, string][] }
const SPC_CHARS: Char[] = [
  { id: 'BRK-OD', prod: '브래킷 ASSY-A', code: 'FG-BRK-A', char: '외경(O.D)', unit: 'mm', proc: 'CNC-03', n: 5, state: '이탈', cpk: 1.08, xUcl: 25.043, xCl: 25.008, xLcl: 24.973, rUcl: 0.097, rCl: 0.046, mean: [25.0, 25.01, 24.99, 25.0, 25.02, 24.99, 25.01, 25.0, 24.99, 25.01, 25.02, 25.01, 25.03, 25.02, 25.04, 25.05, 25.03, 25.04], rng: [0.04, 0.05, 0.03, 0.06, 0.04, 0.05, 0.03, 0.04, 0.05, 0.04, 0.06, 0.05, 0.04, 0.07, 0.05, 0.06, 0.08, 0.05], viol: [['#16', '1점 관리상한 이탈 (Rule 1)', 'err'], ['#13~#18', '연속 6점 상승 추세 (Rule 3)', 'warn']] },
  { id: 'CVR-T', prod: '커버 플레이트 B', code: 'FG-CVR-B', char: '두께(t)', unit: 'mm', proc: 'PRS-07', n: 5, state: '안정', cpk: 1.42, xUcl: 2.038, xCl: 2.001, xLcl: 1.964, rUcl: 0.085, rCl: 0.04, mean: [2.0, 2.01, 2.0, 1.99, 2.01, 2.0, 2.0, 2.01, 1.99, 2.0, 2.01, 2.0, 1.99, 2.0, 2.01, 2.0, 2.0, 1.99], rng: [0.04, 0.05, 0.03, 0.04, 0.05, 0.03, 0.04, 0.05, 0.04, 0.03, 0.05, 0.04, 0.04, 0.03, 0.05, 0.04, 0.03, 0.04], viol: [] },
  { id: 'HSG-WT', prod: '하우징 C-Type', code: 'FG-HSG-C', char: '중량', unit: 'g', proc: 'INJ-02', n: 5, state: '주의', cpk: 1.27, xUcl: 51.6, xCl: 50.1, xLcl: 48.6, rUcl: 3.5, rCl: 1.65, mean: [50.1, 49.8, 50.4, 50.2, 49.9, 50.3, 50.0, 50.5, 49.7, 50.2, 50.1, 49.9, 50.3, 50.0, 50.2, 49.8, 50.1, 50.0], rng: [1.5, 1.8, 1.4, 2.0, 1.6, 1.5, 1.7, 1.6, 3.6, 1.5, 1.8, 1.6, 1.4, 1.7, 1.5, 1.6, 1.5, 1.7], viol: [['#9', 'R관리도 관리상한 이탈 — 산포 증가 (Rule 1)', 'err']] },
  { id: 'TRQ', prod: '체결 토크', code: 'PROC-ASM', char: '토크', unit: 'N·m', proc: 'ASM-05', n: 5, state: '주의', cpk: 1.19, xUcl: 13.4, xCl: 12.0, xLcl: 10.6, rUcl: 3.2, rCl: 1.5, mean: [12.0, 11.9, 12.1, 11.8, 11.9, 11.7, 11.8, 11.6, 11.7, 11.5, 11.6, 11.7, 11.5, 11.6, 11.4, 11.6, 11.5, 11.7], rng: [1.4, 1.6, 1.3, 1.5, 1.4, 1.5, 1.3, 1.6, 1.4, 1.5, 1.3, 1.4, 1.5, 1.3, 1.6, 1.4, 1.5, 1.3], viol: [['#10~#17', '연속 8점 중심선 하측 (Rule 2) — 공정 평균 이동', 'warn']] },
];

function SpcChart({ c }: { c: Char }) {
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
  const [sel, setSel] = useState('BRK-OD');
  const cur = SPC_CHARS.find((c) => c.id === sel) || SPC_CHARS[0];

  const ooc = SPC_CHARS.filter((c) => c.state === '이탈').length;
  const ruleViol = SPC_CHARS.reduce((s, c) => s + c.viol.length, 0);
  const stable = SPC_CHARS.filter((c) => c.state === '안정').length;
  const cpkAvg = (SPC_CHARS.reduce((s, c) => s + c.cpk, 0) / SPC_CHARS.length).toFixed(2);
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
        ['모니터링 특성', '' + SPC_CHARS.length, '개', C.ink],
        ['관리이탈(OOC)', '' + ooc, '개', C.err],
        ['규칙 위반', '' + ruleViol, '건', C.warn],
        ['관리상태 안정', '' + stable, '개', C.ok],
        ['평균 Cpk', cpkAvg, '', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_2fr]">
        {/* 특성 목록 */}
        <Card title="모니터링 특성" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{SPC_CHARS.length}개</span>}>
          <div className="flex flex-col">
            {SPC_CHARS.map((c, i) => {
              const on = c.id === sel;
              return (
                <div key={c.id} onClick={() => setSel(c.id)} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: i < SPC_CHARS.length - 1 ? `1px solid ${C.border}` : 'none', background: on ? C.tealSoft : '#fff', borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
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
