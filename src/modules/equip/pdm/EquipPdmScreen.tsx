import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C } from '../_maint';
import { usePdmEquipments } from '@/features/pdmEquipment/usePdmEquipments';

const pdmTone = (s: string): Tone => (s === '위험' ? 'err' : s === '주의' ? 'warn' : 'ok');
const pdmColor = (s: string) => (s === '위험' ? C.err : s === '주의' ? C.amber : C.teal);

interface Sensor { color: string; warn: number; crit: number; data: number[]; unit: string }
const sensorData: Record<string, Sensor> = {
  '진동 (mm/s)': { color: '#3a6ee0', warn: 4.5, crit: 6.0, unit: 'mm/s', data: [2.1, 2.0, 2.2, 2.3, 2.2, 2.4, 2.5, 2.4, 2.6, 2.8, 2.7, 2.9, 3.1, 3.0, 3.3, 3.5, 3.4, 3.8, 4.0, 4.2, 4.1, 4.5, 4.7, 4.6, 5.0, 5.3, 5.2, 5.6, 5.9, 6.1] },
  '히터존 편차 (°C)': { color: '#e0564f', warn: 8, crit: 12, unit: '°C', data: [3.2, 3.0, 3.5, 3.4, 3.8, 4.0, 4.2, 4.5, 4.3, 5.0, 5.4, 5.2, 6.1, 6.5, 6.3, 7.2, 7.8, 7.5, 8.4, 9.1, 8.8, 9.6, 10.2, 10.0, 11.1, 11.8, 11.5, 12.4, 13.0, 13.5] },
  '소비전류 (A)': { color: '#8b6fd6', warn: 52, crit: 58, unit: 'A', data: [44, 44, 45, 45, 46, 45, 47, 46, 47, 48, 47, 49, 48, 50, 49, 51, 50, 52, 51, 53, 52, 54, 53, 55, 54, 56, 55, 57, 56, 58] },
};

function PdmSpark({ s, w = 560, h = 150 }: { s: Sensor; w?: number; h?: number }) {
  const max = Math.max(s.crit * 1.08, ...s.data);
  const min = Math.min(...s.data) * 0.85;
  const n = s.data.length;
  const x = (i: number) => 8 + (i / (n - 1)) * (w - 16);
  const y = (v: number) => h - 8 - ((v - min) / (max - min)) * (h - 24);
  const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `8,${h - 8} ` + pts + ` ${x(n - 1)},${h - 8}`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block" preserveAspectRatio="none">
      <line x1="8" x2={w - 8} y1={y(s.crit)} y2={y(s.crit)} stroke="#e0564f" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      <line x1="8" x2={w - 8} y1={y(s.warn)} y2={y(s.warn)} stroke="#ef8f43" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
      <text x={w - 10} y={y(s.crit) - 4} textAnchor="end" fontSize="9" fill="#e0564f" fontWeight="700">위험 {s.crit}</text>
      <text x={w - 10} y={y(s.warn) - 4} textAnchor="end" fontSize="9" fill="#ef8f43" fontWeight="700">경고 {s.warn}</text>
      <polygon points={area} fill={s.color} opacity="0.08" />
      <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
      {s.data.map((v, i) => (i === n - 1 ? <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={v >= s.crit ? '#e0564f' : v >= s.warn ? '#ef8f43' : s.color} stroke="#fff" strokeWidth="1.5" /> : null))}
    </svg>
  );
}

const PDM_ALARMS: [string, string, string, string, string][] = [
  ['06-10 07:55', 'Thermal 05호기', '히터존 편차 임계 초과 예측', '위험', 'RUL 6일 — 즉시 점검 권고'],
  ['06-10 03:12', 'Thermal 05호기', '진동 이상 패턴 감지', '위험', '베어링 결함 의심 (FFT 2X 피크)'],
  ['06-09 18:40', 'CMP 02호기', '구동부 진동 상승 추세', '주의', 'RUL 18일 — PM 일정 조정 검토'],
  ['06-09 09:25', 'Implant 02호기', '이온소스 전류 변동성 증가', '주의', '필라멘트 열화 초기 징후'],
  ['06-08 14:10', 'CMP 02호기', '슬러리 유량 미세 편차', '관찰', '정상 범위 내 변동 — 모니터링'],
];
const almTone = (s: string): Tone => (s === '위험' ? 'err' : s === '주의' ? 'warn' : 'info');

const BASE = Date.UTC(2026, 5, 10);
const failDate = (rul: number) => new Date(BASE + rul * 864e5).toISOString().slice(0, 10);
const trIcon = (t: string) => (t === 'down' ? '▼' : t === 'up' ? '▲' : '▬');
const trColor = (t: string) => (t === 'down' ? C.err : t === 'up' ? C.teal : C.ink3);

/** 예지보전(PdM) 이상 감지 — 와이어프레임 equip-pdm.jsx 정본. */
export default function EquipPdmScreen() {
  const { data: pdmEq = [], isLoading } = usePdmEquipments();
  const [sel, setSel] = useState('EQ-OVEN05');
  const [metric, setMetric] = useState('진동 (mm/s)');
  const cur = pdmEq.find((e) => e.code === sel) || pdmEq[0];
  const s = sensorData[metric];
  const last = s.data[s.data.length - 1];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '예지보전 대상 설비가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">예지보전(PdM) 이상 감지</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 보전 및 점검 / 예지보전(PdM) 이상 감지</p>
        </div>
        <ActionBar actions={['download', { icon: 'save', label: 'BM 작업요청', variant: 'primary' }]} />
      </div>

      {/* AI 상태 배너 */}
      <div className="flex flex-wrap items-center gap-3.5 rounded-[11px] px-5 py-3 text-white" style={{ background: C.navy }}>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold"><span className="h-2 w-2 rounded-full" style={{ background: C.teal, boxShadow: `0 0 0 4px ${C.teal}33` }} />PdM 예측 엔진 가동중</span>
        <span className="text-[11px] text-white/60">모델 v2.4 · 진동/온도/전류 센서 18ch · 최근 분석 09:00</span>
        <span className="ml-auto flex gap-[18px]">
          {([['모니터링 설비', '6', '#fff'], ['이상 감지', '4', C.amber], ['고장 임박(7일내)', '2', C.err]] as const).map(([k, v, c]) => (
            <span key={k} className="flex flex-col items-end"><span className="text-[9.5px] text-white/55">{k}</span><span className="text-[15px] font-extrabold" style={{ color: c }}>{v}</span></span>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[270px_1fr]">
        {/* 건전성 보드 */}
        <Card title="설비 건전성 (Health Index)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{pdmEq.length}대</span>}>
          <div className="flex flex-col">
            {pdmEq.map((e, i) => {
              const on = e.code === sel;
              return (
                <button key={e.code} onClick={() => setSel(e.code)} className="flex flex-col gap-1.5 px-3.5 py-2.5 text-left" style={{ background: on ? C.tealSoft : undefined, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent', borderBottom: i < pdmEq.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="flex w-full items-center gap-2">
                    <span className="flex-1 text-[12px] font-bold" style={{ color: on ? C.teal : C.ink }}>{e.name}</span>
                    <Pill tone={pdmTone(e.state)}>{e.state}</Pill>
                  </span>
                  <span className="flex w-full items-center gap-2.5">
                    <span className="h-[7px] flex-1 rounded" style={{ background: C.bgDeep }}><span className="block h-full rounded" style={{ width: `${e.health}%`, background: pdmColor(e.state) }} /></span>
                    <span className="w-[26px] text-right text-[12px] font-extrabold tabular-nums" style={{ color: pdmColor(e.state) }}>{e.health}</span>
                  </span>
                  <span className="flex w-full items-center justify-between">
                    <span className="text-[9.5px] text-ink3">잔여수명 <b style={{ color: e.rul <= 7 ? C.err : e.rul <= 20 ? C.warn : C.ink2 }}>{e.rul}일</b></span>
                    <span className="text-[9.5px] text-ink3">{e.driver !== '–' ? e.driver : '안정'} <span className="font-bold" style={{ color: trColor(e.trend) }}>{trIcon(e.trend)}</span></span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 우측 */}
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.1fr_1fr_1fr]">
            <div className="flex items-center gap-4 rounded-[11px] border border-border bg-panel px-4 py-3.5">
              <div className="relative h-[62px] w-[62px] shrink-0">
                <svg width="62" height="62" viewBox="0 0 62 62"><circle cx="31" cy="31" r="26" fill="none" stroke={C.bgDeep} strokeWidth="7" /><circle cx="31" cy="31" r="26" fill="none" stroke={pdmColor(cur.state)} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(cur.health / 100) * 163.4} 163.4`} transform="rotate(-90 31 31)" /></svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[17px] font-extrabold leading-none text-ink">{cur.health}</span><span className="text-[7.5px] text-ink3">Health</span></span>
              </div>
              <div><div className="text-[10.5px] font-semibold text-ink3">{cur.name}</div><div className="text-[13px] font-extrabold" style={{ color: pdmColor(cur.state) }}>{cur.state} 등급</div><div className="mt-0.5 text-[10px] text-ink3">주요인 · {cur.driver}</div></div>
            </div>
            <div className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
              <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">예측 잔여수명 (RUL)</div>
              <div className="flex items-baseline gap-1"><span className="text-[28px] font-extrabold tabular-nums" style={{ color: cur.rul <= 7 ? C.err : C.ink }}>{cur.rul}</span><span className="text-[12px] font-semibold text-ink3">일</span></div>
              <div className="mt-1 text-[10px] text-ink3">예상 고장일 · {failDate(cur.rul)}</div>
            </div>
            <div className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
              <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">이상 스코어</div>
              <div className="flex items-baseline gap-1"><span className="text-[28px] font-extrabold tabular-nums" style={{ color: C.err }}>0.87</span><span className="text-[11px] text-ink3">/ 1.0</span></div>
              <div className="mt-2 h-1.5 rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: '87%', background: C.err }} /></div>
            </div>
          </div>

          {/* 센서 트렌드 */}
          <Card
            title="센서 트렌드 · 이상 예측"
            action={
              <div className="flex gap-1.5">
                {Object.keys(sensorData).map((k) => (
                  <button key={k} onClick={() => setMetric(k)} className="rounded-[7px] px-2.5 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${metric === k ? sensorData[k].color : C.borderHi}`, background: metric === k ? sensorData[k].color : '#fff', color: metric === k ? '#fff' : C.ink2 }}>{k.split(' ')[0]}</button>
                ))}
              </div>
            }
          >
            <PdmSpark s={s} />
            <div className="mt-3 flex gap-5 border-t border-border pt-3">
              {([['현재값', last + ' ' + s.unit, last >= s.crit ? C.err : C.ink], ['경고 임계', s.warn + ' ' + s.unit, C.warn], ['위험 임계', s.crit + ' ' + s.unit, C.err], ['30포인트 추세', '상승', C.err]] as const).map(([k, v, c]) => (
                <span key={k} className="flex flex-col gap-0.5"><span className="text-[10px] text-ink3">{k}</span><span className="text-[13px] font-extrabold tabular-nums" style={{ color: c }}>{v}</span></span>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 이상 감지 알람 */}
      <Card title="이상 감지 알람" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{PDM_ALARMS.length}건</span>}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {[['감지시각', 'left'], ['설비', 'left'], ['이상 내용', 'left'], ['등급', 'center'], ['권고 조치', 'left']].map(([h, al]) => (
                <th key={h} className={`border-b border-border bg-panel-alt px-3.5 py-2.5 text-[10.5px] font-bold text-ink2 ${al === 'center' ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PDM_ALARMS.map((a, i) => (
              <tr key={i} style={{ background: a[3] === '위험' ? '#fdf2f1' : i % 2 ? C.panelAlt : '#fff' }}>
                <td className="border-b border-border px-3.5 py-2.5 font-mono text-[10.5px] text-ink3">{a[0]}</td>
                <td className="border-b border-border px-3.5 py-2.5 font-bold text-ink">{a[1]}</td>
                <td className="border-b border-border px-3.5 py-2.5 font-semibold text-ink2">{a[2]}</td>
                <td className="border-b border-border px-3.5 py-2.5 text-center"><Pill tone={almTone(a[3])}>{a[3]}</Pill></td>
                <td className="border-b border-border px-3.5 py-2.5 text-[11px] text-ink3">{a[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
