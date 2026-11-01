import { Fragment } from 'react';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { won } from '../utils/approvalUtils';
import { docNoOf } from '@/domain/approvalDoc/docNo';
import { headerShown, titleFieldOf, type HeaderItem } from '@/domain/approvalForm/headerItems';

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
            title={isSecret ? "보안 필드입니다. 열람 권한이 없습니다." : undefined}
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
  hidden = false,
  form,
  drafterName,
  drafterPos,
  isAmountInDetails,
  amountLabel,
}: {
  doc: ApprovalDoc;
  /** 대외 문서 모양 — 자동 정보 표 숨김 */
  hidden?: boolean;
  form?: ApprovalForm;
  drafterName: string;
  drafterPos: string;
  isAmountInDetails: boolean;
  amountLabel: string;
}) {
  // 서식 설정 — 결재 완료 문서에서는 자동 정보 표와 제목을 모두 숨김(대외 문서용)
  const hideAutoInfo = hidden || (!!form?.hideDocInfoOnComplete && doc.status === '완료');
  if (hideAutoInfo) return null;
  // 서식에서 끈 머리 항목은 빼고 두 칸씩 채운다(남는 하나는 한 줄 전체)
  const shown = (item: HeaderItem) => headerShown(form, item);
  const cells = ([
    shown('docNo') && ['문서번호', docNoOf(doc)],
    shown('drafterDept') && ['기안부서', doc.drafterDept || '—'],
    shown('drafter') && ['기 안 자', drafterPos ? `${drafterName} ${drafterPos}` : drafterName],
    shown('draftDate') && ['기 안 일', korDate(doc.submittedAt ?? doc.createdAt)],
    doc.completedAt && shown('completedDate') && ['결재 완료일', korDate(doc.completedAt)],
    doc.completedAt && shown('preservation') && ['보존연한', doc.preservationPeriod || form?.preservationPeriod || '3년'],
  ].filter(Boolean) as Array<[string, React.ReactNode]>);
  const rows: Array<Array<[string, React.ReactNode]>> = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  // '문서제목' 칸이 있으면 제목은 서식 본문에서 보인다
  const showTitle = !titleFieldOf(form?.fields);
  const showAmount = doc.amount != null && !isAmountInDetails;
  return (
    <>
      {rows.length > 0 && (
      <table className="w-full border-collapse text-[11.5px] sm:text-[12px] table-fixed">
        <tbody>
          {rows.map((row, i) => <MetaRow key={i} cells={row} full={row.length === 1} />)}
        </tbody>
      </table>
      )}

      {(showTitle || showAmount) && (
      <table className={`${rows.length > 0 ? 'mt-2 ' : ''}w-full border-collapse text-[11.5px] sm:text-[12px] table-fixed`}>
        <tbody>
          {showTitle && <MetaRow cells={[['제 목', doc.title]]} full />}
          {showAmount && (
            <MetaRow cells={[[amountLabel, `${won(doc.amount!)} (부가세 포함)`]]} full />
          )}
        </tbody>
      </table>
      )}
    </>
  );
}
