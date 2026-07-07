import { Fragment } from 'react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import type { ApprovalDoc, ApprovalStep, DocType } from '@/domain/approvalDoc/schema';
import { won } from '@/modules/gw/_gw';

/**
 * 결재 문서 보기 — 전통 기안문서 양식(우상단 결재란 도장 grid + A4 레이아웃).
 * 결재권자가 문서로 확인/인쇄하기 위한 격식 뷰. 인쇄 시 `.approval-print` 만 노출된다(index.css).
 * 테마 무관하게 백지·흑자로 고정해 화면·출력이 동일하다.
 * (docs/전자결재_워크플로_개발_계획서.md §7.2 — 문서 뷰 확장)
 */

/** 문서 유형 → 격식 문서명. */
const DOC_TITLE: Record<DocType, string> = {
  기안: '기 안 서',
  품의: '품 의 서',
  지출결의: '지 출 결 의 서',
  휴가: '휴 가 원',
};

/** 유형별 맺음말. */
const CLOSING: Record<DocType, string> = {
  기안: '위와 같이 기안하오니 재가하여 주시기 바랍니다.',
  품의: '위와 같이 품의하오니 재가하여 주시기 바랍니다.',
  지출결의: '위와 같이 지출을 청구하오니 재가하여 주시기 바랍니다.',
  휴가: '위와 같이 휴가를 신청하오니 재가하여 주시기 바랍니다.',
};

/** ISO/date → "YYYY년 M월 D일". 비면 '—'. */
function korDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function ApprovalDocumentView({ doc }: { doc: ApprovalDoc }) {
  const org = useOrgTree();
  const nameOf = (id: string) => org.userById(id)?.name ?? id;
  const posOf = (id: string) => org.userById(id)?.position ?? '';

  const drafterName = nameOf(doc.drafterId);
  const steps = [...doc.steps].sort((a, b) => a.seq - b.seq);

  return (
    <div className="approval-print mx-auto bg-white px-8 py-7 text-[#1a1a1a]" style={{ maxWidth: 800 }}>
      {/* 상단: 회사 표기 */}
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-[#888]">WorkFit 그룹웨어 · 전자결재</div>

      {/* 제목 + 결재란 */}
      <div className="relative mb-5 flex items-start justify-between gap-4">
        <h1 className="mt-6 flex-1 text-center text-[26px] font-extrabold tracking-[0.15em] text-[#111]">
          {DOC_TITLE[doc.docType]}
        </h1>
        <ApprovalStampBox steps={steps} nameOf={nameOf} posOf={posOf} />
      </div>

      {/* 메타 표 */}
      <table className="w-full border-collapse text-[12px]">
        <tbody>
          <MetaRow cells={[['문서번호', doc.docNo], ['기안부서', doc.drafterDept || '—']]} />
          <MetaRow cells={[['기 안 자', drafterName], ['기 안 일', korDate(doc.submittedAt ?? doc.createdAt)]]} />
          {doc.completedAt && <MetaRow cells={[['시 행 일', korDate(doc.completedAt)], ['보존연한', '3년']]} />}
        </tbody>
      </table>

      {/* 제목 / 금액 */}
      <table className="mt-2 w-full border-collapse text-[12px]">
        <tbody>
          <MetaRow cells={[['제 목', doc.title]]} full />
          {doc.amount != null && <MetaRow cells={[['금 액', `${won(doc.amount)} (부가세 포함)`]]} full />}
        </tbody>
      </table>

      {/* 휴가 상세 */}
      {doc.form && (
        <table className="mt-2 w-full border-collapse text-[12px]">
          <tbody>
            <MetaRow
              cells={[
                ['휴가종류', doc.form.leaveType],
                ['사용일수', `${doc.form.days}일`],
              ]}
            />
            <MetaRow cells={[['사용기간', `${doc.form.startDate} ~ ${doc.form.endDate}`]]} full />
          </tbody>
        </table>
      )}

      {/* 본문 */}
      <div className="mt-3 min-h-[220px] whitespace-pre-wrap border border-[#bbb] px-4 py-3 text-[12.5px] leading-[1.9] text-[#222]">
        {doc.body || ' '}
      </div>

      {/* 맺음말 · 서명 */}
      <div className="mt-8 text-center text-[12.5px] leading-loose text-[#222]">
        <div>{CLOSING[doc.docType]}</div>
        <div className="mt-4 font-semibold tracking-wide">{korDate(doc.submittedAt ?? doc.createdAt)}</div>
        <div className="mt-1">
          기안자 <span className="mx-1 text-[14px] font-bold tracking-[0.2em]">{drafterName}</span>
          <span className="text-[#c0392b]">(인)</span>
        </div>
      </div>
    </div>
  );
}

/** 우상단 결재란 — 각 결재선 노드를 세로 칸(구분·서명도장·일자)으로. */
function ApprovalStampBox({ steps, nameOf, posOf }: { steps: ApprovalStep[]; nameOf: (id: string) => string; posOf: (id: string) => string }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex shrink-0 border border-[#333] text-center">
      {/* 세로 라벨 */}
      <div className="flex w-6 items-center justify-center border-r border-[#333] text-[10px] font-bold [writing-mode:vertical-rl] tracking-[0.3em] text-[#333]">
        결재
      </div>
      <div className="flex">
        {steps.map((s) => (
          <div key={s.seq} className="w-[60px] border-r border-[#333] last:border-r-0">
            <div className="border-b border-[#333] bg-[#f2f2f2] py-0.5 text-[9px] font-bold text-[#333]">{s.kind}</div>
            <div className="grid h-[52px] place-items-center px-0.5">
              <Stamp step={s} name={nameOf(s.approverId)} />
            </div>
            <div className="border-t border-[#333] py-[1px] text-[8px] text-[#666]">
              {(s.decidedAt ? shortDate(s.decidedAt) : posOf(s.approverId)) || ' '}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 결재 도장 — 승인=원형 붉은 도장(이름), 반려/보류/대기=상태, 참조=열람. */
function Stamp({ step, name }: { step: ApprovalStep; name: string }) {
  if (step.kind === '참조') {
    return <span className="text-[10px] text-[#888]">열람<br />{name}</span>;
  }
  if (step.decision === '승인') {
    return (
      <span className="grid h-[40px] w-[40px] place-items-center rounded-full border-[1.5px] border-[#c0392b] text-[10px] font-bold leading-tight text-[#c0392b]">
        {name}
      </span>
    );
  }
  if (step.decision === '반려') {
    return <span className="grid h-[40px] w-[40px] place-items-center rounded-full border-[1.5px] border-[#c0392b] text-[10px] font-bold text-[#c0392b]">반려</span>;
  }
  if (step.decision === '보류') {
    return <span className="text-[10px] font-semibold text-[#888]">보류<br />{name}</span>;
  }
  // 대기
  return <span className="text-[9px] text-[#bbb]">{name}<br />(대기)</span>;
}

function MetaRow({ cells, full }: { cells: [string, string][]; full?: boolean }) {
  return (
    <tr>
      {cells.map(([k, v], i) => (
        <Fragment key={i}>
          <th className="w-[80px] border border-[#bbb] bg-[#f2f2f2] px-2 py-1.5 text-left align-middle text-[11px] font-bold text-[#444]">
            {k}
          </th>
          <td className="border border-[#bbb] px-2.5 py-1.5 text-left align-middle text-[#222]" colSpan={full ? 3 : 1}>
            {v}
          </td>
        </Fragment>
      ))}
    </tr>
  );
}
