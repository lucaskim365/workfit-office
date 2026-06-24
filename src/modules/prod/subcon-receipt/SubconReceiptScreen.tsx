import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';
import { useSubconReceipts } from '@/features/subconReceipt/useSubconReceipts';

interface Tx {
  no: string;
  date: string;
  vendor: string;
  name: string;
  good: number;
  bad: number;
  cost: number;
  insp: '합격' | '한도견본' | '불합격';
  state: '입고완료' | '검사중';
}

const TX: Tx[] = [
  { no: 'SR-2606-022', date: '06-21 14:10', vendor: '대성몰드', name: '터미널 핀', good: 19850, bad: 150, cost: 1885750, insp: '합격', state: '입고완료' },
  { no: 'SR-2606-021', date: '06-21 11:20', vendor: '정밀가공', name: '커넥터 하우징', good: 1980, bad: 20, cost: 475200, insp: '합격', state: '입고완료' },
  { no: 'SR-2606-020', date: '06-20 16:40', vendor: '한빛도금', name: '브래킷 키트', good: 2950, bad: 50, cost: 531000, insp: '한도견본', state: '검사중' },
  { no: 'SR-2606-019', date: '06-20 10:05', vendor: '동양프레스', name: '브래킷 본체', good: 3960, bad: 40, cost: 1267200, insp: '합격', state: '입고완료' },
];

const inspTone = (i: string): Tone => (i === '합격' ? 'ok' : i === '한도견본' ? 'warn' : 'err');
const stTone = (s: string): Tone => (s === '입고완료' ? 'ok' : s === '검사중' ? 'warn' : 'mute');
const won = (n: number) => n.toLocaleString('ko-KR');

/** 외주 실적/입고 등록 — 와이어프레임 subcon-receipt.jsx 정본. */
export default function SubconReceiptScreen() {
  const { data: orders = [], isLoading } = useSubconReceipts();
  const [order, setOrder] = useState('SC-2606-016');
  const [insp, setInsp] = useState('합격');
  const [filter, setFilter] = useState('전체');
  const cur = orders.find((o) => o.no === order) ?? orders[0];
  const rows = TX.filter((t) => filter === '전체' || t.state === filter);

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '외주 지시가 없습니다.'}</div>;
  }

  const remain = cur.ordered - cur.received;
  const inGood = Math.round(remain * 0.99);
  const inBad = remain - inGood;
  const cost = inGood * cur.price;

  const kpis: Array<[string, string, string, string]> = [
    ['금일 입고', '2', '건', 'text-ink'],
    ['입고 양품', '28,740', 'EA', 'text-teal'],
    ['외주 불량률', '0.90', '%', 'text-amber'],
    ['미입고 잔량', '16,000', 'EA', 'text-blue'],
    ['검사 대기', '1', '건', 'text-amber'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">외주 실적 / 입고 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 외주 생산 관리 / 외주 실적·입고 등록</p>
        </div>
        <ActionBar actions={['download']} />
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

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[360px_1fr]">
        <Card title="외주 입고 등록">
          <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">외주 지시 (미입고)</label>
          <div className="mb-3.5 flex flex-col gap-1.5">
            {orders.map((o) => {
              const on = o.no === order;
              const rem = o.ordered - o.received;
              return (
                <button key={o.no} onClick={() => setOrder(o.no)} className={`rounded-lg border-[1.5px] px-3 py-2 text-left ${on ? 'border-teal bg-teal-soft' : 'border-border bg-panel'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ink">{o.vendor}</span>
                    <span className="font-mono text-[9.5px] font-bold text-blue">잔 {rem.toLocaleString()}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] text-ink3">{o.no.slice(3)} · {o.name}</div>
                </button>
              );
            })}
          </div>

          <div className="mb-3 rounded-[9px] bg-panel-alt px-3 py-2.5">
            <div className="mb-1.5 flex justify-between text-[10px] text-ink3">
              <span>지시 {cur.ordered.toLocaleString()}</span>
              <span>기입고 {cur.received.toLocaleString()} · 잔량 {remain.toLocaleString()}</span>
            </div>
            <div className="h-[7px] rounded bg-bg-deep">
              <div className="h-full rounded bg-teal" style={{ width: `${(cur.received / cur.ordered) * 100}%` }} />
            </div>
          </div>

          <div className="mb-3 flex gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">입고 양품</label>
              <div className="flex h-9 items-center justify-center rounded-lg border border-border-hi bg-panel font-mono text-[14px] font-extrabold text-teal">{inGood.toLocaleString()}</div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">불량</label>
              <div className={`flex h-9 items-center justify-center rounded-lg border border-border-hi bg-panel font-mono text-[14px] font-extrabold ${inBad > 0 ? 'text-danger' : 'text-ink3'}`}>{inBad.toLocaleString()}</div>
            </div>
          </div>

          <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">입고 검사 판정</label>
          <div className="mb-3 flex gap-1.5">
            {([['합격', T.teal], ['한도견본', T.warn], ['불합격', T.err]] as const).map(([p, c]) => {
              const on = insp === p;
              return <button key={p} onClick={() => setInsp(p)} style={on ? { background: c, borderColor: c } : undefined} className={`flex-1 rounded-lg border-[1.5px] py-2 text-[10.5px] font-bold ${on ? 'text-white' : 'border-border-hi bg-panel text-ink2'}`}>{p}</button>;
            })}
          </div>

          <div className="mb-4 flex items-center justify-between rounded-[9px] bg-teal-soft px-3.5 py-2.5">
            <div>
              <div className="text-[10px] font-semibold text-ink3">가공비 정산 (양품 × {won(cur.price)}₩)</div>
              <div className="mt-px text-[9.5px] text-ink3">입고 검수 후 매입 전표 생성</div>
            </div>
            <span className="font-mono text-base font-extrabold text-teal">{won(cost)}₩</span>
          </div>

          <button className={`w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white ${insp === '불합격' ? 'bg-danger' : 'bg-navy'}`}>{insp === '불합격' ? '반품 처리' : '입고 등록 · 가공비 정산'}</button>
        </Card>

        <Card
          title="외주 입고 이력"
          action={
            <div className="flex gap-1.5">
              {['전체', '입고완료', '검사중'].map((f) => {
                const on = filter === f;
                return <button key={f} onClick={() => setFilter(f)} className={`rounded-[7px] border px-3 py-1 text-[10.5px] font-bold ${on ? 'border-teal bg-teal text-white' : 'border-border-hi bg-panel text-ink2'}`}>{f}</button>;
              })}
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['입고전표 / 일시', '협력사 / 품목', '양품', '불량', '가공비(₩)', '검사', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 2 && i <= 4 ? 'text-right' : i >= 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t, i) => (
                  <tr key={t.no} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5 align-top font-mono text-[10px] text-ink3">{t.no}<div className="mt-0.5 text-[9.5px]">{t.date}</div></td>
                    <td className="border-b border-border px-3 py-2.5 align-top"><div className="font-bold text-ink">{t.vendor}</div><div className="mt-px text-[9.5px] text-ink3">{t.name}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-right align-top font-mono font-extrabold text-teal">{t.good.toLocaleString()}</td>
                    <td className={`border-b border-border px-3 py-2.5 text-right align-top font-mono font-bold ${t.bad > 0 ? 'text-danger' : 'text-ink3'}`}>{t.bad}</td>
                    <td className="border-b border-border px-3 py-2.5 text-right align-top font-mono font-bold text-ink">{won(t.cost)}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center align-top"><Pill tone={inspTone(t.insp)}>{t.insp}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-center align-top"><Pill tone={stTone(t.state)}>{t.state}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-panel-alt px-4 py-2.5">
            <span className="text-[10.5px] text-ink3">{rows.length}건 · 양품 {rows.reduce((s, t) => s + t.good, 0).toLocaleString()} EA</span>
            <span className="text-[11px] text-ink3">가공비 합계 <b className="font-mono text-ink">{won(rows.reduce((s, t) => s + t.cost, 0))} ₩</b></span>
          </div>
        </Card>
      </div>
    </div>
  );
}
