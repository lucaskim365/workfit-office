import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { ReadSelect } from '../_bits';

interface WO {
  no: string;
  code: string;
  line: string;
  qty: string;
  shift: string;
  status: '발행' | '진행' | '대기' | '완료';
}

const WOS: WO[] = [
  { no: 'WO-260611-021', code: 'WF-300-B', line: 'M-Line', qty: '4,000', shift: '주간', status: '발행' },
  { no: 'WO-260611-022', code: 'WF-300-B', line: 'M-Line', qty: '2,000', shift: '주간', status: '진행' },
  { no: 'WO-260611-018', code: 'WF-200-A', line: 'M-Line', qty: '3,200', shift: '야간', status: '대기' },
  { no: 'WO-260611-015', code: 'PKG-BGA-14', line: 'P-Line', qty: '2,500', shift: '주간', status: '진행' },
  { no: 'WO-260610-040', code: 'MOD-CAM-02', line: 'A-Line', qty: '1,800', shift: '주간', status: '완료' },
];

const ST_TONE: Record<WO['status'], Tone> = { 완료: 'ok', 진행: 'info', 발행: 'mute', 대기: 'mute' };
const BARS = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 2, 1, 3];

/** 작업지시 관리 — 목록 + Run Sheet 미리보기. 와이어프레임 prod-screens.WorkOrderContent 정본. */
export default function WorkOrderScreen() {
  const [sel, setSel] = useState('WO-260611-021');
  const cur = WOS.find((w) => w.no === sel) ?? WOS[0];
  const runSheet: Array<[string, string]> = [
    ['품목', `${cur.code} · 제품`],
    ['라인 / 교대', `${cur.line} / ${cur.shift}`],
    ['지시수량', `${cur.qty} EA`],
    ['라우팅', 'RT-WF300-A (7공정)'],
    ['지시일시', '2026-06-11 08:00'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">작업지시 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 작업지시 관리 (Work Order)</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '지시 추가' }, 'save', 'download']} />
      </div>

      <FilterBar onSearch={() => {}}>
        <FilterField label="지시일자"><ReadSelect value="2026-06-11" w={130} /></FilterField>
        <FilterField label="라인"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="상태"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="검색"><TextInput value="" onChange={() => {}} placeholder="지시번호 / 품목" width={180} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card title="작업지시 목록" action={<span className="text-[10.5px] text-ink3">총 5건</span>} bodyClassName="p-0">
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
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{w.qty}</td>
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
                <div className="font-mono text-[15px] font-extrabold">{cur.no}</div>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex h-[34px] items-stretch gap-[1.5px]">
                  {BARS.map((w, i) => (
                    <span key={i} style={{ width: w }} className={i % 2 ? 'bg-transparent' : 'bg-white'} />
                  ))}
                </div>
                <span className="font-mono text-[8px] text-[#9fabc6]">{cur.no.replace(/-/g, '')}</span>
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
            <ActionButton icon="save" label="지시 발행" variant="primary" />
          </div>
        </Card>
      </div>
    </div>
  );
}
