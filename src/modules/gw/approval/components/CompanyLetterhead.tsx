import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';
import { useCompanySites } from '@/features/companySite/useCompanySites';
import type { FormField } from '@/domain/approvalForm/schema';
import { DEFAULT_LETTERHEAD, letterheadLines } from '@/domain/approvalForm/headerItems';

/** '회사정보' 칸 — 회사 정보 화면의 주소·전화·팩스·홈페이지·이메일과 사업장 현황의 사업장 주소 머리글 */
export function CompanyLetterhead({ field }: { field: FormField }) {
  const { data: company } = useCompanyInfo();
  const { data: sites } = useCompanySites();
  const config = field.letterhead ?? DEFAULT_LETTERHEAD;
  const lines = letterheadLines(config, company, sites);
  const logoUrl = config.showLogo ? company?.logoUrl : '';
  return (
    <div className="border-b-2 border-[#222] pb-2 text-[11.5px] leading-[1.7] text-[#222] print-avoid-break">
      {logoUrl && (
        <div className="mb-3 flex justify-center">
          {/* maxWidth none — 공통 스타일(img max-width:100%)에 눌려 줄어들지 않게 */}
          <img src={logoUrl} alt="회사 로고" style={{ height: 56, width: 'auto', maxWidth: 'none' }} className="object-contain" />
        </div>
      )}
      {lines.length === 0 ? (
        !logoUrl && <div className="text-center text-[11px] text-[#999]">회사 정보가 비어 있습니다</div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          {lines.map((line) => (
            <div key={line.key} className="contents">
              <dt className="font-bold text-[#444]">{line.label}</dt>
              <dd className="min-w-0 break-words">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
