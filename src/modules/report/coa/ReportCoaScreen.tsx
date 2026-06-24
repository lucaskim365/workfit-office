import { Pill } from '@/shared/ui/Pill';
import { RHead, RParam, RDocSheet, FField, FSel } from '../_report';

const AL: Record<string, string> = { center: 'text-center', left: 'text-left' };
const th = (al: string) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: string) => `whitespace-nowrap border-b border-border px-3 py-2.5 ${AL[al]}`;
const rows = [
  ['선폭 CD', '0.18 ± 0.02 μm', '0.181 μm', '합격'],
  ['두께 T', '500 ± 15 nm', '503 nm', '합격'],
  ['저항 R', '22 ± 1.5 Ω', '21.8 Ω', '합격'],
  ['외관 검사', 'AQL 0.65', '0 결함', '합격'],
];

/** 출하 성적서(COA) — 와이어프레임 report-qual.jsx 정본. */
export default function ReportCoaScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="출하 성적서(COA)" sub="품질 리포트 / 출하 성적서 (Certificate of Analysis)" type="R1" />
      <RParam period="출하 로트"><FField label="로트"><FSel value="LOT-OUT-2206-031" w={170} /></FField></RParam>
      <RDocSheet docTitle="출하 시험 성적서 (COA)" docNo="COA-2206-031"
        fields={[['제품명', 'MX-200 (메모리 모듈)'], ['출하 로트', 'LOT-OUT-2206-031'], ['수량', '600 EA'], ['고객사', '한빛전자'], ['생산일자', '2026-06-19'], ['출하검사', 'OQC 합격']]}>
        <table className="w-full border-collapse text-[12px]">
          <thead><tr>{['시험 항목', '규격(Spec)', '측정값', '판정'].map((c, i) => <th key={c} className={th(i === 3 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${td('left')} font-semibold text-ink`}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[11px] text-ink2`}>{r[1]}</td>
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[2]}</td>
                <td className={td('center')}><Pill tone="ok">{r[3]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3.5 text-[11px] leading-relaxed text-ink2">본 성적서는 상기 로트가 당사 품질 기준 및 고객 규격을 충족함을 증명합니다. 시험 방법은 사내 표준(QM-STD-204)에 따릅니다.</div>
      </RDocSheet>
    </div>
  );
}
