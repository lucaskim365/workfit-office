import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C, SearchBox } from '../_qual';

const VG_GRADE: Record<string, { c: string; label: string }> = { A: { c: '#16a34a', label: '우수' }, B: { c: '#3a6ee0', label: '양호' }, C: { c: '#e6960c', label: '주의' }, D: { c: '#e0483b', label: '관리' } };
const gradeOf = (s: number) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : 'D');
const gradeTone = (g: string): Tone => (g === 'A' ? 'ok' : g === 'B' ? 'info' : g === 'C' ? 'warn' : 'err');

interface Metric { key: string; name: string; unit: string; w: number }
const VG_METRICS: Metric[] = [
  { key: 'accept', name: '수입검사 합격률', unit: '%', w: 35 },
  { key: 'defect', name: '입고 불량률(PPM)', unit: 'PPM', w: 25 },
  { key: 'return', name: '반품 발생 건수', unit: '건', w: 15 },
  { key: 'delivery', name: '납기 준수율', unit: '%', w: 15 },
  { key: 'capa', name: '8D 시정 회신율', unit: '%', w: 10 },
];
interface Vendor { code: string; name: string; items: string; lots: number; score: number; prev: number; accept: number; defect: number; ret: number; delivery: number; capa: number; trend: number[] }
const VG_VENDORS: Vendor[] = [
  { code: 'V-0019', name: '정밀베어링', items: 'SP-BRG 외 6품목', lots: 142, score: 96.4, prev: 94.1, accept: 99.3, defect: 180, ret: 1, delivery: 98.5, capa: 100, trend: [91, 92, 93, 94, 94, 96] },
  { code: 'V-0007', name: '코리아폴리머', items: 'RM-PA66 외 4품목', lots: 88, score: 91.2, prev: 92.0, accept: 97.7, defect: 420, ret: 2, delivery: 96.0, capa: 95, trend: [93, 92, 92, 91, 92, 91] },
  { code: 'V-0031', name: '삼화정공', items: 'SP-SCR 외 9품목', lots: 210, score: 88.6, prev: 86.2, accept: 96.2, defect: 680, ret: 3, delivery: 94.8, capa: 92, trend: [84, 85, 86, 86, 87, 89] },
  { code: 'V-0012', name: '한일전자', items: 'EL-CON 외 5품목', lots: 96, score: 83.1, prev: 85.4, accept: 94.8, defect: 1240, ret: 5, delivery: 92.1, capa: 80, trend: [88, 87, 86, 85, 84, 83] },
  { code: 'V-0042', name: '동방스틸', items: 'RM-STS304 외 3품목', lots: 64, score: 74.5, prev: 78.9, accept: 90.6, defect: 2850, ret: 7, delivery: 88.0, capa: 70, trend: [82, 80, 79, 78, 76, 75] },
  { code: 'V-0003', name: '대한금속', items: 'RM-AL6061 외 2품목', lots: 71, score: 71.8, prev: 70.2, accept: 89.2, defect: 3100, ret: 6, delivery: 86.5, capa: 65, trend: [69, 70, 70, 71, 71, 72] },
  { code: 'V-0055', name: '한국팩', items: 'PK-BOX 외 8품목', lots: 120, score: 86.9, prev: 87.1, accept: 95.8, defect: 760, ret: 2, delivery: 93.4, capa: 88, trend: [86, 87, 88, 87, 87, 87] },
];
const valOf = (v: Vendor, k: string) => (k === 'accept' ? v.accept : k === 'defect' ? v.defect : k === 'return' ? v.ret : k === 'delivery' ? v.delivery : v.capa);
function metricScore(v: number, k: string) {
  if (k === 'accept' || k === 'delivery' || k === 'capa') return Math.max(0, Math.min(100, v));
  if (k === 'defect') return Math.max(0, Math.min(100, 100 - v / 50));
  if (k === 'return') return Math.max(0, 100 - v * 8);
  return 0;
}

/** 협력사 품질 등급 평가 — 와이어프레임 qual-iqc-vendor.jsx 정본. */
export default function QualIqcVendorScreen() {
  const [sel, setSel] = useState('V-0042');
  const [q, setQ] = useState('');
  const ranked = [...VG_VENDORS].sort((a, b) => b.score - a.score);
  let rows = ranked;
  if (q) rows = rows.filter((v) => v.name.includes(q) || v.code.toLowerCase().includes(q.toLowerCase()));
  const cur = VG_VENDORS.find((v) => v.code === sel) || VG_VENDORS[0];
  const curRank = ranked.findIndex((v) => v.code === cur.code) + 1;
  const grade = gradeOf(cur.score);
  const delta = cur.score - cur.prev;

  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  VG_VENDORS.forEach((v) => dist[gradeOf(v.score)]++);
  const avg = (VG_VENDORS.reduce((s, v) => s + v.score, 0) / VG_VENDORS.length).toFixed(1);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">협력사 품질 등급 평가</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 수입검사(IQC) / 협력사 품질 등급 평가</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '등급 확정', variant: 'primary' }, { icon: 'compare', label: '기간 비교' }, 'download']} />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr_1fr]">
        <div className="flex flex-col justify-center rounded-[11px] px-4 py-3.5" style={{ background: C.navy }}>
          <div className="mb-1 text-[10px] font-semibold text-white/60">평가 기간 · 평균 점수</div>
          <div className="flex items-baseline gap-1.5"><span className="font-mono text-[24px] font-extrabold text-white">{avg}</span><span className="text-[11px] text-white/60">2026 Q2 · {VG_VENDORS.length}개사</span></div>
        </div>
        {['A', 'B', 'C', 'D'].map((g) => (
          <div key={g} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: VG_GRADE[g].c }} /><span className="text-[10.5px] font-semibold text-ink3">{g}등급 · {VG_GRADE[g].label}</span></div>
            <div className="flex items-baseline gap-1"><span className="text-[24px] font-extrabold tabular-nums" style={{ color: VG_GRADE[g].c }}>{dist[g]}</span><span className="text-[11px] font-semibold text-ink3">개사</span></div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-panel px-3.5 py-2.5">
        <span className="text-[11px] font-semibold text-ink3">평가 기준</span>
        <span className="rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5 text-[11px] font-bold text-ink2">수입검사 실적 · 최근 90일 ▾</span>
        <SearchBox value={q} onChange={setQ} placeholder="협력사명·코드" w={150} />
        <span className="ml-auto text-[10.5px] text-ink3">가중치 합산 100점 만점</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.75fr_1fr]">
        {/* 랭킹 */}
        <Card title="협력사 품질 점수 랭킹" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">점수 내림차순</span>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['순위', 'text-center'], ['협력사', 'text-left'], ['검사 LOT', 'text-right'], ['합격률', 'text-right'], ['불량 PPM', 'text-right'], ['추이', 'text-center'], ['점수', 'text-right'], ['등급', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const on = v.code === sel;
                const r = ranked.findIndex((x) => x.code === v.code) + 1;
                const g = gradeOf(v.score);
                return (
                  <tr key={v.code} onClick={() => setSel(v.code)} className="cursor-pointer" style={{ background: on ? C.tealSoft : r % 2 ? '#fff' : C.panelAlt }}>
                    <td className="border-b border-border px-2.5 py-2.5 text-center text-[13px] font-extrabold" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent', color: r <= 3 ? C.navy : C.ink3 }}>{r}</td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{v.name}</div><div className="mt-px font-mono text-[9px] text-ink3">{v.code} · {v.items}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono text-ink2">{v.lots}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold" style={{ color: v.accept >= 95 ? C.ink : C.warn }}>{v.accept.toFixed(1)}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold" style={{ color: v.defect > 1000 ? C.err : C.ink2 }}>{v.defect.toLocaleString()}</td>
                    <td className="border-b border-border px-2.5 py-1 text-center"><span className="inline-block align-middle"><Sparkline data={v.trend} w={56} h={20} color={VG_GRADE[g].c} /></span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono text-[12.5px] font-extrabold text-ink">{v.score.toFixed(1)}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={gradeTone(g)} solid>{g}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 스코어카드 */}
        <Card title="협력사 스코어카드" bodyClassName="p-0" action={<Pill tone={gradeTone(grade)} solid>{grade}등급 · {VG_GRADE[grade].label}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="text-[14.5px] font-extrabold text-ink">{cur.name}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.code} · {cur.items}</div>
          </div>

          <div className="flex items-center gap-[18px] border-b border-border px-4 py-3.5">
            <div className="text-center">
              <div className="flex items-baseline justify-center gap-0.5"><span className="font-mono text-[38px] font-extrabold leading-none" style={{ color: VG_GRADE[grade].c }}>{cur.score.toFixed(1)}</span><span className="text-[13px] text-ink3">점</span></div>
              <div className="mt-1 text-[9.5px] font-bold" style={{ color: delta >= 0 ? C.ok : C.err }}>{delta >= 0 ? '▲' : '▼'} 전기대비 {Math.abs(delta).toFixed(1)}점</div>
            </div>
            <span className="h-11 w-px bg-border" />
            <div className="flex flex-1 flex-col gap-1.5">
              {[['전체 순위', `${curRank} / ${VG_VENDORS.length}위`], ['검사 LOT', `${cur.lots} LOT`], ['반품 발생', `${cur.ret} 건`]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-[10.5px] text-ink3">{k}</span><span className="font-mono text-[11.5px] font-bold text-ink2">{v}</span></div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-3 text-[10.5px] font-bold text-ink3">평가 지표 (가중치 반영)</div>
            <div className="flex flex-col gap-3">
              {VG_METRICS.map((m, i) => {
                const raw = valOf(cur, m.key);
                const sc = metricScore(raw, m.key);
                const c = sc >= 90 ? C.ok : sc >= 80 ? C.blue : sc >= 70 ? C.warn : C.err;
                return (
                  <div key={i}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-[11px] font-bold text-ink">{m.name} <span className="text-[9px] font-semibold text-ink3">·{m.w}%</span></span>
                      <span className="font-mono text-[10.5px] text-ink2">{m.key === 'defect' || m.key === 'return' ? raw.toLocaleString() : raw}{m.unit === '%' ? '%' : ' ' + m.unit} <b className="ml-1" style={{ color: c }}>{sc.toFixed(0)}점</b></span>
                    </div>
                    <div className="h-1.5 rounded-[3px]" style={{ background: C.bgDeep }}><div className="h-full rounded-[3px]" style={{ width: `${sc}%`, background: c }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: grade === 'D' ? '#fdf1ef' : grade === 'C' ? '#fef6ec' : C.panelAlt }}>
              <span className="text-[13px]">{grade === 'A' || grade === 'B' ? '✓' : '⚠'}</span>
              <span className="text-[10.5px] font-bold" style={{ color: grade === 'D' ? C.err : grade === 'C' ? '#b5731f' : C.ink2 }}>
                {grade === 'A' ? '우수 협력사 — 검사 완화(스킵랏) 대상' : grade === 'B' ? '양호 — 현행 검사 수준 유지' : grade === 'C' ? '주의 — 검사 강화 + 개선 요청' : '관리 대상 — 거래 제한 검토 / 정기 감사'}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.navy }}>평가 결과 통보 →</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">이력</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
