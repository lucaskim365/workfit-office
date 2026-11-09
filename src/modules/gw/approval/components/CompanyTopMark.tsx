import { COMPANY_LABEL, COMPANY_NAME_EN, type ApprovalCompany } from '@/domain/approvalDoc/company';

/** 결재 문서 상단 바의 회사 표시 — 로고 파일이 생기기 전까지 글자로 */
export function CompanyTopMark({ company }: { company: ApprovalCompany }) {
  return (
    <div className="flex items-center gap-2 h-full">
      <span className="text-[17px] font-extrabold tracking-tight text-[#1a1a1a] self-center">{COMPANY_LABEL[company]}</span>
      <span className="text-[11px] font-semibold tracking-wide text-[#888] self-center">{COMPANY_NAME_EN[company]} · 전자결재</span>
    </div>
  );
}
