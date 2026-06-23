import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';

const CAL_ST: Record<string, Tone> = { 예정: 'info', 진행중: 'warn', 완료: 'ok', 지연: 'err' };
const CAL_RES: Record<string, Tone> = { 합격: 'ok', 조정후합격: 'warn', 부적합: 'err', '-': 'mute' };
const RES_C: Record<Tone, string> = { ok: C.ok, warn: C.warn, err: C.err, mute: C.ink3, info: C.blue };
const CAL_KIND: Record<string, string> = { 내부: C.teal, 외부: C.blue, '공인(KOLAS)': '#8a5cf6' };

interface Cal { id: string; gage: string; gid: string; cycle: string; plan: string; done: string; kind: string; org: string; cert: string; std: string; result: string; status: string; pts: string[][] }
const CAL_LIST: Cal[] = [
  { id: 'CL-260621-008', gage: '3차원 측정기(CMM)', gid: 'QG-CMM-01', cycle: '12개월', plan: '2026-03-15', done: '2026-03-15', kind: '공인(KOLAS)', org: '한국산업기술시험원', cert: 'KCL-26-0312', std: '게이지블록 1급', result: '합격', status: '완료', pts: [['10.0000 mm', '10.0003', '+0.0003', '±0.0010'], ['50.0000 mm', '49.9994', '−0.0006', '±0.0015'], ['100.0000 mm', '100.0011', '+0.0011', '±0.0020'], ['진원도 0', '0.0008', '+0.0008', '±0.0020']] },
  { id: 'CL-260620-007', gage: '윤곽 투영기', gid: 'QG-PRO-06', cycle: '6개월', plan: '2026-05-18', done: '2026-06-20', kind: '외부', org: '대한계측교정', cert: 'DKC-26-0455', std: '표준 스케일', result: '조정후합격', status: '완료', pts: [['1.0000 mm', '1.0024', '+0.0024', '±0.0010'], ['1.0000 mm(조정후)', '1.0006', '+0.0006', '±0.0010'], ['10.0000 mm', '10.0008', '+0.0008', '±0.0015'], ['각도 90°', '90.02°', '+0.02', '±0.05']] },
  { id: 'CL-260619-006', gage: '로크웰 경도계', gid: 'QG-HRC-03', cycle: '6개월', plan: '2026-06-05', done: '—', kind: '내부', org: '품질팀 자체', cert: '—', std: '표준 경도블록', result: '-', status: '지연', pts: [['25.0 HRC', '—', '—', '±0.8'], ['45.0 HRC', '—', '—', '±0.8'], ['63.0 HRC', '—', '—', '±0.8']] },
  { id: 'CL-260622-009', gage: '표면조도 측정기', gid: 'QG-RGH-05', cycle: '12개월', plan: '2026-06-22', done: '—', kind: '공인(KOLAS)', org: '한국산업기술시험원', cert: '—', std: '표준조도편', result: '-', status: '예정', pts: [['Ra 0.40 ㎛', '—', '—', '±0.02'], ['Ra 1.60 ㎛', '—', '—', '±0.05'], ['Ra 6.30 ㎛', '—', '—', '±0.10']] },
  { id: 'CL-260621-010', gage: '만능재료시험기(UTM)', gid: 'QG-TEN-04', cycle: '12개월', plan: '2026-06-21', done: '—', kind: '공인(KOLAS)', org: '한국기계전기전자시험연구원', cert: '—', std: '표준 로드셀', result: '-', status: '진행중', pts: [['5.000 kN', '—', '—', '±0.5%'], ['15.000 kN', '—', '—', '±0.5%'], ['25.000 kN', '—', '—', '±0.5%']] },
  { id: 'CL-260618-005', gage: '영상 측정 시스템', gid: 'QG-VIS-02', cycle: '12개월', plan: '2026-02-20', done: '2026-02-20', kind: '외부', org: '대한계측교정', cert: 'DKC-26-0188', std: '표준 글래스 스케일', result: '합격', status: '완료', pts: [['1.0000 mm', '0.9998', '−0.0002', '±0.0010'], ['10.0000 mm', '10.0004', '+0.0004', '±0.0015'], ['50.0000 mm', '49.9991', '−0.0009', '±0.0020']] },
];

/** 검교정 계획 및 실적 — 와이어프레임 qual-cal.jsx 정본. */
export default function QualCalScreen() {
  const [sel, setSel] = useState('CL-260620-007');
  const [tab, setTab] = useState('전체');
  const cur = CAL_LIST.find((c) => c.id === sel) || CAL_LIST[0];
  const rows = CAL_LIST.filter((c) => tab === '전체' || (tab === '미완료' ? c.status !== '완료' : c.status === '완료'));

  const planned = CAL_LIST.filter((c) => c.status === '예정' || c.status === '진행중').length;
  const overdue = CAL_LIST.filter((c) => c.status === '지연').length;
  const doneCnt = CAL_LIST.filter((c) => c.status === '완료').length;
  const adjusted = CAL_LIST.filter((c) => c.result === '조정후합격' || c.result === '부적합').length;
  const ptOk = (p: string[]) => (p[1] === '—' ? null : cur.result !== '부적합');

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">검교정 계획 및 실적</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 계측기·신뢰성 관리 / 검교정 계획 및 실적</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '검교정 등록', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['검교정 대상', '' + CAL_LIST.length, '건', C.ink],
        ['예정·진행', '' + planned, '건', C.blue],
        ['기한 지연', '' + overdue, '건', C.err],
        ['완료', '' + doneCnt, '건', C.ok],
        ['조정·부적합', '' + adjusted, '건', C.warn],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        {/* 목록 */}
        <Card title="검교정 계획·실적" bodyClassName="p-0" action={<ChipTabs items={['전체', '미완료', '완료']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['검교정 / 장비', 'text-left'], ['구분', 'text-center'], ['예정 / 실시', 'text-center'], ['결과', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => {
                const on = c.id === sel;
                return (
                  <tr key={c.id} onClick={() => setSel(c.id)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold text-ink">{c.gage}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{c.gid} · 주기 {c.cycle}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><span className="rounded-[5px] px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap" style={{ color: CAL_KIND[c.kind], border: `1px solid ${CAL_KIND[c.kind]}44` }}>{c.kind}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <div className="font-mono text-[9.5px] text-ink2">{c.plan}</div>
                      <div className="font-mono text-[9.5px]" style={{ color: c.done === '—' ? C.ink3 : C.ink }}>{c.done === '—' ? '미실시' : c.done}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={CAL_RES[c.result]} solid={c.result === '부적합'}>{c.result === '-' ? '대기' : c.result}</Pill></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={CAL_ST[c.status]} solid={c.status === '지연'}>{c.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="검교정 성적 상세" bodyClassName="p-0" action={<Pill tone={CAL_RES[cur.result]} solid={cur.result === '부적합'}>{cur.result === '-' ? cur.status : cur.result}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.gage}</span><span className="rounded px-1.5 py-px text-[9px] font-bold" style={{ color: CAL_KIND[cur.kind], border: `1px solid ${CAL_KIND[cur.kind]}44` }}>{cur.kind}</span></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.id} · {cur.gid}</div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['검교정 주기', cur.cycle], ['예정일', cur.plan], ['실시일', cur.done], ['검교정 기관', cur.org], ['성적서 번호', cur.cert], ['기준기(표준)', cur.std]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10px] text-ink3">{k}</span>
                  <span className={`text-right text-[10.5px] font-bold text-ink2 ${/\d{4}-|KCL|DKC/.test(v) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border">
            <div className="px-4 pb-1.5 pt-2.5 text-[10.5px] font-bold text-ink3">측정점별 검교정 결과 ({cur.pts.length})</div>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  {[['표준값', 'text-left'], ['측정값', 'text-center'], ['편차', 'text-center'], ['허용오차', 'text-center'], ['판정', 'text-center']].map(([h, al]) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-1.5 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cur.pts.map((p, i) => {
                  const ok = ptOk(p);
                  return (
                    <tr key={i} style={{ background: ok === false ? '#fdf1ef' : '#fff' }}>
                      <td className="border-b border-border px-4 py-1.5 font-mono font-bold text-ink">{p[0]}</td>
                      <td className="border-b border-border px-2.5 py-1.5 text-center font-mono font-bold" style={{ color: p[1] === '—' ? C.ink3 : C.ink }}>{p[1]}</td>
                      <td className="border-b border-border px-2.5 py-1.5 text-center font-mono text-ink2">{p[2]}</td>
                      <td className="border-b border-border px-2.5 py-1.5 text-center font-mono text-[9px] text-ink3">{p[3]}</td>
                      <td className="border-b border-border px-4 py-1.5 text-center">{ok == null ? <span className="text-[9.5px] text-ink3">대기</span> : <Pill tone={ok ? 'ok' : 'err'} solid={!ok}>{ok ? '합격' : 'NG'}</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between rounded-[9px] px-3 py-2.5" style={{ background: cur.result === '합격' ? C.tealSoft : cur.result === '조정후합격' ? '#fef6ec' : cur.result === '부적합' ? '#fdf1ef' : C.panelAlt }}>
              <div>
                <div className="mb-0.5 text-[9.5px] text-ink3">종합 판정</div>
                <div className="text-[14px] font-extrabold" style={{ color: RES_C[CAL_RES[cur.result]] }}>{cur.result === '-' ? cur.status : cur.result}</div>
              </div>
              <div className="text-right">
                <div className="mb-0.5 text-[9.5px] text-ink3">차기 검교정</div>
                <div className="font-mono text-[11px] font-bold text-ink2">{cur.done === '—' ? '실시 후 산정' : '+' + cur.cycle}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.navy }}>{cur.status === '완료' ? '성적서 보기' : '실적 등록 →'}</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">라벨</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
