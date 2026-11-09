import { Building2, Calendar, CheckSquare, ChevronDown, Square } from 'lucide-react';
import type { CellInput, CellInputType } from '@/domain/approvalForm/sheet/approvalSheet';

/**
 * 아이콘은 왼쪽에 — 칸 오른쪽 위에는 '입력·날짜' 같은 칸 표시가 붙는다
 *
 * 서식 편집기 — 비어 있는 입력 칸 안에 기안 화면에서 뜰 입력 도구 모양을 흐리게 그린다.
 * 눌러도 동작하지 않는 그림이다(편집기에서 칸 클릭은 칸 선택·편집). 실제 동작은 '기안 미리보기'에서.
 */

/** 칸 표시용 짧은 이름 */
export const INPUT_SHORT_LABELS: Record<CellInputType, string> = {
  text: '글',
  multiline: '여러 줄',
  number: '숫자',
  currency: '금액',
  date: '날짜',
  dateRange: '기간',
  select: '선택',
  multiSelect: '여러 선택',
  checkbox: '체크',
  user: '사람',
  users: '여러 명',
  dept: '부서',
};

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

/** quiet — 간단 표시: 글 입력 칸은 아무것도 안 그린다(연한 바탕만으로 입력 칸임을 안다) */
export function InputLook({ input, quiet }: { input: CellInput; quiet?: boolean }) {
  if (quiet && input.type === 'text') return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center gap-1 overflow-hidden px-1.5 text-[11px] italic text-[#a8a29e]"
    >
      {look(input)}
    </span>
  );
}
