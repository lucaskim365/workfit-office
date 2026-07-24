import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/domain/user/schema';
import { type ApprovalDoc, type ApprovalStep, type LeaveForm, type LeaveType, type ApprovalRecipient } from '@/domain/approvalDoc/schema';
import { RESERVED_BODY_KEY, amountFieldOf, type ApprovalForm, type FieldValue } from '@/domain/approvalForm/schema';
import type { ApprovalDraftInput } from '@/data/approvalDoc/approvalDoc.repo';
import { useCreateDraft, useSaveDraft, useSubmitApproval } from '@/features/gw/useApprovals';
import { useActiveApprovalForms, useApprovalFolders } from '@/features/gw/useApprovalForms';
import { useRouteEngine, useApprovalRouteRules } from '@/features/gw/useRouteEngine';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useLeave } from '@/features/gw/useLeave';
import { ApprovalLineBuilder } from '@/modules/gw/approval/ApprovalLineBuilder';
import { DynamicField, missingRequired } from '@/modules/gw/approval/formFields';
import { ApprovalDocumentView } from '@/modules/gw/approval/ApprovalDocumentView';
import { storage, isFirebaseConfigured } from '@/shared/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ZodError } from 'zod';

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
  const bal = useLeave(me.id);
  const { data: routeRules = [] } = useApprovalRouteRules();

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

  const selectedLeaveType = String(values['leaveType'] || '연차');

  const [steps, setSteps] = useState<ApprovalStep[]>(editDoc?.steps ?? []);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(editDoc?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [recipients, setRecipients] = useState<ApprovalRecipient[]>(editDoc?.recipients ?? []);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [pickerType, setPickerType] = useState<'user' | 'dept'>('dept');
  const [pickerTargetId, setPickerTargetId] = useState('');
  
  const [executionTarget, setExecutionTarget] = useState<{ type: 'USER' | 'DEPT'; id: string; name: string } | null>(() => {
    if (editDoc?.execution) {
      const t = editDoc.execution;
      let name = t.targetId;
      if (t.targetType === 'USER') {
        const u = org.userById(t.targetId);
        if (u) name = `${u.name} ${u.position}`;
      } else {
        const d = org.depts.find((dept) => dept.id === t.targetId);
        if (d) name = d.name;
      }
      return { type: t.targetType, id: t.targetId, name };
    }
    return null;
  });
  const [execPickerType, setExecPickerType] = useState<'USER' | 'DEPT'>('DEPT');

  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [onlyAllowedForms, setOnlyAllowedForms] = useState(false);
  const sidebarWidth = 240;

  const hasManuallyEnteredValues = () => {
    if (editDoc) {
      const titleChanged = title.trim() !== (editDoc.title ?? '').trim();
      const bodyChanged = body.trim() !== (editDoc.body ?? '').trim();
      const amountChanged = amount.trim() !== (editDoc.amount != null ? String(editDoc.amount) : '');
      const filesChanged = attachments.length !== (editDoc.attachments ?? []).length;
      const valuesChanged = Object.keys(values).some((k) => values[k] !== editDoc.fieldValues?.[k]);
      return titleChanged || bodyChanged || amountChanged || filesChanged || valuesChanged;
    } else {
      const hasTitle = title.trim() !== '';
      const hasBody = body.trim() !== '';
      const hasAmount = amount.trim() !== '';
      const hasFiles = attachments.length > 0;
      const hasValues = Object.keys(values).some((k) => {
        const v = values[k];
        return v !== undefined && v !== null && String(v).trim() !== '';
      });
      return hasTitle || hasBody || hasAmount || hasFiles || hasValues;
    }
  };

  const formatErrorMessage = (err: unknown): string => {
    if (err instanceof ZodError) {
      return err.issues.map((e) => e.message).join(', ');
    }
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError' && 'issues' in err && Array.isArray((err as any).issues)) {
      return (err as any).issues.map((e: any) => e.message).join(', ');
    }
    if (err instanceof Error) {
      try {
        const parsed = JSON.parse(err.message);
        if (Array.isArray(parsed) && parsed.length > 0 && 'message' in parsed[0]) {
          return parsed.map((e: any) => e.message).join(', ');
        }
      } catch {
        // Ignored
      }
      return err.message;
    }
    return String(err);
  };

  const handleAttemptClose = () => {
    if (hasManuallyEnteredValues()) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleCancelClick = () => {
    if (hasManuallyEnteredValues()) {
      setShowConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const handleConfirmCloseSave = async () => {
    try {
      await persistDraft();
      onClose();
    } catch (e) {
      setError(formatErrorMessage(e));
      setShowConfirmClose(false);
    }
  };

  const create = useCreateDraft();
  const save = useSaveDraft();
  const submitM = useSubmitApproval();
  const route = useRouteEngine();
  const busy = create.isPending || save.isPending || submitM.isPending || uploading;

  const form: ApprovalForm | undefined = useMemo(() => forms.find((x) => x.code === code), [forms, code]);
  const amountField = form ? amountFieldOf(form) : undefined;
  const isAmount = !!amountField;


  const setVals = (patch: Record<string, FieldValue>) => setValues((prev) => ({ ...prev, ...patch }));

  const tableAmountNum = useMemo(() => {
    for (const f of form?.fields ?? []) {
      if (f.type === '표' && f.placeholder) {
        try {
          const cfg = JSON.parse(f.placeholder);
          const val = values[f.key];
          if (val && typeof val === 'string') {
            const parsedVal = JSON.parse(val);
            if (parsedVal && parsedVal.rows) {
              const sCell = parsedVal.sumCell;
              const aCells: Array<{ rIdx: number; col: string }> = parsedVal.amountCells
                ? parsedVal.amountCells
                : (parsedVal.amountCell ? [parsedVal.amountCell] : []);

              // 1) 만약 합산 결과 표시 셀(sumCell)이 있다면 해당 셀 값을 대표 금액으로 삼음
              if (sCell) {
                const { rIdx, col } = sCell;
                if (parsedVal.rows[rIdx]) {
                  const cellVal = parsedVal.rows[rIdx][col];
                  if (cellVal) {
                    return Number(String(cellVal).replace(/[^0-9]/g, '')) || null;
                  }
                }
              }

              // 2) 합산 결과 셀이 없으면, '금액' 포함 열 및 수동 지정된 amountCells 금액의 총합을 구함
              let sum = 0;
              let hasValue = false;
              parsedVal.rows.forEach((row: Record<string, string>, rIdx: number) => {
                cfg.cols.forEach((col: string) => {
                  const isAutoAmt = col.includes('금액');
                  const isManualAmt = aCells.some((c) => c.rIdx === rIdx && c.col === col);
                  if (isAutoAmt || isManualAmt) {
                    const cellVal = row[col];
                    if (cellVal) {
                      sum += Number(String(cellVal).replace(/[^0-9]/g, '')) || 0;
                      hasValue = true;
                    }
                  }
                });
              });
              if (hasValue) return sum;
            }
          }
        } catch (e) { }
      }
    }
    return null;
  }, [form, values]);

  const amountNum = isAmount && amount.trim()
    ? Number(amount.replace(/[^0-9]/g, ''))
    : tableAmountNum;

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
    const execution = executionTarget
      ? {
          docId: editDoc?.id ?? '',
          targetType: executionTarget.type,
          targetId: executionTarget.id,
          status: '대기중' as const,
          comment: '',
        }
      : null;

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
      execution,
    };
  };

  const validate = (forSubmit: boolean): string | null => {
    if (!title.trim()) return '제목을 입력하세요.';
    if (code === '휴가') {
      const pStart = values['period'];
      const pEnd = values['period__end'];
      const pDays = Number(values['period__days']) || 0;
      if (!pStart || !pEnd || pDays <= 0) return '휴가 기간을 올바르게 입력하세요.';

      const lType = String(values['leaveType'] || '연차');
      if (lType === '연차' || lType === '반차') {
        if (pDays > bal.remaining) {
          return `신청 가능한 연차가 부족합니다. (신청: ${pDays}일 / 잔여: ${bal.remaining}일)`;
        }
      } else if (lType === '대체휴무') {
        if (pDays > bal.substituteHoliday.remaining) {
          return `신청 가능한 대체휴무가 부족합니다. (신청: ${pDays}일 / 잔여: ${bal.substituteHoliday.remaining}일)`;
        }
      }
    }
    if (isAmount && amountField?.required && amountNum == null) return `${amountField.label}을(를) 입력하세요.`;
    const miss = form ? missingRequired(form.fields.filter((f) => f !== amountField && f.key !== RESERVED_BODY_KEY), values) : [];
    if (miss.length) return `필수 항목을 입력하세요: ${miss.join(', ')}`;
    if (forSubmit) {
      const userRank = org.positions.find((p) => p.name === me.position)?.rank ?? 9;
      if (form) {
        if (form.allowedPositionFromRank != null && userRank > form.allowedPositionFromRank) {
          let neededTitle = '상급자';
          if (form.allowedPositionFromRank === 1) neededTitle = '대표';
          else if (form.allowedPositionFromRank === 2) neededTitle = '본부장';
          else if (form.allowedPositionFromRank === 3 || form.allowedPositionFromRank === 4) neededTitle = '팀장';
          else if (form.allowedPositionFromRank >= 5) neededTitle = '팀원';
          return `본 서식의 기안 권한이 없습니다. (${neededTitle} 이상 기안 가능)`;
        }
        if (form.allowedPositionToRank != null && userRank < form.allowedPositionToRank) {
          let neededTitle = '하급자';
          if (form.allowedPositionToRank === 1) neededTitle = '대표';
          else if (form.allowedPositionToRank === 2) neededTitle = '본부장';
          else if (form.allowedPositionToRank === 3 || form.allowedPositionToRank === 4) neededTitle = '팀장';
          else if (form.allowedPositionToRank >= 5) neededTitle = '팀원';
          return `본 서식의 기안 권한이 없습니다. (${neededTitle} 이하 기안 가능)`;
        }
        if (form.allowedDeptIds && form.allowedDeptIds.length > 0) {
          const userDeptNode = org.depts.find((d) => d.name === me.dept);
          const userDeptId = userDeptNode?.id ?? null;
          if (!userDeptId || !form.allowedDeptIds.includes(userDeptId)) {
            return `본 서식의 기안 권한이 없습니다. (허가된 부서만 기안 가능)`;
          }
        }
      }

      if (code !== '기안' && code !== '전체') {
        const rulesForThisDoc = routeRules.filter((r) => r.active && r.docType === code);
        if (rulesForThisDoc.length > 0) {
          const amt = amountNum ?? 0;
          const rulesForAmount = rulesForThisDoc.filter((r) => {
            const matchesAmount = (r.amountFrom == null || amt >= r.amountFrom) && (r.amountTo == null || amt < r.amountTo);
            if (!matchesAmount) return false;

            if (r.conditionKey) {
              const val = values[r.conditionKey];
              if (val === undefined || val === null || val === '') return false;
              if (!r.conditionValues.includes(String(val))) return false;
            }
            return true;
          });

          if (rulesForAmount.length > 0) {
            const userRank = org.positions.find((p) => p.name === me.position)?.rank ?? 9;
            const hasQualifiedRule = rulesForAmount.some(
              (r) =>
                (r.positionFromRank == null || userRank >= r.positionFromRank) &&
                (r.positionToRank == null || userRank <= r.positionToRank)
            );

            if (!hasQualifiedRule) {
              const maxRankNeeded = Math.max(...rulesForAmount.map((r) => r.positionToRank ?? 9));
              let neededTitle = '상급자';
              if (maxRankNeeded === 1) neededTitle = '대표';
              else if (maxRankNeeded === 2) neededTitle = '본부장';
              else if (maxRankNeeded === 3 || maxRankNeeded === 4) neededTitle = '팀장';
              else if (maxRankNeeded >= 5) neededTitle = '팀원';
              return `이 금액대 및 선택 조건의 해당 문서 기안 권한이 없습니다. (${neededTitle} 이상 기안 가능)`;
            }
          }
        }
      }

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

  // 사용자의 직책 권한에 따라 비활성화할 서식(forms) 판정
  const disabledFormCodes = useMemo(() => {
    const userRank = org.positions.find((p) => p.name === me.position)?.rank ?? 9;
    const userDeptNode = org.depts.find((d) => d.name === me.dept);
    const userDeptId = userDeptNode?.id ?? null;
    const disabledCodes = new Set<string>();

    for (const form of forms) {
      if (form.code === '기안' || form.code === '전체') continue;

      // 1) 서식 레벨의 직급 범위 제한 검사
      if (form.allowedPositionFromRank != null && userRank > form.allowedPositionFromRank) {
        disabledCodes.add(form.code);
        continue;
      }
      if (form.allowedPositionToRank != null && userRank < form.allowedPositionToRank) {
        disabledCodes.add(form.code);
        continue;
      }

      // 2) 서식 레벨의 부서 제한 검사
      if (form.allowedDeptIds && form.allowedDeptIds.length > 0) {
        if (!userDeptId || !form.allowedDeptIds.includes(userDeptId)) {
          disabledCodes.add(form.code);
          continue;
        }
      }

      // 3) 룰 레벨의 직급 범위 제한 검사
      const rulesForThisDoc = routeRules.filter((r) => r.active && r.docType === form.code);
      if (rulesForThisDoc.length === 0) continue; // 규칙이 지정되지 않은 경우 기본 허용

      const hasAnyQualifyingRule = rulesForThisDoc.some(
        (r) =>
          (r.positionFromRank == null || userRank >= r.positionFromRank) &&
          (r.positionToRank == null || userRank <= r.positionToRank)
      );

      if (!hasAnyQualifyingRule) {
        disabledCodes.add(form.code);
      }
    }
    return disabledCodes;
  }, [forms, routeRules, org.positions, org.depts, me.position, me.dept]);

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
    catch (e) { setError(formatErrorMessage(e)); }
  };
  const onSubmit = async () => {
    const err = validate(true);
    if (err) return setError(err);
    setError('');
    try { const id = await persistDraft(); await submitM.mutateAsync({ id, userId: me.id }); onClose(); }
    catch (e) { setError(formatErrorMessage(e)); }
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
  const isFixed = !!fixedType || !!editDoc;

  // 폴더별 열림 상태 관리 (기본값: 모두 열림)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderId]: prev[folderId] === false ? true : false,
    }));
  };

  const sidebarFolders = useMemo(() => {
    const filteredForms = forms.filter((form) => {
      if (sidebarSearch.trim() && !form.name.toLowerCase().includes(sidebarSearch.toLowerCase())) {
        return false;
      }
      if (onlyAllowedForms && disabledFormCodes.has(form.code)) {
        return false;
      }
      return true;
    });

    const list = folders.map((f) => ({
      ...f,
      forms: filteredForms.filter((form) => form.folderId === f.id),
    })).filter((f) => f.forms.length > 0);

    const others = filteredForms.filter((form) => !form.folderId);
    if (others.length > 0) {
      list.push({
        id: 'others',
        name: '기타',
        order: 999,
        forms: others,
      });
    }
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [folders, forms, sidebarSearch, onlyAllowedForms, disabledFormCodes]);

  const mockDoc: ApprovalDoc = useMemo(() => ({
    id: editDoc?.id ?? 'preview-doc-id',
    docNo: editDoc?.docNo ?? 'PREVIEW-TEMP',
    docType: code,
    title: title || '제목 없음',
    body: body,
    status: '임시저장',
    drafterId: me.id,
    drafterDept: me.dept || '',
    createdAt: new Date().toISOString(),
    submittedAt: null,
    completedAt: null,
    currentSeq: 0,
    amount: amount ? Number(amount) : null,
    fieldValues: values,
    attachments: attachments,
    recipients: recipients,
    steps: steps,
    form: code === '휴가' ? {
      leaveType: String(values['leaveType'] || '연차') as LeaveType,
      startDate: String(values['period'] || ''),
      endDate: String(values['period__end'] || ''),
      days: Number(values['period__days']) || 0,
    } : null,
    execution: executionTarget
      ? {
          docId: editDoc?.id ?? 'preview-doc-id',
          targetType: executionTarget.type,
          targetId: executionTarget.id,
          status: '대기중' as const,
          comment: '',
        }
      : null,
    preservationPeriod: values['preservationPeriod'] ? String(values['preservationPeriod']) : (form?.preservationPeriod ?? '3년'),
  }), [editDoc, code, title, body, me, amount, values, attachments, recipients, steps, executionTarget, form]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onClick={handleAttemptClose}>
      <div
        className={`flex max-h-[80vh] w-full flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl transition-all duration-300 ${isFixed ? 'max-w-2xl' : 'max-w-[75vw]'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="text-[15px] font-bold text-ink">
            {isResubmit ? '반려 문서 수정·재상신' : editDoc ? '기안 문서 편집' : fixedType === '휴가' ? '휴가 신청' : '새 결재 상신'}
          </div>
          <button onClick={handleAttemptClose} className="grid h-8 w-8 place-items-center rounded-lg text-[16px] text-ink3 hover:bg-panel-alt">✕</button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* 좌측 서식 트리 영역 (fixedType이 아닐 때만 렌더) */}
          {!isFixed && (
            <div
              style={{ width: sidebarOpen ? sidebarWidth : 0 }}
              className="relative shrink-0 border-r border-border bg-panel-alt flex flex-col select-none transition-all duration-200"
            >
              {/* 사이드바 본문 (접혔을 때 숨김) */}
              <div className={`flex flex-col h-full p-3.5 overflow-y-auto ${!sidebarOpen ? 'invisible opacity-0' : 'visible opacity-100 transition-opacity duration-150'}`} style={{ width: sidebarWidth }}>
                <div className="mb-2">
                  <div className="text-[11.5px] font-extrabold text-ink3 uppercase tracking-wider mb-2">
                    결재 서식 목록
                  </div>
                  
                  {/* 검색창 및 작성가능 필터 체크박스 */}
                  <div className="space-y-1.5 mb-2">
                    <input
                      type="text"
                      value={sidebarSearch}
                      onChange={(e) => setSidebarSearch(e.target.value)}
                      placeholder="서식 제목 검색..."
                      className="w-full rounded-md border border-border-hi bg-panel px-2.5 py-1 text-[11px] text-ink outline-none focus:border-teal"
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={onlyAllowedForms}
                        onChange={(e) => setOnlyAllowedForms(e.target.checked)}
                        className="rounded border-border accent-teal cursor-pointer h-3.5 w-3.5"
                      />
                      <span className="text-[10px] font-bold text-ink2">작성 가능한 문서만 보기</span>
                    </label>
                  </div>
                </div>

                {/* 서식 목록 트리 */}
                <div className="space-y-2 flex-1">
                  {sidebarFolders.map((f) => {
                    const isOpen = openFolders[f.id] !== false;
                    return (
                      <div key={f.id} className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => toggleFolder(f.id)}
                          className="flex w-full items-center justify-between py-1 text-[11.5px] font-bold text-ink hover:text-teal transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>📂</span>
                            <span>{f.name}</span>
                          </span>
                          <span className="text-[9px] text-ink3">{isOpen ? '▼' : '▶'}</span>
                        </button>

                        {isOpen && (
                          <div className="pl-3 border-l border-border ml-1.5 space-y-0.5 mt-0.5">
                            {f.forms.map((fm) => {
                              const isDisabled = disabledFormCodes.has(fm.code);
                              return (
                                <button
                                  key={fm.code}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => {
                                    setCode(fm.code);
                                    setValues({}); // 서식 교체 시 기존 입력 상태값 초기화
                                  }}
                                  className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11.5px] font-medium transition-colors ${isDisabled
                                      ? 'opacity-40 cursor-not-allowed'
                                      : code === fm.code
                                        ? 'bg-teal-soft text-teal font-semibold'
                                        : 'text-ink2 hover:bg-border-hi/30'
                                    }`}
                                >
                                  <span className="text-[13px]">{fm.icon}</span>
                                  <span className="truncate">{fm.name}</span>
                                  {isDisabled && (
                                    <span className="ml-auto text-[8.5px] font-bold bg-red-500/10 text-red-500 px-1 py-0.5 rounded">제한</span>
                                  )}
                                </button>
                              );
                            })}
                            {f.forms.length === 0 && (
                              <div className="py-0.5 pl-5 text-[10.5px] text-ink3">서식이 없습니다.</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>


              
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="absolute top-1/2 -right-2.5 -translate-y-1/2 z-[30] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-panel shadow hover:border-teal hover:text-teal transition-all text-[9px] font-bold text-ink2 cursor-pointer"
              >
                {sidebarOpen ? '◀' : '▶'}
              </button>
            </div>
          )}

          {/* 우측 폼 입력 영역 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">

            <Field label="제목">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="문서 제목" className={INP} />
            </Field>

            {/* 휴가 잔여일수 실시간 표시 배너 */}
            {code === '휴가' && (
              <div className="mb-4 rounded-xl border border-teal/20 bg-teal-soft/10 p-3.5 shadow-sm">
                <div className="text-[11.5px] font-bold text-teal mb-2">📊 가용 휴가 정보 (실시간 연동)</div>
                <div className="grid grid-cols-2 gap-3">
                  {/* 연차 카드 */}
                  <div className={`rounded-lg p-2.5 border transition-all ${selectedLeaveType === '연차' || selectedLeaveType === '반차'
                      ? 'border-teal bg-teal-soft/30 shadow-sm'
                      : 'border-border bg-panel-alt/30'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-ink2">연차 잔여</span>
                      {(selectedLeaveType === '연차' || selectedLeaveType === '반차') && (
                        <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                      )}
                    </div>
                    <div className="text-[15px] font-extrabold text-teal mt-0.5">
                      {bal.remaining} <span className="text-[10px] font-semibold text-ink3">/ {bal.grant} 일</span>
                    </div>
                  </div>
                  {/* 대체휴무 카드 */}
                  <div className={`rounded-lg p-2.5 border transition-all ${selectedLeaveType === '대체휴무'
                      ? 'border-blue bg-blue-soft/30 shadow-sm'
                      : 'border-border bg-panel-alt/30'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-ink2">대체휴무 잔여</span>
                      {selectedLeaveType === '대체휴무' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue" />
                      )}
                    </div>
                    <div className="text-[15px] font-extrabold text-blue mt-0.5">
                      {bal.substituteHoliday.remaining} <span className="text-[10px] font-semibold text-ink3">/ {bal.substituteHoliday.total} 일</span>
                    </div>
                  </div>
                </div>
                {selectedLeaveType === '대체휴무' && bal.substituteHoliday.expiringSoonCount > 0 && (
                  <div className="mt-2 text-[10px] text-amber font-semibold flex items-center gap-1 animate-pulse">
                    ⚠️ 30일 내 만료 예정인 대체휴무가 존재합니다 ({bal.substituteHoliday.expiringSoonCount}건). 휴가일 기준으로 사용 가능 여부를 꼭 확인하세요.
                  </div>
                )}
              </div>
            )}

            {/* 서식 동적 필드 */}
            {fieldNodes.length > 0 && <div className="grid grid-cols-2 gap-x-4">{fieldNodes}</div>}



            {/* 결재선 및 수신/시행 설정 그룹 */}
            <div className="mt-4 rounded-2xl border border-border bg-panel-alt/45 p-4 space-y-4">
              {/* 결재선 설정 */}
              <div>
                <div className="mb-1.5 text-[11.5px] font-bold text-ink2">결재선 설정</div>
                <ApprovalLineBuilder steps={steps} onChange={setSteps} drafterId={me.id} docType={code} amount={amountNum} docData={values} />
              </div>

              {/* 수신처 & 시행자 설정 (2열 배치로 세로 스크롤 최소화) */}
              <div className="grid grid-cols-2 gap-4">
                {/* 수신처 지정 - 통일된 카드형 디자인 */}
                <div className="rounded-xl border border-teal/20 bg-teal-soft/10 p-3.5 flex flex-col justify-between min-h-[130px]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-[12px] font-bold text-teal">📨 수신처 설정</div>
                        <div className="text-[9.5px] text-ink3">문서 완료 시 자동 전송받을 수신처</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowRecipientPicker(!showRecipientPicker);
                            setPickerTargetId('');
                          }}
                          className="rounded-lg bg-teal-soft px-2 py-1 text-[10px] font-bold text-teal hover:bg-teal/20 transition-colors"
                        >
                          + 추가
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
                          className="rounded border border-border-hi bg-panel px-2 py-1 text-[11px] text-ink outline-none"
                        >
                          <option value="dept">부서</option>
                          <option value="user">사원</option>
                        </select>

                        <select
                          value={pickerTargetId}
                          onChange={(e) => setPickerTargetId(e.target.value)}
                          className="flex-1 rounded border border-border-hi bg-panel px-2 py-1 text-[11px] text-ink outline-none"
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
                          className="rounded bg-teal px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90"
                        >
                          추가
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 수신처 목록 태그 */}
                  <div className="mt-2 flex-1">
                    {recipients.length === 0 ? (
                      <p className="text-[10.5px] text-ink3 pl-1">지정된 수신처가 없습니다.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pl-1 max-h-[100px] overflow-y-auto">
                        {recipients.map((r) => (
                          <span
                            key={r.id}
                            className="flex items-center gap-1 rounded-md bg-panel border border-teal/20 px-2 py-0.5 text-[10.5px] font-semibold text-teal shadow-sm"
                          >
                            {r.type === 'dept' ? '📁' : r.type === 'drafter' ? '👤 기안자:' : '👤'} {r.name}
                            <button
                              type="button"
                              onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))}
                              className="ml-1 font-bold text-teal/60 hover:text-red-500"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 시행자 지정 - 별도 카드형 디자인 (직관적인 인라인 바인딩) */}
                <div className="rounded-xl border border-teal/20 bg-teal-soft/10 p-3.5 flex flex-col justify-between min-h-[130px]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-[12px] font-bold text-teal">📦 시행자 설정</div>
                        <div className="text-[9.5px] text-ink3">완료 후 후속 실무를 처리할 시행자 지정</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      <select
                        value={execPickerType}
                        onChange={(e) => {
                          const newType = e.target.value as 'USER' | 'DEPT';
                          setExecPickerType(newType);
                          setExecutionTarget(null);
                        }}
                        className="rounded border border-border bg-panel px-2 py-1 text-[11px] text-ink outline-none"
                      >
                        <option value="DEPT">부서</option>
                        <option value="USER">사원</option>
                      </select>

                      <select
                        value={executionTarget?.id ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setExecutionTarget(null);
                            return;
                          }
                          if (execPickerType === 'DEPT') {
                            const dept = org.depts.find((d) => d.id === val);
                            if (dept) {
                              setExecutionTarget({ type: 'DEPT', id: dept.id, name: dept.name });
                            }
                          } else {
                            const user = org.users.find((u) => u.id === val);
                            if (user) {
                              setExecutionTarget({ type: 'USER', id: user.id, name: `${user.name} ${user.position}` });
                            }
                          }
                        }}
                        className="flex-1 min-w-0 rounded border border-border bg-panel px-2 py-1 text-[11px] text-ink outline-none"
                      >
                        <option value="">시행자 지정 안함</option>
                        {execPickerType === 'DEPT'
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
                    </div>
                  </div>

                  {/* 지정된 시행자 정보 가이드 */}
                  <div className="mt-2.5">
                    {executionTarget ? (
                      <div className="text-[10.5px] font-semibold text-teal flex items-center justify-between bg-panel border border-teal/20 px-2.5 py-0.5 rounded shadow-sm">
                        <span className="truncate">🎯 지정됨: {executionTarget.type === 'DEPT' ? '📁' : '👤'} {executionTarget.name}</span>
                        <button
                          type="button"
                          onClick={() => setExecutionTarget(null)}
                          className="ml-1 font-bold text-teal/60 hover:text-red-500 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10.5px] text-ink3 pl-1">지정된 시행자가 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
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

          </div>
        </div>


        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-5 py-3">
          {/* 에러 알림 메시지를 하단 버튼 라인 좌측에 배치 */}
          <div className="flex-1 min-w-0">
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[11.5px] font-semibold text-red-500 animate-fade-in truncate max-w-[420px]" title={error}>
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCancelClick} disabled={busy} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt disabled:opacity-50">취소</button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={busy}
              className="rounded-lg border border-border-hi bg-panel px-3.5 py-2 text-[12.5px] font-semibold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50"
            >
              문서 미리보기
            </button>
            {!isResubmit && <button onClick={onSaveDraft} disabled={busy} className="rounded-lg border border-border-hi bg-panel-alt px-3.5 py-2 text-[12.5px] font-semibold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">임시저장</button>}
            <button onClick={onSubmit} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">{busy ? '처리 중…' : isResubmit ? '재상신' : '상신'}</button>
          </div>
        </div>
      </div>

      {showConfirmClose && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
          <div className="w-[340px] rounded-2xl border border-border bg-panel p-5 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-bold text-ink mb-1.5 flex items-center gap-1.5">
              <span>⚠️</span> 기안 작성 중단
            </h3>
            <p className="text-[11.5px] leading-relaxed text-ink2 mb-4">
              기안 작성을 중단하시겠습니까?<br />작성중인 기안은 임시저장함에 저장됩니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmClose(false)}
                className="h-8 px-3 rounded-lg text-[11.5px] font-semibold text-ink2 bg-panel-alt hover:bg-border-hi/30 transition-colors"
              >
                계속 작성
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseSave}
                disabled={busy}
                className="h-8 px-3.5 rounded-lg text-[11.5px] font-bold text-white bg-teal hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                임시저장 후 중단
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDiscard && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
          <div className="w-[340px] rounded-2xl border border-border bg-panel p-5 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-bold text-ink mb-1.5 flex items-center gap-1.5">
              <span>⚠️</span> 기안 작성 취소
            </h3>
            <p className="text-[11.5px] leading-relaxed text-ink2 mb-4">
              기안 작성을 취소하시겠습니까?<br />작성 중이던 내용은 저장되지 않습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDiscard(false)}
                className="h-8 px-3 rounded-lg text-[11.5px] font-semibold text-ink2 bg-panel-alt hover:bg-border-hi/30 transition-colors"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3.5 rounded-lg text-[11.5px] font-bold text-white bg-danger hover:opacity-90 transition-colors"
              >
                변경내용 모두 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowPreview(false);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-panel-alt/30 px-5 py-3">
              <div className="text-[13.5px] font-bold text-ink flex items-center gap-1.5">
                <span>📄</span> 문서 미리보기
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-[16px] text-ink3 hover:bg-panel-alt"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 bg-white dark:bg-black/10">
              <ApprovalDocumentView doc={mockDoc} />
            </div>
            <div className="flex shrink-0 justify-end border-t border-border px-5 py-3 bg-panel-alt/20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(false);
                }}
                className="rounded-lg bg-teal px-4 py-2 text-[12px] font-bold text-white hover:opacity-90 shadow-sm"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
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
