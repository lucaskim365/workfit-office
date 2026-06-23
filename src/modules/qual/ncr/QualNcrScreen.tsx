import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';

const NCR_SRC: Record<string, string> = { 수입검사: C.blue, 공정검사: C.teal, 출하검사: '#8a5cf6', '고객 클레임': C.err };
const NCR_ST: Record<string, Tone> = { 발행: 'info', 조사중: 'warn', 조치중: 'warn', 종결: 'ok' };
const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');

interface Ncr { no: string; date: string; src: string; loc: string; code: string; name: string; lot: string; defect: string; dcode: string; sev: string; qty: number; iso: number; fault: string; disp: string; status: string; pic: string; desc: string; steps: [string, string, number][] }
const NCR_LIST: Ncr[] = [
  { no: 'NCR-260621-008', date: '2026-06-21 14:10', src: '공정검사', loc: '1라인 #3 · CNC-03', code: 'FG-BRK-A', name: '브래킷 ASSY-A', lot: 'L2606-1013', defect: '외경 과대', dcode: 'D-DIM-OS', sev: '주요', qty: 18, iso: 18, fault: '사내 귀책', disp: '재작업', status: '조치중', pic: '이품질', desc: '종물검사 중 외경 25.08mm 측정 (규격 25.00±0.05mm). 절삭공구 마모로 인한 치수 산포 확대 추정. 동일 LOT 격리 후 재작업 진행.', steps: [['발행', '06-21 14:10', 1], ['격리', '06-21 14:25', 1], ['원인 조사', '06-21 15:00', 1], ['조치(재작업)', '진행중', 0], ['효과 검증·종결', '—', 0]] },
  { no: 'NCR-260621-005', date: '2026-06-21 09:40', src: '수입검사', loc: '입고검사 · GR-260620-028', code: 'RM-STS304', name: 'STS304 강판 t2.0', lot: 'L2606-0018', defect: '인장강도 미달', dcode: 'D-PR-TS', sev: '치명', qty: 280, iso: 280, fault: '협력사 귀책', disp: '반품', status: '조치중', pic: '이품질', desc: '수입검사 인장강도 시험 결과 498MPa 측정 (규격 520MPa 이상). 6/32 시료 미달. 로트 전량 격리, 협력사(동방스틸) 반품 및 8D 요청.', steps: [['발행', '06-21 09:40', 1], ['격리', '06-21 09:55', 1], ['원인 조사', '06-21 10:30', 1], ['조치(반품)', '진행중', 0], ['효과 검증·종결', '—', 0]] },
  { no: 'NCR-260620-011', date: '2026-06-20 16:30', src: '고객 클레임', loc: '현대모비스 · 아산', code: 'FG-GER-22', name: '기어 G-22T', lot: 'L2605-0820', defect: '치면 소음', dcode: 'D-ST-NS', sev: '치명', qty: 35, iso: 35, fault: '사내 귀책', disp: 'MRB 회부', status: '조사중', pic: '박품질', desc: '고객 라인 조립 중 기어 치합 소음 클레임 접수. 반품품 35EA 입고, 치면 조도 및 열처리 경도 재측정 진행. MRB 심의 예정.', steps: [['발행', '06-20 16:30', 1], ['격리', '06-20 17:10', 1], ['원인 조사', '진행중', 0], ['MRB 심의', '—', 0], ['효과 검증·종결', '—', 0]] },
  { no: 'NCR-260620-007', date: '2026-06-20 11:20', src: '출하검사', loc: '출하검사 · SO-260620-028', code: 'FG-CVR-B', name: '커버 플레이트 B', lot: 'L2606-1011', defect: '평면도 불량', dcode: 'D-DIM-FL', sev: '주요', qty: 42, iso: 42, fault: '사내 귀책', disp: '특채', status: '종결', pic: '이품질', desc: '출하검사 평면도 0.13mm 측정 (규격 ≤0.10mm). 고객 사용상 영향 경미 판단, 특채 승인(고객 동의) 후 출하.', steps: [['발행', '06-20 11:20', 1], ['격리', '06-20 11:40', 1], ['원인 조사', '06-20 13:00', 1], ['조치(특채)', '06-20 15:20', 1], ['효과 검증·종결', '06-20 17:00', 1]] },
  { no: 'NCR-260619-014', date: '2026-06-19 15:50', src: '공정검사', loc: '2라인 #1 · PRS-07', code: 'FG-HSG-C', name: '하우징 C-Type', lot: 'L2606-0922', defect: '버·이물', dcode: 'D-AP-BR', sev: '경미', qty: 120, iso: 0, fault: '사내 귀책', disp: '재작업', status: '종결', pic: '김검사', desc: '순회검사 중 버 발생 확인. 디버링 재작업 후 전수 재검사 합격 처리.', steps: [['발행', '06-19 15:50', 1], ['격리', '06-19 16:00', 1], ['원인 조사', '06-19 16:30', 1], ['조치(재작업)', '06-19 18:10', 1], ['효과 검증·종결', '06-19 18:40', 1]] },
];

/** 부적합품 발생 보고서(NCR) — 와이어프레임 qual-ncr.jsx 정본. */
export default function QualNcrScreen() {
  const [sel, setSel] = useState('NCR-260621-008');
  const [tab, setTab] = useState('전체');
  const cur = NCR_LIST.find((n) => n.no === sel) || NCR_LIST[0];
  const rows = NCR_LIST.filter((n) => tab === '전체' || (tab === '미종결' ? n.status !== '종결' : n.status === '종결'));

  const open = NCR_LIST.filter((n) => n.status !== '종결').length;
  const invest = NCR_LIST.filter((n) => n.status === '조사중').length;
  const isoQty = NCR_LIST.filter((n) => n.status !== '종결').reduce((s, n) => s + n.iso, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">부적합품 발생 보고서(NCR)</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 부적합·불량 관리 / 부적합품 발생 보고서(NCR)</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: 'NCR 발행', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['미종결 NCR', '' + open, '건', C.err],
        ['원인 조사중', '' + invest, '건', C.warn],
        ['금월 발생', '' + NCR_LIST.length, '건', C.ink],
        ['격리 수량', isoQty.toLocaleString(), 'EA', C.warn],
        ['평균 처리', '2.4', '일', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.75fr_1fr]">
        {/* 목록 */}
        <Card title="부적합 발생 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '미종결', '종결']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['NCR / 발생일', 'text-left'], ['발생 출처', 'text-center'], ['품목 / 불량', 'text-left'], ['수량', 'text-right'], ['심각도', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((n, i) => {
                const on = n.no === sel;
                return (
                  <tr key={n.no} onClick={() => setSel(n.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{n.no}</div>
                      <div className="mt-px text-[9px] text-ink3">{n.date.split(' ')[0]}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold whitespace-nowrap" style={{ color: NCR_SRC[n.src], border: `1px solid ${NCR_SRC[n.src]}44` }}>{n.src}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{n.name}</div><div className="mt-px text-[9.5px] text-ink3">{n.defect} <span className="font-mono">({n.dcode})</span></div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold" style={{ color: C.err }}>{n.qty}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={sevTone(n.sev)} solid={n.sev === '치명'}>{n.sev}</Pill></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={NCR_ST[n.status]} solid={n.status === '종결'}>{n.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="부적합 보고서 상세" bodyClassName="p-0" action={<Pill tone={NCR_ST[cur.status]} solid={cur.status === '종결'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><Pill tone={sevTone(cur.sev)} solid={cur.sev === '치명'}>{cur.sev}</Pill></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.no} · {cur.code} · LOT {cur.lot}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['발생 출처', cur.src], ['발생 위치', cur.loc], ['불량 유형', cur.defect], ['발견자', cur.pic], ['발생일시', cur.date], ['귀책', cur.fault]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10px] text-ink3">{k}</span>
                  <span className="text-right text-[10.5px] font-bold" style={{ color: k === '발생 출처' ? NCR_SRC[cur.src] : C.ink2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">부적합 내용</div>
            <div className="mb-2.5 text-[10.5px] leading-relaxed text-ink2">{cur.desc}</div>
            <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border-hi text-[10.5px] text-ink3">📷 불량 사진 첨부</div>
          </div>

          <div className="flex border-b border-border px-4 py-3">
            {([['발생 수량', cur.qty + ' EA', C.err], ['격리 수량', cur.iso + ' EA', C.warn], ['처리 구분', cur.disp, C.navy]] as const).map(([k, v, c], i, a) => (
              <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className={`text-[13px] font-extrabold ${i < 2 ? 'font-mono' : ''}`} style={{ color: c }}>{v}</div>
                <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-3 text-[10.5px] font-bold text-ink3">처리 진행</div>
            <div className="flex flex-col">
              {cur.steps.map((s, i) => {
                const done = s[2] === 1;
                const active = !done && (i === 0 || cur.steps[i - 1][2] === 1);
                const last = i === cur.steps.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold" style={{ color: done || active ? '#fff' : C.ink3, background: done ? C.ok : active ? C.warn : '#fff', border: done || active ? 'none' : `1.5px solid ${C.borderHi}` }}>{done ? '✓' : i + 1}</span>
                      {!last && <span className="w-0.5 flex-1" style={{ minHeight: 16, background: done ? C.ok : C.border }} />}
                    </div>
                    <div className="flex flex-1 items-baseline justify-between" style={{ paddingBottom: last ? 0 : 12 }}>
                      <span className="text-[11px] font-bold" style={{ color: active ? C.warn : done ? C.ink : C.ink3 }}>{s[0]}</span>
                      <span className="font-mono text-[9px]" style={{ color: active ? C.warn : C.ink3 }}>{s[1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-2">
              <button className="h-9 flex-1 rounded-lg text-[11.5px] font-bold text-white" style={{ background: C.navy }}>MRB 회부</button>
              <button className="h-9 flex-1 rounded-lg border border-border-hi bg-panel text-[11.5px] font-bold text-ink2">재작업 지시</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
