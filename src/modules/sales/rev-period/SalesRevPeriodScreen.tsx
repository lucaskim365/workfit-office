import { Card } from '@/shared/ui/Card';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { GroupedBars } from '@/shared/ui/charts/GroupedBars';
import { C, MHead, MKpis, FBar, FField, FSel, th, td } from '../_sales';

const BARS = [
  { label: '1월', plan: 720, act: 698 }, { label: '2월', plan: 740, act: 762 },
  { label: '3월', plan: 800, act: 781 }, { label: '4월', plan: 800, act: 824 },
  { label: '5월', plan: 820, act: 798 }, { label: '6월', plan: 860, act: 860 },
];
const ROWS: string[][] = [
  ['한빛전자', '1,840', '1,920', '+4.3%'],
  ['대륭산업', '980', '1,024', '+4.5%'],
  ['세진테크', '760', '712', '-6.3%'],
  ['동진정밀', '420', '468', '+11.4%'],
];

/** 기간별 매출 현황 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesRevPeriodScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="기간별 매출 현황" sub="영업 통계 및 분석 / 기간별 매출 (단위: 백만원)" actions={<ActionBar actions={['refresh', 'download']} />} />
      <FBar>
        <FField label="집계단위"><FSel value="월별" w={90} /></FField>
        <FField label="거래처"><FSel /></FField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['금월 매출', '860', '백만', 'teal'], ['누계 매출', '4,723', '백만'], ['전월비', '+7.8', '%'], ['목표 달성', '100', '%']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="월별 매출 계획 대비 실적 (백만원)">
          <GroupedBars data={BARS} series={[{ key: 'plan', c: '#b7c0d4' }, { key: 'act', c: C.teal }]} h={230} />
          <div className="mt-2 flex gap-4">
            {([['계획', '#b7c0d4'], ['실적', C.teal]] as const).map(([l, c]) => <span key={l} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink2"><span className="h-[11px] w-[11px] rounded-[3px]" style={{ background: c }} />{l}</span>)}
          </div>
        </Card>
        <Card title="거래처별 매출 (백만원)" bodyClassName="p-0">
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['거래처', '전년', '당년', '증감'].map((c, i) => <th key={c} className={th(i >= 1 ? 'right' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-bold text-ink`}>{r[0]}</td>
                  <td className={`${td('right')} tabular-nums text-ink3`}>{r[1]}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[2]}</td>
                  <td className={`${td('right')} font-bold tabular-nums`} style={{ color: r[3].startsWith('-') ? C.err : C.ok }}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
