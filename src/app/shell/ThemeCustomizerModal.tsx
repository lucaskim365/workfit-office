import { useState, useEffect } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { useAuth } from '@/app/auth/AuthProvider';
import {
  getContrastColor,
  getSoftColor,
  applyTheme,
  loadUserTheme,
  saveUserTheme,
  DEFAULT_THEME_SETTINGS,
} from '@/shared/lib/theme';

export { getContrastColor, getSoftColor, applyTheme };

export interface ThemeConfig {
  headerBg: string;
  pointColor: string;
  btnColor: string;
}

interface ThemeCustomizerModalProps {
  open: boolean;
  onClose: () => void;
}

export function ThemeCustomizerModal({ open, onClose }: ThemeCustomizerModalProps) {
  const { user } = useAuth();
  const [headerBg, setHeaderBg] = useState(() => loadUserTheme(user?.id).headerBg);
  const [pointColor, setPointColor] = useState(() => loadUserTheme(user?.id).pointColor);
  const [btnColor, setBtnColor] = useState(() => loadUserTheme(user?.id).btnColor);

  const handleSave = () => {
    saveUserTheme({ headerBg, pointColor, btnColor }, user?.id);
    applyTheme(headerBg, pointColor, btnColor);
    onClose();
  };

  const handleReset = () => {
    setHeaderBg(DEFAULT_THEME_SETTINGS.headerBg);
    setPointColor(DEFAULT_THEME_SETTINGS.pointColor);
    setBtnColor(DEFAULT_THEME_SETTINGS.btnColor);
  };

  useEffect(() => {
    if (open) {
      const current = loadUserTheme(user?.id);
      setHeaderBg(current.headerBg);
      setPointColor(current.pointColor);
      setBtnColor(current.btnColor);
    }
  }, [open, user?.id]);

  // 가독성 실시간 텍스트 색상 계산
  const headerTextColor = getContrastColor(headerBg);
  const pointTextColor = getContrastColor(pointColor);
  const btnTextColor = getContrastColor(btnColor);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="개인 설정 (테마 컬러 커스터마이저)"
      width={460}
      footer={
        <div className="flex gap-2 w-full">
          <button
            onClick={handleReset}
            className="mr-auto rounded-lg border border-border-hi bg-panel px-3 py-2 text-[12.5px] font-semibold text-ink2 hover:bg-panel-alt"
          >
            기본값 복원
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-border-hi bg-panel px-4 py-2 text-[12.5px] font-semibold text-ink2 hover:bg-panel-alt"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-teal px-5 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            적용 및 저장
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* 상세 컬러 피커 */}
        <div className="flex flex-col gap-4">
          {/* 1) 헤더 배경색 */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-panel p-3">
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-ink">헤더 배경색</span>
              <span className="text-[10px] text-ink3 mt-0.5">상단 탑바 영역의 색상</span>
            </div>
            <div className="flex items-center gap-3">
              {/* 실시간 가독성 텍스트 대비 프리뷰 */}
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
          <div className="flex items-center justify-between rounded-xl border border-border bg-panel p-3">
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-ink">포인트 강조 색상</span>
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
          <div className="flex items-center justify-between rounded-xl border border-border bg-panel p-3">
            <div className="flex flex-col">
              <span className="text-[12px] font-bold text-ink">주요 버튼 색상</span>
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
        </div>
      </div>
    </Modal>
  );
}
