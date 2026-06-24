import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, th, td } from '../_mat';
import { useLotSplits } from '@/features/lotSplit/useLotSplits';

const SPLIT: [string, number][] = [['LOT-RAW-8821-A', 200], ['LOT-RAW-8821-B', 200], ['LOT-RAW-8821-C', 100]];
const MERGE: [string, number][] = [['LOT-CHM-0457-1', 20], ['LOT-CHM-0457-2', 15]];

/** 자재 LOT 분할/병합 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatLotSplitScreen() {
  /** 분할/병합 처리 이력 — 데이터 계층(lotSplits)에서 소비. */
  const { data: hist = [], isLoading } = useLotSplits();
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="자재 LOT 분할/병합" sub="창고/위치 / 자재 LOT 분할(Split)·병합(Merge)" actions={<ActionBar actions={['save']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card title="LOT 분할 (Split)" action={<Pill tone="info">소분 → 하위 로트</Pill>}>
          <div className="flex flex-col gap-3">
            <div className="rounded-[10px] p-3.5" style={{ background: C.panelAlt, border: `1px solid ${C.borderHi}` }}>
              <div className="text-[10.5px] font-bold text-ink3">원 LOT (Bulk)</div>
              <div className="mt-0.5 flex items-baseline gap-2"><span className="font-mono text-[15px] font-extrabold text-ink">LOT-RAW-8821</span><span className="text-[11.5px] text-ink2">WF-300-B · 500 EA</span></div>
            </div>
            <div className="grid place-items-center text-[16px] text-ink3">↓ 소분</div>
            <div className="flex flex-col gap-2">
              {SPLIT.map(([lot, qty]) => (
                <div key={lot} className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5" style={{ background: C.tealSoft, border: `1px solid ${C.teal}55` }}>
                  <span className="grid h-[30px] w-[30px] place-items-center rounded-[7px] bg-panel text-[8px] font-extrabold" style={{ color: C.teal, border: `1px solid ${C.teal}` }}>QR</span>
                  <span className="flex-1 font-mono text-[12px] font-bold text-ink">{lot}</span>
                  <span className="text-[12px] font-extrabold tabular-nums" style={{ color: C.teal }}>{qty} EA</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end"><ActionButton icon="save" label="분할 + 바코드 발행" variant="primary" /></div>
          </div>
        </Card>
        <Card title="LOT 병합 (Merge)" action={<Pill tone="warn">잔량 합치기</Pill>}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {MERGE.map(([lot, qty]) => (
                <div key={lot} className="flex items-center gap-2.5 rounded-[9px] bg-panel px-3 py-2.5" style={{ border: `1px solid ${C.borderHi}` }}>
                  <span className="flex-1 font-mono text-[12px] font-bold text-ink">{lot}</span>
                  <span className="text-[11.5px] text-ink2">CHM-SL-05</span>
                  <span className="text-[12px] font-extrabold tabular-nums text-ink2">{qty} L</span>
                </div>
              ))}
            </div>
            <div className="grid place-items-center text-[16px] text-ink3">↓ 병합</div>
            <div className="flex items-center gap-2.5 rounded-[9px] p-3" style={{ background: '#fdf6e8', border: `1px solid ${C.warn}55` }}>
              <span className="grid h-[30px] w-[30px] place-items-center rounded-[7px] bg-panel text-[8px] font-extrabold" style={{ color: C.warn, border: `1px solid ${C.warn}` }}>QR</span>
              <span className="flex-1 font-mono text-[12.5px] font-extrabold text-ink">LOT-CHM-0457-M</span>
              <span className="text-[13px] font-extrabold tabular-nums" style={{ color: C.warn }}>35 L</span>
            </div>
            <div className="text-[10.5px] leading-relaxed text-ink3">※ 동일 품목·동일 유효기한 Lot만 병합 가능. 병합 시 가장 짧은 유효기한이 승계됩니다.</div>
            <div className="flex justify-end"><ActionButton icon="save" label="병합 + 바코드 발행" variant="primary" /></div>
          </div>
        </Card>
      </div>
      <Card title="분할/병합 처리 이력" bodyClassName="p-0">
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['처리번호', '유형', '원 Lot', '결과 Lot', '수량 변화', '작업자', '일시'].map((c, i) => <th key={c} className={th(i === 1 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {hist.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[12px] text-ink3">{isLoading ? '불러오는 중…' : '처리 이력이 없습니다.'}</td></tr>
            ) : hist.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r.id}</td>
                <td className={td('center')}><Pill tone={r.type === '분할' ? 'info' : 'warn'}>{r.type}</Pill></td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r.srcLot}</td>
                <td className={`${td('left')} font-mono text-[10.5px] font-semibold text-ink`}>{r.resultLots}</td>
                <td className={`${td('left')} tabular-nums`}>{r.qty}</td>
                <td className={td('left')}>{r.who}</td>
                <td className={`${td('left')} tabular-nums text-ink3`}>{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
