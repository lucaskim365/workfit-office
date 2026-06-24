import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { useInspectionStandards } from '@/features/inspectionStandard/useInspectionStandards';
import { C, KpiGrid } from '../_qual';

const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const stageTone = (s: string): Tone => (s === 'IQC' ? 'info' : s === 'OQC' ? 'ok' : 'mute');

const th = (al: string) => `border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`;

/** 제품·공정별 검사 기준 설정 — 와이어프레임 qual-insp-spec.jsx 정본. */
export default function QualInspSpecScreen() {
  const { data: products = [], isLoading } = useInspectionStandards();
  const [selP, setSelP] = useState('P-1001');
  const [selOp, setSelOp] = useState('OP30');

  if (isLoading) {
    return <div className="grid place-items-center py-20 text-[12px] text-ink3">검사 기준을 불러오는 중…</div>;
  }
  if (products.length === 0) {
    return <div className="grid place-items-center py-20 text-[12px] text-ink3">등록된 검사 기준이 없습니다</div>;
  }

  const prod = products.find((p) => p.code === selP) || products[0];
  const proc = prod.procs.find((o) => o.id === selOp) || prod.procs[0];

  const pickProduct = (code: string) => {
    setSelP(code);
    const p = products.find((x) => x.code === code)!;
    setSelOp(p.procs[0].id);
  };

  const totalCombos = products.reduce((s, p) => s + p.procs.length, 0);
  const totalItems = products.reduce((s, p) => s + p.procs.reduce((t, o) => t + o.items.length, 0), 0);
  const unset = products.reduce((s, p) => s + p.procs.filter((o) => o.items.length === 0).length, 0);
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
        ['기준 설정 제품', '' + products.length, '품목', C.ink],
        ['제품·공정 조합', '' + totalCombos, '건', C.blue],
        ['적용 검사항목', '' + totalItems, '건', C.teal],
        ['검사 기준 미설정', '' + unset, '공정', unset ? C.err : C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[0.85fr_2.15fr]">
        {/* 제품 목록 */}
        <Card title="제품 목록" bodyClassName="p-0">
          <div className="flex flex-col">
            {products.map((p) => {
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
