import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs, SearchBox } from '../_qual';

const ST_TONE: Record<string, Tone> = { 반품대기: 'info', 반품지시: 'warn', 출고완료: 'ok', 정산완료: 'mute' };
const judgeTone = (j: string): Tone => (j === '반품' ? 'err' : j === '특채' ? 'info' : 'warn');
const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const METHODS = ['전량반품', '부분반품', '폐기(사내)', '재작업 의뢰', '특채 승인'];
const FAULTS = ['협력사 귀책', '운송 귀책', '사내 귀책'];

interface Defect { code: string; ko: string; sev: string; qty: number }
interface Lot { rma: string; recv: string; date: string; code: string; name: string; mtype: string; vendor: string; qty: number; unit: string; ngQty: number; judge: string; method: string; fault: string; amount: number; status: string; pic: string; notify: boolean; due: string; defects: Defect[] }
const RT_LOTS: Lot[] = [
  { rma: 'RMA-260621-007', recv: 'GR-260620-028', date: '06-20 14:10', code: 'RM-STS304', name: 'STS304 강판 t2.0', mtype: '원자재', vendor: '동방스틸', qty: 280, unit: 'SHT', ngQty: 280, judge: '반품', method: '전량반품', fault: '협력사 귀책', amount: 4620000, status: '반품대기', pic: '이품질', notify: true, due: 'D-2', defects: [{ code: 'D-PR-TS', ko: '인장강도 미달', sev: '치명', qty: 6 }, { code: 'D-AP-SC', ko: '스크래치', sev: '주요', qty: 4 }] },
  { rma: 'RMA-260621-006', recv: 'GR-260620-019', date: '06-20 10:25', code: 'EL-CON-12P', name: '12P 커넥터 하우징', mtype: '부자재', vendor: '한일전자', qty: 5000, unit: 'EA', ngQty: 320, judge: '부분반품', method: '부분반품', fault: '협력사 귀책', amount: 1280000, status: '반품지시', pic: '김검사', notify: true, due: 'D-1', defects: [{ code: 'D-AP-BR', ko: '버(Burr)·이물', sev: '치명', qty: 18 }, { code: 'D-DIM-OS', ko: '핀 피치 과대', sev: '주요', qty: 7 }] },
  { rma: 'RMA-260620-005', recv: 'GR-260619-035', date: '06-19 15:20', code: 'RM-CU-T1', name: '동(Cu) 판재 t1.0', mtype: '원자재', vendor: '대한금속', qty: 90, unit: 'SHT', ngQty: 90, judge: '반품', method: '전량반품', fault: '협력사 귀책', amount: 2970000, status: '반품지시', pic: '김검사', notify: true, due: 'D-Day', defects: [{ code: 'D-DIM-LN', ko: '두께 편차', sev: '주요', qty: 3 }, { code: 'D-AP-ST', ko: '오염·얼룩', sev: '경미', qty: 5 }] },
  { rma: 'RMA-260620-004', recv: 'GR-260619-028', date: '06-19 11:05', code: 'SP-SCR-M4', name: '육각 볼트 M4×10', mtype: '부자재', vendor: '삼화정공', qty: 10000, unit: 'EA', ngQty: 10000, judge: '특채', method: '특채 승인', fault: '협력사 귀책', amount: 0, status: '출고완료', pic: '이품질', notify: false, due: '완료', defects: [{ code: 'D-AP-ST', ko: '도금 변색', sev: '경미', qty: 12 }] },
  { rma: 'RMA-260619-003', recv: 'GR-260618-041', date: '06-18 16:30', code: 'PK-BOX-A', name: '포장 박스 A형', mtype: '부자재', vendor: '한국팩', qty: 2000, unit: 'EA', ngQty: 140, judge: '부분반품', method: '폐기(사내)', fault: '운송 귀책', amount: 210000, status: '출고완료', pic: '박포장', notify: false, due: '완료', defects: [{ code: 'D-AP-DT', ko: '찍힘·눌림', sev: '주요', qty: 9 }, { code: 'D-AP-CL', ko: '인쇄 번짐', sev: '경미', qty: 4 }] },
  { rma: 'RMA-260619-002', recv: 'GR-260618-022', date: '06-18 09:40', code: 'RM-PA66', name: 'PA66 수지 (검정)', mtype: '원자재', vendor: '코리아폴리머', qty: 3200, unit: 'kg', ngQty: 3200, judge: '반품', method: '재작업 의뢰', fault: '협력사 귀책', amount: 8960000, status: '정산완료', pic: '이품질', notify: false, due: '완료', defects: [{ code: 'D-PR-TMP', ko: '함수율 초과', sev: '치명', qty: 5 }] },
];
const won = (n: number) => '₩' + n.toLocaleString();

/** 수입검사 불량/반품 처리 — 와이어프레임 qual-iqc-return.jsx 정본. */
export default function QualIqcReturnScreen() {
  const [sel, setSel] = useState('RMA-260621-007');
  const [tab, setTab] = useState('전체');
  const [q, setQ] = useState('');
  const [method, setMethod] = useState<string | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  let rows = RT_LOTS.filter((l) => tab === '전체' || l.status === tab);
  if (q) rows = rows.filter((l) => l.name.includes(q) || l.code.toLowerCase().includes(q.toLowerCase()) || l.vendor.includes(q) || l.rma.toLowerCase().includes(q.toLowerCase()));
  const cur = RT_LOTS.find((l) => l.rma === sel) || RT_LOTS[0];
  const curMethod = method ?? cur.method;
  const curFault = fault ?? cur.fault;
  useEffect(() => { setMethod(null); setFault(null); setNotify(cur.notify); }, [sel, cur.notify]);

  const cnt = (s: string) => RT_LOTS.filter((l) => l.status === s).length;
  const waiting = RT_LOTS.filter((l) => l.status === '반품대기' || l.status === '반품지시').length;
  const monthAmt = RT_LOTS.reduce((s, l) => s + l.amount, 0);
  const ngRate = (cur.ngQty / cur.qty) * 100;

  const strip: [string, string, string][] = [
    ['입고수량', cur.qty.toLocaleString(), '#fff'],
    ['불량수량', cur.ngQty.toLocaleString(), '#ff9b8e'],
    ['불량률', ngRate.toFixed(1) + '%', '#ffd27f'],
    ['반품금액', cur.amount ? '₩' + (cur.amount / 10000).toLocaleString() + '만' : '—', '#7fe3da'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">수입검사 불량/반품 처리</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 수입검사(IQC) / 수입검사 불량/반품 처리</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '반품 전표 발행', variant: 'primary' }, { icon: 'upload', label: '8D 요청', accent: 'excel' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['반품 처리 대기', '' + waiting, 'LOT', C.err],
        ['반품 지시', '' + cnt('반품지시'), 'LOT', C.warn],
        ['출고 완료', '' + cnt('출고완료'), 'LOT', C.ok],
        ['정산 완료', '' + cnt('정산완료'), 'LOT', C.ink3],
        ['이번달 반품 금액', '₩' + (monthAmt / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 }), '만', C.blue],
      ]} />

      <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-panel px-3.5 py-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="RMA·품목·협력사·입고번호" w={180} />
        <span className="ml-auto text-[10.5px] text-ink3">기준일 2026-06-21 09:00</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.9fr_1fr]">
        {/* 목록 */}
        <Card title="반품/불량 처리 대상 LOT" bodyClassName="p-0" action={<ChipTabs items={['전체', '반품대기', '반품지시', '출고완료', '정산완료']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['RMA / 입고번호', 'text-left'], ['품목', 'text-left'], ['협력사', 'text-left'], ['불량/입고', 'text-right'], ['판정', 'text-center'], ['반품금액', 'text-right'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => {
                const on = l.rma === sel;
                return (
                  <tr key={l.rma} onClick={() => setSel(l.rma)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{l.rma}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{l.recv}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{l.name}</div><div className="mt-px font-mono text-[9px] text-ink3">{l.code} · {l.mtype}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-[10.5px]">{l.vendor}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono"><div className="text-[10.5px] font-extrabold" style={{ color: C.err }}>{l.ngQty.toLocaleString()}</div><div className="text-[9px] text-ink3">/ {l.qty.toLocaleString()} {l.unit}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={judgeTone(l.judge)} solid>{l.judge}</Pill></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold" style={{ color: l.amount ? C.ink : C.ink3 }}>{l.amount ? won(l.amount) : '—'}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={ST_TONE[l.status]}>{l.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 처리 상세 */}
        <Card title="반품/불량 처리" bodyClassName="p-0" action={<Pill tone={ST_TONE[cur.status]} solid>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><Pill tone={judgeTone(cur.judge)}>{cur.judge}</Pill></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.code} · {cur.rma} · {cur.vendor}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="flex rounded-[9px] px-1.5 py-2.5" style={{ background: C.navy }}>
              {strip.map(([k, v, c], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < strip.length - 1 ? '1px solid rgba(255,255,255,.14)' : 'none' }}>
                  <div className="font-mono text-[14px] font-extrabold" style={{ color: c }}>{v}</div>
                  <div className="mt-0.5 text-[8.5px] text-white/55">{k}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">불량 유형 내역 ({cur.defects.length})</div>
            <div className="flex flex-col gap-1.5">
              {cur.defects.map((d, i) => (
                <div key={i} className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5" style={{ background: C.panelAlt }}>
                  <span className="w-[62px] shrink-0 font-mono text-[9px] font-bold text-ink3">{d.code}</span>
                  <span className="text-[11px] font-bold text-ink">{d.ko}</span>
                  <span className="ml-auto flex items-center gap-2"><Pill tone={sevTone(d.sev)}>{d.sev}</Pill><span className="font-mono text-[10.5px] font-bold text-ink2">{d.qty}건</span></span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10px] font-bold text-ink3">처리 방법</div>
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => {
                const on = curMethod === m;
                return <button key={m} onClick={() => setMethod(m)} className="rounded-lg px-2.5 py-2 text-[11px] font-bold" style={{ border: `1.5px solid ${on ? C.navy : C.border}`, background: on ? C.navy : '#fff', color: on ? '#fff' : C.ink2 }}>{m}</button>;
              })}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10px] font-bold text-ink3">귀책 구분</div>
            <div className="grid grid-cols-3 gap-1.5">
              {FAULTS.map((f) => {
                const on = curFault === f;
                const c = f === '사내 귀책' ? C.warn : f === '운송 귀책' ? C.blue : C.err;
                return <button key={f} onClick={() => setFault(f)} className="rounded-lg py-2.5 text-[10.5px] font-extrabold" style={{ border: `1.5px solid ${on ? c : C.border}`, background: on ? c + '14' : '#fff', color: on ? c : C.ink2 }}>{f}</button>;
              })}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: C.panelAlt }}>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold text-ink">협력사 시정조치(8D) 요청</span>
                <span className="text-[9.5px] text-ink3">회신 기한 {cur.due === '완료' ? '—' : cur.due} · 담당 {cur.pic}</span>
              </div>
              <button onClick={() => setNotify((v) => !v)} className="relative h-6 w-[42px] shrink-0 rounded-full" style={{ background: notify ? C.teal : C.borderHi }}>
                <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow" style={{ left: notify ? 21 : 3 }} />
              </button>
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-1.5 text-[10px] font-bold text-ink3">처리 비고</div>
            <textarea placeholder="반품 사유·운송·정산 특이사항 입력" className="mb-2.5 h-[50px] w-full resize-none rounded-lg border border-border-hi p-2.5 text-[11px] text-ink outline-none" />
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.navy }}>반품 전표 발행 →</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">임시저장</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
