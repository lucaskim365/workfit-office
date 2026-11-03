import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';
import { useCompanySites } from '@/features/companySite/useCompanySites';
import { useCompanyMarks } from '@/features/companyMark/useCompanyMarks';
import type { FormField } from '@/domain/approvalForm/schema';
import { DEFAULT_LETTERHEAD, letterheadLines } from '@/domain/approvalForm/headerItems';
import { markUrlOf } from '@/domain/companyMark/schema';

/**
 * '회사정보' 칸 — 회사 정보 화면의 주소·전화·팩스·홈페이지·이메일과 사업장 현황의 사업장 주소 머리글.
 * 서식 설정대로 이름·순서를 바꾸고, 한 줄에 N개(열 수)씩 놓되 '한 줄 전체' 줄은 혼자 한 줄.
 */
export function CompanyLetterhead({ field }: { field: FormField }) {
  const { data: company } = useCompanyInfo();
  const { data: sites } = useCompanySites();
  const { data: marks } = useCompanyMarks();
  const config = field.letterhead ?? DEFAULT_LETTERHEAD;
  const lines = letterheadLines(config, company, sites);
  const logoUrl = config.showLogo ? markUrlOf(marks, 'logo', config.logoId, company?.logoUrl) : '';
  const columns = config.columns ?? 1;
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
      ) : columns === 1 ? (
        // 한 줄에 하나 — 이름 칸을 맞춰 정렬
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          {lines.map((line) => (
            <div key={line.key} className="contents">
              <dt className="font-bold text-[#444]">{line.label}</dt>
              <dd className="min-w-0 break-words">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className="grid gap-x-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {lines.map((line) => (
            <div key={line.key} className="min-w-0 break-words" style={line.full ? { gridColumn: '1 / -1' } : undefined}>
              <dt className="inline font-bold text-[#444]">{line.label}</dt>
              <span className="text-[#888]"> : </span>
              <dd className="inline">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
