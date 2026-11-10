/**
 * 워드 문서 데이터 — 편집기(Tiptap/ProseMirror)의 문서 JSON 형식 그대로.
 * 저장(.docx)·불러오기(.docx)·편집기가 모두 이 형식을 쓴다.
 *
 * 쓰는 노드: doc · paragraph · heading(level 1~6) · bulletList · orderedList(start) · listItem · blockquote ·
 *           horizontalRule · hardBreak · image(src·alt·width·height, 글 사이에 들어감) · table · tableRow · tableCell · tableHeader(colspan·rowspan·colwidth)
 * 쓰는 글 표시(mark): bold · italic · underline · strike · code · link(href) · highlight(color) · textStyle(color·fontSize·fontFamily·backgroundColor)
 * 문단·제목은 textAlign(left·center·right·justify)
 */

export interface WordMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface WordNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: WordNode[];
  text?: string;
  marks?: WordMark[];
}

/** 빈 문서 — 빈 문단 하나 */
export function emptyWordDoc(): WordNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** 저장된 값(JSON 글자·객체) → 문서. 이 형식이 아니면 null */
export function parseWordDoc(raw: unknown): WordNode | null {
  let p: unknown = raw;
  if (typeof raw === 'string') {
    try {
      p = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!p || typeof p !== 'object' || (p as WordNode).type !== 'doc') return null;
  const doc = p as WordNode;
  return Array.isArray(doc.content) && doc.content.length ? doc : emptyWordDoc();
}

/** 문서 안 글자만 이어 붙이기(문단은 줄바꿈) — 미리보기·검색용 */
export function wordDocText(node: WordNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  const inner = (node.content ?? []).map(wordDocText).join(node.type === 'doc' || node.type.endsWith('List') || node.type === 'listItem' || node.type === 'blockquote' || node.type === 'tableRow' || node.type === 'table' ? '\n' : '');
  return node.type === 'tableCell' || node.type === 'tableHeader' ? inner + '\t' : inner;
}

/** A4 종이(px, 96dpi)와 여백 — 편집 화면과 .docx 의 쪽 설정이 같게 */
export const A4 = { width: 794, height: 1123, margin: 96 } as const;
/** 본문 폭(px) — 그림·표 최대 폭 */
export const A4_CONTENT_WIDTH = A4.width - A4.margin * 2;
