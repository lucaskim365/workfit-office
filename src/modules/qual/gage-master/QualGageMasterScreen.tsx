import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, SearchBox } from '../_qual';
import { useGages } from '@/features/gage/useGages';

const QG_ST: Record<string, Tone> = { 사용중: 'ok', 검교정중: 'info', 수리중: 'warn', 사용중지: 'err' };
const QG_CAT: Record<string, string> = { 좌표측정: C.blue, 영상측정: C.teal, 경도: C.warn, 물성: C.err, 조도: '#8a5cf6', 윤곽: C.blue };
const grrTone = (g: number): Tone => (g < 10 ? 'ok' : g <= 30 ? 'warn' : 'err');
const grrColor = (g: number) => ({ ok: C.ok, warn: C.warn, err: C.err }[grrTone(g) as 'ok' | 'warn' | 'err']);
const grrGrade = (g: number) => (g < 10 ? '양호' : g <= 30 ? '조건부' : '부적합');
const BASE = Date.UTC(2026, 5, 21);
const dd = (d: string) => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - BASE) / 86400000);

function GrrBar({ grr }: { grr: number }) {
  const pos = (Math.min(grr, 40) / 40) * 100;
  return (
    <div className="relative mb-5 flex h-3 rounded-md">
      <div className="rounded-l-md" style={{ width: '25%', background: '#d6f0e3' }} />
      <div style={{ width: '50%', background: '#fbeccd' }} />
      <div className="rounded-r-md" style={{ width: '25%', background: '#f9d9d4' }} />
      <span className="absolute top-[13px] -translate-x-1/2 text-[8px] font-bold text-ink3" style={{ left: '25%' }}>10%</span>
      <span className="absolute top-[13px] -translate-x-1/2 text-[8px] font-bold text-ink3" style={{ left: '75%' }}>30%</span>
      <span className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white shadow" style={{ left: pos + '%', background: grrColor(grr) }} />
    </div>
  );
}

/** 계측기·검사 장비 마스터 — 와이어프레임 qual-gage-master.jsx 정본. */
export default function QualGageMasterScreen() {
  const { data: list = [], isLoading } = useGages();
  const [sel, setSel] = useState('QG-CMM-01');
  const [q, setQ] = useState('');
  let rows = list;
  if (q) rows = rows.filter((g) => g.name.includes(q) || g.maker.toLowerCase().includes(q.toLowerCase()) || g.id.toLowerCase().includes(q.toLowerCase()));
  const cur = list.find((g) => g.id === sel) || list[0];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '검사 장비가 없습니다.'}</div>;
  }

  const active = list.filter((g) => g.state === '사용중').length;
  const calDue = list.filter((g) => dd(g.calNext) <= 30).length;
  const grrOk = list.filter((g) => g.grr < 10).length;
  const grrNg = list.filter((g) => g.grr > 30).length;
  const curDday = dd(cur.calNext);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">계측기·검사 장비 마스터</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 계측기·신뢰성 관리 / 계측기·검사 장비 마스터</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '장비 등록', variant: 'primary' }, 'upload', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['검사 장비', '' + list.length, '대', C.ink],
        ['검교정 임박·만료', '' + calDue, '대', C.warn],
        ['MSA 양호 (<10%)', '' + grrOk, '대', C.ok],
        ['MSA 부적합 (>30%)', '' + grrNg, '대', C.err],
        ['가동', '' + active, '대', C.teal],
      ]} />

      <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-panel px-3.5 py-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="장비명·제조사·자산번호" w={180} />
        <span className="ml-auto text-[10.5px] text-ink3">기준일 2026-06-21</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.75fr_1fr]">
        {/* 목록 */}
        <Card title="검사 장비 목록" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{rows.length}대</span>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['자산번호 / 장비', 'text-left'], ['분류', 'text-center'], ['차기 검교정', 'text-center'], ['MSA %GRR', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((g, i) => {
                const on = g.id === sel;
                const d = dd(g.calNext);
                return (
                  <tr key={g.id} onClick={() => setSel(g.id)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{g.id}</div>
                      <div className="mt-px text-[11px] font-bold text-ink">{g.name}</div>
                      <div className="font-mono text-[9px] text-ink3">{g.maker} {g.model}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold" style={{ color: QG_CAT[g.cat], border: `1px solid ${QG_CAT[g.cat]}44` }}>{g.cat}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <div className="font-mono text-[10px] text-ink2">{g.calNext}</div>
                      <div className="text-[9px] font-bold" style={{ color: d < 0 ? C.err : d <= 30 ? C.warn : C.ink3 }}>{d < 0 ? `${-d}일 경과` : `D-${d}`}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <span className="font-mono text-[11.5px] font-extrabold" style={{ color: grrColor(g.grr) }}>{g.grr.toFixed(1)}%</span>
                      <div className="mt-0.5"><Pill tone={grrTone(g.grr)} solid={grrTone(g.grr) === 'err'}>{grrGrade(g.grr)}</Pill></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={QG_ST[g.state]} solid={g.state === '사용중지'}>{g.state}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="장비 상세" bodyClassName="p-0" action={<Pill tone={QG_ST[cur.state]} solid={cur.state === '사용중지'}>{cur.state}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><span className="rounded px-1.5 py-px text-[9px] font-bold" style={{ color: QG_CAT[cur.cat], border: `1px solid ${QG_CAT[cur.cat]}44` }}>{cur.cat}</span></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.id} · {cur.maker} {cur.model}</div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['측정 범위', cur.range], ['분해능', cur.res], ['설치 위치', cur.loc], ['관리 부서', cur.dept]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10px] text-ink3">{k}</span>
                  <span className={`text-right text-[10.5px] font-bold text-ink2 ${/\d/.test(v) && k !== '설치 위치' && k !== '관리 부서' ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-ink3">검교정 정보</span>
              <span className="text-[10.5px] font-extrabold" style={{ color: curDday < 0 ? C.err : curDday <= 30 ? C.warn : C.ok }}>{curDday < 0 ? `${-curDday}일 경과` : `D-${curDday}`}</span>
            </div>
            <div className="flex">
              {[['최근 검교정', cur.cal], ['차기 검교정', cur.calNext]].map(([k, v], i, a) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div className="font-mono text-[11.5px] font-extrabold text-ink">{v}</div>
                  <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[10.5px] font-bold text-ink3">MSA · Gage R&R</span>
              <span className="flex items-baseline gap-1.5"><span className="font-mono text-[20px] font-extrabold leading-none" style={{ color: grrColor(cur.grr) }}>{cur.grr.toFixed(1)}%</span><Pill tone={grrTone(cur.grr)} solid={grrTone(cur.grr) === 'err'}>{grrGrade(cur.grr)}</Pill></span>
            </div>
            <GrrBar grr={cur.grr} />
            <div className="-mt-2 text-right text-[9px] text-ink3">최근 평가 {cur.grrDate}</div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2 text-[10px] font-bold text-ink3">적용 검사항목 ({cur.items.length})</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {cur.items.map((it, i) => <span key={i} className="rounded-md px-2 py-1 text-[10px] font-bold text-ink2" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>{it}</span>)}
            </div>
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.navy }}>검교정 이력</button>
              <button className="h-[38px] flex-1 rounded-lg border border-border-hi bg-panel text-[12px] font-bold text-ink2">Gage R&R</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
