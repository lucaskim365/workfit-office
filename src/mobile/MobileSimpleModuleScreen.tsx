import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import MobileCommonHeader from './MobileCommonHeader';

interface MobileSimpleModuleScreenProps {
  moduleId: string;
  title: string;
  subtitle: string;
  description: string;
  iconText: string;
  desktopPath: string;
}

export default function MobileSimpleModuleScreen({
  title,
  subtitle,
  description,
  iconText,
  desktopPath: _desktopPath,
}: MobileSimpleModuleScreenProps) {
  const nav = useNavigate();

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader title={title} subtitle={subtitle} />

      <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center justify-center text-center space-y-4">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white shadow-md border border-border text-[36px]">
          {iconText}
        </div>

        <div className="space-y-1.5 max-w-[320px]">
          <h2 className="text-[17px] font-black text-ink tracking-tight">{title}</h2>
          <p className="text-[12px] text-ink3 leading-relaxed">{description}</p>
        </div>

        <div className="rounded-2xl border border-teal/30 bg-teal-soft/15 p-4 max-w-[340px] text-left space-y-2">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-teal">
            <Info size={14} />
            <span>모바일 고도화 진행 안내</span>
          </div>
          <p className="text-[11px] text-ink2 leading-relaxed">
            현재 해당 모듈의 모바일 전용 UI가 단계별 로드맵에 따라 순차 개발 중입니다. 전체 기능 및 상세 관리는 데스크톱 그룹웨어 환경에서 편리하게 이용하실 수 있습니다.
          </p>
        </div>

        <div className="pt-2 w-full max-w-[300px] space-y-2">
          <button
            type="button"
            onClick={() => nav('/m/modules')}
            className="w-full rounded-xl bg-white py-2.5 text-[12px] font-bold text-ink border border-border hover:bg-panel-alt transition-colors shadow-2xs"
          >
            모듈 메뉴로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
