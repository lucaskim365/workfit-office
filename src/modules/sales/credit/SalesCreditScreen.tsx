import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, Bar, th, td, won } from '../_sales';
import { useCreditLimits } from '@/features/creditLimit/useCreditLimits';

const gradeBg = (g: string) => (g === 'A' ? C.tealSoft : g === 'B' ? C.blueSoft : C.bgDeep);
const gradeFg = (g: string) => (g === 'A' ? C.teal : g === 'B' ? C.blue : C.warn);

/** 여신 관리 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesCreditScreen() {
  const { data: rows = [], isLoading } = useCreditLimits();

  if (rows.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '여신 정보가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="여신 관리" sub="수금 및 채권 관리 / 여신한도 관리 (Credit Limit)" actions={<ActionBar actions={['save', 'download']} />} />
      <MKpis items={[['관리 거래처', '28', '사'], ['한도 초과', '1', '사', 'err'], ['한도 임박(90%+)', '2', '사'], ['평균 소진율', '64', '%']]} />
      <Card title="거래처별 여신한도 · 소진 현황" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">채권잔액 ≥ 여신한도 시 수주 보류</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['거래처', '여신한도', '채권잔액', '소진율', '한도여유', '등급', '상태'].map((c, i) => <th key={c} className={th(i >= 1 && i <= 2 ? 'right' : i === 4 ? 'right' : i >= 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = Math.round((r.balance / r.limit) * 100);
              const over = pct >= 100;
              const remain = r.limit - r.balance;
              return (
                <tr key={r.cust} style={{ background: over ? '#fdecea' : i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-bold text-ink`} style={{ borderLeft: over ? `3px solid ${C.err}` : '3px solid transparent' }}>{r.cust}</td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{won(r.limit)}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(r.balance)}</td>
                  <td className={td('left')}><div className="w-[130px]"><Bar v={Math.min(pct, 100)} color={over ? C.err : pct >= 90 ? C.warn : C.teal} /></div></td>
                  <td className={`${td('right')} tabular-nums`} style={{ color: over ? C.err : C.ink2, fontWeight: over ? 700 : 500 }}>{remain < 0 ? '▲ ' + won(-remain) : won(remain)}</td>
                  <td className={td('center')}><span className="inline-grid h-[22px] w-[22px] place-items-center rounded-md text-[10.5px] font-extrabold" style={{ background: gradeBg(r.grade), color: gradeFg(r.grade) }}>{r.grade}</span></td>
                  <td className={td('center')}><Pill tone={over ? 'err' : pct >= 90 ? 'warn' : 'ok'} solid={over}>{over ? '한도초과' : pct >= 90 ? '임박' : '정상'}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
