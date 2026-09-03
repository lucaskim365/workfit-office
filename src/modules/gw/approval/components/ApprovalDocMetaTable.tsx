import { Fragment } from 'react';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { won } from '../utils/approvalUtils';

function korDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function MetaRow({ cells, full }: { cells: Array<[string, React.ReactNode, boolean?]>; full?: boolean }) {
  return (
    <tr>
      {cells.map(([k, v, isSecret], i) => (
        <Fragment key={i}>
          <th className="w-[65px] sm:w-[80px] shrink-0 border border-[#bbb] bg-[#f2f2f2] px-1.5 sm:px-2 py-1.5 text-left align-middle text-[10.5px] sm:text-[11px] font-bold text-[#444]">
            {k}
          </th>
          <td 
            title={isSecret ? "🔒 보안 필드입니다. 열람 권한이 없습니다." : undefined}
            className={`border border-[#bbb] px-2 sm:px-2.5 py-1.5 text-left align-middle text-[#222] whitespace-pre-wrap break-all text-[11.5px] ${isSecret ? 'blur-sm select-none opacity-70 cursor-help' : ''}`} 
            colSpan={full ? 3 : 1}
          >
            {v}
          </td>
        </Fragment>
      ))}
    </tr>
  );
}

export function ApprovalDocMetaTable({
  doc,
  form,
  drafterName,
  drafterPos,
  isAmountInDetails,
  amountLabel,
}: {
  doc: ApprovalDoc;
  form?: ApprovalForm;
  drafterName: string;
  drafterPos: string;
  isAmountInDetails: boolean;
  amountLabel: string;
}) {
  return (
    <>
      <table className="w-full border-collapse text-[11.5px] sm:text-[12px] table-fixed">
        <tbody>
          <MetaRow cells={[['문서번호', doc.docNo], ['기안부서', doc.drafterDept || '—']]} />
          <MetaRow cells={[['기 안 자', drafterPos ? `${drafterName} ${drafterPos}` : drafterName], ['기 안 일', korDate(doc.submittedAt ?? doc.createdAt)]]} />
          {doc.completedAt && (
            <MetaRow
              cells={[
                ['결재 완료일', korDate(doc.completedAt)],
                ['보존연한', doc.preservationPeriod || form?.preservationPeriod || '3년']
              ]}
            />
          )}
        </tbody>
      </table>

      <table className="mt-2 w-full border-collapse text-[11.5px] sm:text-[12px] table-fixed">
        <tbody>
          <MetaRow cells={[['제 목', doc.title]]} full />
          {doc.amount != null && !isAmountInDetails && (
            <MetaRow cells={[[amountLabel, `${won(doc.amount)} (부가세 포함)`]]} full />
          )}
        </tbody>
      </table>
    </>
  );
}
