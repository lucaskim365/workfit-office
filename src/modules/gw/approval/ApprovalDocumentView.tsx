import { Fragment, useEffect, useState } from 'react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useApprovalForms } from '@/features/gw/useApprovalForms';
import type { ApprovalDoc, ApprovalStep } from '@/domain/approvalDoc/schema';
import { amountFieldOf, type ApprovalForm, type FormField } from '@/domain/approvalForm/schema';
import { fieldText } from '@/modules/gw/approval/formFields';
import { won } from '@/modules/gw/_gw';
import logoImg from '@/assets/logo.png';

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
  const sealOf = (id: string) => org.userById(id)?.sealUrl ?? '';

  const [processedLogo, setProcessedLogo] = useState<string>(logoImg);

  useEffect(() => {
    const img = new Image();
    img.src = logoImg;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        // 흰색/밝은 회색 계열(R/G/B 모두 200 이상)만 블랙으로 변환
        if (r > 200 && g > 200 && b > 200 && a > 10) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      setProcessedLogo(canvas.toDataURL());
    };
  }, []);

  const form = formOverride ?? forms.find((f) => f.code === doc.docType);
  const docTitle = form?.docTitle || form?.name || FALLBACK_TITLE[doc.docType] || doc.docType;
  const closing = form?.closing || FALLBACK_CLOSING[doc.docType] || '위와 같이 상신하오니 재가하여 주시기 바랍니다.';
  const amountField = form ? amountFieldOf(form) : undefined;
  const amountLabel = amountField?.label ?? '금 액';
  // 동적 필드 중 안내문과 일수 필드를 제외하고 모두 순서대로 배치
  const activeFields = (form?.fields ?? []).filter((f) => {
    if (f.type === '안내문' || f.key.endsWith('__days')) return false;
    if (f.visibleIf) {
      const parts = f.visibleIf.split(':');
      if (parts.length === 2) {
        const [condKey, condVal] = parts;
        if (String(doc.fieldValues[condKey] ?? '') !== condVal) {
          return false;
        }
      }
    }
    return true;
  });

  const longTextFields = activeFields.filter(
    (f) => f.type === '장문'
  );

  const isAmountInDetails = amountField ? activeFields.some((f) => f.key === amountField.key) : false;

  const drafterName = nameOf(doc.drafterId);
  const steps = [...doc.steps].sort((a, b) => a.seq - b.seq);

  interface LayoutBlock {
    type: 'table' | 'longtext' | 'table-field';
    section: string;
    fields: FormField[];
  }

  // tabOverrides 적용을 위해 탭 분할 선택 필드와 현재 탭 값을 미리 추출
  const tabSelectorField = form?.fields.find((f) => f.type === '선택' && f.isTabSelector);
  const currentTabValue = tabSelectorField ? String(doc.fieldValues[tabSelectorField.key] ?? '') : '';
  /** 공통 필드에 tabOverrides를 적용한 effective width/section 반환 */
  const effectiveFieldProps = (f: FormField) => {
    const isCommon = !f.visibleIf;
    const override: { width?: 'full' | 'half'; section?: string } =
      (isCommon && currentTabValue && f.tabOverrides?.[currentTabValue]) || {};
    return {
      width: (override.width ?? f.width) as 'full' | 'half',
      section: override.section ?? f.section,
    };
  };

  const blocks: LayoutBlock[] = [];
  activeFields.forEach((f) => {
    const { section: secName } = effectiveFieldProps(f);
    if (f.type === '장문') {
      blocks.push({
        type: 'longtext',
        section: secName,
        fields: [f],
      });
    } else if (f.type === '표') {
      blocks.push({
        type: 'table-field',
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
      <div className="mb-2 flex h-10 items-center justify-between border-b border-[#eee] pb-2">
        <div className="flex items-center gap-2 h-full">
          <img src={processedLogo} alt="WorkFit Logo" className="h-6 w-auto object-contain" />
          <span className="text-[11px] font-semibold tracking-wide text-[#888] self-center">workfit 그룹웨어 · 전자결재</span>
        </div>
        <div className="text-[11px] text-[#888] self-center">{doc.docNo || ''}</div>
      </div>

      <div className="relative mb-5 flex items-start justify-between gap-4">
        <h1 className="mt-6 flex-1 text-center text-[26px] font-extrabold tracking-[0.15em] text-[#111]">{docTitle}</h1>
        <ApprovalStampBox steps={steps} nameOf={nameOf} posOf={posOf} sealOf={sealOf} />
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

            if (block.type === 'table-field') {
              const f = block.fields[0];
              const val = doc.fieldValues[f.key];
              const defaultCols = f.options.length > 0 ? f.options : ['품목명', '수량', '가격', '비고'];
              let cols: string[] = [...defaultCols];
              let rows: Array<Record<string, string>> = [];
              let tableWidth = '100%';
              let colWidths: Record<string, string> = {};

              // 서식 템플릿에 지정된 기본 너비/가로폭 속성 적용
              if (f.placeholder) {
                try {
                  const cfg = JSON.parse(f.placeholder);
                  if (cfg && typeof cfg === 'object') {
                    if (cfg.tableWidth) tableWidth = cfg.tableWidth;
                    if (cfg.colWidths) colWidths = cfg.colWidths;
                  }
                } catch (e) {}
              }

              try {
                if (typeof val === 'string' && val) {
                  const parsed = JSON.parse(val);
                  if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.cols) && Array.isArray(parsed.rows)) {
                      cols = parsed.cols;
                      rows = parsed.rows;
                      tableWidth = parsed.tableWidth || tableWidth;
                      colWidths = parsed.colWidths || colWidths;
                    } else if (Array.isArray(parsed)) {
                      rows = parsed;
                      cols = defaultCols;
                    }
                  }
                }
              } catch (e) {
                // ignore
              }

              return (
                <div key={blockIdx} className="space-y-1">
                  {showSectionHeader && (
                    <div className="text-[11px] font-bold text-teal mt-2.5">
                      {block.section}
                    </div>
                  )}
                  <div className="text-[11px] font-semibold text-[#888] mb-0.5">
                    {f.label}
                  </div>
                  <div className="overflow-x-auto border border-[#bbb] p-2 bg-white">
                    <table className="table-fixed border-collapse text-left text-[11.5px] border border-[#eee]" style={{ width: tableWidth, minWidth: tableWidth === '100%' ? '500px' : 'auto' }}>
                      <colgroup>
                        {cols.map((col, cIdx) => (
                          <col key={cIdx} style={{ width: colWidths[col] || 'auto' }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-[#bbb] bg-[#f9f9f9]">
                          {cols.map((col) => (
                            <th key={col} className="p-2 border border-[#eee] font-bold text-[#555]">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-[#eee] hover:bg-[#fafafa]">
                            {cols.map((col) => {
                              const isNumLike = col.includes('수량') || col.includes('단가') || col.includes('가격') || col.includes('금액') || col.includes('수') || col.includes('율');
                              const cellVal = row[col] ?? '';
                              const displayVal = isNumLike && !isNaN(Number(cellVal.replace(/,/g, ''))) && cellVal !== ''
                                ? Number(cellVal.replace(/,/g, '')).toLocaleString()
                                : cellVal;
                              return (
                                <td key={col} className={`p-2 border border-[#eee] text-[#222] ${isNumLike ? 'text-right' : 'text-left'}`}>
                                  {displayVal || '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr>
                            <td colSpan={cols.length} className="py-4 text-center text-[#999] text-[11px]">
                              등록된 데이터가 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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
              const { width: fw } = effectiveFieldProps(f);

              if (fw === 'half') {
                const next = fields[i + 1];
                const { width: nw } = next ? effectiveFieldProps(next) : { width: 'full' as const };
                if (next && nw === 'half') {
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

      {/* 본문 (양식에 정의된 장문 필드가 하나도 없고, 본문 내용이 채워져 있는 경우에만 노출) */}
      {longTextFields.length === 0 && doc.body && doc.body.trim() !== '' && doc.body !== '(본문 미리보기)' && (
        <div className="mt-3 min-h-[120px] whitespace-pre-wrap border border-[#bbb] px-4 py-3 text-[12.5px] leading-[1.9] text-[#222]">
          {doc.body}
        </div>
      )}

      {/* 첨부파일 다운로드 영역 */}
      {doc.attachments && doc.attachments.length > 0 && (
        <div className="mt-6 border-t border-[#bbb] pt-3">
          <div className="text-[11px] font-bold text-teal mb-2">📎 첨부 파일 목록 ({doc.attachments.length})</div>
          <div className="space-y-1.5">
            {doc.attachments.map((file, idx) => (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded border border-[#ddd] bg-[#fafafa] px-3 py-2 text-[12px] text-ink hover:bg-[#eee] transition-colors max-w-md"
              >
                <span className="text-[14px]">📄</span>
                <span className="font-semibold underline truncate flex-1">{file.name}</span>
                <span className="text-[10px] text-[#666]">다운로드 ➔</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 수신(시행)처 목록 */}
      {doc.recipients && doc.recipients.length > 0 && (
        <div className="mt-6 border-t border-[#bbb] pt-3">
          <div className="text-[11px] font-bold text-teal mb-2">📥 수신 (시행)처 ({doc.recipients.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {doc.recipients.map((r) => (
              <span
                key={r.id}
                className="rounded border border-[#ddd] bg-[#fafafa] px-2.5 py-1 text-[11.5px] font-semibold text-[#444] inline-flex items-center gap-1"
              >
                {r.type === 'dept' ? '📁' : r.type === 'drafter' ? '👤 기안자:' : '👤'} {r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-[12.5px] leading-loose text-[#222]">
        <div>{closing}</div>
        <div className="mt-4 font-semibold tracking-wide">{korDate(doc.submittedAt ?? doc.createdAt)}</div>
        <div className="mt-1 flex items-center justify-center gap-1">
          기안자 <span className="mx-1 text-[14px] font-bold tracking-[0.2em]">{drafterName}</span>
          <span className="relative inline-flex h-9 w-9 items-center justify-center select-none">
            <span className="text-[12.5px] font-bold text-[#c0392b] z-10">(인)</span>
            {sealOf(doc.drafterId) && (
              <img
                src={sealOf(doc.drafterId)}
                alt="인감"
                className="absolute inset-0 h-full w-full object-contain opacity-80 z-20 pointer-events-none mix-blend-multiply"
              />
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function ApprovalStampBox({ steps, nameOf, posOf, sealOf }: { steps: ApprovalStep[]; nameOf: (id: string) => string; posOf: (id: string) => string; sealOf: (id: string) => string }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex shrink-0 border border-[#333] text-center">
      <div className="flex w-6 items-center justify-center border-r border-[#333] text-[10px] font-bold [writing-mode:vertical-rl] tracking-[0.3em] text-[#333]">결재</div>
      <div className="flex">
        {steps.map((s) => (
          <div key={s.seq} className="w-[60px] border-r border-[#333] last:border-r-0">
            <div className="border-b border-[#333] bg-[#f2f2f2] py-0.5 text-[9px] font-bold text-[#333]">{posOf(s.approverId) || ' '}</div>
            <div className="grid h-[52px] place-items-center px-0.5"><Stamp step={s} name={nameOf(s.approverId)} sealUrl={sealOf(s.approverId)} /></div>
            <div className="border-t border-[#333] py-[1px] text-[8px] text-[#666]">{(s.decidedAt ? shortDate(s.decidedAt) : ' ') || ' '}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stamp({ step, name, sealUrl }: { step: ApprovalStep; name: string; sealUrl: string }) {
  if (step.kind === '참조') return <span className="text-[10px] text-[#888]">열람<br />{name}</span>;

  // 인감 이미지가 있고 결재/반려/보류가 완료된 경우 인감 이미지 우선 표시
  if (sealUrl && (step.decision === '승인' || step.decision === '반려' || step.decision === '보류')) {
    return (
      <div className="relative flex h-[44px] w-[44px] items-center justify-center">
        <img src={sealUrl} alt="인감" className="h-full w-full object-contain" style={{ opacity: step.decision === '반려' ? 0.6 : 1 }} />
        {step.decision === '반려' && (
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold text-[#c0392b]" style={{ textShadow: '0 0 2px #fff' }}>반려</span>
        )}
      </div>
    );
  }

  if (step.decision === '승인')
    return <span className="grid h-[40px] w-[40px] place-items-center rounded-full border-[1.5px] border-[#c0392b] text-[10px] font-bold leading-tight text-[#c0392b]">{name}</span>;
  if (step.decision === '반려')
    return <span className="grid h-[40px] w-[40px] place-items-center rounded-full border-[1.5px] border-[#c0392b] text-[10px] font-bold text-[#c0392b]">반려</span>;
  if (step.decision === '보류') return <span className="text-[10px] font-semibold text-[#888]">보류<br />{name}</span>;
  
  // 대기 상태일 때는 결재란 내 인감 영역에 연회색으로 결재단계(s.kind) 표시
  return <span className="text-[12px] font-bold text-[#ccc] select-none">{step.kind}</span>;
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
