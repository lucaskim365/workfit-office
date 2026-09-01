import type { ReactNode } from 'react';
import { C as BASE, MKpis, FSel, FInput, FField, FBar, Bar } from '../mat/_mat';
import { ActionButton } from '@/shared/ui/ActionBar';
import { Pill, type Tone } from '@/shared/ui/Pill';

/** 리포트 모듈 색 토큰(_mat 확장 + navyDeep·c5). */
export const C = { ...BASE, navyDeep: '#172241', c5: '#b7c0d4' };
export { MKpis, FSel, FInput, FField, FBar, Pill };
export type { Tone };
/** 진척 막대(=_mat Bar). 리포트에서 ProgBar 별칭. */
export { Bar as ProgBar };

/* ── 리포트 유형 배지 ───────────────────────────────── */
export const RPT_TYPE: Record<string, { name: string; bg: string; fg: string }> = {
  R1: { name: '정형 보고서', bg: '#e9ecf6', fg: '#3c4a73' },
  R2: { name: '분석 대시보드', bg: '#dcf3f0', fg: '#0e7a70' },
  R3: { name: '집계 그리드', bg: '#e7eefc', fg: '#2f57b0' },
  R4: { name: '추적·계보', bg: '#fdf0d8', fg: '#a9740a' },
  R5: { name: '트렌드·비교', bg: '#f2e8f7', fg: '#7a3f97' },
};
export function RTypeBadge({ type }: { type: string }) {
  const t = RPT_TYPE[type] || RPT_TYPE.R3;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-[3px] text-[10px] font-extrabold" style={{ background: t.bg, color: t.fg }}>
      <span className="font-black">{type}</span>{t.name}
    </span>
  );
}

/* ── 출력/배포 툴바 ─────────────────────────────────── */
function RBtn({ label, primary, excel }: { label: string; primary?: boolean; excel?: boolean }) {
  return (
    <button
      className="inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[7px] border px-2.5 text-[11px] font-bold"
      style={{
        background: primary ? C.navy : '#fff',
        color: primary ? '#fff' : excel ? '#1f8a5b' : C.ink2,
        borderColor: primary ? C.navy : C.borderHi,
      }}
    >
      {label}
    </button>
  );
}
export function RToolbar() {
  return (
    <div className="flex items-center gap-1.5">
      <RBtn label="구독" />
      <RBtn label="예약 배포" />
      <span className="mx-0.5 h-[18px] w-px" style={{ background: C.border }} />
      <RBtn label="Excel" excel />
      <RBtn label="PDF" />
      <RBtn label="출력" primary />
    </div>
  );
}

/* ── 리포트 헤더 ────────────────────────────────────── */
export function RHead({ title, sub, type, actions }: { title: string; sub?: string; type?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[17px] font-extrabold tracking-tight text-ink">{title}</span>
          {type && <RTypeBadge type={type} />}
        </div>
        <span className="whitespace-nowrap text-[10.5px] text-ink3">리포트 / {sub || title}</span>
      </div>
      <div className="shrink-0">{actions || <RToolbar />}</div>
    </div>
  );
}

/* ── 파라미터 필터 바 ───────────────────────────────── */
export function RParam({ children, period = '2026-06 (월간)' }: { children?: ReactNode; period?: string }) {
  return (
    <FBar>
      <FField label="기간"><FSel value={period} w={140} /></FField>
      {children}
      <span className="ml-auto flex gap-2">
        <ActionButton icon="compare" label="기간 비교" />
        <ActionButton icon="search" label="리포트 생성" variant="primary" />
      </span>
    </FBar>
  );
}

/* ── 범용 집계 테이블 ───────────────────────────────── */
export interface RCol { label: string; align?: 'left' | 'right' | 'center'; w?: number; mono?: boolean }
const AL: Record<string, string> = { right: 'text-right', center: 'text-center', left: 'text-left' };
export function RTable({ cols, rows, total, highlightCol, rowKey = 0 }: {
  cols: RCol[]; rows: ReactNode[][]; total?: ReactNode[]; highlightCol?: number; rowKey?: number;
}) {
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <thead>
        <tr>{cols.map((c, i) => (
          <th key={i} className={`whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[c.align || 'left']}`} style={{ width: c.w }}>{c.label}</th>
        ))}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
            {r.map((cell, ci) => {
              const c = cols[ci] || {};
              const isKey = ci === rowKey;
              const isHi = ci === highlightCol;
              return (
                <td key={ci} className={`whitespace-nowrap border-b border-border px-3 py-2.5 tabular-nums ${AL[c.align || 'left']} ${c.mono ? 'font-mono text-[11px]' : ''}`}
                  style={{ color: isKey || isHi ? C.ink : C.ink2, fontWeight: isKey ? 700 : isHi ? 800 : 500 }}>{cell}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr style={{ background: C.navy }}>
            {total.map((cell, ci) => {
              const c = cols[ci] || {};
              return <td key={ci} className={`px-3 py-2.5 text-[11.5px] font-extrabold tabular-nums ${AL[c.align || 'left']}`} style={{ color: ci === 0 ? '#fff' : '#dfe6f2' }}>{cell}</td>;
            })}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/* ── 파레토 차트(막대 빈도 + 누적 % 라인) ───────────── */
export function RPareto({ data, w = 620, h = 280, barColor = C.blue }: {
  data: { label: string; v: number }[]; w?: number; h?: number; barColor?: string;
}) {
  const padL = 40, padR = 44, padT = 16, padB = 56;
  const iw = w - padL - padR, ih = h - padT - padB;
  const total = data.reduce((s, d) => s + d.v, 0);
  const maxV = Math.max(...data.map((d) => d.v)) * 1.1;
  const bw = (iw / data.length) * 0.6;
  let cum = 0;
  const pts = data.map((d, i) => {
    cum += d.v;
    return { x: padL + (iw / data.length) * (i + 0.5), y: padT + ih - (cum / total) * ih, pct: Math.round((cum / total) * 100) };
  });
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {[0, 25, 50, 75, 100].map((g, i) => {
        const y = padT + ih - (g / 100) * ih;
        return <g key={i}><line x1={padL} y1={y} x2={w - padR} y2={y} stroke={C.border} strokeWidth="1" /><text x={w - padR + 6} y={y + 3} fontSize="9" fill={C.ink3}>{g}%</text></g>;
      })}
      {data.map((d, i) => {
        const x = padL + (iw / data.length) * (i + 0.5) - bw / 2;
        const bh = (d.v / maxV) * ih;
        return (
          <g key={i}>
            <rect x={x} y={padT + ih - bh} width={bw} height={bh} rx="2" fill={barColor} opacity={0.85} />
            <text x={x + bw / 2} y={padT + ih - bh - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={C.ink2}>{d.v}</text>
            <text x={x + bw / 2} y={h - padB + 16} textAnchor="middle" fontSize="9" fill={C.ink3}>{d.label}</text>
          </g>
        );
      })}
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={C.warn} strokeWidth="2.4" strokeLinejoin="round" />
      {pts.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={C.warn} strokeWidth="2" /><text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="9" fontWeight="800" fill={C.warn}>{p.pct}%</text></g>)}
    </svg>
  );
}

/* ── 로트 추적 계보 트리 ────────────────────────────── */
export interface TraceNode { label: string; sub?: string; tone?: string; tag?: string; children?: TraceNode[] }
function RTraceNodeView({ node }: { node: TraceNode }) {
  const toneC = ({ in: C.blue, wip: C.warn, out: C.teal, def: C.err } as Record<string, string>)[node.tone || ''] || C.ink2;
  const pillTone: Tone = node.tone === 'def' ? 'err' : node.tone === 'out' ? 'ok' : node.tone === 'wip' ? 'warn' : 'info';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: toneC }} />
        <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-1.5" style={{ borderLeft: `3px solid ${toneC}` }}>
          <span className="font-mono text-[11.5px] font-bold text-ink">{node.label}</span>
          {node.sub && <span className="text-[10.5px] text-ink3">{node.sub}</span>}
          {node.tag && <Pill tone={pillTone}>{node.tag}</Pill>}
        </div>
      </div>
      {node.children && (
        <div className="ml-[18px] flex flex-col gap-1.5 pl-4" style={{ borderLeft: `1.5px dashed ${C.borderHi}` }}>
          {node.children.map((c, i) => <RTraceNodeView key={i} node={c} />)}
        </div>
      )}
    </div>
  );
}
export function RTraceTree({ root }: { root: TraceNode | TraceNode[] }) {
  return <div className="flex flex-col gap-1.5">{(Array.isArray(root) ? root : [root]).map((n, i) => <RTraceNodeView key={i} node={n} />)}</div>;
}

/* ── 정형 보고서 시트(COA·DHR 등) ──────────────────── */
export function RDocSheet({ docTitle, docNo, fields, children, sign = true }: {
  docTitle: string; docNo: string; fields?: [string, string][]; children: ReactNode; sign?: boolean;
}) {
  return (
    <div className="mx-auto max-w-[760px] rounded-lg border border-border-hi bg-panel p-7">
      <div className="mb-4 flex items-start justify-between border-b-2 pb-3.5" style={{ borderColor: C.ink }}>
        <div>
          <div className="text-[9px] font-extrabold tracking-[0.16em]" style={{ color: C.teal }}>WorkFitMES</div>
          <div className="mt-1 text-xl font-extrabold tracking-tight text-ink">{docTitle}</div>
        </div>
        <div className="text-right text-[10.5px] text-ink3">
          <div className="font-mono font-bold text-ink2">{docNo}</div>
          <div className="mt-0.5">발행일 2026-06-21</div>
        </div>
      </div>
      {fields && (
        <div className="mb-[18px] grid grid-cols-2 gap-x-6 gap-y-2">
          {fields.map((f, i) => (
            <div key={i} className="flex justify-between border-b border-border pb-1.5 text-[11.5px]">
              <span className="font-semibold text-ink3">{f[0]}</span><span className="font-bold text-ink">{f[1]}</span>
            </div>
          ))}
        </div>
      )}
      {children}
      {sign && (
        <div className="mt-6 flex justify-end gap-3.5 border-t border-border pt-3.5">
          {['담당', '검토', '승인'].map((s) => (
            <div key={s} className="w-24 text-center">
              <div className="mb-1 text-[10px] font-bold text-ink3">{s}</div>
              <div className="h-[46px] rounded-md border border-border" style={{ background: C.panelAlt }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 차트 범례 ──────────────────────────────────────── */
export function RLegend({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4">
      {items.map((l, i) => (
        <span key={i} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink2">
          <span className="h-[11px] w-[11px] rounded-[3px]" style={{ background: l[1] }} />{l[0]}
        </span>
      ))}
    </div>
  );
}
