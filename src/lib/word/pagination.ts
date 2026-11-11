/**
 * 쪽 나눔 — 워드처럼 A4 한 장을 넘는 내용은 다음 장으로 넘긴다(화면만, 문서 데이터는 그대로).
 *
 * 화면에는 A4 종이를 장마다 틈을 두고 그리고(WordEditor), 여기서는 장 아래 여백에 걸리는 덩어리를 다음 장 첫머리로 민다.
 * - 덩어리: 맨 위 문단·제목·인용·그림 문단, 목록은 항목(li)마다, 표는 행(tr)마다 — 세로로 합친 칸이 걸친 행들은 한 덩어리
 *   (합친 칸 사이에 빈 행을 끼우면 HTML rowspan 이 빈 행을 세어 표가 깨진다)
 * - 밀기: 문단·목록 항목은 위 안쪽 여백(padding-top), 표 행은 그 앞에 빈 행을 끼운다(표 안은 여백을 줄 수 없음)
 * - 한 장보다 큰 덩어리는 밀지 않는다(나눠 그릴 수 없음)
 *
 * 그린 뒤 화면 위치를 재서(밀어 둔 만큼 빼고 원래 자리를 구해) 다시 계산하므로, 내용이 바뀌면 저절로 다시 맞춰진다.
 * 인쇄할 때는 밀기를 빼고 브라우저가 쪽을 나눈다.
 */
import { Extension } from '@tiptap/react';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';
import { A4 } from './model';

/** 화면에서 장 사이 틈(px) */
export const PAGE_GAP = 24;
/** 한 장이 차지하는 높이(종이 + 틈) */
export const PAGE_PITCH = A4.height + PAGE_GAP;
/** 한 장의 본문 높이(위아래 여백 뺀 것) */
const CONTENT_H = A4.height - A4.margin * 2;

type Kind = 'pad' | 'row';
interface Push {
  pos: number;
  kind: Kind;
  size: number;
}
interface PageState {
  pushes: Push[];
  pages: number;
}

export const paginationKey = new PluginKey<PageState>('wordPagination');

/** 지금 장 수(화면에 그릴 종이 수) */
export function pageCount(state: EditorState): number {
  return paginationKey.getState(state)?.pages ?? 1;
}

/** 쪽 나눔 대상 덩어리(문서 순서). last: 여러 행 묶음이면 마지막 행 위치(아래 끝을 거기서 잰다) */
interface Block {
  pos: number;
  kind: Kind;
  last?: number;
}

/** 표 행들을 묶음으로 — 위아래 행 경계를 건너는 칸(세로로 합친 칸)이 있으면 같은 묶음 */
function rowGroups(table: PMNode, tablePos: number): Block[] {
  const map = TableMap.get(table);
  const rowPos: number[] = [];
  table.forEach((_row, off) => rowPos.push(tablePos + 1 + off));
  const out: Block[] = [];
  for (let r = 0; r < map.height; r++) {
    const crosses = r > 0 && Array.from({ length: map.width }, (_, c) => map.map[(r - 1) * map.width + c] === map.map[r * map.width + c]).some(Boolean);
    if (crosses && out.length) out[out.length - 1].last = rowPos[r];
    else out.push({ pos: rowPos[r], kind: 'row' });
  }
  return out;
}

function blocksOf(state: EditorState): Block[] {
  const out: Block[] = [];
  state.doc.forEach((node, offset) => {
    if (node.type.spec.tableRole === 'table') {
      out.push(...rowGroups(node, offset));
    } else if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      node.forEach((_li, liOffset) => out.push({ pos: offset + 1 + liOffset, kind: 'pad' }));
    } else {
      out.push({ pos: offset, kind: 'pad' });
    }
  });
  return out;
}

/** 화면을 재서 밀 곳과 장 수를 구한다 */
function measure(view: EditorView, current: Push[]): PageState {
  const root = view.dom as HTMLElement;
  const rootBox = root.getBoundingClientRect();
  // 앱 화면 배율(zoom) — 화면 좌표를 문서 px 로
  const scale = root.offsetWidth ? rootBox.width / root.offsetWidth : 1;
  const sizeAt = new Map(current.map((p) => [`${p.kind}:${p.pos}`, p.size]));
  const pushes: Push[] = [];
  let shift = 0; // 지금 화면에서 앞쪽 밀기의 합
  let offset = 0; // 새로 계산한 밀기의 합
  let lastBottom = 0;
  for (const b of blocksOf(view.state)) {
    const el = view.nodeDOM(b.pos);
    const lastEl = b.last !== undefined ? view.nodeDOM(b.last) : el;
    if (!(el instanceof HTMLElement) || !(lastEl instanceof HTMLElement)) continue;
    const r = el.getBoundingClientRect();
    const rBottom = lastEl.getBoundingClientRect().bottom;
    if (rBottom <= r.top) continue;
    const e = sizeAt.get(`${b.kind}:${b.pos}`) ?? 0;
    shift += e;
    const visTop = (r.top - rootBox.top) / scale + (b.kind === 'pad' ? e : 0);
    const natTop = visTop - shift;
    const natBottom = (rBottom - rootBox.top) / scale - shift;
    const top = natTop + offset;
    const bottom = natBottom + offset;
    const page = Math.max(0, Math.floor(top / PAGE_PITCH));
    const pageEnd = page * PAGE_PITCH + CONTENT_H;
    let push = 0;
    if (top >= pageEnd - 0.5) push = (page + 1) * PAGE_PITCH - top; // 틈(아래 여백·위 여백)에 걸쳐 시작
    else if (bottom > pageEnd + 0.5 && bottom - top <= CONTENT_H) push = (page + 1) * PAGE_PITCH - top; // 장 끝에 걸침
    push = Math.round(push);
    if (push > 0) pushes.push({ pos: b.pos, kind: b.kind, size: push });
    offset += push;
    lastBottom = Math.max(lastBottom, bottom + push);
  }
  return { pushes, pages: Math.max(1, Math.floor(Math.max(0, lastBottom - 1) / PAGE_PITCH) + 1) };
}

const same = (a: PageState, b: PageState) =>
  a.pages === b.pages && a.pushes.length === b.pushes.length && a.pushes.every((p, i) => p.pos === b.pushes[i].pos && p.kind === b.pushes[i].kind && p.size === b.pushes[i].size);

function decorations(state: EditorState, pushes: Push[]): DecorationSet {
  const decos: Decoration[] = [];
  for (const p of pushes) {
    const node = state.doc.nodeAt(p.pos);
    // 자리가 다른 종류 노드로 옮겨졌으면(지운 뒤 등) 그리지 않는다 — 곧 다시 잰다
    if (!node || (p.kind === 'pad' ? !node.isBlock : node.type.spec.tableRole !== 'row')) continue;
    if (p.kind === 'pad') {
      decos.push(Decoration.node(p.pos, p.pos + node.nodeSize, { class: 'wf-pg-push', style: `padding-top:${p.size}px` }));
    } else {
      // 빈 행은 표의 열 수만큼만 차지해야 한다(더 크면 표 칸 나눔이 흐트러진다)
      const cols = TableMap.get(state.doc.resolve(p.pos).parent).width;
      decos.push(
        Decoration.widget(
          p.pos,
          () => {
            const tr = document.createElement('tr');
            tr.className = 'wf-pg-spacer';
            tr.contentEditable = 'false';
            const td = document.createElement('td');
            td.colSpan = cols;
            td.style.cssText = `height:${p.size}px;padding:0;border:none;background:transparent;pointer-events:none`;
            tr.appendChild(td);
            return tr;
          },
          { side: -1, key: `pg-${p.pos}-${p.size}`, ignoreSelection: true },
        ),
      );
    }
  }
  return DecorationSet.create(state.doc, decos);
}

function paginationPlugin(): Plugin<PageState> {
  return new Plugin<PageState>({
    key: paginationKey,
    state: {
      init: () => ({ pushes: [], pages: 1 }),
      apply(tr, value) {
        const next = tr.getMeta(paginationKey) as PageState | undefined;
        if (next) return next;
        if (!tr.docChanged) return value;
        // 내용이 바뀌면 자리만 옮겨 두고(지워진 덩어리의 밀기는 버린다), 그린 뒤 다시 잰다
        const pushes = value.pushes.flatMap((p) => {
          const m = tr.mapping.mapResult(p.pos);
          return m.deleted ? [] : [{ ...p, pos: m.pos }];
        });
        return { ...value, pushes };
      },
    },
    props: {
      decorations(state) {
        return decorations(state, paginationKey.getState(state)?.pushes ?? []);
      },
    },
    view(view) {
      let frame = 0;
      /** 내용이 그대로인데 다시 맞춘 횟수 — 재는 값이 흔들려도 끝없이 다시 그리지 않게 몇 번에서 멈춘다 */
      let passes = 0;
      /** 마지막으로 자리가 잡혔을 때 본문 높이 — 그 뒤 높이가 바뀌면(늦게 들어온 글꼴·그림) 다시 맞춘다 */
      let settledHeight = -1;
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (view.isDestroyed || passes >= 4) return;
          const cur = paginationKey.getState(view.state);
          if (!cur) return;
          const next = measure(view, cur.pushes);
          if (same(cur, next)) {
            settledHeight = (view.dom as HTMLElement).offsetHeight;
            return;
          }
          passes++;
          view.dispatch(view.state.tr.setMeta(paginationKey, next).setMeta('addToHistory', false));
        });
      };
      // 글꼴·그림이 늦게 들어와 높이가 바뀌어도 다시 잰다
      const ro = new ResizeObserver(() => {
        // 밀기 때문에 높이가 흔들리는 중에는 세지 않던 횟수를 그대로 둔다(자리 잡힌 뒤 바뀐 것만 새로)
        if (settledHeight >= 0 && (view.dom as HTMLElement).offsetHeight !== settledHeight) passes = 0;
        schedule();
      });
      ro.observe(view.dom);
      schedule();
      return {
        update(_view, prev) {
          // 선택만 바뀐 것(방향키·누르기)은 다시 잴 것이 없다
          if (prev.doc === view.state.doc && paginationKey.getState(prev) === paginationKey.getState(view.state)) return;
          if (prev.doc !== view.state.doc) passes = 0;
          schedule();
        },
        destroy: () => {
          cancelAnimationFrame(frame);
          ro.disconnect();
        },
      };
    },
  });
}

export const Pagination = Extension.create({
  name: 'wordPagination',
  addProseMirrorPlugins() {
    return [paginationPlugin()];
  },
});
