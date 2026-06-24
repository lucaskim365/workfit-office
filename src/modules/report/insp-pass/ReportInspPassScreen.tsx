import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { Donut } from '@/shared/ui/charts/Donut';
import { C, RHead, RParam, RTable, FField, FSel, type RCol } from '../_report';

const stages = [
  { name: 'IQC 수입검사', pass: 96.4, total: 1240, c: C.blue },
  { name: 'PQC 공정검사', pass: 98.1, total: 8620, c: C.teal },
  { name: 'OQC 출하검사', pass: 99.2, total: 980, c: C.navy },
];
const cols: RCol[] = [{ label: '단계' }, { label: '대상', mono: true }, { label: '검사수', align: 'right' }, { label: '불합격', align: 'right' }, { label: '합격률', align: 'right' }];
const rows = [
  ['IQC', '포토레지스트', '320', '12', '96.2%'],
  ['IQC', 'BGA 기판', '500', '22', '95.6%'],
  ['PQC', '가공 공정', '4,200', '68', '98.4%'],
  ['PQC', '조립 공정', '4,420', '95', '97.9%'],
  ['OQC', '완제품 MX-200', '600', '4', '99.3%'],
];

/** 검사 합격률(IQC/PQC/OQC) — 와이어프레임 report-qual.jsx 정본. */
export default function ReportInspPassScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="검사 합격률(IQC/PQC/OQC)" sub="품질 리포트 / 검사 단계별 합격률" type="R2" />
      <RParam><FField label="검사단계"><FSel value="전체" w={80} /></FField><FField label="제품"><FSel /></FField></RParam>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {stages.map((s) => (
          <Card key={s.name}>
            <div className="flex items-center gap-3.5">
              <Donut data={[{ name: s.name, v: s.pass, c: s.c }, { name: '', v: 100 - s.pass, c: C.bgDeep }]} size={92} thickness={14} centerTop={s.pass + '%'} centerSub="합격" />
              <div>
                <div className="text-[12.5px] font-extrabold text-ink">{s.name}</div>
                <div className="mt-0.5 text-[10.5px] text-ink3">검사 {s.total.toLocaleString()}건</div>
                <div className="mt-2"><Pill tone={s.pass >= 98 ? 'ok' : 'warn'} solid>{s.pass >= 98 ? '양호' : '주의'}</Pill></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card title="검사 대상별 합격률 상세" bodyClassName="p-0">
        <RTable cols={cols} rows={rows} highlightCol={4} />
      </Card>
    </div>
  );
}
