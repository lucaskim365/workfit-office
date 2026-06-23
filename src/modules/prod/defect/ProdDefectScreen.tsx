import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { T } from '@/shared/theme/tokens';

const CODES = [
  { code: 'D-EXT', name: '외관 불량', c: T.blue },
  { code: 'D-DIM', name: '치수 불량', c: T.warn },
  { code: 'D-SLD', name: '납땜 불량', c: T.teal },
  { code: 'D-FUN', name: '기능 불량', c: T.err },
  { code: 'D-ASM', name: '조립 불량', c: T.c5 },
  { code: 'D-MAT', name: '소재 불량', c: T.ink2 },
];
const CODE_MAP = Object.fromEntries(CODES.map((d) => [d.code, d]));

const LOTS = [
  { lot: 'LOT-2606-A12', name: '커넥터 하우징', proc: 'OP20 디버링' },
  { lot: 'LOT-2606-D09', name: '센서 모듈 PCB', proc: 'OP30 AOI' },
  { lot: 'LOT-2606-C03', name: '커넥터 어셈블리', proc: 'OP50 기능검사' },
  { lot: 'LOT-2606-B07', name: '터미널 핀', proc: 'OP30 압착' },
];

interface Tx {
  no: string;
  date: string;
  lot: string;
  name: string;
  proc: string;
  code: string;
  qty: number;
  action: '재작업' | '폐기' | '특채';
  by: string;
}

const TX: Tx[] = [
  { no: 'DF-2606-052', date: '06-21 13:30', lot: 'LOT-2606-A12', name: '커넥터 하우징', proc: 'OP20 디버링', code: 'D-EXT', qty: 24, action: '재작업', by: '김품질' },
  { no: 'DF-2606-051', date: '06-21 12:10', lot: 'LOT-2606-D09', name: '센서 모듈 PCB', proc: 'OP30 AOI', code: 'D-SLD', qty: 40, action: '재작업', by: '이검사' },
  { no: 'DF-2606-050', date: '06-21 11:05', lot: 'LOT-2606-C03', name: '커넥터 어셈블리', proc: 'OP50 기능검사', code: 'D-FUN', qty: 24, action: '폐기', by: '김품질' },
  { no: 'DF-2606-049', date: '06-21 10:20', lot: 'LOT-2606-B07', name: '터미널 핀', proc: 'OP30 압착', code: 'D-DIM', qty: 60, action: '폐기', by: '박작업' },
  { no: 'DF-2606-048', date: '06-21 09:15', lot: 'LOT-2606-E02', name: '센서 모듈', proc: 'OP50 기능검사', code: 'D-FUN', qty: 28, action: '특채', by: '이검사' },
  { no: 'DF-2606-047', date: '06-21 08:40', lot: 'LOT-2606-A11', name: '커넥터 하우징', proc: 'OP10 사출', code: 'D-EXT', qty: 40, action: '재작업', by: '김품질' },
];

const actionTone = (a: Tx['action']): Tone => (a === '재작업' ? 'warn' : a === '폐기' ? 'err' : 'mute');

/** 불량 내역 등록 — 와이어프레임 defect-reg.jsx 정본. */
export default function ProdDefectScreen() {
  const [lot, setLot] = useState('LOT-2606-A12');
  const [code, setCode] = useState('D-EXT');
  const [action, setAction] = useState('재작업');
  const [filter, setFilter] = useState('전체');
  const rows = TX.filter((t) => filter === '전체' || t.action === filter);

  const codeAgg: Record<string, number> = {};
  TX.forEach((t) => (codeAgg[t.code] = (codeAgg[t.code] || 0) + t.qty));
  const codeRows = Object.keys(codeAgg)
    .sort((a, b) => codeAgg[b] - codeAgg[a])
    .map((k) => ({ label: CODE_MAP[k].name, v: codeAgg[k], c: CODE_MAP[k].c }));

  const kpis: Array<[string, string, string, string]> = [
    ['금일 불량 수량', '216', 'EA', 'text-danger'],
    ['공정 불량률', '0.82', '%', 'text-amber'],
    ['최다 불량', codeRows[0].label, '', 'text-ink'],
    ['재작업 대상', '104', 'EA', 'text-amber'],
    ['폐기 대상', '84', 'EA', 'text-danger'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">불량 내역 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 실행·실적 / 불량 내역 등록</p>
        </div>
        <ActionBar actions={['download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c], i) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`font-extrabold tracking-tight tabular-nums ${c} ${i === 2 ? 'text-base' : 'text-2xl'}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-3.5">
          <Card title="불량 등록">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">대상 LOT / 공정</label>
            <div className="mb-3 flex flex-col gap-1.5">
              {LOTS.map((w) => {
                const on = w.lot === lot;
                return (
                  <button key={w.lot} onClick={() => setLot(w.lot)} className={`flex items-center gap-2.5 rounded-lg border-[1.5px] px-3 py-2 text-left ${on ? 'border-teal bg-teal-soft' : 'border-border bg-panel'}`}>
                    <span className="flex-1 text-[11px] font-bold text-ink">{w.name}</span>
                    <span className="font-mono text-[9px] text-ink3">{w.proc}</span>
                  </button>
                );
              })}
            </div>

            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">불량 코드</label>
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {CODES.map((d) => {
                const on = d.code === code;
                return (
                  <button key={d.code} onClick={() => setCode(d.code)} style={{ borderColor: on ? d.c : T.border, background: on ? `${d.c}14` : '#fff' }} className="flex items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 py-1.5 text-left">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.c }} />
                    <div className="min-w-0">
                      <div className="whitespace-nowrap text-[10.5px] font-bold text-ink">{d.name}</div>
                      <div className="font-mono text-[8.5px] text-ink3">{d.code}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">불량 수량</label>
            <div className="mb-3 flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 font-mono text-[12.5px] font-extrabold text-danger">24</div>

            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">조치 구분</label>
            <div className="mb-4 flex gap-1.5">
              {([['재작업', T.warn], ['폐기', T.err], ['특채', T.ink2]] as const).map(([a, c]) => {
                const on = action === a;
                return (
                  <button key={a} onClick={() => setAction(a)} style={on ? { background: c, borderColor: c } : undefined} className={`flex-1 rounded-lg border-[1.5px] py-2 text-[11.5px] font-extrabold ${on ? 'text-white' : 'border-border-hi bg-panel text-ink2'}`}>{a}</button>
                );
              })}
            </div>

            <button className="w-full rounded-[9px] bg-navy py-3 text-[13px] font-extrabold text-white">불량 등록</button>
            <div className="mt-2 text-center text-[9.5px] text-ink3">{action === '재작업' ? '재작업 지시로 자동 연계됩니다.' : action === '폐기' ? '재고에서 차감되며 손실로 집계됩니다.' : '특채 승인 요청이 품질팀에 전달됩니다.'}</div>
          </Card>

          <Card title="불량 코드별 분포 (금일)">
            <RankBars rows={codeRows} />
          </Card>
        </div>

        <Card
          title="불량 등록 이력"
          action={
            <div className="flex gap-1.5">
              {['전체', '재작업', '폐기', '특채'].map((f) => {
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
                  {['전표 / 일시', 'LOT / 품목', '공정', '불량 코드', '수량', '조치', '등록자'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 4 ? 'text-right' : i === 3 || i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t, i) => {
                  const d = CODE_MAP[t.code];
                  return (
                    <tr key={t.no} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5 align-top font-mono text-[10px] text-ink3">{t.no}<div className="mt-0.5 text-[9.5px]">{t.date}</div></td>
                      <td className="border-b border-border px-3 py-2.5 align-top"><div className="font-bold text-ink">{t.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{t.lot}</div></td>
                      <td className="border-b border-border px-3 py-2.5 align-top text-[10.5px] text-ink2">{t.proc}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center align-top">
                        <span style={{ color: d.c, background: `${d.c}16` }} className="rounded-md px-2 py-[3px] text-[10px] font-bold">{d.name}</span>
                        <div className="mt-0.5 font-mono text-[8.5px] text-ink3">{t.code}</div>
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-right align-top font-mono font-extrabold text-danger">{t.qty}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center align-top"><Pill tone={actionTone(t.action)}>{t.action}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 align-top text-ink2">{t.by}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-panel-alt px-4 py-2.5">
            <span className="text-[10.5px] text-ink3">{rows.length}건</span>
            <span className="text-[11px] text-ink3">불량 수량 합계 <b className="font-mono text-danger">{rows.reduce((s, t) => s + t.qty, 0).toLocaleString()} EA</b></span>
          </div>
        </Card>
      </div>
    </div>
  );
}
