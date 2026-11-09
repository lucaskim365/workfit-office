/**
 * XML 읽기 — .xlsx 안의 XML 을 위한 작은 파서 (DOMParser 가 없는 환경에서도 동작)
 * - 요소·속성·글자만 다룬다. 이름공간 접두사(x:c)는 떼고 로컬 이름(c)만 쓴다
 * - 주석·선언(<?xml?>)·DOCTYPE 은 건너뛴다. CDATA 는 글자로
 */

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

const localName = (name: string) => name.slice(name.indexOf(':') + 1);

export function parseXml(src: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const top = stack[stack.length - 1];
    if (lt === -1) {
      top.text += decodeEntities(src.slice(i));
      break;
    }
    if (lt > i) top.text += decodeEntities(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9);
      top.text += src.slice(lt + 9, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (src[lt + 1] === '?' || src[lt + 1] === '!') {
      const end = src.indexOf('>', lt);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    const end = src.indexOf('>', lt);
    if (end === -1) break;
    const body = src.slice(lt + 1, end);
    i = end + 1;
    if (body[0] === '/') {
      // 닫는 태그 — 맞는 열린 태그까지 거슬러 닫는다(잘못 짝지은 문서에도 멈추지 않게)
      const name = localName(body.slice(1).trim());
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === name) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    const selfClosing = body.endsWith('/');
    const inner = selfClosing ? body.slice(0, -1) : body;
    const nameMatch = inner.match(/^\s*([^\s/]+)/);
    if (!nameMatch) continue;
    const node: XmlNode = { name: localName(nameMatch[1]), attrs: {}, children: [], text: '' };
    for (const m of inner.slice(nameMatch[0].length).matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      node.attrs[localName(m[1])] = decodeEntities(m[3] ?? m[4] ?? '');
    }
    top.children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

/** 이름이 맞는 첫 자식 */
export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

/** 이름이 맞는 모든 자식 */
export function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node ? node.children.filter((c) => c.name === name) : [];
}

/** 자손 전체에서 이름이 맞는 첫 요소 (깊이 우선) */
export function find(node: XmlNode | undefined, name: string): XmlNode | undefined {
  if (!node) return undefined;
  for (const c of node.children) {
    if (c.name === name) return c;
    const hit = find(c, name);
    if (hit) return hit;
  }
  return undefined;
}

/** 요소 안 모든 글자를 이어 붙임 (<t> 여러 개인 서식 있는 글 등) */
export function textOf(node: XmlNode | undefined): string {
  if (!node) return '';
  return node.text + node.children.map(textOf).join('');
}
