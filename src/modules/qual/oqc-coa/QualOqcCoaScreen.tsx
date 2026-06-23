import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';

const COA_ST: Record<string, Tone> = { 발행대기: 'info', 발행완료: 'warn', 전송완료: 'ok' };
const ISSUER = { name: '미래정밀(주)', addr: '경기도 화성시 동탄산단로 24', tel: '031-360-1200' };

interface Coa { no: string; so: string; code: string; name: string; cust: string; dest: string; qty: number; unit: string; lot: string; date: string; insp: string; mgr: string; mat: string; heat: string; std: string; status: string; rows: string[][] }
const COA_LOTS: Coa[] = [
  { no: 'COA-260621-014', so: 'SO-260620-031', code: 'FG-GER-22', name: '기어 G-22T', cust: '한국델파이(주)', dest: '대구공장', qty: 1500, unit: 'EA', lot: 'L2606-0931', date: '2026-06-21', insp: '이검사', mgr: '박품질', mat: 'SCM420', heat: 'HT-2606-08', std: 'KS B ISO 1328-1', status: '발행대기', rows: [['치형(M)', '1.50 ±0.01 mm', '1.500', '합격'], ['PCD', '33.00 ±0.05 mm', '33.004', '합격'], ['백래시', '0.05~0.15 mm', '0.096', '합격'], ['치면 손상', '손상 無', '양호', '합격'], ['외관·버', '버·이물 無', '양호', '합격']] },
  { no: 'COA-260621-013', so: 'SO-260621-018', code: 'FG-BRK-A', name: '브래킷 ASSY-A', cust: '현대모비스(주)', dest: '아산 1공장', qty: 1200, unit: 'EA', lot: 'L2606-1013', date: '2026-06-21', insp: '김검사', mgr: '박품질', mat: 'AL6061-T6', heat: '—', std: 'IATF 16949', status: '발행대기', rows: [['외경(O.D)', '25.00 ±0.05 mm', '25.01', '합격'], ['체결 토크', '12.0 ±1.5 N·m', '12.3', '합격'], ['외관', '스크래치 無', '양호', '합격']] },
  { no: 'COA-260621-009', so: 'SO-260621-015', code: 'FG-HSG-C', name: '하우징 C-Type', cust: 'LG전자(주)', dest: '창원 물류', qty: 5000, unit: 'EA', lot: 'L2606-1008', date: '2026-06-21', insp: '이검사', mgr: '박품질', mat: 'PA66-GF30', heat: '—', std: 'RoHS / ISO 9001', status: '발행완료', rows: [['중량', '50.0 ±2.0 g', '50.4', '합격'], ['외관', '웰드라인 無', '양호', '합격'], ['색상', '한계견본 내', '양호', '합격']] },
  { no: 'COA-260620-031', so: 'SO-260620-022', code: 'FG-SFT-D', name: '샤프트 D-40', cust: '현대모비스(주)', dest: '아산 2공장', qty: 800, unit: 'EA', lot: 'L2606-1006', date: '2026-06-20', insp: '김검사', mgr: '박품질', mat: 'SCM440', heat: 'HT-2606-05', std: 'IATF 16949', status: '전송완료', rows: [['축경(Ø)', '40.00 ±0.03 mm', '40.01', '합격'], ['진원도', '≤0.02 mm', '0.012', '합격'], ['표면 거칠기', '≤1.6 Ra', '1.2', '합격']] },
  { no: 'COA-260620-028', so: 'SO-260619-040', code: 'FG-BRK-A', name: '브래킷 ASSY-A', cust: 'LG마그나(주)', dest: '인천공장', qty: 600, unit: 'EA', lot: 'L2606-0939', date: '2026-06-20', insp: '이검사', mgr: '박품질', mat: 'AL6061-T6', heat: '—', std: 'PPAP Lv.3', status: '전송완료', rows: [['외경(O.D)', '25.00 ±0.05 mm', '25.00', '합격'], ['외관', '스크래치 無', '양호', '합격']] },
];

/** 출하 성적서(COA) 자동 발행 — 와이어프레임 qual-oqc-coa.jsx 정본. */
export default function QualOqcCoaScreen() {
  const [sel, setSel] = useState('COA-260621-014');
  const cur = COA_LOTS.find((c) => c.no === sel) || COA_LOTS[0];
  const cnt = (s: string) => COA_LOTS.filter((c) => c.status === s).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">출하 성적서(COA) 자동 발행</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 출하검사(OQC) / 출하 성적서(COA) 자동 발행</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: 'COA 발행', variant: 'primary' }, { icon: 'upload', label: '이메일 전송', accent: 'excel' }, 'download']} />
      </div>

      <KpiGrid cols={4} items={[
        ['발행 대기', '' + cnt('발행대기'), '건', C.blue],
        ['발행 완료', '' + cnt('발행완료'), '건', C.warn],
        ['전송 완료', '' + cnt('전송완료'), '건', C.ok],
        ['자동 발행률', '98.5', '%', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.15fr_1.45fr]">
        {/* 발행 큐 */}
        <Card title="COA 발행 큐" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">출하 승인 완료 LOT</span>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['성적서 / 제품', 'text-left'], ['거래처', 'text-left'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COA_LOTS.map((c, i) => {
                const on = c.no === sel;
                return (
                  <tr key={c.no} onClick={() => setSel(c.no)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10px] font-bold" style={{ color: on ? C.teal : C.ink }}>{c.no}</div>
                      <div className="mt-0.5 text-[11px] font-bold text-ink">{c.name}</div>
                      <div className="font-mono text-[9px] text-ink3">{c.lot}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-[10.5px] text-ink2">{c.cust}<div className="text-[9px] text-ink3">{c.qty.toLocaleString()} {c.unit}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={COA_ST[c.status]} solid={c.status === '전송완료'}>{c.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 미리보기 */}
        <Card title="성적서 미리보기" bodyClassName="p-0" action={<Pill tone={COA_ST[cur.status]} solid={cur.status === '전송완료'}>{cur.status}</Pill>}>
          <div className="p-4" style={{ background: C.bgDeep }}>
            <div className="mx-auto max-w-[560px] rounded border border-border-hi bg-panel px-7 py-6 shadow-[0_4px_18px_rgba(23,34,65,0.10)]">
              {/* 헤더 */}
              <div className="flex items-start justify-between pb-3.5" style={{ borderBottom: `2px solid ${C.navy}` }}>
                <div>
                  <div className="text-[16px] font-extrabold tracking-tight" style={{ color: C.navy }}>시 험 성 적 서</div>
                  <div className="mt-0.5 text-[9px] tracking-[0.18em] text-ink3">CERTIFICATE OF ANALYSIS</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-extrabold text-ink">{ISSUER.name}</div>
                  <div className="mt-0.5 text-[8.5px] text-ink3">{ISSUER.addr}</div>
                  <div className="text-[8.5px] text-ink3">TEL {ISSUER.tel}</div>
                </div>
              </div>

              <div className="flex justify-between border-b border-border py-2.5">
                <div><span className="text-[8.5px] font-semibold text-ink3">성적서 번호 </span><span className="font-mono text-[11px] font-bold text-ink">{cur.no}</span></div>
                <div><span className="text-[8.5px] font-semibold text-ink3">발행일 </span><span className="font-mono text-[11px] font-bold text-ink">{cur.date}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-x-[18px] gap-y-1.5 border-b border-border py-3">
                {[['수 신', cur.cust], ['납품처', cur.dest], ['품 명', cur.name], ['품 번', cur.code], ['LOT NO.', cur.lot], ['수 량', cur.qty.toLocaleString() + ' ' + cur.unit], ['재 질', cur.mat], ['열처리 Batch', cur.heat]].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="w-16 shrink-0 text-[8.5px] font-semibold text-ink3">{k}</span>
                    <span className={`text-[11px] font-bold text-ink ${/[\d]/.test('' + v) && k !== '품 명' ? 'font-mono' : ''}`}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="pb-1.5 pt-3">
                <div className="mb-1.5 text-[9.5px] font-extrabold text-ink2">■ 검사 결과</div>
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr>
                      {['No', '검사 항목', '규격 기준', '측정 결과', '판정'].map((h, i) => (
                        <th key={i} className={`px-2 py-1.5 text-[9px] font-bold text-white ${i === 0 || i >= 3 ? 'text-center' : 'text-left'}`} style={{ background: C.navy, border: `1px solid ${C.navy}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cur.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5 text-center font-mono text-ink3" style={{ border: `1px solid ${C.border}` }}>{i + 1}</td>
                        <td className="px-2 py-1.5 font-bold text-ink" style={{ border: `1px solid ${C.border}` }}>{r[0]}</td>
                        <td className="px-2 py-1.5 font-mono text-ink2" style={{ border: `1px solid ${C.border}` }}>{r[1]}</td>
                        <td className="px-2 py-1.5 text-center font-mono font-bold text-ink" style={{ border: `1px solid ${C.border}` }}>{r[2]}</td>
                        <td className="px-2 py-1.5 text-center font-extrabold" style={{ border: `1px solid ${C.border}`, color: C.ok }}>{r[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="my-2 flex items-center justify-between rounded px-3.5 py-2.5" style={{ background: C.tealSoft, border: `1px solid ${C.ok}33` }}>
                <span className="text-[10px] font-bold text-ink2">종 합 판 정</span>
                <span className="text-[14px] font-extrabold tracking-[0.1em]" style={{ color: C.ok }}>합 격 / PASS</span>
              </div>

              <div className="flex items-end justify-between pt-3">
                <div className="text-[8.5px] text-ink3">적용 규격 : {cur.std}<br />상기 제품은 당사 품질기준에 의거 검사되었음을 증명합니다.</div>
                <div className="flex gap-[18px]">
                  {[['검 사', cur.insp], ['품질책임', cur.mgr]].map(([k, v]) => (
                    <div key={k} className="text-center">
                      <div className="mb-1 text-[8.5px] font-semibold text-ink3">{k}</div>
                      <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full text-[11px] font-extrabold" style={{ border: `1.5px solid ${C.err}55`, color: `${C.err}99` }}>{v.slice(0, 1)}印</div>
                      <div className="mt-0.5 text-[9px] font-bold text-ink2">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-3.5 flex max-w-[560px] gap-2">
              <button className="h-10 flex-1 rounded-lg text-[12.5px] font-bold text-white" style={{ background: C.navy }}>{cur.status === '발행대기' ? 'COA 발행 확정' : 'PDF 다운로드'}</button>
              <button className="h-10 flex-1 rounded-lg border border-border-hi bg-panel text-[12.5px] font-bold text-ink2">거래처 이메일 전송</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
