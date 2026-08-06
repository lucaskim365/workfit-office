import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import type { User } from '@/domain/user/schema';
import {
  type ApprovalDoc,
  type ApprovalStep,
  type LeaveForm,
  type LeaveType,
  type ApprovalRecipient,
  type RelatedDoc,
} from '@/domain/approvalDoc/schema';
import { RESERVED_BODY_KEY, amountFieldOf, type ApprovalForm, type FieldValue } from '@/domain/approvalForm/schema';
import { type ApprovalDraftInput } from '@/data/approvalDoc/approvalDoc.repo';
import { approvalProcessRepo } from '@/data/approvalProcess/approvalProcess.repo';
import { useCreateDraft, useSaveDraft, useSubmitApproval, useApprovalDoc } from '@/features/gw/useApprovals';
import { useActiveApprovalForms, useApprovalFolders } from '@/features/gw/useApprovalForms';
import { useRouteEngine } from '@/features/gw/useRouteEngine';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useLeave } from '@/features/gw/useLeave';
import { ApprovalLineBuilder } from '@/modules/gw/approval/ApprovalLineBuilder';
import { DynamicField } from '@/modules/gw/approval/formFields';
import { RelatedDocSearchModal } from '@/modules/gw/approval/RelatedDocSearchModal';
import { DraftConfirmDialog } from './components/DraftConfirmDialog';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { DraftFormSidebar } from './components/DraftFormSidebar';
import { DraftRecipientSection } from './components/DraftRecipientSection';
import { fileStorage } from '@/shared/lib/storage';

export default function ApprovalDraftScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: editDocId } = useParams<{ id?: string }>();

  // 수정할 문서가 있는 경우 전체 목록 훅을 통해 단일 문서 도출
  const fetchedDoc = useApprovalDoc(editDocId);

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center py-20 text-[13px] text-ink3">
        로그인이 필요한 서비스입니다.
      </div>
    );
  }

  return <ApprovalDraftInner me={user} editDoc={fetchedDoc ?? null} fixedType={params.get('type') ?? undefined} navigate={navigate} />;
}

function ApprovalDraftInner({
  me,
  editDoc,
  fixedType,
  navigate,
}: {
  me: User;
  editDoc?: ApprovalDoc | null;
  fixedType?: string;
  navigate: (url: string) => void;
}) {
  const { data: forms = [] } = useActiveApprovalForms();
  const org = useOrgTree();
  const bal = useLeave(me.id);

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

  const setVals = (patch: Record<string, FieldValue>) => setValues((prev) => ({ ...prev, ...patch }));
  const selectedLeaveType = String(values['leaveType'] || '연차');
  const [steps, setSteps] = useState<ApprovalStep[]>(editDoc?.steps ?? []);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(editDoc?.attachments ?? []);
  const [relatedDocs, setRelatedDocs] = useState<RelatedDoc[]>(editDoc?.relatedDocs ?? []);
  const [showRelatedModal, setShowRelatedModal] = useState(false);
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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [onlyAllowedForms, setOnlyAllowedForms] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false); // 해상도 작을 때 결재선 Drawer

  // 후결(사후 승인) 옵션
  const [isPostApprovalSystemEnabled, setIsPostApprovalSystemEnabled] = useState(false);
  const [isPostApproval, setIsPostApproval] = useState<boolean>(editDoc?.isPostApproval ?? false);
  const [postApprovalReason] = useState<string>(editDoc?.postApprovalReason ?? '');
  const [postApprovalActionTaken, setPostApprovalActionTaken] = useState<string>(editDoc?.postApprovalActionTaken ?? '');
  const [postApprovalNecessity, setPostApprovalNecessity] = useState<string>(editDoc?.postApprovalNecessity ?? '');
  const [postApprovalCostDetails] = useState<string>(editDoc?.postApprovalCostDetails ?? '');
  const [postApprovalFollowup] = useState<string>(editDoc?.postApprovalFollowup ?? '');

  const defaultPostApprovedAt = useMemo(() => {
    if (editDoc?.postApprovedAt) return editDoc.postApprovedAt;
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  }, [editDoc]);

  const [postApprovedAt, setPostApprovedAt] = useState<string>(defaultPostApprovedAt);
  const [postApprovedById, setPostApprovedById] = useState<string>(editDoc?.postApprovedById ?? me.id);

  useEffect(() => {
    approvalProcessRepo.isOptionEnabled('post_approval').then((enabled) => {
      setIsPostApprovalSystemEnabled(enabled);
    });
  }, []);

  useEffect(() => {
    if (editDoc) {
      setCode(editDoc.docType);
      setTitle(editDoc.title ?? '');
      setSecurityLevel(editDoc.securityLevel ?? '일반');
      setPreservationPeriod(editDoc.preservationPeriod ?? '5년');
      setBody(editDoc.body ?? '');
      setAmount(editDoc.amount != null ? String(editDoc.amount) : '');
      const initialVals = { ...(editDoc.fieldValues ?? {}) };
      if (editDoc.docType === '휴가' && editDoc.form) {
        if (!initialVals['leaveType']) initialVals['leaveType'] = editDoc.form.leaveType;
        if (!initialVals['period']) initialVals['period'] = editDoc.form.startDate;
        if (!initialVals['period__end']) initialVals['period__end'] = editDoc.form.endDate;
        if (!initialVals['period__days']) initialVals['period__days'] = editDoc.form.days;
      }
      setValues(initialVals);
      setSteps(editDoc.steps ?? []);
      setAttachments(editDoc.attachments ?? []);
      setRelatedDocs(editDoc.relatedDocs ?? []);
      setRecipients(editDoc.recipients ?? []);
      setIsPostApproval(editDoc.isPostApproval ?? false);
      setPostApprovalActionTaken(editDoc.postApprovalActionTaken ?? '');
      setPostApprovalNecessity(editDoc.postApprovalNecessity ?? '');
      if (editDoc.postApprovedAt) setPostApprovedAt(editDoc.postApprovedAt);
      if (editDoc.postApprovedById) setPostApprovedById(editDoc.postApprovedById);
    }
  }, [editDoc]);

  const isFixed = !!fixedType || !!editDoc;

  const hasManuallyEnteredValues = (): boolean => {
    if (editDoc) {
      const titleChanged = title !== (editDoc.title ?? '');
      const bodyChanged = body !== (editDoc.body ?? '');
      const amountChanged = amount !== (editDoc.amount != null ? String(editDoc.amount) : '');
      const filesChanged = JSON.stringify(attachments) !== JSON.stringify(editDoc.attachments ?? []);
      const valuesChanged = Object.keys(values).some((k) => JSON.stringify(values[k]) !== JSON.stringify((editDoc.fieldValues ?? {})[k]));
      const postApprovalChanged = isPostApproval !== (editDoc.isPostApproval ?? false) || postApprovalReason !== (editDoc.postApprovalReason ?? '');
      return titleChanged || bodyChanged || amountChanged || filesChanged || valuesChanged || postApprovalChanged;
    } else {
      // 1) DB(approvalForms)에서 현재 선택된 서식 마스터 정보 추출
      const formMaster = forms.find((f) => f.code === code);
      const dbDocTitle = (formMaster?.docTitle || formMaster?.name || '').trim();

      // 2) 문서 제목 비교: 제목을 안 입력했거나 DB 서식 기본 문서명(예: '계약품의서', '휴가신청서')과 동일하면 미입력
      const curTitle = title.trim();
      const titleHasChanged = curTitle !== '' && curTitle !== dbDocTitle;

      // 3) 본문 내용 비교: 서식 본문 필드 placeholder 가이드글과 동일하거나 비어있으면 미입력
      const curBody = (values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]) : body).trim();
      const bodyFieldMaster = formMaster?.fields?.find((f) => f.key === RESERVED_BODY_KEY);
      const dbDefaultBodyPlaceholder = String(bodyFieldMaster?.placeholder || '').trim();
      const bodyHasChanged = curBody !== '' && curBody !== dbDefaultBodyPlaceholder;

      // 4) 금액 / 첨부파일 / 관련문서 / 후결요청 검증
      const amountHasEntered = amount.trim() !== '';
      const filesHasEntered = attachments.length > 0;
      const relatedDocsHasEntered = relatedDocs.length > 0;
      const postApprovalHasEntered = isPostApproval || postApprovalReason.trim() !== '';

      // 5) 동적 서식 필드 검증: 사용자가 서식 기본 가이드글(placeholder) 외에 직접 입력했는가?
      const valuesHasChanged = Object.keys(values).some((k) => {
        if (k === RESERVED_BODY_KEY) return false;
        const valStr = String(values[k] ?? '').trim();
        if (!valStr) return false;

        const fieldMaster = formMaster?.fields?.find((f) => f.key === k);
        const dbPlaceholder = String(fieldMaster?.placeholder || '').trim();

        // 서식 기본 placeholder 거나 기본 선택값인 경우 미입력으로 처리
        if (dbPlaceholder && valStr === dbPlaceholder) return false;

        // 휴가 신청 기본값(연차, 일수 등) 자동 세팅값인 경우 미입력 처리
        if (code === '휴가' && (k === 'leaveType' || k === 'period__days')) return false;

        return true;
      });

      return titleHasChanged || bodyHasChanged || amountHasEntered || filesHasEntered || relatedDocsHasEntered || valuesHasChanged || postApprovalHasEntered;
    }
  };

  const handleAttemptClose = () => {
    if (hasManuallyEnteredValues()) {
      setShowConfirmClose(true);
    } else {
      navigate('/gw/approval');
    }
  };

  const create = useCreateDraft();
  const save = useSaveDraft();
  const submitM = useSubmitApproval();
  const route = useRouteEngine();
  const busy = create.isPending || save.isPending || submitM.isPending || uploading;

  const form: ApprovalForm | undefined = useMemo(() => forms.find((x) => x.code === code), [forms, code]);
  const amountField = form ? amountFieldOf(form) : undefined;

  const amountNum = useMemo(() => {
    if (amountField && values[amountField.key] != null && values[amountField.key] !== '') {
      const n = Number(String(values[amountField.key]).replace(/,/g, ''));
      if (!isNaN(n)) return n;
    }
    const n = Number(amount.replace(/,/g, ''));
    return isNaN(n) || !amount ? null : n;
  }, [amount, amountField, values]);

  // 실시간 결재선 규칙 엔진 연동
  const lastAutoSteps = useRef<string>('');
  useEffect(() => {
    if (route.isLoading || !code || editDoc) return;
    const line = route.build({ drafterId: me.id, docType: code, amount: amountNum, docData: values });
    const lineStr = JSON.stringify(line);
    const currentStr = JSON.stringify(steps);

    if (steps.length === 0 || currentStr === lastAutoSteps.current) {
      if (currentStr !== lineStr) {
        setSteps(line);
        lastAutoSteps.current = lineStr;
      }
    }
  }, [code, amountNum, values, route, me.id, steps, editDoc]);

  const isResubmit = !!editDoc && editDoc.status !== '임시저장';

  const buildInput = (): ApprovalDraftInput => {
    let leave: LeaveForm | null = null;
    if (code === '휴가') {
      const pStart = String(values['period'] || '');
      const pEnd = String(values['period__end'] || '');
      const pDays = Number(values['period__days']) || 0;
      const lType = String(values['leaveType'] || '연차') as LeaveType;
      leave = { leaveType: lType, startDate: pStart, endDate: pEnd, days: pDays };
    }
    const execution = executionTarget
      ? { docId: editDoc?.id ?? '', targetType: executionTarget.type, targetId: executionTarget.id, status: '대기중' as const, comment: '' }
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

    if (isPostApprovalSystemEnabled && isPostApproval) {
      if (!postApprovalActionTaken.trim() && !postApprovalReason.trim()) {
        return '후결 사후 승인 요청 시 [1. 선조치(긴급 조치) 내용 및 결과] 항목을 입력해 주세요.';
      }
      if (!postApprovalNecessity.trim() && !postApprovalReason.trim()) {
        return '후결 사후 승인 요청 시 [2. 긴급성 및 불가피성 소명 (Why?)] 항목을 입력해 주세요.';
      }
      const totalLen = (postApprovalActionTaken + postApprovalNecessity + postApprovalCostDetails + postApprovalFollowup + postApprovalReason).trim().length;
      if (totalLen < 50) return '후결 사후 승인 소명 및 선조치 내역은 최소 50자 이상 상세히 작성해 주세요.';
      if (!postApprovedAt) return '선조치 일시를 입력해 주세요.';
      if (new Date(postApprovedAt).getTime() > Date.now()) return '선조치 일시는 현재 시간보다 이전으로 설정해야 합니다.';
      if (!postApprovedById) return '선조치 구두/임시 승인자를 선택해 주세요.';
    }

    if (code === '휴가') {
      const pStart = values['period'];
      const pEnd = values['period__end'];
      const pDays = Number(values['period__days']) || 0;
      if (!pStart || !pEnd || pDays <= 0) return '휴가 기간을 올바르게 입력하세요.';

      const lType = String(values['leaveType'] || '연차');
      if (lType === '연차' || lType === '반차') {
        if (pDays > bal.remaining) return `잔여 연차(${bal.remaining}일)를 초과하여 신청할 수 없습니다.`;
      }
    }

    if (forSubmit) {
      if (form) {
        const userRank = org.positions.find((p) => p.name === me.position)?.rank ?? 9;
        if (form.allowedPositionFromRank != null && userRank > form.allowedPositionFromRank) {
          let neededTitle = '상급자';
          if (form.allowedPositionFromRank === 1) neededTitle = '대표';
          else if (form.allowedPositionFromRank === 2) neededTitle = '본부장';
          else if (form.allowedPositionFromRank === 3 || form.allowedPositionFromRank === 4) neededTitle = '팀장';
          else if (form.allowedPositionFromRank >= 5) neededTitle = '팀원';
          return `본 서식의 기안 권한이 없습니다. (${neededTitle} 이상 기안 가능)`;
        }
      }

      if (!steps.some((s) => s.kind !== '참조')) return '상신하려면 결재자를 1명 이상 지정하세요.';
    }
    return null;
  };

  // 사용자의 직책 권한에 따라 비활성화할 서식(forms) 판정
  const disabledFormCodes = useMemo(() => {
    const userRank = org.positions.find((p) => p.name === me.position)?.rank ?? 9;
    const userDeptNode = org.depts.find((d) => d.name === me.dept);
    const userDeptId = userDeptNode?.id ?? null;
    const disabledCodes = new Set<string>();

    for (const f of forms) {
      if (f.code === '기안' || f.code === '전체') continue;

      if (f.allowedPositionFromRank != null && userRank > f.allowedPositionFromRank) {
        disabledCodes.add(f.code);
        continue;
      }
      if (f.allowedPositionToRank != null && userRank < f.allowedPositionToRank) {
        disabledCodes.add(f.code);
        continue;
      }
      if (f.allowedDeptIds && f.allowedDeptIds.length > 0) {
        if (!userDeptId || !f.allowedDeptIds.includes(userDeptId)) {
          disabledCodes.add(f.code);
          continue;
        }
      }
    }
    return disabledCodes;
  }, [forms, me.position, me.dept, org]);

  useEffect(() => {
    if (disabledFormCodes.has(code)) {
      const available = forms.find((f) => f.code !== '전체' && !disabledFormCodes.has(f.code));
      if (available) setCode(available.code);
    }
  }, [disabledFormCodes, code, forms]);



  const persistDraft = async (): Promise<string> => {
    const input = buildInput();
    if (editDoc && editDoc.status === '임시저장') {
      await save.mutateAsync({ id: editDoc.id, patch: input });
      return editDoc.id;
    }
    const created = await create.mutateAsync(input);
    return created.id;
  };

  const onSaveDraft = async () => {
    const err = validate(false);
    if (err) return setError(err);
    setError('');
    try {
      await persistDraft();
      navigate('/gw/approval?box=임시');
    } catch (e) {
      setError(String(e));
    }
  };

  const onSubmit = async () => {
    const err = validate(true);
    if (err) return setError(err);
    setError('');
    try {
      const id = await persistDraft();
      await submitM.mutateAsync({ id, userId: me.id });
      navigate('/gw/approval?box=상신');
    } catch (e) {
      setError(String(e));
    }
  };

  // 폼 필드 노드 렌더링
  const tabSelectorField = form?.fields.find((f) => f.type === '선택' && f.isTabSelector);
  const currentTabValue = tabSelectorField ? String(values[tabSelectorField.key] ?? '') : '';

  const fieldNodes: React.ReactNode[] = [];
  let lastSection = '';
  for (const field of form?.fields ?? []) {
    if (field.visibleIf) {
      const parts = field.visibleIf.split(':');
      if (parts.length === 2) {
        const [condKey, condVal] = parts;
        if (String(values[condKey] ?? '') !== condVal) continue;
      }
    }

    const isCommonField = !field.visibleIf;
    const override: { width?: 'full' | 'half'; section?: string } =
      (isCommonField && currentTabValue && field.tabOverrides?.[currentTabValue]) || {};
    const effectiveWidth = (override.width ?? field.width) as 'full' | 'half';
    const effectiveSection = override.section ?? field.section;

    if (effectiveSection && effectiveSection !== lastSection) {
      lastSection = effectiveSection;
      fieldNodes.push(
        <div key={`sec-${effectiveSection}`} className="col-span-2 mt-2 text-[11.5px] font-bold text-teal border-b border-teal/20 pb-1">
          {effectiveSection}
        </div>,
      );
    }
    const span = effectiveWidth === 'half' ? 'col-span-1' : 'col-span-2';
    if (field.type === '금액' && field === amountField) {
      fieldNodes.push(
        <div key={field.key} className={span}>
          <Field label={field.label}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="예: 3000000" className={INP} />
            {amountNum != null && <span className="mt-1 block text-[11px] text-ink3">₩{amountNum.toLocaleString()}</span>}
          </Field>
        </div>,
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
              rows={8}
              placeholder={field.placeholder || '내용을 입력하세요'}
              className={`${INP} resize-y leading-relaxed`}
            />
          </Field>
        </div>,
      );
    } else {
      fieldNodes.push(
        <div key={field.key} className={span}>
          <Field label={field.label + (field.required ? ' *' : '')}>
            <DynamicField field={field} values={values} set={setVals} org={org} />
          </Field>
        </div>,
      );
    }
  }

  const { data: folders = [] } = useApprovalFolders();
  const sidebarFolders = useMemo(() => {
    const filteredForms = forms.filter((f) => {
      if (f.code === '전체' || !f.active) return false;
      if (sidebarSearch.trim() && !f.name.toLowerCase().includes(sidebarSearch.toLowerCase()) && !f.code.toLowerCase().includes(sidebarSearch.toLowerCase())) {
        return false;
      }
      if (onlyAllowedForms && disabledFormCodes.has(f.code)) {
        return false;
      }
      return true;
    });

    const list = folders
      .map((f) => ({
        ...f,
        forms: filteredForms.filter((form) => form.folderId === f.id),
      }))
      .filter((f) => f.forms.length > 0);

    const others = filteredForms.filter((form) => !form.folderId);
    if (others.length > 0) {
      list.push({
        id: 'others',
        name: '기타 서식',
        order: 999,
        forms: others,
      });
    }
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [folders, forms, sidebarSearch, onlyAllowedForms, disabledFormCodes]);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const toggleFolder = (id: string) => setOpenFolders((p) => ({ ...p, [id]: p[id] === false ? true : false }));

  const previewDoc: ApprovalDoc = useMemo(
    () => ({
      id: editDoc?.id ?? 'preview-doc-id',
      docNo: editDoc?.docNo ?? 'DRAFT-PREVIEW',
      docType: code,
      title: title || '(제목 없음)',
      body: values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]) : body,
      drafterId: me.id,
      drafterDept: me.dept,
      status: '진행중',
      amount: amountNum,
      securityLevel,
      createdAt: new Date().toISOString(),
      submittedAt: null,
      completedAt: null,
      currentSeq: 0,
      fieldValues: values,
      attachments,
      recipients,
      relatedDocs,
      steps,
      form:
        code === '휴가'
          ? {
            leaveType: String(values['leaveType'] || '연차') as LeaveType,
            startDate: String(values['period'] || ''),
            endDate: String(values['period__end'] || ''),
            days: Number(values['period__days']) || 0,
          }
          : null,
      execution: executionTarget
        ? { docId: editDoc?.id ?? 'preview-doc-id', targetType: executionTarget.type, targetId: executionTarget.id, status: '대기중' as const, comment: '' }
        : null,
      preservationPeriod: values['preservationPeriod'] ? String(values['preservationPeriod']) : (form?.preservationPeriod ?? '3년'),
      isPostApproval,
      postApprovalReason,
      postApprovalActionTaken,
      postApprovalNecessity,
      postApprovalCostDetails,
      postApprovalFollowup,
      postApprovedAt,
      postApprovedById,
      postApprovedByName: org.userById(postApprovedById)?.name ?? null,
    }),
    [editDoc, code, title, body, me, amountNum, values, attachments, recipients, steps, executionTarget, form, isPostApproval, postApprovalReason, postApprovalActionTaken, postApprovalNecessity, postApprovalCostDetails, postApprovalFollowup, postApprovedAt, postApprovedById, org, securityLevel, relatedDocs],
  );

  return (
    <div className="flex w-full flex-col bg-panel">
      {/* 상단 헤더 툴바 — body 스크롤 기준으로 sticky top-0 고정
           (/gw에서 main overflow 없음 → body가 스크롤 → 스크롤 내리면 Topbar가 사라지고 이 헤더가 스크린 상단에 고정됨) */}
      <header className="sticky top-0 z-[200] flex shrink-0 items-center justify-between border-b border-border bg-panel/95 backdrop-blur-md px-6 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAttemptClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[16px] text-ink3 hover:bg-panel-alt transition-colors"
            title="목록으로 돌아가기"
          >
            ←
          </button>
          <div>
            <h1 className="text-[16px] font-bold text-ink flex items-center gap-2">
              <span>{isResubmit ? '반려 문서 수정·재상신' : editDoc ? '기안 문서 편집' : fixedType === '휴가' ? '휴가 신청' : '새 결재 작성'}</span>
              <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-extrabold text-teal">
                {code}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 해상도 작을 때 우측 결재선 Drawer 호출 버튼 */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="xl:hidden flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal-soft/50 px-3 py-1.5 text-[12px] font-bold text-teal hover:bg-teal-soft transition-colors"
          >
            <span>🔗 결재선</span>
            <span className="rounded-full bg-teal px-1.5 py-0.2 text-[10px] font-extrabold text-white">
              {steps.length}명
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="rounded-lg border border-border px-3.5 py-1.5 text-[12px] font-bold text-ink2 hover:bg-panel-alt transition-colors"
          >
            미리보기
          </button>
          {!isResubmit && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={busy}
              className="rounded-lg border border-border px-3.5 py-1.5 text-[12px] font-bold text-ink2 hover:bg-panel-alt transition-colors disabled:opacity-50"
            >
              임시저장
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="rounded-lg bg-teal px-4 py-1.5 text-[12.5px] font-bold text-white hover:bg-teal-dark transition-colors shadow-xs disabled:opacity-50"
          >
            {busy ? '상신 중...' : isResubmit ? '재상신' : '상신 발송'}
          </button>
        </div>
      </header>

      {/* 에러 메시지 팝업 바 */}
      {error && (
        <div className="flex items-center justify-between bg-rose-500/10 border-b border-rose-500/30 px-6 py-2 text-[12px] font-bold text-rose-600">
          <span>⚠ {error}</span>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* 3단 워크스페이스 본문 메인 레이아웃 */}
      <div className="flex flex-1">
        {/* [1단] 좌측 서식 탐색 사이드바 (Wide/Desktop 전용, 서식 변경 가능 시만 노출) */}
        {!isFixed && (
          <div className={`transition-all duration-300 border-r border-border bg-panel-alt/50 shrink-0 sticky self-start overflow-y-auto overflow-x-hidden ${sidebarOpen ? 'w-[210px]' : 'w-[46px]'}`} style={{ top: '53px', height: 'calc(100vh - 53px)' }}>
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
          </div>
        )}

        {/* 2단: 기안 작성 영역 (3단 우측 패널보다 레이어 우선순위를 낮게 z-0 설정) */}
        <div className="flex-1 min-w-0 px-6 py-6 space-y-5 bg-panel relative z-0">

          {/* 작성 흐름 안내 헤더 */}
          <div className="flex items-center gap-2 pb-1">
            <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-teal">
              <span className="text-[14px] font-bold text-ink flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white text-[10px] font-extrabold">2</span>
                <span>기안 작성</span>
              </span>

            </div>
          </div>


          {/* 후결 필수 소명 입력 서식 카드 */}
          {isPostApprovalSystemEnabled && isPostApproval && (
            <div className="rounded-xl border-2 border-rose-500/40 bg-rose-500/5 p-4 space-y-4 shadow-sm">
              <div className="border-b border-rose-500/20 pb-2 flex items-center justify-between">
                <span className="text-[13px] font-extrabold text-rose-700 flex items-center gap-1.5">
                  📋 후결 사후 승인 사유 및 소명서 (필수 작성)
                </span>
                <span className="text-[10.5px] text-rose-600/80 font-medium">
                  ※ 선조치 후 사후 승인을 받기 위한 정당성 소명 양식입니다.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="선조치 일시 *">
                  <input
                    type="datetime-local"
                    value={postApprovedAt}
                    onChange={(e) => setPostApprovedAt(e.target.value)}
                    className={INP}
                  />
                </Field>
                <Field label="구두/임시 승인자 *">
                  <select
                    value={postApprovedById}
                    onChange={(e) => setPostApprovedById(e.target.value)}
                    className={INP}
                  >
                    {org.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.dept} · {u.position})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="1. 선조치 내용 및 결과 *">
                <textarea
                  value={postApprovalActionTaken}
                  onChange={(e) => setPostApprovalActionTaken(e.target.value)}
                  rows={2}
                  placeholder="긴급 조치한 업무 내용 및 현재 처리 결과를 기술하세요."
                  className={`${INP} resize-none`}
                />
              </Field>

              <Field label="2. 긴급성 및 불가피성 소명 (Why?) *">
                <textarea
                  value={postApprovalNecessity}
                  onChange={(e) => setPostApprovalNecessity(e.target.value)}
                  rows={2}
                  placeholder="사전 결재를 진행하지 못하고 선조치해야만 했던 소명 사유를 기술하세요."
                  className={`${INP} resize-none`}
                />
              </Field>
            </div>
          )}

          {/* 기본 문서 속성 (제목 / 보안등급 / 보존연한) */}
          <div className="rounded-xl border border-border bg-panel-alt p-4 space-y-3.5 shadow-2xs">
            <Field label="문서 제목 *">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="문서 제목을 입력하세요"
                className={`${INP} text-[13.5px] font-bold text-ink`}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3 items-end">
              <Field label="보안등급">
                <select
                  value={securityLevel}
                  onChange={(e) => setSecurityLevel(e.target.value as any)}
                  className={INP}
                >
                  <option value="일반">일반</option>
                  <option value="대외비">대외비</option>
                  <option value="극비">극비</option>
                </select>
              </Field>

              <Field label="보존연한">
                <select
                  value={preservationPeriod}
                  onChange={(e) => setPreservationPeriod(e.target.value)}
                  className={INP}
                >
                  <option value="1년">1년</option>
                  <option value="3년">3년</option>
                  <option value="5년">5년</option>
                  <option value="10년">10년</option>
                  <option value="영구">영구</option>
                </select>
              </Field>

              {/* 후결(사후 승인) 옵션 토글 스위치 — 보안등급/보존연한과 같은 행에 배치 */}
              {isPostApprovalSystemEnabled ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-ink2">긴급 후결 요청</span>
                  <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-[7px] transition-all ${isPostApproval
                    ? 'border-rose-500/40 bg-rose-500/8'
                    : 'border-border bg-panel'
                    }`}>
                    <span className="text-[11px] font-semibold text-rose-700 flex items-center gap-1 flex-1">
                      <span>🚨</span>
                      <span>{isPostApproval ? '후결 요청 중' : '해당 없음'}</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPostApproval}
                      onClick={() => setIsPostApproval(!isPostApproval)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isPostApproval ? 'bg-rose-500' : 'bg-gray-300'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPostApproval ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>

          {/* 서식 본문 및 동적 필드 영역 */}
          <div className="rounded-xl border border-border bg-panel p-4 space-y-4 shadow-2xs">
            <div className="text-[13px] font-bold text-ink border-b border-border pb-2 flex items-center justify-between">
              <span>📝 기안 본문 작성</span>
              <span className="text-[11px] text-ink3 font-normal">필요 항목을 정확히 작성해 주세요.</span>
            </div>

            {/* 휴가 전용 연차 잔여 일수 현황 위젯 */}
            {code === '휴가' && (
              <div className="rounded-lg border border-teal/30 bg-teal-soft/30 p-3 text-[12px] text-teal space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>🌴 {me.name} 님의 연차 현황</span>
                  <span>잔여 {bal.remaining}일 (총 {bal.grant}일 / 사용 {bal.used}일)</span>
                </div>
                {selectedLeaveType === '반차' && (
                  <p className="text-[11px] text-teal/80">※ 반차 선택 시 0.5일이 차감됩니다.</p>
                )}
              </div>
            )}

            {/* 서식에 정의된 동적 필드들 */}
            <div className="grid grid-cols-2 gap-3.5">
              {fieldNodes}
            </div>

            {/* 기본 본문(장문) 텍스트 입력창 (서식에 body 필드가 포함되어 있지 않을 경우만 추가 보출) */}
            {!form?.fields.some((f) => f.key === RESERVED_BODY_KEY) && (
              <Field label="기안 내용">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="내용을 입력하세요"
                  className={`${INP} resize-y leading-relaxed`}
                />
              </Field>
            )}
          </div>

          {/* 첨부파일 / 관련 문서 영역 */}
          <div className="rounded-xl border border-border bg-panel p-4 space-y-3 shadow-2xs">
            <div className="text-[13px] font-bold text-ink border-b border-border pb-2">
              📎 첨부파일 및 관련 문서
            </div>

            {/* 첨부 파일 업로드 */}
            <Field label="첨부파일">
              <input
                type="file"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  setUploading(true);
                  try {
                    const uploaded = await Promise.all(
                      files.map(async (f) => {
                        const url = await fileStorage.put(`approval/${Date.now()}_${f.name}`, f);
                        return { name: f.name, url };
                      }),
                    );
                    setAttachments((prev) => [...prev, ...uploaded]);
                  } catch (err) {
                    setError('파일 업로드 실패: ' + String(err));
                  } finally {
                    setUploading(false);
                  }
                }}
                className="block w-full text-[11.5px] text-ink3 file:mr-3 file:rounded-lg file:border-0 file:bg-panel-alt file:px-3 file:py-1 file:text-[11.5px] file:font-semibold file:text-ink hover:file:bg-border"
              />
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-[11.5px] text-ink bg-panel-alt px-2.5 py-1 rounded-md">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-[11px] text-rose-500 hover:underline ml-2 shrink-0"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            {/* 관련 문서 첨부 */}
            <Field label="관련 문서">
              <button
                type="button"
                onClick={() => setShowRelatedModal(true)}
                className="rounded-lg border border-dashed border-border-hi px-3 py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal transition-colors"
              >
                + 관련 문서 검색 및 선택
              </button>
              {relatedDocs.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {relatedDocs.map((doc, i) => (
                    <li key={doc.docId} className="flex items-center justify-between text-[11.5px] text-ink bg-panel-alt px-2.5 py-1 rounded-md">
                      <span className="truncate">📄 [{doc.docNo}] {doc.title}</span>
                      <button
                        type="button"
                        onClick={() => setRelatedDocs((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-[11px] text-rose-500 hover:underline ml-2 shrink-0"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </div>
        </div>

        {/* [3단] 우측 결재선 전용 고정 패널 (Wide/Desktop 화면 370px 고정) — z-30 및 overflow-visible로 2단 영역보다 상위에 위치 */}
        <div className="hidden xl:block w-[370px] shrink-0 border-l border-border bg-panel-alt/40 p-4 space-y-4 sticky self-start relative z-30 overflow-visible" style={{ top: '53px', maxHeight: 'calc(100vh - 53px)' }}>
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-[14px] font-bold text-ink flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white text-[10px] font-extrabold">3</span>
              <span>결재선 설정</span>
            </span>
            <span className="text-[11px] text-ink3 font-semibold">
              {steps.length}명 지정됨
            </span>
          </div>

          <ApprovalLineBuilder
            steps={steps}
            onChange={setSteps}
            drafterId={me.id}
            docType={code}
            amount={amountNum}
            docData={values}
          />
          {/* 수신처 / 시행자 지정 컴포넌트 */}
          <DraftRecipientSection
            recipients={recipients}
            setRecipients={setRecipients}
            executionTarget={executionTarget}
            setExecutionTarget={setExecutionTarget}
            org={org}
          />
        </div>

      </div>

      {/* 해상도 작을 때 우측 결재선 Drawer (header z-[200]보다 높은 z-[300] 지정) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[300] flex justify-end bg-black/40 xl:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="h-full w-full max-w-md bg-panel p-4 shadow-2xl flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <span className="text-[15px] font-bold text-ink">🔗 결재선 설정</span>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-[16px] text-ink3 hover:text-ink">✕</button>
            </div>
            <ApprovalLineBuilder
              steps={steps}
              onChange={setSteps}
              drafterId={me.id}
              docType={code}
              amount={amountNum}
              docData={values}
            />
          </div>
        </div>
      )}


      {/* 다이얼로그 모달 모음 */}
      {showConfirmClose && (
        <DraftConfirmDialog
          title="작성 취소 확인"
          description={<>입력한 내용이 있습니다.<br />작성 중인 내용을 저장하고 이동하시겠습니까?</>}
          confirmLabel="저장 후 이동"
          onConfirm={async () => {
            await persistDraft();
            navigate('/gw/approval');
          }}
          onDiscard={() => navigate('/gw/approval')}
          discardLabel="저장 없이 이동"
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
          onConfirm={() => navigate('/gw/approval')}
          onCancel={() => setShowConfirmDiscard(false)}
        />
      )}

      {showPreview && (
        <DocumentPreviewModal
          title="문서 미리보기"
          doc={previewDoc}
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
            setShowRelatedModal(false);
          }}
          onClose={() => setShowRelatedModal(false)}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold text-ink2">{label}</label>
      {children}
    </div>
  );
}

const INP =
  'w-full rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12px] text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal/30 transition-all';
