import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { useSubconIssues } from '@/features/subconIssue/useSubconIssues';

interface Tx {
  no: string;
  date: string;
  vendor: string;
  mat: string;
  type: '무상' | '유상';
  qty: string;
  amt: number;
  ref: string;
  state: '출고완료' | '출고대기';
}

const TX: Tx[] = [
  { no: 'SI-2606-027', date: '06-21 13:40', vendor: '동양프레스', mat: 'SS400 코일', type: '무상', qty: '2.4 ton', amt: 0, ref: 'SC-2606-018', state: '출고완료' },
  { no: 'SI-2606-026', date: '06-21 10:30', vendor: '정밀가공', mat: '하우징 사출품', type: '무상', qty: '4,000 EA', amt: 0, ref: 'SC-2606-016', state: '출고완료' },
  { no: 'SI-2606-025', date: '06-20 16:10', vendor: '대성몰드', mat: '동합금 스트립', type: '유상', qty: '85 kg', amt: 1870000, ref: 'SC-2606-015', state: '출고완료' },
  { no: 'SI-2606-024', date: '06-20 09:50', vendor: '한빛도금', mat: '브래킷 반제품', type: '무상', qty: '6,000 EA', amt: 0, ref: 'SC-2606-017', state: '출고완료' },
  { no: 'SI-2606-023', date: '06-19 14:20', vendor: '동양프레스', mat: 'SS400 코일', type: '무상', qty: '1.5 ton', amt: 0, ref: 'SC-2606-014', state: '출고대기' },
];

const HOLDING: Array<[string, string, string, string]> = [
  ['동양프레스', 'SS400 코일', '2.4 ton', '06-21'],
  ['정밀가공', '하우징 사출품', '4,000 EA', '06-21'],
  ['한빛도금', '브래킷 반제품', '6,000 EA', '06-20'],
  ['대성몰드', '동합금 스트립', '85 kg', '06-20'],
];

const typeTone = (t: string): Tone => (t === '무상' ? 'ok' : 'warn');
const stTone = (s: string): Tone => (s === '출고완료' ? 'ok' : 'info');
const won = (n: number) => n.toLocaleString('ko-KR');

/** 외주 자재 출고 관리 — 와이어프레임 subcon-issue.jsx 정본. */
export default function SubconIssueScreen() {
  const [order, setOrder] = useState('SC-2606-018');
  const [filter, setFilter] = useState('전체');
  const { data: orders = [], isLoading } = useSubconIssues();
  const cur = orders.find((o) => o.no === order) ?? orders[0];
  const rows = TX.filter((t) => filter === '전체' || t.type === filter);

  if (isLoading || !cur) {
    return <div className="p-6 text-[12px] text-ink3">불러오는 중…</div>;
  }

  const kpis: Array<[string, string, string, string]> = [
    ['금일 출고', '2', '건', 'text-ink'],
    ['무상 지급', '4', '건', 'text-teal'],
    ['유상 지급액(월)', '1.87', 'M₩', 'text-amber'],
    ['외주처 보유(미회수)', '4', '건', 'text-blue'],
    ['협력사', '4', '社', 'text-ink'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">외주 자재 출고 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 외주 생산 관리 / 외주 자재 출고 관리</p>
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

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-3.5">
          <Card title="지급 자재 출고 등록">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">외주 지시</label>
            <div className="mb-3 flex flex-col gap-1.5">
              {orders.map((o) => {
                const on = o.no === order;
                return (
                  <button key={o.no} onClick={() => setOrder(o.no)} className={`flex items-center gap-2.5 rounded-lg border-[1.5px] px-3 py-2 text-left ${on ? 'border-teal bg-teal-soft' : 'border-border bg-panel'}`}>
                    <span className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${on ? 'bg-panel text-teal' : 'bg-bg-deep text-blue'}`}>{o.no.slice(3)}</span>
                    <span className="flex-1 text-[11px] font-bold text-ink">{o.vendor}</span>
                  </button>
                );
              })}
            </div>

            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">지급 자재</label>
            {cur.mats.map((m) => (
              <div key={m.code} className="mb-1.5 rounded-[9px] border border-border px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-ink">{m.name}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-extrabold ${m.type === '무상' ? 'bg-teal-soft text-teal' : 'bg-[#fef6ec] text-amber'}`}>{m.type}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[9.5px] text-ink3">{m.code}</span>
                  <span className="font-mono text-[14px] font-extrabold text-ink">{m.qty} <span className="text-[10px] text-ink3">{m.unit}</span></span>
                </div>
                {m.type === '유상' && (
                  <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-[10px]">
                    <span className="text-ink3">유상 단가 {won(m.price)}₩</span>
                    <span className="font-mono font-extrabold text-amber">{won(Math.round(parseFloat(m.qty.replace(/,/g, '')) * m.price))}₩</span>
                  </div>
                )}
              </div>
            ))}

            <button className="mt-1.5 w-full rounded-[9px] bg-navy py-3 text-[13px] font-extrabold text-white">자재 출고 등록</button>
            <div className="mt-2 text-center text-[9.5px] text-ink3">출고 시 재고 차감 및 외주처 보유 자재로 등록됩니다.</div>
          </Card>

          <Card title="외주처 보유(미회수) 자재" bodyClassName="p-0">
            <div className="py-1">
              {HOLDING.map((h, i) => (
                <div key={h[0]} className={`flex items-center gap-2.5 px-4 py-2.5 ${i < HOLDING.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-bold text-ink">{h[0]}</div>
                    <div className="mt-px text-[9.5px] text-ink3">{h[1]} · {h[3]}~</div>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-ink2">{h[2]}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card
          title="자재 출고 이력"
          action={
            <div className="flex gap-1.5">
              {['전체', '무상', '유상'].map((f) => {
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
                  {['전표 / 일시', '협력사 / 자재', '구분', '수량', '유상 금액(₩)', '외주지시', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 || i === 4 ? 'text-right' : i === 2 || i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t, i) => (
                  <tr key={t.no} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5 align-top font-mono text-[10px] text-ink3">{t.no}<div className="mt-0.5 text-[9.5px]">{t.date}</div></td>
                    <td className="border-b border-border px-3 py-2.5 align-top"><div className="font-bold text-ink">{t.vendor}</div><div className="mt-px text-[9.5px] text-ink3">{t.mat}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-center align-top"><Pill tone={typeTone(t.type)}>{t.type}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 text-right align-top font-mono font-bold text-ink">{t.qty}</td>
                    <td className={`border-b border-border px-3 py-2.5 text-right align-top font-mono font-bold ${t.amt > 0 ? 'text-amber' : 'text-ink3'}`}>{t.amt > 0 ? won(t.amt) : '–'}</td>
                    <td className="border-b border-border px-3 py-2.5 align-top font-mono text-[10px] text-ink3">{t.ref}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center align-top"><Pill tone={stTone(t.state)}>{t.state}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-panel-alt px-4 py-2.5">
            <span className="text-[10.5px] text-ink3">{rows.length}건</span>
            <span className="text-[11px] text-ink3">유상 지급액 합계 <b className="font-mono text-amber">{won(rows.reduce((s, t) => s + t.amt, 0))} ₩</b></span>
          </div>
        </Card>
      </div>
    </div>
  );
}
