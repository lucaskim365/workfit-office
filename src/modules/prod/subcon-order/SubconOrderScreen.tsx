import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';

interface Order {
  no: string;
  vendor: string;
  proc: string;
  code: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  due: string;
  dday: number;
  mat: string;
  matType: '무상' | '유상';
  matQty: string;
  state: '지시' | '생산중' | '입고대기' | '완료';
}

const ORDERS: Order[] = [
  { no: 'SC-2606-018', vendor: '동양프레스', proc: '프레스 가공', code: 'BR-MNT-2T', name: '브래킷 본체', qty: 8000, unit: 'EA', price: 320, due: '06-25', dday: 4, mat: 'SS400 코일', matType: '무상', matQty: '2.4 ton', state: '생산중' },
  { no: 'SC-2606-017', vendor: '한빛도금', proc: '표면처리(도금)', code: 'BR-KIT-2T', name: '브래킷 키트', qty: 6000, unit: 'EA', price: 180, due: '06-23', dday: 2, mat: '브래킷 반제품', matType: '무상', matQty: '6,000 EA', state: '입고대기' },
  { no: 'SC-2606-016', vendor: '정밀가공', proc: '하우징 후가공', code: 'CN-HSG-08P', name: '커넥터 하우징', qty: 4000, unit: 'EA', price: 240, due: '06-22', dday: 1, mat: '하우징 사출품', matType: '무상', matQty: '4,000 EA', state: '생산중' },
  { no: 'SC-2606-015', vendor: '대성몰드', proc: '코어 정밀가공', code: 'TM-PIN-16', name: '터미널 핀', qty: 20000, unit: 'EA', price: 95, due: '06-20', dday: -1, mat: '동합금 스트립', matType: '유상', matQty: '85 kg', state: '완료' },
  { no: 'SC-2606-014', vendor: '동양프레스', proc: '프레스 가공', code: 'BR-MNT-2T', name: '브래킷 본체', qty: 5000, unit: 'EA', price: 320, due: '06-28', dday: 7, mat: 'SS400 코일', matType: '무상', matQty: '1.5 ton', state: '지시' },
];

const FLOW = ['지시', '생산중', '입고대기', '완료'];
const stTone = (s: string): Tone => (s === '완료' ? 'mute' : s === '입고대기' ? 'warn' : s === '생산중' ? 'ok' : 'info');
const won = (n: number) => n.toLocaleString('ko-KR');

/** 외주 작업 지시 — 와이어프레임 subcon-order.jsx 정본. */
export default function SubconOrderScreen() {
  const [sel, setSel] = useState('SC-2606-017');
  const [filter, setFilter] = useState('전체');
  const cur = ORDERS.find((o) => o.no === sel) ?? ORDERS[0];
  const rows = ORDERS.filter((o) => filter === '전체' || o.state === filter);
  const curIdx = FLOW.indexOf(cur.state);
  const amount = cur.qty * cur.price;

  const kpis: Array<[string, string, string, string]> = [
    ['진행 외주', '4', '건', 'text-ink'],
    ['입고 대기', '1', '건', 'text-amber'],
    ['납기 임박(D-2)', '2', '건', 'text-danger'],
    ['협력사', '4', '社', 'text-ink'],
    ['외주 가공비(월)', '7.0', 'M₩', 'text-teal'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">외주 작업 지시</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 외주 생산 관리 / 외주 작업 지시</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '외주 지시 발행', variant: 'primary' }, 'download']} />
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

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_340px]">
        <Card
          title="외주 작업 지시 목록"
          action={
            <div className="flex gap-1.5">
              {['전체', '지시', '생산중', '입고대기', '완료'].map((f) => {
                const on = filter === f;
                return <button key={f} onClick={() => setFilter(f)} className={`rounded-[7px] border px-2.5 py-1 text-[10.5px] font-bold ${on ? 'border-teal bg-teal text-white' : 'border-border-hi bg-panel text-ink2'}`}>{f}</button>;
              })}
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['외주번호 / 협력사', '임가공 / 품목', '수량', '가공비(₩)', '납기', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 2 || i === 3 ? 'text-right' : i >= 4 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((o, i) => {
                  const on = o.no === sel;
                  return (
                    <tr key={o.no} onClick={() => setSel(o.no)} className={`cursor-pointer ${on ? 'bg-teal-soft' : i % 2 ? 'bg-panel-alt' : 'bg-panel'}`}>
                      <td className="border-b border-border px-3 py-2.5" style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                        <div className={`font-bold ${on ? 'text-teal' : 'text-ink'}`}>{o.vendor}</div>
                        <div className="mt-px font-mono text-[9.5px] text-ink3">{o.no}</div>
                      </td>
                      <td className="border-b border-border px-3 py-2.5"><div className="font-semibold text-ink2">{o.proc}</div><div className="mt-px text-[9.5px] text-ink3">{o.name} · {o.code}</div></td>
                      <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink">{o.qty.toLocaleString()}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{won(o.qty * o.price)}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center font-mono">
                        <div className="text-[10.5px] text-ink2">{o.due}</div>
                        <div className={`text-[9px] font-bold ${o.dday >= 0 && o.dday <= 2 ? 'text-danger' : 'text-ink3'}`}>{o.dday < 0 ? '완료' : `D−${o.dday}`}</div>
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(o.state)}>{o.state}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="지시 상세" action={<span className="font-mono text-[10.5px] text-ink3">{cur.no}</span>} bodyClassName="p-0">
          <div className="border-b border-border bg-panel-alt px-4 py-3.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-ink">{cur.vendor}</span>
              <Pill tone={stTone(cur.state)}>{cur.state}</Pill>
            </div>
            <div className="text-[11px] text-ink3">{cur.proc} · {cur.name}</div>
          </div>

          {/* 진행 흐름 */}
          <div className="border-b border-border px-4 py-3.5">
            <div className="flex items-start">
              {FLOW.map((step, i) => {
                const done = i < curIdx;
                const here = i === curIdx;
                return (
                  <div key={step} className="relative flex flex-1 flex-col items-center">
                    {i > 0 && <div className="absolute top-[9px] right-1/2 h-0.5 w-full" style={{ background: i <= curIdx ? 'var(--color-teal)' : 'var(--color-border)' }} />}
                    <div
                      className="z-[1] grid h-[18px] w-[18px] place-items-center rounded-full border-2 text-[9px] font-extrabold text-white"
                      style={{ borderColor: done ? 'var(--color-teal)' : here ? 'var(--color-navy)' : 'var(--color-border-hi)', background: done ? 'var(--color-teal)' : here ? 'var(--color-navy)' : '#fff' }}
                    >
                      {done ? '✓' : ''}
                    </div>
                    <span className={`mt-1.5 text-[9px] ${here ? 'font-extrabold text-navy' : done ? 'font-semibold text-ink2' : 'text-ink3'}`}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 가공 정보 */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">가공 정보</div>
            <div className="flex flex-col gap-2">
              {([['임가공 공정', cur.proc, false], ['지시 수량', `${cur.qty.toLocaleString()} ${cur.unit}`, false], ['가공 단가', `${won(cur.price)} ₩`, false], ['가공비 합계', `${won(amount)} ₩`, true], ['납기', `${cur.due} (${cur.dday < 0 ? '완료' : 'D−' + cur.dday})`, false]] as const).map(([k, v, hi]) => (
                <div key={k} className="flex items-baseline justify-between">
                  <span className="text-[11px] text-ink3">{k}</span>
                  <span className={`font-mono ${hi ? 'text-[14px] font-extrabold text-ink' : 'text-[11.5px] font-bold text-ink2'}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 지급 자재 */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">지급 자재</div>
            <div className="flex items-center gap-2.5 rounded-[9px] bg-panel-alt px-3 py-2.5">
              <span className={`rounded-md px-2 py-[3px] text-[9.5px] font-extrabold ${cur.matType === '무상' ? 'bg-teal-soft text-teal' : 'bg-[#fef6ec] text-amber'}`}>{cur.matType}</span>
              <div className="flex-1">
                <div className="text-[11.5px] font-bold text-ink">{cur.mat}</div>
                <div className="mt-px font-mono text-[9.5px] text-ink3">출고 {cur.matQty}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-4 py-3">
            <button className="w-full rounded-[9px] border border-border-hi bg-panel py-2.5 text-[12px] font-bold text-ink2">지급 자재 출고 관리</button>
            <button className="w-full rounded-[9px] bg-navy py-2.5 text-[12px] font-extrabold text-white">외주 지시서 출력</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
