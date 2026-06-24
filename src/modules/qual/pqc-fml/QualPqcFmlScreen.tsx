import { Fragment, useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, ChipTabs } from '../_qual';
import { usePqcFmlChecks } from '@/features/pqcFml/usePqcFml';
import type { PqcFml as Wo, StageInfo } from '@/domain/pqcFml/schema';

const FM_ST: Record<string, { t: Tone; mk: string }> = { 합격: { t: 'ok', mk: '✓' }, 불합격: { t: 'err', mk: '✕' }, 검사중: { t: 'warn', mk: '…' }, 대기: { t: 'mute', mk: '○' }, 해당없음: { t: 'mute', mk: '–' } };
const TONE_C: Record<Tone, string> = { ok: C.ok, err: C.err, warn: C.warn, mute: C.borderHi, info: C.blue };
const FM_STAGES: [string, string][] = [['first', '초물'], ['mid', '중물'], ['last', '종물']];
const STAGE_LABEL: Record<string, string> = { first: '초물', mid: '중물', last: '종물' };

function FmMini({ stages }: { stages: Record<string, StageInfo> }) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {FM_STAGES.map(([k, lbl], i) => {
        const s = FM_ST[stages[k].st];
        const c = TONE_C[s.t];
        return (
          <Fragment key={k}>
            {i > 0 && <span className="h-0.5 w-2 bg-border" />}
            <span title={`${lbl} ${stages[k].st}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold" style={{ color: s.t === 'mute' ? C.ink3 : '#fff', background: s.t === 'mute' ? C.panelAlt : c, border: s.t === 'mute' ? `1px solid ${C.borderHi}` : 'none' }}>{lbl[0]}</span>
          </Fragment>
        );
      })}
    </div>
  );
}

/** 초·중·종물 검사 관리 — 와이어프레임 qual-pqc-fml.jsx 정본. */
export default function QualPqcFmlScreen() {
  const [sel, setSel] = useState('WO-260621-013');
  const [stage, setStage] = useState<string | null>(null);
  const [tab, setTab] = useState('진행중');
  const { data: wos, isLoading } = usePqcFmlChecks();
  useEffect(() => { setStage(null); }, [sel]);

  if (isLoading || !wos) return <div className="p-6 text-sm text-ink3">불러오는 중…</div>;
  if (wos.length === 0) return <div className="p-6 text-sm text-ink3">작업지시 데이터가 없습니다.</div>;

  const cur = wos.find((w) => w.wo === sel) || wos[0];
  const actStage = stage ?? (cur.active === 'done' ? 'last' : cur.active);

  const isDone = (w: Wo) => w.active === 'done';
  const rows = wos.filter((w) => tab === '전체' || (tab === '진행중' ? !isDone(w) : isDone(w)));

  const firstWait = wos.filter((w) => w.stages.first.st === '검사중' || w.stages.first.st === '대기').length;
  const ngLine = wos.filter((w) => Object.values(w.stages).some((s) => s.st === '불합격')).length;
  const inProg = wos.filter((w) => !isDone(w)).length;

  const st = cur.stages[actStage];
  const results = cur.items.map((it) => (it.t === '계량' ? { ng: it.val < it.lsl! || it.val > it.usl! } : { ng: it.val > 0 }));
  const totalNg = results.filter((r) => r.ng).length;
  const judge = totalNg === 0 ? '합격' : '불합격';
  const stageLabel = STAGE_LABEL[actStage];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">초·중·종물 검사 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 공정검사(PQC) / 초·중·종물 검사 관리</p>
        </div>
        <ActionBar actions={[{ icon: 'save', label: '판정 등록', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['진행중 작업지시', '' + inProg, 'WO', C.ink],
        ['초물 검사 대기', '' + firstWait, '건', C.warn],
        ['불합격(라인 정지)', '' + ngLine, '건', C.err],
        ['금일 종물 합격', '1', 'WO', C.ok],
        ['금일 공정 합격률', '97.4', '%', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.85fr_1fr]">
        {/* WO 목록 */}
        <Card title="작업지시별 검사 진행 현황" bodyClassName="p-0" action={<ChipTabs items={['진행중', '완료', '전체']} value={tab} onChange={setTab} />}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['작업지시 / LOT', 'text-left'], ['품목', 'text-left'], ['라인 / 설비', 'text-left'], ['진척', 'text-right'], ['초 · 중 · 종 검사', 'text-center'], ['현재 단계', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => {
                const on = w.wo === sel;
                const act = w.active === 'done' ? '완료' : STAGE_LABEL[w.active];
                const anyNg = Object.values(w.stages).some((s) => s.st === '불합격');
                return (
                  <tr key={w.wo} onClick={() => setSel(w.wo)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-mono text-[10.5px] font-bold" style={{ color: on ? C.teal : C.ink }}>{w.wo}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{w.lot}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5"><div className="font-bold text-ink">{w.item}</div><div className="mt-px font-mono text-[9px] text-ink3">{w.code} · {w.proc}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-[10.5px]">{w.line}<div className="font-mono text-[9px] text-ink3">{w.equip}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono"><div className="text-[10.5px] font-bold text-ink">{Math.round((w.done / w.qty) * 100)}%</div><div className="text-[9px] text-ink3">{w.done.toLocaleString()}/{w.qty.toLocaleString()}</div></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><FmMini stages={w.stages} /></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={anyNg ? 'err' : w.active === 'done' ? 'ok' : 'info'}>{anyNg ? '정지' : act}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* WO 상세 */}
        <Card title="검사 상세" bodyClassName="p-0" action={<Pill tone={cur.active === 'done' ? 'ok' : 'info'}>{cur.active === 'done' ? '검사 완료' : '진행중'}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="text-[14.5px] font-extrabold text-ink">{cur.item}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.wo} · {cur.line} · {cur.equip}</div>
          </div>

          {/* 단계 트래커 */}
          <div className="border-b border-border px-4 py-3.5">
            <div className="flex items-center">
              {FM_STAGES.map(([k, lbl], i) => {
                const s = cur.stages[k];
                const meta = FM_ST[s.st];
                const c = TONE_C[meta.t];
                const on = actStage === k;
                return (
                  <Fragment key={k}>
                    {i > 0 && <span className="mx-0.5 h-0.5 flex-1" style={{ background: cur.stages[FM_STAGES[i - 1][0]].st === '합격' ? C.ok : C.border }} />}
                    <button onClick={() => setStage(k)} className="flex shrink-0 flex-col items-center gap-1.5">
                      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[15px] font-extrabold" style={{ color: meta.t === 'mute' ? C.ink3 : '#fff', background: meta.t === 'mute' ? '#fff' : c, border: `2px solid ${on ? C.navy : meta.t === 'mute' ? C.borderHi : c}`, boxShadow: on ? '0 0 0 3px rgba(31,47,85,.12)' : 'none' }}>{meta.mk}</span>
                      <span className="text-[10.5px] font-extrabold" style={{ color: on ? C.ink : C.ink2 }}>{lbl}</span>
                      <Pill tone={meta.t}>{s.st}</Pill>
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
            <span className="text-[11.5px] font-extrabold text-ink">{stageLabel} 검사 항목 ({cur.items.length})</span>
            <span className="text-[9.5px] text-ink3">검사자 {st.pic} · {st.time}</span>
          </div>

          <div className="border-b border-border">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {[['검사 항목', 'text-left'], ['규격', 'text-center'], ['측정값', 'text-center'], ['판정', 'text-center']].map(([h, al]) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cur.items.map((it, i) => {
                  const ng = results[i].ng;
                  return (
                    <tr key={i} style={{ background: ng ? '#fdf1ef' : '#fff' }}>
                      <td className="border-b border-border px-2.5 py-2.5"><span className="mr-1.5 text-[8.5px] font-bold" style={{ color: it.t === '계량' ? C.blue : C.teal }}>{it.t}</span><span className="font-bold text-ink">{it.n}</span></td>
                      <td className="border-b border-border px-2.5 py-2.5 text-center font-mono text-[9.5px] text-ink3">{it.t === '계량' ? `${it.lsl}~${it.usl}` : '0건'}</td>
                      <td className="border-b border-border px-2.5 py-2.5 text-center font-mono font-extrabold" style={{ color: ng ? C.err : C.ink }}>{it.t === '계량' ? it.val : it.val + '건'}<span className="text-[8px] font-normal text-ink3">{it.t === '계량' ? ' ' + it.unit : ''}</span></td>
                      <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={ng ? 'err' : 'ok'} solid>{ng ? 'NG' : 'OK'}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between rounded-[9px] px-3.5 py-3" style={{ background: judge === '합격' ? C.tealSoft : '#fdf1ef' }}>
              <div>
                <div className="mb-0.5 text-[9.5px] text-ink3">{stageLabel} 자동 판정</div>
                <div className="text-[18px] font-extrabold" style={{ color: judge === '합격' ? C.ok : C.err }}>{judge === '합격' ? '✓ 합격' : '✕ 불합격'}</div>
              </div>
              <div className="text-right">
                <div className="mb-0.5 text-[9.5px] text-ink3">{actStage === 'first' ? '양산 가공' : actStage === 'last' ? '입고/이동' : '연속 생산'}</div>
                <div className="text-[12px] font-extrabold" style={{ color: judge === '합격' ? C.ok : C.err }}>{judge === '합격' ? '게이트 OPEN' : '게이트 정지'}</div>
              </div>
            </div>
            {judge === '불합격' && (
              <div className="mb-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-2" style={{ background: '#fdf1ef', border: `1px solid ${C.err}` }}>
                <span className="text-[12px]">⚠</span>
                <span className="text-[10px] font-bold" style={{ color: C.err }}>규격 이탈 {totalNg}건 — 설비 정지 · 초기조건 재설정 후 재검사 필요</span>
              </div>
            )}
            <div className="flex gap-2">
              <button className="h-[38px] flex-1 rounded-lg text-[12px] font-bold text-white" style={{ background: C.navy }}>{stageLabel} 판정 등록 →</button>
              <button className="h-[38px] rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] font-bold text-ink2">NCR 발행</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
