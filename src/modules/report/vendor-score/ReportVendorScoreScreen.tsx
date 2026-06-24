import { Card } from '@/shared/ui/Card';
import { C, RHead, RParam, MKpis, FField, FSel } from '../_report';

const AL: Record<string, string> = { right: 'text-right', center: 'text-center', left: 'text-left' };
const th = (al: string) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: string) => `whitespace-nowrap border-b border-border px-3 py-2.5 ${AL[al]}`;

type Row = [v: string, item: string, pass: string, due: string, score: number, grade: string];
const rows: Row[] = [
  ['대성반도체', '웨이퍼', '99.1%', '100%', 4.8, 'A'],
  ['한울케미칼', '포토레지스트', '95.6%', '98%', 4.1, 'B'],
  ['동진정밀', 'BGA 기판', '96.2%', '94%', 4.0, 'B'],
  ['JS머트리얼', '슬러리', '99.5%', '99%', 4.9, 'A'],
  ['대한가스', '공정 가스', '92.4%', '90%', 3.4, 'C'],
];
const gBg = (g: string) => (g === 'A' ? C.tealSoft : g === 'B' ? C.blueSoft : C.bgDeep);
const gFg = (g: string) => (g === 'A' ? C.teal : g === 'B' ? C.blue : g === 'C' ? C.warn : C.err);

/** 협력사 품질 스코어카드 — 와이어프레임 report-qual.jsx 정본. */
export default function ReportVendorScoreScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="협력사 품질 스코어카드" sub="품질 리포트 / 협력사 품질 평가" type="R3" />
      <RParam period="2026 2분기"><FField label="협력사"><FSel /></FField><FField label="등급"><FSel /></FField></RParam>
      <MKpis items={[['평가 협력사', '28', '사'], ['A 등급', '11', '사', 'teal'], ['C 이하', '3', '사'], ['평균 합격률', '96.8', '%']]} />
      <Card title="협력사별 품질 성적 (입고 합격률·납기·종합)" bodyClassName="p-0">
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['협력사', '주요 품목', '입고 합격률', '납기 준수', '종합 점수', '등급'].map((c, i) => <th key={c} className={th(i >= 2 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                <td className={`${td('left')} font-bold text-ink`}>{r[0]}</td>
                <td className={`${td('left')} text-ink2`}>{r[1]}</td>
                <td className={`${td('right')} tabular-nums text-ink2`}>{r[2]}</td>
                <td className={`${td('right')} tabular-nums text-ink2`}>{r[3]}</td>
                <td className={`${td('right')} font-extrabold tabular-nums text-ink`}>{r[4].toFixed(1)}</td>
                <td className={td('center')}><span className="inline-grid h-6 w-6 place-items-center rounded-[7px] text-[11px] font-extrabold" style={{ background: gBg(r[5]), color: gFg(r[5]) }}>{r[5]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
