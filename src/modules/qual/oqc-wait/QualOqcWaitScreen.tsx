import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, Sel, FilterCard, FilterField, ChipTabs, SearchBox } from '../_qual';
import { useInspections, useTransitionInspection } from '@/features/inspection/useInspections';

const PRIO_TONE: Record<string, Tone> = { 긴급: 'err', 일반: 'mute' };
const ST_TONE: Record<string, Tone> = { 대기: 'info', 검사중: 'warn', 보류: 'mute', 판정완료: 'ok' };
const dueColor = (d: string) => (d === '지연' ? C.err : d === 'D-Day' || d === 'D-1' ? C.warn : C.ink2);

/** 출하검사 대기 현황 — 와이어프레임 qual-oqc-wait.jsx 정본. */
export default function QualOqcWaitScreen() {
  const { data: lots = [], isLoading } = useInspections({ stage: 'OQC' });
  const transition = useTransitionInspection();
  const [sel, setSel] = useState('SO-260621-018');
  const [tab, setTab] = useState('전체');
  const [q, setQ] = useState('');
  let rows = lots.filter((l) => tab === '전체' || l.status === tab);
  if (q) rows = rows.filter((l) => l.name.includes(q) || l.cust.includes(q) || l.code.toLowerCase().includes(q.toLowerCase()) || l.recv.toLowerCase().includes(q.toLowerCase()));
  const cur = lots.find((l) => l.recv === sel) || lots[0];

  const cnt = (s: string) => lots.filter((l) => l.status === s).length;
  const urgent = lots.filter((l) => l.due === '지연' || l.due === 'D-Day' || l.due === 'D-1').length;
  const shipQty = lots.filter((l) => l.due === 'D-Day' || l.due === 'D-1').reduce((s, l) => s + l.qty, 0);

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '출하검사 대상이 없습니다.'}</div>;
  }

  const banner = cur.insp === '전수'
    ? [['검사', '전수'], ['시료수', cur.n.toLocaleString()], ['Ac', '0'], ['Re', '1']]
    : [['시료문자', cur.letter], ['시료수 n', '' + cur.n], ['합격 Ac', '' + cur.ac], ['불합격 Re', '' + cur.re]];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">출하검사 대기 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 출하검사(OQC) / 출하검사 대기 현황</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '검사 착수', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['검사 대기', '' + cnt('대기'), 'LOT', C.ink],
        ['검사 진행중', '' + cnt('검사중'), 'LOT', C.warn],
        ['납기 임박·지연', '' + urgent, 'LOT', C.err],
        ['보류', '' + cnt('보류'), 'LOT', C.ink3],
        ['금일 출하 예정', shipQty.toLocaleString(), 'EA', C.blue],
      ]} />

      <FilterCard>
        {[['거래처', '전체'], ['검사구분', '전체']].map(([k, v]) => <FilterField key={k} label={k}><Sel value={v} w={80} /></FilterField>)}
        <SearchBox value={q} onChange={setQ} placeholder="출하지시·제품·거래처" w={160} />
        <span className="ml-auto text-[10.5px] text-ink3">기준일 2026-06-21 09:00</span>
      </FilterCard>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.9fr_1fr]">
        {/* 목록 */}
        <Card title="출하검사 대기 LOT 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '대기', '검사중', '보류']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['출하지시 / 일시', 'text-left'], ['제품', 'text-left'], ['거래처 / 납품처', 'text-left'], ['수량', 'text-right'], ['검사', 'text-center'], ['출하 납기', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => {
                const on = l.recv === sel;
                return (
                  <tr key={l.recv} onClick={() => setSel(l.recv)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{l.recv}</div>
                      <div className="mt-px text-[9px] text-ink3">{l.date}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{l.name}</div><div className="mt-px font-mono text-[9px] text-ink3">{l.code} · {l.lot}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="text-[11px] font-bold text-ink2">{l.cust}</div><div className="text-[9px] text-ink3">{l.dest}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold text-ink">{l.qty.toLocaleString()}<span className="text-[9px] font-normal text-ink3"> {l.unit}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={l.insp === '전수' ? 'info' : 'mute'}>{l.insp}</Pill><div className="mt-0.5 font-mono text-[9px] text-ink3">n={l.n.toLocaleString()}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><div className="font-mono text-[9.5px] text-ink2">{l.ship.split(' ')[0]}</div><div className="text-[9.5px] font-extrabold" style={{ color: dueColor(l.due) }}>{l.due}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={ST_TONE[l.status]}>{l.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* LOT 상세 */}
        <Card title="출하 LOT 상세" bodyClassName="p-0" action={<Pill tone={ST_TONE[cur.status]}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><Pill tone={PRIO_TONE[cur.prio]}>{cur.prio}</Pill></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.code} · {cur.recv} · LOT {cur.lot}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">출하 정보</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['거래처', cur.cust], ['납품처', cur.dest], ['출하수량', cur.qty.toLocaleString() + ' ' + cur.unit], ['검사 담당', cur.pic], ['출하 예정', cur.ship], ['납기', cur.due]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-right text-[11px] font-bold ${/^[\d]/.test('' + v) ? 'font-mono' : ''}`} style={{ color: v === '미지정' ? C.err : k === '납기' ? dueColor(cur.due) : C.ink2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">적용 샘플링 플랜</div>
            <div className="flex rounded-[9px] px-2 py-2.5" style={{ background: C.navy }}>
              {banner.map(([k, v], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < banner.length - 1 ? '1px solid rgba(255,255,255,.14)' : 'none' }}>
                  <div className="font-mono text-[17px] font-extrabold" style={{ color: i === 2 ? '#7fe3da' : i === 3 ? '#ff9b8e' : '#fff' }}>{v}</div>
                  <div className="mt-0.5 text-[8.5px] text-white/55">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-center text-[9px] text-ink3">{cur.insp === '전수' ? '전수검사' : `검사수준 ${cur.level} · AQL ${cur.aql.toFixed(2)} · 로트 ${cur.qty.toLocaleString()}`}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">고객 요구사항</div>
            <div className="flex flex-wrap gap-1.5">
              {cur.req.map((r, i) => <span key={i} className="rounded-md px-2 py-1 text-[10px] font-bold" style={{ color: C.blue, background: C.blueSoft }}>{r}</span>)}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex gap-2">
              <div className="flex flex-1 items-center justify-between rounded-lg px-3 py-2.5" style={{ background: cur.pqc === '합격' ? C.tealSoft : '#fef6ec' }}>
                <span className="text-[10px] text-ink3">공정검사 결과</span>
                <span className="text-[11.5px] font-extrabold" style={{ color: cur.pqc === '합격' ? C.ok : C.warn }}>{cur.pqc}</span>
              </div>
              <div className="flex flex-1 items-center justify-between rounded-lg px-3 py-2.5" style={{ background: C.panelAlt }}>
                <span className="text-[10px] text-ink3">COA 발행</span>
                <span className="text-[11.5px] font-extrabold" style={{ color: cur.coa ? C.ink : C.ink3 }}>{cur.coa ? '필요' : '불요'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (cur.status === '대기' || cur.status === '보류') transition.mutate({ recv: cur.recv, to: '검사중' });
                }}
                disabled={cur.status === '판정완료' || transition.isPending}
                className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white disabled:opacity-50"
                style={{ background: C.navy }}
              >
                {cur.status === '대기' ? '출하검사 착수 →' : cur.status === '보류' ? '검사 재개 →' : '출하검사 진행 →'}
              </button>
              <button
                onClick={() => transition.mutate({ recv: cur.recv, to: '보류' })}
                disabled={cur.status === '보류' || cur.status === '판정완료' || transition.isPending}
                className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2 disabled:opacity-40"
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
