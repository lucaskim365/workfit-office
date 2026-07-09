import { useMemo, useState } from 'react';
import { useApprovalForms, useUpsertApprovalForm, useRemoveApprovalForm } from '@/features/gw/useApprovalForms';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { FIELD_TYPES, RESERVED_BODY_KEY, amountFieldOf, type ApprovalForm, type FormField, type FieldType, type FieldValue } from '@/domain/approvalForm/schema';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { DynamicField } from '@/modules/gw/approval/formFields';
import { ApprovalDocumentView } from '@/modules/gw/approval/ApprovalDocumentView';

/**
 * 결재서식 관리 (기준정보) — 문서 서식 CRUD + 필드 빌더 + 미리보기(상신폼/인쇄).
 * 코드 수정 없이 결재 문서유형을 추가·편집·삭제·디자인. ([[dynamic-route-engine]] 동형 패턴)
 * (docs/결재서식_문서관리_개발_계획서.md)
 */

const blankField = (): FormField => ({
  key: '', label: '', type: '텍스트', required: false, options: [], placeholder: '', width: 'full', section: '', isAmountKey: false,
});

const blankForm = (): ApprovalForm => ({
  id: '', code: '', name: '', icon: '📄', docTitle: '', closing: '', active: true, order: 99, system: false,
  fields: [{ ...blankField(), key: 'body', label: '본문', type: '장문', required: true }],
});

export default function ApprovalFormScreen() {
  const { data: forms = [], isLoading } = useApprovalForms();
  const upsert = useUpsertApprovalForm();
  const remove = useRemoveApprovalForm();
  const [sel, setSel] = useState<ApprovalForm | null>(null);
  const [msg, setMsg] = useState('');

  const save = async () => {
    if (!sel) return;
    if (!sel.code.trim()) return setMsg('코드를 입력하세요.');
    if (!sel.name.trim()) return setMsg('서식명을 입력하세요.');
    await upsert.mutateAsync({ ...sel, id: sel.code.trim() });
    setMsg('저장되었습니다 — 상신·인쇄에 즉시 반영됩니다.');
    setSel(null);
  };
  const del = async (form: ApprovalForm) => {
    if (form.system) return;
    await remove.mutateAsync(form.id);
    if (sel?.id === form.id) setSel(null);
  };
  const duplicate = (form: ApprovalForm) => {
    setSel({ ...form, id: '', code: `${form.code}_사본`, name: `${form.name} 사본`, system: false, order: 99 });
    setMsg('');
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">결재서식 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 결재서식 관리 · 전자결재 문서 양식(유형·필드·격식) 디자인</p>
        </div>
        <button onClick={() => { setSel(blankForm()); setMsg(''); }} className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90">+ 서식 추가</button>
      </div>

      <div className="grid grid-cols-[280px_1fr] items-start gap-3.5">
        {/* 서식 목록 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-3.5 py-2.5 text-[11.5px] font-bold text-ink2">서식 목록 <span className="text-ink3">· {forms.length}</span></div>
          {isLoading && <div className="py-8 text-center text-[12px] text-ink3">불러오는 중…</div>}
          {forms.map((f) => (
            <button key={f.id} onClick={() => { setSel(f); setMsg(''); }} className={`flex w-full items-center gap-2 border-b border-border px-3.5 py-2.5 text-left ${sel?.id === f.id ? 'bg-teal-soft/60' : 'hover:bg-panel-alt'}`}>
              <span className="text-[16px]">{f.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-semibold text-ink">{f.name}</span>
                  {f.system && <span className="rounded bg-ink3/15 px-1 text-[9px] font-bold text-ink3">기본</span>}
                  {!f.active && <span className="text-[9.5px] text-ink3">중지</span>}
                </span>
                <span className="block text-[10.5px] text-ink3">{f.code} · {f.fields.length}필드</span>
              </span>
            </button>
          ))}
        </div>

        {/* 편집기 + 미리보기 */}
        <div className="rounded-xl border border-border bg-panel p-4">
          {sel ? (
            <FormEditor form={sel} onChange={setSel} onSave={save} onCancel={() => setSel(null)}
              onDelete={sel.system || !sel.id ? undefined : () => del(sel)} onDuplicate={sel.id ? () => duplicate(sel) : undefined}
              saving={upsert.isPending} msg={msg} />
          ) : (
            <div className="py-20 text-center text-[12px] text-ink3">좌측에서 서식을 선택하거나 추가하세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormEditor({ form, onChange, onSave, onCancel, onDelete, onDuplicate, saving, msg }: {
  form: ApprovalForm; onChange: (f: ApprovalForm) => void; onSave: () => void; onCancel: () => void;
  onDelete?: () => void; onDuplicate?: () => void; saving: boolean; msg: string;
}) {
  const set = (patch: Partial<ApprovalForm>) => onChange({ ...form, ...patch });
  const setField = (i: number, patch: Partial<FormField>) => {
    let nextFields = form.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));

    set({ fields: nextFields });
  };
  const addField = () => set({ fields: [...form.fields, { ...blankField(), key: `field${form.fields.length + 1}` }] });
  const delField = (i: number) => set({ fields: form.fields.filter((_, idx) => idx !== i) });
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= form.fields.length) return;
    const next = [...form.fields]; [next[i], next[j]] = [next[j], next[i]]; set({ fields: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-ink">{form.id ? `서식 편집 · ${form.code}` : '새 서식'}{form.system && <span className="ml-2 text-[10px] font-normal text-amber-600">(기본 서식 · 양식 잠금)</span>}</div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink2"><input type="checkbox" checked={form.active} disabled={form.system} onChange={(e) => set({ active: e.target.checked })} /> 사용</label>
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-4 gap-2">
        <F label="아이콘"><input value={form.icon} disabled={form.system} onChange={(e) => set({ icon: e.target.value })} className={`${inp} disabled:opacity-60`} /></F>
        <F label="서식명"><input value={form.name} disabled={form.system} onChange={(e) => set({ name: e.target.value })} placeholder="출장신청서" className={`${inp} disabled:opacity-60`} /></F>
        <F label="코드(문서유형)"><input value={form.code} disabled={form.system} onChange={(e) => set({ code: e.target.value })} placeholder="출장" className={`${inp} disabled:opacity-60`} /></F>
        <F label="정렬"><input type="number" value={form.order} disabled={form.system} onChange={(e) => set({ order: Number(e.target.value) })} className={`${inp} disabled:opacity-60`} /></F>
        <div className="col-span-2"><F label="격식 문서명(인쇄)"><input value={form.docTitle} disabled={form.system} onChange={(e) => set({ docTitle: e.target.value })} placeholder="출 장 신 청 서" className={`${inp} disabled:opacity-60`} /></F></div>
        <div className="col-span-2"><F label="맺음말(인쇄)"><input value={form.closing} disabled={form.system} onChange={(e) => set({ closing: e.target.value })} placeholder="위와 같이 신청하오니 재가하여 주시기 바랍니다." className={`${inp} disabled:opacity-60`} /></F></div>
      </div>

      {/* 필드 빌더 */}
      <div>
        <div className="mb-1.5 text-[11px] font-bold text-ink2">입력 필드</div>
        <div className="space-y-1.5">
          {form.fields.map((f, i) => (
            <div key={i} className="rounded-lg border border-border bg-panel-alt px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-soft text-[10px] font-bold text-teal">{i + 1}</span>
                <input value={f.label} disabled={form.system} onChange={(e) => setField(i, { label: e.target.value })} placeholder="라벨" className="w-28 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none disabled:opacity-60" />
                <input value={f.key} disabled={form.system} onChange={(e) => setField(i, { key: e.target.value })} placeholder="key" className="w-20 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] font-mono text-ink outline-none disabled:opacity-60" />
                <select value={f.type} disabled={form.system} onChange={(e) => setField(i, { type: e.target.value as FieldType })} className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none disabled:opacity-60">
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={f.width} disabled={form.system} onChange={(e) => setField(i, { width: e.target.value as 'half' | 'full' })} className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none disabled:opacity-60">
                  <option value="full">전체</option><option value="half">2열</option>
                </select>
                <input value={f.section} disabled={form.system} onChange={(e) => setField(i, { section: e.target.value })} placeholder="섹션" className="w-16 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none disabled:opacity-60" />
                <label className="flex items-center gap-0.5 text-[10px] text-ink3"><input type="checkbox" checked={f.required} disabled={form.system} onChange={(e) => setField(i, { required: e.target.checked })} className="h-3 w-3" />필수</label>
                {f.type === '금액' && <label className="flex items-center gap-0.5 text-[10px] text-ink3"><input type="checkbox" checked={f.isAmountKey} disabled={form.system} onChange={(e) => setField(i, { isAmountKey: e.target.checked })} className="h-3 w-3" />금액키</label>}
                {!form.system && (
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => moveField(i, -1)} className="text-[9px] text-ink3 hover:text-ink">▲</button>
                    <button onClick={() => moveField(i, 1)} className="text-[9px] text-ink3 hover:text-ink">▼</button>
                    <button onClick={() => delField(i)} className="text-[12px] text-ink3 hover:text-red-500">✕</button>
                  </div>
                )}
              </div>
              {(f.type === '선택' || f.type === '다중선택') && (
                <input value={f.options.join(', ')} disabled={form.system} onChange={(e) => setField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder="옵션(콤마 구분): 영업, 교육, 회의" className="mt-1.5 w-full rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none disabled:opacity-60" />
              )}
            </div>
          ))}
        </div>
        {!form.system && (
          <button onClick={addField} className="mt-1.5 w-full rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal">+ 필드 추가</button>
        )}
        <p className="mt-1 text-[10.5px] text-ink3">예약 key <b>body</b>(장문)=문서 본문 · 금액 필드에 <b>금액키</b> 지정 시 결재선 금액매칭에 사용.</p>
      </div>

      <FormPreview form={form} />

      {form.system && (
        <p className="text-[11px] text-amber-600 font-semibold bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed">
          ⚠️ 기본 결재서식은 양식 잠금 상태입니다. 양식을 보완하려면 개발 코드의 시드 파일(approvalForm.seed.ts)을 수정하여 배포해야 합니다.
        </p>
      )}

      {msg && <p className="text-[11.5px] font-semibold text-teal">{msg}</p>}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          {onDelete && <button onClick={onDelete} className="rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-500/5">삭제</button>}
          {onDuplicate && <button onClick={onDuplicate} className="rounded-lg px-3 py-2 text-[12px] font-semibold text-ink2 hover:bg-panel-alt">복제</button>}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
          <button onClick={onSave} disabled={saving || form.system} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">저장</button>
        </div>
      </div>
    </div>
  );
}

/** 미리보기 — 상신 폼 / 인쇄 문서 2탭. */
function FormPreview({ form }: { form: ApprovalForm }) {
  const org = useOrgTree();
  const [tab, setTab] = useState<'폼' | '인쇄'>('폼');
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const setVals = (patch: Record<string, FieldValue>) => setValues((prev) => ({ ...prev, ...patch }));
  const amountField = amountFieldOf(form);

  const sampleDoc = useMemo<ApprovalDoc>(() => {
    const u = org.users;
    const drafter = u[u.length - 1] ?? u[0];

    let leave = null;
    if (form.code === '휴가') {
      leave = {
        leaveType: (values['leaveType'] as string) || '',
        startDate: (values['period'] as string) || '',
        endDate: (values['period__end'] as string) || '',
        days: values['period__days'] ? Number(values['period__days']) : null,
      };
    }

    return {
      id: 'PREVIEW', docNo: 'AP-000000-000', docType: form.code || '서식', title: `${form.name || '서식'} 미리보기`,
      drafterId: drafter?.id ?? '', drafterDept: drafter?.dept ?? '', status: '진행중',
      steps: u.slice(0, 3).map((x, i) => ({ seq: i + 1, parallelGroup: null, kind: i === 2 ? '전결' : '결재', approverId: x.id, delegatedFromId: null, decision: i === 0 ? '승인' : '대기', decidedAt: null, comment: '' })),
      amount: amountField ? 3_000_000 : null, body: values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]) : '(본문 미리보기)',
      form: leave as any,
      fieldValues: values, currentSeq: 1, createdAt: null, submittedAt: '2026-07-07T00:00:00.000Z', completedAt: null,
    };
  }, [form, org.users, values, amountField]);

  return (
    <div className="rounded-lg border border-teal/40 bg-teal-soft/20 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold text-teal">🔎 미리보기</span>
        {(['폼', '인쇄'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${tab === t ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'}`}>{t === '폼' ? '상신 폼' : '인쇄 문서'}</button>
        ))}
      </div>

      {tab === '폼' ? (
        <div className="rounded-lg bg-panel p-3">
          <div className="mb-2 text-[11px] font-bold text-ink2">제목 <span className="font-normal text-ink3">(예시)</span></div>
          <input disabled placeholder="문서 제목" className={`${inp} mb-3 opacity-70`} />
          <div className="grid grid-cols-2 gap-x-4">
            {(() => {
              const nodes: React.ReactNode[] = [];
              let lastSection = '';

              form.fields.forEach((f, i) => {
                if (f.section && f.section !== lastSection) {
                  lastSection = f.section;
                  nodes.push(
                    <div key={`sec-${f.section}`} className="col-span-2 mt-2 mb-1.5 text-[11px] font-bold text-teal border-b border-teal/15 pb-0.5">
                      {f.section}
                    </div>
                  );
                }
                const span = f.width === 'half' ? 'col-span-1' : 'col-span-2';
                nodes.push(
                  <div key={f.key || i} className={span}>
                    <div className="mb-1 text-[11px] font-bold text-ink2">{f.label || f.key}{f.required && ' *'}</div>
                    <DynamicField field={f} values={values} set={setVals} org={org} />
                  </div>
                );
              });

              const hasBodyField = form.fields.some((f) => f.key === 'body');
              if (!hasBodyField) {
                nodes.push(
                  <div key="default-body-preview" className="col-span-2 mt-3">
                    <div className="mb-1 text-[11px] font-bold text-ink2">본문</div>
                    <textarea disabled placeholder="내용을 입력하세요" rows={4} className={`${inp} resize-none leading-relaxed opacity-70`} />
                  </div>
                );
              }

              return nodes;
            })()}
          </div>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto rounded-lg bg-white p-2">
          <ApprovalDocumentView doc={sampleDoc} formOverride={form} />
        </div>
      )}
    </div>
  );
}

const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal';
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[10.5px] font-semibold text-ink3">{label}</span>{children}</label>;
}
