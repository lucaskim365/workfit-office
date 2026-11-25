import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { addMonths, AGR_DOC, AGR_KINDS, agrCheck, agrJudge, GOV_FIX, GOV_HINT, GOV_WBS, govLinkTasks, isPre, type GovItem, type SiteCtx } from '@/domain/pm/site';
import { isDone, leftText, monthDay } from '@/domain/pm/rules';
import { PM_AGR_STATES, type PmAgreementChange, type PmFixItem, type PmGovRecord } from '@/domain/pm/schema';
import type { PmPerson } from '../../usePmPeople';
import { EmptyHint, Tag } from '../wbs/parts';

/**
 * 사업별 화면 팝업 — 점검 결과 기록(govResModal) · 지적 사항(govItemsModal) · 필수 TASK 연결(govLinkModal) ·
 * 필수 TASK 일정(govDateModal) · 협약변경 기록(agrForm). 데모 칸 그대로 (새 칸 없음).
 */

const inp = 'rounded border border-border bg-panel px-2 py-1 text-[12px] text-ink';
const FIX_TONE = { '조치 전': 'warn', '조치 완료': 'run', 확인: 'ok' } as const;
let gi = 0;
const newFixId = () => `GI${Date.now().toString(36)}${(++gi).toString(36)}`;

/** 이 사업 참여자(업무 담당 · PM)를 먼저, 나머지는 '그 외' (giWhoOpts) */
function WhoSelect({ c, people, value, onChange }: { c: SiteCtx; people: PmPerson[]; value: string; onChange: (v: string) => void }) {
  const ids = new Set<string>();
  c.ts.forEach((t) => t.assigneeIds.forEach((x) => ids.add(x)));
  if (c.p.pmUserId) ids.add(c.p.pmUserId);
  const mem = people.filter((u) => ids.has(u.id));
  const rest = people.filter((u) => !ids.has(u.id));
  const opt = (u: PmPerson) => <option key={u.id} value={u.id}>{u.label}</option>;
  return (
    <select className={`${inp} w-[150px] flex-none`} value={value} onChange={(e) => onChange(e.target.value)} aria-label="조치 담당">
      {mem.length ? (
        <>
          <optgroup label={`이 사업 참여자 ${mem.length}명`}>{mem.map(opt)}</optgroup>
          <optgroup label="그 외">{rest.map(opt)}</optgroup>
        </>
      ) : people.map(opt)}
    </select>
  );
}

/** 점검 · 감리 결과 기록 (govResModal) — 판정 · 통보일 · 메모. 보완이면 후속 기한 + 지적 사항 */
export function GovResultModal({ c, g, short, people, me, onSave, onRemove, onClose }: {
  c: SiteCtx;
  g: GovItem;
  short: string;
  people: PmPerson[];
  me: string;
  onSave: (x: { v: string; date: string; memo: string; fix: string; items: Array<{ id: string; text: string; whoId: string }> }) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const r = c.gov.get(g.id);
  const F = GOV_FIX[g.id];
  const [v, setV] = useState(r?.v ?? '');
  const [date, setDate] = useState(r?.date || c.today);
  const [fix, setFix] = useState(r?.fix || (F?.[1] ? F[1](c.p) : ''));
  const [memo, setMemo] = useState(r?.memo ?? '');
  const [items, setItems] = useState<Array<{ id: string; text: string; whoId: string; st?: PmFixItem['st'] }>>(r?.items.map((x) => ({ id: x.id, text: x.text, whoId: x.whoId, st: x.st })) ?? []);
  const [err, setErr] = useState('');
  const isFix = !!F && v === '보완';
  const save = async () => {
    if (!v) { setErr('판정을 고르세요'); return; }
    if (isFix && !fix) { setErr('↑ 통보 공문에 적힌 보완 기한을 넣어야 저장됩니다'); return; }
    await onSave({ v, date: date || c.today, memo, fix: isFix ? fix : '', items: isFix ? items : [] });
    onClose();
  };
  const del = async () => { await onRemove(); onClose(); };
  return (
    <Modal open onClose={onClose} width={640} title={`${short} · 점검 결과 기록`}
      footer={(
        <>
          {r?.v && <Button variant="secondary" onClick={() => void del()}>기록 지우기</Button>}
          {err && <span className="text-[11.5px] font-bold text-danger">{err}</span>}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={() => void save()}>저장</Button>
        </>
      )}>
      <div className="space-y-3 text-[12.5px]">
        <div><b className="text-ink">{g.t}</b><div className="text-[11.5px] text-ink3">{g.dueTxt} · 세부관리기준 {g.law}</div></div>
        <div>
          <div className="mb-1 text-[11.5px] text-ink3">판정</div>
          <div className="flex gap-1.5">{(g.res ?? []).map((x) => <Button key={x} size="sm" variant={v === x ? 'primary' : 'secondary'} onClick={() => { setV(x); setErr(''); }}>{x}</Button>)}</div>
        </div>
        {!isFix && <label className="block text-[11.5px] text-ink3">판정을 통보받은 날 <input type="date" className={`${inp} ml-1.5`} value={date} onChange={(e) => setDate(e.target.value)} /></label>}
        {isFix && (
          <div className="space-y-2">
            <label className="block text-[11.5px] text-ink3">{F[0]} <input type="date" className={`${inp} ml-1.5 ${err && !fix ? 'border-danger' : ''}`} value={fix} onChange={(e) => { setFix(e.target.value); setErr(''); }} /></label>
            <div className="text-[11px] text-ink3">{F[2]}</div>
            <div className="pt-1 text-[11.5px] text-ink3">지적 사항 — 건마다 조치 담당자를 정합니다 <span className="text-ink3">(담당자에게 가는 알림은 🔔 알림을 옮길 때 3-7)</span></div>
            {items.map((it, i) => (
              <div key={it.id} className="flex items-center gap-1.5">
                <input className={`${inp} min-w-0 flex-1`} value={it.text} placeholder="예: 생산실적 화면에 실데이터 미입력" onChange={(e) => setItems((a) => a.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <WhoSelect c={c} people={people} value={it.whoId} onChange={(w) => setItems((a) => a.map((x, j) => (j === i ? { ...x, whoId: w } : x)))} />
                {it.st && it.st !== '조치 전' && <Tag tone={FIX_TONE[it.st]}>{it.st}</Tag>}
                <Button size="sm" variant="secondary" onClick={() => setItems((a) => a.filter((_, j) => j !== i))}>지우기</Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setItems((a) => [...a, { id: newFixId(), text: '', whoId: me }])}>+ 지적 사항 추가</Button>
          </div>
        )}
        <div>
          <div className="mb-1 text-[11.5px] text-ink3">메모 (보완 · 지적 사항 등)</div>
          <textarea className={`${inp} min-h-[64px] w-full`} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        {GOV_HINT[g.id] && <div className="text-[11px] text-ink3">※ {GOV_HINT[g.id]}</div>}
      </div>
    </Modal>
  );
}

/** 보완 지적 사항 (govItemsModal) — 담당자 [조치 완료] → PM [확인] 또는 [반려] */
export function FixItemsModal({ c, g, fol, r, short, nameOf, onAct, onEdit, onClose }: {
  c: SiteCtx;
  g: GovItem;
  /** 후속 기한 (조치 기한) */
  fol: GovItem | undefined;
  r: PmGovRecord;
  short: string;
  nameOf: (id: string) => string;
  onAct: (fixId: string, action: '조치 완료' | '확인' | '반려' | '조치 전', note: string) => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
}) {
  const L = r.items;
  const cnt = (st: string) => L.filter((x) => x.st === st).length;
  const [ask, setAsk] = useState<{ id: string; a: '조치 완료' | '반려'; note: string; err?: string } | null>(null);
  const go = async (id: string, a: '조치 완료' | '확인' | '반려' | '조치 전', note = '') => {
    if (a === '반려' && !note.trim()) { setAsk((x) => (x ? { ...x, err: '반려 사유를 적어 주세요' } : x)); return; }
    await onAct(id, a, note);
    setAsk(null);
  };
  return (
    <Modal open onClose={onClose} width={760} title={`${short} · 보완 지적 사항 ${L.length}건`}
      footer={<><Button variant="secondary" onClick={onEdit}>지적 사항 고치기</Button><span className="flex-1" /><Button variant="secondary" onClick={onClose}>닫기</Button></>}>
      <div className="mb-2.5 text-[12.5px]">
        <b className="text-ink">{g.t}</b> <Tag tone="warn">보완 · {monthDay(r.date)}</Tag>
        {fol && <span className="ml-1 text-[11.5px] text-ink3">조치 기한 {fol.due ? `${monthDay(fol.due)} · ${leftText(fol.due, c.today)}` : "미정"}</span>}
        <div className="text-[11.5px] text-ink3">조치 전 {cnt('조치 전')} · 조치 완료(확인 대기) {cnt('조치 완료')} · 확인 {cnt('확인')}</div>
      </div>
      {L.length ? (
        <table className="w-full text-[12px]">
          <thead><tr className="border-b border-border text-left text-[11px] text-ink3"><th className="py-1.5">지적 사항</th><th>조치 담당</th><th>상태</th><th /></tr></thead>
          <tbody>
            {L.map((it) => {
              const h = it.hist[it.hist.length - 1];
              return (
                <tr key={it.id} className="border-b border-border align-top">
                  <td className="py-2 pr-2">{it.text}{h?.note && <div className="text-[11px] text-ink3">{h.a} · {h.note}</div>}
                    {ask?.id === it.id && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input autoFocus className={`${inp} min-w-0 flex-1`} placeholder={ask.a === '반려' ? '반려 사유 (담당자에게 보입니다)' : '조치 내용 (선택)'} value={ask.note} onChange={(e) => setAsk({ ...ask, note: e.target.value, err: '' })} />
                        <Button size="sm" onClick={() => void go(it.id, ask.a, ask.note)}>{ask.a}</Button>
                        <Button size="sm" variant="secondary" onClick={() => setAsk(null)}>취소</Button>
                      </div>
                    )}
                    {ask?.id === it.id && ask.err && <div className="text-[11px] font-bold text-danger">{ask.err}</div>}
                  </td>
                  <td className="whitespace-nowrap pr-2 text-[11.5px]">{nameOf(it.whoId) || '-'}</td>
                  <td className="whitespace-nowrap pr-2"><Tag tone={FIX_TONE[it.st]}>{it.st}</Tag>{h && <div className="text-[10.5px] text-ink3">{monthDay(h.date)} {nameOf(h.by)}</div>}</td>
                  <td className="whitespace-nowrap text-right">
                    {it.st === '조치 전' && <Button size="sm" onClick={() => setAsk({ id: it.id, a: '조치 완료', note: '' })}>조치 완료</Button>}
                    {it.st === '조치 완료' && <><Button size="sm" onClick={() => void go(it.id, '확인')}>확인</Button> <Button size="sm" variant="secondary" onClick={() => setAsk({ id: it.id, a: '반려', note: '' })}>반려</Button></>}
                    {it.st === '확인' && <Button size="sm" variant="secondary" onClick={() => void go(it.id, '조치 전')}>되돌리기</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <EmptyHint title="등록된 지적 사항이 없습니다" hint="[지적 사항 고치기]에서 추가하세요." />}
      <div className="mt-2 text-[11px] text-ink3">※ 담당자가 [조치 완료] → PM이 [확인] 또는 [반려]. 모두 확인되면 재점검 결과를 기록하세요.</div>
    </Modal>
  );
}

/** [바꾸기] 관리기준 필수 TASK 연결 (govLinkModal) — 여러 개 가능 · 자동으로 되돌리기 */
export function GovLinkModal({ c, itemId, short, onSave, onClose }: {
  c: SiteCtx;
  itemId: string;
  short: string;
  onSave: (taskIds: string[] | null) => Promise<void>;
  onClose: () => void;
}) {
  const r = GOV_WBS.find((x) => x.id === itemId)!;
  const [sel, setSel] = useState<Set<string>>(() => new Set(govLinkTasks(c, r).map((t) => t.id)));
  const [q, setQ] = useState('');
  const ts = c.ts.filter((t) => !isPre(t) && (!q.trim() || `${t.code} ${t.name} ${t.output}`.includes(q.trim())));
  const man = c.govLink.has(itemId);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const done = async (ids: string[] | null) => { await onSave(ids); onClose(); };
  return (
    <Modal open onClose={onClose} width={720} title={`${short} · ${r.short} — 연결할 업무`}
      footer={<><Button variant="secondary" onClick={() => void done(null)}>자동으로 되돌리기</Button><span className="flex-1" /><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={() => void done([...sel])}>저장</Button></>}>
      <div className="mb-2 text-[12px] text-ink3">{r.t}. 이 일을 하는 업무를 모두 고르세요 (묶인 업무도 됩니다).</div>
      <input className={`${inp} mb-2 w-full`} placeholder="업무 이름 · 번호 · 산출물로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
        {ts.length ? ts.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-center gap-2 border-b border-border px-2.5 py-1.5 text-[12px] last:border-b-0 hover:bg-panel-alt">
            <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
            <span className="w-[44px] flex-none text-ink3">{t.code}</span>
            <span className="min-w-0 flex-1 text-ink">{t.name}{t.output && <span className="text-ink3"> · {t.output}</span>}</span>
            <span className="flex-none text-ink3">{t.end ? monthDay(t.end) : '날짜 없음'}</span>
          </label>
        )) : <div className="p-4"><EmptyHint title="찾는 업무가 없습니다" /></div>}
      </div>
      <div className="mt-1.5 text-[11px] text-ink3">{man ? '지금은 직접 고른 연결입니다.' : "지금은 자동 연결입니다. 아무것도 안 고르고 저장하면 '연결 없음'으로 확정됩니다."} (검색으로 가려진 업무의 체크도 그대로 남습니다)</div>
    </Modal>
  );
}

/** [일정] 연결된 업무의 시작일 · 종료일 (govDateModal) — 업무 목록 수정과 같게 변경 이력 · 티켓 반영 */
export function GovDateModal({ c, itemId, short, onSave, onClose }: {
  c: SiteCtx;
  itemId: string;
  short: string;
  onSave: (items: Array<{ id: string; start: string; end: string }>) => Promise<number>;
  onClose: () => void;
}) {
  const r = GOV_WBS.find((x) => x.id === itemId)!;
  const ts = govLinkTasks(c, r);
  const [v, setV] = useState(() => Object.fromEntries(ts.map((t) => [t.id, { start: t.start, end: t.end }])));
  const [err, setErr] = useState('');
  const ref = itemId === 'g_mid' && c.p.start ? `규정: 협약 후 3개월 이내 (${monthDay(addMonths(c.p.start, 3))}) · 운영기관 일정에 맞춰 바꾸면 기한 목록의 중간점검 날짜도 따라 바뀝니다` : '';
  const save = async () => {
    for (const t of ts) {
      const x = v[t.id];
      if (!x.start || !x.end) { setErr('시작일과 종료일을 모두 넣어 주세요'); return; }
      if (x.end < x.start) { setErr('종료일은 시작일 이후여야 합니다'); return; }
    }
    await onSave(ts.map((t) => ({ id: t.id, ...v[t.id] })));
    onClose();
  };
  return (
    <Modal open onClose={onClose} width={640} title={`${short} · ${r.short} 일정`}
      footer={<>{err && <span className="text-[11.5px] font-bold text-danger">{err}</span>}<span className="flex-1" /><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={() => void save()}>저장</Button></>}>
      {ref && <div className="mb-2.5 text-[12px] text-ink3">{ref}</div>}
      {ts.map((t) => (
        <div key={t.id} className="border-b border-border py-2 text-[12.5px]">
          <div><span className="text-ink3">{t.code}</span> {t.name}{isDone(c.live(t)) && <> <Tag tone="ok">완료</Tag></>}</div>
          <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink2">
            <label>시작일 <input type="date" className={inp} value={v[t.id].start} onChange={(e) => { setV({ ...v, [t.id]: { ...v[t.id], start: e.target.value } }); setErr(''); }} /></label>
            <label>종료일 <input type="date" className={inp} value={v[t.id].end} onChange={(e) => { setV({ ...v, [t.id]: { ...v[t.id], end: e.target.value } }); setErr(''); }} /></label>
            {!t.end && <Tag tone="warn">날짜 없음</Tag>}
          </div>
        </div>
      ))}
      <div className="mt-2 text-[11px] text-ink3">※ 업무 목록의 그 업무 일정이 바뀝니다 (변경 이력에 남음).</div>
    </Modal>
  );
}

/** 협약변경 기록 · 수정 (agrForm) — 종류를 고르면 승인/등록을 자동 판단 */
export function AgreementModal({ c, x, short, onSave, onRemove, onClose }: {
  c: SiteCtx;
  /** 없으면 새 기록 */
  x: PmAgreementChange | null;
  short: string;
  onSave: (x: PmAgreementChange) => Promise<string>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const from = x?.from ?? c.p.end;
  const [v, setV] = useState<PmAgreementChange>(() => x ?? {
    id: `AG${Date.now().toString(36)}`, projectId: c.p.id, date: c.today, kind: 'ext', from: c.p.end, to: '', text: '', why: '', st: '준비 중', by: '', applied: false,
  });
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = (p: Partial<PmAgreementChange>) => { setV({ ...v, ...p }); setErr(null); };
  const j = agrJudge(v.kind, from, v.to);
  const save = async () => {
    const e = agrCheck({ kind: v.kind, to: v.to, why: v.why, date: v.date }, from);
    if (e) { setErr(e); return; }
    const changed = await onSave({ ...v, from });
    if (changed) alert(`협약 종료일을 ${changed}로 바꿨습니다 (${j}) — 관리기준 기한도 다시 계산됩니다`);
    onClose();
  };
  const del = async () => {
    if (!x || !confirm('이 협약변경 기록을 지울까요? (이미 바뀐 협약 종료일은 그대로 둡니다)')) return;
    await onRemove(x.id);
    onClose();
  };
  const bad = (k: string) => (err?.[1] === k ? 'border-danger' : '');
  return (
    <Modal open onClose={onClose} width={620} title={`${short} · 협약변경 ${x ? '수정' : '기록'}`}
      footer={<>{x && <Button variant="secondary" onClick={() => void del()}>지우기</Button>}{err && <span className="text-[11.5px] font-bold text-danger">{err[0]}</span>}<span className="flex-1" /><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={() => void save()}>저장</Button></>}>
      <div className="mb-3 rounded-lg border border-blue/20 bg-blue-soft px-3 py-2 text-[12px] text-ink2">
        협약 종료일 <b>{from || '-'}</b>. 종류를 고르면 승인이 필요한지 자동으로 판단합니다.
        <div>· 승인: {AGR_DOC.승인}</div><div>· 등록: {AGR_DOC.등록}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px]">
        <label className="col-span-2 block"><span className="mb-0.5 block text-[11.5px] font-bold text-ink2">변경 종류 *</span>
          <select className={`${inp} w-full`} value={v.kind} onChange={(e) => set({ kind: e.target.value })}>
            {AGR_KINDS.map((y) => <option key={y[0]} value={y[0]}>{y[1]}{y[2] ? ` — ${y[2]}` : ' — 3개월 이상이면 승인'}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-0.5 block text-[11.5px] font-bold text-ink2">새 협약 종료일</span>
          <input type="date" className={`${inp} w-full ${bad('to')}`} value={v.to} disabled={v.kind !== 'ext'} onChange={(e) => set({ to: e.target.value })} />
          <span className="text-[10.5px] text-ink3">구축기간 연장일 때만</span>
        </label>
        <label className="block"><span className="mb-0.5 block text-[11.5px] font-bold text-ink2">기록일 *</span>
          <input type="date" className={`${inp} w-full ${bad('date')}`} value={v.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="col-span-2 block"><span className="mb-0.5 block text-[11.5px] font-bold text-ink2">변경 내용</span>
          <input className={`${inp} w-full`} value={v.text} placeholder="예: 정 담당 이철희 → 전정재 (투입률 동일)" onChange={(e) => set({ text: e.target.value })} />
        </label>
        <label className="col-span-2 block"><span className="mb-0.5 block text-[11.5px] font-bold text-ink2">사유 *</span>
          <input className={`${inp} w-full ${bad('why')}`} value={v.why} placeholder="예: 비전 카메라 납품 지연 (H/W 조달)" onChange={(e) => set({ why: e.target.value })} />
        </label>
        <label className="block"><span className="mb-0.5 block text-[11.5px] font-bold text-ink2">진행 상태 *</span>
          <select className={`${inp} w-full`} value={v.st} onChange={(e) => set({ st: e.target.value as PmAgreementChange['st'] })}>{PM_AGR_STATES.map((y) => <option key={y}>{y}</option>)}</select>
        </label>
        <div className="self-end pb-1 text-[12px]">판정 <Tag tone={j === '승인' ? 'bad' : 'plain'}>{j}</Tag></div>
      </div>
    </Modal>
  );
}
