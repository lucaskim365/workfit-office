import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';

interface Mat {
  code: string;
  name: string;
  req: number;
  unit: string;
  stock: number;
  loc: string;
}
interface WO {
  wo: string;
  name: string;
  line: string;
  mats: Mat[];
}

const WOS: WO[] = [
  { wo: 'WO-1001', name: '커넥터 하우징', line: '사출 03호기', mats: [
    { code: 'PA66-GF30', name: 'PA66 강화수지', req: 240, unit: 'kg', stock: 1850, loc: 'A-01-2' },
    { code: 'MB-CLR-BK', name: '마스터배치(흑)', req: 6, unit: 'kg', stock: 95, loc: 'A-02-1' },
  ] },
  { wo: 'WO-1003', name: '커넥터 어셈블리', line: '조립셀 A', mats: [
    { code: 'CN-HSG-08P', name: '커넥터 하우징', req: 2400, unit: 'EA', stock: 2600, loc: 'B-01-3' },
    { code: 'TM-PIN-16', name: '터미널 핀', req: 38400, unit: 'EA', stock: 31000, loc: 'B-02-1' },
    { code: 'SEAL-RING', name: '실링 O-Ring', req: 2400, unit: 'EA', stock: 5000, loc: 'B-03-2' },
    { code: 'LABEL-CN', name: '식별 라벨', req: 2400, unit: 'EA', stock: 8000, loc: 'C-01-1' },
  ] },
  { wo: 'WO-1004', name: '센서 모듈 PCB', line: 'SMT 라인 2', mats: [
    { code: 'IC-SEN-A1', name: '센서 IC', req: 5400, unit: 'EA', stock: 0, loc: 'D-01-1' },
    { code: 'CHIP-0402', name: '칩부품 0402', req: 129600, unit: 'EA', stock: 480000, loc: 'D-02-4' },
    { code: 'CASE-SN', name: '센서 케이스', req: 5400, unit: 'EA', stock: 6200, loc: 'B-04-2' },
  ] },
];

interface Tx {
  no: string;
  date: string;
  wo: string;
  name: string;
  cnt: number;
  prio: '보통' | '긴급';
  by: string;
  state: '불출중' | '보류' | '완료';
}

const TX: Tx[] = [
  { no: 'MR-2606-066', date: '06-21 13:10', wo: 'WO-1001', name: '커넥터 하우징', cnt: 2, prio: '보통', by: '김작업', state: '불출중' },
  { no: 'MR-2606-065', date: '06-21 11:30', wo: 'WO-1003', name: '커넥터 어셈블리', cnt: 4, prio: '긴급', by: '이생산', state: '보류' },
  { no: 'MR-2606-064', date: '06-21 10:00', wo: 'WO-1009', name: '센서 모듈 PCB', cnt: 3, prio: '보통', by: '박작업', state: '완료' },
  { no: 'MR-2606-063', date: '06-21 09:10', wo: 'WO-1002', name: '터미널 핀', cnt: 1, prio: '보통', by: '김작업', state: '완료' },
  { no: 'MR-2606-062', date: '06-21 08:30', wo: 'WO-1008', name: '브래킷 본체', cnt: 2, prio: '보통', by: '이생산', state: '완료' },
];

const stTone = (s: Tx['state']): Tone => (s === '불출중' ? 'warn' : s === '완료' ? 'ok' : 'err');

/** 자재 청구/불출 요청 — 와이어프레임 material-request.jsx 정본. */
export default function MaterialReqScreen() {
  const [wo, setWo] = useState('WO-1003');
  const [prio, setPrio] = useState('보통');
  const [filter, setFilter] = useState('전체');
  const cur = WOS.find((w) => w.wo === wo) ?? WOS[0];
  const rows = TX.filter((t) => filter === '전체' || t.state === filter);
  const shortage = cur.mats.filter((m) => m.stock < m.req).length;

  const kpis: Array<[string, string, string, string]> = [
    ['금일 청구', '5', '건', 'text-ink'],
    ['불출 대기/진행', '1', '건', 'text-amber'],
    ['완료', '3', '건', 'text-ok'],
    ['보류(결품)', '1', '건', 'text-danger'],
    ['결품 자재', '1', '종', 'text-danger'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">자재 청구 / 불출 요청</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 실행·실적 / 자재 청구·불출 요청</p>
        </div>
        <ActionBar actions={['refresh', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c]) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${c}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_360px]">
        <Card
          title="자재 청구 등록"
          action={
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-ink3">작업지시</span>
              <div className="flex gap-1.5">
                {WOS.map((w) => (
                  <button key={w.wo} onClick={() => setWo(w.wo)} className={`rounded-[7px] border px-2.5 py-1 font-mono text-[10px] font-bold ${wo === w.wo ? 'border-teal bg-teal text-white' : 'border-border-hi bg-panel text-ink2'}`}>{w.wo}</button>
                ))}
              </div>
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="flex items-center justify-between border-b border-border bg-panel-alt px-4 py-3">
            <div>
              <span className="text-[13px] font-extrabold text-ink">{cur.name}</span>
              <span className="ml-2 font-mono text-[10px] text-ink3">{cur.wo} · {cur.line}</span>
            </div>
            {shortage > 0 && <Pill tone="err">결품 {shortage}종</Pill>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['자재', '보관위치', '소요량', '창고 재고', '청구량', '가용'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 2 && i <= 4 ? 'text-right' : i === 1 || i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cur.mats.map((m, i) => {
                  const short = m.stock < m.req;
                  return (
                    <tr key={m.code} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{m.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{m.code}</div></td>
                      <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px] text-ink3">{m.loc}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink">{m.req.toLocaleString()} {m.unit}</td>
                      <td className={`border-b border-border px-3 py-2.5 text-right font-mono ${short ? 'text-danger' : 'text-ink2'}`}>{m.stock.toLocaleString()}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-teal">{m.req.toLocaleString()}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center">{short ? <Pill tone="err">{m.stock === 0 ? '결품' : '부족'}</Pill> : <Pill tone="ok">충분</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 border-t border-border px-4 py-3">
            <span className="text-[10.5px] font-bold text-ink3">긴급도</span>
            <div className="flex gap-1.5">
              {(['보통', '긴급'] as const).map((p) => {
                const on = prio === p;
                const c = p === '긴급' ? T.err : T.teal;
                return <button key={p} onClick={() => setPrio(p)} style={on ? { background: c, borderColor: c } : undefined} className={`rounded-[7px] border px-3.5 py-1.5 text-[10.5px] font-bold ${on ? 'text-white' : 'border-border-hi bg-panel text-ink2'}`}>{p}</button>;
              })}
            </div>
            <button disabled={shortage > 0} className={`ml-auto rounded-[9px] px-5 py-2.5 text-[12.5px] font-extrabold text-white ${shortage > 0 ? 'cursor-not-allowed bg-border-hi' : 'bg-navy'}`}>{shortage > 0 ? '결품 — 청구 보류' : '자재 청구 등록'}</button>
          </div>
        </Card>

        <Card
          title="청구 / 불출 이력"
          action={
            <div className="flex gap-1.5">
              {['전체', '불출중', '완료', '보류'].map((f) => {
                const on = filter === f;
                return <button key={f} onClick={() => setFilter(f)} className={`rounded-[7px] border px-2.5 py-1 text-[10px] font-bold ${on ? 'border-teal bg-teal text-white' : 'border-border-hi bg-panel text-ink2'}`}>{f}</button>;
              })}
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="py-1">
            {rows.map((t, i) => (
              <div key={t.no} className={`px-4 py-3 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-ink">{t.name}</span>
                  <Pill tone={stTone(t.state)}>{t.state}</Pill>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9.5px] text-ink3">{t.no} · {t.wo} · 자재 {t.cnt}종</span>
                  <span className="flex items-center gap-1.5">
                    {t.prio === '긴급' && <Pill tone="err">긴급</Pill>}
                    <span className="text-[9.5px] text-ink3">{t.date.slice(6)} · {t.by}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
