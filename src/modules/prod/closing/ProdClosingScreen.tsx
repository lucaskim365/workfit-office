import { Fragment } from 'react';
import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';

const ROWS: Array<[string, string, string, string, string, string, boolean]> = [
  ['M-Line', '주간', '6,000', '5,920', '88', '검증완료', true],
  ['M-Line', '야간', '3,200', '3,140', '42', '검증완료', false],
  ['P-Line', '주간', '2,500', '1,625', '21', '진행중', false],
  ['A-Line', '주간', '1,800', '1,780', '15', '검증완료', false],
];

const STEPS: Array<[string, string, string]> = [
  ['실적 검증', '완료', T.ok],
  ['데이터 확정', '진행', T.teal],
  ['마감 처리', '대기', T.ink3],
  ['ERP 전송', '대기', T.ink3],
];

const tone = (s: string): Tone => (s === '검증완료' ? 'ok' : 'warn');

/** 생산 마감 관리 — 와이어프레임 prod-screens-2.ProdClosingContent 정본. */
export default function ProdClosingScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">생산 마감 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산 마감 관리 (Production Closing)</p>
        </div>
        <ActionBar actions={['save', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="마감 대상" value="4" unit="건" /></Card>
        <Card><Kpi label="검증 완료" value="3" unit="건" tone="teal" /></Card>
        <Card><Kpi label="총 실적" value="12,465" unit="EA" /></Card>
        <Card>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-ink2">ERP 전송</div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber" />
              <span className="text-[17px] font-extrabold text-amber">대기</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="라인·교대별 마감 검증" action={<span className="text-[10.5px] text-ink3">2026-06-11 일간 마감</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['라인', '교대', '계획', '실적(양품)', '불량', '검증 상태', '확정'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 2 && i <= 4 ? 'text-right' : i >= 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i} className={r[6] ? 'bg-teal-soft' : i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className="border-b border-border px-3 py-2.5 font-bold text-ink" style={r[6] ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{r[0]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-ink2">{r[1]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right tabular-nums text-ink2">{r[2]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-bold tabular-nums text-ink">{r[3]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right tabular-nums text-danger">{r[4]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={tone(r[5])}>{r[5]}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5 text-center">
                    {r[5] === '검증완료' ? (
                      <span className="rounded-md border border-teal/30 bg-teal-soft px-2.5 py-[3px] text-[10px] font-bold text-teal">확정</span>
                    ) : (
                      <span className="rounded-md border border-border-hi bg-panel px-2.5 py-[3px] text-[10px] font-bold text-ink3">대기</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="마감 → ERP 전송 프로세스">
        <div className="flex items-center">
          {STEPS.map(([name, state, color], i) => (
            <Fragment key={name}>
              <div className="flex-1 text-center">
                <div
                  className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full text-[14px] font-extrabold"
                  style={{ background: color === T.ink3 ? T.bgDeep : `${color}1a`, color, border: `2px solid ${color}` }}
                >
                  {i + 1}
                </div>
                <div className="text-[11.5px] font-bold text-ink">{name}</div>
                <div className="mt-0.5 text-[10px] font-bold" style={{ color }}>{state}</div>
              </div>
              {i < STEPS.length - 1 && <span className="mb-6 shrink-0 text-[17px] text-border-hi">→</span>}
            </Fragment>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <ActionButton icon="upload" label="ERP 실적 전송" variant="primary" />
        </div>
      </Card>
    </div>
  );
}
