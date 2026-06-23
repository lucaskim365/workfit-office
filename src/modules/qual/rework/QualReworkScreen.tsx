import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';

const RW_ST: Record<string, Tone> = { 지시: 'info', 작업중: 'warn', 검증대기: 'warn', 승인대기: 'info', 완료: 'ok' };

interface Order { no: string; type: '재작업' | '폐기'; mrb: string; ncr: string; code: string; name: string; lot: string; qty: number; unit: string; pic: string; due: string; status: string; method?: string; proc?: string; done?: number; pass?: number; fail?: number; cost?: number; dmethod?: string; approver?: string; loss?: number; recover?: number }
const RW_ORDERS: Order[] = [
  { no: 'RW-260621-006', type: '재작업', mrb: 'MRB-260619-001', ncr: 'NCR-260619-009', code: 'FG-SFT-D', name: '샤프트 D-40', lot: 'L2606-0905', qty: 60, unit: 'EA', pic: '김작업', due: '06-22 18:00', status: '작업중', method: '재연삭 (진원도 교정)', proc: '연삭 · GRD-02', done: 42, pass: 40, fail: 2, cost: 180000 },
  { no: 'RW-260621-004', type: '재작업', mrb: 'MRB-260618-006', ncr: 'NCR-260619-014', code: 'FG-HSG-C', name: '하우징 C-Type', lot: 'L2606-0922', qty: 120, unit: 'EA', pic: '이작업', due: '06-21 16:00', status: '완료', method: '디버링 (버 제거)', proc: '후가공 · DBR-01', done: 120, pass: 118, fail: 2, cost: 96000 },
  { no: 'RW-260620-008', type: '재작업', mrb: 'MRB-260620-005', ncr: 'NCR-260621-008', code: 'FG-BRK-A', name: '브래킷 ASSY-A', lot: 'L2606-1013', qty: 18, unit: 'EA', pic: '김작업', due: '06-22 12:00', status: '지시', method: '외경 재가공', proc: 'CNC · CNC-05', done: 0, pass: 0, fail: 0, cost: 54000 },
  { no: 'SC-260621-003', type: '폐기', mrb: 'MRB-260620-003', ncr: 'NCR-260620-011', code: 'FG-GER-22', name: '기어 G-22T', lot: 'L2605-0820', qty: 35, unit: 'EA', pic: '이품질', due: '06-23', status: '승인대기', dmethod: '파쇄 (내부 처리)', approver: '품질이사', loss: 2800000, recover: 42000 },
  { no: 'SC-260620-001', type: '폐기', mrb: 'MRB-260618-004', ncr: 'NCR-260618-007', code: 'FG-INJ-X', name: '사출 불량품 일괄', lot: 'L2606-0888', qty: 80, unit: 'EA', pic: '이품질', due: '06-20', status: '완료', dmethod: '매각 (고철 처리)', approver: '품질이사', loss: 640000, recover: 88000 },
];
const won = (n: number) => '₩' + n.toLocaleString();

/** 재작업(Rework)·폐기 지시 — 와이어프레임 qual-rework.jsx 정본. */
export default function QualReworkScreen() {
  const [sel, setSel] = useState('RW-260621-006');
  const [tab, setTab] = useState('전체');
  const cur = RW_ORDERS.find((o) => o.no === sel) || RW_ORDERS[0];
  const rows = RW_ORDERS.filter((o) => tab === '전체' || o.type === tab);

  const rwCnt = RW_ORDERS.filter((o) => o.type === '재작업').length;
  const scCnt = RW_ORDERS.filter((o) => o.type === '폐기').length;
  const working = RW_ORDERS.filter((o) => o.status === '작업중' || o.status === '지시').length;
  const rwDone = RW_ORDERS.filter((o) => o.type === '재작업' && o.done! > 0);
  const yieldAvg = Math.round((rwDone.reduce((s, o) => s + o.pass!, 0) / rwDone.reduce((s, o) => s + o.done!, 0)) * 100);
  const scrapLoss = RW_ORDERS.filter((o) => o.type === '폐기').reduce((s, o) => s + o.loss!, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">재작업(Rework)·폐기 지시</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 부적합·불량 관리 / 재작업(Rework)·폐기 지시</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '지시 발행', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['재작업 지시', '' + rwCnt, '건', C.warn],
        ['폐기 지시', '' + scCnt, '건', C.err],
        ['진행중', '' + working, '건', C.ink],
        ['재작업 회수율', '' + yieldAvg, '%', C.ok],
        ['폐기 손실액', '₩' + (scrapLoss / 10000).toLocaleString() + '만', '', C.err],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        {/* 지시 목록 */}
        <Card title="재작업·폐기 지시 목록" bodyClassName="p-0" action={<ChipTabs items={['전체', '재작업', '폐기']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['지시번호 / MRB', 'text-left'], ['구분', 'text-center'], ['품목 / 처리방법', 'text-left'], ['수량', 'text-right'], ['진척', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o, i) => {
                const on = o.no === sel;
                const prog = o.type === '재작업' ? Math.round((o.done! / o.qty) * 100) : o.status === '완료' ? 100 : 0;
                return (
                  <tr key={o.no} onClick={() => setSel(o.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{o.no}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{o.mrb}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={o.type === '재작업' ? 'warn' : 'err'} solid={o.type === '폐기'}>{o.type}</Pill></td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{o.name}</div><div className="mt-px text-[9.5px] text-ink3">{o.type === '재작업' ? o.method : o.dmethod}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold text-ink">{o.qty}<span className="text-[9px] font-normal text-ink3"> {o.unit}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">
                      <div className="mb-0.5 font-mono text-[9.5px] font-bold text-ink2">{prog}%</div>
                      <div className="mx-auto h-[5px] w-[50px] rounded-[3px]" style={{ background: C.bgDeep }}><div className="h-full rounded-[3px]" style={{ width: `${prog}%`, background: o.status === '완료' ? C.ok : o.type === '폐기' ? C.err : C.warn }} /></div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={RW_ST[o.status]} solid={o.status === '완료'}>{o.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title={cur.type === '재작업' ? '재작업 지시 상세' : '폐기 지시 상세'} bodyClassName="p-0" action={<Pill tone={RW_ST[cur.status]} solid={cur.status === '완료'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><Pill tone={cur.type === '재작업' ? 'warn' : 'err'} solid={cur.type === '폐기'}>{cur.type}</Pill></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.no} · {cur.code} · LOT {cur.lot}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['연계 MRB', cur.mrb], ['연계 NCR', cur.ncr], [cur.type === '재작업' ? '재작업 방법' : '폐기 방법', cur.type === '재작업' ? cur.method! : cur.dmethod!], [cur.type === '재작업' ? '투입 공정' : '승인자', cur.type === '재작업' ? cur.proc! : cur.approver!], ['담당', cur.pic], ['기한', cur.due]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10px] text-ink3">{k}</span>
                  <span className={`text-right text-[10.5px] font-bold text-ink2 ${/MRB|NCR/.test(k) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {cur.type === '재작업' ? (
            <Fragment>
              <div className="border-b border-border px-4 py-3.5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[10.5px] font-bold text-ink3">재작업 진척</span>
                  <span className="font-mono text-[11px] font-bold text-ink">{cur.done} / {cur.qty} {cur.unit}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-[5px]" style={{ background: C.bgDeep }}><div className="h-full rounded-[5px]" style={{ width: `${(cur.done! / cur.qty) * 100}%`, background: C.warn }} /></div>
              </div>
              <div className="border-b border-border px-4 py-3.5">
                <div className="mb-2.5 text-[10px] font-bold text-ink3">재작업 후 재검사 결과</div>
                <div className="flex">
                  {([['재검사', cur.done!, C.ink], ['합격', cur.pass!, C.ok], ['불합격(폐기)', cur.fail!, C.err], ['회수율', cur.done ? Math.round((cur.pass! / cur.done!) * 100) + '%' : '—', C.teal]] as const).map(([k, v, c], i, a) => (
                    <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div className="font-mono text-[17px] font-extrabold" style={{ color: c }}>{v}</div>
                      <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 px-4 py-3.5">
                <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.navy }}>재작업 실적 등록 →</button>
                <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">재검사</button>
              </div>
            </Fragment>
          ) : (
            <Fragment>
              <div className="flex border-b border-border px-4 py-3.5">
                {([['폐기 수량', cur.qty + ' ' + cur.unit, C.ink], ['폐기 손실액', won(cur.loss!), C.err], ['회수액(매각)', won(cur.recover!), C.ok]] as const).map(([k, v, c], i, a) => (
                  <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div className="font-mono text-[12.5px] font-extrabold" style={{ color: c }}>{v}</div>
                    <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
                  </div>
                ))}
              </div>
              <div className="border-b border-border px-4 py-3.5">
                <div className="mb-2 text-[10px] font-bold text-ink3">폐기 증빙 (사진·전표)</div>
                <div className="flex h-[104px] items-center justify-center rounded-lg border border-dashed border-border-hi text-[10.5px] text-ink3">📷 폐기 증빙 첨부</div>
              </div>
              <div className="px-4 py-3.5">
                {cur.status === '승인대기' && (
                  <div className="mb-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-2" style={{ background: '#fef6ec', border: `1px solid ${C.warn}` }}>
                    <span className="text-[12px]">⚠</span><span className="text-[10px] font-bold" style={{ color: '#b5731f' }}>폐기 승인 대기 — {cur.approver} 결재 필요</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.err }}>{cur.status === '완료' ? '폐기 완료됨' : '폐기 승인·실행 →'}</button>
                  <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">전표</button>
                </div>
              </div>
            </Fragment>
          )}
        </Card>
      </div>
    </div>
  );
}
