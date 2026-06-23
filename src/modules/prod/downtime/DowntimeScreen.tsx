import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { T } from '@/shared/theme/tokens';

const ROWS: Array<[string, string, string, string, string, string, string]> = [
  ['DT-260611-04', 'CMP02', '설비 고장', '14:22', '15:08', '46분', '진행'],
  ['DT-260611-03', 'ETCH01', '모델 교체(Changeover)', '11:00', '11:35', '35분', '완료'],
  ['DT-260611-02', 'PHO05', '자재 대기', '09:40', '10:05', '25분', '완료'],
  ['DT-260611-01', 'DEP03', '청소(PM)', '08:00', '08:40', '40분', '완료'],
];

const tone = (s: string): Tone => (s === '진행' ? 'warn' : 'ok');

/** 비가동 관리 — 와이어프레임 prod-screens-2.DowntimeContent 정본. */
export default function DowntimeScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">비가동 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 비가동 관리 (Downtime Management)</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '비가동 등록' }, 'save', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="당일 비가동" value="146" unit="분" /></Card>
        <Card><Kpi label="비가동 건수" value="4" unit="건" /></Card>
        <Card>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-ink2">최대 사유</div>
            <div className="text-[17px] font-extrabold text-danger">설비 고장</div>
          </div>
        </Card>
        <Card><Kpi label="가동 손실률" value="4.2" unit="%" /></Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        <Card title="비가동 이력" action={<span className="text-[10.5px] text-ink3">사유 코드별 등록</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['비가동번호', '설비', '사유', '시작', '종료', '시간', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 3 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={r[0]} className={i === 0 ? 'bg-[#fdf6e8]' : i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] font-bold text-ink">{r[0]}</td>
                    <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] text-ink2">{r[1]}</td>
                    <td className="border-b border-border px-3 py-2.5 font-semibold text-ink">{r[2]}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center tabular-nums text-ink2">{r[3]}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center tabular-nums text-ink2">{r[4]}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-bold tabular-nums text-ink">{r[5]}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={tone(r[6])}>{r[6]}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="사유별 비가동 분석">
          <RankBars rows={[
            { label: '설비 고장', v: 46, c: T.err },
            { label: '청소(PM)', v: 40, c: T.warn },
            { label: '모델 교체', v: 35, c: T.teal },
            { label: '자재 대기', v: 25, c: T.c5 },
          ]} />
        </Card>
      </div>
    </div>
  );
}
