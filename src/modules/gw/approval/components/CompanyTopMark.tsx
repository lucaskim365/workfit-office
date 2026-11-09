import { COMPANY_LABEL, COMPANY_NAME_EN, type ApprovalCompany } from '@/domain/approvalDoc/company';
import { CompanyLogo } from './CompanyLetterhead';

/** 결재 문서 상단 바의 회사 표시 — 로고 파일이 생기기 전까지 글자로 */
export function CompanyTopMark({ company }: { company: ApprovalCompany }) {
  return (
    <div className="flex items-center gap-2 h-full">
      <span className="text-[17px] font-extrabold tracking-tight text-[#1a1a1a] self-center">{COMPANY_LABEL[company]}</span>
      <span className="text-[11px] font-semibold tracking-wide text-[#888] self-center">{COMPANY_NAME_EN[company]} · 전자결재</span>
    </div>
  );
}

/**
 * 시트 서식의 '회사 로고' 칸 — 기존 문서 상단 바와 같은 모양(로고 높이 24px + 'workfit 그룹웨어 · 전자결재').
 * 로고는 회사 정보 화면에 등록한 회사 로고, 없으면 기존 상단 바 로고(fallbackSrc).
 * 대외 문서(거래처용)에는 로고만 — 그룹웨어 안내 글자는 회사 문서의 일부가 아니므로 뺀다
 */
export function SheetTopMark({ fallbackSrc, external }: { fallbackSrc: string; external?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <CompanyLogo height={24} fallback={<img src={fallbackSrc} alt="WorkFit Logo" className="h-6 w-auto object-contain" />} />
      {!external && <span className="text-[11px] font-semibold tracking-wide text-[#888]">workfit 그룹웨어 · 전자결재</span>}
    </span>
  );
}
