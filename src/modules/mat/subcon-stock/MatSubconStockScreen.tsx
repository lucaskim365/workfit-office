import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, Bar, th, td } from '../_mat';
import { useSubconStocks } from '@/features/subconStock/useSubconStocks';

type Row = [vendor: string, code: string, name: string, issued: number, used: number, ret: number];
const ROWS: Row[] = [
  ['대성테크', 'PCB-A1', '메인 PCB', 2000, 1500, 500],
  ['대성테크', 'CMP-CON-14', '보드 커넥터', 2200, 1600, 600],
  ['한울가공', 'CMP-SHD-02', 'EMI 쉴드캔', 2800, 2400, 350],
  ['동진정밀', 'WF-200-A', '200mm 웨이퍼', 1500, 900, 600],
  ['서원SMT', 'CMP-RES-22', '칩 저항 22Ω', 5000, 4100, 780],
];

/** 외주처 재고 현황 모니터링 — 와이어프레임 wms-screens-4.jsx 정본. */
export default function MatSubconStockScreen() {
  const { data: vendors = [], isLoading } = useSubconStocks();
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="외주처 재고 현황 모니터링" sub="외주 자재 관리 / 외주처 보유 재고 현황" actions={<ActionBar actions={['refresh', 'download']} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading && vendors.length === 0 && <Card><div className="py-6 text-center text-[11px] text-ink3">불러오는 중…</div></Card>}
        {vendors.map((v) => {
          const stock = v.issued - v.used - v.ret;
          const usePct = Math.round((v.used / v.issued) * 100);
          return (
            <Card key={v.name}>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-[14px] font-extrabold" style={{ background: v.c + '1a', color: v.c }}>{v.name[0]}</span>
                <div className="min-w-0"><div className="text-[12.5px] font-extrabold text-ink">{v.name}</div><div className="truncate text-[10px] text-ink3">{v.item}</div></div>
              </div>
              <div className="flex items-baseline gap-1"><span className="text-[22px] font-extrabold tabular-nums text-ink">{stock.toLocaleString()}</span><span className="text-[10.5px] font-semibold text-ink3">EA 잔여</span></div>
              <div className="my-2"><Bar v={usePct} color={v.c} /></div>
              <div className="flex justify-between text-[10px] text-ink3"><span>지급 {v.issued.toLocaleString()}</span><span>투입 {usePct}%</span></div>
            </Card>
          );
        })}
      </div>
      <Card title="외주처별 품목 재고 상세" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">지급 − 투입 − 반품 = 외주처 잔여재고</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['외주처', '품목', '지급수량', '투입(사용)', '반품', '잔여재고'].map((c, i) => <th key={c} className={th(i >= 2 ? 'right' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => {
              const stock = r[3] - r[4] - r[5];
              return (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-bold text-ink`}>{r[0]}</td>
                  <td className={td('left')}><span className="font-mono text-[11px]">{r[1]}</span> <span className="text-[10.5px] text-ink3">{r[2]}</span></td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r[3].toLocaleString()}</td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r[4].toLocaleString()}</td>
                  <td className={`${td('right')} tabular-nums`} style={{ color: r[5] ? C.warn : C.ink3 }}>{r[5].toLocaleString()}</td>
                  <td className={`${td('right')} font-extrabold tabular-nums`} style={{ color: C.teal }}>{stock.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
