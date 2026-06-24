import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C } from '../_qual';
import { useInspections, useJudgeInspection } from '@/features/inspection/useInspections';
import type { Inspection } from '@/domain/inspection/schema';

type Judgement = NonNullable<Inspection['judgement']>;
const JUDGES: Judgement[] = ['합격', '조건부합격', '특채', '반품'];
const judgeTone = (j: string): Tone => (j === '합격' ? 'ok' : j === '조건부합격' ? 'info' : j === '특채' ? 'warn' : 'err');
const TONE_C: Record<Tone, string> = { ok: C.ok, info: C.blue, warn: C.warn, err: C.err, mute: C.ink3 };

/** 수입검사 실적 및 판정 등록 — 와이어프레임 qual-iqc-result.jsx 정본. */
export default function QualIqcResultScreen() {
  const { data: lots = [], isLoading } = useInspections({ stage: 'IQC' });
  const judgeM = useJudgeInspection();
  // 검사중 LOT을 우선 로드(없으면 첫 건). 실제 라우팅 연동 시 recv 파라미터로 대체.
  const lot = lots.find((l) => l.status === '검사중') ?? lots[0];

  const [meas, setMeas] = useState<(string[] | number)[] | null>(null);
  const [finalJ, setFinalJ] = useState<Judgement>('합격');

  // LOT이 바뀌면 측정값 상태를 items에서 재초기화.
  useEffect(() => {
    if (lot) setMeas(lot.items.map((it) => (it.type === '계량' ? [...it.values] : it.defect)));
  }, [lot?.recv]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVal = (ii: number, si: number, v: string) => setMeas((m) => (m ? m.map((row, i) => (i === ii ? (row as string[]).map((x, j) => (j === si ? v : x)) : row)) : m));
  const setDef = (ii: number, v: string) => setMeas((m) => (m ? m.map((row, i) => (i === ii ? Math.max(0, +v || 0) : row)) : m));

  if (!lot || !meas) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '검사중인 LOT이 없습니다.'}</div>;
  }

  const results = lot.items.map((it, ii) => {
    if (it.type === '계량') {
      const nums = (meas[ii] as string[]).map(parseFloat).filter((v) => !isNaN(v));
      const oos = nums.filter((v) => v < it.lsl! || v > it.usl!).length;
      const min = nums.length ? Math.min(...nums) : null, max = nums.length ? Math.max(...nums) : null;
      const mean = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
      return { oos, min, max, mean, ng: oos > 0 };
    }
    const d = meas[ii] as number;
    return { defect: d, ng: d > 0 };
  });

  const totalDefect = results.reduce((s, r) => s + (r.oos != null ? r.oos : r.defect!), 0);
  const autoJudge = totalDefect <= lot.ac ? '합격' : '불합격';
  const mismatch = (autoJudge === '합격' && finalJ !== '합격') || (autoJudge === '불합격' && finalJ === '합격');
  const stockLabel = finalJ === '합격' ? '양품 재고' : finalJ === '반품' ? '반품 대기' : finalJ === '조건부합격' ? '등급 재고' : '특채 재고';
  const stockC = finalJ === '합격' ? C.ok : finalJ === '반품' ? C.err : C.warn;

  // 판정 확정 — 측정 실적을 items에 반영해 저장 + '판정완료' 전이.
  const confirmJudge = () => {
    const items = lot.items.map((it, ii) =>
      it.type === '계량' ? { ...it, values: meas[ii] as string[] } : { ...it, defect: meas[ii] as number },
    );
    judgeM.mutate({ recv: lot.recv, judgement: finalJ, items });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">수입검사 실적 및 판정 등록</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 수입검사(IQC) / 수입검사 실적 및 판정 등록</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: judgeM.isPending ? '저장 중…' : '판정 확정', variant: 'primary', onClick: confirmJudge, disabled: judgeM.isPending }, { icon: 'save', label: '임시저장' }, 'download']} />
      </div>

      {/* LOT 컨텍스트 바 */}
      <div className="flex flex-wrap items-center gap-[18px] rounded-[10px] border border-border bg-panel px-4 py-3.5 shadow-[0_1px_2px_rgba(23,34,65,0.04)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14.5px] font-extrabold text-ink">{lot.name}</span>
          <span className="font-mono text-[10px] text-ink3">{lot.code} · {lot.recv} · LOT {lot.lot}</span>
        </div>
        <span className="h-[30px] w-px bg-border" />
        {[['협력사', lot.vendor], ['입고수량', lot.qty.toLocaleString() + ' ' + lot.unit], ['검사자', lot.pic], ['검사일시', lot.date]].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5"><span className="text-[9.5px] text-ink3">{k}</span><span className="text-[11.5px] font-bold text-ink2">{v}</span></div>
        ))}
        <div className="ml-auto flex rounded-lg px-1 py-1.5" style={{ background: C.navy }}>
          {([['n', lot.n], ['Ac', lot.ac], ['Re', lot.re], ['AQL', lot.aql.toFixed(2)]] as const).map(([k, v], i, a) => (
            <div key={k} className="px-3.5 text-center" style={{ borderRight: i < a.length - 1 ? '1px solid rgba(255,255,255,.16)' : 'none' }}>
              <div className="font-mono text-[15px] font-extrabold" style={{ color: i === 1 ? '#7fe3da' : i === 2 ? '#ff9b8e' : '#fff' }}>{v}</div>
              <div className="text-[8px] text-white/55">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.95fr_1fr]">
        {/* 검사값 입력 */}
        <Card title="검사 실적 입력" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">측정값 입력 시 규격 대비 자동 판정</span>}>
          <div className="flex flex-col">
            {lot.items.map((it, ii) => {
              const r = results[ii];
              return (
                <div key={ii} className="px-4 py-3.5" style={{ borderBottom: ii < lot.items.length - 1 ? `1px solid ${C.border}` : 'none', background: r.ng ? '#fdf1ef' : '#fff' }}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="rounded-[5px] px-1.5 py-0.5 text-[9px] font-bold" style={{ color: it.type === '계량' ? C.blue : C.teal, border: `1px solid ${(it.type === '계량' ? C.blue : C.teal)}44` }}>{it.type}</span>
                    <span className="text-[12.5px] font-extrabold text-ink">{it.name}</span>
                    {it.type === '계량' && <span className="font-mono text-[10px] text-ink3">규격 {it.lsl} ~ {it.usl} {it.unit}</span>}
                    <span className="ml-auto"><Pill tone={r.ng ? 'err' : 'ok'} solid>{r.ng ? 'NG' : 'OK'}</Pill></span>
                  </div>

                  {it.type === '계량' ? (
                    <div className="flex flex-wrap items-center gap-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="mr-0.5 text-[9.5px] text-ink3">시료</span>
                        {(meas[ii] as string[]).map((v, si) => {
                          const bad = v !== '' && (parseFloat(v) < it.lsl! || parseFloat(v) > it.usl!);
                          return <input key={si} value={v} onChange={(e) => setVal(ii, si, e.target.value)} className="h-[30px] w-[58px] rounded-md border px-1.5 text-center font-mono text-[11px] font-bold outline-none" style={{ borderColor: bad ? C.err : C.borderHi, color: bad ? C.err : C.ink }} />;
                        })}
                        <span className="text-[9px] text-ink3">외 {lot.n - (meas[ii] as string[]).length}건</span>
                      </div>
                      <div className="ml-auto flex overflow-hidden rounded-[7px] border border-border">
                        {([['평균', r.mean != null ? r.mean.toFixed(3) : '—'], ['최소', r.min != null ? r.min.toFixed(3) : '—'], ['최대', r.max != null ? r.max.toFixed(3) : '—'], ['OOS', r.oos]] as const).map(([k, v], i) => (
                          <div key={k} className="px-3 py-1.5 text-center" style={{ borderRight: i < 3 ? `1px solid ${C.border}` : 'none', background: k === 'OOS' && r.oos! > 0 ? '#fdecea' : C.panelAlt }}>
                            <div className="font-mono text-[11.5px] font-extrabold" style={{ color: k === 'OOS' ? (r.oos! > 0 ? C.err : C.ok) : C.ink }}>{v}</div>
                            <div className="text-[8px] text-ink3">{k}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-[10.5px] text-ink3">검사 시료 {lot.n}개 중 부적합</span>
                      <input type="number" value={meas[ii] as number} onChange={(e) => setDef(ii, e.target.value)} className="h-8 w-16 rounded-md border border-border-hi text-center font-mono text-[13px] font-bold text-ink outline-none" />
                      <span className="text-[10.5px] text-ink3">개</span>
                      <span className="ml-auto text-[10.5px] text-ink3">판정 기준 : 외관 결함 0개</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* 판정 요약 */}
        <Card title="판정 요약" bodyClassName="p-0">
          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-end justify-between">
              <span className="text-[10.5px] font-bold text-ink3">부적합 합계</span>
              <span className="flex items-baseline gap-1">
                <span className="font-mono text-[30px] font-extrabold leading-none" style={{ color: totalDefect > lot.ac ? C.err : C.ok }}>{totalDefect}</span>
                <span className="text-[12px] text-ink3">/ 시료 {lot.n}</span>
              </span>
            </div>
            <div className="mb-1.5 flex gap-1">
              {Array.from({ length: lot.re + 1 }).map((_, i) => (
                <div key={i} className="h-2 flex-1 rounded-[3px]" style={{ background: i < totalDefect ? (totalDefect > lot.ac ? C.err : C.ok) : C.bgDeep }} />
              ))}
            </div>
            <div className="flex justify-between text-[9.5px] text-ink3">
              <span>합격 Ac ≤ <b style={{ color: C.ok }}>{lot.ac}</b></span>
              <span>불합격 Re ≥ <b style={{ color: C.err }}>{lot.re}</b></span>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2 text-[10px] font-bold text-ink3">자동 판정 (Ac/Re 기준)</div>
            <div className="rounded-[10px] py-3.5 text-center" style={{ background: autoJudge === '합격' ? C.tealSoft : '#fdecea' }}>
              <div className="text-[24px] font-extrabold" style={{ color: autoJudge === '합격' ? C.ok : C.err }}>{autoJudge === '합격' ? '✓ 합격' : '✕ 불합격'}</div>
              <div className="mt-1 text-[9.5px] text-ink3">부적합 {totalDefect}개 {autoJudge === '합격' ? `≤ Ac ${lot.ac}` : `≥ Re ${lot.re}`}</div>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10px] font-bold text-ink3">최종 판정 등록</div>
            <div className="grid grid-cols-2 gap-1.5">
              {JUDGES.map((j) => {
                const on = finalJ === j;
                const c = TONE_C[judgeTone(j)];
                return <button key={j} onClick={() => setFinalJ(j)} className="rounded-lg py-2.5 text-[12px] font-extrabold" style={{ border: `1.5px solid ${on ? c : C.border}`, background: on ? c + '14' : '#fff', color: on ? c : C.ink2 }}>{j}</button>;
              })}
            </div>
            {mismatch && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-2" style={{ background: '#fef6ec', border: `1px solid ${C.warn}` }}>
                <span className="text-[12px]">⚠</span>
                <span className="text-[10px] font-bold" style={{ color: '#b5731f' }}>자동 판정({autoJudge})과 다릅니다 — 특채/조건부 승인 사유 필수</span>
              </div>
            )}
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: C.panelAlt }}>
              <span className="text-[10.5px] text-ink3">재고 상태값 반영</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: stockC }} />
                <span className="text-[11.5px] font-extrabold text-ink">{stockLabel}</span>
              </span>
            </div>
            <div className="mb-1.5 text-[10px] font-bold text-ink3">판정 비고</div>
            <textarea placeholder="판정 사유·특이사항 입력" className="h-14 w-full resize-none rounded-lg border border-border-hi p-2.5 text-[11px] text-ink outline-none" />
          </div>
        </Card>
      </div>
    </div>
  );
}
