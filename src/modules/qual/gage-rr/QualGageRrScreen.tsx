import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';
import { useGageRrs } from '@/features/gageRr/useGageRrs';
import type { GageRr } from '@/domain/gageRr/schema';

const grrTone = (g: number): Tone => (g < 10 ? 'ok' : g <= 30 ? 'warn' : 'err');
const grrColor = (g: number) => ({ ok: C.ok, warn: C.warn, err: C.err }[grrTone(g) as 'ok' | 'warn' | 'err']);
const grrGrade = (g: number) => (g < 10 ? '적합' : g <= 30 ? '조건부' : '부적합');

function msaOf(s: GageRr) {
  const grr = Math.sqrt(s.ev ** 2 + s.av ** 2);
  const tv = Math.sqrt(grr ** 2 + s.pv ** 2);
  const pct = (x: number) => (x / tv) * 100;
  const ndc = Math.floor((1.41 * s.pv) / grr);
  return { grr, tv, ev: pct(s.ev), av: pct(s.av), grrP: pct(grr), pv: pct(s.pv), ndc };
}

/** Gage R&R (측정시스템 분석) — 와이어프레임 qual-gage-rr.jsx 정본. */
export default function QualGageRrScreen() {
  const { data: studies = [], isLoading } = useGageRrs();
  const [sel, setSel] = useState('MSA-2601-03');
  const cur = studies.find((s) => s.id === sel) || studies[0];

  const all = studies.map((s) => ({ s, m: msaOf(s) }));

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : 'MSA 분석 데이터가 없습니다.'}</div>;
  }

  const m = msaOf(cur);
  const okCnt = all.filter((a) => a.m.grrP < 10).length;
  const condCnt = all.filter((a) => a.m.grrP >= 10 && a.m.grrP <= 30).length;
  const ngCnt = all.filter((a) => a.m.grrP > 30).length;

  const bars: [string, number, string, string][] = [
    ['반복성 (EV)', m.ev, C.blue, '장비 자체 산포'],
    ['재현성 (AV)', m.av, C.teal, '작업자 간 산포'],
    ['Gage R&R', m.grrP, grrColor(m.grrP), '측정시스템 총 산포'],
    ['부품간 (PV)', m.pv, C.ink3, '실제 부품 편차'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Gage R&R (측정시스템 분석)</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 계측기·신뢰성 관리 / Gage R&R (측정시스템 분석)</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: 'MSA 등록', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['분석 대상', '' + studies.length, '건', C.ink],
        ['적합 (<10%)', '' + okCnt, '건', C.ok],
        ['조건부 (10~30%)', '' + condCnt, '건', C.warn],
        ['부적합 (>30%)', '' + ngCnt, '건', C.err],
        ['NDC 기준', '5', '↑', C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.35fr_1.3fr]">
        {/* 목록 */}
        <Card title="측정시스템 분석 목록" bodyClassName="p-0">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['장비 / 특성', 'text-left'], ['방법', 'text-center'], ['%GRR', 'text-center'], ['NDC', 'text-center'], ['판정', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map(({ s, m }, i) => {
                const on = s.id === sel;
                return (
                  <tr key={s.id} onClick={() => setSel(s.id)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{s.char}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{s.gage} · {s.gid}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center text-[9.5px] text-ink2">{s.method}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center font-mono font-extrabold" style={{ color: grrColor(m.grrP) }}>{m.grrP.toFixed(1)}%</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center font-mono font-bold" style={{ color: m.ndc >= 5 ? C.ink : C.err }}>{m.ndc}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={grrTone(m.grrP)} solid={grrTone(m.grrP) === 'err'}>{grrGrade(m.grrP)}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 결과 */}
        <Card title="MSA 분석 결과" bodyClassName="p-0" action={<Pill tone={grrTone(m.grrP)} solid={grrTone(m.grrP) === 'err'}>{grrGrade(m.grrP)}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="text-[14.5px] font-extrabold text-ink">{cur.char} <span className="text-[10px] font-semibold text-ink3">{cur.unit}</span></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.gage} · {cur.method} · {cur.date}</div>
          </div>

          <div className="flex gap-3 border-b border-border px-4 py-3.5">
            <div className="flex-1 rounded-[10px] py-3 text-center" style={{ background: grrColor(m.grrP) + '12', border: `1.5px solid ${grrColor(m.grrP)}` }}>
              <div className="font-mono text-[28px] font-extrabold leading-none" style={{ color: grrColor(m.grrP) }}>{m.grrP.toFixed(1)}<span className="text-[14px]">%</span></div>
              <div className="mt-1 text-[9px] text-ink3">% Gage R&R (Study Var)</div>
            </div>
            <div className="flex-1 rounded-[10px] py-3 text-center" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>
              <div className="font-mono text-[28px] font-extrabold leading-none" style={{ color: m.ndc >= 5 ? C.ink : C.err }}>{m.ndc}</div>
              <div className="mt-1 text-[9px] text-ink3">NDC (구별 범주, ≥5)</div>
            </div>
          </div>

          <div className="flex border-b border-border px-4 py-3">
            {[['작업자', cur.ops + '명'], ['부품', cur.parts + '개'], ['측정 횟수', cur.trials + '회'], ['공차', cur.tol + ' ' + cur.unit]].map(([k, v], i, a) => (
              <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className="font-mono text-[12px] font-extrabold text-ink">{v}</div>
                <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
              </div>
            ))}
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-3 text-[10.5px] font-bold text-ink3">분산 성분 (% Study Variation)</div>
            <div className="flex flex-col gap-2.5">
              {bars.map(([lbl, v, c, sub], i) => (
                <div key={i}>
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className="text-[10.5px] font-bold text-ink">{lbl} <span className="text-[8.5px] font-normal text-ink3">{sub}</span></span>
                    <span className="font-mono text-[10.5px] font-extrabold" style={{ color: c }}>{v.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: Math.min(v, 100) + '%', background: c }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <div className="flex flex-1 items-center gap-2 rounded-[9px] px-3 py-2.5" style={{ background: grrTone(m.grrP) === 'ok' ? C.tealSoft : grrTone(m.grrP) === 'warn' ? '#fef6ec' : '#fdf1ef' }}>
              <span className="text-[14px]">{grrTone(m.grrP) === 'ok' ? '✓' : '⚠'}</span>
              <span className="text-[10px] font-bold leading-snug" style={{ color: grrColor(m.grrP) }}>
                {m.grrP < 10 ? '측정시스템 적합 — 양산 적용 가능' : m.grrP <= 30 ? `조건부 수용 — 용도·비용 고려 판단${m.ndc < 5 ? ' · NDC 부족' : ''}` : `부적합 (%GRR ${m.grrP.toFixed(1)}, NDC ${m.ndc}) — 측정시스템 개선 필요`}
              </span>
            </div>
            <button className="h-10 shrink-0 rounded-lg px-3.5 text-[12px] font-bold text-white" style={{ background: C.navy }}>상세 리포트</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
