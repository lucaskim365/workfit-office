import { useState, useEffect } from 'react';
import {
  X,
  Share,
  PlusSquare,
  Bell,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Smartphone,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDismissToday?: () => void;
}

const DISMISS_KEY = 'workfit_pwa_guide_dismissed_until';

/**
 * 오늘 하루 보지 않기 설정 여부 확인
 */
export function isGuideDismissedToday(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch {
    return false;
  }
}

/**
 * 오늘 하루 보지 않기 (24시간 동안 저장)
 */
export function dismissGuideToday(): void {
  try {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    /* 무시 */
  }
}

/**
 * 기기 및 브라우저 환경 감지 헬퍼
 */
export function checkDeviceEnvironment() {
  if (typeof window === 'undefined') {
    return { isIos: false, isStandalone: false, isSafari: false, isInApp: false };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIos =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

  // 카카오톡, 네이버, 페이스북, 인스타그램 등 인앱 브라우저 감지
  const isInApp = /kakaotalk|naver|line|fbav|instagram|daum/i.test(ua);

  // 크롬(CriOS), 파이어폭스(FxiOS) 제외한 순수 Safari 여부
  const isSafari =
    isIos &&
    /safari/.test(ua) &&
    !/crios|fxios|opt|edgios|kakaotalk|naver|line/i.test(ua);

  return { isIos, isStandalone, isSafari, isInApp };
}

export default function IosPwaGuideModal({ isOpen, onClose, onDismissToday }: Props) {
  const [activeTab, setActiveTab] = useState<'install' | 'faq' | 'usage'>('install');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [dontShowToday, setDontShowToday] = useState(false);

  const env = checkDeviceEnvironment();

  useEffect(() => {
    if (isOpen) {
      // 모달 오픈 시 배경 스크롤 방지
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowToday) {
      dismissGuideToday();
      onDismissToday?.();
    }
    onClose();
  };

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative flex h-[92vh] sm:h-[85vh] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[24px] sm:rounded-2xl bg-white shadow-2xl"
        style={{ color: '#1e293b' }}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#101830] px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="text-[20px]">📱</span>
            <div>
              <h2 className="text-[16px] font-extrabold leading-tight tracking-tight">
                아이폰 설치 &amp; 알림 설정 가이드
              </h2>
              <p className="text-[11px] text-white/70">워크핏 메신저 앱스토어 설치 없이 앱처럼 사용하기</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-[13px] font-bold">
          <button
            onClick={() => setActiveTab('install')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 transition-colors ${
              activeTab === 'install'
                ? 'border-b-2 border-[#101830] bg-white text-[#101830]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone size={16} />
            <span>설치 &amp; 알림 3단계</span>
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 transition-colors ${
              activeTab === 'usage'
                ? 'border-b-2 border-[#101830] bg-white text-[#101830]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare size={16} />
            <span>사용법 요약</span>
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 transition-colors ${
              activeTab === 'faq'
                ? 'border-b-2 border-[#101830] bg-white text-[#101830]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <HelpCircle size={16} />
            <span>자주 묻는 질문 (FAQ)</span>
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-[13.5px] leading-relaxed select-text">
          {/* 인앱 브라우저 경고 (카카오톡, 네이버 앱 등) */}
          {env.isIos && env.isInApp && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-[12.5px] text-amber-900 shadow-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <strong className="font-bold">Safari 브라우저로 다시 열어주세요!</strong>
                  <p className="mt-0.5 text-amber-800">
                    현재 카카오톡 등 인앱 브라우저로 접속하셨습니다. 화면 우측 하단의 <span className="font-bold">···</span> 메뉴를 눌러 <span className="font-semibold underline decoration-amber-600 underline-offset-2">"다른 브라우저로 열기(Safari)"</span>를 선택해야 홈 화면 추가와 알림이 가능합니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: 설치 & 알림 3단계 */}
          {activeTab === 'install' && (
            <div className="space-y-5">
              {/* 꼭 확인: 준비 사항 */}
              <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900">
                  <CheckCircle2 size={17} className="text-emerald-600" />
                  <span>준비 사항 (꼭 확인)</span>
                </h3>
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-[12px]">
                    <tbody className="divide-y divide-slate-100">
                      <tr className="bg-slate-50/60 font-semibold text-slate-700">
                        <td className="w-28 px-3 py-2">항목</td>
                        <td className="px-3 py-2">조건</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-slate-600">아이폰 iOS 버전</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          iOS 16.4 이상 <span className="font-normal text-slate-500">(설정 → 일반 → 정보에서 확인)</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-slate-600">브라우저</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          반드시 <span className="text-blue-600">Safari</span> <span className="font-normal text-slate-500">(크롬·기타 브라우저는 설치·알림 불가)</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-slate-600">접속 주소</td>
                        <td className="px-3 py-2 font-mono text-[11.5px] font-semibold text-slate-800">
                          https://intra.widdyax.com/m
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-2.5 flex items-start gap-1.5 text-[11.5px] font-medium text-rose-600">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>중요:</strong> iPhone 웹 푸시는 <strong>"홈 화면에 추가"</strong>로 설치한 앱에서만 작동합니다. Safari로 그냥 보는 상태에서는 알림이 오지 않습니다.
                  </span>
                </div>
              </section>

              {/* 1단계. 홈 화면에 앱 설치하기 */}
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#101830] text-[12px] font-bold text-white">
                    1
                  </span>
                  <h3 className="text-[15px] font-bold text-slate-900">1단계. 홈 화면에 앱 설치하기</h3>
                </div>

                <ol className="mt-3 space-y-2 pl-2 text-[13px] text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-400">1.</span>
                    <span>아이폰에서 <strong className="text-blue-600">Safari</strong>를 엽니다.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-400">2.</span>
                    <span>주소창에 <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-slate-800">intra.widdyax.com/m</code> 를 입력해 접속합니다.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-400">3.</span>
                    <div>
                      <span>화면 하단(또는 상단)의 <strong>공유 버튼</strong></span>
                      <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-800 mx-1">
                        <Share size={13} className="text-blue-600" /> (네모 상자에 위쪽 화살표)
                      </span>
                      <span>을 누릅니다.</span>
                      <p className="text-[11.5px] text-slate-500 mt-0.5">※ 툴바가 안 보이면 화면을 위로 살짝 스와이프하세요.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-400">4.</span>
                    <div>
                      <span>메뉴를 아래로 스크롤하여 </span>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-900">
                        <PlusSquare size={13} className="text-slate-700" /> "홈 화면에 추가"
                      </span>
                      <span>를 누릅니다.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-400">5.</span>
                    <span>오른쪽 위 <strong className="text-blue-600">"추가"</strong>를 누릅니다.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-400">6.</span>
                    <div className="flex items-center gap-2">
                      <span>홈 화면에 워크핏 아이콘이 생성됩니다.</span>
                      <img src="/icons/icon-192.png" alt="아이콘" className="h-6 w-6 rounded-lg shadow-sm" />
                    </div>
                  </li>
                </ol>
              </section>

              {/* 2단계. 로그인 */}
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#101830] text-[12px] font-bold text-white">
                    2
                  </span>
                  <h3 className="text-[15px] font-bold text-slate-900">2단계. 로그인</h3>
                </div>
                <ol className="mt-3 space-y-2 pl-2 text-[13px] text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-400">7.</span>
                    <span>홈 화면의 워크핏 아이콘을 눌러 앱을 실행합니다. <span className="text-slate-500 font-medium">(주소창 없이 전체화면으로 뜨면 정상)</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-slate-400">8.</span>
                    <span>사번(또는 사내 이메일)과 비밀번호를 입력하고 로그인을 누릅니다. <span className="text-slate-500">(초기 비밀번호는 관리자에게 문의)</span></span>
                  </li>
                </ol>
              </section>

              {/* 3단계. 알림(푸시) 켜기 — 가장 중요 ★ */}
              <section className="rounded-xl border-2 border-amber-400 bg-amber-50/40 p-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500 text-[12px] font-bold text-white">
                      3
                    </span>
                    <h3 className="text-[15px] font-extrabold text-amber-950">
                      3단계. 알림(푸시) 켜기 <span className="text-red-500 font-bold">— 가장 중요!</span>
                    </h3>
                  </div>
                  <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10.5px] font-bold text-amber-900">
                    필수
                  </span>
                </div>

                <div className="mt-3 rounded-lg bg-white p-3.5 border border-amber-200/80">
                  <ol className="space-y-2 text-[13px] text-slate-800">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">9.</span>
                      <div>
                        <span>로그인 후, 화면 우측 상단의 </span>
                        <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 font-bold text-white">
                          <Bell size={12} className="text-amber-300" /> 종 버튼
                        </span>
                        <span>을 누릅니다.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">10.</span>
                      <div>
                        <span>"워크핏에서 알림을 보내려고 합니다" 팝업이 뜨면 </span>
                        <strong className="text-blue-600 font-extrabold underline decoration-blue-500 underline-offset-2">"허용"</strong>
                        <span>을 누릅니다.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">11.</span>
                      <div>
                        <span>화면 상단에 </span>
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">
                          ✅ 알림이 켜졌습니다
                        </span>
                        <span>가 뜨면 완료입니다.</span>
                      </div>
                    </li>
                  </ol>

                  <div className="mt-3.5 rounded-md bg-amber-100/60 p-2.5 text-[12px] text-amber-950 font-medium">
                    🔔 이제 다른 사람이 메시지를 보내면, 잠금화면 및 알림센터에 푸시 알림이 실시간으로 도착합니다!
                  </div>
                </div>
              </section>

              {/* 참고 사항 */}
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[12px] text-slate-600">
                <h4 className="flex items-center gap-1 font-bold text-slate-800">
                  <Info size={14} className="text-blue-600" />
                  <span>참고 사항</span>
                </h4>
                <ul className="mt-1.5 space-y-1 list-disc pl-4">
                  <li>이 앱은 웹 기술(PWA)로 만들어져, 별도의 앱스토어 설치·업데이트가 필요 없습니다. 서버가 갱신되면 자동으로 최신 버전이 반영됩니다.</li>
                  <li>데스크톱(맥/윈도우)에서도 Chrome/Safari로 같은 주소(<code className="font-mono">/m</code>) 접속 후 알림을 켜면 푸시를 받을 수 있습니다.</li>
                  <li>문의: 사내 IT / 관리자</li>
                </ul>
              </section>
            </div>
          )}

          {/* TAB 2: 사용법 요약 */}
          {activeTab === 'usage' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
                  <MessageSquare size={17} className="text-blue-600" />
                  <span>워크핏 메신저 주요 기능 요약</span>
                </h3>
                <div className="mt-4 space-y-3 text-[13px]">
                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-rose-500 text-white font-bold text-[11px]">
                      1
                    </div>
                    <div>
                      <strong className="text-slate-900">채팅방 목록 &amp; 안 읽은 배지</strong>
                      <p className="mt-0.5 text-[12px] text-slate-600">
                        대화방을 눌러 입장하며, 읽지 않은 새 메시지는 빨간 숫자 배지로 즉시 표시됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-500 text-white font-bold text-[11px]">
                      2
                    </div>
                    <div>
                      <strong className="text-slate-900">메시지 보내기</strong>
                      <p className="mt-0.5 text-[12px] text-slate-600">
                        하단 입력창에 내용을 입력한 후 전송(<span className="font-bold">↑</span>) 버튼을 누릅니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-purple-500 text-white font-bold text-[11px]">
                      3
                    </div>
                    <div>
                      <strong className="text-slate-900">답글(인용) 기능</strong>
                      <p className="mt-0.5 text-[12px] text-slate-600">
                        상대방의 특정 메시지에 답장하면 해당 원문 내용이 인용되어 깔끔하게 표시됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-emerald-500 text-white font-bold text-[11px]">
                      4
                    </div>
                    <div>
                      <strong className="text-slate-900">사진 &amp; 파일 첨부</strong>
                      <p className="mt-0.5 text-[12px] text-slate-600">
                        대화방 내에서 사진이나 문서 파일을 손쉽게 업로드하고 바로 확인 및 다운로드할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 추가 안내: 전자결재 연동 */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-[12.5px] text-blue-950">
                <h4 className="font-bold flex items-center gap-1.5 text-blue-900">
                  <span>📋 전자결재 결재함 지원</span>
                </h4>
                <p className="mt-1 leading-relaxed text-blue-800">
                  화면 상단의 문서 결재 아이콘을 누르면 결재 대기/진행 문서 목록을 모바일에서도 즉시 확인하고 승인/반려할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: FAQ */}
          {activeTab === 'faq' && (
            <div className="space-y-3">
              <div className="mb-2 text-[12.5px] text-slate-600">
                설치나 알림 수신 중 궁금한 점을 확인하세요.
              </div>

              {faqList.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-sm"
                  >
                    <button
                      onClick={() => toggleFaq(idx)}
                      className="flex w-full items-center justify-between p-3.5 text-left text-[13.5px] font-bold text-slate-900"
                    >
                      <span className="flex items-start gap-2 pr-2">
                        <span className="font-bold text-blue-600">Q.</span>
                        <span>{item.q}</span>
                      </span>
                      {isOpen ? (
                        <ChevronUp size={16} className="shrink-0 text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="shrink-0 text-slate-400" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-3.5 text-[12.5px] leading-relaxed text-slate-700">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-emerald-600">A.</span>
                          <div>{item.a}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 하단 버튼 및 오늘 하루 보지 않기 */}
        <div className="border-t border-slate-200 bg-white px-5 py-3.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>오늘 하루 보지 않기</span>
            </label>

            <button
              onClick={handleClose}
              className="rounded-lg bg-[#101830] px-5 py-2.5 text-[13.5px] font-bold text-white shadow-sm transition hover:bg-[#1a2850] active:scale-[0.98]"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const faqList = [
  {
    q: '"홈 화면에 추가"가 안 보여요.',
    a: (
      <span>
        크롬(Chrome), 네이버, 카카오톡 등 다른 브라우저일 가능성이 높습니다. 반드시 아이폰 기본 브라우저인 <strong>Safari</strong>로 다시 접속해 주세요.
      </span>
    ),
  },
  {
    q: '🔔(종) 버튼을 눌러도 권한 팝업이 안 떠요.',
    a: (
      <span>
        과거에 이미 알림을 차단했을 수 있습니다. 아이폰 <strong className="font-semibold text-slate-900">설정 → 알림 → 워크핏</strong>에서 알림을 <strong className="text-blue-600 font-semibold">허용</strong>으로 바꾼 뒤, 앱을 완전히 껐다 켜고 다시 🔔 버튼을 누르세요.
      </span>
    ),
  },
  {
    q: '알림이 안 와요.',
    a: (
      <ol className="list-decimal pl-4 space-y-1">
        <li>아이폰 <strong>설정 → 알림 → 워크핏</strong>이 "허용" 상태인지 확인하세요.</li>
        <li><strong>집중 모드 / 방해 금지</strong>가 켜져 있는지 확인하세요.</li>
        <li>반드시 Safari 일반 창이 아닌, <strong>"홈 화면에 추가"한 워크핏 앱</strong>에서 알림(🔔)을 켰는지 확인하세요.</li>
      </ol>
    ),
  },
  {
    q: 'iOS 가 16.4 보다 낮아요.',
    a: (
      <span>
        Apple 정책상 iOS 16.4 미만 버전에서는 웹 푸시가 지원되지 않습니다. 아이폰 <strong className="font-semibold text-slate-900">설정 → 일반 → 소프트웨어 업데이트</strong>를 통해 iOS를 최신 버전으로 업데이트해 주세요.
      </span>
    ),
  },
  {
    q: '로그인이 안 돼요.',
    a: (
      <span>
        사번과 비밀번호를 다시 확인해 주세요. 계정이 "사용" 상태인지 사내 관리자에게 문의하세요. (퇴사 또는 잠금 계정은 모바일 로그인이 불가합니다.)
      </span>
    ),
  },
];
