import { Building2, Calendar, CheckSquare, ChevronDown, Square } from 'lucide-react';
import { placeholderOf, type CellInput } from '@/domain/approvalForm/sheet/approvalSheet';

/**
 * 서식 편집기 — 비어 있는 입력 칸 안에 기안 화면에서 뜰 입력 도구 모양을 흐리게 그린다.
 * 눌러도 동작하지 않는 그림이다(편집기에서 칸 클릭은 칸 선택·편집). 실제 동작은 '기안 미리보기'에서.
 */

const ic = 'h-3 w-3 shrink-0';

function look(input: CellInput) {
  const opts = (input.options ?? []).filter(Boolean);
  switch (input.type) {
    case 'date':
      return (
        <>
          <Calendar className={ic} />
          <span>연도-월-일</span>
        </>
      );
    case 'dateRange':
      return (
        <>
          <Calendar className={ic} />
          <span>기간을 선택하세요</span>
        </>
      );
    case 'user':
      return (
        <>
          <Building2 className={ic} />
          <span>임직원 검색</span>
        </>
      );
    case 'users':
      return (
        <>
          <Building2 className={ic} />
          <span>임직원 검색(여러 명)</span>
        </>
      );
    case 'dept':
      return (
        <>
          <ChevronDown className={ic} />
          <span>부서 선택</span>
        </>
      );
    case 'select':
      return (
        <>
          <ChevronDown className={ic} />
          <span className="truncate">{opts.length ? `선택 (${opts.join(' / ')})` : '선택 — 항목 없음'}</span>
        </>
      );
    case 'multiSelect':
      return opts.length ? (
        <span className="flex flex-wrap gap-x-2">
          {opts.map((o) => (
            <span key={o} className="inline-flex items-center gap-0.5">
              <Square className={ic} />
              {o}
            </span>
          ))}
        </span>
      ) : (
        <span>여러 선택 — 항목 없음</span>
      );
    case 'checkbox':
      return <CheckSquare className={`${ic} mx-auto`} />;
    case 'number':
      return <span className="flex-1 text-right">숫자</span>;
    case 'currency':
      return <span className="flex-1 text-right">금액</span>;
    case 'multiline':
      return <span>여러 줄 글</span>;
    default:
      return <span>글 입력</span>;
  }
}

/** 입력 예시 글자 모양 — 기안 화면의 흐린 예시와 같게(기울이지 않음). 문서 제목 칸의 예시도 이 모양 */
export const HINT_LOOK = 'pointer-events-none absolute inset-0 flex items-center overflow-hidden px-1.5 text-[11px] text-[#b4b4b4]';

/** 입력 예시를 정한 칸은 그 글을 기안 화면처럼 흐리게. 예시가 없는 글 입력 칸은 아무것도 안 그린다(빗금이 없으면 쓸 수 있는 칸) */
export function InputLook({ input }: { input: CellInput }) {
  const hint = placeholderOf(input);
  if (hint) {
    const numeric = input.type === 'number' || input.type === 'currency';
    return (
      <span aria-hidden title="입력 예시 — 기안 화면에서 빈 칸에 흐리게 보입니다" className={HINT_LOOK}>
        <span className={`truncate ${numeric ? 'flex-1 pr-6 text-right' : ''}`}>{hint}</span>
      </span>
    );
  }
  if (input.type === 'text') return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center gap-1 overflow-hidden px-1.5 text-[11px] italic text-[#a8a29e]"
    >
      {look(input)}
    </span>
  );
}
