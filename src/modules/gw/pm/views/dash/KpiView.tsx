import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { shortName } from '@/domain/pm/rules';
import { dday } from '@/domain/pm/site';
import {
  aiEval, aiMeasOf, fmtNum, fmtPct, kImp, kpiDefs, kpiEval, kpiPick, kpiScore,
  type KpiDef, type PmAiMeas, type PmKpiDef, type PmKpiMeas, type PmPlanAi,
} from '@/domain/pm/kpi';
import type { PmProject } from '@/domain/pm/schema';
import { usePmDerived, usePmSiteMutations } from '@/features/pm/usePm';
import { PARTIAL_LOCK_MSG, usePmPartialLock } from '@/features/pm/pmSaveBus';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { CardHead, ScreenHead } from './parts';

/**
 * 대시보드 › 성과지표 실측 (site/kpi, 데모 siteKpi 6990) — 3-7. 메뉴 탭에 없는 화면:
 * 사업별 화면 › 사업 개요 › 성과지표 [실측 기록 ›] · 검색으로 들어온다.
 * 지표 = 사업계획서 1.5(내장) + 직접 등록, 달성도 = 지표별 (실측 개선율 ÷ 목표 개선율)의 가중 평균.
 */
const sec = 'rounded-xl border border-border bg-panel shadow-sm';
const th = 'px-3 py-2 text-left text-[11px] font-bold text-ink3 whitespace-nowrap';
const thR = `${th} text-right`;
const td = 'px-3 py-2 align-middle';
const tdR = `${td} text-right tabular-nums`;
const inp = 'w-full rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';
const F_TONE: Record<string, 'warn' | 'run' | 'plain'> = { Q: 'warn', P: 'run' };

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-alt">
      <i className={`block h-full ${pct >= 100 ? 'bg-ok' : 'bg-teal'}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export function KpiView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const smut = usePmSiteMutations(people.me);
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<null | { kind: 'meas'; m?: PmKpiMeas; kid?: string } | { kind: 'def'; x?: PmKpiDef } | { kind: 'ai'; i: number }>(null);

  if (!d) return <EmptyHint title="성과지표를 불러오는 중입니다" />;
  const { snap, today } = d;
  // 데모 S.sites 순서 (사업 번호 순)
  const list = [...snap.projects].sort((a, b) => Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, '')));
  const s = kpiPick(list, snap.plans, params.get('k'));
  if (!s) return <EmptyHint title="등록된 사업이 없습니다" />;
  const shortOf = (p: PmProject) => shortName(p, snap.projects);
  const pick = (id: string) => { const n = new URLSearchParams(); n.set('v', 'site/kpi'); n.set('k', id); setParams(n); };
  const own = (k: string) => snap.kpiDefs.filter((x) => x.projectId === k);
  const measOf = (k: string) => snap.kpiMeas.filter((m) => m.projectId === k);
  const p = snap.plans[s.id] ?? null;
  const ds = kpiDefs(p, own(s.id));
  const meas = measOf(s.id);
  const ai = (p?.ai ?? []) as PmPlanAi[];
  const aiMeas = snap.aiMeas.filter((m) => m.projectId === s.id);

  const listCard = (
    <section className={sec}>
      <CardHead title="사업별 성과지표">
        <span className="flex-1" />
        <span className="text-[11px] text-ink3">줄을 누르면 아래에 그 사업 · 달성도 = 지표별 (실측 개선율 ÷ 목표 개선율)의 가중 평균</span>
      </CardHead>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-panel-alt"><tr>
            <th className={th}>사업</th><th className={th}>사업계획서</th><th className={th}>성과지표</th><th className={thR}>실측 기록</th><th className={`${th} w-[20%]`}>가중 달성도</th><th className={th}>AI 성능목표</th>
          </tr></thead>
          <tbody>
            {list.map((x) => {
              const px = snap.plans[x.id];
              const dx = kpiDefs(px ?? null, own(x.id));
              const sc = kpiScore(dx, measOf(x.id));
              return (
                <tr key={x.id} onClick={() => pick(x.id)} className={`cursor-pointer border-b border-border last:border-b-0 hover:bg-panel-alt ${x.id === s.id ? 'bg-teal-soft/40' : ''}`}>
                  <td className={td}><ProjectTag>{shortOf(x)}</ProjectTag> <b className="ml-1 text-ink">{x.company}</b></td>
                  <td className={td}>{px ? <Tag tone="ok">반영</Tag> : <Tag>미등록</Tag>}</td>
                  <td className={`${td} text-[11.5px] text-ink2`}>{dx.length ? dx.map((y) => `${y.f ?? ''} ${y.name}`).join(' · ') : <span className="text-ink3">-</span>}</td>
                  <td className={tdR}>{sc ? `${sc.n} / ${sc.total}` : '-'}</td>
                  <td className={td}>{sc && sc.n ? <div className="flex items-center gap-2"><Bar pct={sc.score} /><span className="text-[11px] tabular-nums">{Math.round(sc.score)}%</span></div> : <span className="text-[11px] text-ink3">실측 전</span>}</td>
                  <td className={`${td} text-[11.5px]`}>{px && (px.ai ?? []).length ? `${px.ai!.length}개 항목` : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  const top = (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="flex-1 text-[14px] font-bold text-ink"><ProjectTag>{shortOf(s)}</ProjectTag> <span className="ml-1">{s.company} 성과지표</span></h3>
      <Button size="sm" variant="secondary" onClick={() => setForm({ kind: 'def' })}>+ 지표 직접 등록</Button>
      {ds.length > 0 && <Button size="sm" variant="primary" onClick={() => setForm({ kind: 'meas' })}>+ 실측 기록</Button>}
    </div>
  );

  const head = (
    <ScreenHead title="성과지표 실측" desc="사업계획서 1.5 성과지표의 구축 후 실측값을 기록하고 목표 달성도를 봅니다 (최종평가 대비). 사업별 화면 › 사업 개요의 성과지표 [실측 기록 ›]에서도 들어옵니다.">
      <Button size="sm" variant="secondary" onClick={() => { const n = new URLSearchParams(); n.set('v', 'dash/site'); n.set('k', s.id); setParams(n); }}>← 사업별 화면</Button>
    </ScreenHead>
  );

  const modal = form && (
    form.kind === 'meas' ? (
      <MeasModal ds={ds} m={form.m} kid={form.kid} short={shortOf(s)} today={today}
        onSave={async (v) => { await smut.saveKpiMeas.mutateAsync({ ...v, projectId: s.id, id: form.m?.id }); setForm(null); }}
        onRemove={form.m ? async () => { if (!confirm('이 실측 기록을 삭제할까요?')) return; await smut.removeKpiMeas.mutateAsync(form.m!.id); setForm(null); } : undefined}
        onClose={() => setForm(null)} />
    ) : form.kind === 'def' ? (
      <DefModal x={form.x} short={shortOf(s)}
        onSave={async (v) => { await smut.saveKpiDef.mutateAsync({ ...v, projectId: s.id, id: form.x?.id }); setForm(null); }}
        onRemove={form.x ? async () => { if (!confirm('이 지표와 실측 기록을 삭제할까요?')) return; await smut.removeKpiDef.mutateAsync(form.x!.id); setForm(null); } : undefined}
        onClose={() => setForm(null)} />
    ) : (
      <AiModal x={ai[form.i]} today={today}
        onSave={async (v) => { await smut.addAiMeas.mutateAsync({ ...v, projectId: s.id, i: form.i }); setForm(null); }}
        onClose={() => setForm(null)} />
    )
  );

  if (!ds.length) {
    return (
      <div className="space-y-4">
        {head}{listCard}{top}
        <section className={sec}>
          <EmptyHint title="성과지표가 없습니다" hint={<>{p ? '' : '사업계획서가 아직 등록되지 않았습니다. 계획서의 1.5 성과지표를 받으면 반영합니다. '}급하면 [+ 지표 직접 등록]으로 기준값 · 목표값을 입력할 수 있습니다.</>} />
        </section>
        {modal}
      </div>
    );
  }

  const sc = kpiScore(ds, meas)!;
  const card = (l: string, v: ReactNode, sub: ReactNode) => (
    <div className="rounded-xl border border-border bg-panel px-4 py-3 shadow-sm">
      <span className="text-[11.5px] font-bold text-ink2">{l}</span>
      <b className="block text-[22px] leading-tight text-ink">{v}</b>
      <small className="text-[10.5px] text-ink3">{sub}</small>
    </div>
  );
  const sm = (x: ReactNode) => <small className="ml-0.5 text-[12px] font-bold text-ink3">{x}</small>;
  const measSorted = [...meas].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-4">
      {head}
      {listCard}
      {top}
      {p?.post && (
        <div className="rounded-lg border border-blue/25 bg-blue-soft/40 px-3 py-2 text-[12px] text-ink2">
          <b className="text-ink">구축 후 측정 기준</b> — {p.post}. 기준 기간과 산식이 계획서와 다르면 최종평가에서 인정되지 않을 수 있습니다.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {card('성과지표', <>{ds.length}{sm('개')}</>, p ? '사업계획서 1.5 기준' : '직접 등록')}
        {card('실측 기록', <>{sc.n}{sm(`/ ${sc.total}개 지표`)}</>, `기록 ${meas.length}건`)}
        {card('가중 달성도', <>{sc.n ? Math.round(sc.score) : '-'}{sm('%')}</>, '100% = 모든 지표 목표 달성')}
        {card('사업 종료', <span className="text-[17px]">{s.end ? dday(s.end, today) : '-'}</span>, `${s.end || '-'} · 종료 전 실측 완료 필요`)}
      </div>

      <section className={sec}>
        <CardHead title="성과지표 · 목표"><span className="flex-1" /><span className="text-[11px] text-ink3">개선율 = 기준값 대비 변화율 (감소 지표는 줄어든 비율)</span></CardHead>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr>
              <th className={th}>분야</th><th className={th}>성과지표</th><th className={th}>단위</th><th className={thR}>구축 전</th><th className={thR}>목표</th><th className={thR}>목표 개선율</th><th className={thR}>가중치</th><th className={thR}>최근 실측</th><th className={thR}>개선율</th><th className={th}>판정</th><th className={th} />
            </tr></thead>
            <tbody>
              {ds.map((x) => <KpiRow key={x.id} x={x} meas={meas} onMeas={() => setForm({ kind: 'meas', kid: x.id })} onEdit={x.src === '직접 등록' ? () => setForm({ kind: 'def', x: own(s.id).find((y) => y.id === x.id) }) : undefined} />)}
            </tbody>
          </table>
        </div>
      </section>

      {ai.length > 0 && (
        <section className={sec}>
          <CardHead title="AI 성능목표 · 검증"><span className="flex-1" /><span className="text-[11px] text-ink3">계획서 2.6 · 최종점검 때 검증 근거 제출</span></CardHead>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border bg-panel-alt"><tr>
                <th className={th}>#</th><th className={th}>AI 성능 항목</th><th className={th}>목표</th><th className={th}>검증 방법</th><th className={thR}>최근 측정</th><th className={th}>판정</th><th className={th} />
              </tr></thead>
              <tbody>
                {ai.map((x, i) => {
                  const ms = aiMeasOf(aiMeas, i);
                  const last = ms[ms.length - 1];
                  const ok = aiEval(x, last);
                  return (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className={tdR}>{i + 1}</td>
                      <td className={td}><b className="text-ink">{x.n}</b></td>
                      <td className={`${td} text-[11.5px] font-bold`}>{x.tt}</td>
                      <td className={`${td} text-[11.5px] text-ink3`}>{x.m}</td>
                      <td className={tdR}>{last ? <>{x.op === 'chk' ? last.ok : `${fmtNum(last.val)}${x.unit}`}<div className="text-[10.5px] text-ink3">{last.date}</div></> : <span className="text-ink3">-</span>}</td>
                      <td className={td}>{ok == null ? <Tag>측정 전</Tag> : ok ? <Tag tone="ok">충족</Tag> : <Tag tone="warn">미충족</Tag>}</td>
                      <td className={td}><Button size="sm" variant="secondary" onClick={() => setForm({ kind: 'ai', i })}>기록</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={sec}>
        <CardHead title="실측 기록"><span className="flex-1" /><Button size="sm" variant="primary" onClick={() => setForm({ kind: 'meas' })}>+ 실측 기록</Button></CardHead>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr>
              <th className={th}>측정일</th><th className={th}>성과지표</th><th className={thR}>값</th><th className={thR}>개선율</th><th className={th}>측정 기간 · 근거</th><th className={th}>기록</th>
            </tr></thead>
            <tbody>
              {measSorted.map((m) => {
                const x = ds.find((y) => y.id === m.kid);
                return (
                  <tr key={m.id} onClick={() => setForm({ kind: 'meas', m })} title="눌러서 고치기" className="cursor-pointer border-b border-border last:border-b-0 hover:bg-panel-alt">
                    <td className={`${td} tabular-nums text-[11.5px]`}>{m.date}</td>
                    <td className={td}>{x ? x.name : '(삭제된 지표)'}</td>
                    <td className={tdR}><b>{fmtNum(m.val)}</b> <span className="text-[11px] text-ink3">{x?.unit ?? ''}</span></td>
                    <td className={`${tdR} text-[11.5px]`}>{x ? fmtPct(kImp(x, +m.val)) : '-'}</td>
                    <td className={`${td} text-[11.5px]`}>{m.memo || '-'}</td>
                    <td className={`${td} text-[11.5px] text-ink3`}>{people.labelOf(m.who)}</td>
                  </tr>
                );
              })}
              {!measSorted.length && (
                <tr><td colSpan={6}><EmptyHint title="아직 실측 기록이 없습니다" hint="MES 집계값이나 현장 측정값을 [+ 실측 기록]으로 넣으면 달성도가 계산됩니다." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {modal}
    </div>
  );
}

function KpiRow({ x, meas, onMeas, onEdit }: { x: KpiDef; meas: readonly PmKpiMeas[]; onMeas: () => void; onEdit?: () => void }) {
  const e = kpiEval(meas, x);
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className={td}><Tag tone={F_TONE[x.f ?? ''] ?? 'plain'}>{x.f || '-'}</Tag></td>
      <td className={td}>
        <b className="text-ink">{x.name}</b>{x.src !== '계획서' && <span className="ml-1"><Tag>직접 등록</Tag></span>}
        <div className="text-[10.5px] text-ink3">{x.period ? `기준 ${x.period}` : ''}{x.method ? ` · ${x.method}` : ''}</div>
      </td>
      <td className={`${td} text-[11.5px]`}>{x.unit}</td>
      <td className={tdR}>{fmtNum(x.base)}</td>
      <td className={tdR}><b>{fmtNum(x.target)}</b></td>
      <td className={`${tdR} text-[11.5px]`}>{fmtPct(e.tImp)}</td>
      <td className={tdR}>{x.w ?? ''}</td>
      <td className={tdR}>{e.last ? <><b>{fmtNum(e.last.val)}</b><div className="text-[10.5px] text-ink3">{e.last.date}</div></> : <span className="text-ink3">-</span>}</td>
      <td className={`${tdR} text-[11.5px]`}>{e.last ? fmtPct(e.imp) : '-'}</td>
      <td className={td}>{e.last ? <Tag tone={e.ok ? 'ok' : 'warn'}>{e.ok ? '목표 달성' : `달성률 ${Math.round(e.ach ?? 0)}%`}</Tag> : <Tag>실측 전</Tag>}</td>
      <td className={td}>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={onMeas}>기록</Button>
          {onEdit && <Button size="sm" variant="secondary" onClick={onEdit}>수정</Button>}
        </div>
      </td>
    </tr>
  );
}

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="mb-1 block text-[11.5px] font-bold text-ink2">{label}</span>
      {children}
    </label>
  );
}
function Foot({ err, onRemove, onClose, onSave, lock }: { err: string; onRemove?: () => void; onClose: () => void; onSave: () => void; lock?: boolean }) {
  return (
    <div className="flex w-full items-center gap-2">
      {onRemove && <Button size="sm" variant="danger" onClick={onRemove}>삭제</Button>}
      {lock ? <span className="flex-1 text-[11.5px] font-bold text-danger" role="alert">{PARTIAL_LOCK_MSG}</span> : <span className="flex-1 text-[11.5px] text-danger">{err}</span>}
      <Button size="sm" variant="secondary" onClick={onClose}>취소</Button>
      <Button size="sm" variant="primary" disabled={lock} onClick={onSave}>저장</Button>
    </div>
  );
}
const numOk = (v: string) => v.trim() !== '' && !Number.isNaN(+v);

/** 성과지표 실측 기록 (kpiMeasForm) */
function MeasModal({ ds, m, kid, short, today, onSave, onRemove, onClose }: {
  ds: KpiDef[]; m?: PmKpiMeas; kid?: string; short: string; today: string;
  onSave: (v: { kid: string; date: string; val: number; memo: string }) => Promise<void>;
  onRemove?: () => void; onClose: () => void;
}) {
  const [k, setK] = useState(m?.kid ?? kid ?? ds[0]?.id ?? '');
  const [date, setDate] = useState(m?.date ?? today);
  const [val, setVal] = useState(m ? String(m.val) : '');
  const [memo, setMemo] = useState(m?.memo ?? '');
  const [err, setErr] = useState('');
  const lock = usePmPartialLock() && !m;
  const save = () => {
    if (!k) return setErr('성과지표를 골라 주세요');
    if (!date) return setErr('측정일을 넣어 주세요');
    if (!numOk(val)) return setErr('측정값을 숫자로 넣어 주세요');
    void onSave({ kid: k, date, val: +val, memo: memo.trim() });
  };
  return (
    <Modal open onClose={onClose} width={560} title={`성과지표 실측 ${m ? '수정' : '기록'} — ${short}`} footer={<Foot err={err} onRemove={onRemove} onClose={onClose} onSave={save} lock={lock} />}>
      <p className="mb-3 text-[12px] text-ink2">MES 집계값이나 현장 측정값을 기록합니다. 계획서의 기준 기간 · 산식과 같은 방식으로 측정해야 최종평가에서 인정됩니다.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="성과지표 *" full>
          <select className={inp} value={k} onChange={(e) => setK(e.target.value)}>
            {ds.map((x) => <option key={x.id} value={x.id}>{`${x.f ?? ''} ${x.name} (${x.unit ?? ''} · 기준 ${fmtNum(x.base)} → 목표 ${fmtNum(x.target)})`}</option>)}
          </select>
        </Field>
        <Field label="측정일 *"><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="측정값 *"><input type="number" step="any" className={inp} value={val} onChange={(e) => setVal(e.target.value)} /></Field>
        <Field label="측정 기간 · 근거" full>
          <textarea className={inp} rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 2027-04 ~ 2027-06 MES 생산실적 평균 / 안정화 1개월 제외" />
        </Field>
      </div>
    </Modal>
  );
}

/** 성과지표 직접 등록 · 수정 (kpiDefForm) */
function DefModal({ x, short, onSave, onRemove, onClose }: {
  x?: PmKpiDef; short: string;
  onSave: (v: Omit<PmKpiDef, 'id' | 'projectId'>) => Promise<void>;
  onRemove?: () => void; onClose: () => void;
}) {
  const [v, setV] = useState({
    f: x?.f ?? 'P', name: x?.name ?? '', unit: x?.unit ?? '', dir: x?.dir ?? 'up',
    base: x ? String(x.base) : '', target: x ? String(x.target) : '', w: x ? String(x.w) : '0.5', period: x?.period ?? '', method: x?.method ?? '',
  });
  const [err, setErr] = useState('');
  const lock = usePmPartialLock() && !x;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value }));
  const save = () => {
    if (!v.name.trim()) return setErr('성과지표명을 넣어 주세요');
    if (!v.unit.trim()) return setErr('단위를 넣어 주세요');
    if (!numOk(v.base)) return setErr('구축 전 기준값을 숫자로 넣어 주세요');
    if (!numOk(v.target)) return setErr('목표값을 숫자로 넣어 주세요');
    const w = v.w.trim() === '' ? 0 : +v.w;
    if (Number.isNaN(w) || w < 0 || w > 1) return setErr('가중치는 0~1 사이 숫자입니다');
    void onSave({ f: v.f, name: v.name.trim(), unit: v.unit.trim(), dir: v.dir as 'up' | 'down', base: +v.base, target: +v.target, w, period: v.period.trim(), method: v.method.trim() });
  };
  return (
    <Modal open onClose={onClose} width={560} title={`성과지표 ${x ? '수정' : '직접 등록'} — ${short}`} footer={<Foot err={err} onRemove={onRemove} onClose={onClose} onSave={save} lock={lock} />}>
      <p className="mb-3 text-[12px] text-ink2">사업계획서를 받기 전이거나 계획서에 없는 지표를 관리할 때 씁니다. 계획서 지표는 계획서 데이터에서 자동으로 나옵니다.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="분야">
          <select className={inp} value={v.f} onChange={set('f')}>
            {[['P', 'P · 생산성'], ['Q', 'Q · 품질'], ['C', 'C · 원가'], ['D', 'D · 납기'], ['기타', '기타']].map(([a, b]) => <option key={a} value={a}>{b}</option>)}
          </select>
        </Field>
        <Field label="성과지표명 *"><input className={inp} value={v.name} onChange={set('name')} placeholder="예: 시간당생산량" /></Field>
        <Field label="단위 *"><input className={inp} value={v.unit} onChange={set('unit')} placeholder="EA/HR, %, 일" /></Field>
        <Field label="개선 방향">
          <select className={inp} value={v.dir} onChange={set('dir')}><option value="up">증가가 개선</option><option value="down">감소가 개선</option></select>
        </Field>
        <Field label="구축 전 기준값 *"><input type="number" step="any" className={inp} value={v.base} onChange={set('base')} /></Field>
        <Field label="목표값 *"><input type="number" step="any" className={inp} value={v.target} onChange={set('target')} /></Field>
        <Field label="가중치"><input type="number" step="any" min={0} max={1} className={inp} value={v.w} onChange={set('w')} /></Field>
        <Field label="기준 측정 기간"><input className={inp} value={v.period} onChange={set('period')} placeholder="예: 2025년 1월~11월" /></Field>
        <Field label="산식 · 측정 방법" full><textarea className={inp} rows={3} value={v.method} onChange={set('method')} /></Field>
      </div>
    </Modal>
  );
}

/** AI 성능 측정 기록 (aiMeasForm) */
function AiModal({ x, today, onSave, onClose }: {
  x: PmPlanAi; today: string;
  onSave: (v: Omit<PmAiMeas, 'id' | 'who' | 'projectId' | 'i'>) => Promise<void>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(today);
  const [val, setVal] = useState('');
  const [ok, setOk] = useState<'충족' | '미충족'>('충족');
  const [memo, setMemo] = useState('');
  const [err, setErr] = useState('');
  const lock = usePmPartialLock();
  const chk = x.op === 'chk';
  const save = () => {
    if (!date) return setErr('측정일을 넣어 주세요');
    if (!chk && !numOk(val)) return setErr('측정값을 숫자로 넣어 주세요');
    void onSave({ date, val: chk ? null : +val, ok: chk ? ok : '', memo: memo.trim() });
  };
  return (
    <Modal open onClose={onClose} width={520} title={`AI 성능 측정 기록 — ${x.n.length > 30 ? `${x.n.slice(0, 30)}…` : x.n}`} footer={<Foot err={err} onClose={onClose} onSave={save} lock={lock} />}>
      <p className="mb-3 text-[12px] text-ink2">목표 <b>{x.tt}</b> · 검증 방법: {x.m}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="측정일 *"><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {chk ? (
          <Field label="판정"><select className={inp} value={ok} onChange={(e) => setOk(e.target.value as '충족' | '미충족')}><option>충족</option><option>미충족</option></select></Field>
        ) : (
          <Field label={`측정값 (${x.unit}) *`}><input type="number" step="any" className={inp} value={val} onChange={(e) => setVal(e.target.value)} /></Field>
        )}
        <Field label="측정 근거 (데이터 기간 · 건수 등)" full><textarea className={inp} rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
