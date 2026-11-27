import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
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

type ScreenProps = { file: ViewerFile; onClose: () => void };

/**
 * 보기 화면을 내려받지 못했을 때 — 새 버전이 배포돼 옛 파일이 사라졌거나(앱을 열어 둔 채 배포된 경우) 통신이 끊긴 경우.
 * 그냥 두면 앱 전체가 하얗게 되므로, 안내와 [새로고침]·[닫기]를 보인다(새로고침은 본인이 누른다 — 쓰던 글을 지킬 수 있게)
 */
function ScreenLoadFailed({ onClose }: ScreenProps) {
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[#3a3a3a] px-6 text-center text-[13px] leading-relaxed text-white/90">
      <div>
        파일 보기 화면을 불러오지 못했습니다.
        <br />
        새 버전이 배포됐거나 통신이 끊겼을 수 있습니다. 새로고침한 뒤 다시 열어 주세요.
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-white/15 px-4 py-2 font-semibold">
            닫기
          </button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white px-4 py-2 font-semibold text-[#222]">
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
}

/** 보기 화면 내려받기 — 실패하면 잠깐 뒤 한 번 더, 그래도 안 되면 안내 화면 */
function lazyScreen(load: () => Promise<{ default: ComponentType<ScreenProps> }>) {
  return lazy(async () => {
    try {
      return await load();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 800));
      try {
        return await load();
      } catch (error) {
        console.error('파일 보기 화면을 불러오지 못했습니다.', error);
        return { default: ScreenLoadFailed };
      }
    }
  });
}

const PdfScreen = lazyScreen(() => import('./fileViewer/PdfScreen'));
const XlsxScreen = lazyScreen(() => import('./fileViewer/XlsxScreen'));
const DocxScreen = lazyScreen(() => import('./fileViewer/DocxScreen'));

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
  // 문서 맨 위층(body)에 띄운다 — 앱 틀(z-100) 안에 두면 body 에 띄운 창(파일함 z-150 등)에서 열 때 그 뒤에 가려졌다
  return createPortal(
    <Suspense fallback={<div className="fixed inset-0 z-[200] grid place-items-center bg-[#3a3a3a] text-[13px] text-white/80">여는 중…</div>}>
      <Screen file={file} onClose={close} />
    </Suspense>,
    document.body,
  );
}
