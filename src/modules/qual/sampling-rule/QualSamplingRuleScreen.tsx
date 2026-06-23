import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C } from '../_qual';

const SR_AQLS = [0.4, 0.65, 1.0, 1.5, 2.5, 4.0];
const SR_CODE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N'];
const SR_N: Record<string, number> = { A: 2, B: 3, C: 5, D: 8, E: 13, F: 20, G: 32, H: 50, J: 80, K: 125, L: 200, M: 315, N: 500, P: 800, Q: 1250, R: 2000 };
const SR_PLAN: Record<string, string[]> = {
  A: ['↓', '↓', '↓', '↓', '↓', '↓'], B: ['↓', '↓', '↓', '↓', '↓', '↓'], C: ['↓', '↓', '↓', '↓', '↓', '0/1'],
  D: ['↓', '↓', '↓', '↓', '0/1', '↓'], E: ['↓', '↓', '↓', '0/1', '↓', '1/2'], F: ['↓', '↓', '0/1', '↓', '1/2', '2/3'],
  G: ['↓', '0/1', '↓', '1/2', '2/3', '3/4'], H: ['0/1', '↓', '1/2', '2/3', '3/4', '5/6'], J: ['↓', '1/2', '2/3', '3/4', '5/6', '7/8'],
  K: ['1/2', '2/3', '3/4', '5/6', '7/8', '10/11'], L: ['2/3', '3/4', '5/6', '7/8', '10/11', '14/15'], M: ['3/4', '5/6', '7/8', '10/11', '14/15', '21/22'],
  N: ['5/6', '7/8', '10/11', '14/15', '21/22', '↓'],
};
interface LotRow { range: string; min: number; max: number; I: string; II: string; III: string }
const SR_LOTS: LotRow[] = [
  { range: '2 – 8', min: 2, max: 8, I: 'A', II: 'A', III: 'B' },
  { range: '9 – 15', min: 9, max: 15, I: 'A', II: 'B', III: 'C' },
  { range: '16 – 25', min: 16, max: 25, I: 'B', II: 'C', III: 'D' },
  { range: '26 – 50', min: 26, max: 50, I: 'C', II: 'D', III: 'E' },
  { range: '51 – 90', min: 51, max: 90, I: 'C', II: 'E', III: 'F' },
  { range: '91 – 150', min: 91, max: 150, I: 'D', II: 'F', III: 'G' },
  { range: '151 – 280', min: 151, max: 280, I: 'E', II: 'G', III: 'H' },
  { range: '281 – 500', min: 281, max: 500, I: 'F', II: 'H', III: 'J' },
  { range: '501 – 1,200', min: 501, max: 1200, I: 'G', II: 'J', III: 'K' },
  { range: '1,201 – 3,200', min: 1201, max: 3200, I: 'H', II: 'K', III: 'L' },
  { range: '3,201 – 10,000', min: 3201, max: 10000, I: 'J', II: 'L', III: 'M' },
  { range: '10,001 – 35,000', min: 10001, max: 35000, I: 'K', II: 'M', III: 'N' },
  { range: '35,001 – 150,000', min: 35001, max: 150000, I: 'L', II: 'N', III: 'P' },
  { range: '150,001 – 500,000', min: 150001, max: 500000, I: 'M', II: 'P', III: 'Q' },
  { range: '500,001 이상', min: 500001, max: Infinity, I: 'N', II: 'Q', III: 'R' },
];
interface RuleSet { id: string; name: string; std: string; level: string; severity: string; aql: number; products: number }
const SR_RULES: RuleSet[] = [
  { id: 'R-STD', name: '표준 보통검사', std: 'KS Q ISO 2859-1', level: 'II', severity: '보통', aql: 1.0, products: 48 },
  { id: 'R-OQC', name: '출하검사 AQL 1.0', std: 'KS Q ISO 2859-1', level: 'II', severity: '보통', aql: 1.0, products: 23 },
  { id: 'R-TIGHT', name: '까다로운 검사', std: 'MIL-STD-105E', level: 'II', severity: '까다로운', aql: 0.65, products: 12 },
  { id: 'R-REDU', name: '수월한 검사', std: 'MIL-STD-105E', level: 'I', severity: '수월한', aql: 1.5, products: 9 },
  { id: 'R-CRIT', name: '치명결함 AQL 0.40', std: 'MIL-STD-105E', level: 'III', severity: '까다로운', aql: 0.4, products: 7 },
  { id: 'R-FULL', name: '전수검사', std: '—', level: '—', severity: '전수', aql: 0, products: 5 },
];
const sevTone = (s: string): Tone => (s === '까다로운' ? 'err' : s === '수월한' ? 'info' : s === '전수' ? 'mute' : 'ok');

const letterFor = (lot: number, level: string) => {
  const row = SR_LOTS.find((r) => lot >= r.min && lot <= r.max);
  return row ? (row[level as 'I' | 'II' | 'III'] || '—') : '—';
};
function resolve(letter: string, aqlIdx: number): { letter: string; n: number; ac: number; re: number } | null {
  let ci = SR_CODE_ORDER.indexOf(letter);
  if (ci < 0) return null;
  for (let guard = 0; guard < 20; guard++) {
    const cell = SR_PLAN[SR_CODE_ORDER[ci]][aqlIdx];
    if (cell === '↓') { if (ci >= SR_CODE_ORDER.length - 1) return null; ci++; continue; }
    if (cell === '↑') { if (ci <= 0) return null; ci--; continue; }
    const [ac, re] = cell.split('/').map(Number);
    return { letter: SR_CODE_ORDER[ci], n: SR_N[SR_CODE_ORDER[ci]], ac, re };
  }
  return null;
}

function Seg({ value, options, onChange, w }: { value: string | number; options: (string | number)[]; onChange: (v: never) => void; w?: number }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border-hi bg-panel">
      {options.map((o, i) => {
        const on = o === value;
        return <button key={o} onClick={() => onChange(o as never)} className="px-2.5 py-1.5 text-[11px] font-bold" style={{ minWidth: w || 38, borderLeft: i ? `1px solid ${C.border}` : 'none', background: on ? C.navy : '#fff', color: on ? '#fff' : C.ink2 }}>{typeof o === 'number' ? o.toFixed(o < 1 ? 2 : 1).replace(/\.0$/, '') : o}</button>;
      })}
    </div>
  );
}

/** 샘플링 룰 관리 — 와이어프레임 qual-sampling-rule.jsx 정본. */
export default function QualSamplingRuleScreen() {
  const [ruleId, setRuleId] = useState('R-STD');
  const [level, setLevel] = useState('II');
  const [severity, setSeverity] = useState('보통');
  const [aql, setAql] = useState(1.0);
  const [lot, setLot] = useState(800);

  const pickRule = (r: RuleSet) => {
    setRuleId(r.id);
    if (r.severity === '전수') { setSeverity('전수'); return; }
    setLevel(r.level); setSeverity(r.severity); setAql(r.aql);
  };

  const isFull = severity === '전수';
  const aqlIdx = SR_AQLS.indexOf(aql);
  const letter = letterFor(lot, level);
  const plan = isFull ? null : resolve(letter, aqlIdx < 0 ? 2 : aqlIdx);
  const curLotRow = SR_LOTS.find((r) => lot >= r.min && lot <= r.max);
  const result = isFull ? { letter: '전수', n: lot as number | string, ac: 0 as number | string, re: 1 as number | string } : plan || { letter: '—', n: '—', ac: '—', re: '—' };

  const banner: [string, string][] = [
    ['시료문자', '' + result.letter],
    ['시료수 (n)', typeof result.n === 'number' ? result.n.toLocaleString() : '' + result.n],
    ['합격 (Ac)', '' + result.ac],
    ['불합격 (Re)', '' + result.re],
    [isFull ? '검사 방식' : 'AQL', isFull ? '전수' : aql.toFixed(2)],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">샘플링 룰 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 기준정보 / 샘플링 룰 관리</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '룰 세트 등록', variant: 'primary' }, 'save', 'download']} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[0.85fr_2.15fr]">
        {/* 룰 세트 */}
        <Card title="샘플링 룰 세트" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{SR_RULES.length}건</span>}>
          <div className="flex flex-col">
            {SR_RULES.map((r) => {
              const on = r.id === ruleId;
              return (
                <button key={r.id} onClick={() => pickRule(r)} className="flex flex-col gap-1.5 border-b border-border px-3.5 py-3 text-left" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent', background: on ? C.tealSoft : '#fff' }}>
                  <span className="flex items-center justify-between">
                    <span className="text-[12.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{r.name}</span>
                    <Pill tone={sevTone(r.severity)}>{r.severity}</Pill>
                  </span>
                  <span className="text-[9.5px] text-ink3">{r.std}</span>
                  <span className="mt-px flex gap-2.5 text-[10px] text-ink3">
                    {r.severity !== '전수' && <span>수준 <b className="text-ink2">{r.level}</b></span>}
                    {r.severity !== '전수' && <span>AQL <b className="text-ink2">{r.aql.toFixed(2)}</b></span>}
                    <span>적용 <b className="text-ink2">{r.products}</b>품목</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          {/* 설정 컨트롤 */}
          <div className="flex flex-wrap items-center gap-5 rounded-[10px] border border-border bg-panel p-3.5 shadow-[0_1px_2px_rgba(23,34,65,0.04)]">
            <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-ink3">검사 수준</span><Seg value={level} options={['I', 'II', 'III']} onChange={setLevel} /></div>
            <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-ink3">엄격도</span><Seg value={severity} options={['수월한', '보통', '까다로운']} onChange={setSeverity} w={56} /></div>
            <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-ink3">AQL</span><Seg value={aql} options={SR_AQLS} onChange={setAql} w={44} /></div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-ink3">로트 크기</span>
              <input type="number" value={lot} onChange={(e) => setLot(Math.max(2, +e.target.value || 0))} className="h-8 w-[92px] rounded-lg border border-border-hi px-2.5 text-right font-mono text-[12px] font-bold text-ink outline-none" />
              <span className="text-[10.5px] text-ink3">pcs</span>
            </div>
          </div>

          {/* 결과 배너 */}
          <div className="rounded-[10px] px-4 py-3.5" style={{ background: C.navy }}>
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="text-[11.5px] font-extrabold text-white">적용 단일 샘플링 플랜</span>
              <Pill tone={sevTone(severity)} solid>{isFull ? '전수검사' : severity + ' 검사'}</Pill>
              <span className="text-[10px] text-white/55">로트 {lot.toLocaleString()} pcs {curLotRow ? `· ${curLotRow.range}` : ''}</span>
            </div>
            <div className="flex">
              {banner.map(([k, v], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < banner.length - 1 ? '1px solid rgba(255,255,255,.14)' : 'none' }}>
                  <div className="font-mono text-[24px] font-extrabold tracking-tight" style={{ color: i === 2 ? '#7fe3da' : i === 3 ? '#ff9b8e' : '#fff' }}>{v}</div>
                  <div className="mt-1 text-[9.5px] text-white/55">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 text-center text-[9.5px] text-white/50">{isFull ? '전수검사 — 로트 전량 검사, 부적합 1개 발견 시 로트 불합격' : `시료 ${result.n}개 중 부적합 ${result.ac}개 이하 합격 · ${result.re}개 이상 불합격`}</div>
          </div>

          {/* 두 기준표 */}
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[0.9fr_1.4fr]">
            {/* 시료문자 결정표 */}
            <Card title="시료문자 결정표" bodyClassName="p-0" action={<span className="text-[9.5px] text-ink3">일반 검사수준</span>}>
              <div className="max-h-[360px] overflow-y-auto">
                <table className="w-full border-collapse text-[10.5px]">
                  <thead className="sticky top-0 z-[1]">
                    <tr>
                      <th className="border-b border-r border-border bg-panel-alt px-2 py-1.5 text-left text-[10px] font-bold whitespace-nowrap text-ink2">로트 크기</th>
                      {(['I', 'II', 'III'] as const).map((l) => <th key={l} className="border-b border-r border-border px-2 py-1.5 text-center text-[10px] font-bold" style={{ background: l === level ? C.tealSoft : C.panelAlt, color: l === level ? C.teal : C.ink2 }}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {SR_LOTS.map((r, i) => {
                      const onRow = curLotRow && r.range === curLotRow.range;
                      return (
                        <tr key={i} style={{ background: onRow ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                          <td className="border-b border-r border-border px-2 py-1.5 font-mono tabular-nums" style={{ fontWeight: onRow ? 800 : 600, color: onRow ? C.teal : C.ink2 }}>{r.range}</td>
                          {(['I', 'II', 'III'] as const).map((l) => {
                            const hot = onRow && l === level;
                            return <td key={l} className="border-b border-r border-border px-2 py-1.5 text-center font-mono font-extrabold tabular-nums" style={{ color: hot ? '#fff' : l === level ? C.teal : C.ink3, background: hot ? C.teal : l === level ? '#fff' : 'transparent' }}>{r[l]}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 단일 샘플링 판정표 */}
            <Card title="단일 샘플링 판정표 (보통검사)" bodyClassName="p-0" action={<span className="text-[9.5px] text-ink3">Ac / Re</span>}>
              <div className="relative max-h-[360px] overflow-y-auto" style={{ opacity: isFull ? 0.4 : 1 }}>
                <table className="w-full border-collapse text-[10px]">
                  <thead className="sticky top-0 z-[1]">
                    <tr>
                      <th className="border-b border-r border-border px-2 py-1.5 text-center text-[10px] font-bold text-white" style={{ background: C.navy }}>문자</th>
                      <th className="border-b border-r border-border px-2 py-1.5 text-right text-[10px] font-bold text-white" style={{ background: C.navy }}>n</th>
                      {SR_AQLS.map((a) => <th key={a} className="border-b border-r border-border px-2 py-1.5 text-center text-[10px] font-bold text-white" style={{ background: a === aql ? C.teal : C.navy }}>{a.toFixed(2)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {SR_CODE_ORDER.map((code, ri) => {
                      const onRow = !isFull && plan && code === plan.letter;
                      return (
                        <tr key={code} style={{ background: onRow ? C.tealSoft : ri % 2 ? C.panelAlt : '#fff' }}>
                          <td className="border-b border-r border-border px-2 py-1.5 text-center font-mono font-extrabold" style={{ color: onRow ? C.teal : C.ink }}>{code}</td>
                          <td className="border-b border-r border-border px-2 py-1.5 text-right font-mono font-bold text-ink2">{SR_N[code]}</td>
                          {SR_PLAN[code].map((cell, ci) => {
                            const hotCol = SR_AQLS[ci] === aql;
                            const hotCell = onRow && hotCol;
                            const arrow = cell === '↓' || cell === '↑';
                            return <td key={ci} className="border-b border-r border-border px-2 py-1.5 text-center font-mono tabular-nums" style={{ fontWeight: arrow ? 400 : 700, fontSize: arrow ? 12 : 9.5, color: hotCell ? '#fff' : arrow ? C.ink3 : hotCol ? C.ink : C.ink2, background: hotCell ? C.teal : hotCol ? '#eef6f5' : 'transparent' }}>{cell}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {isFull && <div className="absolute inset-0 grid place-items-center"><span className="rounded-lg px-4 py-2 text-[11px] font-bold text-white" style={{ background: C.ink }}>전수검사 — 샘플링 미적용</span></div>}
              </div>
              <div className="border-t border-border px-3 py-2 text-[9.5px] text-ink3" style={{ background: C.panelAlt }}>↓ : 화살표 아래 첫 플랜 적용 · ↑ : 화살표 위 첫 플랜 적용 {severity !== '보통' && !isFull && <span className="font-bold" style={{ color: C.warn }}> · {severity} 검사는 전환규칙(Table II-B/C) 적용</span>}</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
