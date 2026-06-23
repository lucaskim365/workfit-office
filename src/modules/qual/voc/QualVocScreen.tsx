import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';

const VOC_ST: Record<string, Tone> = { 접수: 'info', 조사중: 'warn', 회신: 'warn', 종결: 'ok' };
const VOC_TYPE: Record<string, string> = { 품질: C.err, 납기: C.warn, 포장: C.blue, 수량: '#8a5cf6', 서비스: C.teal };
const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const dueColor = (d: string) => (d === '지연' ? C.err : d === 'D-Day' || d === 'D-1' ? C.warn : C.ink2);

interface Voc { no: string; date: string; cust: string; contact: string; prod: string; code: string; lot: string; type: string; sev: string; channel: string; qty: number; due: string; status: string; pic: string; content: string; req: string; link: { ncr: string; d8: string; mrb: string }; steps: [string, string, number][] }
const VOC_LIST: Voc[] = [
  { no: 'VOC-260621-007', date: '2026-06-21', cust: '현대모비스', contact: '구매팀 김과장', prod: '기어 G-22T', code: 'FG-GER-22', lot: 'L2605-0820', type: '품질', sev: '치명', channel: '전화', qty: 35, due: 'D-1', status: '조사중', pic: '박품질', content: '조립 라인에서 기어 치합 소음 발생. 35EA 반품 요청 및 근본원인·재발방지 대책 회신 요구.', req: '8D 보고서 회신 · 재발방지 대책 · 반품 교환', link: { ncr: 'NCR-260620-011', d8: '8D-260620-002', mrb: 'MRB-260620-003' }, steps: [['접수', '06-20 16:30', 1], ['원인 분석', '진행중', 0], ['대책 수립', '—', 0], ['고객 회신', '—', 0], ['종결', '—', 0]] },
  { no: 'VOC-260620-006', date: '2026-06-20', cust: 'LG전자', contact: '품질팀 이책임', prod: '하우징 C-Type', code: 'FG-HSG-C', lot: 'L2606-0922', type: '포장', sev: '경미', channel: '이메일', qty: 200, due: 'D-3', status: '접수', pic: '미배정', content: '납품 박스 일부 파손으로 제품 표면 스크래치 우려. 포장 개선 요청.', req: '포장 사양 개선 · 해당 로트 재검', link: { ncr: '—', d8: '—', mrb: '—' }, steps: [['접수', '06-20 11:10', 1], ['원인 분석', '—', 0], ['대책 수립', '—', 0], ['고객 회신', '—', 0], ['종결', '—', 0]] },
  { no: 'VOC-260619-005', date: '2026-06-19', cust: '만도', contact: '생산관리 정대리', prod: '커버 플레이트 B', code: 'FG-CVR-B', lot: 'L2606-0910', type: '납기', sev: '주요', channel: '포털', qty: 0, due: 'D-Day', status: '회신', pic: '한영업', content: '6월 3주차 납품 2일 지연으로 고객 라인 가동 차질. 지연 사유 및 향후 대책 요청.', req: '지연 사유서 · 납기 준수 계획', link: { ncr: '—', d8: '—', mrb: '—' }, steps: [['접수', '06-19 09:40', 1], ['원인 분석', '06-19 14:00', 1], ['대책 수립', '06-19 17:00', 1], ['고객 회신', '진행중', 0], ['종결', '—', 0]] },
  { no: 'VOC-260618-004', date: '2026-06-18', cust: '현대모비스', contact: '구매팀 김과장', prod: '샤프트 D-40', code: 'FG-SFT-D', lot: 'L2606-0905', type: '품질', sev: '주요', channel: '방문', qty: 60, due: '완료', status: '종결', pic: '박품질', content: '진원도 불량 60EA 발견. 선별 및 교환 요청.', req: '교환 · 8D 회신', link: { ncr: 'NCR-260619-009', d8: '8D-260619-001', mrb: 'MRB-260619-001' }, steps: [['접수', '06-18 10:20', 1], ['원인 분석', '06-18 15:00', 1], ['대책 수립', '06-19 11:00', 1], ['고객 회신', '06-19 16:00', 1], ['종결', '06-20 09:00', 1]] },
  { no: 'VOC-260617-003', date: '2026-06-17', cust: 'LG마그나', contact: '품질팀 최주임', prod: '브래킷 ASSY-A', code: 'FG-BRK-A', lot: 'L2606-0888', type: '수량', sev: '경미', channel: '이메일', qty: 12, due: '완료', status: '종결', pic: '한영업', content: '납품 수량 12EA 부족. 추가 납품 요청.', req: '부족분 추가 납품', link: { ncr: '—', d8: '—', mrb: '—' }, steps: [['접수', '06-17 13:30', 1], ['원인 분석', '06-17 15:00', 1], ['대책 수립', '06-17 16:00', 1], ['고객 회신', '06-18 09:00', 1], ['종결', '06-18 14:00', 1]] },
];

/** 고객 클레임(VOC) 접수 관리 — 와이어프레임 qual-voc.jsx 정본. */
export default function QualVocScreen() {
  const [sel, setSel] = useState('VOC-260621-007');
  const [tab, setTab] = useState('전체');
  const cur = VOC_LIST.find((v) => v.no === sel) || VOC_LIST[0];
  const rows = VOC_LIST.filter((v) => tab === '전체' || (tab === '미종결' ? v.status !== '종결' : v.status === '종결'));

  const open = VOC_LIST.filter((v) => v.status !== '종결').length;
  const urgent = VOC_LIST.filter((v) => v.status !== '종결' && (v.due === '지연' || v.due === 'D-Day' || v.due === 'D-1')).length;
  const quality = VOC_LIST.filter((v) => v.type === '품질').length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">고객 클레임(VOC) 접수 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 추적·사후관리 / 고객 클레임(VOC) 접수 관리</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: 'VOC 접수', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['미처리 VOC', '' + open, '건', C.err],
        ['회신 임박·지연', '' + urgent, '건', C.warn],
        ['금월 접수', '' + VOC_LIST.length, '건', C.ink],
        ['품질 클레임', '' + quality, '건', C.err],
        ['평균 회신', '1.8', '일', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        {/* 목록 */}
        <Card title="고객 클레임 접수 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '미종결', '종결']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['접수번호 / 일자', 'text-left'], ['고객 / 제품', 'text-left'], ['유형', 'text-center'], ['경로', 'text-center'], ['회신기한', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => {
                const on = v.no === sel;
                return (
                  <tr key={v.no} onClick={() => setSel(v.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{v.no}</div>
                      <div className="mt-px text-[9px] text-ink3">{v.date}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{v.cust}</div><div className="mt-px text-[9.5px] text-ink3">{v.prod} · {v.lot}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ color: VOC_TYPE[v.type], border: `1px solid ${VOC_TYPE[v.type]}55` }}>{v.type}</span>
                      <div className="mt-1"><Pill tone={sevTone(v.sev)} solid={v.sev === '치명'}>{v.sev}</Pill></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center text-[10px] text-ink2">{v.channel}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center text-[10.5px] font-extrabold" style={{ color: dueColor(v.due) }}>{v.due}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={VOC_ST[v.status]} solid={v.status === '종결'}>{v.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="클레임 상세" bodyClassName="p-0" action={<Pill tone={VOC_ST[cur.status]} solid={cur.status === '종결'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ color: VOC_TYPE[cur.type], border: `1px solid ${VOC_TYPE[cur.type]}` }}>{cur.type} 클레임</span>
              <Pill tone={sevTone(cur.sev)} solid={cur.sev === '치명'}>{cur.sev}</Pill>
              <span className="ml-auto font-mono text-[9px] text-ink3">{cur.no}</span>
            </div>
            <div className="text-[14.5px] font-extrabold text-ink">{cur.cust}</div>
            <div className="mt-0.5 text-[10px] text-ink3">{cur.contact} · {cur.channel} 접수 · {cur.date}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-1.5 text-[10px] font-bold text-ink3">대상 제품</div>
            <div className="mb-2.5 text-[11px] font-bold text-ink">{cur.prod} <span className="font-mono text-[9.5px] font-normal text-ink3">{cur.code} · {cur.lot}{cur.qty ? ` · ${cur.qty}EA` : ''}</span></div>
            <div className="mb-1.5 text-[10px] font-bold text-ink3">클레임 내용</div>
            <div className="mb-2.5 text-[10.5px] leading-relaxed text-ink2">{cur.content}</div>
            <div className="mb-1.5 text-[10px] font-bold text-ink3">고객 요구사항</div>
            <div className="rounded-[7px] px-2.5 py-2 text-[10.5px] leading-relaxed text-ink2" style={{ background: C.panelAlt, borderLeft: `3px solid ${VOC_TYPE[cur.type]}` }}>{cur.req}</div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="mb-1.5 text-[10px] font-bold text-ink3">연계 처리</div>
            <div className="flex flex-wrap gap-1.5">
              {([['NCR', cur.link.ncr], ['8D', cur.link.d8], ['MRB', cur.link.mrb]] as const).map(([k, v]) => (
                <span key={k} className="rounded-md px-2 py-1 font-mono text-[9.5px] font-bold" style={{ color: v === '—' ? C.ink3 : C.blue, background: v === '—' ? C.panelAlt : C.blueSoft }}>{k} {v}</span>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-3 text-[10px] font-bold text-ink3">처리 진행</div>
            <div className="flex flex-col">
              {cur.steps.map((s, i) => {
                const done = s[2] === 1;
                const active = !done && (i === 0 || cur.steps[i - 1][2] === 1);
                const last = i === cur.steps.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8.5px] font-extrabold" style={{ color: done || active ? '#fff' : C.ink3, background: done ? C.ok : active ? C.warn : '#fff', border: done || active ? 'none' : `1.5px solid ${C.borderHi}` }}>{done ? '✓' : i + 1}</span>
                      {!last && <span className="w-0.5 flex-1" style={{ minHeight: 14, background: done ? C.ok : C.border }} />}
                    </div>
                    <div className="flex flex-1 items-baseline justify-between" style={{ paddingBottom: last ? 0 : 11 }}>
                      <span className="text-[10.5px] font-bold" style={{ color: active ? C.warn : done ? C.ink : C.ink3 }}>{s[0]}</span>
                      <span className="font-mono text-[8.5px]" style={{ color: active ? C.warn : C.ink3 }}>{s[1]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between rounded-[9px] px-3 py-2.5" style={{ background: cur.status === '종결' ? C.tealSoft : cur.due === '지연' ? '#fdf1ef' : '#fef6ec' }}>
              <span className="text-[10px] font-bold text-ink3">회신 SLA</span>
              <span className="text-[12px] font-extrabold" style={{ color: cur.status === '종결' ? C.ok : dueColor(cur.due) }}>{cur.status === '종결' ? '회신 완료' : `회신기한 ${cur.due}`}</span>
            </div>
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: cur.status === '종결' ? C.borderHi : C.navy }}>{cur.status === '종결' ? '처리 완료됨' : '고객 회신 등록 →'}</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3 text-[12px] font-bold text-ink2">8D 연계</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
