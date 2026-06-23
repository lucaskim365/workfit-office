import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';

const PT_RES: Record<string, Tone> = { 정상: 'ok', 이상: 'err', 점검중: 'warn', 미점검: 'mute' };
const TONE_C: Record<Tone, string> = { ok: C.ok, err: C.err, warn: C.warn, mute: C.borderHi, info: C.blue };
const PT_ITEMS = [
  { k: 'std', n: '작업표준 준수' }, { k: 'five', n: '5S·정리정돈' }, { k: 'id', n: '식별·LOT 표시' },
  { k: 'self', n: '자주검사 기록' }, { k: 'iso', n: '부적합품 격리' }, { k: 'eqp', n: '설비 이상음·누유' },
];
type Checks = Record<string, number> | null;
const ptResult = (c: Checks) => (!c ? '미점검' : Object.values(c).some((v) => v === 0) ? '이상' : '정상');

interface Stop { line: string; proc: string; equip: string; time: string; c: Checks; note?: string }
interface Round { id: string; time: string; route: string; pic: string; status: string; dur: string; stops: Stop[] }
const PT_ROUNDS: Round[] = [
  { id: 'PR-260621-3', time: '14:00', route: 'A동 1·2라인', pic: '이순회', status: '진행중', dur: '22분', stops: [
    { line: '1라인 #1', proc: '사출', equip: 'INJ-02', time: '14:03', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '1라인 #3', proc: 'CNC 가공', equip: 'CNC-03', time: '14:09', c: { std: 0, five: 1, id: 1, self: 0, iso: 1, eqp: 1 }, note: '작업표준서 미게시 · 자주검사 기록 2회차 누락' },
    { line: '2라인 #1', proc: '프레스', equip: 'PRS-07', time: '14:15', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '2라인 #2', proc: '프레스', equip: 'PRS-08', time: '14:18', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 0 }, note: '유압유닛 미세 누유 — 설비팀 통보' },
    { line: '2라인 #4', proc: '검사', equip: 'VIS-01', time: '점검중', c: null },
    { line: '1라인 #5', proc: '조립', equip: 'ASM-02', time: '예정', c: null },
    { line: '1라인 #6', proc: '조립', equip: 'ASM-03', time: '예정', c: null },
    { line: 'A동 출하', proc: '포장', equip: 'PKG-01', time: '예정', c: null },
  ] },
  { id: 'PR-260621-2', time: '11:00', route: 'A동 1·2라인', pic: '이순회', status: '완료', dur: '34분', stops: [
    { line: '1라인 #1', proc: '사출', equip: 'INJ-02', time: '11:04', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '1라인 #3', proc: 'CNC 가공', equip: 'CNC-03', time: '11:11', c: { std: 1, five: 0, id: 1, self: 1, iso: 1, eqp: 1 }, note: '가공칩 미정리 — 즉시 시정' },
    { line: '2라인 #1', proc: '프레스', equip: 'PRS-07', time: '11:20', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '2라인 #4', proc: '검사', equip: 'VIS-01', time: '11:28', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
  ] },
  { id: 'PR-260621-1', time: '08:00', route: 'B동 3라인', pic: '김순회', status: '완료', dur: '28분', stops: [
    { line: '3라인 #1', proc: '호빙', equip: 'HOB-01', time: '08:05', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '3라인 #2', proc: '선삭', equip: 'LTH-05', time: '08:14', c: { std: 1, five: 1, id: 0, self: 1, iso: 0, eqp: 1 }, note: 'LOT 식별표 미부착 · 부적합품 미격리' },
    { line: '3라인 #3', proc: '연삭', equip: 'GRD-02', time: '08:24', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
  ] },
  { id: 'PR-260621-4', time: '17:00', route: 'A동 1·2라인', pic: '이순회', status: '예정', dur: '—', stops: [] },
];

/** 공정 순회(Patrol) 검사 — 와이어프레임 qual-pqc-patrol.jsx 정본. */
export default function QualPqcPatrolScreen() {
  const [sel, setSel] = useState('PR-260621-3');
  const [stopIdx, setStopIdx] = useState(1);
  const cur = PT_ROUNDS.find((r) => r.id === sel) || PT_ROUNDS[0];
  useEffect(() => { const ab = cur.stops.findIndex((s) => ptResult(s.c) === '이상'); setStopIdx(ab >= 0 ? ab : 0); }, [sel]);

  const doneStops = (r: Round) => r.stops.filter((s) => s.c).length;
  const abn = (r: Round) => r.stops.filter((s) => ptResult(s.c) === '이상').length;

  const todayAbn = PT_ROUNDS.reduce((s, r) => s + abn(r), 0);
  const inProg = PT_ROUNDS.filter((r) => r.status === '진행중').length;
  const doneRounds = PT_ROUNDS.filter((r) => r.status === '완료').length;
  const totalChecked = PT_ROUNDS.reduce((s, r) => s + doneStops(r), 0);

  const stop = cur.stops[stopIdx];
  const stopRes = stop ? ptResult(stop.c) : '미점검';

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공정 순회(Patrol) 검사</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 공정검사(PQC) / 공정 순회(Patrol) 검사</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '순회 시작', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['금일 순회 라운드', '' + PT_ROUNDS.length, '회', C.ink],
        ['진행중', '' + inProg, '회', C.warn],
        ['완료', '' + doneRounds, '회', C.ok],
        ['점검 지점', '' + totalChecked, '지점', C.ink],
        ['이상 발견', '' + todayAbn, '건', C.err],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1.25fr]">
        {/* 라운드 목록 */}
        <Card title="순회 점검 라운드" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">2026-06-21</span>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['시간 / 라운드', 'text-left'], ['순회 경로 · 점검자', 'text-left'], ['진척', 'text-center'], ['이상', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PT_ROUNDS.map((r, i) => {
                const on = r.id === sel;
                const total = r.stops.length || 1;
                const dn = doneStops(r);
                const a = abn(r);
                return (
                  <tr key={r.id} onClick={() => setSel(r.id)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[13px] font-extrabold" style={{ color: on ? C.teal : C.ink }}>{r.time}</div>
                      <div className="font-mono text-[8.5px] text-ink3">{r.id}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{r.route}</div><div className="mt-px text-[9.5px] text-ink3">{r.pic} · {r.dur}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <div className="mb-0.5 font-mono text-[10px] font-bold text-ink2">{dn}/{r.stops.length}</div>
                      <div className="mx-auto h-[5px] w-[52px] rounded-[3px]" style={{ background: C.bgDeep }}><div className="h-full rounded-[3px]" style={{ width: `${(dn / total) * 100}%`, background: r.status === '완료' ? C.ok : C.teal }} /></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">{a > 0 ? <span className="font-mono text-[11px] font-extrabold" style={{ color: C.err }}>{a}</span> : <span className="text-[11px] text-ink3">—</span>}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={r.status === '완료' ? 'ok' : r.status === '진행중' ? 'warn' : 'mute'}>{r.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 라운드 상세 */}
        <Card title="순회 경로 점검" bodyClassName="p-0" action={<Pill tone={cur.status === '완료' ? 'ok' : cur.status === '진행중' ? 'warn' : 'mute'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3" style={{ background: C.panelAlt }}>
            <div className="text-[14.5px] font-extrabold text-ink">{cur.time} · {cur.route}</div>
            <div className="mt-0.5 text-[10.5px] text-ink3">{cur.pic} · {cur.stops.length}개 지점 · 이상 {abn(cur)}건</div>
          </div>

          {cur.stops.length === 0 ? (
            <div className="px-4 py-10 text-center text-[11.5px] text-ink3">아직 시작되지 않은 순회입니다.</div>
          ) : (
            <div className="grid grid-cols-[1.15fr_1fr]">
              {/* 지점 시퀀스 */}
              <div className="max-h-[360px] overflow-y-auto border-r border-border py-3 pl-3.5 pr-2">
                {cur.stops.map((s, i) => {
                  const res = ptResult(s.c);
                  const on = i === stopIdx;
                  const c = TONE_C[PT_RES[res]];
                  const last = i === cur.stops.length - 1;
                  return (
                    <div key={i} onClick={() => setStopIdx(i)} className="flex cursor-pointer gap-2.5">
                      <div className="flex flex-col items-center">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold" style={{ color: res === '미점검' ? C.ink3 : '#fff', background: res === '미점검' ? '#fff' : c, border: `2px solid ${on ? C.navy : res === '미점검' ? C.borderHi : c}` }}>{i + 1}</span>
                        {!last && <span className="w-0.5 flex-1" style={{ minHeight: 14, background: s.c ? C.ok : C.border }} />}
                      </div>
                      <div className="min-w-0 flex-1 pb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11.5px] font-bold" style={{ color: on ? C.ink : C.ink2 }}>{s.line}</span>
                          <Pill tone={PT_RES[res]} solid={res === '이상'}>{res}</Pill>
                        </div>
                        <div className="mt-0.5 font-mono text-[9px] text-ink3">{s.proc} · {s.equip} · {s.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 체크리스트 */}
              <div className="flex flex-col">
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="text-[11.5px] font-extrabold text-ink">{stop.line} <span className="text-[9.5px] font-semibold text-ink3">{stop.equip}</span></div>
                  <span className="mt-1 inline-block"><Pill tone={PT_RES[stopRes]} solid={stopRes === '이상'}>{stopRes === '미점검' ? '미점검 지점' : `점검결과 ${stopRes}`}</Pill></span>
                </div>
                <div className="flex-1 px-3.5 py-2.5">
                  <div className="mb-2 text-[10px] font-bold text-ink3">표준 점검 항목 ({PT_ITEMS.length})</div>
                  <div className="flex flex-col gap-1">
                    {PT_ITEMS.map((it) => {
                      const v = stop.c ? stop.c[it.k] : null;
                      return (
                        <div key={it.k} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: v === 0 ? '#fdf1ef' : C.panelAlt }}>
                          <span className="flex-1 text-[10.5px] font-semibold text-ink">{it.n}</span>
                          {v == null ? <span className="text-[9.5px] text-ink3">—</span> : <Pill tone={v ? 'ok' : 'err'} solid={!v}>{v ? 'OK' : 'NG'}</Pill>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {stop.note && (
                  <div className="mx-3.5 mb-3 rounded-lg px-2.5 py-2" style={{ background: '#fdf1ef', border: `1px solid ${C.err}` }}>
                    <div className="mb-0.5 text-[9px] font-extrabold" style={{ color: C.err }}>이상 내용 · 조치</div>
                    <div className="text-[10px] leading-relaxed text-ink2">{stop.note}</div>
                  </div>
                )}
                <div className="flex gap-1.5 px-3.5 pb-3.5">
                  <button className="h-9 flex-1 rounded-lg text-[11.5px] font-bold text-white" style={{ background: C.navy }}>점검 결과 저장</button>
                  {stopRes === '이상' && <button className="h-9 rounded-lg border bg-panel px-3 text-[11.5px] font-bold" style={{ borderColor: C.err, color: C.err }}>NCR</button>}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
