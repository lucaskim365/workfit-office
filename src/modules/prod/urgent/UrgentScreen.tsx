import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { ReadSelect } from '../_bits';
import { T } from '@/shared/theme/tokens';
import { useUrgentOrders } from '@/features/urgentOrder/useUrgentOrders';
import type { UrgentOrder } from '@/domain/urgentOrder/schema';

const ITEMS = [
  { code: 'CN-ASM-100', name: '커넥터 어셈블리', line: '조립셀 A' },
  { code: 'SN-MOD-200', name: '센서 모듈', line: 'SMT 라인 2' },
  { code: 'BR-KIT-2T', name: '브래킷 키트', line: '프레스 01호기' },
  { code: 'CN-HSG-08P', name: '커넥터 하우징', line: '사출 03호기' },
];

const typeTone = (t: UrgentOrder['type']): Tone => (t === '긴급' ? 'err' : 'warn');
const prioTone = (p: UrgentOrder['prio']): Tone => (p === '최우선' ? 'err' : p === '높음' ? 'warn' : 'info');
const stTone = (s: UrgentOrder['state']): Tone => (s === '발령' ? 'info' : s === '진행중' ? 'ok' : 'mute');

export default function UrgentScreen() {
  const { data: TX = [], isLoading } = useUrgentOrders();
  const [mode, setMode] = useState<'긴급' | '재작업'>('긴급');
  const [itemCode, setItemCode] = useState('CN-ASM-100');
  const [prio, setPrio] = useState('최우선');
  const [filter, setFilter] = useState('전체');

  const accent = mode === '긴급' ? T.err : T.warn;
  const txRows = TX.filter((t) => filter === '전체' || t.type === filter);

  const kpis: Array<[string, string, string]> = [
    ['금일 긴급지시', '3', 'text-danger'],
    ['금일 재작업', '2', 'text-amber'],
    ['진행중', '2', 'text-teal'],
    ['발령 대기', '1', 'text-blue'],
    ['금일 완료', '2', 'text-ink'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">긴급 / 재작업 지시 발령</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 계획·지시 / 긴급·재작업 지시 발령</p>
        </div>
        <ActionBar actions={['download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, c]) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${c}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">건</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[340px_1fr]">
        {/* 발령 폼 */}
        <Card title="지시 발령">
          <div className="mb-4 flex overflow-hidden rounded-[9px] border border-border-hi">
            {([['긴급', '긴급 오더 / Rush'], ['재작업', '불량 재작업 / Rework']] as const).map(([m, sub], i) => {
              const on = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={on ? { background: m === '긴급' ? T.err : T.warn } : undefined}
                  className={`flex-1 py-2.5 text-[12.5px] font-extrabold leading-tight ${i === 0 ? 'border-r border-border-hi' : ''} ${on ? 'text-white' : 'bg-panel text-ink3'}`}
                >
                  {m}
                  <div className="text-[8.5px] font-semibold opacity-85">{sub}</div>
                </button>
              );
            })}
          </div>

          <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">대상 품목</label>
          <div className="mb-3 flex flex-col gap-1.5">
            {ITEMS.map((it) => {
              const on = it.code === itemCode;
              return (
                <button
                  key={it.code}
                  onClick={() => setItemCode(it.code)}
                  style={{ borderColor: on ? accent : T.border, background: on ? (mode === '긴급' ? '#fdecea' : '#fef6ec') : '#fff' }}
                  className="flex items-center gap-2.5 rounded-lg border-[1.5px] px-3 py-2 text-left"
                >
                  <span style={{ color: on ? accent : T.blue, background: on ? '#fff' : T.bgDeep }} className="rounded-[5px] px-1.5 py-0.5 font-mono text-[8.5px] font-bold">{it.code}</span>
                  <span className="flex-1 text-[11px] font-bold text-ink">{it.name}</span>
                  <span className="text-[9.5px] text-ink3">{it.line}</span>
                </button>
              );
            })}
          </div>

          <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">{mode === '재작업' ? '원 작업지시 / 불량 LOT' : '납기 / 출하 요청일'}</label>
          <div className="mb-3 flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 text-[12.5px] text-ink3">
            {mode === '재작업' ? 'WO-2606-XXX · LOT B-XXXX' : '2026-06-22 (D-1)'}
          </div>

          <div className="mb-3 flex gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">{mode === '재작업' ? '재작업 수량' : '긴급 수량'}</label>
              <div className="flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 font-mono text-[12.5px] font-extrabold text-ink">{mode === '재작업' ? '320' : '2,000'}</div>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">우선순위</label>
              <ReadSelect value={prio} w={120} />
            </div>
          </div>
          <div className="mb-3 flex gap-1.5">
            {['최우선', '높음', '보통'].map((p) => {
              const on = prio === p;
              return (
                <button
                  key={p}
                  onClick={() => setPrio(p)}
                  style={on ? { background: accent, borderColor: accent } : undefined}
                  className={`flex-1 rounded-[7px] border py-1.5 text-[10.5px] font-bold ${on ? 'text-white' : 'border-border-hi bg-panel text-ink2'}`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">{mode === '재작업' ? '불량 유형 / 재작업 사유' : '긴급 발령 사유'}</label>
          <div className="mb-4"><ReadSelect value={mode === '재작업' ? '납땜 불량(AOI)' : 'VIP 납기 단축'} w={300} /></div>

          <button style={{ background: accent }} className="w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white">{mode} 지시 발령</button>
          <div className="mt-2 text-center text-[9.5px] text-ink3">발령 시 해당 라인에 우선 작업지시가 즉시 전달됩니다.</div>
        </Card>

        {/* 이력 */}
        <Card
          title="긴급 / 재작업 지시 이력"
          action={
            <div className="flex gap-1.5">
              {['전체', '긴급', '재작업'].map((f) => {
                const on = filter === f;
                return (
                  <button key={f} onClick={() => setFilter(f)} className={`rounded-[7px] border px-3 py-1 text-[10.5px] font-bold ${on ? 'border-teal bg-teal text-white' : 'border-border-hi bg-panel text-ink2'}`}>{f}</button>
                );
              })}
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['지시번호 / 일시', '유형', '품목 / 사유', '수량', '우선순위', '대상 / 발령자', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 ? 'text-right' : i === 1 || i === 4 || i === 6 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '지시 이력이 없습니다.'}</td>
                  </tr>
                )}
                {txRows.map((t, i) => (
                  <tr key={t.no} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5 align-top font-mono text-[10px] text-ink3">{t.no}<div className="mt-0.5 text-[9.5px]">{t.date}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-center align-top"><Pill tone={typeTone(t.type)}>{t.type}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 align-top"><div className="font-bold text-ink">{t.name}</div><div className="mt-0.5 text-[9.5px] text-ink3">{t.reason}</div></td>
                    <td className="border-b border-border px-3 py-2.5 text-right align-top font-mono font-extrabold text-ink">{t.qty.toLocaleString()}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center align-top"><Pill tone={prioTone(t.prio)}>{t.prio}</Pill></td>
                    <td className="border-b border-border px-3 py-2.5 align-top"><div className="font-semibold text-ink2">{t.line}</div><div className="mt-0.5 text-[9.5px] text-ink3">{t.by}</div></td>
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
