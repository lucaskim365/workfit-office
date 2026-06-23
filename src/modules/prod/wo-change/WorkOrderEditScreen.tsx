import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';

const ROWS: Array<[string, string, string, string, string, string]> = [
  ['WO-260611-022', 'WF-300-B', 'M-Line', '2,000', '진행', '40%'],
  ['WO-260611-018', 'WF-200-A', 'M-Line', '3,200', '대기', '0%'],
  ['WO-260611-015', 'PKG-BGA-14', 'P-Line', '2,500', '진행', '65%'],
];

const ACTIONS: Array<{ i: string; t: string; d: string; c: string }> = [
  { i: '✎', t: '변경', d: '수량·납기·우선순위 수정', c: T.info },
  { i: '⇆', t: '분할', d: '지시를 2건 이상으로 나눔', c: T.teal },
  { i: '»«', t: '병합', d: '동일 품목 지시 합침', c: T.navy },
  { i: '✕', t: '취소', d: '진행/대기 지시 취소', c: T.err },
];

const REASONS = ['긴급 주문', '설비 고장', '자재 결품', '품질 이슈', '계획 변경'];

/** 작업지시 변경/취소 — 와이어프레임 prod-screens.WorkOrderEditContent 정본. */
export default function WorkOrderEditScreen() {
  const [reason, setReason] = useState('긴급 주문');

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">작업지시 변경/취소</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 작업지시 변경/취소</p>
        </div>
        <ActionBar actions={['save']} />
      </div>

      <Card title="변경 가능 작업" action={<span className="text-[10.5px] text-ink3">진행/대기 중인 지시</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['지시번호', '품목', '라인', '지시수량', '상태', '진행률', '조치'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 ? 'text-right' : i >= 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r[0]} className={i === 0 ? 'bg-teal-soft' : i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className={`border-b border-border px-3 py-2.5 font-mono text-[11px] font-bold ${i === 0 ? 'text-teal' : 'text-ink'}`} style={i === 0 ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{r[0]}</td>
                  <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] font-semibold text-ink">{r[1]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center text-ink2">{r[2]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-bold tabular-nums text-ink">{r[3]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={r[4] === '진행' ? 'info' : 'mute'}>{r[4]}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5 text-center font-bold tabular-nums text-ink2">{r[5]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center">
                    <span className="inline-flex gap-1">
                      {['변경', '분할', '취소'].map((a) => (
                        <span key={a} className={`cursor-pointer rounded-md border bg-panel px-2 py-[3px] text-[10px] font-bold ${a === '취소' ? 'border-danger/40 text-danger' : 'border-border-hi text-ink2'}`}>{a}</span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <Card key={a.t}>
            <div className="mb-2 flex items-center gap-2.5">
              <span style={{ background: `${a.c}1a`, color: a.c }} className="grid h-8 w-8 place-items-center rounded-[9px] text-[13px] font-extrabold">{a.i}</span>
              <span className="text-[13px] font-extrabold text-ink">{a.t}</span>
            </div>
            <div className="text-[11px] leading-relaxed text-ink3">{a.d}</div>
          </Card>
        ))}
      </div>

      <Card title="변경 사유 (돌발 상황)">
        <div className="mb-3 flex flex-wrap gap-2.5">
          {REASONS.map((t) => {
            const on = t === reason;
            return (
              <button
                key={t}
                onClick={() => setReason(t)}
                className={`rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold ${on ? 'border-navy bg-navy text-white' : 'border-border bg-panel-alt text-ink2'}`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="min-h-[60px] rounded-lg border border-border-hi bg-panel px-3.5 py-2.5 text-[12px] leading-relaxed text-ink2">
          긴급 주문 반영으로 WO-260611-022 수량을 2,000 → 1,200으로 축소하고, 잔량 800은 신규 지시로 분할.
        </div>
      </Card>
    </div>
  );
}
