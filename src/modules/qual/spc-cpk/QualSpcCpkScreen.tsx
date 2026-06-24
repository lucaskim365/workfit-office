import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';
import { useSpcCapabilities } from '@/features/spcCapability/useSpcCapabilities';
import type { SpcCapability } from '@/domain/spcCapability/schema';

const CPK_JIT = [0.86, 1.05, 0.94, 1.12, 0.9, 1.08, 1.0, 0.95, 1.07, 0.91, 1.04, 0.97, 0.88];
const cpkTone = (v: number): Tone => (v >= 1.33 ? 'ok' : v >= 1.0 ? 'warn' : 'err');
const cpkColor = (v: number) => ({ ok: C.ok, warn: C.warn, err: C.err }[cpkTone(v) as 'ok' | 'warn' | 'err']);
const cpkGrade = (v: number) => (v >= 1.67 ? '우수' : v >= 1.33 ? '양호' : v >= 1.0 ? '주의' : '부족');

function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

type Char = SpcCapability;

function capOf(c: Char) {
  const cp = (c.usl - c.lsl) / (6 * c.sigma);
  const cpu = (c.usl - c.mean) / (3 * c.sigma);
  const cpl = (c.mean - c.lsl) / (3 * c.sigma);
  const cpk = Math.min(cpu, cpl);
  const ppmU = (1 - phi((c.usl - c.mean) / c.sigma)) * 1e6;
  const ppmL = phi((c.lsl - c.mean) / c.sigma) * 1e6;
  const ppm = Math.round(ppmU + ppmL);
  const sigmaLvl = 3 * cpk + 1.5;
  return { cp, cpk, cpu, cpl, ppm, sigmaLvl, pp: cp * 0.96, ppk: cpk * 0.95 };
}

function Histogram({ c }: { c: Char }) {
  const W = 540, H = 230, padL = 30, padR = 16, padT = 16, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  const lo = Math.min(c.lsl, c.mean - 4 * c.sigma) - (c.usl - c.lsl) * 0.06;
  const hi = Math.max(c.usl, c.mean + 4 * c.sigma) + (c.usl - c.lsl) * 0.06;
  const xS = (v: number) => padL + ((v - lo) / (hi - lo)) * iw;
  const nb = 13;
  const bw = (hi - lo) / nb;
  const pdf = (x: number) => Math.exp(-0.5 * ((x - c.mean) / c.sigma) ** 2);
  const counts = Array.from({ length: nb }, (_, i) => pdf(lo + bw * (i + 0.5)) * CPK_JIT[i]);
  const maxC = Math.max(...counts);
  const fmt = (v: number) => v.toFixed(c.unit === 'mm' ? 3 : 1);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <rect x={xS(lo)} y={padT} width={Math.max(0, xS(c.lsl) - xS(lo))} height={ih} fill="#fdecea" opacity="0.6" />
      <rect x={xS(c.usl)} y={padT} width={Math.max(0, xS(hi) - xS(c.usl))} height={ih} fill="#fdecea" opacity="0.6" />
      {counts.map((ct, i) => {
        const bh = (ct / maxC) * ih * 0.92;
        const x0 = xS(lo + bw * i), x1 = xS(lo + bw * (i + 1));
        const center = lo + bw * (i + 0.5);
        const out = center < c.lsl || center > c.usl;
        return <rect key={i} x={x0 + 1} y={padT + ih - bh} width={Math.max(1, x1 - x0 - 2)} height={bh} rx="1.5" fill={out ? C.err : '#8ab4f8'} opacity={out ? 0.7 : 0.85} />;
      })}
      <polyline points={Array.from({ length: 80 }, (_, i) => { const x = lo + (hi - lo) * (i / 79); return `${xS(x)},${padT + ih - pdf(x) * ih * 0.92}`; }).join(' ')} fill="none" stroke={C.navy} strokeWidth="2" strokeLinejoin="round" />
      {([['LSL', c.lsl, C.err], ['USL', c.usl, C.err], ['T', c.target, C.ink3], ['x̄', c.mean, C.teal]] as const).map(([lbl, v, col], i) => (
        <g key={i}>
          <line x1={xS(v)} y1={padT - 2} x2={xS(v)} y2={padT + ih} stroke={col} strokeWidth={lbl === 'x̄' ? 2 : 1.4} strokeDasharray={lbl === 'T' ? '2 3' : lbl === 'x̄' ? '0' : '5 3'} />
          <text x={xS(v)} y={padT - 5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={col}>{lbl}</text>
          <text x={xS(v)} y={H - 16} textAnchor="middle" fontSize="7.5" fill={C.ink3}>{fmt(v)}</text>
        </g>
      ))}
      <line x1={padL} y1={padT + ih} x2={W - padR} y2={padT + ih} stroke={C.borderHi} strokeWidth="1" />
      <text x={W - padR} y={H - 4} textAnchor="end" fontSize="8" fill={C.ink3}>측정값 ({c.unit})</text>
    </svg>
  );
}

/** 공정능력 지수(Cp, Cpk) 분석 — 와이어프레임 qual-spc-cpk.jsx 정본. */
export default function QualSpcCpkScreen() {
  const { data: chars = [], isLoading } = useSpcCapabilities();
  const [sel, setSel] = useState('TRQ');
  const cur = chars.find((c) => c.id === sel) || chars[0];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '분석 대상 특성이 없습니다.'}</div>;
  }

  const cap = capOf(cur);

  const all = chars.map((c) => ({ c, cap: capOf(c) }));
  const good = all.filter((a) => a.cap.cpk >= 1.33).length;
  const weak = all.filter((a) => a.cap.cpk < 1.0).length;
  const cpkAvg = (all.reduce((s, a) => s + a.cap.cpk, 0) / all.length).toFixed(2);
  const stats: [string, string][] = [['표본수 n', '' + cur.n], ['평균 x̄', cur.mean.toFixed(cur.unit === 'mm' ? 3 : 2)], ['표준편차 σ', cur.sigma.toFixed(cur.unit === 'mm' ? 4 : 3)], ['규격', `${cur.lsl}~${cur.usl}`], ['시그마 수준', cap.sigmaLvl.toFixed(1) + 'σ'], ['예상 불량', cap.ppm.toLocaleString() + ' PPM']];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공정능력 지수(Cp, Cpk) 분석</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 통계적 공정관리(SPC) / 공정능력 지수(Cp, Cpk) 분석</p>
        </div>
        <ActionBar actions={[{ icon: 'compare', label: '기간 비교' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['분석 특성', '' + chars.length, '개', C.ink],
        ['능력 양호 (Cpk≥1.33)', '' + good, '개', C.ok],
        ['능력 부족 (Cpk<1.0)', '' + weak, '개', C.err],
        ['평균 Cpk', cpkAvg, '', C.blue],
        ['목표 Cpk', '1.33', '↑', C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_2fr]">
        {/* 특성 목록 */}
        <Card title="분석 대상 특성" bodyClassName="p-0">
          <div className="flex flex-col">
            {all.map(({ c, cap }, i) => {
              const on = c.id === sel;
              return (
                <div key={c.id} onClick={() => setSel(c.id)} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: i < all.length - 1 ? `1px solid ${C.border}` : 'none', background: on ? C.tealSoft : '#fff', borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold" style={{ color: on ? C.teal : C.ink }}>{c.char}</div>
                    <div className="mt-0.5 text-[9px] text-ink3">{c.prod} · {c.proc}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[16px] font-extrabold leading-none" style={{ color: cpkColor(cap.cpk) }}>{cap.cpk.toFixed(2)}</div>
                    <div className="mt-0.5 text-[8px] text-ink3">Cpk · {cpkGrade(cap.cpk)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 능력 분석 */}
        <Card title={`${cur.char} 공정능력 분석`} bodyClassName="p-0" action={<Pill tone={cpkTone(cap.cpk)} solid={cpkTone(cap.cpk) === 'err'}>{cpkGrade(cap.cpk)}</Pill>}>
          <div className="flex gap-2 border-b border-border px-4 py-3.5">
            {([['Cp', cap.cp, '잠재능력'], ['Cpk', cap.cpk, '실제능력'], ['Pp', cap.pp, '성능'], ['Ppk', cap.ppk, '성능(편차)']] as const).map(([k, v, sub]) => (
              <div key={k} className="flex-1 rounded-[9px] py-2.5 text-center" style={{ background: k === 'Cpk' ? cpkColor(cap.cpk) + '12' : C.panelAlt, border: k === 'Cpk' ? `1.5px solid ${cpkColor(cap.cpk)}` : `1px solid ${C.border}` }}>
                <div className="text-[9px] font-bold text-ink3">{k}</div>
                <div className="my-px font-mono text-[19px] font-extrabold" style={{ color: k === 'Cpk' || k === 'Cp' ? cpkColor(v) : C.ink }}>{v.toFixed(2)}</div>
                <div className="text-[8px] text-ink3">{sub}</div>
              </div>
            ))}
          </div>

          <div className="px-3 pb-1 pt-2"><Histogram c={cur} /></div>

          <div className="flex border-y border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
            {stats.map(([k, v], i, a) => (
              <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className="font-mono text-[11px] font-extrabold" style={{ color: k === '예상 불량' ? (cap.ppm > 1000 ? C.err : C.ink) : C.ink }}>{v}</div>
                <div className="mt-0.5 text-[8px] text-ink3">{k}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <div className="flex flex-1 items-center gap-2 rounded-[9px] px-3 py-2.5" style={{ background: cpkTone(cap.cpk) === 'ok' ? C.tealSoft : cpkTone(cap.cpk) === 'warn' ? '#fef6ec' : '#fdf1ef' }}>
              <span className="text-[14px]">{cpkTone(cap.cpk) === 'ok' ? '✓' : '⚠'}</span>
              <span className="text-[10.5px] font-bold leading-snug" style={{ color: cpkColor(cap.cpk) }}>
                {cap.cpk >= 1.33 ? '공정능력 충분 — 현 관리수준 유지' : cap.cpk >= 1.0 ? '능력 부족 위험 — 공정 중심 조정·산포 저감 필요' : `능력 미달 (Cpk ${cap.cpk.toFixed(2)}) — 공정 개선/100% 검사 검토. ${cap.cpu < cap.cpl ? '상한측' : '하한측'} 치우침.`}
              </span>
            </div>
            <button className="h-10 shrink-0 rounded-lg px-4 text-[12px] font-bold text-white" style={{ background: C.navy }}>개선 과제 등록</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
