import { Card } from '@/shared/ui/Card';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { C, MHead, MKpis, FBar, FField, FSel, th, td } from '../_sales';

const RANKS = [
  { label: 'MX-200', v: 1920, c: C.teal }, { label: 'PKG-BGA-14', v: 1240, c: C.blue },
  { label: 'MX-310', v: 880, c: C.navy }, { label: 'CMP-CON-14', v: 460, c: C.warn },
  { label: '기타', v: 223, c: '#b7c0d4' },
];
const ROWS: string[][] = [
  ['MX-200', '메모리 모듈', '486', '1,920', '38.2%', '32%'],
  ['PKG-BGA-14', 'BGA 기판', '292', '1,240', '24.7%', '28%'],
  ['MX-310', '메모리 모듈', '510', '880', '17.5%', '24%'],
  ['CMP-CON-14', '보드 커넥터', '36,000', '460', '9.2%', '14%'],
];

/** 품목별 판매 순위 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesItemRankScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="품목별 판매 순위" sub="영업 통계 및 분석 / 품목 판매·수익성 (백만원)" actions={<ActionBar actions={['refresh', 'download']} />} />
      <FBar>
        <FField label="기간"><FSel value="2026 누계" w={110} /></FField>
        <FField label="제품군"><FSel /></FField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['판매 품목', '42', '종'], ['최다 판매', 'MX-200', ''], ['상위 3종 비중', '80.4', '%', 'teal'], ['평균 마진율', '27', '%']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Card title="품목별 매출 비중 (백만원)"><RankBars rows={RANKS} /></Card>
        <Card title="품목별 판매·수익성 상세" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">매출 내림차순</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['품목', '품명', '판매량', '매출', '매출비중', '마진율'].map((c, i) => <th key={c} className={th(i >= 2 ? 'right' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                  <td className={td('left')}>{r[1]}</td>
                  <td className={`${td('right')} tabular-nums`}>{r[2]}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[3]}</td>
                  <td className={`${td('right')} tabular-nums`}>{r[4]}</td>
                  <td className={`${td('right')} font-bold tabular-nums`} style={{ color: C.teal }}>{r[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
