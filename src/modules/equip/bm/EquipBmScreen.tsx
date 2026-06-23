import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, Sel, FilterCard, FilterField, KpiGrid, Timeline, won, type Step } from '../_maint';

interface Row { no: string; eq: string; sym: string; cause: string; date: string; worker: string; team: string; down: number; sev: string; state: string; parts: number; cost: number }
const BM_ROWS: Row[] = [
  { no: 'BM-2606-031', eq: 'Thermal 05호기', sym: '히터존 3 온도 미상승', cause: '히터 단선', date: '06-10 08:42', worker: '박보전', team: '보전 2팀', down: 95, sev: '중대', state: '수리중', parts: 1, cost: 1850000 },
  { no: 'BM-2606-030', eq: 'CMP 02호기', sym: '구동부 이상 진동', cause: '베어링 마모', date: '06-10 06:15', worker: '김설비', team: '보전 1팀', down: 0, sev: '경미', state: '진단중', parts: 0, cost: 0 },
  { no: 'BM-2606-029', eq: 'Etch 01호기', sym: 'RF 파워 불안정', cause: '매칭 네트워크 불량', date: '06-09 22:30', worker: '박보전', team: '보전 2팀', down: 142, sev: '중대', state: '완료', parts: 2, cost: 3200000 },
  { no: 'BM-2606-028', eq: 'Implant 02호기', sym: '이온빔 전류 저하', cause: '필라멘트 수명', date: '06-09 14:05', worker: '이정비', team: '보전 1팀', down: 88, sev: '중대', state: '완료', parts: 1, cost: 2400000 },
  { no: 'BM-2606-027', eq: 'Photo 05호기', sym: '스테이지 정렬 오차', cause: 'XY 모터 엔코더 노이즈', date: '06-08 11:20', worker: '김설비', team: '보전 1팀', down: 56, sev: '주의', state: '완료', parts: 1, cost: 780000 },
  { no: 'BM-2606-026', eq: 'Depo 03호기', sym: '챔버 압력 누설', cause: 'O-ring 경화', date: '06-07 09:50', worker: '이정비', team: '보전 1팀', down: 38, sev: '주의', state: '완료', parts: 3, cost: 420000 },
  { no: 'BM-2606-025', eq: 'Clean 04호기', sym: '케미컬 공급 불량', cause: '펌프 다이어프램 손상', date: '06-06 16:40', worker: '박보전', team: '보전 2팀', down: 64, sev: '주의', state: '완료', parts: 1, cost: 650000 },
];
const stTone = (s: string): Tone => (s === '완료' ? 'ok' : s === '수리중' ? 'info' : s === '진단중' ? 'warn' : 'mute');
const sevTone = (s: string): Tone => (s === '중대' ? 'err' : s === '주의' ? 'warn' : 'mute');

const BM_FLOW: Step[] = [
  ['접수', '06-10 08:42', '현장 작업자 신고 (Andon)', 'done'],
  ['진단', '06-10 08:55', '히터존 3 저항 측정 → 단선 확인', 'done'],
  ['수리', '06-10 09:10', '히터 어셈블리 교체 진행 중', 'active'],
  ['시운전', '–', '온도 프로파일 검증 예정', 'wait'],
  ['완료', '–', '가동 재개 / 이력 마감', 'wait'],
];
const BM_PARTS: [string, string, number, string, string][] = [
  ['HTR-TC-3000', '튜브 히터 어셈블리 (Zone3)', 1, 'EA', '예비품 출고'],
];

/** 사후보전(BM) 조치 — 와이어프레임 equip-bm.jsx 정본. */
export default function EquipBmScreen() {
  const [sel, setSel] = useState('BM-2606-031');
  const cur = BM_ROWS.find((r) => r.no === sel) || BM_ROWS[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">사후보전(BM) 조치</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 보전 및 점검 / 사후보전(BM) 조치</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '고장 접수', variant: 'primary' }, 'download']} />
      </div>

      <FilterCard>
        <FilterField label="기간"><Sel value="2026-06" w={110} /></FilterField>
        <FilterField label="설비"><Sel w={120} /></FilterField>
        <FilterField label="심각도"><Sel w={90} /></FilterField>
        <FilterField label="상태"><Sel w={90} /></FilterField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FilterCard>

      <KpiGrid cols={6} items={[
        ['이번달 BM 발생', '31', '건', C.ink], ['미완료(진행중)', '2', '건', C.warn], ['평균 수리시간', '78', '분', C.ink],
        ['총 다운타임', '34.2', 'h', C.err], ['수리 부품비', '12.8', 'M₩', C.ink], ['긴급 BM 비율', '19.4', '%', C.amber],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        {/* 작업 목록 */}
        <Card title="BM 작업 목록" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{BM_ROWS.length}건</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['작업번호', '설비 / 고장증상', '심각도', '다운타임', '상태'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i < 2 ? 'text-left' : 'text-center'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BM_ROWS.map((r, i) => {
                const on = r.no === sel;
                return (
                  <tr key={r.no} onClick={() => setSel(r.no)} className="cursor-pointer align-top" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[10.5px]" style={{ fontWeight: on ? 800 : 600, color: on ? C.teal : C.ink2, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}<div className="mt-0.5 text-[9.5px] font-normal text-ink3">{r.date}</div></td>
                    <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{r.eq}</div><div className="mt-0.5 text-[10px] text-ink3">{r.sym}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={sevTone(r.sev)}>{r.sev}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-extrabold tabular-nums" style={{ color: r.down > 100 ? C.err : r.down > 0 ? C.ink2 : C.ink3 }}>{r.down > 0 ? r.down + '분' : '–'}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(r.state)}>{r.state}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 조치 상세 */}
        <Card title="조치 상세" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.no}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[14px] font-extrabold text-ink">{cur.eq}</span>
              <span className="flex gap-1.5"><Pill tone={sevTone(cur.sev)}>{cur.sev}</Pill><Pill tone={stTone(cur.state)}>{cur.state}</Pill></span>
            </div>
            <div className="mb-0.5 text-[12px] font-bold" style={{ color: C.err }}>{cur.sym}</div>
            <div className="text-[11px] text-ink3">추정원인 · <span className="font-semibold text-ink2">{cur.cause}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['접수시각', cur.date], ['담당팀', cur.team], ['담당자', cur.worker], ['다운타임', cur.down > 0 ? cur.down + '분' : '–']].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-[11.5px] font-bold text-ink2 ${/\d/.test(v) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-3 text-[10.5px] font-bold text-ink3">조치 진행</div>
            <Timeline steps={BM_FLOW} />
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-ink3">교체 부품</span>
              <span className="text-[11px] font-extrabold text-ink">{cur.parts > 0 ? `${won(cur.cost)} ₩` : '부품 교체 없음'}</span>
            </div>
            {cur.parts > 0 && BM_PARTS.map((p, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
                <span className="rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] font-bold" style={{ color: C.blue, background: C.bgDeep }}>{p[0]}</span>
                <span className="flex-1 text-[11px] font-semibold text-ink">{p[1]}</span>
                <span className="text-[11px] font-bold tabular-nums text-ink2">{p[2]} {p[3]}</span>
                <Pill tone="info">{p[4]}</Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
