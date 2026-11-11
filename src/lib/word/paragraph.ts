/**
 * 문단 모양 — 문단·제목에 줄 간격·문단 앞뒤 간격·들여쓰기를 더한다(값 규칙은 format.ts).
 * 명령은 편집기 함수로 둔다(setParaFormat·changeIndent).
 */
import { Extension, type Editor } from '@tiptap/react';
import { paraCss, type ParaFormat } from './format';

const KEYS = ['lineHeight', 'spaceBefore', 'spaceAfter', 'indent', 'firstLine'] as const;
const TYPES = ['paragraph', 'heading'];
/** 들여쓰기 한 번(pt) — 두 글자쯤 */
export const INDENT_STEP = 20;

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: Object.fromEntries(
          KEYS.map((k) => [
            k,
            {
              default: null,
              parseHTML: (el: HTMLElement) => {
                const v = el.getAttribute(`data-${kebab(k)}`);
                return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
              },
              renderHTML: (a: Record<string, unknown>) => {
                const style = paraCss({ [k]: a[k] });
                return style ? { [`data-${kebab(k)}`]: String(a[k]), style } : {};
              },
            },
          ]),
        ),
      },
    ];
  },
});

/** 고른 문단들의 모양 바꾸기 — null 이면 기본으로 */
export function setParaFormat(editor: Editor, patch: { [K in keyof ParaFormat]?: number | null }): boolean {
  return editor.chain().focus().updateAttributes('paragraph', patch).updateAttributes('heading', patch).run();
}

/** 고른 문단들의 왼쪽 들여쓰기를 늘리거나 줄인다(목록 밖 문단만 — 목록은 단계로 들여쓴다) */
export function changeIndent(editor: Editor, delta: number): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      let changed = false;
      // 칸 선택은 여러 구역(ranges) — 고른 칸들만
      for (const { $from, $to } of state.selection.ranges) {
        state.doc.nodesBetween($from.pos, $to.pos, (node, pos, parent) => {
          if (!TYPES.includes(node.type.name)) return true;
          if (parent?.type.name === 'listItem') return false;
          const cur = Number(node.attrs.indent) || 0;
          const next = Math.max(0, cur + delta);
          if (next !== cur) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next || null });
            changed = true;
          }
          return false;
        });
      }
      return changed;
    })
    .run();
}
