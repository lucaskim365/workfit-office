import { Card } from '@/shared/ui/Card';
import { Donut } from '@/shared/ui/charts/Donut';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { C, RHead, RParam, MKpis, FField, FSel } from '../_report';

const donut = [
  { name: '가동', v: 78, c: C.teal }, { name: '대기', v: 12, c: C.warn },
  { name: '고장', v: 6, c: C.err }, { name: '계획정지', v: 4, c: C.bgDeep },
];
const legend: [string, string, string][] = [['가동', C.teal, '78%'], ['대기', C.warn, '12%'], ['고장', C.err, '6%'], ['계획정지', C.bgDeep, '4%']];
const reasons = [
  { label: '금형 교체', v: 320, c: C.navy }, { label: '자재 대기', v: 245, c: C.blue },
  { label: '설비 고장', v: 188, c: C.err }, { label: '품질 조정', v: 142, c: C.warn },
  { label: '계획 정지', v: 96, c: C.c5 },
];

/** 가동률·비가동 분석 — 와이어프레임 report-equip.jsx 정본. */
export default function ReportUtilScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="가동률·비가동 분석" sub="설비 리포트 / 가동률 및 비가동 사유" type="R2" />
      <RParam><FField label="설비"><FSel /></FField></RParam>
      <MKpis items={[['평균 가동률', '78.0', '%', 'teal'], ['총 비가동', '991', '분'], ['최다 사유', '금형 교체', ''], ['고장 정지', '188', '분']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.6fr]">
        <Card title="가동 상태 구성">
          <div className="flex items-center gap-4">
            <Donut data={donut} size={130} thickness={22} centerTop="78%" centerSub="가동" />
            <div className="flex flex-col gap-2">
              {legend.map((l) => (
                <span key={l[0]} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink2"><span className="h-[11px] w-[11px] rounded-[3px]" style={{ background: l[1] }} />{l[0]}<b className="ml-auto text-ink">{l[2]}</b></span>
              ))}
            </div>
          </div>
        </Card>
        <Card title="비가동 사유별 시간 (분)">
          <RankBars rows={reasons} />
        </Card>
      </div>
    </div>
  );
}
