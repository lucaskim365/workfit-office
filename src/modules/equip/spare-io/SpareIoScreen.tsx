import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_maint';
import { useSpareMovements } from '@/features/spareMovement/useSpareMovements';

const SPIO_PARTS = [
  { code: 'SP-MB-200', name: '캐리어 멤브레인', unit: 'EA', stock: 6 },
  { code: 'SP-PAD-IC', name: '연마 패드', unit: 'EA', stock: 4 },
  { code: 'SP-HTR-3K', name: '튜브 히터 어셈블리', unit: 'EA', stock: 2 },
  { code: 'SP-FIL-IM', name: '이온소스 필라멘트', unit: 'EA', stock: 0 },
  { code: 'SP-ORK-A', name: 'O-Ring 키트', unit: 'SET', stock: 24 },
];

const ioTone = (t: string): Tone => (t === '입고' ? 'ok' : 'info');

/** 예비품 입고/출고 — 와이어프레임 spare-io.jsx 정본. */
export default function SpareIoScreen() {
  const { data: movements = [], isLoading } = useSpareMovements();
  const [mode, setMode] = useState<'입고' | '출고'>('출고');
  const [partCode, setPartCode] = useState('SP-HTR-3K');
  const [qty, setQty] = useState(1);
  const [filter, setFilter] = useState('전체');
  const part = SPIO_PARTS.find((p) => p.code === partCode) || SPIO_PARTS[0];
  const after = mode === '입고' ? part.stock + qty : part.stock - qty;
  const txRows = movements.filter((t) => filter === '전체' || t.type === filter);
  const modeColor = mode === '입고' ? C.teal : C.blue;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">예비품 입고/출고</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 예비품·스페어 파트 / 예비품 입고/출고</p>
        </div>
        <ActionBar actions={['download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['금일 입고', '3', '건', C.teal], ['금일 출고', '5', '건', C.blue], ['금일 입고 수량', '33', 'EA', C.ink],
        ['금일 출고 수량', '10', 'EA', C.ink], ['미처리 출고요청', '2', '건', C.amber],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[340px_1fr]">
        {/* 등록 폼 */}
        <Card title="입고 / 출고 등록">
          <div className="mb-4 flex overflow-hidden rounded-[9px] border border-border-hi">
            {(['입고', '출고'] as const).map((m) => {
              const on = mode === m;
              const c = m === '입고' ? C.teal : C.blue;
              return <button key={m} onClick={() => setMode(m)} className="flex-1 py-2.5 text-[12.5px] font-extrabold" style={{ background: on ? c : '#fff', color: on ? '#fff' : C.ink3 }}>{m}</button>;
            })}
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">예비품</label>
            <div className="flex flex-col gap-1.5">
              {SPIO_PARTS.map((p) => {
                const on = p.code === partCode;
                return (
                  <button key={p.code} onClick={() => setPartCode(p.code)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left" style={{ border: `1.5px solid ${on ? C.teal : C.border}`, background: on ? C.tealSoft : '#fff' }}>
                    <span className="rounded-[5px] px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ color: on ? C.teal : C.blue, background: on ? '#fff' : C.bgDeep }}>{p.code}</span>
                    <span className="flex-1 text-[11.5px] font-bold text-ink">{p.name}</span>
                    <span className="text-[10.5px] font-bold tabular-nums" style={{ color: p.stock === 0 ? C.err : C.ink3 }}>{p.stock}{p.unit}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">수량 ({part.unit})</label>
            <div className="flex items-stretch gap-2">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 rounded-lg border border-border-hi bg-panel text-[16px] font-bold text-ink2">−</button>
              <div className="flex flex-1 items-center justify-center rounded-lg border border-border-hi bg-panel font-mono text-[15px] font-extrabold text-ink">{qty}</div>
              <button onClick={() => setQty((q) => q + 1)} className="w-9 rounded-lg border border-border-hi bg-panel text-[16px] font-bold text-ink2">+</button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between rounded-[9px] px-3.5 py-2.5" style={{ background: C.panelAlt }}>
            <span className="text-[11px] font-semibold text-ink3">재고 변동</span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="text-[14px] font-bold text-ink3">{part.stock}</span>
              <span className="text-[12px] text-ink3">→</span>
              <span className="text-[17px] font-extrabold" style={{ color: after < 0 ? C.err : mode === '입고' ? C.teal : C.ink }}>{after}</span>
              <span className="text-[11px] text-ink3">{part.unit}</span>
            </span>
          </div>
          {after < 0 && <div className="-mt-1 mb-3 text-[10.5px] font-bold" style={{ color: C.err }}>⚠ 현재고({part.stock}{part.unit})보다 출고 수량이 많습니다.</div>}

          <div className="mb-3">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">{mode === '입고' ? '입고 유형' : '출고 사유'}</label>
            <span className="flex w-full items-center justify-between rounded-[7px] border border-border-hi bg-panel px-3 py-[7px] text-[11.5px] font-semibold text-ink">{mode === '입고' ? '구매 입고' : 'BM 수리 출고'} <span className="text-[8px] text-ink3">▾</span></span>
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-[10.5px] font-bold text-ink3">{mode === '입고' ? '공급처 / PO' : '대상 설비 / 작업번호'}</label>
            <div className="flex h-9 items-center rounded-lg border border-border-hi bg-panel px-3 text-[12.5px] font-medium text-ink3">{mode === '입고' ? 'PO-26-XXXX' : 'BM-2606-XXX'}</div>
          </div>

          <button className="w-full rounded-[9px] py-3 text-[13px] font-extrabold text-white" style={{ background: after < 0 ? C.borderHi : modeColor }}>{mode} 등록</button>
        </Card>

        {/* 이력 */}
        <Card
          title="입출고 트랜잭션 이력"
          bodyClassName="p-0"
          action={
            <div className="flex gap-1.5">
              {['전체', '입고', '출고'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="rounded-[7px] px-3 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${filter === f ? C.teal : C.borderHi}`, background: filter === f ? C.teal : '#fff', color: filter === f ? '#fff' : C.ink2 }}>{f}</button>
              ))}
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['전표번호', 'text-left'], ['구분', 'text-center'], ['예비품', 'text-left'], ['수량', 'text-right'], ['처리후', 'text-right'], ['사유 / 참조', 'text-left'], ['처리자', 'text-left']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[12px] text-ink3">{isLoading ? '불러오는 중…' : '입출고 이력이 없습니다.'}</td>
                </tr>
              )}
              {txRows.map((t, i) => (
                <tr key={t.no} className="align-top" style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5 font-mono text-[10px] text-ink3">{t.no}<div className="mt-0.5 text-[9.5px]">{t.date}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={ioTone(t.type)}>{t.type}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{t.name}</div><div className="mt-0.5 font-mono text-[9.5px] text-ink3">{t.code}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold" style={{ color: t.type === '입고' ? C.teal : C.blue }}>{t.type === '입고' ? '+' : '−'}{t.qty}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: t.after === 0 ? C.err : C.ink2 }}>{t.after} {t.unit}</td>
                  <td className="border-b border-border px-3 py-2.5"><div className="font-semibold text-ink2">{t.reason}</div><div className="mt-0.5 text-[9.5px] text-ink3">{t.ref}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-ink2">{t.who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
