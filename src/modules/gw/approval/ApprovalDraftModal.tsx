import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/domain/user/schema';
import { type ApprovalDoc, type ApprovalStep, type LeaveForm, type LeaveType, type ApprovalRecipient } from '@/domain/approvalDoc/schema';
import { RESERVED_BODY_KEY, amountFieldOf, type ApprovalForm, type FieldValue } from '@/domain/approvalForm/schema';
import type { ApprovalDraftInput } from '@/data/approvalDoc/approvalDoc.repo';
import { useCreateDraft, useSaveDraft, useSubmitApproval } from '@/features/gw/useApprovals';
import { useActiveApprovalForms, useApprovalFolders } from '@/features/gw/useApprovalForms';
import { useRouteEngine } from '@/features/gw/useRouteEngine';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { ApprovalLineBuilder } from '@/modules/gw/approval/ApprovalLineBuilder';
import { DynamicField, missingRequired } from '@/modules/gw/approval/formFields';
import { storage, isFirebaseConfigured } from '@/shared/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * 상신 모달(§7.2) — 서식 선택 → 결재선 빌더 → 서식 필드/본문 → [임시저장][상신].
 * 문서 필드는 선택한 결재서식(approvalForms) 정의로 **동적 렌더**한다.
 * 예약 필드: 'body'(장문)=문서 본문, 금액(isAmountKey)=결재선 금액매칭. 휴가는 전용 위젯(doc.form).
 */

export function ApprovalDraftModal({
  me,
  editDoc,
  fixedType,
  onClose,
}: {
  me: User;
  editDoc?: ApprovalDoc | null;
  fixedType?: string;
  onClose: () => void;
}) {
  const { data: forms } = useActiveApprovalForms();
  const org = useOrgTree();

  const [code, setCode] = useState<string>(editDoc?.docType ?? fixedType ?? '기안');
  const [title, setTitle] = useState(editDoc?.title ?? '');
  const [body, setBody] = useState(editDoc?.body ?? '');
  const [amount, setAmount] = useState<string>(editDoc?.amount != null ? String(editDoc.amount) : '');
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const initialVals = { ...(editDoc?.fieldValues ?? {}) };
    if (editDoc?.docType === '휴가' && editDoc.form) {
      if (!initialVals['leaveType']) initialVals['leaveType'] = editDoc.form.leaveType;
      if (!initialVals['period']) initialVals['period'] = editDoc.form.startDate;
      if (!initialVals['period__end']) initialVals['period__end'] = editDoc.form.endDate;
      if (!initialVals['period__days']) initialVals['period__days'] = editDoc.form.days;
    }
    return initialVals;
  });
  const [steps, setSteps] = useState<ApprovalStep[]>(editDoc?.steps ?? []);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(editDoc?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [recipients, setRecipients] = useState<ApprovalRecipient[]>(editDoc?.recipients ?? []);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [pickerType, setPickerType] = useState<'user' | 'dept'>('dept');
  const [pickerTargetId, setPickerTargetId] = useState('');

  const create = useCreateDraft();
  const save = useSaveDraft();
  const submitM = useSubmitApproval();
  const route = useRouteEngine();
  const busy = create.isPending || save.isPending || submitM.isPending || uploading;

  const form: ApprovalForm | undefined = useMemo(() => forms.find((x) => x.code === code), [forms, code]);
  const amountField = form ? amountFieldOf(form) : undefined;
  const isAmount = !!amountField;
  const hasBodyField = form?.fields.some((f) => f.key === RESERVED_BODY_KEY && f.type === '장문') ?? false;
  const bodyLabel = form?.fields.find((f) => f.key === RESERVED_BODY_KEY)?.label ?? '본문';

  const setVals = (patch: Record<string, FieldValue>) => setValues((prev) => ({ ...prev, ...patch }));

  const amountNum = isAmount && amount.trim() ? Number(amount.replace(/[^0-9]/g, '')) : null;

  // 파일 업로드 핸들러 (Firebase Storage 연동 및 로컬 Mock 지원)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');

    try {
      const newFiles: { name: string; url: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (isFirebaseConfigured && storage) {
          // Live Firebase Storage 업로드
          const path = `approvals/${Date.now()}_${file.name}`;
          const fileRef = ref(storage, path);
          await uploadBytes(fileRef, file);
          const downloadUrl = await getDownloadURL(fileRef);
          newFiles.push({ name: file.name, url: downloadUrl });
        } else {
          // 로컬 데모 모드 (Graceful Fallback - mock URL)
          await new Promise((resolve) => setTimeout(resolve, 800)); // 시뮬레이팅 로딩
          newFiles.push({
            name: file.name,
            url: `https://example.com/mock-attachments/${Date.now()}_${file.name}`,
          });
        }
      }
      setAttachments((prev) => [...prev, ...newFiles]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // 서식이 변경되거나 기안 모달이 처음 열릴 때 해당 서식의 기본 수신처가 있으면 자동으로 수신처 목록에 로딩
  useEffect(() => {
    if (!form || editDoc) return; // 수정 모드일 때는 기존 문서의 수신처를 따르므로 스킵
    const defaultRecipients: ApprovalRecipient[] = [];
    if (form.recipientDrafter) {
      defaultRecipients.push({ id: 'drafter', name: '기안자 본인', type: 'drafter' });
    }
    if (form.recipientDeptId) {
      const dept = org.depts.find((d) => d.id === form.recipientDeptId);
      if (dept) {
        defaultRecipients.push({ id: dept.id, name: dept.name, type: 'dept' });
      }
    }
    if (form.recipientUserId) {
      const user = org.users.find((u) => u.id === form.recipientUserId);
      if (user) {
        defaultRecipients.push({ id: user.id, name: `${user.name} ${user.position}`, type: 'user' });
      }
    }
    setRecipients(defaultRecipients);
  }, [code, form, editDoc, org.depts, org.users]);

  // 실시간 결재선 규칙 엔진 연동
  const lastAutoSteps = useRef<string>('');
  useEffect(() => {
    if (route.isLoading || !code) return;
    const line = route.build({ drafterId: me.id, docType: code, amount: amountNum, docData: values });
    const lineStr = JSON.stringify(line);
    const currentStr = JSON.stringify(steps);

    // steps가 비어있거나, 이전 자동계산 결과와 일치하는 경우(즉, 수동 편집하지 않음) 자동 업데이트
    if (steps.length === 0 || currentStr === lastAutoSteps.current) {
      if (currentStr !== lineStr) {
        setSteps(line);
        lastAutoSteps.current = lineStr;
      }
    }
  }, [code, amountNum, values, route, me.id, steps]);

  // 금액 입력값(amountNum)을 동적 필드 values[amountField.key]에 실시간 동기화
  useEffect(() => {
    if (amountField) {
      const nextVal = amountNum ?? '';
      if (values[amountField.key] !== nextVal) {
        setVals({ [amountField.key]: nextVal });
      }
    }
  }, [amountField, amountNum, values]);

  const isResubmit = !!editDoc && editDoc.status !== '임시저장';

  const buildInput = (): ApprovalDraftInput => {
    let leave: LeaveForm | null = null;
    if (code === '휴가') {
      const pStart = String(values['period'] || '');
      const pEnd = String(values['period__end'] || '');
      const pDays = Number(values['period__days']) || 0;
      const lType = String(values['leaveType'] || '연차') as LeaveType;
      leave = {
        leaveType: lType,
        startDate: pStart,
        endDate: pEnd,
        days: pDays,
      };
    }
    return {
      docType: code,
      title: title.trim(),
      drafterId: me.id,
      drafterDept: me.dept,
      steps,
      amount: amountNum,
      body: values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]).trim() : body.trim(),
      form: leave,
      fieldValues: values,
      attachments,
      recipients,
    };
  };

  const validate = (forSubmit: boolean): string | null => {
    if (!title.trim()) return '제목을 입력하세요.';
    if (code === '휴가') {
      const pStart = values['period'];
      const pEnd = values['period__end'];
      const pDays = Number(values['period__days']) || 0;
      if (!pStart || !pEnd || pDays <= 0) return '휴가 기간을 올바르게 입력하세요.';
    }
    if (isAmount && amountField?.required && amountNum == null) return `${amountField.label}을(를) 입력하세요.`;
    const miss = form ? missingRequired(form.fields.filter((f) => f !== amountField && f.key !== RESERVED_BODY_KEY), values) : [];
    if (miss.length) return `필수 항목을 입력하세요: ${miss.join(', ')}`;
    if (forSubmit) {
      if (!steps.some((s) => s.kind !== '참조')) return '상신하려면 결재자를 1명 이상 지정하세요.';
      const inactiveUsers = steps
        .map((s) => org.userById(s.approverId))
        .filter((u) => !u || u.status !== '사용');
      if (inactiveUsers.length > 0) {
        const names = inactiveUsers.map((u) => u ? `${u.name} ${u.position}` : '알 수 없는 사용자').join(', ');
        return `비활성화되거나 존재하지 않는 결재자가 결재선에 포함되어 있어 재상신이 불가합니다: ${names}. 결재선을 수정해 주세요.`;
      }
    }
    return null;
  };

  const persistDraft = async (): Promise<string> => {
    const input = buildInput();
    if (editDoc) {
      await save.mutateAsync({ id: editDoc.id, patch: input });
      return editDoc.id;
    }
    return (await create.mutateAsync(input)).id;
  };

  const onSaveDraft = async () => {
    const err = validate(false);
    if (err) return setError(err);
    setError('');
    try { await persistDraft(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : '저장에 실패했습니다.'); }
  };
  const onSubmit = async () => {
    const err = validate(true);
    if (err) return setError(err);
    setError('');
    try { const id = await persistDraft(); await submitM.mutateAsync({ id, userId: me.id }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : '상신에 실패했습니다.'); }
  };

  // 필드 렌더 — 섹션 구분 + 2열 배치. body/amount 예약 필드는 전용 위젯으로.
  // tabOverrides: 탭 분할 서식에서 공통 필드의 탭별 독립 width/section 적용
  const tabSelectorField = form?.fields.find((f) => f.type === '선택' && f.isTabSelector);
  const currentTabValue = tabSelectorField ? String(values[tabSelectorField.key] ?? '') : '';

  const fieldNodes: React.ReactNode[] = [];
  let lastSection = '';
  for (const field of form?.fields ?? []) {
    // visibleIf 조건부 필드 노출 검사
    if (field.visibleIf) {
      const parts = field.visibleIf.split(':');
      if (parts.length === 2) {
        const [condKey, condVal] = parts;
        if (String(values[condKey] ?? '') !== condVal) {
          continue; // 조건 미충족 시 노출 안 함
        }
      }
    }

    // tabOverrides 적용: 공통 필드(visibleIf=null)이고 현재 탭값이 있으면 오버라이드
    const isCommonField = !field.visibleIf;
    const override: { width?: 'full' | 'half'; section?: string } =
      (isCommonField && currentTabValue && field.tabOverrides?.[currentTabValue]) || {};
    const effectiveWidth = (override.width ?? field.width) as 'full' | 'half';
    const effectiveSection = override.section ?? field.section;

    if (effectiveSection && effectiveSection !== lastSection) {
      lastSection = effectiveSection;
      fieldNodes.push(<div key={`sec-${effectiveSection}`} className="col-span-2 mt-1 text-[11px] font-bold text-teal">{effectiveSection}</div>);
    }
    const span = effectiveWidth === 'half' ? 'col-span-1' : 'col-span-2';
    if (field.type === '금액' && field === amountField) {
      fieldNodes.push(
        <div key={field.key} className={span}><Field label={field.label}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="예: 3000000" className={INP} />
          {amountNum != null && <span className="mt-1 block text-[11px] text-ink3">₩{amountNum.toLocaleString()}</span>}
        </Field></div>,
      );
    } else if (field.key === RESERVED_BODY_KEY && field.type === '장문') {
      fieldNodes.push(
        <div key={field.key} className="col-span-2">
          <Field label={field.label}>
            <textarea
              value={values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]) : body}
              onChange={(e) => {
                setVals({ [RESERVED_BODY_KEY]: e.target.value });
                setBody(e.target.value);
              }}
              rows={4}
              placeholder={field.placeholder || '내용을 입력하세요'}
              className={`${INP} resize-none leading-relaxed`}
            />
          </Field>
        </div>
      );
    } else {
      fieldNodes.push(<div key={field.key} className={span}><Field label={field.label + (field.required ? ' *' : '')}>
        <DynamicField field={field} values={values} set={setVals} org={org} />
      </Field></div>);
    }
  }

  const { data: folders = [] } = useApprovalFolders();
  // 모달 내 문서 유형 선택 시 적용할 폴더 카테고리 상태 (null = 전체, 'root' = 루트 서식, 혹은 폴더 ID)
  const [activeFolderTab, setActiveFolderTab] = useState<string | null>(null);

  const displayedForms = useMemo(() => {
    if (!activeFolderTab) return forms;
    if (activeFolderTab === 'root') return forms.filter((f) => !f.folderId);
    return forms.filter((f) => f.folderId === activeFolderTab);
  }, [forms, activeFolderTab]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-[#eee] px-5 py-3.5">
          <div className="text-[15px] font-bold text-ink">
            {isResubmit ? '반려 문서 수정·재상신' : editDoc ? '기안 문서 편집' : fixedType === '휴가' ? '휴가 신청' : '새 결재 상신'}
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-[16px] text-ink3 hover:bg-panel-alt">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* 서식(문서유형) 폴더별 탭 선택 */}
          {!fixedType && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-bold text-ink2">문서 유형 분류</div>
              {/* 폴더 카테고리 탭 */}
              <div className="mb-2 flex flex-wrap gap-1 border-b border-border pb-1.5">
                <button
                  type="button"
                  onClick={() => setActiveFolderTab(null)}
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors ${activeFolderTab === null ? 'bg-teal text-white' : 'bg-panel-alt text-ink2 hover:bg-border-hi'}`}
                >
                  전체 ({forms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFolderTab('root')}
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors ${activeFolderTab === 'root' ? 'bg-teal text-white' : 'bg-panel-alt text-ink2 hover:bg-border-hi'}`}
                >
                  기타 ({forms.filter(f => !f.folderId).length})
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFolderTab(f.id)}
                    className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors ${activeFolderTab === f.id ? 'bg-teal text-white' : 'bg-panel-alt text-ink2 hover:bg-border-hi'}`}
                  >
                    {f.name} ({forms.filter(form => form.folderId === f.id).length})
                  </button>
                ))}
              </div>
              {/* 서식 버튼 그리드 */}
              {displayedForms.length === 0 ? (
                <div className="py-4 text-center text-[11.5px] text-ink3">분류에 속한 서식이 없습니다.</div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {displayedForms.map((fm) => (
                    <button key={fm.code} type="button" onClick={() => setCode(fm.code)}
                      className={`rounded-lg border px-2 py-2 text-[12px] font-semibold ${code === fm.code ? 'border-teal bg-teal-soft text-teal' : 'border-border bg-panel-alt text-ink2 hover:border-border-hi'}`}>
                      {fm.icon} {fm.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Field label="제목">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="문서 제목" className={INP} />
          </Field>

          {/* 서식 동적 필드 */}
          {fieldNodes.length > 0 && <div className="grid grid-cols-2 gap-x-4">{fieldNodes}</div>}

          {/* 본문(서식에 body 필드가 없으면 기본 본문) */}
          {!hasBodyField && (
            <Field label={bodyLabel}>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="내용을 입력하세요" className={`${INP} resize-none leading-relaxed`} />
            </Field>
          )}

          {/* 결재선 빌더 */}
          <div className="mt-2">
            <div className="mb-1.5 text-[11px] font-bold text-ink2">결재선</div>
            <ApprovalLineBuilder steps={steps} onChange={setSteps} drafterId={me.id} docType={code} amount={amountNum} docData={values} />
          </div>

          {/* 수신처(시행처) 지정 - 차별화된 별도 카드형 디자인 */}
          <div className="mt-4 rounded-xl border border-blue/20 bg-blue-soft/10 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[12.5px] font-bold text-blue">📨 수신처 (시행처) 설정</div>
                <div className="text-[10px] text-ink3">문서 완료 시 자동 전송받을 곳을 정합니다.</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!recipients.some((r) => r.id === 'drafter')) {
                      setRecipients((prev) => [...prev, { id: 'drafter', name: '기안자 본인', type: 'drafter' }]);
                    }
                  }}
                  className="rounded-lg bg-blue-soft px-2 py-1 text-[10px] font-bold text-blue hover:bg-blue/20 transition-colors"
                >
                  👤 기안자 본인
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecipientPicker(!showRecipientPicker);
                    setPickerTargetId('');
                  }}
                  className="rounded-lg bg-teal-soft px-2 py-1 text-[10px] font-bold text-teal hover:bg-teal/20 transition-colors"
                >
                  + 수신처 추가
                </button>
              </div>
            </div>

            {/* 수신처 추가 폼 */}
            {showRecipientPicker && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-panel p-2 border border-border">
                <select
                  value={pickerType}
                  onChange={(e) => {
                    setPickerType(e.target.value as 'user' | 'dept');
                    setPickerTargetId('');
                  }}
                  className="rounded border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none"
                >
                  <option value="dept">부서</option>
                  <option value="user">사원</option>
                </select>

                <select
                  value={pickerTargetId}
                  onChange={(e) => setPickerTargetId(e.target.value)}
                  className="flex-1 rounded border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none"
                >
                  <option value="">선택하세요</option>
                  {pickerType === 'dept'
                    ? org.depts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))
                    : org.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.position} ({u.dept})
                        </option>
                      ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (!pickerTargetId) return;
                    if (pickerType === 'dept') {
                      const dept = org.depts.find((d) => d.id === pickerTargetId);
                      if (dept && !recipients.some((r) => r.id === dept.id)) {
                        setRecipients((prev) => [...prev, { id: dept.id, name: dept.name, type: 'dept' }]);
                      }
                    } else {
                      const user = org.users.find((u) => u.id === pickerTargetId);
                      if (user && !recipients.some((r) => r.id === user.id)) {
                        setRecipients((prev) => [
                          ...prev,
                          { id: user.id, name: `${user.name} ${user.position}`, type: 'user' },
                        ]);
                      }
                    }
                    setShowRecipientPicker(false);
                  }}
                  className="rounded bg-teal px-3 py-1 text-[11.5px] font-bold text-white hover:opacity-90"
                >
                  추가
                </button>
              </div>
            )}

            {/* 수신처 목록 태그 */}
            {recipients.length === 0 ? (
              <p className="text-[11px] text-ink3 pl-1">지정된 수신처가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {recipients.map((r) => (
                  <span
                    key={r.id}
                    className="flex items-center gap-1 rounded-md bg-panel border border-blue/20 px-2.5 py-0.5 text-[11px] font-semibold text-blue shadow-sm"
                  >
                    {r.type === 'dept' ? '📁' : r.type === 'drafter' ? '👤 기안자:' : '👤'} {r.name}
                    <button
                      type="button"
                      onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))}
                      className="ml-1 font-bold text-blue/60 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 파일 첨부 영역 */}
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-1.5 text-[11px] font-bold text-ink2">📎 첨부 파일</div>
            
            {/* 파일 드롭존 */}
            <div className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-border-hi bg-panel-alt p-4 transition-colors hover:border-teal/50 hover:bg-teal-soft/10">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className="flex flex-col items-center text-center">
                <span className="text-[20px] text-ink3 mb-1">📁</span>
                <span className="text-[11.5px] font-semibold text-ink2">파일을 드래그하거나 클릭하여 추가하세요</span>
                <span className="text-[10px] text-ink3 mt-0.5">최대 파일 제한 없음 (로컬/서버 실시간 저장)</span>
              </div>
            </div>

            {/* 업로드 로딩 표시 */}
            {uploading && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-teal">
                <span className="animate-spin text-[12px]">🌀</span> 업로드 중...
              </div>
            )}

            {/* 첨부파일 리스트 */}
            {attachments.length > 0 && (
              <div className="mt-2.5 space-y-1">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-panel-alt px-2.5 py-1.5 border border-border">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11.5px]">📄</span>
                      <span className="truncate text-[11.5px] font-medium text-ink2">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="ml-2 text-[12px] font-bold text-ink3 hover:text-red-500 hover:bg-red-500/5 rounded-md px-1.5 py-0.5"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] font-semibold text-red-500">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt disabled:opacity-50">취소</button>
          {!isResubmit && <button onClick={onSaveDraft} disabled={busy} className="rounded-lg border border-border-hi bg-panel-alt px-3.5 py-2 text-[12.5px] font-semibold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">임시저장</button>}
          <button onClick={onSubmit} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">{busy ? '처리 중…' : isResubmit ? '재상신' : '상신'}</button>
        </div>
      </div>
    </div>
  );
}

const INP = 'w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-bold text-ink2">{label}</span>
      {children}
    </label>
  );
}
