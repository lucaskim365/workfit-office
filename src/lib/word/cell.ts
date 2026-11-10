/**
 * 표 행·칸 — 편집기 기본 표에 워드 표 모양을 더한다(저장·불러오기와 오간다).
 * - tableRow attrs: height(px, 최소 높이 — 워드 '행 높이')
 * - tableCell·tableHeader attrs: background('#1f2d50', 칸 음영), verticalAlign('top'·'middle'·'bottom', 세로 맞춤)
 */
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table';

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

export const WordTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-height')) || null,
        // 표 줄의 height 는 최소 높이로 동작한다 — 글이 많으면 줄이 늘어난다
        renderHTML: (a: Record<string, unknown>) =>
          Number(a.height) > 0 ? { 'data-height': String(a.height), style: `height:${Number(a.height)}px` } : {},
      },
    };
  },
});

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
