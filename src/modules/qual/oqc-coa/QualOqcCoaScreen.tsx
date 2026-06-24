import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';
import { useCoas, useTransitionCoa } from '@/features/coa/useCoas';
import { nextStatus } from '@/domain/coa/status';

const COA_ST: Record<string, Tone> = { 발행대기: 'info', 발행완료: 'warn', 전송완료: 'ok' };
const ISSUER = { name: '미래정밀(주)', addr: '경기도 화성시 동탄산단로 24', tel: '031-360-1200' };

/** 출하 성적서(COA) 자동 발행 — 와이어프레임 qual-oqc-coa.jsx 정본. */
export default function QualOqcCoaScreen() {
  const { data: COA_LOTS = [], isLoading } = useCoas();
  const transition = useTransitionCoa();
  const [sel, setSel] = useState('COA-260621-014');
  const cur = COA_LOTS.find((c) => c.no === sel) || COA_LOTS[0];
  const cnt = (s: string) => COA_LOTS.filter((c) => c.status === s).length;

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '발행할 성적서가 없습니다.'}</div>;
  }

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
              <button
                onClick={() => {
                  const to = nextStatus(cur.status);
                  if (to) transition.mutate({ no: cur.no, to });
                }}
                disabled={transition.isPending}
                className="h-10 flex-1 rounded-lg text-[12.5px] font-bold text-white disabled:opacity-50"
                style={{ background: C.navy }}
              >
                {cur.status === '발행대기' ? 'COA 발행 확정' : cur.status === '발행완료' ? '이메일 전송' : 'PDF 다운로드'}
              </button>
              <button className="h-10 flex-1 rounded-lg border border-border-hi bg-panel text-[12.5px] font-bold text-ink2">거래처 이메일 전송</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
