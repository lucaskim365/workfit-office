import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { C, RHead, RParam, MKpis, ProgBar, FField, FSel } from '../_report';

const AL: Record<string, string> = { right: 'text-right', center: 'text-center', left: 'text-left' };
const th = (al: string) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: string) => `whitespace-nowrap border-b border-border px-3 py-2.5 ${AL[al]}`;

type Row = [chr: string, prod: string, cp: number, cpk: number, level: string];
const rows: Row[] = [
  ['선폭 CD', 'MX-200', 1.82, 1.74, '양호'],
  ['두께 T', 'MX-200', 1.45, 1.33, '양호'],
  ['저항 R', 'MX-310', 1.21, 1.05, '주의'],
  ['평탄도', 'PKG-BGA', 1.38, 1.28, '양호'],
  ['솔더 높이', 'PKG-BGA', 0.98, 0.91, '미흡'],
];
const tone = (s: string): Tone => (s === '양호' ? 'ok' : s === '주의' ? 'warn' : 'err');
const barC = (v: number) => (v >= 1.33 ? C.teal : v >= 1.0 ? C.warn : C.err);

/** 공정능력(Cp/Cpk) 요약 — 와이어프레임 report-qual.jsx 정본. */
export default function ReportCpkScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="공정능력(Cp/Cpk) 요약" sub="품질 리포트 / 공정능력 지수 요약" type="R2" />
      <RParam><FField label="제품"><FSel /></FField><FField label="특성"><FSel /></FField></RParam>
      <MKpis items={[['관리 특성', '24', '개'], ['Cpk≥1.33', '18', '개', 'teal'], ['1.0≤Cpk<1.33', '4', '개'], ['Cpk<1.0', '2', '개']]} />
      <Card title="관리 특성별 공정능력 지수" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">기준: Cpk ≥ 1.33 양호 / ≥ 1.0 주의 / &lt; 1.0 미흡</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['관리 특성', '제품', 'Cp', 'Cpk', 'Cpk 수준', '판정'].map((c, i) => <th key={c} className={th(i >= 2 && i <= 3 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                <td className={`${td('left')} font-bold text-ink`}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[11px] text-ink2`}>{r[1]}</td>
                <td className={`${td('right')} tabular-nums text-ink2`}>{r[2].toFixed(2)}</td>
                <td className={`${td('right')} font-extrabold tabular-nums text-ink`}>{r[3].toFixed(2)}</td>
                <td className={td('left')} style={{ width: 160 }}><ProgBar v={Math.min((r[3] / 2) * 100, 100)} color={barC(r[3])} /></td>
                <td className={td('center')}><Pill tone={tone(r[4])} solid={r[4] === '미흡'}>{r[4]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
