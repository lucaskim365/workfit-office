import { useEffect, useMemo, useState } from 'react';
import { useApprovalFolders, useApprovalForms } from '@/features/gw/useApprovalForms';
import { useSheetFormVersions } from '@/features/gw/useApprovalFormVersions';
import { usePermission } from '@/features/auth/usePermission';
import { SheetFormDesigner } from './SheetFormDesigner';
import {
  dropSheetEditorPayload,
  postSheetEditorMessage,
  readSheetEditorPayload,
  sheetEditorChannel,
  type SheetEditorMessage,
  type SheetEditorPayload,
} from './sheetEditorTab';

/** 이 탭의 이름표(같은 서식이 다른 탭에도 열려 있는지 알아볼 때) */
const TAB_ID = Math.random().toString(36).slice(2, 10);
const FORM_ADMIN_URL = '/base/approval-form';

/**
 * 시트 서식 편집기 새 탭(/sheet-editor) — 앱 상단바·탭·메뉴 없이 편집기만.
 * ?k= 결재서식 관리에서 넘긴 내용(새 서식·변환 초안 포함), ?form= 저장된 서식 코드(새로고침·직접 열기 때 DB 에서 읽음)
 */
export default function SheetEditorPage() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('k');
  const [formParam, setFormParam] = useState(params.get('form'));
  const { canAccess, isLoading: permLoading } = usePermission();
  const { data: forms = [], isLoading: formsLoading } = useApprovalForms();
  const { data: folders = [] } = useApprovalFolders();
  const { latest: versions, isLoading: versionsLoading } = useSheetFormVersions();
  // 처음 연 내용 — 한 번만 정한다(편집기가 그 뒤로 자기 상태를 가진다)
  const [payload, setPayload] = useState<SheetEditorPayload | null>(() => readSheetEditorPayload(key));
  useEffect(() => {
    if (payload || !formParam || formsLoading || versionsLoading) return;
    const form = forms.find((f) => f.id === formParam || f.code === formParam);
    if (form) setPayload({ form, version: versions.get(form.id) ?? null });
  }, [payload, formParam, forms, formsLoading, versions, versionsLoading]);

  const formId = payload?.form.id || formParam || '';
  // 같은 서식이 다른 탭에도 열려 있으면 알린다 — 둘 다 저장하면 나중 것이 새 버전이 된다(앞의 것도 버전 기록에 남음)
  const [otherTab, setOtherTab] = useState(false);
  useEffect(() => {
    if (!formId) return;
    const ch = sheetEditorChannel();
    if (!ch) return;
    ch.onmessage = (e: MessageEvent<SheetEditorMessage>) => {
      const m = e.data;
      if ((m.type === 'hello' || m.type === 'here') && m.formId === formId && m.tabId !== TAB_ID) {
        setOtherTab(true);
        if (m.type === 'hello') ch.postMessage({ type: 'here', formId, tabId: TAB_ID } satisfies SheetEditorMessage);
      }
    };
    ch.postMessage({ type: 'hello', formId, tabId: TAB_ID } satisfies SheetEditorMessage);
    return () => ch.close();
  }, [formId]);

  const title = payload ? payload.form.name || '새 시트 서식' : '시트 서식 편집';
  useEffect(() => {
    document.title = `${title} — 서식 편집`;
  }, [title]);

  /** 탭 닫기 — 스크립트로 연 탭이 아니면 닫히지 않으니 결재서식 관리로 */
  const closeTab = () => {
    dropSheetEditorPayload(key);
    window.close();
    window.setTimeout(() => {
      if (!window.closed) window.location.href = FORM_ADMIN_URL;
    }, 200);
  };

  const notice = useMemo(() => {
    if (!payload?.draft) return undefined;
    return payload.starter
      ? {
          text: `기본 서식 '${payload.source}'에서 시작한 새 서식입니다. 회사에 맞게 다듬고 [미리보기]로 확인한 뒤 저장하세요 — 저장하면 '사용 안 함'으로 생기고, 서식 목록에서 켜면 기안 목록에 나옵니다.`,
          list: payload.draft.warnings,
        }
      : {
          text: `기존 서식 '${payload.source}'에 붙일 시트 초안입니다. 모양을 다듬고 [미리보기]로 확인한 뒤 저장하세요 — 저장해도 '시트로 기안'을 켜기 전까지 기안자는 기존 양식으로 씁니다.`,
          list: payload.draft.warnings,
        };
  }, [payload]);

  if (permLoading) return null;
  if (!canAccess(FORM_ADMIN_URL)) {
    return <Centered>결재서식 관리 권한이 없습니다.</Centered>;
  }
  if (!payload) {
    if (formParam && (formsLoading || versionsLoading)) return <Centered>서식을 불러오는 중…</Centered>;
    return (
      <Centered>
        열 서식을 찾지 못했습니다 — 결재서식 관리에서 다시 열어 주세요.{' '}
        <a href={FORM_ADMIN_URL} className="font-bold text-teal underline">
          결재서식 관리로
        </a>
      </Centered>
    );
  }

  return (
    // 엑셀처럼 창을 꽉 채운다 — 페이지는 스크롤하지 않고 격자·옆 막대가 각자 안에서 스크롤
    <div className="flex h-screen flex-col bg-bg p-2">
      {otherTab && (
        <div className="mb-2 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-800">
          이 서식이 다른 탭에서도 열려 있습니다 — 두 곳에서 저장하면 나중에 저장한 것이 새 버전이 됩니다(앞의 것도 버전 기록에 남음).
        </div>
      )}
      <div className="min-h-0 flex-1">
      <SheetFormDesigner
        form={payload.form}
        version={payload.version}
        forms={forms}
        folders={folders}
        onClose={closeTab}
        initialSheet={payload.draft?.sheet}
        initialLink={payload.draft?.link}
        initialNotice={notice}
        standalone
        onSaved={(savedId) => {
          postSheetEditorMessage({ type: 'saved', formId: savedId });
          // 저장한 뒤로는 DB 의 서식으로 — 새로고침해도 그 서식이 열리게(맡긴 초안은 지움)
          dropSheetEditorPayload(key);
          if (savedId !== formParam) {
            setFormParam(savedId);
            window.history.replaceState(null, '', `?form=${encodeURIComponent(savedId)}`);
          }
        }}
        onOpenLegacy={
          payload.form.fields?.length
            ? () => {
                // 기존 양식 편집기는 결재서식 관리 창에서 연다
                postSheetEditorMessage({ type: 'open-legacy', formId: payload.form.id });
                closeTab();
              }
            : undefined
        }
      />
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-bg px-4 text-center text-[13px] text-ink2">{children}</div>;
}
