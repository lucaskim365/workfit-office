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
import { Upload, X, Paperclip } from 'lucide-react';

/**
 * 브라우저 보관 상태 표시.
 *
 * 배포·새로고침 사고로 작성 내용이 사라진 뒤 붙였다. 보관되고 있다는 사실이 보여야
 * 사용자가 안심한다. 서버 임시저장과 헷갈리지 않게 "보관"이라고 부른다 —
 * 이건 이 브라우저에만 있다.
 *
 * **경과 초를 계속 세지 않는다.** 숫자가 1초마다 올라가면 시선을 계속 끌어 작성에
 * 방해가 된다. 보관 직후 잠깐만 알리고, 그 뒤에는 조용한 상시 문구로 가라앉힌다.
 */
function AutosaveIndicator({ at }: { at: number | null }) {
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (at === null) return;
    setJustSaved(true);
    const id = setTimeout(() => setJustSaved(false), 1600);
    return () => clearTimeout(id);
  }, [at]);

  if (at === null) return null;

  const stamp = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(at);

  return (
    <span
      className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink3"
      title={`마지막 보관 ${stamp} · 작성 중인 내용이 이 브라우저에 보관됩니다. 새로고침해도 복구할 수 있습니다.`}
    >
      <span className={`h-1.5 w-1.5 rounded-full transition-colors ${justSaved ? 'bg-ok' : 'bg-ink3/40'}`} />
      {justSaved ? '보관됨' : '자동 보관 중'}
    </span>
  );
}

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
  const userDeptId = useMemo(() => {
    return org.depts.find((d) => d.name === me.dept)?.id;
  }, [org.depts, me.dept]);

  const [code, setCode] = useState<string>(editDoc?.docType ?? fixedType ?? '기안');
  const [title, setTitle] = useState(editDoc?.title ?? '');
  const [securityLevel, setSecurityLevel] = useState<'일반' | '대외비' | '극비'>(editDoc?.securityLevel ?? '일반');
  const [visibility, setVisibility] = useState<'전사' | '부서' | '비공개'>(editDoc?.visibility ?? '부서');
  const [preservationPeriod, setPreservationPeriod] = useState<string>(editDoc?.preservationPeriod ?? '5년');

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
  const [executionDepts, setExecutionDepts] = useState<{ id: string; name: string }[]>(editDoc?.executionDepts ?? []);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [isWideScreen, setIsWideScreen] = useState(true);
  const [isAgreementEnabled, setIsAgreementEnabled] = useState(false);

  useEffect(() => {
    approvalProcessRepo.isOptionEnabled('dept_agreement').then(setIsAgreementEnabled);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const wide = w >= 1200;
      setIsWideScreen(wide);

      if (wide) {
        // Widescreen baseline: 1750px (min zoom 0.6)
        setZoomFactor(w < 1750 ? Math.max(0.6, w / 1750) : 1);
      } else {
        // Collapsed baseline: 1380px (min zoom 0.6)
        setZoomFactor(Math.max(0.6, w / 1380));
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleFilesUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (f) => {
          const ext = f.name.split('.').pop() || '';
          const randomHex = Math.random().toString(36).substring(2, 8);
          const safePath = `chat/approval/${Date.now()}_${randomHex}.${ext}`;
          const url = await fileStorage.put(safePath, f, { contentType: f.type, filename: f.name });
          return { name: f.name, url };
        }),
      );
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError('파일 업로드 실패: ' + String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      await handleFilesUpload(files);
    }
  };

  // 최초 마운트 및 양식 선택 시점의 디폴트 상태 스냅샷 Ref
  const initialStateRef = useRef<{
    code: string;
    title: string;
    values: Record<string, FieldValue>;
    amount: string;
    attachments: { name: string; url: string }[];
    relatedDocs: RelatedDoc[];
    steps: ApprovalStep[];
    recipients: ApprovalRecipient[];
    executionDepts: { id: string; name: string }[];
    /** 셀렉트 박스 3종. 이게 비교 대상에서 빠져 있어 값을 바꿔도 "작성한 게 없다"로 봤다. */
    securityLevel: string;
    visibility: string;
    preservationPeriod: string;
  } | null>(null);

  const prevCodeRef = useRef<string>('');

  // 양식 설정 직후의 초기 세팅이 완벽히 끝난 상태를 150ms 딜레이 후 캡처
  useEffect(() => {
    if (forms.length === 0) return;

    // 이미 해당 code에 대한 스냅샷이 저장되어 있다면 갱신을 건너뛰어 스냅샷 오염 방지
    if (initialStateRef.current && initialStateRef.current.code === code) {
      return;
    }

    const timer = setTimeout(() => {
      initialStateRef.current = {
        code,
        title,
        values: JSON.parse(JSON.stringify(values)),
        amount,
        attachments: JSON.parse(JSON.stringify(attachments)),
        relatedDocs: JSON.parse(JSON.stringify(relatedDocs)),
        steps: JSON.parse(JSON.stringify(steps)),
        recipients: JSON.parse(JSON.stringify(recipients)),
        executionDepts: JSON.parse(JSON.stringify(executionDepts)),
        securityLevel,
        visibility,
        preservationPeriod,
      };
    }, 150);

    return () => clearTimeout(timer);
  }, [code, forms, editDoc]);

  const hasManuallyEnteredValues = (): boolean => {
    if (!initialStateRef.current) return false;
    const initialState = initialStateRef.current;

    // 양식 코드 자체가 다르면 초기 상태 비교를 무시하고 false 처리
    if (code !== initialState.code) return false;

    // 각 핵심 상태의 최초 스냅샷 대비 변경 사항을 엄격히 감지
    const titleChanged = title.trim() !== initialState.title.trim();
    const amountChanged = amount.trim() !== initialState.amount.trim();
    const valuesChanged = JSON.stringify(values) !== JSON.stringify(initialState.values);
    const filesChanged = JSON.stringify(attachments) !== JSON.stringify(initialState.attachments);
    const relatedDocsChanged = JSON.stringify(relatedDocs) !== JSON.stringify(initialState.relatedDocs);
    const stepsChanged = JSON.stringify(steps) !== JSON.stringify(initialState.steps);
    const recipientsChanged = JSON.stringify(recipients) !== JSON.stringify(initialState.recipients);
    const executionDeptsChanged = JSON.stringify(executionDepts) !== JSON.stringify(initialState.executionDepts);
    /**
     * 셀렉트 박스(공개범위·보존연한·문서보안)도 사용자가 만진 것이다.
     * 예전에는 비교 대상에서 빠져 있어, 셀렉트만 바꾸면 "작성한 게 없다"로 판정돼
     * **보관이 안 될 뿐 아니라 기존 보관본까지 지워졌고**, 이탈 경고도 뜨지 않았다.
     */
    const securityChanged = securityLevel !== initialState.securityLevel;
    const visibilityChanged = visibility !== initialState.visibility;
    const preservationChanged = preservationPeriod !== initialState.preservationPeriod;

    return (
      titleChanged ||
      amountChanged ||
      valuesChanged ||
      filesChanged ||
      relatedDocsChanged ||
      stepsChanged ||
      recipientsChanged ||
      executionDeptsChanged ||
      securityChanged ||
      visibilityChanged ||
      preservationChanged
    );
  };

  // 양식 변경 시 작성내용 유실 경고 핸들러
  const handleFormChange = (newCode: string) => {
    const hasContent = hasManuallyEnteredValues();

    if (hasContent && newCode !== code) {
      const ok = window.confirm(
        '새 양식으로 변경하면 현재 작성 중인 내용이 지워지고 초기화됩니다. 계속하시겠습니까?'
      );
      if (!ok) return;
    }
    setCode(newCode);
    setValues({});
    setTitle('');
    setAmount('');
  };

  /** 마지막으로 브라우저에 보관한 시각. 화면에 "n초 전 보관됨"으로 보여 준다. */
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);

  const clearAutosave = () => {
    localStorage.removeItem('draft_autosave_' + me.id);
    localStorage.removeItem('draft_autosave_active_' + me.id);
    setAutosavedAt(null);
  };

  // 브라우저 새로고침 / 탭 닫기 이탈 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasManuallyEnteredValues()) {
        e.preventDefault();
        e.returnValue = ''; // 브라우저 표준 경고창 표시 유도
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [code, title, values, amount, attachments, relatedDocs, steps, recipients, executionDepts]);

  // 실시간 자동저장 및 비었을 때의 클리너 연동 (1.5초 디바운스)
  useEffect(() => {
    // 최초 상태 스냅샷이 캡처되기 전에는 기존 자동저장을 삭제하거나 덮어쓰지 않도록 가드
    if (!initialStateRef.current) return;

    const hasContent = hasManuallyEnteredValues();

    if (!hasContent) {
      clearAutosave();
      return;
    }

    /**
     * **시간 기준(디바운스)으로 보관한다. 포커스 아웃 기준이 아니다.**
     *
     * 기안내용처럼 한 칸에 오래 머무는 경우가 정확히 가장 잃기 쉬운 상황인데,
     * blur 기준이면 그 칸을 벗어난 적이 없어 한 번도 보관되지 않는다.
     */
    const snapshot = () => {
      localStorage.setItem('draft_autosave_' + me.id, JSON.stringify({
        // 어느 문서를 쓰다 만 것인지 남긴다. 이게 없으면 신규 작성분과 수정 중이던
        // 문서를 구분할 수 없어, 복구가 엉뚱한 문서에 붙을 위험 때문에 아예 막혀 있었다.
        docId: editDoc?.id ?? null,
        code,
        title,
        values,
        amount,
        securityLevel,
        visibility,
        preservationPeriod,
        attachments,
        // 관련문서가 저장 목록에서 빠져 있었다 — 이탈 방지 감시에는 들어 있는데
        // 정작 보관을 안 해서, 복구해도 관련문서만 사라졌다.
        relatedDocs,
        recipients,
        executionDepts,
        steps,
        timestamp: Date.now()
      }));
      localStorage.setItem('draft_autosave_active_' + me.id, 'true');
      setAutosavedAt(Date.now());
    };

    const timer = setTimeout(snapshot, 1000);
    // 탭을 옮기거나 창을 벗어나면 디바운스를 기다리지 않고 바로 보관한다.
    const flush = () => { if (document.visibilityState === 'hidden') snapshot(); };
    window.addEventListener('blur', snapshot);
    document.addEventListener('visibilitychange', flush);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('blur', snapshot);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [code, title, values, amount, securityLevel, visibility, preservationPeriod, attachments, relatedDocs, recipients, executionDepts, steps, me.id, editDoc?.id]);

  const hasCheckedAutosave = useRef(false);

  // 마운트 시 자동저장본 복구 제안
  useEffect(() => {
    if (hasCheckedAutosave.current) return;
    if (forms.length === 0) return; // 서식 정보가 로드될 때까지 대기

    const isActive = localStorage.getItem('draft_autosave_active_' + me.id) === 'true';
    const saved = localStorage.getItem('draft_autosave_' + me.id);
    let offered = false;
    if (isActive && saved) {
      try {
        const data = JSON.parse(saved);
        // 보관본이 지금 열고 있는 문서의 것일 때만 제안한다. 예전에는 editDoc 이 있으면
        // 검사 자체를 건너뛰어, **저장은 계속 하면서 꺼내지는 못하는** 상태였다.
        const sameTarget = (data?.docId ?? null) === (editDoc?.id ?? null);
        if (data && sameTarget && (Date.now() - data.timestamp < 24 * 60 * 60 * 1000)) {
          const formName = forms.find(f => f.code === data.code)?.name || data.code;
          setPendingAutosaveData(data);
          setAutosaveFormName(formName);
          setShowAutosaveRecoverModal(true);
          offered = true;
        }
      } catch (e) {
        console.error('Failed to parse autosave data', e);
      }
    }
    // 제안을 띄웠을 때만 플래그를 내린다. 예전에는 무조건 지워서, 이 화면에 잠깐
    // 들렀다 나가기만 해도 다음번 복구 제안이 사라졌다(내용은 남아 있는데도).
    if (offered) localStorage.removeItem('draft_autosave_active_' + me.id);
    hasCheckedAutosave.current = true;
  }, [me.id, forms, editDoc]);

  const executionTarget = useMemo(() => {
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
  }, [editDoc, org]);

  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 자동저장 복구 제안 모달 상태
  const [showAutosaveRecoverModal, setShowAutosaveRecoverModal] = useState(false);
  const [pendingAutosaveData, setPendingAutosaveData] = useState<any>(null);
  const [autosaveFormName, setAutosaveFormName] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [onlyAllowedForms, setOnlyAllowedForms] = useState(true);
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
    // 서식별 보안 설정 자동 매핑
    if (code === '채용' || code === '인사') {
      setSecurityLevel('극비');
      setVisibility('비공개');
    } else if (code === '지출결의') {
      setSecurityLevel('대외비');
      setVisibility('부서');
    } else {
      setSecurityLevel('일반');
      setVisibility('전사');
    }
  }, [code]);


  // 서식 변경에 따른 기본 수신처/시행처 매핑 자동 주입
  useEffect(() => {
    if (!code || forms.length === 0 || editDoc) return;
    
    // 사용자가 서식을 실제로 바꿨을 때만 기본값을 주입하고, 이후 사용자 추가/삭제 수정 내역 보호
    if (prevCodeRef.current === code) return;
    prevCodeRef.current = code;

    const currentForm = forms.find((f) => f.code === code);
    if (!currentForm) return;

    // 1. 수신처 빌드
    const autoRecipients: ApprovalRecipient[] = [];

    // (A) 기본 수신 사용자
    if (currentForm.recipientUserId) {
      const u = org.users.find((x: any) => x.id === currentForm.recipientUserId);
      if (u) {
        autoRecipients.push({
          id: u.id,
          name: `${u.name} · ${u.dept}`,
          type: 'user' as const
        });
      }
    }
    // (B) 기본 수신 부서
    if (currentForm.recipientDeptId) {
      const d = org.depts.find((x: any) => x.id === currentForm.recipientDeptId);
      if (d) {
        autoRecipients.push({
          id: d.id,
          name: d.name,
          type: 'dept' as const
        });
      }
    }

    // 2. 시행처 빌드
    const autoExecs: { id: string; name: string }[] = [];
    // (A) 기본 시행 사용자
    if (currentForm.executionUserId) {
      const u = org.users.find((x: any) => x.id === currentForm.executionUserId);
      if (u) {
        autoExecs.push({
          id: u.id,
          name: `${u.name} · ${u.dept}`
        });
      }
    }
    // (B) 기본 시행 부서
    if (currentForm.executionDeptId) {
      const d = org.depts.find((x: any) => x.id === currentForm.executionDeptId);
      if (d) {
        autoExecs.push({
          id: d.id,
          name: d.name
        });
      }
    }

    setRecipients(autoRecipients);
    setExecutionDepts(autoExecs);

  }, [code, forms, org.users, org.depts, me, editDoc]);


  useEffect(() => {
    if (editDoc) {
      setCode(editDoc.docType);
      setTitle(editDoc.title ?? '');
      setSecurityLevel(editDoc.securityLevel ?? '일반');
      setVisibility(editDoc.visibility ?? '부서');
      setPreservationPeriod(editDoc.preservationPeriod ?? '5년');
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
      setExecutionDepts(editDoc.executionDepts ?? []);
      setIsPostApproval(editDoc.isPostApproval ?? false);
      setPostApprovalActionTaken(editDoc.postApprovalActionTaken ?? '');
      setPostApprovalNecessity(editDoc.postApprovalNecessity ?? '');
      if (editDoc.postApprovedAt) setPostApprovedAt(editDoc.postApprovedAt);
      if (editDoc.postApprovedById) setPostApprovedById(editDoc.postApprovedById);
    }
  }, [editDoc]);

  const isFixed = !!fixedType || !!editDoc;



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

    const myDeptObj = org.depts.find((d) => d.name === me.dept);
    const myDeptId = myDeptObj ? myDeptObj.id : '';

    return {
      docType: code,
      title: title.trim(),
      drafterId: me.id,
      drafterDept: me.dept,
      drafterDeptId: myDeptId,
      steps,
      amount: amountNum,
      body: values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]).trim() : '',
      form: leave,
      fieldValues: values,
      attachments,
      recipients,
      executionDepts,
      execution,
      relatedDocs,
      securityLevel,
      visibility,
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
        const userDeptNode = org.depts.find((d) => d.name === me.dept);
        const userDeptId = userDeptNode?.id ?? null;
        const userJobTitle = me.jobTitle || '';

        // 1순위: 개별 예외 사용자 지정 허용 검사
        const isUserExcepted = form.allowedUserIds && form.allowedUserIds.includes(me.id);

        // 2순위: 허용 지정 부서 프리패스 검사
        const isDeptExcepted = form.allowedDeptIds && form.allowedDeptIds.length > 0 && !!userDeptId && form.allowedDeptIds.includes(userDeptId);

        // 3순위: 일반 규칙 (직급 범위 및 직책 범위)
        const hasRankConstraint = form.allowedPositionFromRank != null || form.allowedPositionToRank != null;
        const hasJobConstraint = form.allowedJobTitles && form.allowedJobTitles.length > 0;

        const isRankAllowed = 
          (form.allowedPositionFromRank == null || userRank <= form.allowedPositionFromRank) &&
          (form.allowedPositionToRank == null || userRank >= form.allowedPositionToRank);

        const isJobAllowed = 
          !form.allowedJobTitles || 
          form.allowedJobTitles.length === 0 || 
          form.allowedJobTitles.includes(userJobTitle);

        let isGeneralRuleAllowed = true;
        if (hasRankConstraint && hasJobConstraint) {
          isGeneralRuleAllowed = isRankAllowed || isJobAllowed;
        } else if (hasRankConstraint) {
          isGeneralRuleAllowed = isRankAllowed;
        } else if (hasJobConstraint) {
          isGeneralRuleAllowed = isJobAllowed;
        }

        // 전체 판정: 예외 사원이거나, 부서 프리패스 통과거나, 일반 자격 조건 만족 시 허용
        const isDrafterAllowed = isUserExcepted || isDeptExcepted || isGeneralRuleAllowed;

        if (!isDrafterAllowed) {
          return '본 서식의 기안 권한이 없습니다. (허용 직급/직책/부서 예외 대상 아님)';
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
    const userJobTitle = me.jobTitle || '';
    const disabledCodes = new Set<string>();

    for (const f of forms) {
      if (f.code === '기안' || f.code === '전체') continue;

      // 1순위: 개별 예외 사용자 지정 허용 검사
      const isUserExcepted = f.allowedUserIds && f.allowedUserIds.includes(me.id);

      // 2순위: 허용 지정 부서 프리패스 검사
      const isDeptExcepted = f.allowedDeptIds && f.allowedDeptIds.length > 0 && !!userDeptId && f.allowedDeptIds.includes(userDeptId);

      // 3순위: 일반 규칙 (직급 범위 및 직책 범위)
      const hasRankConstraint = f.allowedPositionFromRank != null || f.allowedPositionToRank != null;
      const hasJobConstraint = f.allowedJobTitles && f.allowedJobTitles.length > 0;

      const isRankAllowed = 
        (f.allowedPositionFromRank == null || userRank <= f.allowedPositionFromRank) &&
        (f.allowedPositionToRank == null || userRank >= f.allowedPositionToRank);

      const isJobAllowed = 
        !f.allowedJobTitles || 
        f.allowedJobTitles.length === 0 || 
        f.allowedJobTitles.includes(userJobTitle);

      let isGeneralRuleAllowed = true;
      if (hasRankConstraint && hasJobConstraint) {
        isGeneralRuleAllowed = isRankAllowed || isJobAllowed;
      } else if (hasRankConstraint) {
        isGeneralRuleAllowed = isRankAllowed;
      } else if (hasJobConstraint) {
        isGeneralRuleAllowed = isJobAllowed;
      }

      // 전체 판정: 예외 사원이거나, 부서 프리패스 통과거나, 일반 자격 조건 만족 시 허용
      const isDrafterAllowed = isUserExcepted || isDeptExcepted || isGeneralRuleAllowed;

      if (!isDrafterAllowed) {
        disabledCodes.add(f.code);
      }
    }
    return disabledCodes;
  }, [forms, me.position, me.dept, me.jobTitle, me.id, org]);

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
      clearAutosave();
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
      clearAutosave();
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
            <input
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setAmount(val);
                setVals({ [field.key]: val });
              }}
              inputMode="numeric"
              placeholder="예: 3000000"
              className={INP}
            />
            {amountNum != null && <span className="mt-1 block text-[11px] text-ink3">₩{amountNum.toLocaleString()}</span>}
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
    () => {
      const myDeptObj = org.depts.find((d) => d.name === me.dept);
      const myDeptId = myDeptObj ? myDeptObj.id : '';
      return {
        id: editDoc?.id ?? 'preview-doc-id',
        docNo: editDoc?.docNo ?? 'DRAFT-PREVIEW',
        docType: code,
        title: title || '(제목 없음)',
        body: values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]) : '',
        drafterId: me.id,
        drafterDept: me.dept,
        drafterDeptId: myDeptId,
      status: '진행중',
      amount: amountNum,
      securityLevel,
      visibility: visibility,
      createdAt: new Date().toISOString(),
      submittedAt: null,
      completedAt: null,
      currentSeq: 0,
      fieldValues: values,
      attachments,
      recipients,
      executionDepts,
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
      executionsSnapshot: editDoc?.executionsSnapshot ?? [],
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
    };
  },
    [editDoc, code, title, me, amountNum, values, attachments, recipients, steps, executionTarget, form, isPostApproval, postApprovalReason, postApprovalActionTaken, postApprovalNecessity, postApprovalCostDetails, postApprovalFollowup, postApprovedAt, postApprovedById, org, securityLevel, relatedDocs],
  );

  return (
    <div className="flex w-full flex-col bg-panel" style={{ zoom: zoomFactor }}>
      {/* 상단 헤더 툴바 — body 스크롤 기준으로 sticky top-0 고정
           (/gw에서 main overflow 없음 → body가 스크롤 → 스크롤 내리면 Topbar가 사라지고 이 헤더가 스크린 상단에 고정됨) */}
      <header className="sticky top-0 z-30 h-[53px] flex shrink-0 items-center justify-between border-b border-border bg-panel/95 backdrop-blur-md px-6 shadow-xs">
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
          {!isWideScreen && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal-soft/50 px-3 py-1.5 text-[12px] font-bold text-teal hover:bg-teal-soft transition-colors"
            >
              <span>🔗 결재선</span>
              <span className="rounded-full bg-teal px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                {steps.length}명
              </span>
            </button>
          )}

          <AutosaveIndicator at={autosavedAt} />
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
              setCode={handleFormChange}
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
              <Field label="공개 범위">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className={INP}
                  disabled={code === '채용' || code === '인사'}
                >
                  <option value="전사">전사 공개</option>
                  <option value="부서">부서 공개</option>
                  <option value="비공개">비공개</option>
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



            {/* 보안 매핑에 따른 피드백 안내 문구 */}
            {(code === '채용' || code === '인사' || code === '지출결의') && (
              <div className={`rounded-lg px-3 py-2 text-[11px] font-semibold flex items-center gap-2 ${
                code === '지출결의' 
                  ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' 
                  : 'bg-red-500/10 text-red-700 border border-red-500/20'
              }`}>
                <span>{code === '지출결의' ? '⚠️' : '🔒'}</span>
                <span>
                  {code === '지출결의' 
                    ? '지출결의서는 보안 규정에 의해 [대외비 / 부서 공개] 로 기본 제한됩니다.' 
                    : `본 서식(${code}품의)은 극비 기안 양식으로써 기안 시점에 [극비 / 비공개]로 강제 자동 설정됩니다.`}
                </span>
              </div>
            )}
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
          </div>

          {/* 첨부파일 / 관련 문서 영역 */}
          <div className="rounded-xl border border-border bg-panel p-4 space-y-3 shadow-2xs">
            <div className="text-[13px] font-bold text-ink border-b border-border pb-2">
              📎 첨부파일 및 관련 문서
            </div>

            {/* 첨부 파일 업로드 */}
            <Field label="첨부파일">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 transition-all cursor-pointer ${
                  isDragActive
                    ? 'border-teal bg-teal-soft/20 scale-[0.99]'
                    : 'border-border bg-panel-alt/30 hover:bg-panel-alt/60 hover:border-border-hi'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    await handleFilesUpload(files);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2.5 bg-panel rounded-full shadow-2xs border border-border">
                    <Upload className="w-5 h-5 text-ink3" />
                  </div>
                  <div className="text-[12px] font-bold text-ink text-center">
                    {uploading ? '파일을 업로드하는 중...' : '여기에 파일을 드래그하거나 클릭하여 추가'}
                  </div>
                  <p className="text-[10.5px] text-ink3 text-center">
                    여러 개의 파일을 마우스 드래그로 선택하여 올릴 수 있습니다.
                  </p>
                </div>
              </div>

              {attachments.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {attachments.map((f, i) => (
                    <li
                      key={i}
                      className="group flex items-center justify-between text-[11.5px] text-ink bg-panel-alt hover:bg-panel-alt-hi px-3 py-1.5 rounded-lg border border-border transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-3.5 h-3.5 text-ink3 shrink-0" />
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-medium hover:underline hover:text-teal cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {f.name}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachments((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                        className="p-1 rounded-md text-ink3 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                        title="삭제"
                      >
                        <X className="w-3.5 h-3.5" />
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

        {/* [3단] 우측 결재선 전용 고정 패널 — sticky self-start top-53px, 내부 스크롤 + 패널 내부 헤더 sticky 고정 */}
        {isWideScreen && (
          <div
            className="w-[370px] shrink-0 border-l border-border bg-panel-alt/40 sticky self-start z-30 overflow-y-auto"
            style={{ top: '53px', maxHeight: 'calc(100vh - 53px)' }}
          >
            {/* 패널 내부 헤더 — 패널 스크롤 시에도 상단에 잘라붙어 보임 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-panel-alt/95 backdrop-blur-sm px-4 py-2.5">
              <span className="text-[14px] font-bold text-ink flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white text-[10px] font-extrabold">3</span>
                <span>결재선 설정</span>
              </span>
              <span className="text-[11px] text-ink3 font-semibold">
                {steps.length}명 지정됨
              </span>
            </div>

            {/* 결재선 빌더 + 수신/시행 (bottomSlot) */}
            <div className="px-4 py-4">
              <ApprovalLineBuilder
                steps={steps}
                onChange={setSteps}
                drafterId={me.id}
                docType={code}
                amount={amountNum}
                docData={values}
                isAgreementEnabled={isAgreementEnabled}
                bottomSlot={
                  <DraftRecipientSection
                    recipients={recipients}
                    setRecipients={setRecipients}
                    executionDepts={executionDepts}
                    setExecutionDepts={setExecutionDepts}
                    org={org}
                  />
                }
              />
            </div>
          </div>
        )}

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
              isAgreementEnabled={isAgreementEnabled}
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
            clearAutosave();
            navigate('/gw/approval');
          }}
          onDiscard={() => {
            clearAutosave();
            navigate('/gw/approval');
          }}
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
          onConfirm={() => {
            clearAutosave();
            navigate('/gw/approval');
          }}
          onCancel={() => setShowConfirmDiscard(false)}
        />
      )}

      {showAutosaveRecoverModal && (
        <DraftConfirmDialog
          title="작성 중이던 문서 복구"
          description={
            <>
              이전에 작성 중이던 임시 저장 문서가 존재합니다.<br />
              <strong>서식: {autosaveFormName}</strong><br /><br />
              작성 중이던 내용을 불러오시겠습니까?
            </>
          }
          confirmLabel="내용 불러오기"
          onConfirm={() => {
            if (pendingAutosaveData) {
              const data = pendingAutosaveData;
              setCode(data.code);
              setTitle(data.title || '');
              setValues(data.values || {});
              setAmount(data.amount || '');
              if (data.securityLevel) setSecurityLevel(data.securityLevel);
              if (data.visibility) setVisibility(data.visibility);
              if (data.preservationPeriod) setPreservationPeriod(data.preservationPeriod);
              if (data.attachments) setAttachments(data.attachments);
              if (data.recipients) setRecipients(data.recipients);
              if (data.executionDepts) setExecutionDepts(data.executionDepts);
              if (data.relatedDocs) setRelatedDocs(data.relatedDocs);
              if (data.steps) setSteps(data.steps);
            }
            setShowAutosaveRecoverModal(false);
            setPendingAutosaveData(null);
          }}
          onCancel={() => {
            setShowAutosaveRecoverModal(false);
            setPendingAutosaveData(null);
            clearAutosave();
          }}
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
          userDeptId={userDeptId}
          selectedDocIds={relatedDocs.map((x) => x.docId)}
          onSelect={(selectedList) => {
            // 관련 기결재 문서 참조 링크 연동 (중복 저장 방지를 위해 첨부파일 복사는 수행하지 않음)
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
