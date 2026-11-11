/**
 * 표 행·칸 — 편집기 기본 표에 워드 표 모양을 더한다(저장·불러오기와 오간다).
 * - tableRow attrs: height(px, 최소 높이 — 워드 '행 높이')
 * - tableCell·tableHeader attrs: background('#1f2d50', 칸 음영), verticalAlign('top'·'middle'·'bottom', 세로 맞춤),
 *   borders(네 변 테두리 — format.ts)
 */
import type { Editor } from '@tiptap/react';
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { CellSelection, isInTable, selectedRect } from '@tiptap/pm/tables';
import { allSides, bordersCss, type BorderSide, type CellBorder, type CellBorders } from './format';

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
  borders: {
    default: null,
    parseHTML: (el: HTMLElement) => {
      try {
        return JSON.parse(el.getAttribute('data-borders') ?? 'null');
      } catch {
        return null;
      }
    },
    renderHTML: (a: Record<string, unknown>) => {
      const style = bordersCss(a.borders);
      return style ? { 'data-borders': JSON.stringify(a.borders), style } : {};
    },
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

/**
 * 고른 칸들(또는 커서가 있는 칸)의 네 변 테두리 — null 이면 편집기 기본 선.
 * 맞닿은 이웃 칸의 마주 보는 변도 같이 바꾼다(표 선은 두 칸이 나눠 그리므로, 한쪽만 '선 없음'이면 이웃 선이 남아 보인다)
 */
export function setCellBorders(editor: Editor, border: CellBorder | null): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      if (!isInTable(state)) return false;
      const rect = selectedRect(state);
      const { map, tableStart } = rect;
      const at = (row: number, col: number) => tableStart + map.map[row * map.width + col];
      /** 칸 위치 → 바꿀 변들(같은 칸이 여러 번 나와도 한 번에) */
      const patches = new Map<number, CellBorders | null>();
      const patch = (pos: number, sides: BorderSide[]) => {
        if (!border) return;
        const prev = patches.get(pos);
        patches.set(pos, { ...(prev ?? {}), ...Object.fromEntries(sides.map((s) => [s, border])) });
      };
      for (const rel of map.cellsInRect(rect)) patches.set(tableStart + rel, border ? allSides(border) : null);
      for (let r = rect.top; r < rect.bottom; r++) {
        if (rect.left > 0) patch(at(r, rect.left - 1), ['right']);
        if (rect.right < map.width) patch(at(r, rect.right), ['left']);
      }
      for (let c = rect.left; c < rect.right; c++) {
        if (rect.top > 0) patch(at(rect.top - 1, c), ['bottom']);
        if (rect.bottom < map.height) patch(at(rect.bottom, c), ['top']);
      }
      const inside = new Set(map.cellsInRect(rect).map((rel) => tableStart + rel));
      patches.forEach((value, pos) => {
        const cell = tr.doc.nodeAt(pos);
        if (!cell) return;
        // 고른 칸은 통째로, 이웃 칸은 맞닿은 변만 덮어 쓴다
        const borders = inside.has(pos) ? value : { ...((cell.attrs.borders as CellBorders | null) ?? {}), ...value };
        tr.setNodeMarkup(pos, undefined, { ...cell.attrs, borders });
      });
      return true;
    })
    .run();
}

/** 고른 칸들(또는 커서가 있는 칸)의 행 높이 — null 이면 자동 */
export function setRowHeight(editor: Editor, height: number | null): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const rows = new Set<number>();
      const sel = state.selection;
      if (sel instanceof CellSelection) {
        // 칸 앞 위치를 풀면 그 부모가 행 — before() 가 행 앞 위치
        sel.forEachCell((_cell, pos) => rows.add(state.doc.resolve(pos).before()));
      } else {
        const $from = sel.$from;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'tableRow') {
            rows.add($from.before(d));
            break;
          }
        }
      }
      rows.forEach((pos) => {
        const row = tr.doc.nodeAt(pos);
        if (row) tr.setNodeMarkup(pos, undefined, { ...row.attrs, height });
      });
      return rows.size > 0;
    })
    .run();
}
