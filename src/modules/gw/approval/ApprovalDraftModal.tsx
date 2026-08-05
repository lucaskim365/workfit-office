import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/domain/user/schema';
import { type ApprovalDoc, type ApprovalStep, type LeaveForm, type LeaveType, type ApprovalRecipient, type RelatedDoc } from '@/domain/approvalDoc/schema';
import { RESERVED_BODY_KEY, amountFieldOf, type ApprovalForm, type FieldValue } from '@/domain/approvalForm/schema';
import { approvalDocRepo, type ApprovalDraftInput } from '@/data/approvalDoc/approvalDoc.repo';
import { approvalProcessRepo } from '@/data/approvalProcess/approvalProcess.repo';
import { useCreateDraft, useSaveDraft, useSubmitApproval } from '@/features/gw/useApprovals';
import { useActiveApprovalForms, useApprovalFolders } from '@/features/gw/useApprovalForms';
import { useRouteEngine, useApprovalRouteRules } from '@/features/gw/useRouteEngine';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useLeave } from '@/features/gw/useLeave';
import { ApprovalLineBuilder } from '@/modules/gw/approval/ApprovalLineBuilder';
import { DynamicField, missingRequired } from '@/modules/gw/approval/formFields';
import { RelatedDocSearchModal } from '@/modules/gw/approval/RelatedDocSearchModal';
import { DraftConfirmDialog } from './components/DraftConfirmDialog';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { DraftFormSidebar } from './components/DraftFormSidebar';
import { DraftRecipientSection } from './components/DraftRecipientSection';
import { fileStorage } from '@/shared/lib/storage';
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
  const [securityLevel, setSecurityLevel] = useState<'일반' | '대외비' | '극비'>(editDoc?.securityLevel ?? '일반');
  const [preservationPeriod, setPreservationPeriod] = useState<string>(editDoc?.preservationPeriod ?? '5년');

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
  const [relatedDocs, setRelatedDocs] = useState<RelatedDoc[]>(editDoc?.relatedDocs ?? []);
  const [showRelatedModal, setShowRelatedModal] = useState(false);
  const [previewRelatedDoc, setPreviewRelatedDoc] = useState<ApprovalDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [recipients, setRecipients] = useState<ApprovalRecipient[]>(editDoc?.recipients ?? []);
  
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

  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [onlyAllowedForms, setOnlyAllowedForms] = useState(false);

  // Post-Approval (후결) states
  const [isPostApprovalSystemEnabled, setIsPostApprovalSystemEnabled] = useState(false);
  const [isPostApproval, setIsPostApproval] = useState<boolean>(editDoc?.isPostApproval ?? false);
  const [postApprovalReason, setPostApprovalReason] = useState<string>(editDoc?.postApprovalReason ?? '');
  const [postApprovalActionTaken, setPostApprovalActionTaken] = useState<string>(editDoc?.postApprovalActionTaken ?? '');
  const [postApprovalNecessity, setPostApprovalNecessity] = useState<string>(editDoc?.postApprovalNecessity ?? '');
  const [postApprovalCostDetails, setPostApprovalCostDetails] = useState<string>(editDoc?.postApprovalCostDetails ?? '');
  const [postApprovalFollowup, setPostApprovalFollowup] = useState<string>(editDoc?.postApprovalFollowup ?? '');
  const [postApprovedAt, setPostApprovedAt] = useState<string>(editDoc?.postApprovedAt ?? '');
  const [postApprovedById, setPostApprovedById] = useState<string>(editDoc?.postApprovedById ?? '');

  useEffect(() => {
    approvalProcessRepo.isOptionEnabled('post_approval').then((enabled) => {
      setIsPostApprovalSystemEnabled(enabled);
    });
  }, []);

  useEffect(() => {
    if (editDoc) {
      setIsPostApproval(editDoc.isPostApproval ?? false);
      setPostApprovalReason(editDoc.postApprovalReason ?? '');
      setPostApprovalActionTaken(editDoc.postApprovalActionTaken ?? '');
      setPostApprovalNecessity(editDoc.postApprovalNecessity ?? '');
      setPostApprovalCostDetails(editDoc.postApprovalCostDetails ?? '');
      setPostApprovalFollowup(editDoc.postApprovalFollowup ?? '');
      setPostApprovedAt(editDoc.postApprovedAt ?? '');
      setPostApprovedById(editDoc.postApprovedById ?? '');
    }
  }, [editDoc]);

  const initialValuesSnapshot = useRef<Record<string, FieldValue>>({});
  const isInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    isInitializedRef.current = null;
  }, [code]);

  useEffect(() => {
    if (isInitializedRef.current !== code) {
      const timer = setTimeout(() => {
        initialValuesSnapshot.current = { ...values };
        isInitializedRef.current = code;
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [code, values]);

  const hasManuallyEnteredValues = () => {
    if (editDoc) {
      const titleChanged = title.trim() !== (editDoc.title ?? '').trim();
      const bodyChanged = body.trim() !== (editDoc.body ?? '').trim();
      const amountChanged = amount.trim() !== (editDoc.amount != null ? String(editDoc.amount) : '');
      const filesChanged = attachments.length !== (editDoc.attachments ?? []).length;
      const valuesChanged = Object.keys(values).some((k) => values[k] !== editDoc.fieldValues?.[k]);
      const postApprovalChanged = isPostApproval !== (editDoc.isPostApproval ?? false) || postApprovalReason !== (editDoc.postApprovalReason ?? '');
      return titleChanged || bodyChanged || amountChanged || filesChanged || valuesChanged || postApprovalChanged;
    } else {
      const hasTitle = title.trim() !== '';
      const hasBody = body.trim() !== '';
      const hasAmount = amount.trim() !== '';
      const hasFiles = attachments.length > 0;
      const hasPostApproval = isPostApproval || postApprovalReason.trim() !== '';
      const valuesChanged = Object.keys(values).some((k) => {
        const v = values[k];
        if (v === undefined || v === null || String(v).trim() === '') return false;
        const initV = initialValuesSnapshot.current[k];
        if (initV !== undefined && JSON.stringify(v) === JSON.stringify(initV)) return false;
        return true;
      });
      return hasTitle || hasBody || hasAmount || hasFiles || valuesChanged || hasPostApproval;
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

  const [scale, setScale] = useState(1);
  const rightContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rightContentRef.current;
    if (!el) return;

    const updateScale = () => {
      setScale(1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

        // 파일 스토리지 업로드(백엔드는 fileStorage 어댑터가 결정).
        // 미설정 시 어댑터가 data URL 미리보기로 graceful fallback.
        const path = `approvals/${Date.now()}_${file.name}`;
        const url = await fileStorage.put(path, file, {
          contentType: file.type || undefined,
          filename: file.name,
        });
        newFiles.push({ name: file.name, url });
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
    if (form.preservationPeriod) {
      setPreservationPeriod(form.preservationPeriod);
    }
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

    const postApprovedUser = org.userById(postApprovedById);
    const combinedReason = [
      postApprovalActionTaken ? `[선조치 내용 및 결과]\n${postApprovalActionTaken.trim()}` : '',
      postApprovalNecessity ? `[긴급성 및 불가피성 소명]\n${postApprovalNecessity.trim()}` : '',
      postApprovalCostDetails ? `[소요 비용 및 내역]\n${postApprovalCostDetails.trim()}` : '',
      postApprovalFollowup ? `[후속 조치 및 재발 방지 대책]\n${postApprovalFollowup.trim()}` : '',
    ].filter(Boolean).join('\n\n') || postApprovalReason.trim();

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
      relatedDocs,
      securityLevel,
      preservationPeriod,
      isPostApproval: isPostApprovalSystemEnabled ? isPostApproval : false,
      postApprovalReason: isPostApprovalSystemEnabled && isPostApproval ? combinedReason : null,
      postApprovalActionTaken: isPostApprovalSystemEnabled && isPostApproval ? postApprovalActionTaken.trim() : null,
      postApprovalNecessity: isPostApprovalSystemEnabled && isPostApproval ? postApprovalNecessity.trim() : null,
      postApprovalCostDetails: isPostApprovalSystemEnabled && isPostApproval ? postApprovalCostDetails.trim() : null,
      postApprovalFollowup: isPostApprovalSystemEnabled && isPostApproval ? postApprovalFollowup.trim() : null,
      postApprovedAt: isPostApprovalSystemEnabled && isPostApproval ? postApprovedAt : null,
      postApprovedById: isPostApprovalSystemEnabled && isPostApproval ? postApprovedById : null,
      postApprovedByName: isPostApprovalSystemEnabled && isPostApproval && postApprovedUser ? postApprovedUser.name : null,
    };
  };

  const validate = (forSubmit: boolean): string | null => {
    if (!title.trim()) return '제목을 입력하세요.';

    // 후결(사후 승인) 검증
    if (isPostApprovalSystemEnabled && isPostApproval) {
      if (!postApprovalActionTaken.trim() && !postApprovalReason.trim()) {
        return '후결 사후 승인 요청 시 [1. 선조치(긴급 조치) 내용 및 결과] 항목을 입력해 주세요.';
      }
      if (!postApprovalNecessity.trim() && !postApprovalReason.trim()) {
        return '후결 사후 승인 요청 시 [2. 긴급성 및 불가피성 소명 (Why?)] 항목을 입력해 주세요.';
      }
      const totalLen = (postApprovalActionTaken + postApprovalNecessity + postApprovalCostDetails + postApprovalFollowup + postApprovalReason).trim().length;
      if (totalLen < 50) {
        return '후결 사후 승인 소명 및 선조치 내역은 최소 50자 이상 상세히 작성해 주세요.';
      }
      if (!postApprovedAt) {
        return '선조치 일시를 입력해 주세요.';
      }
      if (new Date(postApprovedAt).getTime() > Date.now()) {
        return '선조치 일시는 현재 시간보다 이전으로 설정해야 합니다.';
      }
      if (!postApprovedById) {
        return '선조치 구두/임시 승인자를 선택해 주세요.';
      }
    }
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
    relatedDocs: relatedDocs,
    securityLevel: securityLevel,
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
    isPostApproval: isPostApproval,
    postApprovalReason: postApprovalReason,
    postApprovalActionTaken: postApprovalActionTaken,
    postApprovalNecessity: postApprovalNecessity,
    postApprovalCostDetails: postApprovalCostDetails,
    postApprovalFollowup: postApprovalFollowup,
    postApprovedAt: postApprovedAt,
    postApprovedById: postApprovedById,
    postApprovedByName: org.userById(postApprovedById)?.name ?? null,
  }), [editDoc, code, title, body, me, amount, values, attachments, recipients, steps, executionTarget, form, isPostApproval, postApprovalReason, postApprovalActionTaken, postApprovalNecessity, postApprovalCostDetails, postApprovalFollowup, postApprovedAt, postApprovedById, org]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40" onClick={handleAttemptClose}>
      <div
        className={`flex h-[82vh] max-h-[82vh] w-full flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl transition-all duration-300 ${isFixed ? 'max-w-3xl' : 'w-[90vw] max-w-[1200px]'}`}
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
            <DraftFormSidebar
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              sidebarSearch={sidebarSearch}
              setSidebarSearch={setSidebarSearch}
              onlyAllowedForms={onlyAllowedForms}
              setOnlyAllowedForms={setOnlyAllowedForms}
              sidebarFolders={sidebarFolders}
              openFolders={openFolders}
              toggleFolder={toggleFolder}
              disabledFormCodes={disabledFormCodes}
              code={code}
              setCode={setCode}
              setValues={setValues}
            />
          )}

          {/* 우측 폼 입력 영역 */}
          <div ref={rightContentRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            <div
              style={{
                zoom: scale,
              }}
              className="space-y-4"
            >
              {/* 후결(사후 승인) 옵션 토글 스위치 — 우측 상단 콤팩트 배치 */}
              {isPostApprovalSystemEnabled && (
                <div className="flex justify-end">
                  <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/5 shadow-xs transition-all">
                    <span className="text-[11.5px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                      <span>🚨</span>
                      <span>긴급 선조치 사후 승인 (후결) 요청</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPostApproval}
                      onClick={() => setIsPostApproval(!isPostApproval)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        isPostApproval ? 'bg-rose-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isPostApproval ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* 선조치 내용 공통 섹션 (후결 스위치 ON일 때 동적 노출) */}
              {isPostApprovalSystemEnabled && isPostApproval && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4 flex flex-col gap-3.5 shadow-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                    <span className="text-[12.5px] font-extrabold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <span>📋</span>
                      <span>선조치 내용 (후결 사후 승인 필수 증빙 항목)</span>
                    </span>
                    <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
                      사후 감사 증빙 필수
                    </span>
                  </div>

                  {/* 1. 선조치(긴급 조치) 내용 및 결과 (텍스트, 전체) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-bold text-ink flex items-center gap-1">
                      <span>1. 선조치(긴급 조치) 내용 및 결과</span>
                      <span className="text-rose-500">*</span>
                      <span className="text-[10.5px] font-normal text-ink3 ml-1">(언제, 어떤 상황에서, 어떤 조치를 취했는지 상세 팩트)</span>
                    </label>
                    <textarea
                      value={postApprovalActionTaken}
                      onChange={(e) => setPostApprovalActionTaken(e.target.value)}
                      placeholder="예: 8월 5일 오후 2시 공장 메인 서버 다운으로 긴급 외주 업체를 불러 서버 모듈 교체 및 복구 완료."
                      rows={2}
                      className="w-full rounded-lg border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* 2. 긴급성 및 불가피성 소명 (Why?) (텍스트, 전체) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-bold text-ink flex items-center gap-1">
                      <span>2. 긴급성 및 불가피성 소명 (Why?)</span>
                      <span className="text-rose-500">*</span>
                      <span className="text-[10.5px] font-normal text-ink3 ml-1">(사전 결재 미진행 이유 및 미선조치 시 예상 치명적 손해)</span>
                    </label>
                    <textarea
                      value={postApprovalNecessity}
                      onChange={(e) => setPostApprovalNecessity(e.target.value)}
                      placeholder="왜 사전에 결재를 올릴 시간이 없었는지, 만약 선조치하지 않고 결재를 기다렸다면 회사에 발생했을 손해(생산 중단, 보안 사고 등)를 설명하세요."
                      rows={2}
                      className="w-full rounded-lg border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* 3. 소요 비용 및 후속 조치 (2열) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] font-bold text-ink flex items-center gap-1">
                        <span>3. 소요 비용 및 집행 내역</span>
                        <span className="text-[10.5px] font-normal text-ink3">(영수증/견적서 하단 첨부 필수)</span>
                      </label>
                      <textarea
                        value={postApprovalCostDetails}
                        onChange={(e) => setPostApprovalCostDetails(e.target.value)}
                        placeholder="선조치 과정에서 발생한 정확한 금액과 수리비/계약 내역"
                        rows={2}
                        className="w-full rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12px] text-ink outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] font-bold text-ink flex items-center gap-1">
                        <span>4. 후속 조치 및 재발 방지 대책</span>
                        <span className="text-[10.5px] font-normal text-ink3">(예방 대책 및 잔여 업무)</span>
                      </label>
                      <textarea
                        value={postApprovalFollowup}
                        onChange={(e) => setPostApprovalFollowup(e.target.value)}
                        placeholder="향후 유사 비상 상황 예방 대책 및 미마무리 잔여 업무 계획"
                        rows={2}
                        className="w-full rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12px] text-ink outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-rose-500/15">
                    {/* 선조치 일시 (날짜, 2열, 현재 시간 이전이어야 함) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] font-bold text-ink flex items-center gap-1">
                        <span>선조치 일시</span>
                        <span className="text-rose-500">*</span>
                        <span className="text-[10px] font-normal text-rose-500">(현재 시간 이전 필수)</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={postApprovedAt}
                        onChange={(e) => setPostApprovedAt(e.target.value)}
                        className="w-full rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12px] text-ink outline-none focus:border-rose-500"
                      />
                    </div>

                    {/* 선조치 승인자 (사용자, 2열) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] font-bold text-ink flex items-center gap-1">
                        <span>선조치 구두/임시 승인자</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={postApprovedById}
                        onChange={(e) => setPostApprovedById(e.target.value)}
                        className="w-full rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12px] font-medium text-ink outline-none focus:border-rose-500"
                      >
                        <option value="">-- 선조치 승인자 선택 --</option>
                        {org.users.filter((u) => u.status === '사용').map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.dept} / {u.position})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Field label="제목">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="문서 제목" className={INP} />
                  </Field>
                </div>
                <div className="col-span-1">
                  <Field label="보존연한">
                    <select
                      value={preservationPeriod}
                      onChange={(e) => setPreservationPeriod(e.target.value)}
                      className={`${INP} font-semibold text-ink`}
                    >
                      <option value="1년">1년</option>
                      <option value="3년">3년</option>
                      <option value="5년">5년</option>
                      <option value="10년">10년</option>
                      <option value="영구">영구</option>
                    </select>
                  </Field>
                </div>
                <div className="col-span-1">
                  <Field label="보안 등급">
                    <select
                      value={securityLevel}
                      onChange={(e) => setSecurityLevel(e.target.value as '일반' | '대외비' | '극비')}
                      className={`${INP} font-semibold ${
                        securityLevel === '극비'
                          ? 'text-red-600 bg-red-500/5'
                          : securityLevel === '대외비'
                          ? 'text-amber-600 bg-amber-500/5'
                          : 'text-ink'
                      }`}
                    >
                      <option value="일반">일반 문서</option>
                      <option value="대외비">🔒 대외비</option>
                      <option value="극비">⛔ 극비</option>
                    </select>
                  </Field>
                </div>
              </div>

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

            {/* 서식 동적 필드 (언제나 2열 가로 비중 유지) */}
            {fieldNodes.length > 0 && <div className="grid grid-cols-2 gap-3">{fieldNodes}</div>}



            {/* 결재선 및 수신/시행 설정 그룹 */}
            <div className="mt-4 rounded-2xl border border-border bg-panel-alt/45 p-4 space-y-4">
              {/* 결재선 설정 */}
              <div>
                <div className="mb-1.5 text-[11.5px] font-bold text-ink2">결재선 설정</div>
                <ApprovalLineBuilder steps={steps} onChange={setSteps} drafterId={me.id} docType={code} amount={amountNum} docData={values} />
              </div>

              <DraftRecipientSection
                recipients={recipients}
                setRecipients={setRecipients}
                executionTarget={executionTarget}
                setExecutionTarget={setExecutionTarget}
                org={org}
              />
            </div>

            {/* 관련 문서 연결 (relatedDocs) 영역 */}
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-bold text-ink2 flex items-center gap-1">
                  <span>🔗 관련 문서 연결</span>
                  <span className="text-[10px] font-normal text-ink3">(기결재 완료 문서)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRelatedModal(true)}
                  className="rounded-lg bg-teal-soft px-2 py-1 text-[10.5px] font-bold text-teal hover:bg-teal/20 transition-colors"
                >
                  + 관련 문서 선택
                </button>
              </div>

              {/* 연동된 관련 문서 목록 태그 */}
              {relatedDocs.length === 0 ? (
                <p className="text-[10.5px] text-ink3 pl-0.5">연동된 관련 문서가 없습니다.</p>
              ) : (
                <div className="space-y-1.5 mt-2">
                  {relatedDocs.map((rd) => (
                    <div
                      key={rd.docId}
                      className="flex items-center justify-between rounded-xl bg-panel-alt border border-teal/20 p-2.5 shadow-sm text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10.5px] text-teal font-semibold shrink-0">
                          [{rd.docNo}]
                        </span>
                        <span className="font-semibold text-ink truncate">{rd.title}</span>
                        <span className="text-[10px] text-ink3 shrink-0">
                          ({rd.docType} | {rd.drafterName})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const found = await approvalDocRepo.getById(rd.docId);
                            if (found) {
                              setPreviewRelatedDoc(found);
                            } else {
                              setError('삭제되었거나 접근할 수 없는 문서입니다.');
                            }
                          }}
                          className="rounded bg-panel px-2 py-0.5 text-[10px] font-bold text-teal border border-teal/30 hover:bg-teal-soft/30 transition-colors"
                        >
                          미리보기
                        </button>
                        <button
                          type="button"
                          onClick={() => setRelatedDocs((prev) => prev.filter((x) => x.docId !== rd.docId))}
                          className="text-[11px] font-bold text-ink3 hover:text-red-500 px-1"
                          title="연결 해제"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
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
          </div>
        </div>
      </div>

        {/* 고정 하단 메뉴 바 (모달 카드 내부 하단 고정) */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-5 py-3 bg-panel">
          {/* 에러 알림 메시지 (에러가 있을 때만 공간을 차지하도록 수정) */}
          <div className="flex-1 min-w-0">
            {error ? (
              <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[11.5px] font-semibold text-red-500 animate-fade-in truncate max-w-[420px]" title={error}>
                ⚠️ {error}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={busy}
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={busy}
              className="rounded-lg border border-border-hi bg-panel px-3.5 py-2 text-[12.5px] font-semibold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50"
            >
              미리보기
            </button>
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={busy}
              className="rounded-lg border border-border-hi bg-panel-alt px-3.5 py-2 text-[12.5px] font-semibold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50"
            >
              {isResubmit ? '저장' : '임시저장'}
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={busy}
              className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '처리 중…' : isResubmit ? '재상신' : '상신'}
            </button>
          </div>
        </div>
      </div>

      {showConfirmClose && (
        <DraftConfirmDialog
          title="기안 작성 중단"
          description={<>기안 작성을 중단하시겠습니까?<br />임시저장하거나 작성중인 내용을 취소할 수 있습니다.</>}
          confirmLabel="임시저장 후 중단"
          confirmColor="bg-teal"
          onConfirm={handleConfirmCloseSave}
          onDiscard={onClose}
          discardLabel="변경내용 모두 취소"
          onCancel={() => setShowConfirmClose(false)}
          disabled={busy}
        />
      )}

      {showConfirmDiscard && (
        <DraftConfirmDialog
          title="기안 작성 취소"
          description={<>기안 작성을 취소하시겠습니까?<br />작성 중이던 내용은 저장되지 않습니다.</>}
          confirmLabel="변경내용 모두 취소"
          confirmColor="bg-danger"
          onConfirm={onClose}
          onCancel={() => setShowConfirmDiscard(false)}
        />
      )}

      {showPreview && (
        <DocumentPreviewModal
          title="문서 미리보기"
          doc={mockDoc}
          currentUser={me}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showRelatedModal && (
        <RelatedDocSearchModal
          userId={me.id}
          userDept={me.dept}
          selectedDocIds={relatedDocs.map((x) => x.docId)}
          onSelect={(selectedList) => {
            setRelatedDocs((prev) => {
              const existingIds = new Set(prev.map((x) => x.docId));
              const newItems = selectedList.filter((x) => !existingIds.has(x.docId));
              return [...prev, ...newItems];
            });
          }}
          onClose={() => setShowRelatedModal(false)}
        />
      )}

      {previewRelatedDoc && (
        <DocumentPreviewModal
          title={`관련 문서 미리보기 [${previewRelatedDoc.docNo}]`}
          doc={previewRelatedDoc}
          currentUser={me}
          onClose={() => setPreviewRelatedDoc(null)}
        />
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
