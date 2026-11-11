/**
 * 결재 문서(시트 서식) → 엑셀 내보내기 설정 — 문서 보기 화면과 같은 내용이 되게.
 * - 조건으로 숨은 행, 결재 전 '결재 완료일' 행은 뺀다(화면과 같음). 대외 문서 숨김 행은 부르는 쪽이 이미 뺀 시트를 넘긴다
 * - 안내문 칸은 비우고, 비공개 칸은 가릴 때 '비공개'
 * - 자동 채우기(기안자·기안일·문서번호·제목…)는 문서에 남은 값, 문서 머리 부품(결재란·로고·서명·회사 정보)은 글자로(slotText)
 * - 수식은 계산된 값으로만(결재 당시 숫자 그대로 — 엑셀이 다시 계산하지 않게)
 */
import type { Sheet, XlsxExportOptions } from '@/lib/sheet/core';
import { approvalCellProps, completedDateRows, draftInfoValue, isSecretCell, slotOf, type DraftInfo, type SheetSlots } from './approvalSheet';
import { extrasHiddenRows, isExtrasDrawCell } from './docExtras';

export interface DocExportInput {
  /** 값이 얹힌 문서 시트(반복 구간 펼침, 대외 문서면 숨김 행 뺀 것) */
  sheet: Sheet;
  /** 조건으로 숨은 행 */
  condHidden: Set<number>;
  masked: boolean;
  docInfo?: DraftInfo;
  /** 문서 머리 부품 칸에 넣을 글자(결재란: '팀장 홍길동 승인 …') */
  slotText?: Partial<Record<keyof SheetSlots, string>>;
  sheetName?: string;
}

export function docExportOptions({ sheet, condHidden, masked, docInfo, slotText, sheetName }: DocExportInput): XlsxExportOptions {
  const completedRows = new Set(completedDateRows(sheet));
  // 첨부·관련 문서 자리 — 넣을 글자가 없으면 줄째 뺀다(화면에서 숨는 것과 같게)
  const emptyExtras = extrasHiddenRows(sheet, !!slotText?.extras);
  return {
    sheetName,
    skipRow: (r) => condHidden.has(r) || (!docInfo?.completedDate && completedRows.has(r)) || emptyExtras.has(r),
    cellText: (r, c) => {
      const p = approvalCellProps(sheet, r, c);
      if (p.guide) return '';
      if (masked && isSecretCell(sheet, r, c)) return '비공개';
      const slot = slotOf(p.bind);
      if (slot === 'extras') return isExtrasDrawCell(sheet, r, c) ? (slotText?.extras ?? '') : '';
      if (slot) return slotText?.[slot] ?? '';
      if (p.bind) return draftInfoValue(p.bind, docInfo);
      return undefined;
    },
  };
}
