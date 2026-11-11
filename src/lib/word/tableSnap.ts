/**
 * 표 너비 맞춤 — 열 경계를 끌어 표 오른쪽 끝이 본문(A4 여백 안) 경계 근처에 오면 경계에 착 붙는다(더 끌면 넘어간다).
 * - 끄는 동안: 편집기의 열 끌기(columnResizing)가 그리기 전에 붙인 너비로 대신 그린다
 * - 놓을 때: 열 끌기가 넣은 너비를 같은 규칙으로 고쳐 저장한다(appendTransaction, 끄는 중일 때만)
 */
import { Extension } from '@tiptap/react';
import { Plugin } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { TableMap, columnResizingPluginKey, updateColumnsOnResize } from '@tiptap/pm/tables';
import { TABLE_MAX_WIDTH } from './model';
import { CELL_MIN_WIDTH, snapColumnWidth } from './format';
import { columnWidths, setColumnWidth } from './cell';

const isTable = (n: PMNode) => n.type.spec.tableRole === 'table';

/** 끄는 중인 열 — 열 끌기 손잡이 칸 위치에서 표·열 자리를 찾는다(열 끌기와 같은 계산) */
function draggedColumn(view: EditorView, handle: number): { table: PMNode; start: number; col: number } | null {
  const $cell = view.state.doc.resolve(handle);
  const table = $cell.node(-1);
  const cell = $cell.nodeAfter;
  if (!table || !cell || !isTable(table)) return null;
  const start = $cell.start(-1);
  return { table, start, col: TableMap.get(table).colCount($cell.pos - start) + Number(cell.attrs.colspan) - 1 };
}

function snapPlugin(): Plugin {
  return new Plugin({
    view(view) {
      const win = view.dom.ownerDocument.defaultView ?? window;
      // 열 끌기의 mousemove(창에 붙음)보다 먼저 받는다 — 붙여야 할 때는 대신 그리고 열 끌기는 건너뛴다
      const onMove = (e: MouseEvent) => {
        const st = columnResizingPluginKey.getState(view.state);
        if (!st?.dragging || !e.buttons) return;
        const found = draggedColumn(view, st.activeHandle);
        if (!found) return;
        const dragged = Math.max(CELL_MIN_WIDTH, st.dragging.startWidth + (e.clientX - st.dragging.startX));
        const snapped = snapColumnWidth(columnWidths(found.table), found.col, dragged, TABLE_MAX_WIDTH);
        if (snapped === dragged) return;
        let dom: Node | null = view.domAtPos(found.start).node;
        while (dom && dom.nodeName !== 'TABLE') dom = dom.parentNode;
        const tableDom = dom as HTMLTableElement | null;
        const colgroup = tableDom?.querySelector('colgroup');
        if (!tableDom || !colgroup) return;
        e.stopImmediatePropagation();
        updateColumnsOnResize(found.table, colgroup, tableDom, CELL_MIN_WIDTH, found.col, snapped);
      };
      win.addEventListener('mousemove', onMove, true);
      return { destroy: () => win.removeEventListener('mousemove', onMove, true) };
    },
    appendTransaction(trs, oldState, newState) {
      // 열 끌기를 놓을 때(끄는 중 상태에서 너비가 바뀐 때)만 — 실행 취소·문서 바꾸기 등에는 걸지 않는다
      if (!columnResizingPluginKey.getState(oldState)?.dragging || !trs.some((t) => t.docChanged)) return null;
      /** 새 문서 위치 → 바뀌기 전 문서 위치 */
      const back = (pos: number) => trs.reduceRight((p, t) => t.mapping.invert().map(p), pos);
      const tr = newState.tr;
      newState.doc.descendants((node, pos) => {
        if (!isTable(node)) return !node.isTextblock;
        const old = oldState.doc.nodeAt(back(pos));
        if (!old || old === node || !isTable(old)) return false;
        const now = columnWidths(node);
        const before = columnWidths(old);
        if (now.length !== before.length) return false;
        // 한 열만 너비가 바뀐 경우(열 끌기)만 — 열 넣기·빼기 등은 그쪽이 맞춘다
        const changed = now.flatMap((w, i) => (w !== before[i] ? [i] : []));
        if (changed.length !== 1) return false;
        const col = changed[0];
        const w = now[col];
        if (w === undefined) return false;
        const snapped = snapColumnWidth(now, col, w, TABLE_MAX_WIDTH);
        if (snapped !== w) setColumnWidth(tr, pos + 1, node, col, snapped);
        return false;
      });
      return tr.docChanged ? tr : null;
    },
  });
}

export const TableSnap = Extension.create({
  name: 'tableSnap',
  addProseMirrorPlugins() {
    return [snapPlugin()];
  },
});
