import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, Sel, FilterCard, FilterField, KpiGrid, Timeline, won, type Step } from '../_maint';

interface Row { no: string; eq: string; item: string; vendor: string; date: string; dur: string; cost: number; state: string; warranty: string; sev: string }
const OS_ROWS: Row[] = [
  { no: 'OS-2606-009', eq: 'Thermal 05호기', item: '히터 어셈블리 정밀 재생', vendor: '한국히팅시스템', date: '06-09', dur: '3일', cost: 8200000, state: '진행중', warranty: '6개월', sev: '중대' },
  { no: 'OS-2606-008', eq: 'Photo 05호기', item: '노광 렌즈 모듈 캘리브레이션', vendor: 'ASML Korea', date: '06-05', dur: '5일', cost: 24500000, state: '입고대기', warranty: '12개월', sev: '중대' },
  { no: 'OS-2605-021', eq: 'Etch 01호기', item: 'RF 제너레이터 오버홀', vendor: 'AMAT 서비스', date: '05-28', dur: '7일', cost: 15800000, state: '완료', warranty: '12개월', sev: '중대' },
  { no: 'OS-2605-019', eq: 'CMP 02호기', item: '연마 헤드 스핀들 재생', vendor: '정밀기공(주)', date: '05-22', dur: '4일', cost: 6400000, state: '완료', warranty: '6개월', sev: '주의' },
  { no: 'OS-2605-014', eq: 'Implant 02호기', item: '이온소스 챔버 클리닝', vendor: 'AMAT 서비스', date: '05-15', dur: '3일', cost: 9100000, state: '완료', warranty: '3개월', sev: '주의' },
  { no: 'OS-2605-008', eq: 'Depo 03호기', item: '진공펌프 오버홀', vendor: '에드워드코리아', date: '05-08', dur: '6일', cost: 7300000, state: '완료', warranty: '12개월', sev: '주의' },
  { no: 'OS-2604-022', eq: 'Clean 04호기', item: '케미컬 펌프 교체', vendor: '정밀기공(주)', date: '04-26', dur: '2일', cost: 3200000, state: '완료', warranty: '6개월', sev: '경미' },
];
const stTone = (s: string): Tone => (s === '완료' ? 'ok' : s === '진행중' ? 'info' : s === '입고대기' ? 'warn' : 'mute');
const sevTone = (s: string): Tone => (s === '중대' ? 'err' : s === '주의' ? 'warn' : 'mute');

const OS_VENDORS: [string, number, number, number][] = [
  ['AMAT 서비스', 2, 24900000, 4.6], ['ASML Korea', 1, 24500000, 4.8], ['한국히팅시스템', 1, 8200000, 4.2],
  ['정밀기공(주)', 2, 9600000, 4.4], ['에드워드코리아', 1, 7300000, 4.5],
];

const OS_FLOW: Step[] = [
  ['수리 의뢰', '06-08', '사내 보전 불가 판정 → 외주 의뢰', 'done'],
  ['견적 / 발주', '06-09', '견적 8,200,000원 승인 · PO 발행', 'done'],
  ['설비 반출 / 작업', '06-09', '히터 어셈블리 반출 · 업체 입고', 'active'],
  ['입고 / 설치', '–', '재생품 입고 · 설치 예정', 'wait'],
  ['시운전 / 검수', '–', '온도 프로파일 검증 · 이력 마감', 'wait'],
];

/** 외부 수리(외주 보전) 이력 — 와이어프레임 equip-outsource.jsx 정본. */
export default function EquipOutsourceScreen() {
  const [sel, setSel] = useState('OS-2606-009');
  const cur = OS_ROWS.find((r) => r.no === sel) || OS_ROWS[0];
  const maxV = Math.max(...OS_VENDORS.map((v) => v[2]));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">외부 수리(외주 보전) 이력</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 보전 및 점검 / 외부 수리(외주 보전) 이력</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '외주 의뢰', variant: 'primary' }, 'download']} />
      </div>

      <FilterCard>
        <FilterField label="기간"><Sel value="2026 상반기" w={120} /></FilterField>
        <FilterField label="설비"><Sel w={120} /></FilterField>
        <FilterField label="업체"><Sel w={120} /></FilterField>
        <FilterField label="상태"><Sel w={90} /></FilterField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FilterCard>

      <KpiGrid cols={5} items={[
        ['상반기 외주 건수', '23', '건', C.ink], ['진행중 / 대기', '2', '건', C.warn], ['외주 수리비 누계', '74.7', 'M₩', C.ink],
        ['건당 평균비용', '3.25', 'M₩', C.ink], ['평균 수리기간', '4.3', '일', C.ink],
      ]} />

      {/* 업체별 발주 현황 */}
      <Card title="업체별 발주 현황 (상반기)">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
          {OS_VENDORS.map(([name, cnt, amt, rate], i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[10px] border border-border px-3.5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-[11px] font-extrabold text-white" style={{ background: C.navy }}>{name[0]}</span>
                <span className="text-[11.5px] font-bold leading-tight text-ink">{name}</span>
              </div>
              <div className="flex items-baseline gap-1"><span className="text-[16px] font-extrabold tabular-nums text-ink">{(amt / 1e6).toFixed(1)}</span><span className="text-[10px] text-ink3">M₩ · {cnt}건</span></div>
              <div className="h-1.5 rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: `${(amt / maxV) * 100}%`, background: C.blue }} /></div>
              <div className="flex items-center gap-1"><span className="text-[11px]" style={{ color: C.amber }}>★</span><span className="text-[10.5px] font-bold text-ink2">{rate.toFixed(1)}</span><span className="text-[9.5px] text-ink3">업체 평가</span></div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.55fr_1fr]">
        {/* 외주 수리 이력 */}
        <Card title="외주 수리 이력" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{OS_ROWS.length}건</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['의뢰번호', 'text-left'], ['설비 / 수리내용', 'text-left'], ['업체', 'text-left'], ['비용', 'text-right'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OS_ROWS.map((r, i) => {
                const on = r.no === sel;
                return (
                  <tr key={r.no} onClick={() => setSel(r.no)} className="cursor-pointer align-top" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[10px]" style={{ fontWeight: on ? 800 : 600, color: on ? C.teal : C.ink2, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}<div className="mt-0.5 text-[9.5px] font-normal text-ink3">{r.date}</div></td>
                    <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{r.eq}</div><div className="mt-0.5 text-[10px] text-ink3">{r.item}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-[10.5px] text-ink2">{r.vendor}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right font-mono text-[10.5px] font-bold text-ink">{won(r.cost)}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(r.state)}>{r.state}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 외주 상세 */}
        <Card title="외주 상세" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.no}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[14px] font-extrabold text-ink">{cur.eq}</span>
              <span className="flex gap-1.5"><Pill tone={sevTone(cur.sev)}>{cur.sev}</Pill><Pill tone={stTone(cur.state)}>{cur.state}</Pill></span>
            </div>
            <div className="mb-3 text-[12px] font-bold text-ink2">{cur.item}</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['수리업체', cur.vendor], ['의뢰일', cur.date], ['수리기간', cur.dur], ['보증기간', cur.warranty], ['수리비용', won(cur.cost) + '원'], ['상태', cur.state]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-right text-[11.5px] font-bold ${k === '수리비용' ? 'text-ink' : 'text-ink2'} ${/\d/.test(v) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 py-3.5">
            <div className="mb-3 text-[10.5px] font-bold text-ink3">진행 단계</div>
            <Timeline steps={OS_FLOW} />
          </div>
        </Card>
      </div>
    </div>
  );
}
