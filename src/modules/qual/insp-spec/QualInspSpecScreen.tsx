import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';

const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const stageTone = (s: string): Tone => (s === 'IQC' ? 'info' : s === 'OQC' ? 'ok' : 'mute');

interface ItemSpec { name: string; code: string; type: '계량' | '계수'; usl?: string; lsl?: string; spec: string; method: string; sampling: string; sev: string; use: boolean }
interface Proc { id: string; step: number; name: string; stage: string; aql: number; level: string; lot: string; n: number; ac: number; re: number; items: ItemSpec[] }
interface Product { code: string; name: string; cat: string; procs: Proc[] }

const PC_PRODUCTS: Product[] = [
  { code: 'P-1001', name: 'AL 하우징 BR-200', cat: '가공품', procs: [
    { id: 'OP10', step: 10, name: '소재 수입검사', stage: 'IQC', aql: 1.0, level: 'II', lot: '501–1,200', n: 80, ac: 2, re: 3, items: [
      { name: '외경(O.D)', code: 'QI-DIM-001', type: '계량', usl: '25.05', lsl: '24.95', spec: '25.00 ±0.05 mm', method: '캘리퍼스', sampling: '샘플링', sev: '주요', use: true },
      { name: '표면 경도', code: 'QI-PRP-002', type: '계량', usl: '60', lsl: '56', spec: '58 ±2 HRC', method: '로크웰 경도계', sampling: '샘플링', sev: '주요', use: true },
      { name: '버(Burr)·이물', code: 'QI-AP-003', type: '계수', spec: '버·이물·오염 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
    ] },
    { id: 'OP30', step: 30, name: 'CNC 가공', stage: 'PQC', aql: 0.65, level: 'II', lot: '281–500', n: 50, ac: 1, re: 2, items: [
      { name: '외경(O.D)', code: 'QI-DIM-001', type: '계량', usl: '25.05', lsl: '24.95', spec: '25.00 ±0.05 mm', method: '캘리퍼스', sampling: '샘플링', sev: '주요', use: true },
      { name: '내경(I.D)', code: 'QI-DIM-002', type: '계량', usl: '12.02', lsl: '11.98', spec: '12.00 ±0.02 mm', method: '마이크로미터', sampling: '샘플링', sev: '주요', use: true },
      { name: '전장(Length)', code: 'QI-DIM-003', type: '계량', usl: '150.3', lsl: '149.7', spec: '150.0 ±0.3 mm', method: '하이트게이지', sampling: '샘플링', sev: '경미', use: true },
    ] },
    { id: 'OP50', step: 50, name: '표면처리·도장', stage: 'PQC', aql: 1.0, level: 'II', lot: '281–500', n: 50, ac: 2, re: 3, items: [
      { name: '도장 색상/광택', code: 'QI-AP-002', type: '계수', spec: '한도견본 대비 ΔE ≤ 1.5', method: '색차계', sampling: '샘플링', sev: '주요', use: true },
      { name: '표면 스크래치', code: 'QI-AP-001', type: '계수', spec: '0.5mm 초과 스크래치 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
    ] },
    { id: 'OP70', step: 70, name: '최종 출하검사', stage: 'OQC', aql: 0.65, level: 'II', lot: '501–1,200', n: 80, ac: 1, re: 2, items: [
      { name: '외경(O.D)', code: 'QI-DIM-001', type: '계량', usl: '25.05', lsl: '24.95', spec: '25.00 ±0.05 mm', method: '캘리퍼스', sampling: '샘플링', sev: '주요', use: true },
      { name: '전장(Length)', code: 'QI-DIM-003', type: '계량', usl: '150.3', lsl: '149.7', spec: '150.0 ±0.3 mm', method: '하이트게이지', sampling: '샘플링', sev: '경미', use: true },
      { name: '표면 스크래치', code: 'QI-AP-001', type: '계수', spec: '0.5mm 초과 스크래치 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
      { name: '도장 색상/광택', code: 'QI-AP-002', type: '계수', spec: '한도견본 대비 ΔE ≤ 1.5', method: '색차계', sampling: '샘플링', sev: '주요', use: true },
    ] },
  ] },
  { code: 'P-1002', name: '커넥터 하우징 CN-12', cat: '사출품', procs: [
    { id: 'OP10', step: 10, name: '원자재 수입검사', stage: 'IQC', aql: 1.5, level: 'II', lot: '1,201–3,200', n: 125, ac: 5, re: 6, items: [
      { name: '인장강도', code: 'QI-PRP-001', type: '계량', usl: '—', lsl: '45.0', spec: '45.0 MPa 이상', method: '만능재료시험기', sampling: '샘플링', sev: '치명', use: true },
    ] },
    { id: 'OP20', step: 20, name: '사출 성형', stage: 'PQC', aql: 1.0, level: 'II', lot: '1,201–3,200', n: 125, ac: 3, re: 4, items: [
      { name: '사출 수지온도', code: 'QI-TMP-001', type: '계량', usl: '235', lsl: '225', spec: '230 ±5 ℃', method: '온도센서', sampling: '샘플링', sev: '주요', use: true },
      { name: '버(Burr)·이물', code: 'QI-AP-003', type: '계수', spec: '버·이물·오염 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
    ] },
    { id: 'OP60', step: 60, name: '전기 특성검사', stage: 'OQC', aql: 0, level: 'II', lot: '전수', n: 0, ac: 0, re: 1, items: [
      { name: '절연저항', code: 'QI-EL-001', type: '계량', usl: '—', lsl: '10', spec: '10 MΩ 이상', method: '절연저항계', sampling: '전수', sev: '치명', use: true },
    ] },
  ] },
  { code: 'P-2003', name: '기어박스 커버 GX-7', cat: '가공품', procs: [
    { id: 'OP10', step: 10, name: '소재 수입검사', stage: 'IQC', aql: 1.0, level: 'II', lot: '281–500', n: 50, ac: 1, re: 2, items: [
      { name: '표면 경도', code: 'QI-PRP-002', type: '계량', usl: '60', lsl: '56', spec: '58 ±2 HRC', method: '로크웰 경도계', sampling: '샘플링', sev: '주요', use: true },
    ] },
    { id: 'OP40', step: 40, name: '머시닝 가공', stage: 'PQC', aql: 0, level: '-', lot: '-', n: 0, ac: 0, re: 0, items: [] },
    { id: 'OP80', step: 80, name: '최종 출하검사', stage: 'OQC', aql: 1.0, level: 'II', lot: '281–500', n: 50, ac: 2, re: 3, items: [
      { name: '내경(I.D)', code: 'QI-DIM-002', type: '계량', usl: '12.02', lsl: '11.98', spec: '12.00 ±0.02 mm', method: '마이크로미터', sampling: '샘플링', sev: '주요', use: true },
      { name: '버(Burr)·이물', code: 'QI-AP-003', type: '계수', spec: '버·이물·오염 無', method: '육안검사', sampling: '전수', sev: '치명', use: true },
    ] },
  ] },
  { code: 'P-3010', name: 'EV 배터리 트레이 BT-5', cat: '용접조립', procs: [
    { id: 'OP10', step: 10, name: '판재 수입검사', stage: 'IQC', aql: 1.0, level: 'II', lot: '501–1,200', n: 80, ac: 2, re: 3, items: [
      { name: '전장(Length)', code: 'QI-DIM-003', type: '계량', usl: '150.3', lsl: '149.7', spec: '150.0 ±0.3 mm', method: '하이트게이지', sampling: '샘플링', sev: '경미', use: true },
    ] },
    { id: 'OP55', step: 55, name: '로봇 용접', stage: 'PQC', aql: 1.5, level: 'II', lot: '501–1,200', n: 80, ac: 3, re: 4, items: [
      { name: '제품 중량', code: 'QI-WT-001', type: '계량', usl: '325.0', lsl: '315.0', spec: '320.0 ±5.0 g', method: '전자저울', sampling: '샘플링', sev: '주요', use: true },
      { name: '표면 스크래치', code: 'QI-AP-001', type: '계수', spec: '0.5mm 초과 스크래치 無', method: '육안검사', sampling: '전수', sev: '치명', use: false },
    ] },
  ] },
];

const th = (al: string) => `border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`;

/** 제품·공정별 검사 기준 설정 — 와이어프레임 qual-insp-spec.jsx 정본. */
export default function QualInspSpecScreen() {
  const [selP, setSelP] = useState('P-1001');
  const [selOp, setSelOp] = useState('OP30');
  const prod = PC_PRODUCTS.find((p) => p.code === selP) || PC_PRODUCTS[0];
  const proc = prod.procs.find((o) => o.id === selOp) || prod.procs[0];

  const pickProduct = (code: string) => {
    setSelP(code);
    const p = PC_PRODUCTS.find((x) => x.code === code)!;
    setSelOp(p.procs[0].id);
  };

  const totalCombos = PC_PRODUCTS.reduce((s, p) => s + p.procs.length, 0);
  const totalItems = PC_PRODUCTS.reduce((s, p) => s + p.procs.reduce((t, o) => t + o.items.length, 0), 0);
  const unset = PC_PRODUCTS.reduce((s, p) => s + p.procs.filter((o) => o.items.length === 0).length, 0);
  const fullInspect = proc.n === 0 && proc.items.length > 0;

  const banner = fullInspect
    ? [['검사 방식', '전수검사'], ['로트 크기', '전수'], ['시료수 (n)', '전수'], ['합격 Ac', '0'], ['불합격 Re', '1']]
    : [['AQL', proc.aql ? proc.aql.toFixed(2) : '—'], ['검사 수준', proc.level], ['로트 크기', proc.lot], ['시료수 (n)', '' + proc.n], ['합격 Ac', '' + proc.ac], ['불합격 Re', '' + proc.re]];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">제품·공정별 검사 기준 설정</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 기준정보 / 제품·공정별 검사 기준 설정</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '검사항목 추가', variant: 'primary' }, 'save', { icon: 'compare', label: '기준 복사' }, 'download']} />
      </div>

      <KpiGrid cols={4} items={[
        ['기준 설정 제품', '' + PC_PRODUCTS.length, '품목', C.ink],
        ['제품·공정 조합', '' + totalCombos, '건', C.blue],
        ['적용 검사항목', '' + totalItems, '건', C.teal],
        ['검사 기준 미설정', '' + unset, '공정', unset ? C.err : C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[0.85fr_2.15fr]">
        {/* 제품 목록 */}
        <Card title="제품 목록" bodyClassName="p-0">
          <div className="flex flex-col">
            {PC_PRODUCTS.map((p) => {
              const on = p.code === selP;
              const items = p.procs.reduce((s, o) => s + o.items.length, 0);
              return (
                <button key={p.code} onClick={() => pickProduct(p.code)} className="flex flex-col gap-1 border-b border-border px-3.5 py-3 text-left" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent', background: on ? C.tealSoft : '#fff' }}>
                  <span className="text-[12.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{p.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[9.5px] text-ink3">{p.code}</span>
                    <Pill tone="mute">{p.cat}</Pill>
                  </span>
                  <span className="mt-0.5 flex gap-3 text-[10px] text-ink3">
                    <span>공정 <b className="text-ink2">{p.procs.length}</b></span>
                    <span>검사항목 <b className="text-ink2">{items}</b></span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          {/* 라우팅 stepper */}
          <div className="rounded-[10px] border border-border bg-panel p-3.5 shadow-[0_1px_2px_rgba(23,34,65,0.04)]">
            <div className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-bold text-ink3"><span style={{ color: C.teal }}>⛓</span> 공정 라우팅 — <b className="text-ink">{prod.name}</b></div>
            <div className="flex flex-wrap items-stretch">
              {prod.procs.map((o, i) => {
                const on = o.id === selOp;
                const empty = o.items.length === 0;
                return (
                  <Fragment key={o.id}>
                    {i > 0 && <span className="mx-0.5 self-center text-[12px] text-ink3">→</span>}
                    <button onClick={() => setSelOp(o.id)} className="flex min-w-[118px] flex-col items-start gap-1 rounded-[9px] px-3 py-2.5" style={{ border: `1px solid ${on ? C.teal : C.border}`, background: on ? C.tealSoft : C.panelAlt }}>
                      <span className="flex w-full items-center gap-1.5">
                        <span className="font-mono text-[9px] font-bold text-ink3">OP{o.step}</span>
                        <Pill tone={stageTone(o.stage)}>{o.stage}</Pill>
                      </span>
                      <span className="text-[11.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{o.name}</span>
                      <span className="text-[9.5px] font-bold" style={{ color: empty ? C.err : C.ink3 }}>{empty ? '미설정' : `검사항목 ${o.items.length}`}</span>
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </div>

          {/* AQL 배너 */}
          <div className="flex items-center gap-2 rounded-[10px] px-4 py-3.5" style={{ background: C.navy }}>
            <span className="mr-1 text-[11px] font-bold text-white/65">샘플링 검사 기준 (MIL-STD-105E)</span>
            <div className="flex flex-1">
              {banner.map(([k, v], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < banner.length - 1 ? '1px solid rgba(255,255,255,.14)' : 'none' }}>
                  <div className="font-mono text-[17px] font-extrabold tracking-tight text-white">{v}</div>
                  <div className="mt-0.5 text-[9px] text-white/55">{k}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 검사 기준 테이블 */}
          <Card
            title={`검사 기준 · ${proc.name}`}
            bodyClassName="p-0"
            action={<span className="flex items-center gap-2"><Pill tone={stageTone(proc.stage)}>{proc.stage}</Pill><span className="font-mono text-[10.5px] text-ink3">{prod.code} · OP{proc.step}</span></span>}
          >
            {proc.items.length === 0 ? (
              <div className="grid place-items-center gap-2.5 py-11">
                <span className="text-[26px] opacity-50" style={{ color: C.err }}>⚠</span>
                <span className="text-[12px] font-bold text-ink2">이 공정에 설정된 검사 기준이 없습니다</span>
                <span className="text-[10.5px] text-ink3">'검사항목 추가'로 규격·AQL을 설정하세요</span>
              </div>
            ) : (
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {[['No', 'text-center'], ['검사 항목', 'text-left'], ['유형', 'text-center'], ['하한 LSL', 'text-right'], ['상한 USL', 'text-right'], ['규격 / 판정 기준', 'text-left'], ['검사방법', 'text-center'], ['샘플링', 'text-center'], ['중요도', 'text-center'], ['사용', 'text-center']].map(([h, al]) => (
                      <th key={h} className={th(al)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proc.items.map((it, i) => (
                    <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff', opacity: it.use ? 1 : 0.5 }}>
                      <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px] text-ink3">{i + 1}</td>
                      <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{it.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{it.code}</div></td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><span className="text-[10.5px] font-bold" style={{ color: it.type === '계량' ? C.blue : C.teal }}>{it.type}치</span></td>
                      <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: it.type === '계량' ? C.err : C.ink3 }}>{it.type === '계량' ? it.lsl : '—'}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: it.type === '계량' ? C.err : C.ink3 }}>{it.type === '계량' ? it.usl : '—'}</td>
                      <td className="border-b border-border px-3 py-2.5 text-ink" style={{ maxWidth: 170, whiteSpace: 'normal', fontFamily: it.type === '계량' ? 'ui-monospace, monospace' : 'inherit', fontWeight: it.type === '계량' ? 700 : 500, fontSize: it.type === '계량' ? 11 : 10.5 }}>{it.spec}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center text-[10.5px]">{it.method}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={it.sampling === '전수' ? 'info' : 'mute'}>{it.sampling}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={sevTone(it.sev)}>{it.sev}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 text-center">
                        <span className="relative inline-flex h-[18px] w-8 rounded-full" style={{ background: it.use ? C.teal : C.borderHi }}>
                          <span className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white" style={{ left: it.use ? 16 : 2 }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
