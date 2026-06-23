import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C, KpiGrid, ChipTabs } from '../_qual';

const AL_TYPE: Record<string, { c: string; label: string }> = { OOS: { c: C.err, label: '규격이탈' }, OOC: { c: C.warn, label: '관리이탈' }, 규칙위반: { c: '#8a5cf6', label: '규칙위반' }, 설비이상: { c: C.blue, label: '설비이상' } };
const AL_ST: Record<string, Tone> = { 미확인: 'err', 확인: 'warn', 조치중: 'warn', 해제: 'ok' };
const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');

interface Alarm { id: string; time: string; ago: string; type: string; sev: string; prod: string; code: string; char: string; proc: string; val: number; lo: number; hi: number; cl: number; kind: string; unit: string; status: string; pic: string; src: string; trend: number[]; msg: string }
const ALARMS: Alarm[] = [
  { id: 'AL-1042', time: '15:42:08', ago: '방금', type: 'OOS', sev: '치명', prod: '브래킷 ASSY-A', code: 'FG-BRK-A', char: '외경(O.D)', proc: 'CNC-03', val: 25.06, lo: 24.95, hi: 25.05, cl: 25.0, kind: '규격', unit: 'mm', status: '미확인', pic: '미배정', src: 'CMM 자동수집', trend: [25.01, 25.02, 25.03, 25.04, 25.05, 25.06], msg: '규격상한(USL 25.05mm) 초과 — 부적합품 발생. 즉시 설비 정지·격리 필요.' },
  { id: 'AL-1041', time: '15:38:51', ago: '3분 전', type: 'OOC', sev: '주요', prod: '체결 토크', code: 'PROC-ASM', char: '토크', proc: 'ASM-05', val: 13.5, lo: 10.6, hi: 13.4, cl: 12.0, kind: '관리한계', unit: 'N·m', status: '확인', pic: '이품질', src: '토크 시스템', trend: [12.0, 12.4, 12.8, 13.1, 13.3, 13.5], msg: '관리상한(UCL 13.4) 초과 — 공정 평균 상향 이동. 조건 점검 필요.' },
  { id: 'AL-1040', time: '15:31:20', ago: '11분 전', type: '규칙위반', sev: '주요', prod: '하우징 C-Type', code: 'FG-HSG-C', char: '중량', proc: 'INJ-02', val: 50.3, lo: 48.6, hi: 51.6, cl: 50.1, kind: '관리한계', unit: 'g', status: '조치중', pic: '김검사', src: 'SPC 엔진', trend: [50.0, 50.1, 50.2, 50.2, 50.3, 50.3], msg: 'Rule 2 — 연속 8점 중심선 상측. 공정 평균 이동 의심.' },
  { id: 'AL-1039', time: '15:18:05', ago: '24분 전', type: 'OOC', sev: '주요', prod: '두께(t)', code: 'FG-CVR-B', char: '두께', proc: 'PRS-07', val: 1.962, lo: 1.964, hi: 2.038, cl: 2.001, kind: '관리한계', unit: 'mm', status: '조치중', pic: '이품질', src: '인프로세스 게이지', trend: [2.0, 1.99, 1.98, 1.97, 1.97, 1.962], msg: '관리하한(LCL 1.964) 이탈 — 프레스 다이 점검 진행중.' },
  { id: 'AL-1037', time: '14:52:33', ago: '50분 전', type: 'OOS', sev: '치명', prod: '샤프트 D-40', code: 'FG-SFT-D', char: '진원도', proc: 'GRD-02', val: 0.035, lo: 0, hi: 0.02, cl: 0.01, kind: '규격', unit: 'mm', status: '해제', pic: '김검사', src: 'CMM 자동수집', trend: [0.012, 0.018, 0.022, 0.028, 0.032, 0.035], msg: '규격상한(0.02mm) 초과 — 척 클램프 교체 후 해제.' },
  { id: 'AL-1035', time: '14:40:11', ago: '62분 전', type: '설비이상', sev: '경미', prod: '디지털 캘리퍼 GW', code: 'IF-GAGE-05', char: '통신', proc: 'LTH-05', val: 0, lo: 0, hi: 1, cl: 1, kind: '상태', unit: '', status: '해제', pic: '설비팀', src: '인터페이스', trend: [1, 1, 1, 0, 0, 0], msg: '계측 인터페이스 단절 — 수동입력 전환 후 통신 복구.' },
];
const fmtV = (v: number, u: string) => (u === 'mm' ? v.toFixed(3) : u === 'g' || u === 'N·m' ? v.toFixed(1) : '' + v);
const WF_ORDER: Record<string, number> = { 미확인: 0, 확인: 1, 조치중: 2, 해제: 4 };

function LimitBar({ a }: { a: Alarm }) {
  const span = a.hi - a.lo || 1;
  const lo = a.lo - span * 0.45, hi = a.hi + span * 0.45;
  const pos = (v: number) => Math.max(2, Math.min(98, ((v - lo) / (hi - lo)) * 100));
  const out = a.val > a.hi || a.val < a.lo;
  return (
    <div className="px-0.5 pb-0.5 pt-1">
      <div className="relative mb-[22px] h-3 rounded-md" style={{ background: '#fdecea' }}>
        <div className="absolute top-0 bottom-0 rounded" style={{ left: pos(a.lo) + '%', width: pos(a.hi) - pos(a.lo) + '%', background: C.tealSoft }} />
        <div className="absolute -top-[3px] -bottom-[3px] w-[1.5px]" style={{ left: pos(a.cl) + '%', background: C.ink3 }} />
        <div className="absolute top-3.5 -translate-x-1/2 font-mono text-[8px] font-bold" style={{ left: pos(a.lo) + '%', color: C.err }}>{a.kind === '규격' ? 'LSL' : 'LCL'} {fmtV(a.lo, a.unit)}</div>
        <div className="absolute top-3.5 -translate-x-1/2 font-mono text-[8px] font-bold" style={{ left: pos(a.hi) + '%', color: C.err }}>{a.kind === '규격' ? 'USL' : 'UCL'} {fmtV(a.hi, a.unit)}</div>
        <div className="absolute -top-[5px] -translate-x-1/2" style={{ left: pos(a.val) + '%' }}>
          <span className="block h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ background: out ? C.err : C.navy }} />
        </div>
      </div>
    </div>
  );
}

/** 품질 이상 실시간 알람(OOS/OOC) — 와이어프레임 qual-spc-alarm.jsx 정본. */
export default function QualSpcAlarmScreen() {
  const [sel, setSel] = useState('AL-1042');
  const [tab, setTab] = useState('활성');
  const cur = ALARMS.find((a) => a.id === sel) || ALARMS[0];
  const rows = ALARMS.filter((a) => tab === '전체' || (tab === '활성' ? a.status !== '해제' : a.status === '해제'));

  const unack = ALARMS.filter((a) => a.status === '미확인').length;
  const active = ALARMS.filter((a) => a.status !== '해제').length;
  const oosCnt = ALARMS.filter((a) => a.type === 'OOS' && a.status !== '해제').length;
  const oocCnt = ALARMS.filter((a) => a.type === 'OOC' && a.status !== '해제').length;
  const curOut = cur.val > cur.hi || cur.val < cur.lo;
  const order = WF_ORDER[cur.status];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">품질 이상 실시간 알람 (OOS/OOC)</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 통계적 공정관리(SPC) / 품질 이상 실시간 알람(OOS/OOC)</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '전체 확인', variant: 'primary' }, 'refresh']} />
      </div>

      <KpiGrid cols={5} items={[
        ['미확인 알람', '' + unack, '건', C.err],
        ['활성 알람', '' + active, '건', C.warn],
        ['OOS (규격이탈)', '' + oosCnt, '건', C.err],
        ['OOC (관리이탈)', '' + oocCnt, '건', C.warn],
        ['금일 누적', '' + ALARMS.length, '건', C.ink],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.75fr_1fr]">
        {/* 피드 */}
        <Card title="실시간 알람 피드" bodyClassName="p-0" action={
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold" style={{ color: C.err }}><span className="h-[7px] w-[7px] rounded-full" style={{ background: C.err }} />LIVE</span>
            <ChipTabs items={['활성', '해제', '전체']} value={tab} onChange={setTab} />
          </div>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['시각 / 알람', 'text-left'], ['유형', 'text-center'], ['제품 · 특성 / 공정', 'text-left'], ['측정 / 한계', 'text-right'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => {
                const on = a.id === sel;
                const t = AL_TYPE[a.type];
                const out = a.val > a.hi || a.val < a.lo;
                return (
                  <tr key={a.id} onClick={() => setSel(a.id)} className="cursor-pointer" style={{ background: on ? C.tealSoft : a.status === '미확인' ? '#fdf6f5' : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: `3px solid ${a.status === '해제' ? 'transparent' : t.c}` }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{a.time}</div>
                      <div className="mt-px text-[9px] text-ink3">{a.id} · {a.ago}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ color: t.c, border: `1px solid ${t.c}55` }}>{a.type}</span>
                      <div className="mt-1"><Pill tone={sevTone(a.sev)} solid={a.sev === '치명'}>{a.sev}</Pill></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{a.prod} · {a.char}</div><div className="mt-px font-mono text-[9px] text-ink3">{a.proc} · {a.src}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono">
                      <div className="text-[11px] font-extrabold" style={{ color: out ? C.err : C.ink }}>{fmtV(a.val, a.unit)}</div>
                      <div className="text-[8.5px] text-ink3">{a.kind === '규격' ? 'SL' : 'CL'} {fmtV(a.lo, a.unit)}~{fmtV(a.hi, a.unit)}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={AL_ST[a.status]} solid={a.status === '미확인'}>{a.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="알람 상세" bodyClassName="p-0" action={<Pill tone={AL_ST[cur.status]} solid={cur.status === '미확인'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: cur.status === '미확인' ? '#fdf1ef' : C.panelAlt }}>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] font-extrabold" style={{ color: AL_TYPE[cur.type].c, border: `1px solid ${AL_TYPE[cur.type].c}` }}>{cur.type} · {AL_TYPE[cur.type].label}</span>
              <Pill tone={sevTone(cur.sev)} solid={cur.sev === '치명'}>{cur.sev}</Pill>
              <span className="ml-auto font-mono text-[9px] text-ink3">{cur.id}</span>
            </div>
            <div className="text-[14px] font-extrabold text-ink">{cur.prod} · {cur.char}</div>
            <div className="mt-0.5 font-mono text-[10px] text-ink3">{cur.proc} · {cur.time}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[10px] font-bold text-ink3">측정값</span>
              <span className="flex items-baseline gap-1"><span className="font-mono text-[26px] font-extrabold leading-none" style={{ color: curOut ? C.err : C.ink }}>{fmtV(cur.val, cur.unit)}</span><span className="text-[11px] text-ink3">{cur.unit}</span></span>
            </div>
            <LimitBar a={cur} />
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="flex items-start gap-2 rounded-lg px-2.5 py-2" style={{ background: cur.type === 'OOS' ? '#fdf1ef' : '#fef6ec', border: `1px solid ${cur.type === 'OOS' ? C.err : C.warn}33` }}>
              <span className="text-[13px]">⚠</span>
              <span className="text-[10.5px] font-bold leading-relaxed" style={{ color: cur.type === 'OOS' ? C.err : '#b5731f' }}>{cur.msg}</span>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="text-[9.5px] font-bold text-ink3">최근 추이</span>
              <span className="inline-block"><Sparkline data={cur.trend} w={120} h={26} color={curOut ? C.err : C.warn} /></span>
              <span className="ml-auto text-[9px] text-ink3">검출 {cur.src}</span>
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 text-[10px] font-bold text-ink3">조치 워크플로우</div>
            <div className="mb-3 flex items-center">
              {['확인', '봉쇄조치', '원인조치', '해제'].map((s, i) => {
                const done = i < order;
                const active = i === order;
                return (
                  <Fragment key={i}>
                    {i > 0 && <span className="h-0.5 flex-1" style={{ background: i <= order ? C.ok : C.border }} />}
                    <div className="flex w-[52px] flex-col items-center gap-1">
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[10px] font-extrabold" style={{ color: done || active ? '#fff' : C.ink3, background: done ? C.ok : active ? C.navy : '#fff', border: done || active ? 'none' : `1.5px solid ${C.borderHi}` }}>{done ? '✓' : i + 1}</span>
                      <span className="text-[8.5px] font-bold" style={{ color: active ? C.ink : C.ink3 }}>{s}</span>
                    </div>
                  </Fragment>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: cur.status === '해제' ? C.borderHi : C.navy }}>{cur.status === '미확인' ? '알람 확인 →' : cur.status === '해제' ? '해제 완료됨' : '조치 진행 →'}</button>
              {cur.type === 'OOS' && cur.status !== '해제' && <button className="h-[38px] rounded-lg border bg-panel px-3 text-[12px] font-bold" style={{ borderColor: C.err, color: C.err }}>NCR 발행</button>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
