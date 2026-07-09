import { Fragment } from 'react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useApprovalForms } from '@/features/gw/useApprovalForms';
import type { ApprovalDoc, ApprovalStep } from '@/domain/approvalDoc/schema';
import { amountFieldOf, type ApprovalForm, type FormField } from '@/domain/approvalForm/schema';
import { fieldText } from '@/modules/gw/approval/formFields';
import { won } from '@/modules/gw/_gw';

/**
 * 결재 문서 보기 — 전통 기안문서 양식(우상단 결재란 도장 grid + A4 레이아웃).
 * 격식(문서명·맺음말)과 상세 필드는 결재서식(approvalForms) 정의로 동적 생성한다.
 * 인쇄 시 `.approval-print` 만 노출(index.css). 테마 무관 백지·흑자 고정.
 */

/** 서식 미로드/미정의 시 기본 4종 격식 폴백. */
const FALLBACK_TITLE: Record<string, string> = { 기안: '기 안 서', 품의: '품 의 서', 지출결의: '지 출 결 의 서', 휴가: '휴 가 원' };
const FALLBACK_CLOSING: Record<string, string> = {
  기안: '위와 같이 기안하오니 재가하여 주시기 바랍니다.',
  품의: '위와 같이 품의하오니 재가하여 주시기 바랍니다.',
  지출결의: '위와 같이 지출을 청구하오니 재가하여 주시기 바랍니다.',
  휴가: '위와 같이 휴가를 신청하오니 재가하여 주시기 바랍니다.',
};

function korDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function ApprovalDocumentView({ doc, formOverride }: { doc: ApprovalDoc; formOverride?: ApprovalForm }) {
  const org = useOrgTree();
  const { data: forms = [] } = useApprovalForms();
  const nameOf = (id: string) => org.userById(id)?.name ?? id;
  const posOf = (id: string) => org.userById(id)?.position ?? '';

  const form = formOverride ?? forms.find((f) => f.code === doc.docType);
  const docTitle = form?.docTitle || form?.name || FALLBACK_TITLE[doc.docType] || doc.docType;
  const closing = form?.closing || FALLBACK_CLOSING[doc.docType] || '위와 같이 상신하오니 재가하여 주시기 바랍니다.';
  const amountField = form ? amountFieldOf(form) : undefined;
  const amountLabel = amountField?.label ?? '금 액';
  // 동적 필드 중 안내문과 일수 필드를 제외하고 모두 순서대로 배치
  const activeFields = (form?.fields ?? []).filter(
    (f) => f.type !== '안내문' && !f.key.endsWith('__days')
  );

  const longTextFields = activeFields.filter(
    (f) => f.type === '장문'
  );

  const isAmountInDetails = amountField ? activeFields.some((f) => f.key === amountField.key) : false;

  const drafterName = nameOf(doc.drafterId);
  const steps = [...doc.steps].sort((a, b) => a.seq - b.seq);

  interface LayoutBlock {
    type: 'table' | 'longtext';
    section: string;
    fields: FormField[];
  }

  const blocks: LayoutBlock[] = [];
  activeFields.forEach((f) => {
    const secName = f.section || '';
    if (f.type === '장문') {
      blocks.push({
        type: 'longtext',
        section: secName,
        fields: [f],
      });
    } else {
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.type === 'table' && lastBlock.section === secName) {
        lastBlock.fields.push(f);
      } else {
        blocks.push({
          type: 'table',
          section: secName,
          fields: [f],
        });
      }
    }
  });

  let lastRenderedSection = '';

  return (
    <div className="approval-print mx-auto bg-white px-8 py-7 text-[#1a1a1a]" style={{ maxWidth: 800 }}>
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-[#888]">WorkFit 그룹웨어 · 전자결재</div>

      <div className="relative mb-5 flex items-start justify-between gap-4">
        <h1 className="mt-6 flex-1 text-center text-[26px] font-extrabold tracking-[0.15em] text-[#111]">{docTitle}</h1>
        <ApprovalStampBox steps={steps} nameOf={nameOf} posOf={posOf} />
      </div>

      <table className="w-full border-collapse text-[12px]">
        <tbody>
          <MetaRow cells={[['문서번호', doc.docNo], ['기안부서', doc.drafterDept || '—']]} />
          <MetaRow cells={[['기 안 자', drafterName], ['기 안 일', korDate(doc.submittedAt ?? doc.createdAt)]]} />
          {doc.completedAt && <MetaRow cells={[['시 행 일', korDate(doc.completedAt)], ['보존연한', '3년']]} />}
        </tbody>
      </table>

      <table className="mt-2 w-full border-collapse text-[12px]">
        <tbody>
          <MetaRow cells={[['제 목', doc.title]]} full />
          {doc.amount != null && !isAmountInDetails && (
            <MetaRow cells={[[amountLabel, `${won(doc.amount)} (부가세 포함)`]]} full />
          )}
        </tbody>
      </table>

      {/* 서식 동적 상세 블록 렌더링 (순서 보존 및 섹션별 테이블/독립 장문박스 배치) */}
      {blocks.length > 0 && (
        <div className="space-y-3.5 mt-2">
          {blocks.map((block, blockIdx) => {
            const showSectionHeader = block.section && block.section !== lastRenderedSection;
            if (block.section) {
              lastRenderedSection = block.section;
            }

            if (block.type === 'longtext') {
              const f = block.fields[0];
              const val = fieldText(f, doc.fieldValues, org);
              return (
                <div key={blockIdx} className="space-y-1">
                  {showSectionHeader && (
                    <div className="text-[11px] font-bold text-teal mt-2.5">
                      {block.section}
                    </div>
                  )}
                  <div className="text-[11px] font-semibold text-ink2 mb-0.5">
                    {f.label}
                  </div>
                  <div className="min-h-[120px] whitespace-pre-wrap border border-[#bbb] px-4 py-3 text-[12.5px] leading-[1.9] text-[#222]">
                    {val || ' '}
                  </div>
                </div>
              );
            }

            // table 타입 블록 렌더링
            const tableRows: React.ReactNode[] = [];
            const fields = block.fields;

            for (let i = 0; i < fields.length; i++) {
              const f = fields[i];
              const val = fieldText(f, doc.fieldValues, org);

              if (f.width === 'half') {
                const next = fields[i + 1];
                if (next && next.width === 'half') {
                  const nextVal = fieldText(next, doc.fieldValues, org);
                  tableRows.push(
                    <MetaRow key={f.key} cells={[[f.label, val], [next.label, nextVal]]} />
                  );
                  i++;
                } else {
                  tableRows.push(
                    <MetaRow key={f.key} cells={[[f.label, val], ['', '']]} />
                  );
                }
              } else {
                tableRows.push(
                  <MetaRow key={f.key} cells={[[f.label, val]]} full />
                );
              }
            }

            return (
              <div key={blockIdx} className="space-y-1">
                {showSectionHeader && (
                  <div className="text-[11px] font-bold text-teal mt-2.5">
                    {block.section}
                  </div>
                )}
                <table className="w-full border-collapse text-[12px]">
                  <tbody>{tableRows}</tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* 본문 (양식에 정의된 장문 필드가 하나도 없는 경우에만 폴백 노출) */}
      {longTextFields.length === 0 && (
        <div className="mt-3 min-h-[220px] whitespace-pre-wrap border border-[#bbb] px-4 py-3 text-[12.5px] leading-[1.9] text-[#222]">
          {doc.body || ' '}
        </div>
      )}

      <div className="mt-8 text-center text-[12.5px] leading-loose text-[#222]">
        <div>{closing}</div>
        <div className="mt-4 font-semibold tracking-wide">{korDate(doc.submittedAt ?? doc.createdAt)}</div>
        <div className="mt-1">
          기안자 <span className="mx-1 text-[14px] font-bold tracking-[0.2em]">{drafterName}</span>
          <span className="text-[#c0392b]">(인)</span>
        </div>
      </div>
    </div>
  );
}

function ApprovalStampBox({ steps, nameOf, posOf }: { steps: ApprovalStep[]; nameOf: (id: string) => string; posOf: (id: string) => string }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex shrink-0 border border-[#333] text-center">
      <div className="flex w-6 items-center justify-center border-r border-[#333] text-[10px] font-bold [writing-mode:vertical-rl] tracking-[0.3em] text-[#333]">결재</div>
      <div className="flex">
        {steps.map((s) => (
          <div key={s.seq} className="w-[60px] border-r border-[#333] last:border-r-0">
            <div className="border-b border-[#333] bg-[#f2f2f2] py-0.5 text-[9px] font-bold text-[#333]">{s.kind}</div>
            <div className="grid h-[52px] place-items-center px-0.5"><Stamp step={s} name={nameOf(s.approverId)} /></div>
            <div className="border-t border-[#333] py-[1px] text-[8px] text-[#666]">{(s.decidedAt ? shortDate(s.decidedAt) : posOf(s.approverId)) || ' '}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stamp({ step, name }: { step: ApprovalStep; name: string }) {
  if (step.kind === '참조') return <span className="text-[10px] text-[#888]">열람<br />{name}</span>;
  if (step.decision === '승인')
    return <span className="grid h-[40px] w-[40px] place-items-center rounded-full border-[1.5px] border-[#c0392b] text-[10px] font-bold leading-tight text-[#c0392b]">{name}</span>;
  if (step.decision === '반려')
    return <span className="grid h-[40px] w-[40px] place-items-center rounded-full border-[1.5px] border-[#c0392b] text-[10px] font-bold text-[#c0392b]">반려</span>;
  if (step.decision === '보류') return <span className="text-[10px] font-semibold text-[#888]">보류<br />{name}</span>;
  return <span className="text-[9px] text-[#bbb]">{name}<br />(대기)</span>;
}

function MetaRow({ cells, full }: { cells: [string, string][]; full?: boolean }) {
  return (
    <tr>
      {cells.map(([k, v], i) => (
        <Fragment key={i}>
          <th className="w-[80px] border border-[#bbb] bg-[#f2f2f2] px-2 py-1.5 text-left align-middle text-[11px] font-bold text-[#444]">{k}</th>
          <td className="border border-[#bbb] px-2.5 py-1.5 text-left align-middle text-[#222]" colSpan={full ? 3 : 1}>{v}</td>
        </Fragment>
      ))}
    </tr>
  );
}
