import { Fragment, useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C } from '../_qual';
import { useInspections, useJudgeInspection } from '@/features/inspection/useInspections';
import type { Inspection } from '@/domain/inspection/schema';

type Judgement = NonNullable<Inspection['judgement']>;
const JUDGES: Judgement[] = ['합격', '조건부합격', '특채', '불합격'];
const judgeTone = (j: string): Tone => (j === '합격' ? 'ok' : j === '조건부합격' ? 'info' : j === '특채' ? 'warn' : 'err');
const TONE_C: Record<Tone, string> = { ok: C.ok, info: C.blue, warn: C.warn, err: C.err, mute: C.ink3 };
const CHAIN = [{ role: '검사자', name: '이검사' }, { role: '품질 책임자', name: '박품질' }, { role: '출하 승인', name: '정출하' }];

/** 출하검사 판정 및 승인 — 와이어프레임 qual-oqc-release.jsx 정본. */
export default function QualOqcReleaseScreen() {
  const { data: lots = [], isLoading } = useInspections({ stage: 'OQC' });
  const judgeM = useJudgeInspection();
  // 검사중 출하 LOT을 우선 로드. 실제 라우팅 연동 시 recv 파라미터로 대체.
  const lot = lots.find((l) => l.status === '검사중') ?? lots[0];

  const [defects, setDefects] = useState<number[]>([]);
  const [finalJ, setFinalJ] = useState<Judgement>('합격');
  const [step, setStep] = useState(1);
  const [coaDone, setCoaDone] = useState(false);

  useEffect(() => {
    if (lot) setDefects(lot.items.map((it) => (it.type === '계수' ? it.defect : 0)));
  }, [lot?.recv]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lot) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '검사중인 출하 LOT이 없습니다.'}</div>;
  }

  // 고객 요구사항 체크리스트 — COA 항목은 발행 토글로 충족 처리.
  const req = lot.req.map((label) => ({ label, done: !label.includes('COA') }));

  const results = lot.items.map((it, ii) => {
    if (it.type === '계량') {
      const nums = it.values.map(parseFloat).filter((v) => !isNaN(v));
      const oos = nums.filter((v) => v < it.lsl! || v > it.usl!).length;
      const min = nums.length ? Math.min(...nums) : 0, max = nums.length ? Math.max(...nums) : 0;
      const mean = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
      return { oos, min, max, mean, ng: oos > 0 };
    }
    return { defect: defects[ii] ?? 0, ng: (defects[ii] ?? 0) > 0 };
  });
  const totalDefect = results.reduce((s, r) => s + (r.oos != null ? r.oos : r.defect!), 0);
  const autoJudge = totalDefect <= lot.ac ? '합격' : '불합격';
  const mismatch = (autoJudge === '합격' && finalJ !== '합격') || (autoJudge === '불합격' && finalJ === '합격');

  const reqMet = req.every((r) => r.done || (r.label.includes('COA') && coaDone));
  const passed = finalJ === '합격' || finalJ === '조건부합격' || finalJ === '특채';
  const fullyApproved = step >= CHAIN.length;
  const canRelease = passed && reqMet && fullyApproved;

  // 출하 release — 측정실적(계수 부적합) + 판정 저장 후 '판정완료' 전이.
  const confirmRelease = () => {
    const items = lot.items.map((it, ii) => (it.type === '계수' ? { ...it, defect: defects[ii] ?? 0 } : it));
    judgeM.mutate({ recv: lot.recv, judgement: finalJ, items });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">출하검사 판정 및 승인</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 출하검사(OQC) / 출하검사 판정 및 승인</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: judgeM.isPending ? '저장 중…' : '판정 확정', variant: 'primary', onClick: confirmRelease, disabled: judgeM.isPending }, { icon: 'save', label: '임시저장' }, 'download']} />
      </div>

      {/* LOT 컨텍스트 바 */}
      <div className="flex flex-wrap items-center gap-[18px] rounded-[10px] border border-border bg-panel px-4 py-3.5 shadow-[0_1px_2px_rgba(23,34,65,0.04)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14.5px] font-extrabold text-ink">{lot.name}</span>
          <span className="font-mono text-[10px] text-ink3">{lot.code} · {lot.recv} · LOT {lot.lot}</span>
        </div>
        <span className="h-[30px] w-px bg-border" />
        {[['거래처', lot.cust], ['납품처', lot.dest], ['출하수량', lot.qty.toLocaleString() + ' ' + lot.unit], ['출하 예정', lot.ship]].map(([k, v]) => (
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

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
        {/* 검사 실적 */}
        <Card title="출하검사 실적" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">검사자 {lot.pic} · {lot.date}</span>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['검사 항목', 'text-left'], ['규격', 'text-center'], ['평균 / 부적합', 'text-center'], ['범위(Min~Max)', 'text-center'], ['OOS', 'text-center'], ['판정', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lot.items.map((it, ii) => {
                const r = results[ii];
                return (
                  <tr key={ii} style={{ background: r.ng ? '#fdf1ef' : '#fff' }}>
                    <td className="border-b border-border px-3 py-2.5"><span className="mr-1.5 text-[8.5px] font-bold" style={{ color: it.type === '계량' ? C.blue : C.teal }}>{it.type}</span><span className="font-bold text-ink">{it.name}</span></td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[9.5px] text-ink3">{it.type === '계량' ? `${it.lsl}~${it.usl}` : '0건'}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-mono font-extrabold" style={{ color: r.ng ? C.err : C.ink }}>
                      {it.type === '계량' ? r.mean!.toFixed(3) : (
                        <input type="number" value={defects[ii]} onChange={(e) => setDefects((d) => d.map((x, j) => (j === ii ? Math.max(0, +e.target.value || 0) : x)))} className="h-7 w-[50px] rounded-md border border-border-hi text-center font-mono text-[11px] font-bold text-ink outline-none" />
                      )}
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10px] text-ink2">{it.type === '계량' ? `${r.min!.toFixed(3)} ~ ${r.max!.toFixed(3)}` : '—'}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center font-mono font-extrabold" style={{ color: (r.oos || r.defect)! > 0 ? C.err : C.ok }}>{it.type === '계량' ? r.oos : r.defect}</td>
                    <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={r.ng ? 'err' : 'ok'} solid>{r.ng ? 'NG' : 'OK'}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-t border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">고객 요구사항 충족 확인</div>
            <div className="flex flex-col gap-1.5">
              {req.map((rq, i) => {
                const isCoa = rq.label.includes('COA');
                const ok = rq.done || (isCoa && coaDone);
                return (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ background: ok ? C.tealSoft : '#fef6ec', border: `1px solid ${ok ? 'transparent' : C.warn}` }}>
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: ok ? C.ok : '#fff', border: ok ? 'none' : `1.5px solid ${C.warn}` }}>{ok ? '✓' : ''}</span>
                    <span className="text-[11.5px] font-bold text-ink">{rq.label}</span>
                    {isCoa && !coaDone ? (
                      <button onClick={() => setCoaDone(true)} className="ml-auto rounded-md px-2.5 py-1 text-[10px] font-bold" style={{ color: C.blue, background: C.blueSoft }}>COA 발행</button>
                    ) : <span className="ml-auto text-[10px] font-bold" style={{ color: ok ? C.ok : C.warn }}>{ok ? '충족' : '미충족'}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* 판정 & 승인 */}
        <Card title="판정 및 출하 승인" bodyClassName="p-0">
          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-end justify-between">
              <span className="text-[10.5px] font-bold text-ink3">부적합 합계</span>
              <span className="flex items-baseline gap-1"><span className="font-mono text-[28px] font-extrabold leading-none" style={{ color: totalDefect > lot.ac ? C.err : C.ok }}>{totalDefect}</span><span className="text-[11px] text-ink3">/ 시료 {lot.n}</span></span>
            </div>
            <div className="rounded-[9px] py-2.5 text-center" style={{ background: autoJudge === '합격' ? C.tealSoft : '#fdecea' }}>
              <span className="text-[18px] font-extrabold" style={{ color: autoJudge === '합격' ? C.ok : C.err }}>{autoJudge === '합격' ? '✓ 자동판정 합격' : '✕ 자동판정 불합격'}</span>
              <span className="ml-2 text-[9.5px] text-ink3">부적합 {totalDefect} {autoJudge === '합격' ? `≤ Ac ${lot.ac}` : `≥ Re ${lot.re}`}</span>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10px] font-bold text-ink3">최종 판정</div>
            <div className="grid grid-cols-2 gap-1.5">
              {JUDGES.map((j) => {
                const on = finalJ === j;
                const c = TONE_C[judgeTone(j)];
                return <button key={j} onClick={() => setFinalJ(j)} className="rounded-lg py-2.5 text-[11.5px] font-extrabold" style={{ border: `1.5px solid ${on ? c : C.border}`, background: on ? c + '14' : '#fff', color: on ? c : C.ink2 }}>{j}</button>;
              })}
            </div>
            {mismatch && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: '#fef6ec', border: `1px solid ${C.warn}` }}>
                <span className="text-[11px]">⚠</span><span className="text-[9.5px] font-bold" style={{ color: '#b5731f' }}>자동판정({autoJudge})과 상이 — 사유 필수</span>
              </div>
            )}
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-3 text-[10px] font-bold text-ink3">출하 승인 결재라인</div>
            <div className="flex items-start">
              {CHAIN.map((a, i) => {
                const done = i < step;
                const active = i === step;
                const c = done ? C.ok : active ? C.navy : C.borderHi;
                return (
                  <Fragment key={i}>
                    {i > 0 && <span className="mt-4 h-0.5 flex-1" style={{ background: i <= step ? C.ok : C.border }} />}
                    <div className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-extrabold" style={{ color: done || active ? '#fff' : C.ink3, background: done ? C.ok : active ? C.navy : '#fff', border: `2px solid ${c}` }}>{done ? '✓' : i + 1}</span>
                      <span className="text-center text-[9.5px] font-bold text-ink">{a.role}</span>
                      <span className="text-[9px]" style={{ color: done ? C.ok : C.ink3 }}>{done ? a.name + ' 완료' : active ? '결재 대기' : '—'}</span>
                    </div>
                  </Fragment>
                );
              })}
            </div>
            {step < CHAIN.length && (
              <button onClick={() => setStep((s) => Math.min(CHAIN.length, s + 1))} disabled={!passed} className="mt-3 h-[34px] w-full rounded-lg text-[11px] font-bold text-white disabled:cursor-not-allowed" style={{ background: passed ? C.navy : C.borderHi }}>{CHAIN[step].role} 결재 승인</button>
            )}
          </div>

          <div className="px-4 py-3.5">
            <div className="rounded-[10px] p-3.5 text-center" style={{ background: canRelease ? C.tealSoft : C.panelAlt, border: `1.5px solid ${canRelease ? C.ok : C.border}` }}>
              <div className="text-[19px] font-extrabold" style={{ color: canRelease ? C.ok : C.ink3 }}>{canRelease ? '🚚 출하 가능' : '출하 보류'}</div>
              <div className="mt-1 text-[9.5px] text-ink3">{!passed ? '판정 불합격 — 출하 불가' : !reqMet ? '고객 요구사항 미충족' : !fullyApproved ? `결재 ${step}/${CHAIN.length} 진행중` : '전 결재 완료 · 출하지시 연동'}</div>
            </div>
            <button onClick={confirmRelease} disabled={!canRelease || judgeM.isPending} className="mt-2.5 h-10 w-full rounded-lg text-[12.5px] font-bold text-white disabled:cursor-not-allowed" style={{ background: canRelease ? C.navy : C.borderHi }}>출하 release →</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
