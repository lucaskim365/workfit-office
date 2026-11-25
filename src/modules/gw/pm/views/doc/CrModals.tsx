import { useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { dday } from '@/domain/pm/site';
import { crConflict } from '@/domain/pm/cr';
import { PM_CR_CATS, PM_CR_PRIOS, type PmChangeRequest, type PmProject, type PmTask } from '@/domain/pm/schema';

/**
 * 요구사항(CR) 창 — 접수 · 수정 (crForm 3044) · 검토 · 승인 (crReview 3076). 데모 칸 그대로 (새 칸 없음).
 */
const inp = 'w-full rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function F({ label, req, full, bad, children }: { label: string; req?: boolean; full?: boolean; bad?: boolean; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${full ? 'sm:col-span-2' : ''}`}>
      <span>{label}{req && <span className="text-danger"> *</span>}</span>
      <div className={bad ? 'rounded ring-2 ring-danger' : ''}>{children}</div>
    </label>
  );
}

export type CrInput = Pick<PmChangeRequest, 'projectId' | 'cat' | 'title' | 'desc' | 'req' | 'date' | 'prio' | 'days' | 'cost'>;

/** CR 접수 · 수정 (crForm) — 접수하면 검토중, 수정은 접수 칸만 */
export function CrFormModal({ c, projects, shortOf, defSite, today, onSave, onRemove, onClose }: {
  c: PmChangeRequest | null;
  projects: readonly PmProject[];
  shortOf: (id: string) => string;
  defSite: string;
  today: string;
  onSave: (x: CrInput) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !c;
  const [v, setV] = useState<Record<keyof CrInput, string>>(() => ({
    projectId: c?.projectId ?? defSite, cat: c?.cat ?? '기능 추가', title: c?.title ?? '', desc: c?.desc ?? '', req: c?.req ?? '',
    date: c?.date ?? today, prio: c?.prio ?? '보통', days: String(c?.days ?? 0), cost: String(c?.cost ?? 0),
  }));
  const [err, setErr] = useState<{ f: string; msg: string } | null>(null);
  const set = (k: keyof CrInput, x: string) => setV((o) => ({ ...o, [k]: x }));
  const save = async () => {
    const fail = (f: string, msg: string) => setErr({ f, msg });
    if (!v.projectId) return fail('projectId', '사업을 골라 주세요');
    if (!v.title.trim()) return fail('title', '요구사항 제목을 입력해 주세요');
    if (!v.req.trim()) return fail('req', '요청자를 입력해 주세요');
    if (!v.date) return fail('date', '요청일을 입력해 주세요');
    for (const k of ['days', 'cost'] as const) if (v[k].trim() === '' || !(+v[k] >= 0)) return fail(k, `${k === 'days' ? '일정 영향' : '비용 영향'}은 0 이상 숫자로 넣어 주세요`);
    await onSave({ projectId: v.projectId, cat: v.cat, title: v.title.trim(), desc: v.desc.trim(), req: v.req.trim(), date: v.date, prio: v.prio, days: +v.days, cost: +v.cost });
    onClose();
  };
  const del = async () => {
    if (!c || !confirm(`${c.id}를 삭제할까요?`)) return;
    await onRemove();
    onClose();
  };
  const bad = (f: string) => err?.f === f;
  return (
    <Modal open onClose={onClose} width={680} title={isNew ? '요구사항 변경(CR) 접수' : `CR 수정 — ${c.id}`}
      footer={(
        <div className="flex w-full items-center gap-2">
          {!isNew && <Button variant="secondary" onClick={() => void del()}>삭제</Button>}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={() => void save()}>{isNew ? '접수' : '저장'}</Button>
        </div>
      )}>
      {isNew && <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2">접수하면 <b>검토중</b> 상태로 등록되고, PM이 일정 · 비용 영향도를 검토해 승인 / 반려합니다. 승인하면 업무 목록에 업무로 추가할 수 있습니다.</p>}
      {!isNew && c.status !== '검토중' && <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2"><b>{c.status}</b> · 검토 의견: {c.comment || '-'}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="사업" req bad={bad('projectId')}>
          <select className={inp} value={v.projectId} onChange={(e) => set('projectId', e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{shortOf(p.id)}</option>)}
          </select>
        </F>
        <F label="변경 분류">
          <select className={inp} value={v.cat} onChange={(e) => set('cat', e.target.value)}>{PM_CR_CATS.map((x) => <option key={x}>{x}</option>)}</select>
        </F>
        <F label="요구사항 제목" req full bad={bad('title')}><input className={inp} value={v.title} onChange={(e) => set('title', e.target.value)} /></F>
        <F label="상세 내용 / 요청 사유" full><textarea className={`${inp} min-h-[80px]`} value={v.desc} onChange={(e) => set('desc', e.target.value)} /></F>
        <F label="요청자" req bad={bad('req')}><input className={inp} value={v.req} placeholder="도입기업 담당자 이름/직책" onChange={(e) => set('req', e.target.value)} /></F>
        <F label="요청일" req bad={bad('date')}><input type="date" className={inp} value={v.date} onChange={(e) => set('date', e.target.value)} /></F>
        <F label="우선순위">
          <select className={inp} value={v.prio} onChange={(e) => set('prio', e.target.value)}>{PM_CR_PRIOS.map((x) => <option key={x}>{x}</option>)}</select>
        </F>
        <div className="mt-1 border-b border-border pb-1 text-[12px] font-bold text-navy sm:col-span-2">영향도 평가 (예상)</div>
        <F label="일정 영향 (일)" req bad={bad('days')}><input type="number" min={0} className={inp} value={v.days} onChange={(e) => set('days', e.target.value)} /></F>
        <F label="비용 영향 (만원)" req bad={bad('cost')}><input type="number" min={0} className={inp} value={v.cost} onChange={(e) => set('cost', e.target.value)} /></F>
      </div>
      {err && <p className="mt-3 text-[12px] font-bold text-danger">{err.msg}</p>}
    </Modal>
  );
}

/** CR 검토 · 승인 (crReview) — 결과 · 의견(필수) · 승인 뒤 업무 추가 창 열기 */
export function CrReviewModal({ c, company, nextMs, today, onSave, onClose }: {
  c: PmChangeRequest;
  company: string;
  nextMs: PmTask | null;
  today: string;
  onSave: (x: { decision: '승인' | '반려'; comment: string; makeTask: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState<'승인' | '반려'>('승인');
  const [comment, setComment] = useState('');
  const [makeTask, setMakeTask] = useState(true);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!comment.trim()) { setErr('검토 의견을 적어 주세요 (감리 때 근거 자료)'); return; }
    await onSave({ decision, comment: comment.trim(), makeTask });
  };
  const risk = crConflict(nextMs, c.days, today);
  return (
    <Modal open onClose={onClose} width={680} title={`CR 검토 · 승인 — ${c.id}`}
      footer={<div className="flex w-full justify-end gap-2"><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={() => void save()}>검토 완료</Button></div>}>
      <div className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] leading-relaxed text-ink2">
        <b className="text-ink">{company}</b> · {c.title}<br />
        요청자 {c.req || '-'} · {c.date} · 일정 <b>+{c.days}일</b> · 비용 <b>+{c.cost.toLocaleString()}만원</b>
        {nextMs && <><br />다음 마일스톤: {trunc(nextMs.name, 30)} {nextMs.end || '날짜 없음'}{nextMs.end ? ` (${dday(nextMs.end, today)})` : ''}{risk && <b className="text-danger"> — 반영 시 일정 충돌 위험</b>}</>}
      </div>
      <div className="grid gap-3">
        <F label="검토 결과" req>
          <select className={inp} value={decision} onChange={(e) => setDecision(e.target.value as '승인' | '반려')}><option>승인</option><option>반려</option></select>
        </F>
        <F label="검토 의견" req bad={!!err}><textarea className={`${inp} min-h-[80px]`} value={comment} placeholder="승인/반려 사유 (감리 시 근거 자료)" onChange={(e) => setComment(e.target.value)} /></F>
        <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={makeTask} onChange={(e) => setMakeTask(e.target.checked)} />승인 후 업무 추가 화면 열기</label>
      </div>
      {err && <p className="mt-3 text-[12px] font-bold text-danger">{err}</p>}
    </Modal>
  );
}
