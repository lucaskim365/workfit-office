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
import { useActiveApprovalForms } from '@/features/gw/useApprovalForms';
import { useRouteEngine } from '@/features/gw/useRouteEngine';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useLeave } from '@/features/gw/useLeave';
import { ApprovalLineBuilder } from '@/modules/gw/approval/ApprovalLineBuilder';
import { RelatedDocSearchModal } from '@/modules/gw/approval/RelatedDocSearchModal';
import { DraftConfirmDialog } from './components/DraftConfirmDialog';
import { DraftFormSelectModal } from './components/DraftFormSelectModal';
import { FormChangeConfirmDialog } from './components/FormChangeConfirmDialog';
import { DraftRecipientSection } from './components/DraftRecipientSection';
import { ApprovalDraftDocumentSheet } from './components/ApprovalDraftDocumentSheet';
import { usePermission } from '@/features/auth/usePermission';
import { fileStorage } from '@/shared/lib/storage';
import { getDefaultTimeWindow } from '@/domain/leave/policy';
import { X, AlertTriangle, GitFork, RefreshCw } from 'lucide-react';

/**
 * 브라우저 보관 상태 표시.
 *
 * 배포·새로고침 사고로 작성 내용이 사라진 뒤 붙였다. 보관되고 있다는 사실이 보여야
 * 사용자가 안심한다. 서버 임시저장과 헷갈리지 않게 "보관"이라고 부른다 —
 * 이건 이 브라우저에만 있다.
 *
 * **마지막으로 보관된 시각을 그대로 붙박아 둔다.** 경과 초를 세면 숫자가 계속 움직여
 * 시선을 뺏고, "자동 보관 중"처럼 상태만 쓰면 지금 저장 중이라는 건지 끝났다는 건지
 * 알 수 없다. 시각은 저장될 때만 바뀌므로 조용하면서도 갱신이 눈에 띈다.
 */
function AutosaveIndicator({ at }: { at: number | null }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (at === null) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(id);
  }, [at]);

  if (at === null) return null;

  const stamp = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(at);

  return (
    <span
      className="flex items-center gap-1.5 px-1 text-[11px] font-semibold tabular-nums text-ink3"
      title="작성 중인 내용이 이 브라우저에 보관됩니다. 새로고침하거나 탭을 닫아도 복구할 수 있습니다."
    >
      <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${flash ? 'bg-ok' : 'bg-ink3/40'}`} />
      마지막 보관 {stamp}
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

  /**
   * **수정할 문서를 다 받은 뒤에 본문을 마운트한다.**
   *
   * 예전에는 `fetchedDoc` 이 아직 없을 때도 `editDoc={null}` 로 먼저 그렸다. 그러면
   * 복구 검사가 "새 기안"으로 판단해 헛돌고, 문서가 도착해 다시 돌 때는 이미 검사를
   * 마쳤다고 표시돼 **두 번째 기회가 없었다.** "임시저장 문서를 편집하다 탭을 닫으면
   * 아무것도 안 남는다"가 여기서 나왔다.
   *
   * `key` 로 대상을 고정해, 다른 문서로 옮겨갈 때 이전 상태가 섞이지 않게 한다.
   */
  if (editDocId && !fetchedDoc) {
    return (
      <div className="flex h-full items-center justify-center py-20 text-[13px] text-ink3">
        문서를 불러오는 중…
      </div>
    );
  }

  return (
    <ApprovalDraftInner
      key={editDocId ?? 'new'}
      me={user}
      editDoc={fetchedDoc ?? null}
      fixedType={params.get('type') ?? undefined}
      initialDate={params.get('date')}
      initialLeaveType={params.get('leaveType')}
      navigate={navigate}
    />
  );
}

function ApprovalDraftInner({
  me,
  editDoc,
  fixedType,
  initialDate,
  initialLeaveType,
  navigate,
}: {
  me: User;
  editDoc?: ApprovalDoc | null;
  fixedType?: string;
  initialDate?: string | null;
  initialLeaveType?: string | null;
  navigate: (url: string) => void;
}) {
  const { canAction } = usePermission();
  const canCreate = canAction('S_GW_APPROVAL', 'create');

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
      if (!initialVals['substituteId'] && editDoc.form.substituteId) initialVals['substituteId'] = editDoc.form.substituteId;
      if (!initialVals['emergencyContact'] && editDoc.form.emergencyContact) initialVals['emergencyContact'] = editDoc.form.emergencyContact;
    }
    // URL 딥링크(근태/휴가 화면 등)에서 넘어온 날짜 및 유형 기본 바인딩
    if (!editDoc && initialDate) {
      if (!initialVals['period']) initialVals['period'] = initialDate;
      if (!initialVals['period__end']) initialVals['period__end'] = initialDate;
      if (!initialVals['period__days']) initialVals['period__days'] = 1;
    }
    if (!editDoc && initialLeaveType) {
      initialVals['leaveType'] = initialLeaveType;
      if (initialLeaveType === '오전반차' || initialLeaveType === '오후반차' || initialLeaveType === '반차') {
        initialVals['period__days'] = 0.5;
      } else if (initialLeaveType === '반반차') {
        initialVals['period__days'] = 0.25;
      }
    }
    return initialVals;
  });

  const setVals = (patch: Record<string, FieldValue>) => setValues((prev) => ({ ...prev, ...patch }));
  const [steps, setSteps] = useState<ApprovalStep[]>(editDoc?.steps ?? []);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(editDoc?.attachments ?? []);
  const [attachmentRetention, setAttachmentRetention] = useState<string>((editDoc as any)?.attachmentRetention ?? 'permanent');
  const [relatedDocs, setRelatedDocs] = useState<RelatedDoc[]>(editDoc?.relatedDocs ?? []);

  const [showRelatedModal, setShowRelatedModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [recipients, setRecipients] = useState<ApprovalRecipient[]>(editDoc?.recipients ?? []);
  const [isWideScreen, setIsWideScreen] = useState(true);
  const [isAgreementEnabled, setIsAgreementEnabled] = useState(false);

  // 양식 선택 모달 및 양식 변경 확인 다이얼로그 상태
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showChangeConfirm, setShowChangeConfirm] = useState(false);
  const [isChangingFormSaving, setIsChangingFormSaving] = useState(false);

  useEffect(() => {
    approvalProcessRepo.isOptionEnabled('dept_agreement').then(setIsAgreementEnabled);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setIsWideScreen(w >= 1200);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      securityChanged ||
      visibilityChanged ||
      preservationChanged
    );
  };

  // URL 쿼리에 type이 없고 신규 기안으로 진입한 경우, 양식 선택 모달 자동 오픈
  useEffect(() => {
    if (!editDoc && !fixedType && !initialDate && !initialLeaveType) {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('type')) {
        setShowSelectModal(true);
      }
    }
  }, [editDoc, fixedType, initialDate, initialLeaveType]);

  // 상단 [양식 변경] 버튼 클릭 핸들러
  const handleClickChangeForm = () => {
    if (hasManuallyEnteredValues()) {
      setShowChangeConfirm(true);
    } else {
      setShowSelectModal(true);
    }
  };

  // 작성 중인 내용 임시 저장 후 새 양식 선택
  const handleSaveAndChange = async () => {
    setIsChangingFormSaving(true);
    try {
      await persistDraft();
      clearAutosave();
      setShowChangeConfirm(false);
      setShowSelectModal(true);
    } catch (e) {
      setError('임시 저장에 실패하여 양식 변경이 중단되었습니다: ' + String(e));
    } finally {
      setIsChangingFormSaving(false);
    }
  };

  // 작성 중인 내용 폐기 후 새 양식 선택
  const handleDiscardAndChange = () => {
    clearAutosave();
    setValues({});
    setTitle('');
    setAmount('');
    setAttachments([]);
    setRelatedDocs([]);
    setShowChangeConfirm(false);
    setShowSelectModal(true);
  };

  // 모달에서 새 서식을 최종 선택했을 때
  const handleSelectNewForm = (newForm: ApprovalForm) => {
    setCode(newForm.code);
    setValues({});
    setTitle('');
    setAmount('');
    navigate(`/gw/approval/new?type=${encodeURIComponent(newForm.code)}`);
  };

  /** 마지막으로 브라우저에 보관한 시각. 화면에 "마지막 보관 HH:MM:SS"로 보여 준다. */
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);

  /**
   * **화면이 뜨는 순간의 보관본을 먼저 읽어 둔다.**
   *
   * 자동저장 effect 는 아직 아무것도 입력되지 않은 상태를 "작성한 게 없다"로 보고
   * `clearAutosave()` 를 부른다. 그게 복구 검사보다 먼저 돌면 **지난 세션 보관본이
   * 지워진 뒤에 복구를 시도**하게 된다. 실제로 "탭 닫았다 열면 아무것도 없다"는
   * 증상이 여기서 나왔다.
   *
   * 그래서 렌더 전에 한 번 읽어 ref 에 담는다. 이후 누가 지우든 복구는 이 값을 쓴다.
   */
  /** 마지막으로 실제 쓰기가 일어난 시각. 스로틀 간격 판정에 쓴다. */
  const lastSnapshotAtRef = useRef(0);

  /**
   * **보관 칸을 대상별로 나눈다.**
   *
   * 예전에는 사용자당 한 칸(`draft_autosave_{userId}`)이라 **새 기안과 문서 편집이 같은
   * 칸을 썼다.** 편집 중 보관한 내용이 새 기안 칸을 덮어쓰고 그 반대도 일어났다.
   * "새 상신을 눌렀는데 엉뚱한 내용이 뜬다", "편집하던 게 사라진다"가 모두 여기서 나왔다.
   */
  const draftKey = `draft_autosave_${me.id}_${editDoc?.id ?? 'new'}`;
  const activeKey = `draft_autosave_active_${me.id}_${editDoc?.id ?? 'new'}`;

  const bootDraftRef = useRef<{ data: unknown; active: boolean } | null>(null);
  if (bootDraftRef.current === null) {
    let data: unknown = null;
    try {
      const raw = localStorage.getItem(draftKey);
      data = raw ? JSON.parse(raw) : null;
    } catch { /* 형식이 깨졌으면 없는 것으로 본다 */ }
    bootDraftRef.current = {
      data,
      active: localStorage.getItem(activeKey) === 'true',
    };
  }

  const clearAutosave = () => {
    localStorage.removeItem(draftKey);
    localStorage.removeItem(activeKey);
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
  }, [code, title, values, amount, attachments, relatedDocs, steps, recipients]);

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
     * **디바운스가 아니라 스로틀이다.**
     *
     * 디바운스는 "입력이 멈춘 뒤" 저장한다. 그래서 긴 글을 쉬지 않고 쓰면 타이머가
     * 계속 밀려 **한 번도 저장되지 않는다** — 정확히 가장 많이 잃는 상황이다.
     * 스로틀은 쓰는 도중에도 최소 주기마다 반드시 한 번 저장한다.
     *
     * 포커스 아웃(blur) 기준도 같은 이유로 쓰지 않는다. 한 칸에 오래 머무르면
     * 그 칸을 벗어난 적이 없어 한 번도 보관되지 않는다.
     */
    const snapshot = () => {
      localStorage.setItem(draftKey, JSON.stringify({
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
        steps,
        timestamp: Date.now()
      }));
      localStorage.setItem(activeKey, 'true');
      lastSnapshotAtRef.current = Date.now();
      setAutosavedAt(lastSnapshotAtRef.current);
    };

    /**
     * 첫 변경은 즉시 저장하고, 그 뒤로는 최소 `SAVE_INTERVAL_MS` 간격을 지킨다.
     * `localStorage` 쓰기는 동기이고 이 폼 크기면 밀리초 단위라 부담이 없다.
     */
    const SAVE_INTERVAL_MS = 1000;
    const sinceLast = Date.now() - lastSnapshotAtRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (sinceLast >= SAVE_INTERVAL_MS) {
      snapshot();
    } else {
      timer = setTimeout(snapshot, SAVE_INTERVAL_MS - sinceLast);
    }

    /**
     * 창을 떠날 때는 디바운스를 기다리지 않고 즉시 보관한다.
     *
     * **탭 종료가 특히 위험하다.** 정리(cleanup)에서 `clearTimeout` 이 돌기 때문에,
     * 마지막으로 친 글자가 1초 안에 있었다면 그대로 사라진다. 실제로 "탭 닫았는데
     * 저장이 안 된다"는 증상이 여기서 나왔다.
     *
     * `blur` 하나로는 부족하다 — 탭을 닫을 때 창 blur 는 보장되지 않는다.
     * 브라우저가 페이지를 접는 순간 확실히 오는 것은 `pagehide` 와
     * `visibilitychange`(hidden) 다. `localStorage` 쓰기는 동기라 이 시점에도 완료된다.
     */
    const flushIfHidden = () => { if (document.visibilityState === 'hidden') snapshot(); };
    window.addEventListener('blur', snapshot);
    window.addEventListener('pagehide', snapshot);
    window.addEventListener('beforeunload', snapshot);
    document.addEventListener('visibilitychange', flushIfHidden);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('blur', snapshot);
      window.removeEventListener('pagehide', snapshot);
      window.removeEventListener('beforeunload', snapshot);
      document.removeEventListener('visibilitychange', flushIfHidden);
    };
  }, [code, title, values, amount, securityLevel, visibility, preservationPeriod, attachments, relatedDocs, recipients, steps, me.id, editDoc?.id]);

  const hasCheckedAutosave = useRef(false);

  // 마운트 시 자동저장본 복구 제안
  useEffect(() => {
    if (hasCheckedAutosave.current) return;
    if (forms.length === 0) return; // 서식 정보가 로드될 때까지 대기

    // localStorage 를 다시 읽지 않는다 — 그 사이 clearAutosave() 가 지웠을 수 있다.
    const boot = bootDraftRef.current;
    let offered = false;
    if (boot?.active && boot.data) {
      {
        const data = boot.data as {
          docId?: string | null; code: string; timestamp: number;
        } & Record<string, unknown>;
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
      }
    }
    // 제안을 띄웠을 때만 플래그를 내린다. 예전에는 무조건 지워서, 이 화면에 잠깐
    // 들렀다 나가기만 해도 다음번 복구 제안이 사라졌다(내용은 남아 있는데도).
    if (offered) localStorage.removeItem(activeKey);
    hasCheckedAutosave.current = true;
  }, [me.id, forms, editDoc]);

  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // 자동저장 복구 제안 모달 상태
  const [showAutosaveRecoverModal, setShowAutosaveRecoverModal] = useState(false);
  const [pendingAutosaveData, setPendingAutosaveData] = useState<any>(null);
  const [autosaveFormName, setAutosaveFormName] = useState('');

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

    setRecipients(autoRecipients);

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
      setIsPostApproval(editDoc.isPostApproval ?? false);
      setPostApprovalActionTaken(editDoc.postApprovalActionTaken ?? '');
      setPostApprovalNecessity(editDoc.postApprovalNecessity ?? '');
      if (editDoc.postApprovedAt) setPostApprovedAt(editDoc.postApprovedAt);
      if (editDoc.postApprovedById) setPostApprovedById(editDoc.postApprovedById);
    }
  }, [editDoc]);

  // 이미 등록/저장된 기존 문서 편집이 아니라면, 새 기안 중에는 언제든 양식 변경 가능
  const canChangeForm = !editDoc;



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

  // 실시간 결재선 규칙 엔진 연동 + 서식 기본 참조자 연동
  const lastAutoSteps = useRef<string>('');
  useEffect(() => {
    if (route.isLoading || !code || editDoc) return;
    let line = route.build({ drafterId: me.id, docType: code, amount: amountNum, docData: values });

    // 서식 기본 참조자(사용자)가 지정되어 있다면 결재선에 병합 (중복/본인 제외)
    if (form?.referenceUserId && form.referenceUserId !== me.id) {
      const alreadyHasRef = line.some((s) => s.approverId === form.referenceUserId);
      if (!alreadyHasRef) {
        line = [
          ...line,
          {
            seq: line.length + 1,
            parallelGroup: null,
            executionType: 'sequential' as const,
            kind: '참조' as const,
            approverId: form.referenceUserId,
            delegatedFromId: null,
            decision: '대기' as const,
            decidedAt: null,
            comment: '',
          },
        ];
      }
    }

    const lineStr = JSON.stringify(line);
    const currentStr = JSON.stringify(steps);

    if (steps.length === 0 || currentStr === lastAutoSteps.current) {
      if (currentStr !== lineStr) {
        setSteps(line);
        lastAutoSteps.current = lineStr;
      }
    }
  }, [code, amountNum, values, route, me.id, steps, editDoc, form?.referenceUserId]);

  // 서식 기본 수신처/참조부서 초기값 연동
  useEffect(() => {
    if (editDoc || !form) return;
    if (recipients.length === 0) {
      const initialRecipients: ApprovalRecipient[] = [];
      if (form.recipientDeptId) {
        const dept = org.depts.find((d) => d.id === form.recipientDeptId);
        if (dept) initialRecipients.push({ id: dept.id, name: dept.name, type: 'dept' });
      }
      if (form.recipientUserId) {
        const u = org.userById(form.recipientUserId);
        if (u) initialRecipients.push({ id: u.id, name: u.name, type: 'user' });
      }
      if (form.referenceDeptId) {
        const dept = org.depts.find((d) => d.id === form.referenceDeptId);
        if (dept && !initialRecipients.some((r) => r.id === dept.id)) {
          initialRecipients.push({ id: dept.id, name: dept.name, type: 'dept' });
        }
      }
      if (initialRecipients.length > 0) {
        setRecipients(initialRecipients);
      }
    }
  }, [form, editDoc, org]);

  const isResubmit = !!editDoc && editDoc.status !== '임시저장';

  const buildInput = (): ApprovalDraftInput => {
    let leave: LeaveForm | null = null;
    if (code === '휴가') {
      const pStart = String(values['period'] || '');
      const lType = String(values['leaveType'] || '연차') as LeaveType;
      const isHalf = lType === '오전반차' || lType === '오후반차' || lType === '반차';
      const isQuarter = lType === '반반차';
      const pEnd = isHalf || isQuarter ? pStart : String(values['period__end'] || pStart);

      let pDays = Number(values['period__days']) || 0;
      if (isHalf) pDays = 0.5;
      else if (isQuarter) pDays = 0.25;

      const quarterSlot = isQuarter ? String(values['quarterSlot'] || 'PM2') : undefined;
      const timeWin = getDefaultTimeWindow(lType, quarterSlot);
      const startTime = String(values['startTime'] || timeWin.startTime);
      const endTime = String(values['endTime'] || timeWin.endTime);
      const reason = values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]).trim() : undefined;
      const subId = values['substituteId'] ? String(values['substituteId']) : undefined;
      const subUser = subId ? org.userById(subId) : null;
      const emergencyContact = values['emergencyContact']
        ? String(values['emergencyContact'])
        : values['contactNumber']
        ? String(values['contactNumber'])
        : undefined;

      leave = {
        leaveType: lType,
        startDate: pStart,
        endDate: pEnd,
        startTime,
        endTime,
        days: pDays,
        reason,
        substituteId: subId,
        substituteName: subUser ? `${subUser.name} · ${subUser.dept}` : undefined,
        emergencyContact,
      };
    }

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
      const lType = String(values['leaveType'] || '연차');
      const isHalf = lType === '오전반차' || lType === '오후반차' || lType === '반차';
      const isQuarter = lType === '반반차';
      const effectiveDays = isHalf ? 0.5 : isQuarter ? 0.25 : (Number(values['period__days']) || 0);

      if (!pStart || (!isHalf && !isQuarter && !pEnd) || effectiveDays <= 0) {
        return '휴가 기간을 올바르게 입력하세요.';
      }

      // 연차 및 반차 잔여일수 검증
      if (['연차', '오전반차', '오후반차', '반차', '반반차'].includes(lType)) {
        if (effectiveDays > bal.remaining) {
          return `신청 가능한 잔여 연차(${bal.remaining}일)를 초과하였습니다. (신청일수: ${effectiveDays}일)`;
        }
      }

      // 대체휴무 잔여일수 검증
      if (lType === '대체휴무') {
        if (effectiveDays > bal.substituteHoliday.remaining) {
          return `신청 가능한 잔여 대체휴무(${bal.substituteHoliday.remaining}일)를 초과하였습니다. (신청일수: ${effectiveDays}일)`;
        }
      }
    }

    if (code === '외근') {
      const pStart = values['period'];
      const dest = values['destination'];
      if (!pStart) return '외근 일자/기간을 입력하세요.';
      if (!dest || !String(dest).trim()) return '외근지(방문처)를 입력하세요.';
    }

    if (code === '국내출장' || code === '해외출장') {
      const pStart = values['period'];
      const dest = values['destination'];
      if (!pStart) return '출장 기간을 입력하세요.';
      if (!dest || !String(dest).trim()) return '출장지를 입력하세요.';
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





  return (
    <div className="flex w-full flex-col bg-panel">
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-[15px] font-extrabold text-ink flex items-center gap-2">
              <span>{isResubmit ? '반려 문서 수정·재상신' : editDoc ? '기안 문서 편집' : '기안 작성'}</span>
            </h1>
            <div className="flex items-center gap-1.5 rounded-lg bg-teal-soft/80 px-2.5 py-1 text-[11.5px] font-extrabold text-teal border border-teal/20 shadow-2xs">
              <span>{form?.icon || '📄'}</span>
              <span>{form?.name || code}</span>
            </div>
            {canChangeForm && (
              <button
                type="button"
                onClick={handleClickChangeForm}
                className="flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal-soft/60 px-3 py-1.5 text-[11.5px] font-extrabold text-teal hover:bg-teal hover:text-white transition-all shadow-xs cursor-pointer ml-1"
                title="다른 결재 양식으로 변경합니다"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>양식 변경</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isWideScreen && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal-soft/50 px-3 py-1.5 text-[12px] font-bold text-teal hover:bg-teal-soft transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <GitFork size={13} />
                <span>결재선</span>
              </span>
              <span className="rounded-full bg-teal px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                {steps.length}명
              </span>
            </button>
          )}

          <AutosaveIndicator at={autosavedAt} />
          {!isResubmit && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={busy || !canCreate}
              className="rounded-lg border border-border px-3.5 py-1.5 text-[12px] font-bold text-ink2 hover:bg-panel-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              임시저장
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !canCreate}
            className="rounded-lg bg-teal px-4 py-1.5 text-[12.5px] font-bold text-white hover:bg-teal-dark transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? '상신 중...' : isResubmit ? '재상신' : '상신 발송'}
          </button>
        </div>
      </header>

      {/* 에러 메시지 팝업 바 */}
      {error && (
        <div className="flex items-center justify-between bg-rose-500/10 border-b border-rose-500/30 px-6 py-2 text-[12px] font-bold text-rose-600">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </span>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* 기안 워크스페이스 본문 메인 레이아웃 (세로 완전 분리: 좌측 #878d90 공문서 캔버스 + 우측 세로 고정 결재선 사이드바) */}
      <div className="flex flex-1 w-full bg-[#878d90] min-h-[calc(100vh-53px)]">
        {/* 중앙 A4 문서 캔버스 (배경색 #878d90으로 백색 A4 용지와 완벽한 대비 및 세로 스크롤) */}
        <div className="flex-1 min-w-0 px-4 sm:px-8 py-8 overflow-y-auto flex justify-center bg-[#878d90] transition-colors">
          <ApprovalDraftDocumentSheet
            form={form}
            docCode={code}
            me={me}
            title={title}
            setTitle={setTitle}
            values={values}
            setVals={setVals}
            amount={amount}
            setAmount={setAmount}
            securityLevel={securityLevel}
            setSecurityLevel={setSecurityLevel}
            visibility={visibility}
            setVisibility={setVisibility}
            preservationPeriod={preservationPeriod}
            setPreservationPeriod={setPreservationPeriod}
            isPostApproval={isPostApproval}
            setIsPostApproval={setIsPostApproval}
            isPostApprovalSystemEnabled={isPostApprovalSystemEnabled}
            postApprovedAt={postApprovedAt}
            setPostApprovedAt={setPostApprovedAt}
            postApprovedBy={postApprovedById}
            setPostApprovedBy={setPostApprovedById}
            postApprovalActionTaken={postApprovalActionTaken}
            setPostApprovalActionTaken={setPostApprovalActionTaken}
            postApprovalNecessity={postApprovalNecessity}
            setPostApprovalNecessity={setPostApprovalNecessity}
            steps={steps}
            recipients={recipients}
            attachments={attachments}
            setAttachments={setAttachments}
            attachmentRetention={attachmentRetention}
            setAttachmentRetention={setAttachmentRetention}
            relatedDocs={relatedDocs}
            setRelatedDocs={setRelatedDocs}
            setShowRelatedModal={setShowRelatedModal}
            onFileUpload={handleFilesUpload}
            uploading={uploading}
            leaveBalance={bal}
            editDocNo={editDoc?.docNo}
            lastSavedAt={autosavedAt}
          />
        </div>

        {/* [3단] 우측 결재선 전용 고정 사이드바 — 공문서 공간과 세로 경계선으로 완벽 분리, 상단부터 바닥까지 100% 꽉 채움 */}
        {isWideScreen && (
          <aside
            className="w-[410px] xl:w-[430px] shrink-0 border-l border-slate-400/40 dark:border-slate-700 bg-panel sticky top-[53px] h-[calc(100vh-53px)] flex flex-col z-20 shadow-md"
          >
            {/* 패널 내부 헤더 — 패널 상단 고정 */}
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-panel-alt/95 backdrop-blur-sm px-4 py-3">
              <span className="text-[13px] font-extrabold text-ink flex items-center gap-1.5">
                <GitFork className="h-4 w-4 text-teal shrink-0" />
                <span>결재선 설정</span>
              </span>
              <span className="text-[11px] text-ink3 font-semibold">
                {steps.length}명 지정됨
              </span>
            </div>

            {/* 결재선 빌더 + 수신/시행 (bottomSlot) — 내부 독립 스크롤 */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4">
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
                    org={org}
                  />
                }
              />
            </div>
          </aside>
        )}

      </div>

      {/* 해상도 작을 때 우측 결재선 Drawer (header z-[200]보다 높은 z-[300] 지정) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[300] flex justify-end bg-black/40 xl:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="h-full w-full max-w-lg bg-panel p-4 shadow-2xl flex flex-col overflow-y-auto overflow-x-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <span className="text-[15px] font-bold text-ink flex items-center gap-1.5">
                <GitFork className="h-4 w-4 text-teal shrink-0" />
                <span>결재선 설정</span>
              </span>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-ink3 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
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
                  org={org}
                />
              }
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
            /**
             * **저장 조건을 먼저 확인한다.**
             *
             * 임시저장 버튼은 `validate(false)` 를 거쳐 "제목을 입력하세요"를 띄우는데,
             * 이 경로는 그걸 건너뛰고 곧장 저장을 시도했다. 제목이 없으면 저장이 실패하고
             * 아무 안내도 없이 화면만 그대로 있어 **"눌러도 아무 일이 없다"** 로 보였다.
             */
            const err = validate(false);
            if (err) {
              setShowConfirmClose(false);
              setError(err);
              return;
            }
            try {
              await persistDraft();
              clearAutosave();
              setShowConfirmClose(false);
              navigate('/gw/approval');
            } catch (e) {
              // 저장이 실패하면 이동하지 않는다. 원인을 화면에 남긴다.
              setShowConfirmClose(false);
              setError(e instanceof Error ? e.message : String(e));
            }
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

      {/* 결재 양식 선택 모달 */}
      <DraftFormSelectModal
        open={showSelectModal}
        onClose={() => setShowSelectModal(false)}
        onSelect={handleSelectNewForm}
        currentCode={code}
      />

      {/* 양식 변경 확인 다이얼로그 (작성 내용 보존 여부 선택) */}
      <FormChangeConfirmDialog
        open={showChangeConfirm}
        currentFormName={form?.name || code}
        onSaveAndChange={handleSaveAndChange}
        onDiscardAndChange={handleDiscardAndChange}
        onCancel={() => setShowChangeConfirm(false)}
        isSaving={isChangingFormSaving}
      />
    </div>
  );
}


