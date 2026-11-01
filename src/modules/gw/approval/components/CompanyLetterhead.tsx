import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';
import type { FormField } from '@/domain/approvalForm/schema';
import { DEFAULT_LETTERHEAD, letterheadLines } from '@/domain/approvalForm/headerItems';

/** '회사정보' 칸 — 회사 정보 화면의 주소·전화·팩스·홈페이지·이메일과 서식에 적은 연구소 주소 머리글 */
export function CompanyLetterhead({ field }: { field: FormField }) {
  const { data: company } = useCompanyInfo();
  const lines = letterheadLines(field.letterhead ?? DEFAULT_LETTERHEAD, company);
  return (
    <div className="border-b-2 border-[#222] pb-2 text-[11.5px] leading-[1.7] text-[#222] print-avoid-break">
      {lines.length === 0 ? (
        <div className="text-center text-[11px] text-[#999]">회사 정보가 비어 있습니다</div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          {lines.map((line) => (
            <div key={line.item} className="contents">
              <dt className="font-bold text-[#444]">{line.label}</dt>
              <dd className="min-w-0 break-words">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
