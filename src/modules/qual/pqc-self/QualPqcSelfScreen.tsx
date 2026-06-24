import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';
import { usePqcSelfChecks } from '@/features/pqcSelf/usePqcSelf';
import type { PqcSelf, Round } from '@/domain/pqcSelf/schema';

const RT: Record<string, Tone> = { 합격: 'ok', 경고: 'warn', 이탈: 'err', 대기: 'mute' };

const nextLabel = (m: number) => (m === 999 ? '완료' : m < 0 ? `${-m}분 지연` : m === 0 ? '검사 도래' : `${m}분 후`);
const nextColor = (m: number) => (m === 999 ? C.ink3 : m < 0 ? C.err : m <= 15 ? C.warn : C.ink2);

function ControlChart({ rounds, target, usl, lsl, unit }: { rounds: Round[]; target: number; usl: number; lsl: number; unit: string }) {
  const W = 360, H = 150, padL = 40, padR = 12, padT = 14, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const span = (usl - lsl) * 1.6 || 1;
  const mid = (usl + lsl) / 2;
  const top = mid + span / 2, bot = mid - span / 2;
  const y = (v: number) => padT + ih - ((v - bot) / (top - bot)) * ih;
  const x = (i: number) => padL + (iw / Math.max(rounds.length - 1, 1)) * i;
  const fmt = (v: number) => v.toFixed(unit === 'g' ? 1 : 2);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <rect x={padL} y={y(usl)} width={iw} height={y(lsl) - y(usl)} fill={C.tealSoft} opacity={0.5} />
      {([['USL', usl, C.err], ['CL', target, C.ink3], ['LSL', lsl, C.err]] as const).map(([lbl, v, c], i) => (
        <g key={i}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke={c} strokeWidth="1" strokeDasharray={lbl === 'CL' ? '2 3' : '4 3'} />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize="8" fontWeight="700" fill={c}>{lbl}</text>
          <text x={W - padR} y={y(v) - 3} textAnchor="end" fontSize="7.5" fill={C.ink3}>{fmt(v)}</text>
        </g>
      ))}
      <polyline points={rounds.map((d, i) => `${x(i)},${y(d.val)}`).join(' ')} fill="none" stroke={C.navy} strokeWidth="2" strokeLinejoin="round" />
      {rounds.map((d, i) => {
        const out = d.val > usl || d.val < lsl;
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.val)} r="4" fill={out ? C.err : '#fff'} stroke={out ? C.err : C.navy} strokeWidth="2" />
            <text x={x(i)} y={H - 7} textAnchor="middle" fontSize="8" fill={C.ink3}>#{d.r}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 자주검사 실적 등록 — 와이어프레임 qual-pqc-self.jsx 정본. */
export default function QualPqcSelfScreen() {
  const { data: wos = [], isLoading } = usePqcSelfChecks();
  const [sel, setSel] = useState('WO-260621-006');
  const [tab, setTab] = useState('진행중');
  const cur = wos.find((w) => w.wo === sel) || wos[0];

  const done = (w: PqcSelf) => w.next === 999;
  const rows = wos.filter((w) => tab === '전체' || (tab === '진행중' ? !done(w) : done(w)));

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '자주검사 대상이 없습니다.'}</div>;
  }

  const dueCnt = wos.filter((w) => w.next !== 999 && w.next <= 0).length;
  const oocCnt = wos.filter((w) => w.rounds.some((r) => r.st === '이탈')).length;
  const todayChecks = wos.reduce((s, w) => s + w.rounds.length, 0);
  const avgAdher = Math.round(wos.reduce((s, w) => s + w.adher, 0) / wos.length);

  const lastNg = cur.rounds.some((r) => r.st === '이탈');
  const cpk = (Math.min(cur.usl - cur.target, cur.target - cur.lsl) / ((cur.usl - cur.lsl) / 6)).toFixed(2);
  const strip: [string, string][] = [['검사 주기', cur.interval + ' / ' + cur.cycle], ['다음 검사', nextLabel(cur.next)], ['관리 특성', cur.char], ['Cpk', cpk]];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">자주검사 실적 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 공정검사(PQC) / 자주검사 실적 등록</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '검사 실적 등록', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['자주검사 대상', '' + wos.filter((w) => !done(w)).length, 'WO', C.ink],
        ['검사 도래·지연', '' + dueCnt, '건', C.warn],
        ['관리 이탈(OOC)', '' + oocCnt, '건', C.err],
        ['금일 검사', '' + todayChecks, '회', C.ink],
        ['검사 주기 준수율', '' + avgAdher, '%', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        {/* WO 목록 */}
        <Card title="자주검사 대상 작업지시" bodyClassName="p-0" action={<ChipTabs items={['진행중', '완료', '전체']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['작업지시 / 품목', 'text-left'], ['라인 · 작업자', 'text-left'], ['검사 주기', 'text-center'], ['다음 검사', 'text-center'], ['준수율', 'text-right'], ['최근 상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => {
                const on = w.wo === sel;
                const lastSt = w.rounds[w.rounds.length - 1].st;
                return (
                  <tr key={w.wo} onClick={() => setSel(w.wo)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold text-ink">{w.item}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{w.wo} · {w.proc}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-[10.5px]">{w.line}<div className="text-[9px] text-ink3">{w.op}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center font-mono text-[10px]">{w.interval}<div className="text-[8.5px] text-ink3">{w.cycle}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center font-mono text-[10.5px] font-bold" style={{ color: nextColor(w.next) }}>{nextLabel(w.next)}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold" style={{ color: w.adher >= 95 ? C.ink : w.adher >= 85 ? C.warn : C.err }}>{w.adher}%</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={RT[lastSt]} solid={lastSt === '이탈'}>{lastSt}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="자주검사 상세" bodyClassName="p-0" action={<Pill tone={lastNg ? 'err' : 'ok'} solid={lastNg}>{lastNg ? '관리 이탈' : '관리 상태'}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="text-[14.5px] font-extrabold text-ink">{cur.item}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.wo} · {cur.equip} · {cur.op}</div>
          </div>

          <div className="flex border-b border-border px-4 py-3">
            {strip.map(([k, v], i) => (
              <div key={k} className="flex-1 text-center" style={{ borderRight: i < strip.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className="font-mono text-[12px] font-extrabold" style={{ color: k === '다음 검사' ? nextColor(cur.next) : k === 'Cpk' ? (+cpk >= 1.33 ? C.ok : C.warn) : C.ink }}>{v}</div>
                <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
              </div>
            ))}
          </div>

          <div className="border-b border-border px-3 pb-1.5 pt-3">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[10.5px] font-bold text-ink3">{cur.char} 관리도 ({cur.unit})</span>
              <span className="font-mono text-[9px] text-ink3">규격 {cur.lsl}~{cur.usl}</span>
            </div>
            <ControlChart rounds={cur.rounds} target={cur.target} usl={cur.usl} lsl={cur.lsl} unit={cur.unit} />
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">금회차 검사 입력 · #{cur.rounds.length + 1}</div>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[11px] font-bold text-ink">{cur.char}</span>
              <input placeholder={cur.target.toString()} className="h-[34px] w-20 rounded-[7px] border border-border-hi text-center font-mono text-[13px] font-bold text-ink outline-none" />
              <span className="w-7 text-[10px] text-ink3">{cur.unit}</span>
              <span className="text-[9px] text-ink3">시료 {cur.rounds[0].n}</span>
            </div>
          </div>

          <div>
            <div className="px-4 pb-1.5 pt-2.5 text-[10.5px] font-bold text-ink3">검사 이력 (최근 {cur.rounds.length}회)</div>
            <div className="max-h-[132px] overflow-y-auto">
              <table className="w-full border-collapse text-[10.5px]">
                <tbody>
                  {[...cur.rounds].reverse().map((r, i) => {
                    const out = r.val > cur.usl || r.val < cur.lsl;
                    return (
                      <tr key={i} style={{ background: r.st === '이탈' ? '#fdf1ef' : '#fff' }}>
                        <td className="border-b border-border px-4 py-1.5 font-mono font-bold text-ink">#{r.r}</td>
                        <td className="border-b border-border px-1.5 py-1.5 text-[9.5px] text-ink3">{r.time}</td>
                        <td className="border-b border-border px-1.5 py-1.5 text-right font-mono font-extrabold" style={{ color: out ? C.err : C.ink }}>{r.val}</td>
                        <td className="border-b border-border px-1.5 py-1.5 text-center text-[9.5px] text-ink3">NG {r.ng}</td>
                        <td className="border-b border-border px-4 py-1.5 text-center"><Pill tone={RT[r.st]} solid={r.st === '이탈'}>{r.st}</Pill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
