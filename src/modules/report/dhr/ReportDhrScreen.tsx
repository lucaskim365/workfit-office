import { C, RHead, RParam, RDocSheet, FField, FSel } from '../_report';

type T = [step: string, time: string, desc: string, tone: string];
const timeline: T[] = [
  ['자재 투입', '06-18 08:12', 'LOT-RAW-8821 외 3종 투입', 'in'],
  ['가공 공정', '06-18 09:40', 'ETCH-01 · 가공 완료 (양품)', 'wip'],
  ['공정 검사(PQC)', '06-18 13:05', '자주검사 합격 · 선폭 0.181μm', 'ok'],
  ['조립 공정', '06-19 10:22', 'BOND-05 · 조립 완료', 'wip'],
  ['최종 검사(OQC)', '06-19 16:48', '출하검사 합격 · COA 발행', 'ok'],
  ['출하', '06-20 09:00', 'LOT-OUT-2206-031 · 한빛전자', 'out'],
];
const tc: Record<string, string> = { in: C.blue, wip: C.warn, ok: C.ok, out: C.teal };

/** 제품 이력 카드(DHR) — 와이어프레임 report-trace.jsx 정본. */
export default function ReportDhrScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="제품 이력 카드(DHR)" sub="추적·규제 리포트 / 제품 이력 카드 (Device History Record)" type="R4" />
      <RParam period="필요 시"><FField label="제품"><FSel value="MX-200" w={90} /></FField><FField label="시리얼"><FSel value="SN-2206-00481" w={150} /></FField></RParam>
      <RDocSheet docTitle="제품 이력 카드 (DHR)" docNo="DHR-SN-2206-00481" sign={false}
        fields={[['제품명', 'MX-200 (메모리 모듈)'], ['시리얼 번호', 'SN-2206-00481'], ['생산 로트', 'WO-260619-088'], ['출하 로트', 'LOT-OUT-2206-031'], ['생산 라인', 'M-Line 1'], ['최종 판정', 'OQC 합격']]}>
        <div className="mb-3 text-[12px] font-extrabold text-ink">생산·검사 이력 (Process History)</div>
        <div className="flex flex-col">
          {timeline.map((t, i) => (
            <div key={i} className="grid gap-3" style={{ gridTemplateColumns: '20px 1fr' }}>
              <div className="flex flex-col items-center">
                <span className="mt-[3px] h-3 w-3 shrink-0 rounded-full border-2 border-white" style={{ background: tc[t[3]], boxShadow: `0 0 0 1px ${tc[t[3]]}` }} />
                {i < timeline.length - 1 && <span className="w-0.5 flex-1" style={{ background: C.border, minHeight: 22 }} />}
              </div>
              <div className="pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-ink">{t[0]}</span>
                  <span className="font-mono text-[10px] text-ink3">{t[1]}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-ink2">{t[2]}</div>
              </div>
            </div>
          ))}
        </div>
      </RDocSheet>
    </div>
  );
}
