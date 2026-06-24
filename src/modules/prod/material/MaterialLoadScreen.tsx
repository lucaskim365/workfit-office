import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { useMaterialLoads } from '@/features/materialLoad/useMaterialLoads';

const tone = (s: string): Tone => (s === '정상' ? 'ok' : 'err');

/** 자재 투입 관리 — 와이어프레임 prod-screens-2.MaterialLoadContent 정본. */
export default function MaterialLoadScreen() {
  const { data: rows = [], isLoading } = useMaterialLoads();

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">자재 투입 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 자재 투입 관리 (Material Loading)</p>
        </div>
        <ActionBar actions={['save', 'download']} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_1.6fr]">
        <Card title="자재 스캔 / 매핑">
          <div className="flex flex-col gap-3">
            <div className="rounded-[10px] border border-border bg-panel-alt p-4 text-center">
              <div className="text-[10.5px] font-semibold text-ink3">대상 작업지시</div>
              <div className="mt-0.5 font-mono text-[15px] font-extrabold text-ink">WO-260611-021</div>
              <div className="text-[11px] text-ink2">WF-300-B · OP-10 입고/세정</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-[9px] border-[1.5px] border-teal bg-panel px-3.5 py-3">
              <span className="text-[17px] text-teal">▦</span>
              <span className="flex-1 text-[12px] font-semibold text-ink">자재 바코드 스캔...</span>
              <span className="text-[10px] font-bold text-teal">READY</span>
            </div>
            <div className="rounded-lg bg-[#fdeceb] px-3 py-2.5 text-[10.5px] font-semibold leading-relaxed text-danger">
              ⚠ 오투입 방지: BOM에 등록되지 않은 자재 스캔 시 경고 후 투입 차단됩니다.
            </div>
            <div className="flex justify-end">
              <ActionButton icon="save" label="투입 확정 (Backflushing)" variant="primary" />
            </div>
          </div>
        </Card>

        <Card title="투입 자재 목록 (BOM 대비)" action={<span className="text-[10.5px] text-ink3">소요량 자동 차감</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['자재코드', '자재명', '투입 LOT', '소요량', '실투입', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 3 && i <= 4 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border-b border-border px-3 py-10 text-center text-[11px] text-ink3">
                      {isLoading ? '불러오는 중…' : '투입 자재가 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.id} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] font-bold text-ink">{r.mat}</td>
                      <td className="border-b border-border px-3 py-2.5 font-semibold text-ink">{r.name}</td>
                      <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] text-ink2">{r.lot}</td>
                      <td className="border-b border-border px-3 py-2.5 text-right tabular-nums text-ink2">{r.req}</td>
                      <td className={`border-b border-border px-3 py-2.5 text-right font-bold tabular-nums ${r.state === '초과' ? 'text-danger' : 'text-ink'}`}>{r.actual}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={tone(r.state)}>{r.state}</Pill></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
