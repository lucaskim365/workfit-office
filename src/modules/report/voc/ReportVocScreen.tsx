import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { C, RHead, RParam, MKpis, FField, FSel } from '../_report';

const AL: Record<string, string> = { center: 'text-center', left: 'text-left' };
const th = (al: string) => `whitespace-nowrap border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold text-ink2 ${AL[al]}`;
const td = (al: string) => `whitespace-nowrap border-b border-border px-3 py-2.5 ${AL[al]}`;

type Row = [no: string, cust: string, prod: string, defect: string, status: string, step: string];
const rows: Row[] = [
  ['VOC-2206-014', '한빛전자', 'MX-200', '솔더링 불량', '8D 진행', 'D4 (근본원인)'],
  ['VOC-2206-011', '대륭산업', 'PKG-BGA', '치수 불량', '완료', 'D8 (종결)'],
  ['VOC-2206-008', '한빛전자', 'MX-310', '외관 스크래치', '완료', 'D8 (종결)'],
  ['VOC-2206-005', '세진테크', 'MX-200', '납기 지연', '8D 진행', 'D6 (시정조치)'],
];
const tone = (s: string): Tone => (s === '완료' ? 'ok' : 'warn');
const steps: [string, string, boolean][] = [
  ['D1', '팀 구성', true], ['D2', '문제 정의', true], ['D3', '임시 대책', true], ['D4', '근본 원인', false],
  ['D5', '영구 대책', false], ['D6', '시정 조치', false], ['D7', '재발 방지', false], ['D8', '종결', false],
];

/** 고객 클레임(VOC)·8D — 와이어프레임 report-trace.jsx 정본. */
export default function ReportVocScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="고객 클레임(VOC)·8D" sub="추적·규제 리포트 / 고객 클레임 및 8D 보고" type="R1" />
      <RParam period="2026 2분기"><FField label="고객사"><FSel /></FField><FField label="상태"><FSel /></FField></RParam>
      <MKpis items={[['접수 클레임', '14', '건'], ['8D 진행', '5', '건'], ['완료', '9', '건', 'teal'], ['평균 처리일', '8.4', '일']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card title="클레임 접수 및 8D 진행 현황" bodyClassName="p-0">
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['클레임번호', '고객사', '제품', '불량 내용', '상태', '8D 단계'].map((c, i) => <th key={c} className={th(i === 4 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                  <td className={`${td('left')} font-semibold text-ink`}>{r[1]}</td>
                  <td className={`${td('left')} font-mono text-[11px] text-ink2`}>{r[2]}</td>
                  <td className={`${td('left')} text-ink2`}>{r[3]}</td>
                  <td className={td('center')}><Pill tone={tone(r[4])}>{r[4]}</Pill></td>
                  <td className={`${td('left')} font-semibold text-ink2`}>{r[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="8D 진행 단계 (VOC-2206-014)" bodyClassName="p-0">
          <div className="flex flex-col gap-[7px] p-4">
            {steps.map((d, i) => (
              <div key={d[0]} className="flex items-center gap-2.5">
                <span className="grid h-[22px] w-[22px] place-items-center rounded-md text-[9.5px] font-extrabold" style={{ background: d[2] ? C.teal : i === 3 ? C.warn : C.bgDeep, color: d[2] || i === 3 ? '#fff' : C.ink3 }}>{d[0]}</span>
                <span className="text-[11.5px]" style={{ color: d[2] || i === 3 ? C.ink : C.ink3, fontWeight: d[2] || i === 3 ? 700 : 500 }}>{d[1]}</span>
                {d[2] && <span className="ml-auto text-[11px] font-extrabold" style={{ color: C.ok }}>✓</span>}
                {i === 3 && <span className="ml-auto"><Pill tone="warn" solid>진행 중</Pill></span>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
