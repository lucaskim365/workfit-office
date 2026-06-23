import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';

const MRB_ST: Record<string, Tone> = { 심의대기: 'info', 심의중: 'warn', 의결완료: 'ok', 보류: 'mute' };
const DISP = ['사용가(특채)', '재작업', '수리', '반품', '폐기'];
const dispTone = (d: string): Tone => (d === '사용가(특채)' ? 'info' : d === '재작업' || d === '수리' ? 'warn' : d === '반품' ? 'mute' : 'err');
const dispColor = (d: string) => ({ info: C.blue, warn: C.warn, mute: C.ink3, err: C.err, ok: C.ok }[dispTone(d)]);
const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const wonM = (n: number) => '₩' + (n / 10000).toLocaleString() + '만';

interface Case { no: string; ncr: string; date: string; meeting: string; code: string; name: string; lot: string; defect: string; sev: string; qty: number; unit: string; loss: number; status: string; decision: string | null; board: [string, string, string][]; reason: string }
const MRB_CASES: Case[] = [
  { no: 'MRB-260621-004', ncr: 'NCR-260621-005', date: '2026-06-21', meeting: '06-22 14:00', code: 'RM-STS304', name: 'STS304 강판 t2.0', lot: 'L2606-0018', defect: '인장강도 미달', sev: '치명', qty: 280, unit: 'SHT', loss: 4620000, status: '심의대기', decision: null, board: [['품질 책임', '박품질', '반품'], ['생산 관리', '김생산', '반품'], ['구매', '이구매', '반품'], ['기술', '정기술', '폐기']], reason: '규격(520MPa) 대비 인장강도 미달로 구조 안전성 미확보. 협력사 귀책 명확하여 반품 처리 타당.' },
  { no: 'MRB-260620-003', ncr: 'NCR-260620-011', date: '2026-06-20', meeting: '06-21 10:00', code: 'FG-GER-22', name: '기어 G-22T', lot: 'L2605-0820', defect: '치면 소음', sev: '치명', qty: 35, unit: 'EA', loss: 2800000, status: '심의중', decision: null, board: [['품질 책임', '박품질', '폐기'], ['생산 관리', '김생산', '재작업'], ['기술', '정기술', '재작업'], ['영업', '한영업', '폐기']], reason: '고객 클레임품. 치면 조도 재가공 가능성 검토 중이나 열처리 경도 영향 추가 분석 필요.' },
  { no: 'MRB-260620-002', ncr: 'NCR-260620-007', date: '2026-06-20', meeting: '06-20 15:00', code: 'FG-CVR-B', name: '커버 플레이트 B', lot: 'L2606-1011', defect: '평면도 불량', sev: '주요', qty: 42, unit: 'EA', loss: 630000, status: '의결완료', decision: '사용가(특채)', board: [['품질 책임', '박품질', '사용가(특채)'], ['생산 관리', '김생산', '사용가(특채)'], ['영업', '한영업', '사용가(특채)'], ['기술', '정기술', '재작업']], reason: '평면도 0.13mm로 규격(≤0.10) 초과하나 고객 사용 영향 경미. 고객 동의 확보 후 특채 출하 의결.' },
  { no: 'MRB-260619-001', ncr: 'NCR-260619-009', date: '2026-06-19', meeting: '06-19 16:00', code: 'FG-SFT-D', name: '샤프트 D-40', lot: 'L2606-0905', defect: '진원도 불량', sev: '주요', qty: 60, unit: 'EA', loss: 1200000, status: '의결완료', decision: '재작업', board: [['품질 책임', '박품질', '재작업'], ['생산 관리', '김생산', '재작업'], ['기술', '정기술', '재작업'], ['구매', '이구매', '폐기']], reason: '진원도 0.035mm. 재연삭으로 규격 회복 가능 판단. 재작업 후 전수 재검사 조건부 의결.' },
];

/** MRB(부적합 심의) 현황 — 와이어프레임 qual-mrb.jsx 정본. */
export default function QualMrbScreen() {
  const [sel, setSel] = useState('MRB-260621-004');
  const [pick, setPick] = useState<string | null>(null);
  const cur = MRB_CASES.find((c) => c.no === sel) || MRB_CASES[0];
  useEffect(() => { setPick(null); }, [sel]);

  const tally: Record<string, number> = {};
  cur.board.forEach(([, , op]) => { tally[op] = (tally[op] || 0) + 1; });
  const consensus = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
  const decision = cur.decision || pick || consensus;
  const decided = cur.status === '의결완료';

  const waiting = MRB_CASES.filter((c) => c.status === '심의대기' || c.status === '심의중').length;
  const doneCnt = MRB_CASES.filter((c) => c.status === '의결완료').length;
  const scrapLoss = MRB_CASES.filter((c) => (c.decision || '') === '폐기').reduce((s, c) => s + c.loss, 0);
  const totalLoss = MRB_CASES.reduce((s, c) => s + c.loss, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">MRB(부적합 심의) 현황</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 부적합·불량 관리 / MRB(부적합 심의) 현황</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '의결 확정', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['심의 대기·진행', '' + waiting, '건', C.warn],
        ['금월 의결 완료', '' + doneCnt, '건', C.ok],
        ['금월 심의 안건', '' + MRB_CASES.length, '건', C.ink],
        ['추정 손실액', wonM(totalLoss), '', C.err],
        ['폐기 결정액', wonM(scrapLoss), '', C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {/* 안건 목록 */}
        <Card title="MRB 심의 안건" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">NCR 연계 안건</span>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['MRB / NCR', 'text-left'], ['품목 / 불량', 'text-left'], ['수량', 'text-right'], ['손실액', 'text-right'], ['처분', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MRB_CASES.map((c, i) => {
                const on = c.no === sel;
                return (
                  <tr key={c.no} onClick={() => setSel(c.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{c.no}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{c.ncr}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{c.name}</div><div className="mt-px text-[9.5px] text-ink3">{c.defect} · <span style={{ color: c.sev === '치명' ? C.err : C.ink3 }}>{c.sev}</span></div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold text-ink">{c.qty}<span className="text-[9px] font-normal text-ink3"> {c.unit}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold" style={{ color: C.err }}>{wonM(c.loss)}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center">{c.decision ? <Pill tone={dispTone(c.decision)} solid={c.decision === '폐기'}>{c.decision}</Pill> : <span className="text-[9.5px] text-ink3">미정</span>}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={MRB_ST[c.status]} solid={c.status === '의결완료'}>{c.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="심의 안건 상세" bodyClassName="p-0" action={<Pill tone={MRB_ST[cur.status]} solid={cur.status === '의결완료'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><Pill tone={sevTone(cur.sev)} solid={cur.sev === '치명'}>{cur.sev}</Pill></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.no} · {cur.ncr} · 회의 {cur.meeting}</div>
          </div>

          <div className="flex border-b border-border px-4 py-3">
            {([['부적합', cur.defect, C.ink], ['수량', cur.qty + ' ' + cur.unit, C.ink], ['추정 손실', wonM(cur.loss), C.err]] as const).map(([k, v, c], i, a) => (
              <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className={`text-[12px] font-extrabold ${i > 0 ? 'font-mono' : ''}`} style={{ color: c }}>{v}</div>
                <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
              </div>
            ))}
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[10.5px] font-bold text-ink3">심의 위원 의견 ({cur.board.length})</span>
              <span className="text-[9.5px] text-ink3">다수의견 <b style={{ color: dispColor(consensus) }}>{consensus}</b></span>
            </div>
            <div className="flex flex-col gap-1">
              {cur.board.map(([role, name, op], i) => (
                <div key={i} className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5" style={{ background: C.panelAlt }}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white" style={{ background: C.navy }}>{name.slice(0, 1)}</span>
                  <div className="min-w-0 flex-1"><span className="text-[11px] font-bold text-ink">{name}</span><span className="ml-1.5 text-[9.5px] text-ink3">{role}</span></div>
                  <Pill tone={dispTone(op)} solid={op === '폐기'}>{op}</Pill>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10px] font-bold text-ink3">처분 결정 {decided && <span style={{ color: C.ok }}>· 의결 완료</span>}</div>
            <div className="flex flex-wrap gap-1.5">
              {DISP.map((d) => {
                const on = decision === d;
                const c = dispColor(d);
                return <button key={d} onClick={() => !decided && setPick(d)} className="rounded-lg px-2.5 py-2 text-[11px] font-extrabold" style={{ border: `1.5px solid ${on ? c : C.border}`, background: on ? c + '14' : '#fff', color: on ? c : C.ink2, cursor: decided ? 'default' : 'pointer', opacity: decided && !on ? 0.45 : 1 }}>{d}</button>;
              })}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 rounded-[9px] px-3.5 py-3" style={{ background: decision === '폐기' ? '#fdf1ef' : dispTone(decision) === 'info' ? C.blueSoft : C.tealSoft }}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[9.5px] font-bold text-ink3">의결 처분</span>
                <span className="text-[15px] font-extrabold" style={{ color: dispColor(decision) }}>{decision}</span>
              </div>
              <div className="text-[10px] leading-relaxed text-ink2">{cur.reason}</div>
            </div>
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: decided ? C.borderHi : C.navy }}>{decided ? '의결 완료됨' : '의결 확정 →'}</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">보류</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
