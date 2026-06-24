import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';
import { useMrbCases, useTransitionMrb } from '@/features/mrbCase/useMrbCases';
import { nextStatus } from '@/domain/mrbCase/status';

const MRB_ST: Record<string, Tone> = { 심의대기: 'info', 심의중: 'warn', 의결완료: 'ok', 보류: 'mute' };
const DISP = ['사용가(특채)', '재작업', '수리', '반품', '폐기'];
const dispTone = (d: string): Tone => (d === '사용가(특채)' ? 'info' : d === '재작업' || d === '수리' ? 'warn' : d === '반품' ? 'mute' : 'err');
const dispColor = (d: string) => ({ info: C.blue, warn: C.warn, mute: C.ink3, err: C.err, ok: C.ok }[dispTone(d)]);
const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const wonM = (n: number) => '₩' + (n / 10000).toLocaleString() + '만';

/** MRB(부적합 심의) 현황 — 와이어프레임 qual-mrb.jsx 정본. */
export default function QualMrbScreen() {
  const { data: list = [], isLoading } = useMrbCases();
  const transition = useTransitionMrb();
  const [sel, setSel] = useState('MRB-260621-004');
  const [pick, setPick] = useState<string | null>(null);
  const cur = list.find((c) => c.no === sel) || list[0];
  useEffect(() => { setPick(null); }, [sel]);

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '심의 안건이 없습니다.'}</div>;
  }

  const tally: Record<string, number> = {};
  cur.board.forEach(([, , op]) => { tally[op] = (tally[op] || 0) + 1; });
  const consensus = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
  const decision = cur.decision || pick || consensus;
  const decided = cur.status === '의결완료';

  const waiting = list.filter((c) => c.status === '심의대기' || c.status === '심의중').length;
  const doneCnt = list.filter((c) => c.status === '의결완료').length;
  const scrapLoss = list.filter((c) => (c.decision || '') === '폐기').reduce((s, c) => s + c.loss, 0);
  const totalLoss = list.reduce((s, c) => s + c.loss, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">MRB(부적합 심의) 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 부적합·불량 관리 / MRB(부적합 심의) 현황</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '의결 확정', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['심의 대기·진행', '' + waiting, '건', C.warn],
        ['금월 의결 완료', '' + doneCnt, '건', C.ok],
        ['금월 심의 안건', '' + list.length, '건', C.ink],
        ['추정 손실액', wonM(totalLoss), '', C.err],
        ['폐기 결정액', wonM(scrapLoss), '', C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {/* 안건 목록 */}
        <Card title="MRB 심의 안건" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">NCR 연계 안건</span>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['MRB / NCR', 'text-left'], ['품목 / 불량', 'text-left'], ['수량', 'text-right'], ['손실액', 'text-right'], ['처분', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => {
                const on = c.no === sel;
                return (
                  <tr key={c.no} onClick={() => setSel(c.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{c.no}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{c.ncr}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{c.name}</div><div className="mt-px text-[9.5px] text-ink3">{c.defect} · <span style={{ color: c.sev === '치명' ? C.err : C.ink3 }}>{c.sev}</span></div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold text-ink">{c.qty}<span className="text-[9px] font-normal text-ink3"> {c.unit}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold" style={{ color: C.err }}>{wonM(c.loss)}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">{c.decision ? <Pill tone={dispTone(c.decision)} solid={c.decision === '폐기'}>{c.decision}</Pill> : <span className="text-[9.5px] text-ink3">미정</span>}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={MRB_ST[c.status]} solid={c.status === '의결완료'}>{c.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="심의 안건 상세" bodyClassName="p-0" action={<Pill tone={MRB_ST[cur.status]} solid={cur.status === '의결완료'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><Pill tone={sevTone(cur.sev)} solid={cur.sev === '치명'}>{cur.sev}</Pill></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.no} · {cur.ncr} · 회의 {cur.meeting}</div>
          </div>

          <div className="flex border-b border-border px-4 py-3">
            {([['부적합', cur.defect, C.ink], ['수량', cur.qty + ' ' + cur.unit, C.ink], ['추정 손실', wonM(cur.loss), C.err]] as const).map(([k, v, c], i, a) => (
              <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className={`text-[12px] font-extrabold ${i > 0 ? 'font-mono' : ''}`} style={{ color: c }}>{v}</div>
                <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
              </div>
            ))}
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[10.5px] font-bold text-ink3">심의 위원 의견 ({cur.board.length})</span>
              <span className="text-[9.5px] text-ink3">다수의견 <b style={{ color: dispColor(consensus) }}>{consensus}</b></span>
            </div>
            <div className="flex flex-col gap-1">
              {cur.board.map(([role, name, op], i) => (
                <div key={i} className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5" style={{ background: C.panelAlt }}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white" style={{ background: C.navy }}>{name.slice(0, 1)}</span>
                  <div className="min-w-0 flex-1"><span className="text-[11px] font-bold text-ink">{name}</span><span className="ml-1.5 text-[9.5px] text-ink3">{role}</span></div>
                  <Pill tone={dispTone(op)} solid={op === '폐기'}>{op}</Pill>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10px] font-bold text-ink3">처분 결정 {decided && <span style={{ color: C.ok }}>· 의결 완료</span>}</div>
            <div className="flex flex-wrap gap-1.5">
              {DISP.map((d) => {
                const on = decision === d;
                const c = dispColor(d);
                return <button key={d} onClick={() => !decided && setPick(d)} className="rounded-lg px-2.5 py-2 text-[11px] font-extrabold" style={{ border: `1.5px solid ${on ? c : C.border}`, background: on ? c + '14' : '#fff', color: on ? c : C.ink2, cursor: decided ? 'default' : 'pointer', opacity: decided && !on ? 0.45 : 1 }}>{d}</button>;
              })}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 rounded-[9px] px-3.5 py-3" style={{ background: decision === '폐기' ? '#fdf1ef' : dispTone(decision) === 'info' ? C.blueSoft : C.tealSoft }}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[9.5px] font-bold text-ink3">의결 처분</span>
                <span className="text-[15px] font-extrabold" style={{ color: dispColor(decision) }}>{decision}</span>
              </div>
              <div className="text-[10px] leading-relaxed text-ink2">{cur.reason}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const to = nextStatus(cur.status);
                  if (to) transition.mutate({ no: cur.no, to });
                }}
                disabled={decided || transition.isPending}
                className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white disabled:opacity-100"
                style={{ background: decided ? C.borderHi : C.navy }}
              >
                {decided ? '의결 완료됨' : '의결 확정 →'}
              </button>
              <button
                onClick={() => transition.mutate({ no: cur.no, to: '보류' })}
                disabled={cur.status !== '심의중' || transition.isPending}
                className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2 disabled:opacity-100"
              >
                보류
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
