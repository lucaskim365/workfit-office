import { useState, useEffect, useMemo } from 'react';
import { applyTheme, getContrastColor } from '@/app/shell/ThemeCustomizerModal';

export default function SettingsScreen() {
  const [activeTab, setActiveTab] = useState<'theme' | 'notification'>('theme');

  // Theme states
  const [headerBg, setHeaderBg] = useState(() => localStorage.getItem('custom_theme_header_bg') ?? '#dbeafe');
  const [pointColor, setPointColor] = useState(() => localStorage.getItem('custom_theme_point_color') ?? '#99bbff');
  const [btnColor, setBtnColor] = useState(() => localStorage.getItem('custom_theme_btn_color') ?? '#1243b5');

  // Notification states (mock)
  const [notiMute, setNotiMute] = useState(false);
  const [notiPush, setNotiPush] = useState(true);
  const [notiChat, setNotiChat] = useState(true);
  const [notiApproval, setNotiApproval] = useState(true);

  // Font scale states
  const [fontScale, setFontScale] = useState(() => localStorage.getItem('custom_font_scale') ?? '1.125');

  // Load theme and font scale values
  useEffect(() => {
    setHeaderBg(localStorage.getItem('custom_theme_header_bg') ?? '#dbeafe');
    setPointColor(localStorage.getItem('custom_theme_point_color') ?? '#99bbff');
    setBtnColor(localStorage.getItem('custom_theme_btn_color') ?? '#1243b5');
    setFontScale(localStorage.getItem('custom_font_scale') ?? '1.125');
  }, []);

  const handleFontScaleChange = (scale: string) => {
    setFontScale(scale);
    document.documentElement.style.setProperty('--font-scale', scale);
  };

  const handleSaveTheme = () => {
    localStorage.setItem('custom_theme_header_bg', headerBg);
    localStorage.setItem('custom_theme_point_color', pointColor);
    localStorage.setItem('custom_theme_btn_color', btnColor);
    localStorage.setItem('custom_font_scale', fontScale);
    applyTheme(headerBg, pointColor, btnColor);
    document.documentElement.style.setProperty('--font-scale', fontScale);
    alert('설정이 성공적으로 저장되었습니다.');
  };

  const handleResetTheme = () => {
    setHeaderBg('#dbeafe');
    setPointColor('#99bbff');
    setBtnColor('#1243b5');
    setFontScale('1.125');
    document.documentElement.style.setProperty('--font-scale', '1.125');
  };

  const headerTextColor = useMemo(() => getContrastColor(headerBg), [headerBg]);
  const pointTextColor = useMemo(() => getContrastColor(pointColor), [pointColor]);
  const btnTextColor = useMemo(() => getContrastColor(btnColor), [btnColor]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-4 flex flex-col h-full overflow-hidden">
      {/* 타이틀 헤더 */}
      <div className="flex items-center gap-2 pb-4 border-b border-border">
        <span className="text-[20px]">⚙️</span>
        <h1 className="text-[17px] font-bold text-ink">환경설정</h1>
      </div>

      {/* 메인 2열 레이아웃 */}
      <div className="mt-5 flex gap-4 max-h-[calc(100vh-170px)] items-start overflow-hidden">
        {/* 좌측: 탭 리스트 (전자결재 함 탭 스타일) */}
        <div className="w-44 shrink-0 rounded-xl border border-border bg-panel p-2 flex flex-col gap-1.5 overflow-y-auto">
          <div className="px-2.5 py-1 rounded bg-panel-alt text-[10px] font-extrabold tracking-wider uppercase text-ink3 mb-1">
            설정 메뉴
          </div>
          <button
            onClick={() => setActiveTab('theme')}
            className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-bold transition-all flex items-center gap-2 ${
              activeTab === 'theme'
                ? 'bg-teal text-white shadow-sm'
                : 'text-ink2 hover:bg-panel-alt'
            }`}
          >
            🎨 테마 설정
          </button>
          <button
            onClick={() => setActiveTab('notification')}
            className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-bold transition-all flex items-center gap-2 ${
              activeTab === 'notification'
                ? 'bg-teal text-white shadow-sm'
                : 'text-ink2 hover:bg-panel-alt'
            }`}
          >
            🔔 알림 설정
          </button>
        </div>

        {/* 우측: 상세 폼 */}
        <div className="flex-1 max-w-2xl bg-panel border border-border rounded-xl flex flex-col overflow-hidden">
          {activeTab === 'theme' ? (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
              <div className="w-full max-w-xl">
                <h2 className="text-[14px] font-bold text-ink mb-1">테마 컬러 커스터마이저</h2>
                <p className="text-[11.5px] text-ink3 mb-6">메인 헤더 및 포인트 강조 색상을 사용자의 취향에 맞게 사용자 정의합니다.</p>
              </div>

              <div className="space-y-4 w-full max-w-xl">
                {/* 1) 헤더 배경색 */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel-alt p-4">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-bold text-ink">헤더 배경색</span>
                    <span className="text-[10px] text-ink3 mt-0.5">상단 탑바 영역의 색상</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      style={{ backgroundColor: headerBg, color: headerTextColor }}
                      className="flex items-center justify-center px-3 py-1 rounded text-[11px] font-extrabold shadow-sm border border-black/5"
                    >
                      가독성 텍스트
                    </div>
                    <input
                      type="color"
                      value={headerBg}
                      onChange={(e) => setHeaderBg(e.target.value)}
                      className="h-8 w-14 cursor-pointer rounded border border-border-hi bg-transparent p-0"
                    />
                  </div>
                </div>

                {/* 2) 포인트 강조 색상 */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel-alt p-4">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-bold text-ink">포인트 강조 색상</span>
                    <span className="text-[10px] text-ink3 mt-0.5">강조 텍스트, 탭, 활성 뱃지</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      style={{ backgroundColor: pointColor, color: pointTextColor }}
                      className="flex items-center justify-center px-3 py-1 rounded text-[11px] font-extrabold shadow-sm border border-black/5"
                    >
                      포인트 텍스트
                    </div>
                    <input
                      type="color"
                      value={pointColor}
                      onChange={(e) => setPointColor(e.target.value)}
                      className="h-8 w-14 cursor-pointer rounded border border-border-hi bg-transparent p-0"
                    />
                  </div>
                </div>

                {/* 3) 주요 버튼 색상 */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel-alt p-4">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-bold text-ink">주요 버튼 색상</span>
                    <span className="text-[10px] text-ink3 mt-0.5">저장, 등록 등 주요 액션 버튼</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      style={{ backgroundColor: btnColor, color: btnTextColor }}
                      className="flex items-center justify-center px-3 py-1 rounded text-[11px] font-extrabold shadow-sm border border-black/5"
                    >
                      버튼 텍스트
                    </div>
                    <input
                      type="color"
                      value={btnColor}
                      onChange={(e) => setBtnColor(e.target.value)}
                      className="h-8 w-14 cursor-pointer rounded border border-border-hi bg-transparent p-0"
                    />
                  </div>
                </div>

                {/* 4) 시스템 글씨 크기 조절 */}
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel-alt p-4">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-bold text-ink">시스템 글씨 크기 조절</span>
                    <span className="text-[10px] text-ink3 mt-0.5">화면의 텍스트와 UI 요소들의 크기를 실시간으로 축소 또는 확대합니다.</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    {([
                      { label: '작게 (100%)', scale: '1.0' },
                      { label: '보통 (112% · 기본)', scale: '1.125' },
                      { label: '크게 (118%)', scale: '1.1875' },
                      { label: '아주 크게 (125%)', scale: '1.25' },
                    ]).map((item) => (
                      <button
                        key={item.scale}
                        type="button"
                        onClick={() => handleFontScaleChange(item.scale)}
                        className={`flex-1 rounded-lg py-2 text-[11px] font-bold transition-all border ${
                          fontScale === item.scale
                            ? 'bg-teal border-teal text-white shadow-sm'
                            : 'bg-panel border-border text-ink2 hover:bg-panel-alt'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border flex justify-end gap-2 w-full max-w-xl">
                <button
                  onClick={handleResetTheme}
                  className="rounded-lg border border-border bg-panel px-4 py-2 text-[12px] font-semibold text-ink2 hover:bg-panel-alt"
                >
                  기본값 복원
                </button>
                <button
                  onClick={handleSaveTheme}
                  className="rounded-lg bg-teal px-5 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
                >
                  적용 및 저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
              <div className="w-full max-w-xl">
                <h2 className="text-[14px] font-bold text-ink mb-1">알림 설정</h2>
                <p className="text-[11.5px] text-ink3 mb-6">시스템 및 커뮤니케이션 알림 수신 상태를 맞춤 설정합니다.</p>
              </div>

              <div className="space-y-4 w-full max-w-xl">
                {/* 알림 전체 끄기 */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel-alt p-4">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-bold text-ink">알림 전체 일시정지</span>
                    <span className="text-[10px] text-ink3 mt-0.5">모든 알림의 수신을 일시적으로 음소거합니다.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notiMute}
                    onChange={(e) => setNotiMute(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-teal focus:ring-teal"
                  />
                </div>

                {/* 메신저 푸시 */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel-alt p-4">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-bold text-ink">메신저 알림 수신</span>
                    <span className="text-[10px] text-ink3 mt-0.5">채팅 및 다이렉트 메시지의 실시간 알림을 받습니다.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notiChat}
                    onChange={(e) => setNotiChat(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-teal focus:ring-teal"
                    disabled={notiMute}
                  />
                </div>

                {/* 전자결재 푸시 */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel-alt p-4">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-bold text-ink">전자결재 알림 수신</span>
                    <span className="text-[10px] text-ink3 mt-0.5">결재 대기, 반려, 기안 승인 완료 등 결재 프로세스의 실시간 알림을 받습니다.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notiApproval}
                    onChange={(e) => setNotiApproval(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-teal focus:ring-teal"
                    disabled={notiMute}
                  />
                </div>

                {/* 품질/설비 푸시 */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel-alt p-4">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-bold text-ink">생산 및 설비/품질 예외 알림</span>
                    <span className="text-[10px] text-ink3 mt-0.5">설비 장애, SPC 위반 및 비상 공정 알람을 실시간으로 수신합니다.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notiPush}
                    onChange={(e) => setNotiPush(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-teal focus:ring-teal"
                    disabled={notiMute}
                  />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border flex justify-end gap-2 w-full max-w-xl">
                <button
                  onClick={() => alert('알림 수신 설정이 성공적으로 저장되었습니다.')}
                  className="rounded-lg bg-teal px-5 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
                >
                  적용 및 저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
