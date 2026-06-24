import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { useEquipParams } from '@/features/equipParam/useEquipParams';
import type { EquipParam } from '@/domain/equipParam/schema';

const EQ_ORDER: [string, string, string][] = [
  ['EQ-CMP02', 'CMP 02호기', '가동'], ['EQ-ETCH01', 'Etch 01호기', '대기'], ['EQ-PHO05', 'Photo 05호기', '가동'],
  ['EQ-DEP03', 'Depo 03호기', '정지'], ['EQ-IMP02', 'Implant 02호기', '가동'], ['EQ-OVEN05', 'Thermal 05호기', '고장'], ['EQ-CLN04', 'Clean 04호기', '가동'],
];

const stDot = (s: string) => (s === '가동' ? '#1f9d6b' : s === '대기' ? '#3a6ee0' : s === '정지' ? '#ef8f43' : '#e0564f');

type Status = '정상' | '경고' | '이탈';
function paramStatus(cur: number, lsl: number, usl: number): Status {
  if (cur < lsl || cur > usl) return '이탈';
  const rng = usl - lsl;
  const margin = rng * 0.15;
  if (cur < lsl + margin || cur > usl - margin) return '경고';
  return '정상';
}
const PS: Record<Status, { c: string; tone: Tone }> = {
  정상: { c: '#1f9d6b', tone: 'ok' },
  경고: { c: '#ef8f43', tone: 'warn' },
  이탈: { c: '#e0564f', tone: 'err' },
};

/* 12-point realtime trend ending at cur */
function genSeries(name: string, cur: number, target: number, lsl: number, usl: number): number[] {
  let seed = name.split('').reduce((s, c) => s + c.charCodeAt(0), 7);
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280 - 0.5;
  };
  const amp = (usl - lsl) * 0.12;
  const arr = Array.from({ length: 11 }, () => +(target + rnd() * amp * 2).toFixed(3));
  arr.push(cur);
  return arr;
}

/** 설비 파라미터·조건 현황 — 와이어프레임 equip-param.jsx 정본. */
export default function EquipParamScreen() {
  const { data: rows = [], isLoading } = useEquipParams();
  const [eq, setEq] = useState('EQ-CMP02');
  const [pi, setPi] = useState(0);
  /** 설비코드 → 도큐먼트 맵(인라인 PARAMS 대체). */
  const byCode = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.code, r])) as Record<string, EquipParam>,
    [rows],
  );
  const d = byCode[eq];
  useEffect(() => { setPi(0); }, [eq]);

  if (!d) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '설비 파라미터 데이터가 없습니다.'}</div>;
  }

  const stat = d.p.map((p) => paramStatus(p[5], p[3], p[4]));
  const counts = {
    정상: stat.filter((s) => s === '정상').length,
    경고: stat.filter((s) => s === '경고').length,
    이탈: stat.filter((s) => s === '이탈').length,
  };
  const cur = d.p[pi];
  const series = genSeries(cur[0], cur[5], cur[2], cur[3], cur[4]);

  const chartMax = cur[4] + (cur[4] - cur[3]) * 0.25;
  const H = 190, padT = 10, ih = H - 24 - padT;
  const yPct = (v: number) => ((padT + ih - (v / chartMax) * ih) / H) * 100;

  return (
    <div className="flex flex-col gap-3.5">
      <style>{`@keyframes pmPulse{0%,100%{opacity:1}50%{opacity:.3}} .pm-pulse{animation:pmPulse 1.4s infinite}`}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비 파라미터 · 조건 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 상태 모니터링 / 설비 파라미터·조건 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-ink3"><span className="pm-pulse h-[7px] w-[7px] rounded-full bg-ok" />LIVE · 2초 갱신</span>
          <span className="font-mono text-[12px] font-bold text-ink">14:35:02</span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[210px_1fr]">
        {/* 설비 목록 */}
        <Card title="설비 선택" bodyClassName="p-1.5" action={<span className="text-[10px] text-ink3">{EQ_ORDER.length}대</span>}>
          <div className="flex flex-col gap-px">
            {EQ_ORDER.map(([code, name, st]) => {
              const on = code === eq;
              const out = (byCode[code]?.p ?? []).filter((p) => paramStatus(p[5], p[3], p[4]) === '이탈').length;
              return (
                <button
                  key={code}
                  onClick={() => setEq(code)}
                  className="flex items-center gap-2 rounded-r-[7px] px-2.5 py-2 text-left"
                  style={{ background: on ? 'var(--color-teal-soft)' : undefined, borderLeft: on ? '3px solid var(--color-teal)' : '3px solid transparent' }}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stDot(st) }} />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className={`truncate text-[11.5px] ${on ? 'font-extrabold text-teal' : 'font-semibold text-ink'}`}>{name}</span>
                    <span className="font-mono text-[9.5px] text-ink3">{code}</span>
                  </span>
                  {out > 0 && <span className="rounded-full bg-danger px-1.5 py-px text-[9px] font-extrabold text-white">{out}</span>}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          {/* 현재 운전 조건 */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-panel px-[18px] py-3.5">
            {([['레시피', d.recipe, true], ['진행 LOT', d.lot, true], ['공정 STEP', d.step, false]] as const).map(([k, v, mono], i) => (
              <div key={k} className={`flex flex-col gap-0.5 pr-[18px] ${i < 2 ? 'border-r border-border' : ''}`}>
                <span className="text-[10px] font-semibold text-ink3">{k}</span>
                <span className={`text-[13px] font-bold text-ink ${mono ? 'font-mono' : ''}`}>{v}</span>
              </div>
            ))}
            <div className="ml-auto flex gap-2">
              {(['정상', '경고', '이탈'] as Status[]).map((l) => (
                <div key={l} className="flex min-w-[48px] flex-col items-center gap-px rounded-[9px] px-3 py-1.5" style={{ background: PS[l].c + '14' }}>
                  <span className="text-[18px] font-extrabold leading-none" style={{ color: PS[l].c }}>{counts[l]}</span>
                  <span className="text-[9.5px] font-semibold text-ink3">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 파라미터 모니터 카드 */}
          <Card title="공정 파라미터 모니터" action={<span className="text-[10.5px] text-ink3">현재값 · 설정값 · 관리한계(LSL~USL)</span>}>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {d.p.map((p, i) => {
                const [name, unit, target, lsl, usl, val] = p;
                const s = stat[i];
                const tone = PS[s];
                const frac = Math.max(0, Math.min(1, (val - lsl) / (usl - lsl)));
                const tfrac = (target - lsl) / (usl - lsl);
                const on = i === pi;
                return (
                  <button
                    key={i}
                    onClick={() => setPi(i)}
                    className="flex flex-col gap-2 rounded-[10px] p-3 text-left"
                    style={{ border: `1px solid ${on ? 'var(--color-teal)' : 'var(--color-border)'}`, background: on ? 'var(--color-teal-soft)' : 'var(--color-panel)', boxShadow: on ? '0 0 0 1px var(--color-teal)' : 'none' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-ink">{name}</span>
                      <span className="h-2 w-2 rounded-full" style={{ background: tone.c }} />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[21px] font-extrabold tabular-nums tracking-tight" style={{ color: tone.c }}>{val}</span>
                      <span className="text-[10px] font-semibold text-ink3">{unit}</span>
                      <span className="ml-auto text-[10px] text-ink3">설정 {target}</span>
                    </div>
                    {/* range bar */}
                    <div className="relative mt-0.5 h-1.5 rounded-[3px] bg-bg-deep">
                      <div className="absolute h-2.5 w-0.5 bg-ink3" style={{ left: `${tfrac * 100}%`, top: -2, transform: 'translateX(-1px)' }} />
                      <div className="absolute h-3 w-2.5 rounded-[3px] border-2 border-white" style={{ left: `${frac * 100}%`, top: -3, background: tone.c, transform: 'translateX(-5px)' }} />
                    </div>
                    <div className="flex items-center justify-between font-mono text-[9px] text-ink3">
                      <span>{lsl}</span><Pill tone={tone.tone}>{s}</Pill><span>{usl}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 선택 파라미터 실시간 추이 */}
          <Card
            title={`${cur[0]} 실시간 추이`}
            action={
              <div className="flex gap-3.5 text-[11px]">
                <span className="flex items-center gap-1.5 text-ink2"><span className="h-[3px] w-3 rounded-sm" style={{ background: PS[stat[pi]].c }} />측정값</span>
                <span className="flex items-center gap-1.5 text-ink2"><span className="w-3 border-t-2 border-dashed border-ink3" />설정 {cur[2]}{cur[1]}</span>
                <span className="flex items-center gap-1.5 text-ink2"><span className="w-3 border-t-2 border-dashed border-danger" />관리한계</span>
              </div>
            }
          >
            <div className="relative">
              <LineChart series={[{ data: series, c: PS[stat[pi]].c }]} labels={['', '', '', '', '', '', '', '', '', '', '', 'now']} w={900} h={H} area max={chartMax} />
              {/* control limit overlays */}
              <div className="pointer-events-none absolute inset-0">
                {([[cur[4], '#e0564f', 'USL'], [cur[2], '#94a0b8', '설정'], [cur[3], '#e0564f', 'LSL']] as const).map(([v, c, lb], i) => (
                  <div key={i} className="absolute border-t-[1.5px] border-dashed" style={{ left: 30, right: 10, top: `${yPct(v)}%`, borderColor: c, opacity: 0.7 }}>
                    <span className="absolute right-0 -top-[7px] bg-panel px-[3px] text-[8.5px] font-bold" style={{ color: c }}>{lb} {v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
