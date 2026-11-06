import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ViewerFile } from './fileViewer/viewerShell';

/**
 * 휴대폰 앱(PWA) 안 파일 보기 — 채팅방 등에서 받은 PDF·엑셀·워드를 앱 안에서 연다.
 * 다운로드해서 다른 뷰어 앱으로 열면(휴대폰에 따라 다운로드 뒤 자동으로 뜨는 '다른 앱으로 열기') 그 앱이 따로 떠서,
 * 뒤로가기를 누르면 앱이 아니라 홈 화면으로 나가 버렸다. 이 화면은 열 때 방문 기록을 하나 쌓아
 * 휴대폰 [뒤로가기]가 이 화면만 닫고 원래 화면(대화방)으로 돌아오게 한다.
 * 화면마다 그리는 라이브러리(pdf.js·docx-preview·엑셀 읽기)는 그 종류를 처음 열 때만 내려받는다(앱 시작 속도에 영향 없음).
 *
 * 쓰는 쪽: openFileViewer({ blob, name, mime }) — 앱 셸(MobileApp)의 <MobileFileViewerHost /> 가 받는다.
 */
const OPEN_EVENT = 'workfit-open-file';

export type ViewerKind = 'pdf' | 'xlsx' | 'docx';

/** 앱 안에서 볼 수 있는 파일 종류 — 아니면 null(공유 창·다운로드로 연다) */
export function viewerKindOf(name: string, mime?: string): ViewerKind | null {
  const ext = name.trim().split('.').pop()?.toLowerCase() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  return null;
}

export function openFileViewer(file: ViewerFile) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: file }));
}

const PdfScreen = lazy(() => import('./fileViewer/PdfScreen'));
const XlsxScreen = lazy(() => import('./fileViewer/XlsxScreen'));
const DocxScreen = lazy(() => import('./fileViewer/DocxScreen'));

/** 앱 셸에 한 번 두는 받침 — 열기 신호를 받아 보기 화면을 띄우고, [뒤로가기]로 닫는다 */
export function MobileFileViewerHost() {
  const [file, setFile] = useState<ViewerFile | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<ViewerFile>).detail;
      if (!d?.blob || !viewerKindOf(d.name, d.mime)) return;
      setFile(d);
      // 뒤로가기가 이 화면만 닫게 — 같은 주소로 기록 하나
      if (!pushed.current) {
        window.history.pushState({ ...(window.history.state ?? {}), workfitFileViewer: true }, '');
        pushed.current = true;
      }
    };
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      setFile(null);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  // 보는 동안은 '당겨서 새로고침'을 끈다 — 위로 끌다가 잘못 당기면 휴대폰 크롬이 앱을 새로고침해 대화방으로 튕겼다
  useEffect(() => {
    if (!file) return;
    const html = document.documentElement.style;
    const body = document.body.style;
    const prev = [html.overscrollBehaviorY, body.overscrollBehaviorY];
    html.overscrollBehaviorY = 'none';
    body.overscrollBehaviorY = 'none';
    return () => {
      html.overscrollBehaviorY = prev[0];
      body.overscrollBehaviorY = prev[1];
    };
  }, [file]);

  // [닫기] — 쌓아 둔 기록을 되돌린다(popstate 가 닫는다)
  const close = () => {
    if (pushed.current) window.history.back();
    else setFile(null);
  };

  if (!file) return null;
  const kind = viewerKindOf(file.name, file.mime);
  const Screen = kind === 'xlsx' ? XlsxScreen : kind === 'docx' ? DocxScreen : PdfScreen;
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[200] grid place-items-center bg-[#3a3a3a] text-[13px] text-white/80">여는 중…</div>}>
      <Screen file={file} onClose={close} />
    </Suspense>
  );
}
