import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { ReadSelect } from '../_bits';
import { type WoStatus } from '@/domain/workOrder/schema';
import { nextStatus, nextActionLabel } from '@/domain/workOrder/status';
import { useWorkOrders, useCreateWorkOrder, useTransitionWorkOrder, useCompleteWorkOrder } from '@/features/workOrder/useWorkOrders';

const ST_TONE: Record<WoStatus, Tone> = { 완료: 'ok', 진행: 'info', 발행: 'mute', 대기: 'mute', 지연: 'warn' };
const BARS = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 2, 1, 3];
const fmt = (n: number) => n.toLocaleString('ko-KR');
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

/** 작업지시 관리 — 목록 + Run Sheet. 데이터: features/workOrder (채번·상태머신). */
export default function WorkOrderScreen() {
  const [sel, setSel] = useState('WO-260611-021');
  const { data: WOS = [] } = useWorkOrders();
  const createWo = useCreateWorkOrder();
  const transitionWo = useTransitionWorkOrder();
  const completeWo = useCompleteWorkOrder();

  const cur = WOS.find((w) => w.no === sel) ?? WOS[0];
  const advance = cur ? nextStatus(cur.status) : null;
  const advanceLabel = cur ? nextActionLabel(cur.status) : null;

  const runSheet: Array<[string, string]> = cur
    ? [
        ['품목', `${cur.code} · ${cur.itemName || '제품'}`],
        ['라인 / 교대', `${cur.line} / ${cur.shift}`],
        ['지시수량', `${fmt(cur.qty)} EA`],
        ['상태', cur.status],
        ['지시일시', cur.plannedDate || '—'],
      ]
    : [];

  const handleAdvance = () => {
    if (!cur || !advance) return;
    // 완료 전이는 서비스(상태 전이 + 생산입고 원장)로 — cross-entity 정합성
    if (advance === '완료') completeWo.mutate({ no: cur.no, at: stamp() });
    else transitionWo.mutate({ no: cur.no, to: advance, at: stamp() });
  };
  const handleCreate = () => {
    createWo.mutate(
      { code: 'WF-300-B', itemName: '300mm 웨이퍼', line: 'M-Line', qty: 1000, shift: '주간', plannedDate: new Date().toISOString().slice(0, 10) },
      { onSuccess: (wo) => setSel(wo.no) },
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">작업지시 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 작업지시 관리 (Work Order)</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '지시 추가', onClick: handleCreate }, 'download']} />
      </div>

      <FilterBar onSearch={() => {}}>
        <FilterField label="지시일자"><ReadSelect value="2026-06-11" w={130} /></FilterField>
        <FilterField label="라인"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="상태"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="검색"><TextInput value="" onChange={() => {}} placeholder="지시번호 / 품목" width={180} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card title="작업지시 목록" action={<span className="text-[10.5px] text-ink3">총 {WOS.length}건</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['지시번호', '품목', '라인', '지시수량', '교대', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 ? 'text-right' : i >= 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WOS.map((w) => {
                  const on = w.no === sel;
                  return (
                    <tr key={w.no} onClick={() => setSel(w.no)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3 py-2.5 font-mono text-[11px] font-bold ${on ? 'text-teal' : 'text-ink'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{w.no}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-ink">{w.code}</td>
                      <td className="px-3 py-2.5 text-center text-ink2">{w.line}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{fmt(w.qty)}</td>
                      <td className="px-3 py-2.5 text-center text-ink2">{w.shift}</td>
                      <td className="px-3 py-2.5 text-center"><Pill tone={ST_TONE[w.status]}>{w.status}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="작업지시서 (Run Sheet)">
          <div className="overflow-hidden rounded-[10px] border border-border">
            <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
              <div>
                <div className="text-[10px] font-semibold text-[#9fabc6]">WORK ORDER</div>
                <div className="font-mono text-[15px] font-extrabold">{cur?.no ?? '—'}</div>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex h-[34px] items-stretch gap-[1.5px]">
                  {BARS.map((w, i) => (
                    <span key={i} style={{ width: w }} className={i % 2 ? 'bg-transparent' : 'bg-white'} />
                  ))}
                </div>
                <span className="font-mono text-[8px] text-[#9fabc6]">{(cur?.no ?? '').replace(/-/g, '')}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 p-4">
              {runSheet.map(([k, v], i) => (
                <div key={k} className={`flex justify-between pb-2 text-[11.5px] ${i < 4 ? 'border-b border-border' : ''}`}>
                  <span className="font-semibold text-ink3">{k}</span>
                  <span className="text-right font-bold text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <ActionButton icon="download" label="QR/바코드 발행" accent="excel" />
            <ActionButton
              icon="save"
              label={advanceLabel ?? '완료됨'}
              variant="primary"
              onClick={handleAdvance}
              disabled={!advance}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
