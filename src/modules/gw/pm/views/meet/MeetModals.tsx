import { useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { addDays } from '@/domain/pm/rules';
import { actCheck, meetCheck } from '@/domain/pm/meet';
import { PM_MEET_TYPES, type PmAction, type PmMeeting, type PmProject } from '@/domain/pm/schema';
import type { PmPerson } from '../../usePmPeople';

/**
 * 회의록 작성 · 수정 (mtForm 3317) · 액션 아이템 추가 · 수정 (actForm 3342) — 데모 칸 그대로 (새 칸 없음).
 */
const inp = 'w-full rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function F({ label, req, full, bad, help, children }: { label: string; req?: boolean; full?: boolean; bad?: boolean; help?: string; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${full ? 'sm:col-span-2' : ''}`}>
      <span>{label}{req && <span className="text-danger"> *</span>}</span>
      <div className={bad ? 'rounded ring-2 ring-danger' : ''}>{children}</div>
      {help && <small className="font-normal text-ink3">{help}</small>}
    </label>
  );
}
const Foot = ({ err, onDel, onClose, onSave, saveLabel }: { err: string; onDel?: () => void; onClose: () => void; onSave: () => void; saveLabel: string }) => (
  <div className="flex w-full items-center gap-2">
    {onDel && <Button variant="secondary" onClick={onDel}>삭제</Button>}
    <span className="flex-1 text-right text-[12px] font-bold text-danger" role="alert">{err}</span>
    <Button variant="secondary" onClick={onClose}>취소</Button>
    <Button onClick={onSave}>{saveLabel}</Button>
  </div>
);
const SiteSelect = ({ value, onChange, projects, shortOf, none }: { value: string; onChange: (v: string) => void; projects: readonly PmProject[]; shortOf: (id: string) => string; none: string }) => (
  <select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">{none}</option>
    {projects.map((p) => <option key={p.id} value={p.id}>{shortOf(p.id)}</option>)}
  </select>
);

export type MeetInput = Omit<PmMeeting, 'id' | 'by' | 'at'>;

/** 회의록 작성 · 수정 — 새로 쓸 때 '저장 후 액션 아이템 추가' (기본 켬) */
export function MeetFormModal({ m, defSite, me, today, projects, people, shortOf, nActs, onSave, onRemove, onClose }: {
  m: PmMeeting | null;
  defSite: string;
  me: string;
  today: string;
  projects: readonly PmProject[];
  people: readonly PmPerson[];
  shortOf: (id: string) => string;
  /** 이 회의에서 나온 액션 아이템 수 (삭제 확인) */
  nActs: number;
  onSave: (x: MeetInput, addAct: boolean) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !m;
  const [v, setV] = useState<MeetInput>(() => (m ? { ...m } : { projectId: defSite, type: '주간 회의', title: '', date: today, place: '', attIds: [me], ext: '', content: '', decision: '' }));
  const [addAct, setAddAct] = useState(true);
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof MeetInput>(k: K, x: MeetInput[K]) => setV((o) => ({ ...o, [k]: x }));
  const save = async () => {
    const e = meetCheck(v);
    if (e) { setErr(e); return; }
    await onSave({ ...v, title: v.title.trim() }, isNew && addAct);
  };
  const del = async () => {
    if (!confirm(`이 회의록을 삭제할까요?${nActs ? `\n연결된 액션 아이템 ${nActs}건은 남겨 둡니다.` : ''}`)) return;
    await onRemove();
  };
  const bad = (f: string) => err?.[1] === f;
  const tog = (id: string) => set('attIds', v.attIds.includes(id) ? v.attIds.filter((x) => x !== id) : [...v.attIds, id]);
  return (
    <Modal open onClose={onClose} width={720} title={isNew ? '회의록 작성' : '회의록 수정'}
      footer={<Foot err={err?.[0] ?? ''} onDel={isNew ? undefined : () => void del()} onClose={onClose} onSave={() => void save()} saveLabel="저장" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="사업"><SiteSelect value={v.projectId} onChange={(x) => set('projectId', x)} projects={projects} shortOf={shortOf} none="공통 (사업 무관)" /></F>
        <F label="회의 구분">
          <select className={inp} value={v.type} onChange={(e) => set('type', e.target.value)}>{[...new Set([...PM_MEET_TYPES, v.type])].map((x) => <option key={x}>{x}</option>)}</select>
        </F>
        <F label="회의명" req full bad={bad('title')}><input className={inp} value={v.title} placeholder="예: 신광 PLC 연동 범위 협의" onChange={(e) => set('title', e.target.value)} /></F>
        <F label="일자" req bad={bad('date')}><input type="date" className={inp} value={v.date} onChange={(e) => set('date', e.target.value)} /></F>
        <F label="장소"><input className={inp} value={v.place} placeholder="예: 도입기업 현장 회의실 / 화상" onChange={(e) => set('place', e.target.value)} /></F>
        <div className={`grid gap-1 text-[11.5px] font-bold text-ink2 sm:col-span-2 ${bad('attIds') ? 'rounded ring-2 ring-danger' : ''}`}>
          <span>참석자 (사내)<span className="text-danger"> *</span></span>
          <div className="flex max-h-[110px] flex-wrap gap-1.5 overflow-y-auto rounded border border-border p-2">
            {people.map((u) => (
              <label key={u.id} className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-normal ${v.attIds.includes(u.id) ? 'border-navy bg-blue-soft text-ink' : 'border-border text-ink2'}`}>
                <input type="checkbox" className="h-3 w-3" checked={v.attIds.includes(u.id)} onChange={() => tog(u.id)} />{u.label}
              </label>
            ))}
          </div>
        </div>
        <F label="외부 참석자" full><input className={inp} value={v.ext} placeholder="예: ㈜OO 생산팀장, 설비업체 담당" onChange={(e) => set('ext', e.target.value)} /></F>
        <F label="회의 내용" req full bad={bad('content')}><textarea className={`${inp} min-h-[90px]`} value={v.content} onChange={(e) => set('content', e.target.value)} /></F>
        <F label="결정 사항" full help="주간 보고서의 금주 회의 결정사항에 들어갑니다"><textarea className={`${inp} min-h-[70px]`} value={v.decision} onChange={(e) => set('decision', e.target.value)} /></F>
        {isNew && <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={addAct} onChange={(e) => setAddAct(e.target.checked)} />저장 후 액션 아이템 추가</label>}
      </div>
    </Modal>
  );
}

export type ActInput = Pick<PmAction, 'text' | 'whoId' | 'due' | 'projectId' | 'meetingId'>;

/** 액션 아이템 추가 · 수정 — 새로 쓸 때 '저장 후 하나 더 추가' (회의에서 열면 기본 켬), 수정이면 '완료' */
export function ActFormModal({ a, mt, defSite, me, today, projects, meetings, people, shortOf, onAdd, onUpdate, onRemove, onClose }: {
  a: PmAction | null;
  /** 출처 회의 (회의에서 [+ 액션] 으로 열면) */
  mt: PmMeeting | null;
  defSite: string;
  me: string;
  today: string;
  projects: readonly PmProject[];
  meetings: readonly PmMeeting[];
  people: readonly PmPerson[];
  shortOf: (id: string) => string;
  onAdd: (x: ActInput, more: boolean) => Promise<void>;
  onUpdate: (x: ActInput & { done: boolean }) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !a;
  const src = a ? meetings.find((x) => x.id === a.meetingId) ?? null : mt;
  const [v, setV] = useState<ActInput & { done: boolean }>(() => (a ? { ...a } : { text: '', whoId: me, due: addDays(today, 7), projectId: mt ? mt.projectId : defSite, meetingId: mt?.id ?? '', done: false }));
  const [more, setMore] = useState(!!mt);
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((o) => ({ ...o, [k]: x }));
  const ms = [...meetings].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  const save = async () => {
    const e = actCheck(v);
    if (e) { setErr(e); return; }
    const { done, ...x } = v;
    if (isNew) await onAdd({ ...x, text: x.text.trim() }, more);
    else await onUpdate({ ...x, text: x.text.trim(), done });
  };
  const bad = (f: string) => err?.[1] === f;
  return (
    <Modal open onClose={onClose} width={640} title={isNew ? '액션 아이템 추가' : '액션 아이템 수정'}
      footer={<Foot err={err?.[0] ?? ''} onDel={isNew ? undefined : () => void onRemove()} onClose={onClose} onSave={() => void save()} saveLabel="저장" />}>
      {src && <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2">회의: <b>{src.title}</b> ({src.date})</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="할 일" req full bad={bad('text')}><input className={inp} value={v.text} placeholder="예: 설비업체에 I/O 리스트 요청" onChange={(e) => set('text', e.target.value)} /></F>
        <F label="담당자" req bad={bad('whoId')}>
          <select className={inp} value={v.whoId} onChange={(e) => set('whoId', e.target.value)}>
            <option value="">-</option>
            {people.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </F>
        <F label="기한" req bad={bad('due')}><input type="date" className={inp} value={v.due} onChange={(e) => set('due', e.target.value)} /></F>
        <F label="사업"><SiteSelect value={v.projectId} onChange={(x) => set('projectId', x)} projects={projects} shortOf={shortOf} none="공통" /></F>
        <F label="출처 회의">
          <select className={inp} value={v.meetingId} onChange={(e) => set('meetingId', e.target.value)}>
            <option value="">-</option>
            {ms.map((x) => <option key={x.id} value={x.id}>{x.date} {trunc(x.title, 30)}</option>)}
          </select>
        </F>
        {isNew
          ? <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={more} onChange={(e) => setMore(e.target.checked)} />저장 후 하나 더 추가</label>
          : <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={v.done} onChange={(e) => set('done', e.target.checked)} />완료</label>}
      </div>
    </Modal>
  );
}
