/**
 * 시트 수식 계산기 (엑셀 문법의 작은 부분집합)
 * - 숫자·"글자"·TRUE/FALSE·셀(A1, $A$1)·범위(함수 인자에서만)·함수·괄호
 * - 연산 우선순위(낮은 것부터): 비교(= <> < > <= >=) → 결합(&) → + - → * / → 단항 -
 * - 함수: SUM·AVERAGE·MIN·MAX·ROUND·IF
 * - eval 없이 토큰화 → 구문 나무 → 계산. 잘못된 식은 FormulaError
 */

export type SheetValue = number | string | boolean;
/** 0-based 좌표의 계산된 값 (빈 칸은 '') */
export type CellGetter = (r: number, c: number) => SheetValue;

export class FormulaError extends Error {}

/** 수식 오류 칸 표시 */
export const FORMULA_ERROR = '#오류';

/** 0 → 'A', 26 → 'AA' */
export function colLetter(idx: number): string {
  let n = idx;
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** 'A' → 0, 'AA' → 26 */
export function colIndex(letter: string): number {
  const up = letter.toUpperCase();
  let n = 0;
  for (let i = 0; i < up.length; i++) n = n * 26 + (up.charCodeAt(i) - 64);
  return n - 1;
}

/** 칸 글자 → 숫자 (공백·콤마·₩ 무시, 끝 %는 ÷100). 숫자가 아니면 null */
export function parseNumber(text: string): number | null {
  let s = String(text).replace(/[\s,₩]/g, '');
  if (s === '') return null;
  const percent = s.endsWith('%');
  if (percent) s = s.slice(0, -1);
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return percent ? n / 100 : n;
}

/** 계산 결과 → 칸에 쓸 글자 (부동소수 오차는 소수 10자리에서 반올림) */
export function valueText(v: SheetValue): string {
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    const n = Number(v.toFixed(10));
    return Object.is(n, -0) ? '0' : String(n);
  }
  return v;
}

// ── 토큰화 ─────────────────────────────────────────────

interface RefTok {
  kind: 'ref';
  col: number;
  row: number;
  colAbs: boolean;
  rowAbs: boolean;
}
type Tok = (
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | RefTok
  | { kind: 'name'; value: string }
  | { kind: 'refErr' }
  | { kind: 'op'; value: string }
) & { start: number; end: number };

const OPS2 = ['<>', '<=', '>='];
const OPS1 = '+-*/&=<>(),:';

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;
    const rest = src.slice(i);
    if (ch === '"') {
      let value = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new FormulaError(); // 닫는 따옴표 없음
        if (src[i] === '"') {
          if (src[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += src[i++];
      }
      out.push({ kind: 'str', value, start, end: i });
      continue;
    }
    if (rest.toUpperCase().startsWith('#REF!')) {
      i += 5;
      out.push({ kind: 'refErr', start, end: i });
      continue;
    }
    const num = rest.match(/^(\d+\.?\d*|\.\d+)/);
    if (num) {
      i += num[0].length;
      out.push({ kind: 'num', value: Number(num[0]), start, end: i });
      continue;
    }
    // 셀 주소 — 뒤에 글자·숫자·'('가 이어지면 함수 이름 등으로 봄
    const ref = rest.match(/^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/);
    if (ref) {
      i += ref[0].length;
      out.push({
        kind: 'ref',
        colAbs: ref[1] === '$',
        col: colIndex(ref[2]),
        rowAbs: ref[3] === '$',
        row: Number(ref[4]) - 1,
        start,
        end: i,
      });
      continue;
    }
    const name = rest.match(/^[A-Za-z_][A-Za-z0-9_.]*/);
    if (name) {
      i += name[0].length;
      out.push({ kind: 'name', value: name[0].toUpperCase(), start, end: i });
      continue;
    }
    const op2 = OPS2.find((o) => rest.startsWith(o));
    if (op2) {
      i += 2;
      out.push({ kind: 'op', value: op2, start, end: i });
      continue;
    }
    if (OPS1.includes(ch)) {
      i++;
      out.push({ kind: 'op', value: ch, start, end: i });
      continue;
    }
    throw new FormulaError();
  }
  return out;
}

// ── 구문 나무 ───────────────────────────────────────────

type Node =
  | { t: 'lit'; v: SheetValue }
  | { t: 'ref'; r: number; c: number }
  | { t: 'range'; r1: number; c1: number; r2: number; c2: number }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'call'; name: string; args: Node[] };

const CMP_OPS = ['=', '<>', '<', '>', '<=', '>='];

function parse(tokens: Tok[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string, k = 0) => {
    const t = tokens[pos + k];
    return !!t && t.kind === 'op' && t.value === v;
  };
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new FormulaError();
    pos++;
  };

  const binLevel = (ops: string[], next: () => Node) => (): Node => {
    let a = next();
    for (let t = peek(); t && t.kind === 'op' && ops.includes(t.value); t = peek()) {
      pos++;
      a = { t: 'bin', op: t.value, a, b: next() };
    }
    return a;
  };

  const unary = (): Node => {
    if (isOp('-')) {
      pos++;
      return { t: 'neg', a: unary() };
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return primary();
  };

  // 함수 인자: 'A1:B3' 범위 또는 식
  const arg = (): Node => {
    const a = tokens[pos];
    const b = tokens[pos + 2];
    if (a?.kind === 'ref' && isOp(':', 1) && b?.kind === 'ref') {
      pos += 3;
      return {
        t: 'range',
        r1: Math.min(a.row, b.row),
        r2: Math.max(a.row, b.row),
        c1: Math.min(a.col, b.col),
        c2: Math.max(a.col, b.col),
      };
    }
    return expr();
  };

  const primary = (): Node => {
    const t = peek();
    if (!t) throw new FormulaError(); // 피연산자 빠짐
    pos++;
    switch (t.kind) {
      case 'num':
        return { t: 'lit', v: t.value };
      case 'str':
        return { t: 'lit', v: t.value };
      case 'ref':
        return { t: 'ref', r: t.row, c: t.col };
      case 'name': {
        if (isOp('(')) {
          pos++;
          const args: Node[] = [];
          if (!isOp(')')) {
            args.push(arg());
            while (isOp(',')) {
              pos++;
              args.push(arg());
            }
          }
          expectOp(')');
          return { t: 'call', name: t.value, args };
        }
        if (t.value === 'TRUE') return { t: 'lit', v: true };
        if (t.value === 'FALSE') return { t: 'lit', v: false };
        throw new FormulaError();
      }
      case 'op':
        if (t.value === '(') {
          const e = expr();
          expectOp(')');
          return e;
        }
        throw new FormulaError();
      default:
        throw new FormulaError(); // #REF! 등
    }
  };

  const term = binLevel(['*', '/'], unary);
  const additive = binLevel(['+', '-'], term);
  const concat = binLevel(['&'], additive);
  const expr = binLevel(CMP_OPS, concat);

  const root = expr();
  if (pos !== tokens.length) throw new FormulaError(); // 남은 토큰
  return root;
}

// ── 계산 ───────────────────────────────────────────────

/** 칸에서 읽은 글자는 숫자로 읽히면 숫자 */
function cellValue(v: SheetValue): SheetValue {
  if (typeof v !== 'string' || v === '') return v;
  const n = parseNumber(v);
  return n === null ? v : n;
}

function toNum(v: SheetValue): number {
  if (v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  const n = parseNumber(v);
  if (n === null) throw new FormulaError();
  return n;
}

function truthy(v: SheetValue): boolean {
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'boolean') return v;
  return v !== '';
}

function compare(a: SheetValue, b: SheetValue): number {
  const numLike = (v: SheetValue) => typeof v !== 'string';
  // 빈 칸은 상대가 숫자면 0, 글자면 ''
  if (a === '' && numLike(b)) a = 0;
  if (b === '' && numLike(a)) b = 0;
  if (numLike(a) && numLike(b)) return toNum(a) - toNum(b);
  if (typeof a === 'string' && typeof b === 'string') {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return numLike(a) ? -1 : 1; // 숫자 < 글자
}

function evalNode(n: Node, get: CellGetter): SheetValue {
  switch (n.t) {
    case 'lit':
      return n.v;
    case 'ref':
      return cellValue(get(n.r, n.c));
    case 'range':
      throw new FormulaError(); // 범위는 함수 인자에서만
    case 'neg':
      return -toNum(evalNode(n.a, get));
    case 'bin': {
      const a = evalNode(n.a, get);
      const b = evalNode(n.b, get);
      switch (n.op) {
        case '+':
          return toNum(a) + toNum(b);
        case '-':
          return toNum(a) - toNum(b);
        case '*':
          return toNum(a) * toNum(b);
        case '/': {
          const d = toNum(b);
          const x = toNum(a);
          return d === 0 ? 0 : x / d;
        }
        case '&':
          return valueText(a) + valueText(b);
        default: {
          const c = compare(a, b);
          return n.op === '=' ? c === 0 : n.op === '<>' ? c !== 0 : n.op === '<' ? c < 0 : n.op === '>' ? c > 0 : n.op === '<=' ? c <= 0 : c >= 0;
        }
      }
    }
    case 'call':
      return callFn(n.name, n.args, get);
  }
}

/** 집계 함수 인자 → 숫자 목록 (범위 안 숫자 아닌 글자·빈 칸·불리언은 건너뜀) */
function numbersOf(args: Node[], get: CellGetter): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (a.t === 'range') {
      for (let r = a.r1; r <= a.r2; r++)
        for (let c = a.c1; c <= a.c2; c++) {
          const v = cellValue(get(r, c));
          if (typeof v === 'number') out.push(v);
        }
    } else {
      out.push(toNum(evalNode(a, get)));
    }
  }
  return out;
}

function callFn(name: string, args: Node[], get: CellGetter): SheetValue {
  switch (name) {
    case 'SUM':
      return numbersOf(args, get).reduce((x, y) => x + y, 0);
    case 'AVERAGE': {
      const ns = numbersOf(args, get);
      return ns.length ? ns.reduce((x, y) => x + y, 0) / ns.length : 0;
    }
    case 'MIN': {
      const ns = numbersOf(args, get);
      return ns.length ? Math.min(...ns) : 0;
    }
    case 'MAX': {
      const ns = numbersOf(args, get);
      return ns.length ? Math.max(...ns) : 0;
    }
    case 'ROUND': {
      if (args.length < 1 || args.length > 2) throw new FormulaError();
      const x = toNum(evalNode(args[0], get));
      const f = Math.pow(10, Math.trunc(args[1] ? toNum(evalNode(args[1], get)) : 0));
      // 엑셀처럼 0.5는 0에서 먼 쪽으로
      return (Math.sign(x) * Math.round(Number((Math.abs(x) * f).toFixed(8)))) / f;
    }
    case 'IF': {
      if (args.length < 2 || args.length > 3) throw new FormulaError();
      // 고른 쪽만 계산 — 안 고른 쪽의 오류는 무시(엑셀과 같음). 거짓값 생략 시 빈 칸
      if (truthy(evalNode(args[0], get))) return evalNode(args[1], get);
      return args[2] ? evalNode(args[2], get) : '';
    }
    default:
      throw new FormulaError();
  }
}

// ── 행·열 삽입/삭제에 따른 참조 이동 ──────────────────────

export type ShiftAction = { type: 'row_add' | 'row_del' | 'col_add' | 'col_del'; atIndex: number };

const isRowAction = (a: ShiftAction) => a.type === 'row_add' || a.type === 'row_del';
const isAdd = (a: ShiftAction) => a.type === 'row_add' || a.type === 'col_add';

/** 단일 좌표 한 축 이동 — 지워진 줄이면 null */
function shiftIndex(i: number, a: ShiftAction): number | null {
  if (isAdd(a)) return i >= a.atIndex ? i + 1 : i;
  if (i === a.atIndex) return null;
  return i > a.atIndex ? i - 1 : i;
}

/** 범위 한 축 이동 — 범위 안이나 끝 바로 다음에 넣으면 늘어남, 다 지워지면 null */
function shiftSpan(start: number, end: number, a: ShiftAction): [number, number] | null {
  const at = a.atIndex;
  if (isAdd(a)) {
    if (at <= start) return [start + 1, end + 1];
    if (at <= end + 1) return [start, end + 1];
    return [start, end];
  }
  if (at < start) return [start - 1, end - 1];
  if (at <= end) return end - 1 < start ? null : [start, end - 1];
  return [start, end];
}

function refText(t: RefTok, row: number, col: number): string {
  return `${t.colAbs ? '$' : ''}${colLetter(col)}${t.rowAbs ? '$' : ''}${row + 1}`;
}

/**
 * 행·열 삽입/삭제 시 수식의 셀 참조를 옮긴다 (엑셀처럼 $ 절대 참조도 옮기고 $ 표시는 보존)
 * - 참조 토큰만 바꾸고 공백·글자·함수 이름은 원문 그대로. 읽을 수 없는 식은 그대로 돌려줌
 */
export function shiftFormula(expression: string, action: ShiftAction): string {
  let tokens: Tok[];
  try {
    tokens = tokenize(expression);
  } catch {
    return expression;
  }
  const row = isRowAction(action);
  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];
    if (a.kind !== 'ref') continue;
    const colon = tokens[i + 1];
    const b = tokens[i + 2];
    if (colon?.kind === 'op' && colon.value === ':' && b?.kind === 'ref') {
      // 범위: 위·왼쪽 끝이 앞에 오도록 정렬해 이동
      const [p, q] = (row ? a.row <= b.row : a.col <= b.col) ? [a, b] : [b, a];
      const span = row ? shiftSpan(p.row, q.row, action) : shiftSpan(p.col, q.col, action);
      const text = !span
        ? '#REF!'
        : row
        ? `${refText(p, span[0], p.col)}:${refText(q, span[1], q.col)}`
        : `${refText(p, p.row, span[0])}:${refText(q, q.row, span[1])}`;
      edits.push({ start: a.start, end: b.end, text });
      i += 2;
      continue;
    }
    const moved = shiftIndex(row ? a.row : a.col, action);
    const text = moved === null ? '#REF!' : row ? refText(a, moved, a.col) : refText(a, a.row, moved);
    edits.push({ start: a.start, end: a.end, text });
  }
  let out = expression;
  for (let k = edits.length - 1; k >= 0; k--) {
    const e = edits[k];
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

/** 수식 계산 — 앞의 '='는 있어도 없어도 됨 */
export function evaluateFormula(expression: string, get: CellGetter): SheetValue {
  const src = expression.trim().replace(/^=/, '');
  const v = evalNode(parse(tokenize(src)), get);
  if (typeof v === 'number' && !Number.isFinite(v)) throw new FormulaError();
  return v;
}
