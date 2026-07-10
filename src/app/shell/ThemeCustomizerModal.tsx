import { useState, useEffect } from 'react';
import { Modal } from '@/shared/ui/Modal';

export interface ThemeConfig {
  headerBg: string;
  pointColor: string;
  btnColor: string;
}

export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // 상대 휘도(Luminance) 계산
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // 밝은 색상에는 어두운 글자색, 어두운 색상에는 밝은 글자색
  return luminance > 0.6 ? '#1c2536' : '#ffffff';
}

export function getSoftColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // 85%의 흰색과 혼합하여 soft 파스텔톤 생성
  const nr = Math.round(r + (255 - r) * 0.85);
  const ng = Math.round(g + (255 - g) * 0.85);
  const nb = Math.round(b + (255 - b) * 0.85);
  
  const toHex = (n: number) => String(n.toString(16)).padStart(2, '0');
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

export function applyTheme(headerBg: string, pointColor: string, btnColor: string) {
  const headerText = getContrastColor(headerBg);
  const pointText = getContrastColor(pointColor);
  const pointSoft = getSoftColor(pointColor);
  const btnText = getContrastColor(btnColor);

  document.documentElement.style.setProperty('--color-header-bg', headerBg);
  document.documentElement.style.setProperty('--color-header-text', headerText);
  
  document.documentElement.style.setProperty('--color-teal-custom', pointColor);
  document.documentElement.style.setProperty('--color-teal-text', pointText);
  document.documentElement.style.setProperty('--color-teal-soft', pointSoft);
  
  document.documentElement.style.setProperty('--color-navy-custom', btnColor);
  document.documentElement.style.setProperty('--color-navy-text', btnText);
}

interface ThemeCustomizerModalProps {
  open: boolean;
  onClose: () => void;
}

export function ThemeCustomizerModal({ open, onClose }: ThemeCustomizerModalProps) {
  const [headerBg, setHeaderBg] = useState(() => localStorage.getItem('custom_theme_header_bg') ?? '#dbeafe');
  const [pointColor, setPointColor] = useState(() => localStorage.getItem('custom_theme_point_color') ?? '#99bbff');
  const [btnColor, setBtnColor] = useState(() => localStorage.getItem('custom_theme_btn_color') ?? '#1243b5');

  const handleSave = () => {
    localStorage.setItem('custom_theme_header_bg', headerBg);
    localStorage.setItem('custom_theme_point_color', pointColor);
    localStorage.setItem('custom_theme_btn_color', btnColor);
    applyTheme(headerBg, pointColor, btnColor);
    onClose();
  };

  const handleReset = () => {
    setHeaderBg('#dbeafe');
    setPointColor('#99bbff');
    setBtnColor('#1243b5');
  };

  useEffect(() => {
    if (open) {
      setHeaderBg(localStorage.getItem('custom_theme_header_bg') ?? '#dbeafe');
      setPointColor(localStorage.getItem('custom_theme_point_color') ?? '#99bbff');
      setBtnColor(localStorage.getItem('custom_theme_btn_color') ?? '#1243b5');
    }
  }, [open]);

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
