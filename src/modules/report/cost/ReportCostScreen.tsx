import { Card } from '@/shared/ui/Card';
import { Donut } from '@/shared/ui/charts/Donut';
import { C, RHead, RParam, RTable, FField, FSel, type RCol } from '../_report';

const donut = [{ name: '자재비', v: 62, c: C.navy }, { name: '노무비', v: 23, c: C.teal }, { name: '경비', v: 15, c: C.blue }];
const legend: [string, string, string][] = [['자재비', C.navy, '62%'], ['노무비', C.teal, '23%'], ['경비', C.blue, '15%']];
const cols: RCol[] = [{ label: '제품', mono: true }, { label: '자재비', align: 'right' }, { label: '노무비', align: 'right' }, { label: '경비', align: 'right' }, { label: '총원가', align: 'right' }, { label: '단위원가', align: 'right' }];
const rows = [
  ['MX-200', '5,820', '2,140', '1,380', '9,340', '2,480'],
  ['MX-310', '4,210', '1,560', '1,010', '6,780', '1,920'],
  ['PKG-BGA', '3,640', '1,380', '920', '5,940', '1,640'],
];
const total = ['합계', '13,670', '5,080', '3,310', '22,060', ''];

/** 제조원가 집계 — 와이어프레임 report-cost.jsx 정본. */
export default function ReportCostScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="제조원가 집계" sub="원가·효율 리포트 / 제조원가 집계 (만원)" type="R3" />
      <RParam><FField label="제품"><FSel /></FField><FField label="원가요소"><FSel /></FField></RParam>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.7fr]">
        <Card title="원가 요소 구성">
          <div className="flex items-center gap-4">
            <Donut data={donut} size={130} thickness={22} centerTop="2.2억" centerSub="총원가" />
            <div className="flex flex-col gap-2">
              {legend.map((l) => (
                <span key={l[0]} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink2"><span className="h-[11px] w-[11px] rounded-[3px]" style={{ background: l[1] }} />{l[0]}<b className="ml-3 text-ink">{l[2]}</b></span>
              ))}
            </div>
          </div>
        </Card>
        <Card title="제품별 제조원가 명세 (단위: 만원)" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} total={total} highlightCol={4} />
        </Card>
      </div>
    </div>
  );
}
