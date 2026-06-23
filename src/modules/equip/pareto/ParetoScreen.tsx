import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { C } from '../_maint';

interface Raw { name: string; short: string; grp: string; hrs: number; cnt: number }
const PARETO_RAW: Raw[] = [
  { name: '설비 고장(BM)', short: '설비고장', grp: '설비요인', hrs: 142, cnt: 38 },
  { name: '금형/공구 교체', short: '금형/공구교체', grp: '준비·교체', hrs: 98, cnt: 56 },
  { name: '자재 공급 대기', short: '자재대기', grp: '자재요인', hrs: 76, cnt: 41 },
  { name: '셋업/작업 준비', short: '셋업/준비', grp: '준비·교체', hrs: 54, cnt: 33 },
  { name: '품질 이상 조치', short: '품질조치', grp: '품질요인', hrs: 38, cnt: 22 },
  { name: '유틸리티/전원', short: '유틸리티', grp: '설비요인', hrs: 22, cnt: 9 },
  { name: '기타', short: '기타', grp: '기타', hrs: 18, cnt: 14 },
];
const GRP_C: Record<string, string> = { 설비요인: C.err, '준비·교체': C.warn, 자재요인: C.blue, 품질요인: C.teal, 기타: '#b7c0d4' };

interface Row extends Raw { pct: number; cumPct: number }

function ParetoChart({ data, total }: { data: Row[]; total: number }) {
  const w = 940, h = 320, padL = 46, padR = 46, padT = 18, padB = 64;
  const iw = w - padL - padR, ih = h - padT - padB;
  const maxH = Math.ceil(Math.max(...data.map((d) => d.hrs)) / 20) * 20;
  const groupW = iw / data.length;
  const barW = groupW * 0.5;
  let cum = 0;
  const pts = data.map((d, i) => {
    cum += d.hrs;
    return { cx: padL + groupW * i + groupW / 2, cy: padT + ih - (cum / total) * ih, cumPct: (cum / total) * 100, i };
  });
  const y80 = padT + ih - 0.8 * ih;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="block">
      {Array.from({ length: 6 }).map((_, i) => {
        const y = padT + (ih / 5) * i;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke={C.border} strokeWidth="1" />
            <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9" fill={C.ink3}>{Math.round(maxH - (maxH / 5) * i)}</text>
          </g>
        );
      })}
      {Array.from({ length: 6 }).map((_, i) => {
        const y = padT + (ih / 5) * i;
        return <text key={i} x={w - padR + 8} y={y + 3} textAnchor="start" fontSize="9" fill={C.ink3}>{Math.round(100 - (100 / 5) * i)}%</text>;
      })}
      <line x1={padL} y1={y80} x2={w - padR} y2={y80} stroke={C.navy} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
      <text x={w - padR - 2} y={y80 - 6} textAnchor="end" fontSize="9.5" fontWeight="700" fill={C.navy}>80% 기준</text>
      {data.map((d, i) => {
        const bh = (d.hrs / maxH) * ih;
        const x = padL + groupW * i + (groupW - barW) / 2;
        const vital = pts[i].cumPct <= 82.7;
        return (
          <g key={i}>
            <rect x={x} y={padT + ih - bh} width={barW} height={bh} rx="3" fill={GRP_C[d.grp]} opacity={vital ? 1 : 0.5} />
            <text x={x + barW / 2} y={padT + ih - bh - 6} textAnchor="middle" fontSize="10" fontWeight="800" fill={C.ink}>{d.hrs}</text>
            <text x={padL + groupW * i + groupW / 2} y={h - padB + 18} textAnchor="middle" fontSize="9.5" fill={C.ink2}>{d.short}</text>
            <text x={padL + groupW * i + groupW / 2} y={h - padB + 32} textAnchor="middle" fontSize="8.5" fill={C.ink3}>{d.cnt}건</text>
          </g>
        );
      })}
      <polyline points={pts.map((p) => `${p.cx},${p.cy}`).join(' ')} fill="none" stroke={C.navy} strokeWidth="2.4" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r="4" fill="#fff" stroke={C.navy} strokeWidth="2" />
          <text x={p.cx + (i === 0 ? 12 : 0)} y={p.cy - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill={C.navy}>{Math.round(p.cumPct)}%</text>
        </g>
      ))}
    </svg>
  );
}

/** 비가동 사유별 파레토 분석 — 와이어프레임 pareto.jsx 정본. */
export default function ParetoScreen() {
  const data = [...PARETO_RAW].sort((a, b) => b.hrs - a.hrs);
  const total = data.reduce((s, d) => s + d.hrs, 0);
  const totalCnt = data.reduce((s, d) => s + d.cnt, 0);
  let cum = 0;
  const rows: Row[] = data.map((d) => { cum += d.hrs; return { ...d, pct: (d.hrs / total) * 100, cumPct: (cum / total) * 100 }; });
  const vitalFew = rows.filter((r) => r.cumPct <= 82.7).length;
  const top = rows[0];

  const grpTotals: Record<string, number> = {};
  data.forEach((d) => { grpTotals[d.grp] = (grpTotals[d.grp] || 0) + d.hrs; });
  const grpRows = Object.keys(grpTotals).sort((a, b) => grpTotals[b] - grpTotals[a]).map((k) => ({ label: k, v: grpTotals[k], c: GRP_C[k] }));

  const KPI: [string, string, string, string, boolean][] = [
    ['총 비가동시간', '' + total, 'h', C.ink, false],
    ['비가동 건수', '' + totalCnt, '건', C.ink, false],
    ['최다 사유', top.short, '', C.err, true],
    ['최다 사유 비중', top.pct.toFixed(1), '%', C.warn, false],
    ['상위 핵심 사유', `${vitalFew}개=80%`, '', C.navy, true],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">비가동 사유별 파레토 분석</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 분석 및 통계 리포트 / 비가동 사유별 파레토 분석</p>
        </div>
        <ActionBar actions={['compare', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPI.map(([l, v, u, c, small]) => (
          <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className="font-extrabold tracking-tight tabular-nums" style={{ color: c, fontSize: small ? 18 : 24 }}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <Card
        title="비가동 사유 파레토"
        action={
          <div className="flex gap-3.5 text-[10.5px]">
            <span className="flex items-center gap-1.5 font-semibold text-ink2"><span className="h-2 w-2.5 rounded-sm" style={{ background: C.err }} />비가동시간(h)</span>
            <span className="flex items-center gap-1.5 font-semibold text-ink2"><span className="h-[3px] w-2.5 rounded-sm" style={{ background: C.navy }} />누적 비율(%)</span>
          </div>
        }
      >
        <ParetoChart data={rows} total={total} />
        <div className="mt-1.5 flex items-center gap-2 rounded-[9px] px-3.5 py-2.5" style={{ background: '#e7eefc' }}>
          <span className="text-[13px]">💡</span>
          <span className="text-[11px] font-semibold text-ink2">상위 <b style={{ color: C.navy }}>{vitalFew}개 사유({rows[vitalFew - 1].cumPct.toFixed(0)}%)</b>가 전체 비가동의 80%를 차지 — <b className="text-ink">{rows.slice(0, vitalFew).map((r) => r.short).join(', ')}</b> 집중 개선 시 효과 극대화</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <Card title="사유별 상세" bodyClassName="p-0">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['순위 / 사유', 'text-left'], ['대분류', 'text-center'], ['건수', 'text-right'], ['비가동(h)', 'text-right'], ['비중', 'text-right'], ['누적', 'text-right']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const vital = r.cumPct <= 82.7;
                return (
                  <tr key={r.name} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] text-[10px] font-extrabold" style={{ background: vital ? C.navy : C.bgDeep, color: vital ? '#fff' : C.ink3 }}>{i + 1}</span>
                        <span className="font-bold text-ink">{r.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ color: GRP_C[r.grp], background: `${GRP_C[r.grp]}18` }}>{r.grp}</span></td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{r.cnt}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-ink">{r.hrs}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink2">{r.pct.toFixed(1)}%</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: vital ? C.navy : C.ink3 }}>{r.cumPct.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
            <span className="text-[10.5px] text-ink3">합계 {totalCnt}건</span>
            <span className="text-[11px] text-ink3">총 비가동 <b className="font-mono text-ink">{total} h</b></span>
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="대분류별 비가동"><RankBars rows={grpRows} /></Card>
          <Card title="개선 우선순위" bodyClassName="p-0">
            <div className="py-1">
              {rows.slice(0, 3).map((r, i) => (
                <div key={r.name} className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-[11px] font-extrabold text-white" style={{ background: C.navy }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-bold text-ink">{r.name}</div>
                    <div className="text-[9.5px] text-ink3">{r.hrs}h · {r.cnt}건 · 비중 {r.pct.toFixed(1)}%</div>
                  </div>
                  <span className="font-mono text-[11px] font-extrabold" style={{ color: C.err }}>{r.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-3" style={{ background: C.panelAlt }}>
              <button className="w-full rounded-[9px] py-2.5 text-[12px] font-extrabold text-white" style={{ background: C.navy }}>개선 과제 등록</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
