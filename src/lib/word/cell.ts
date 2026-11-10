/**
 * 표 칸 — 편집기 기본 칸에 '배경색'과 '세로 정렬'을 더한다(워드 칸 음영·세로 맞춤과 오간다).
 * 문서 JSON 의 tableCell·tableHeader attrs: background('#1f2d50'), verticalAlign('top'·'middle'·'bottom')
 */
import { TableCell, TableHeader } from '@tiptap/extension-table';

export type CellVAlign = 'top' | 'middle' | 'bottom';

const cellAttributes = {
  background: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-background'),
    renderHTML: (a: Record<string, unknown>) =>
      typeof a.background === 'string' ? { 'data-background': a.background, style: `background-color:${a.background}` } : {},
  },
  verticalAlign: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-valign'),
    renderHTML: (a: Record<string, unknown>) =>
      typeof a.verticalAlign === 'string' ? { 'data-valign': a.verticalAlign, style: `vertical-align:${a.verticalAlign}` } : {},
  },
};

export const WordTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
});

export const WordTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
});
