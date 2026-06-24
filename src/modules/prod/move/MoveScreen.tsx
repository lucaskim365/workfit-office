import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { useMoveWip } from '@/features/moveWip/useMoveWip';

interface Tx {
  no: string;
  date: string;
  lot: string;
  name: string;
  from: string;
  to: string;
  good: number;
  bad: number;
  by: string;
  state: '완료' | '이동중';
}

const TX: Tx[] = [
  { no: 'MV-2606-041', date: '06-21 13:25', lot: 'LOT-2606-A11', name: '커넥터 하우징', from: 'OP10 사출성형', to: 'OP20 디버링', good: 4760, bad: 40, by: '김설비', state: '완료' },
  { no: 'MV-2606-040', date: '06-21 12:50', lot: 'LOT-2606-D08', name: '센서 모듈 PCB', from: 'OP10 SMT실장', to: 'OP20 리플로우', good: 5360, bad: 40, by: '이생산', state: '완료' },
  { no: 'MV-2606-039', date: '06-21 11:30', lot: 'LOT-2606-B06', name: '터미널 핀', from: 'OP30 압착', to: 'OP40 조립', good: 11900, bad: 100, by: '박작업', state: '이동중' },
  { no: 'MV-2606-038', date: '06-21 10:15', lot: 'LOT-2606-C02', name: '커넥터 어셈블리', from: 'OP40 조립', to: 'OP50 검사', good: 2380, bad: 20, by: '김설비', state: '완료' },
  { no: 'MV-2606-037', date: '06-21 09:05', lot: 'LOT-2606-E01', name: '센서 모듈', from: 'OP50 검사', to: '입고', good: 1470, bad: 30, by: '이생산', state: '완료' },
];

const stTone = (s: Tx['state']): Tone => (s === '완료' ? 'ok' : 'info');

/** 공정 이동 처리 — 와이어프레임 move.jsx 정본. */
export default function MoveScreen() {
  const { data: wips = [], isLoading } = useMoveWip();
  const [lot, setLot] = useState('LOT-2606-A12');
  const [filter, setFilter] = useState('전체');
  const cur = wips.find((w) => w.lot === lot) ?? wips[0];
  const rows = TX.filter((t) => filter === '전체' || t.state === filter);

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '이동 대기 재공 LOT이 없습니다.'}</div>;
  }

  const kpis: Array<[string, string, string, string]> = [
    ['금일 이동', '5', '건', 'text-ink'],
    ['이동 대기 LOT', String(wips.length), '건', 'text-blue'],
    ['양품 이동수량', '24,860', 'EA', 'text-teal'],
    ['불량 분류', '190', 'EA', 'text-danger'],
    ['정체 LOT(2h+)', '2', '건', 'text-amber'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공정 이동 처리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 실행·실적 / 공정 이동 처리</p>
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

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[360px_1fr]">
        {/* 이동 등록 */}
        <Card title="공정 이동 등록">
          <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">이동 대상 LOT (재공)</label>
          <div className="mb-3.5 flex max-h-[188px] flex-col gap-1.5 overflow-y-auto">
            {wips.map((w) => {
              const on = w.lot === lot;
              return (
                <button key={w.lot} onClick={() => setLot(w.lot)} className={`rounded-lg border-[1.5px] px-3 py-2 text-left ${on ? 'border-teal bg-teal-soft' : 'border-border bg-panel'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ink">{w.name}</span>
                    {w.wait >= 2 && <span className="rounded-[5px] bg-[#fef6ec] px-1.5 py-px text-[8.5px] font-extrabold text-amber">정체 {w.wait}h</span>}
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] text-ink3">{w.lot} · {w.cur}</div>
                </button>
              );
            })}
          </div>

          <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">공정 이동</label>
          <div className="mb-3.5 flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-border bg-panel-alt px-3 py-2.5">
              <div className="text-[8.5px] font-bold text-ink3">현 공정</div>
              <div className="mt-0.5 text-[11.5px] font-extrabold text-ink2">{cur.cur}</div>
            </div>
            <span className="text-base font-extrabold text-teal">→</span>
            <div className="flex-1 rounded-lg border border-teal bg-teal-soft px-3 py-2.5">
              <div className="text-[8.5px] font-bold text-teal">다음 공정</div>
              <div className="mt-0.5 text-[11.5px] font-extrabold text-teal">{cur.next}</div>
            </div>
          </div>

          <div className="mb-3.5 flex gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">이동 수량(양품)</label>
              <div className="flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 font-mono text-[12.5px] font-extrabold text-teal">{cur.good.toLocaleString()}</div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">불량 분류</label>
              <div className={`flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 font-mono text-[12.5px] font-extrabold ${cur.bad > 0 ? 'text-danger' : 'text-ink3'}`}>{cur.bad.toLocaleString()}</div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-[9px] bg-panel-alt px-3.5 py-2.5">
            <span className="text-[11px] font-semibold text-ink3">총 재공 {cur.qty.toLocaleString()} · 수율</span>
            <span className="font-mono text-[15px] font-extrabold text-ink">{((cur.good / cur.qty) * 100).toFixed(1)}%</span>
          </div>

          <button className="w-full rounded-[9px] bg-navy py-3 text-[13px] font-extrabold text-white">{cur.next.includes('완료') ? '완료 처리 · 입고 이관' : '공정 이동 등록'}</button>
          <div className="mt-2 text-center text-[9.5px] text-ink3">불량 수량은 자동으로 불량 내역 등록으로 연계됩니다.</div>
        </Card>

        {/* 이력 */}
        <Card
          title="공정 이동 이력"
          action={
            <div className="flex gap-1.5">
              {['전체', '이동중', '완료'].map((f) => {
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
                  {['전표 / 일시', 'LOT / 품목', '이동 (From → To)', '양품', '불량', '처리자', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 || i === 4 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t, i) => (
                  <tr key={t.no} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5 align-top font-mono text-[10px] text-ink3">{t.no}<div className="mt-0.5 text-[9.5px]">{t.date}</div></td>
                    <td className="border-b border-border px-3 py-2.5 align-top"><div className="font-bold text-ink">{t.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{t.lot}</div></td>
                    <td className="border-b border-border px-3 py-2.5 align-top">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                        <span className="text-ink3">{t.from}</span>
                        <span className="font-extrabold text-teal">→</span>
                        <span className="font-bold text-ink">{t.to}</span>
                      </div>
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-right align-top font-mono font-extrabold text-teal">{t.good.toLocaleString()}</td>
                    <td className={`border-b border-border px-3 py-2.5 text-right align-top font-mono font-bold ${t.bad > 0 ? 'text-danger' : 'text-ink3'}`}>{t.bad}</td>
                    <td className="border-b border-border px-3 py-2.5 align-top text-ink2">{t.by}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center align-top"><Pill tone={stTone(t.state)}>{t.state}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
