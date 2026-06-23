import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';

const GAGE_CAT: Record<string, Tone> = { 캘리퍼스: 'info', 마이크로미터: 'info', 하이트게이지: 'ok', 다이얼게이지: 'ok', 저울: 'warn', 압력계: 'mute', 온도센서: 'mute', 토크렌치: 'warn' };
interface Gage { sn: string; name: string; cat: string; maker: string; model: string; intro: string; range: string; tol: string; unit: string; loc: string; dept: string; cycle: number; lastCal: string; nextCal: string; state: string }
const GAGES: Gage[] = [
  { sn: 'CAL-2401-001', name: '디지털 버니어캘리퍼스', cat: '캘리퍼스', maker: 'Mitutoyo', model: 'CD-15APX', intro: '2024-01-12', range: '0–150 mm', tol: '±0.02 mm', unit: 'mm', loc: '계측실 G-01', dept: '품질팀', cycle: 12, lastCal: '2025-12-10', nextCal: '2026-12-10', state: '사용중' },
  { sn: 'CAL-2312-014', name: '정밀 전자저울', cat: '저울', maker: 'A&D', model: 'GF-3000', intro: '2023-12-03', range: '0–3,000 g', tol: '±0.1 g', unit: 'g', loc: '검사실 Q-02', dept: '품질팀', cycle: 6, lastCal: '2026-01-05', nextCal: '2026-07-05', state: '사용중' },
  { sn: 'CAL-2305-007', name: '디지털 압력계', cat: '압력계', maker: 'WIKA', model: 'CPG500', intro: '2023-05-20', range: '0–25 bar', tol: '±0.25 %FS', unit: 'bar', loc: '설비동 E-04', dept: '설비팀', cycle: 12, lastCal: '2025-06-18', nextCal: '2026-06-18', state: '검교정중' },
  { sn: 'CAL-2402-022', name: '표준 온도센서(RTD)', cat: '온도센서', maker: 'Fluke', model: '1551A', intro: '2024-02-28', range: '−50–160 ℃', tol: '±0.05 ℃', unit: '℃', loc: '계측실 G-03', dept: '품질팀', cycle: 12, lastCal: '2025-07-01', nextCal: '2026-07-01', state: '사용중' },
  { sn: 'CAL-2208-003', name: '하이트게이지', cat: '하이트게이지', maker: 'Mitutoyo', model: 'HDS-H60C', intro: '2022-08-15', range: '0–600 mm', tol: '±0.03 mm', unit: 'mm', loc: '계측실 G-02', dept: '품질팀', cycle: 12, lastCal: '2025-09-12', nextCal: '2026-09-12', state: '사용중' },
  { sn: 'CAL-2403-019', name: '외측 마이크로미터', cat: '마이크로미터', maker: 'Mitutoyo', model: '293-340', intro: '2024-03-10', range: '0–25 mm', tol: '±0.001 mm', unit: 'mm', loc: '계측실 G-01', dept: '품질팀', cycle: 12, lastCal: '2025-05-20', nextCal: '2026-05-20', state: '사용중지' },
  { sn: 'CAL-2310-011', name: '디지털 토크렌치', cat: '토크렌치', maker: 'Tohnichi', model: 'CEM100N3', intro: '2023-10-08', range: '20–100 N·m', tol: '±3 %', unit: 'N·m', loc: '설비동 E-01', dept: '설비팀', cycle: 6, lastCal: '2026-02-14', nextCal: '2026-08-14', state: '사용중' },
  { sn: 'CAL-2406-030', name: '다이얼게이지', cat: '다이얼게이지', maker: 'Teclock', model: 'TM-110', intro: '2024-06-22', range: '0–10 mm', tol: '±0.01 mm', unit: 'mm', loc: '검사실 Q-01', dept: '품질팀', cycle: 12, lastCal: '2025-10-30', nextCal: '2026-10-30', state: '사용중' },
];
const stTone = (s: string): Tone => (s === '사용중' ? 'ok' : s === '검교정중' ? 'info' : s === '사용중지' ? 'err' : 'mute');
const BASE = Date.UTC(2026, 5, 21);
const dday = (d: string) => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - BASE) / 86400000);
const ddColor = (n: number) => (n < 0 ? C.err : n <= 30 ? C.warn : C.ink2);

/** 계측기 마스터 등록 — 와이어프레임 gage-master.jsx 정본. */
export default function GageMasterScreen() {
  const [sel, setSel] = useState('CAL-2305-007');
  const [q, setQ] = useState('');
  const cur = GAGES.find((g) => g.sn === sel) || GAGES[0];
  const rows = GAGES.filter((g) => !q || g.name.includes(q) || g.sn.toLowerCase().includes(q.toLowerCase()) || g.model.toLowerCase().includes(q.toLowerCase()));
  const curDd = dday(cur.nextCal);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">계측기 마스터 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 계측기 및 검교정 관리 / 계측기 마스터 등록</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '계측기 등록', variant: 'primary' }, 'save', 'upload', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['총 등록 계측기', '' + GAGES.length, '대', C.ink],
        ['사용중', '' + GAGES.filter((g) => g.state === '사용중').length, '대', C.ok],
        ['검교정중', '' + GAGES.filter((g) => g.state === '검교정중').length, '대', C.blue],
        ['사용중지', '' + GAGES.filter((g) => g.state === '사용중지').length, '대', C.err],
        ['검교정 임박(30일)', '' + GAGES.filter((g) => { const d = dday(g.nextCal); return d >= 0 && d <= 30; }).length, '대', C.warn],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        {/* 목록 */}
        <Card
          title="계측기 목록"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-3 rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-ink">전체 분류 <span className="text-[8px] text-ink3">▾</span></span>
              <div className="flex items-center gap-1.5 rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5">
                <span className="text-[11px] text-ink3">⌕</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="시리얼·모델·품명" className="w-[120px] bg-transparent text-[11px] text-ink outline-none" />
              </div>
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['시리얼 / 품명', 'text-left'], ['분류', 'text-center'], ['허용오차', 'text-right'], ['차기 검교정', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((g, i) => {
                const on = g.sn === sel, d = dday(g.nextCal);
                return (
                  <tr key={g.sn} onClick={() => setSel(g.sn)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{g.name}</div>
                      <div className="mt-px font-mono text-[9.5px] text-ink3">{g.sn} · {g.maker} {g.model}</div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={GAGE_CAT[g.cat]}>{g.cat}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink">{g.tol}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px]">
                      <div className="text-ink2">{g.nextCal.slice(2)}</div>
                      <div className="text-[9px] font-bold" style={{ color: ddColor(d) }}>{d < 0 ? `${-d}일 경과` : `D−${d}`}</div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(g.state)}>{g.state}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="계측기 상세" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.sn}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-ink">{cur.name}</span>
              <span className="flex gap-1.5"><Pill tone={GAGE_CAT[cur.cat]}>{cur.cat}</Pill><Pill tone={stTone(cur.state)}>{cur.state}</Pill></span>
            </div>
            <div className="font-mono text-[11px] text-ink3">{cur.maker} {cur.model}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">기본 정보</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['제조사', cur.maker], ['도입일', cur.intro], ['측정범위', cur.range], ['보관위치', cur.loc], ['관리부서', cur.dept], ['검교정주기', cur.cycle + '개월']].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-right text-[11.5px] font-bold text-ink2 ${/\d/.test('' + v) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">허용 오차 범위</div>
            <div className="flex items-center justify-center rounded-[9px] py-3.5" style={{ background: '#e7eefc' }}>
              <span className="font-mono text-[26px] font-extrabold tracking-tight" style={{ color: C.blue }}>{cur.tol}</span>
            </div>
            <div className="mt-1.5 text-center text-[9.5px] text-ink3">검교정 시 이 오차 범위를 초과하면 불합격 처리</div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">검교정 정보</div>
            <div className="flex">
              {([['최근 검교정', cur.lastCal.slice(2), C.ink2], ['차기 예정', cur.nextCal.slice(2), C.ink], [curDd < 0 ? '경과' : '잔여', curDd < 0 ? `${-curDd}일` : `${curDd}일`, ddColor(curDd)]] as const).map(([k, v, c], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <div className="font-mono text-[14px] font-extrabold tabular-nums" style={{ color: c }}>{v}</div>
                  <div className="mt-0.5 text-[9.5px] text-ink3">{k}</div>
                </div>
              ))}
            </div>
            {curDd <= 30 && cur.state !== '검교정중' && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: curDd < 0 ? '#fdecea' : '#fef6ec', border: `1px solid ${curDd < 0 ? C.err : C.warn}` }}>
                <span className="text-[12px]">{curDd < 0 ? '⛔' : '⚠'}</span>
                <span className="text-[10.5px] font-bold" style={{ color: curDd < 0 ? C.err : '#b5731f' }}>{curDd < 0 ? `검교정 기한 ${-curDd}일 경과 — 사용 중지 권고` : `검교정 예정일 ${curDd}일 전 — 계획 등록 필요`}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
