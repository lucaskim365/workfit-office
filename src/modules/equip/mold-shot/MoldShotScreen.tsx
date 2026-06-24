import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { useMoldShots } from '@/features/moldShot/useMoldShots';
import type { MoldShot } from '@/domain/moldShot/schema';
import { C, KpiGrid } from '../_maint';

const SHOT_TREND: Record<string, number[]> = {
  'MD-PRS-210': [3900, 4100, 4300, 4000, 4200, 3800, 4200],
  'MD-INJ-103': [1900, 2000, 1850, 1750, 1900, 1800, 1850],
  'MD-PRS-211': [6100, 6300, 6200, 6400, 6000, 6200, 0],
  'MD-INJ-101': [2900, 3000, 2850, 3100, 2950, 3000, 3100],
  'MD-INJ-102': [2200, 2300, 2400, 2250, 2350, 2400, 2400],
};
interface Log { date: string; type: string; val: string; cum: string; who: string }
const SHOT_LOG: Record<string, Log[]> = {
  'MD-PRS-210': [
    { date: '06-10', type: '카운트', val: '+4,200', cum: '940,000', who: '자동수집' },
    { date: '05-28', type: '점검', val: '–', cum: '912,400', who: '박정비' },
    { date: '03-02', type: '리셋', val: '보정 −1,200', cum: '740,000', who: '박정비' },
    { date: '2021-04', type: '등록', val: '초기 0', cum: '0', who: '시스템' },
  ],
  'MD-INJ-103': [
    { date: '06-10', type: '카운트', val: '+1,850', cum: '980,000', who: '자동수집' },
    { date: '04-12', type: '수리', val: '코어 교체', cum: '870,000', who: '대성몰드' },
    { date: '2019-06', type: '등록', val: '초기 0', cum: '0', who: '시스템' },
  ],
  'MD-PRS-211': [{ date: '06-09', type: '카운트', val: '+6,200', cum: '1,480,000', who: '자동수집' }, { date: '04-20', type: '수리', val: '입고(수리중)', cum: '1,468,000', who: '동양프레스' }],
  'MD-INJ-101': [{ date: '06-10', type: '카운트', val: '+3,100', cum: '412,000', who: '자동수집' }, { date: '2023-08', type: '등록', val: '초기 0', cum: '0', who: '시스템' }],
  'MD-INJ-102': [{ date: '06-10', type: '카운트', val: '+2,400', cum: '188,000', who: '자동수집' }, { date: '2022-05', type: '등록', val: '초기 0', cum: '0', who: '시스템' }],
};
const num = (n: number) => n.toLocaleString('ko-KR');
const pctOf = (r: MoldShot) => Math.round((r.cum / r.life) * 100);
const etaDays = (r: MoldShot) => (r.avg > 0 ? Math.max(Math.round((r.life - r.cum) / r.avg), 0) : null);
const shotState = (r: MoldShot) => { const p = pctOf(r); return p >= 100 ? '한계초과' : p >= 95 ? '교체임박' : p >= 85 ? '주의' : '정상'; };
const shotTone = (s: string): Tone => (s === '정상' ? 'ok' : s === '주의' ? 'warn' : s === '교체임박' ? 'warn' : 'err');
const logTone = (t: string): Tone => (t === '카운트' ? 'info' : t === '리셋' ? 'warn' : t === '수리' ? 'err' : t === '점검' ? 'ok' : 'mute');

function LifeBar({ pct }: { pct: number }) {
  const c = pct >= 95 ? C.err : pct >= 85 ? C.warn : C.teal;
  return (
    <div className="relative h-2 min-w-[90px] rounded" style={{ background: C.bgDeep }}>
      <div className="absolute inset-0 rounded" style={{ width: `${Math.min(pct, 100)}%`, background: c }} />
      <div className="absolute -top-0.5 -bottom-0.5 w-0.5" style={{ left: '85%', background: C.warn }} title="교체 권고선(85%)" />
    </div>
  );
}

/** 금형 타수(Shot) 관리 — 와이어프레임 mold-shot.jsx 정본. */
export default function MoldShotScreen() {
  const [sel, setSel] = useState('MD-PRS-210');
  const { data: rows, isLoading } = useMoldShots();

  // 로딩·빈 데이터 가드 — 데이터 도착 전 차트·KPI 산식이 0 나눗셈에 걸리지 않게 한다.
  if (isLoading || !rows) {
    return <div className="p-6 text-sm text-ink3">불러오는 중…</div>;
  }
  if (rows.length === 0) {
    return <div className="p-6 text-sm text-ink3">금형 타수 데이터가 없습니다.</div>;
  }

  const cur = rows.find((r) => r.code === sel) || rows[0];
  const curPct = pctOf(cur);
  const curEta = etaDays(cur);
  const trend = SHOT_TREND[cur.code] || [];
  const log = SHOT_LOG[cur.code] || [];

  const todayTotal = rows.reduce((s, r) => s + r.today, 0);
  const running = rows.filter((r) => r.today > 0).length;
  const nearLimit = rows.filter((r) => pctOf(r) >= 85 && pctOf(r) < 100).length;
  const overLimit = rows.filter((r) => pctOf(r) >= 100).length;
  const avgUse = Math.round(rows.reduce((s, r) => s + pctOf(r), 0) / rows.length);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">금형 타수(Shot) 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 금형 및 치공구 관리 / 금형 타수(Shot) 관리</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '타수 보정/리셋', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['금일 누적 타수', num(todayTotal), 'shot', C.ink], ['가동중 금형', '' + running, '식', C.ok], ['교체 임박(85%+)', '' + nearLimit, '식', C.warn],
        ['수명 초과', '' + overLimit, '식', C.err], ['평균 소진율', '' + avgUse, '%', C.ink],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_340px]">
        {/* 타수 현황 */}
        <Card title="금형별 타수 현황" bodyClassName="p-0" action={<span className="text-[10px] text-ink3">설비 카운터 자동 수집 · 09:40 기준</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['금형 / 설비', 'text-left'], ['수명 소진', 'text-left'], ['누적 / 수명', 'text-right'], ['금일', 'text-right'], ['예상 도달', 'text-right'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const on = r.code === sel, p = pctOf(r), eta = etaDays(r), st = shotState(r);
                return (
                  <tr key={r.code} onClick={() => setSel(r.code)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{r.name}</div>
                      <div className="mt-px font-mono text-[9.5px] text-ink3">{r.asset} · {r.eq}</div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5">
                      <div className="min-w-[110px]"><LifeBar pct={p} /><div className="mt-1 font-mono text-[9px] font-bold" style={{ color: p >= 85 ? C.warn : C.ink3 }}>{p}%</div></div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2"><b className="text-ink">{num(r.cum)}</b><div className="text-[9px] text-ink3">/ {num(r.life)}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: r.today > 0 ? C.blue : C.ink3 }}>{r.today > 0 ? '+' + num(r.today) : '정지'}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: eta != null && eta <= 5 ? C.err : eta != null && eta <= 15 ? C.warn : C.ink2 }}>{eta != null ? (eta === 0 ? '도달' : `D−${eta}`) : '–'}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={shotTone(st)}>{st}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 타수 상세 */}
        <Card title="타수 상세" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.asset}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span>
              <Pill tone={shotTone(shotState(cur))}>{shotState(cur)}</Pill>
            </div>
            <div className="font-mono text-[10.5px] text-ink3">{cur.code} · {cur.eq} · {cur.item}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex">
              {([['누적 타수', num(cur.cum), C.ink], ['잔여', num(cur.life - cur.cum), curPct >= 85 ? C.warn : C.teal], ['예상 도달', curEta != null ? (curEta === 0 ? '도달' : `${curEta}일`) : '–', curEta != null && curEta <= 15 ? C.err : C.ink2]] as const).map(([k, v, c], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <div className="font-mono text-[15px] font-extrabold tabular-nums" style={{ color: c }}>{v}</div>
                  <div className="text-[9.5px] text-ink3">{k}</div>
                </div>
              ))}
            </div>
            <LifeBar pct={curPct} />
            <div className="mt-1.5 flex justify-between text-[9.5px] text-ink3">
              <span>소진율 <b style={{ color: curPct >= 85 ? C.warn : C.ink2 }}>{curPct}%</b></span>
              <span>일평균 <b className="text-ink2">{num(cur.avg)} shot</b></span>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">일별 타수 추이 (최근 7일)</div>
            <LineChart series={[{ data: trend, c: C.teal }]} labels={['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', '금일']} h={120} area />
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">타수 이력</div>
            <div className="flex flex-col">
              {log.map((l, i) => (
                <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: i < log.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="w-12 shrink-0 font-mono text-[9.5px] text-ink3">{l.date}</span>
                  <Pill tone={logTone(l.type)}>{l.type}</Pill>
                  <span className="flex-1 text-[10.5px] font-semibold text-ink2">{l.val}</span>
                  <span className="font-mono text-[9.5px] text-ink3">{l.cum}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
