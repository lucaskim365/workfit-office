# 시트 서식 1단계 — 시트 모델·수식 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서식 전체를 한 장의 시트로 담는 문서 시트 모델(v3)과, IF·비교·문자열 결합을 지원하는 시트 전용 수식 계산기를 만든다. 화면 변화 없음.

**Architecture:** 기존 표 필드(v2)용 `formulaEngine.ts`·`sheetModel.ts`는 건드리지 않는다(기존 서식 회귀 0). 문서 시트 수식은 새 파일 `sheetFormula.ts`(토큰화 → 재귀 하강 파서 → 값 계산)로 계산하고, 모델은 새 파일 `docSheet.ts`에 둔다. 행·열 조작(`sheetOps.ts`)은 v2·v3를 같이 받도록 제네릭으로 넓히고, v3면 새 칸 속성(입력 칸·칸 이름·데이터 불러오기·잠금·행 높이)도 함께 옮긴다.

**Tech Stack:** TypeScript, node:test(`npx tsx --test`), React 화면 없음(서식 표시 함수 `sheetStyle.ts`만).

**Spec:** `docs/superpowers/specs/2026-10-21-sheet-approval-form-design.md` (§5.1, §5.2, §5.6의 행·열 삭제 금지 규칙, §5.3-7의 이름 칸 수식 금지)

## Global Constraints

- 기존 `approvalForms`·`approvalDocs` 데이터는 읽기 전용. 이 단계는 DB를 건드리지 않는다.
- 기존 표 필드 경로(`formulaEngine.ts`의 `recalculateTableFormulas`, `sheetModel.ts`의 v2 함수)의 동작은 바이트 단위로 같아야 한다 — 기존 테스트(`formulaEngine.test.ts`·`sheetModel.test.ts`·`sheetOps.test.ts`·`sheetStyle.test.ts`) 전부 통과.
- 수식 오류 표시는 `#오류`(`FORMULA_ERROR` 재사용), 0으로 나누기는 0.
- 열 키는 화면에 보이지 않는 내부 키, 주소(A1)는 위치로 계산.
- 엑셀 색은 그대로 저장 — 글자색·배경색에 `#rrggbb` 허용(팔레트 토큰도 계속 지원).
- 새 테스트 파일은 `node:test` 방식(`import test from 'node:test'`), 실행은 `npx tsx --test <파일>`.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. 문자열 안의 셀 주소 모양 글자(`"A1 참조"`)가 행·열 삽입 때 바뀌거나 셀 참조로 계산되면 안 된다 → Task 1 테스트 `문자열 안의 주소는 참조가 아니다`, Task 2 테스트 `문자열 안 주소는 이동하지 않는다`.
2. 엑셀에서 온 절대 참조 `$A$1`·`A$1`이 계산되고, 행 삽입 때 `$` 표시를 보존한 채 이동해야 한다 → Task 2 테스트 `절대 참조 이동 시 $ 보존`.
3. 수식끼리 서로 참조하는 순환(`A1=B1`, `B1=A1`)에서 무한 루프 없이 0으로 끝나야 한다(현행 규칙) → Task 3 테스트 `순환 참조는 0`.
4. 칸 이름·데이터 불러오기·직인·비공개가 든 행·열을 지우려 하면 막혀야 하고, 행을 넣으면 이 설정들이 칸을 따라 내려가야 한다 → Task 4 테스트 `행 삽입 시 v3 속성 이동`, `연동 칸 든 행 삭제 금지`.
5. 숫자처럼 보이는 글자(`1,200`, `₩3,000`)는 숫자로, 빈 칸은 산술에서 0·결합에서 빈 글자로 → Task 1 테스트 `빈 칸과 콤마 숫자`.

---

## File Structure

| 파일 | 책임 |
|---|---|
| Create `src/modules/gw/approval/formFields/sheetFormula.ts` | 시트 수식 토큰화·파싱·계산(`evaluateSheetFormula`), 행·열 이동(`shiftSheetFormula`) |
| Create `src/modules/gw/approval/formFields/sheetFormula.test.ts` | 위 테스트 |
| Create `src/modules/gw/approval/formFields/docSheet.ts` | `DocSheet` 타입, 생성·읽기·저장·재계산·구조 해시, 행·열 삭제 금지 판정 |
| Create `src/modules/gw/approval/formFields/docSheet.test.ts` | 위 테스트 + v3 행·열 조작 테스트 |
| Modify `src/modules/gw/approval/formFields/sheetOps.ts` | 제네릭화, v3 속성 이동, 이름 칸 수식 금지 |
| Modify `src/modules/gw/approval/formFields/sheetModel.ts:17-26` | `CellStyle`에 `fontSize`·`italic`·`underline`·`valign` 추가, color/bg 주석에 `#hex` 허용 명시 |
| Modify `src/modules/gw/approval/formFields/sheetStyle.ts:31-49` | `cellCss`가 `#hex` 색·새 서식 항목 처리 |
| Modify `src/modules/gw/approval/formFields/sheetStyle.test.ts` | 위 테스트 추가 |

---

### Task 1: 시트 수식 계산기 (`sheetFormula.ts`)

**Files:**
- Create: `src/modules/gw/approval/formFields/sheetFormula.ts`
- Test: `src/modules/gw/approval/formFields/sheetFormula.test.ts`

**Interfaces:**
- Consumes: `formulaEngine.ts`의 `letterToColIndex`, `colIndexToLetter`, `roundResult`, `ShiftAction`(타입) — 기존 export.
- Produces:
  - `export type SheetValue = number | string | boolean;` (빈 칸은 `''`)
  - `export type CellGetter = (r: number, c: number) => SheetValue;` — 0-based 좌표의 **계산된** 값을 돌려줌(병합·수식 해석은 호출자 책임)
  - `export class SheetFormulaError extends Error {}`
  - `export function evaluateSheetFormula(expression: string, get: CellGetter): SheetValue` — 잘못된 식은 `SheetFormulaError` throw. 앞의 `=`는 있어도 없어도 됨.
  - `export function sheetValueText(v: SheetValue): string` — 칸에 쓸 글자: 숫자는 `String(roundResult(n))`, 불리언은 `TRUE`/`FALSE`, 글자는 그대로.
  - `export function parseSheetNumber(text: string): number | null` — 칸 글자 → 숫자. 공백·`,`·`₩` 제거 후 숫자면 숫자, 끝이 `%`면 ÷100, 그 외·빈 글자는 `null`.

문법(우선순위 낮은 것부터): 비교 `= <> < > <= >=` → 결합 `&` → `+ -` → `* /` → 단항 `-` → 기본(숫자, `"글자"`(따옴표 두 번 `""`는 따옴표 한 개), `TRUE`/`FALSE`, 셀 `A1`·`$A$1`, 범위 `A1:B3`(함수 인자에서만), 함수 호출, 괄호). 함수 이름·셀 주소는 대소문자 무시.

값 규칙:
- 칸에서 읽은 값(getter 결과)이 글자이고 `parseSheetNumber`로 숫자가 되면 숫자로 취급(칸 값은 모두 글자로 저장되므로). 수식 안 `"…"` 글자는 변환하지 않음.
- 산술(`+ - * /`, 단항 `-`): 빈 칸 0, 불리언 1/0, 글자는 `parseSheetNumber`로 숫자가 되면 숫자, 안 되면 `SheetFormulaError`. `/ 0` 은 0.
- `&`: 숫자는 `sheetValueText`, 빈 칸 `''`.
- 비교: 둘 다 숫자(빈 칸은 상대가 숫자면 0)면 수 비교, 둘 다 글자면 대소문자 무시 비교, 섞이면 숫자 < 글자. 결과 불리언.
- 함수: `SUM`·`AVERAGE`·`MIN`·`MAX` — 인자의 범위는 펼치되 범위 안에서 숫자로 읽히지 않는 글자·빈 칸은 건너뜀(엑셀과 같음), 직접 인자는 산술 규칙; 숫자가 하나도 없으면 0. `ROUND(x, [자리])`. `IF(조건, 참값, [거짓값])` — 거짓값 생략 시 `''`(서식에서 FALSE가 찍히지 않게); 조건은 숫자 0·빈 칸·FALSE·`''`가 거짓. 그 외 함수 이름·`#REF!`·남은 토큰은 `SheetFormulaError`.

- [ ] **Step 1: 실패하는 테스트 작성** — `sheetFormula.test.ts`, 시트는 `const grid = [['10','20',''],['A','1,200','₩3,000']]; const get = (r,c) => grid[r]?.[c] ?? '';`(실제 계산된 값 대신 글자 그대로; 숫자 해석은 계산기가 함)

```ts
test('사칙연산과 우선순위', () => {
  assert.equal(evaluateSheetFormula('=A1+B1*2', get), 50);
  assert.equal(evaluateSheetFormula('=(A1+B1)/3', get), 10);
  assert.equal(evaluateSheetFormula('=-A1+5', get), -5);
  assert.equal(evaluateSheetFormula('=A1/0', get), 0);
});
test('빈 칸과 콤마 숫자', () => {
  assert.equal(evaluateSheetFormula('=C1+1', get), 1);
  assert.equal(evaluateSheetFormula('=B2+C2', get), 4200);
  assert.equal(evaluateSheetFormula('="["&C1&"]"', get), '[]');
});
test('글자 산술은 오류', () => {
  assert.throws(() => evaluateSheetFormula('=A2+1', get), SheetFormulaError);
});
test('함수와 범위 — 범위 안 글자는 건너뜀', () => {
  assert.equal(evaluateSheetFormula('=SUM(A1:C2)', get), 4230);
  assert.equal(evaluateSheetFormula('=average(A1:B1)', get), 15);
  assert.equal(evaluateSheetFormula('=MAX(A1,B1,5)', get), 20);
  assert.equal(evaluateSheetFormula('=ROUND(10/3,2)', get), 3.33);
  assert.equal(evaluateSheetFormula('=SUM(C1:C1)', get), 0);
});
test('비교와 IF', () => {
  assert.equal(evaluateSheetFormula('=A1<B1', get), true);
  assert.equal(evaluateSheetFormula('=A2="a"', get), true);
  assert.equal(evaluateSheetFormula('=A1<>10', get), false);
  assert.equal(evaluateSheetFormula('=IF(B1>A1,"큼","작음")', get), '큼');
  assert.equal(evaluateSheetFormula('=IF(A1>B1,"큼")', get), '');
  assert.equal(evaluateSheetFormula('=IF(C1,1,2)', get), 2);
});
test('결합', () => {
  assert.equal(evaluateSheetFormula('=A1&"원"', get), '10원');
  assert.equal(evaluateSheetFormula('=A1+B1&"원"', get), '30원');
  assert.equal(evaluateSheetFormula('="say ""hi"""', get), 'say "hi"');
});
test('문자열 안의 주소는 참조가 아니다', () => {
  assert.equal(evaluateSheetFormula('="A1 참조"', get), 'A1 참조');
});
test('절대 참조', () => {
  assert.equal(evaluateSheetFormula('=$A$1+A$1+$B1', get), 40);
});
test('잘못된 식', () => {
  for (const e of ['=SUM(', '=A1+', '=FOO(1)', '=#REF!+1', '=A1 B1', '=VLOOKUP(A1,A1:B2,2)'])
    assert.throws(() => evaluateSheetFormula(e, get), SheetFormulaError, e);
});
test('parseSheetNumber / sheetValueText', () => {
  assert.equal(parseSheetNumber(' 1,200 '), 1200);
  assert.equal(parseSheetNumber('10%'), 0.1);
  assert.equal(parseSheetNumber(''), null);
  assert.equal(parseSheetNumber('abc'), null);
  assert.equal(sheetValueText(0.1 + 0.2), '0.3');
  assert.equal(sheetValueText(true), 'TRUE');
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx tsx --test src/modules/gw/approval/formFields/sheetFormula.test.ts` / Expected: FAIL (모듈 없음)

- [ ] **Step 3: `sheetFormula.ts` 구현** — 토큰화(숫자·글자·참조·범위·이름·연산자·`,`·괄호, 모르는 글자는 오류) 후 위 우선순위의 재귀 하강 파서가 바로 값을 계산한다(AST 저장 불필요). 범위 토큰은 함수 인자 자리에서만 허용하고 그 외 위치면 오류. `eval`·`Function` 금지. 파서 끝에 토큰이 남으면 오류.

- [ ] **Step 4: 통과 확인** — 같은 명령, Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/modules/gw/approval/formFields/sheetFormula.ts src/modules/gw/approval/formFields/sheetFormula.test.ts
git commit -m "feat(결재서식): 시트 서식 수식 계산기 — IF·비교·문자열 결합"
```

### Task 2: 시트 수식 행·열 이동 (`shiftSheetFormula`)

**Files:**
- Modify: `src/modules/gw/approval/formFields/sheetFormula.ts`
- Test: `src/modules/gw/approval/formFields/sheetFormula.test.ts`

**Interfaces:**
- Consumes: Task 1의 토큰화 함수(모듈 내부).
- Produces: `export function shiftSheetFormula(expression: string, action: ShiftAction): string` — 토큰 단위로 참조만 고치고 나머지 글자는 원문 그대로 이어 붙인다(공백·대소문자·글자 보존). 이동 규칙은 기존 `shiftFormulaCoordinates`와 같다: 단일 참조는 삽입 위치 이상이면 +1, 삭제된 행·열을 가리키면 그 참조를 `#REF!`로; 범위는 시작 앞 삽입이면 통째로 이동, 범위 안 또는 끝 바로 다음 삽입이면 끝 확장, 삭제 시 줄이고 다 지워지면 `#REF!`. `$`는 이동과 무관하게 원래 자리에 보존(엑셀도 삽입 시 절대 참조를 옮김). 토큰화가 실패하는 식은 원문 그대로 돌려준다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test('행 삽입·삭제 이동', () => {
  assert.equal(shiftSheetFormula('=A1+A3', { type: 'row_add', atIndex: 1 }), '=A1+A4');
  assert.equal(shiftSheetFormula('=SUM(B2:B4)', { type: 'row_add', atIndex: 4 }), '=SUM(B2:B5)');
  assert.equal(shiftSheetFormula('=A2*2', { type: 'row_del', atIndex: 1 }), '=#REF!*2');
  assert.equal(shiftSheetFormula('=SUM(A2:A2)', { type: 'row_del', atIndex: 1 }), '=SUM(#REF!)');
});
test('열 이동', () => {
  assert.equal(shiftSheetFormula('=B1&C1', { type: 'col_add', atIndex: 1 }), '=C1&D1');
  assert.equal(shiftSheetFormula('=C1', { type: 'col_del', atIndex: 0 }), '=B1');
});
test('절대 참조 이동 시 $ 보존', () => {
  assert.equal(shiftSheetFormula('=$A$2+A$2', { type: 'row_add', atIndex: 0 }), '=$A$3+A$3');
});
test('문자열 안 주소는 이동하지 않는다', () => {
  assert.equal(shiftSheetFormula('=IF(A2>0,"A2 확인","")', { type: 'row_add', atIndex: 0 }), '=IF(A3>0,"A2 확인","")');
});
test('함수 이름·공백 보존', () => {
  assert.equal(shiftSheetFormula('=round( A1 , 2 )', { type: 'row_add', atIndex: 0 }), '=round( A2 , 2 )');
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx tsx --test src/modules/gw/approval/formFields/sheetFormula.test.ts` / Expected: FAIL (`shiftSheetFormula` 없음)
- [ ] **Step 3: 구현** — 토큰에 원문 위치(start/end)를 기록해 두고 참조·범위 토큰만 치환.
- [ ] **Step 4: 통과 확인** — 같은 명령, 전부 PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(결재서식): 시트 수식 행·열 이동 — 문자열·절대 참조 보존"`

### Task 3: 문서 시트 모델 (`docSheet.ts`)

**Files:**
- Create: `src/modules/gw/approval/formFields/docSheet.ts`
- Test: `src/modules/gw/approval/formFields/docSheet.test.ts`

**Interfaces:**
- Consumes: Task 1 `evaluateSheetFormula`, `sheetValueText`, `parseSheetNumber`, `SheetFormulaError`; `formulaEngine.ts`의 `CellFormula`·`FORMULA_ERROR`; `sheetModel.ts`의 `CellStyle`; `utils.ts`의 `CellMerge`.
- Produces:

```ts
export type CellInputType =
  | 'text' | 'multiline' | 'number' | 'currency' | 'date' | 'dateRange'
  | 'select' | 'multiSelect' | 'checkbox' | 'user' | 'dept';
export interface CellInput { type: CellInputType; options?: string[] } // options: select·multiSelect만
export type BindSource =
  | 'company.name' | 'company.bizNo' | 'company.ceo' | 'company.address' | 'company.phone' | 'company.fax'
  | 'draft.drafter' | 'draft.dept' | 'draft.date';
export interface DocSheetMeta { replaces?: string } // 대체할 기존 서식 code = 연동 유형
export interface DocSheet {
  version: 3;
  cols: string[];
  rows: Array<Record<string, string>>;
  colWidths: Record<string, string>;   // 열 키 → '96px'
  rowHeights: Record<string, string>;  // 행 번호 → '28px'
  merges: CellMerge[];
  cellFormulas: Record<string, CellFormula>; // "r:colKey"
  cellStyles: Record<string, CellStyle>;
  secretCols: string[]; secretCells: string[]; secretRows: number[];
  cellInputs: Record<string, CellInput>;
  cellNames: Record<string, string>;   // "r:colKey" → 칸 이름(연동 키)
  cellBinds: Record<string, BindSource>;
  cellLocks: string[];                 // "r:colKey"
  meta: DocSheetMeta;
  baseSig?: string;
}
export const DOC_SHEET_DEFAULT_COL_WIDTH = '96px';
export function createDocSheet(rowCount?: number, colCount?: number): DocSheet; // 기본 30행 × 8열, 열 키는 sheetOps의 무작위 키 규칙(`c_xxxxxx`)
export function parseDocSheet(raw: unknown): DocSheet | null; // 문자열 JSON·객체, version !== 3 이거나 cols/rows 없으면 null; 빠진 맵은 빈 값으로 채움
export function serializeDocSheet(s: DocSheet): string;       // JSON.stringify — defaultRows 없음
export function recalculateDocSheet(s: DocSheet): DocSheet;
export function docSheetSignature(s: DocSheet): string;        // 값·열 너비·행 높이 제외 구조 해시 (sheetSignature와 같은 djb2 방식)
```

`recalculateDocSheet` 규칙: 모든 수식 칸을 메모이즈해 계산. `CellGetter`는 (1) 병합 대표 칸 치환을 하지 않는다 — 엑셀처럼 병합에 가려진 칸은 빈 칸으로 읽힌다(`mergeRange`가 값을 지워 둠). 기존 v2의 `toMergeAnchor` 규칙과 다르다는 점을 `docSheet.ts` 주석에 남긴다 (2) 그 칸에 수식이 있으면 재귀 계산, 계산 중인 칸을 다시 만나면 0(순환), 오류 칸을 참조하면 그 칸도 오류 (3) 아니면 칸 글자. 결과는 `sheetValueText`로, 오류는 `FORMULA_ERROR`로 `rows`에 기록. 시트 밖 좌표는 빈 칸.

- [ ] **Step 1: 실패하는 테스트 작성** — 헬퍼 `grid(values: string[][]): DocSheet`(createDocSheet로 만들고 값 채움)

```ts
test('createDocSheet 기본 크기와 빈 맵', () => {
  const s = createDocSheet();
  assert.equal(s.version, 3);
  assert.equal(s.rows.length, 30);
  assert.equal(s.cols.length, 8);
  assert.equal(new Set(s.cols).size, 8);
  assert.deepEqual([s.cellNames, s.cellBinds, s.cellLocks, s.meta], [{}, {}, [], {}]);
});
test('parseDocSheet — v2 표·잘못된 값은 null, 저장 왕복', () => {
  assert.equal(parseDocSheet('{"version":2,"cols":["a"],"rows":[]}'), null);
  assert.equal(parseDocSheet('not json'), null);
  assert.equal(parseDocSheet(undefined), null);
  const s = { ...createDocSheet(2, 2), meta: { replaces: '휴가' } };
  assert.deepEqual(parseDocSheet(serializeDocSheet(s)), s);
  const partial = parseDocSheet(JSON.stringify({ version: 3, cols: ['x'], rows: [{ x: '1' }] }))!;
  assert.deepEqual(partial.cellInputs, {});
  assert.deepEqual(partial.rowHeights, {});
});
test('재계산 — 수식 연쇄·IF·오류', () => {
  // A1=10, B1=20, C1==A1+B1, A2==C1*2, B2==IF(A2>50,"초과","이내"), C2==A1+"x"
  ... // cellFormulas로 지정
  const r = recalculateDocSheet(s);
  assert.equal(val(r, 0, 2), '30');
  assert.equal(val(r, 1, 0), '60');
  assert.equal(val(r, 1, 1), '초과');
  assert.equal(val(r, 1, 2), '#오류');
});
test('순환 참조는 0', () => {
  // A1==B1, B1==A1+1
  const r = recalculateDocSheet(s);
  assert.equal(val(r, 0, 1), '1');
});
test('오류 칸을 참조하면 오류', () => {
  // A1==1/"x"... 대신 A1=="x"+1, B1==A1*2
  assert.equal(val(recalculateDocSheet(s), 0, 1), '#오류');
});
test('docSheetSignature — 값·너비 변화엔 그대로, 칸 이름 변화엔 바뀜', () => {
  const s = createDocSheet(2, 2);
  const sig = docSheetSignature(s);
  const k = `0:${s.cols[0]}`;
  assert.equal(docSheetSignature({ ...s, rows: [{ ...s.rows[0], [s.cols[0]]: '값' }, s.rows[1]], colWidths: { [s.cols[0]]: '200px' } }), sig);
  assert.notEqual(docSheetSignature({ ...s, cellNames: { [k]: 'amount' } }), sig);
});
```

(`val(s, r, c) = s.rows[r][s.cols[c]]`)

- [ ] **Step 2: 실패 확인** — Run: `npx tsx --test src/modules/gw/approval/formFields/docSheet.test.ts` / Expected: FAIL (모듈 없음)
- [ ] **Step 3: `docSheet.ts` 구현** — `createDocSheet`의 열 키 생성을 위해 `sheetOps.ts`의 `newColKey`를 `export`로 바꿔 재사용.
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(결재서식): 문서 시트 모델 v3 — 입력 칸·칸 이름·데이터 불러오기·잠금·행 높이"`

### Task 4: 행·열 조작을 v3까지 (`sheetOps.ts` 제네릭화)

**Files:**
- Modify: `src/modules/gw/approval/formFields/sheetOps.ts`
- Modify: `src/modules/gw/approval/formFields/docSheet.ts` (삭제 금지 판정 추가)
- Test: `src/modules/gw/approval/formFields/docSheet.test.ts`

**Interfaces:**
- Consumes: Task 2 `shiftSheetFormula`, Task 3 `DocSheet`.
- Produces:
  - `sheetOps.ts`에 `export type SheetLike = SheetPayload | DocSheet;` 그리고 `insertRow`·`deleteRow`·`insertCol`·`deleteCol`·`mergeRange`·`unmergeAt`·`setCellValue`·`applyStyle`·`applyBorder`·`pasteTsv`·`setSecretCell`을 `<T extends SheetLike>(p: T, …): T`로. 기존 호출부(SheetEditor·TableFieldEditor)는 타입 변경 없이 컴파일돼야 함. `propagateStructureChange`는 v2 전용으로 그대로.
  - 수식 이동 함수 선택: `p.version === 3`이면 `shiftSheetFormula`, 아니면 기존 `shiftFormulaCoordinates`.
  - v3일 때 행 삽입·삭제: `rowHeights`(행 번호 키), `cellInputs`·`cellNames`·`cellBinds`(r:col 키), `cellLocks`(키 목록)을 `cellStyles`와 같은 규칙으로 이동·삭제. 열 삭제: 같은 맵에서 그 열 키 제거. 열 삽입은 키가 그대로라 이동 불필요.
  - `setCellValue`: v3에서 `cellNames`가 붙은 칸이면 `=`로 시작해도 수식이 아니라 값으로 저장(spec §5.3-7).
  - `docSheet.ts`에 `export function isStructureLocked(s: DocSheet, axis: 'row' | 'col', index: number): boolean` — 그 행/열에 `cellNames`·`cellBinds`·`secretCells` 키가 있거나, `cellStyles`의 `seal: true` 칸이 있거나, `secretRows`(행)/`secretCols`(열)에 들어 있으면 true. 화면 문구("연동된 칸이 있어 지울 수 없습니다")는 4단계 화면 작업에서 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성** (`docSheet.test.ts`에 추가)

```ts
test('행 삽입 시 v3 속성 이동', () => {
  const s0 = createDocSheet(3, 2);
  const [a, b] = s0.cols;
  const s = { ...s0, rowHeights: { '1': '40px' }, cellNames: { [`1:${a}`]: 'amount' },
    cellBinds: { [`2:${b}`]: 'company.name' as const }, cellInputs: { [`1:${a}`]: { type: 'currency' as const } },
    cellLocks: [`0:${a}`, `2:${a}`], cellFormulas: { [`0:${b}`]: { expression: '=A2*2' } } };
  const n = insertRow(s, 1);
  assert.deepEqual(n.rowHeights, { '2': '40px' });
  assert.deepEqual(n.cellNames, { [`2:${a}`]: 'amount' });
  assert.deepEqual(n.cellBinds, { [`3:${b}`]: 'company.name' });
  assert.deepEqual(n.cellInputs, { [`2:${a}`]: { type: 'currency' } });
  assert.deepEqual(n.cellLocks.sort(), [`0:${a}`, `3:${a}`].sort());
  assert.equal(n.cellFormulas[`0:${b}`].expression, '=A3*2');
  assert.equal(n.version, 3);
});
test('행·열 삭제 시 v3 속성 제거', () => {
  // 위 s에서 deleteRow(s, 1) → cellNames·cellInputs·rowHeights 비고, cellBinds는 '1:b'로
  // deleteCol(s, 0) → cellNames·cellInputs·cellLocks의 a 열 키 제거
});
test('v3 문자열 안 주소는 행 삽입에도 그대로', () => {
  // cellFormulas { '0:b': '="A2"&A2' } → insertRow(s,0) 후 '1:b' 수식 '="A2"&A3'
});
test('이름 붙은 칸에는 수식이 들어가지 않는다', () => {
  // cellNames { '0:a': 'amount' } → setCellValue(s,0,0,'=1+1') → rows[0][a] === '=1+1', cellFormulas에 키 없음
});
test('연동 칸 든 행 삭제 금지', () => {
  // cellNames on row 1 → isStructureLocked(s,'row',1) true, 'row',0 false
  // cellBinds on col b → 'col',1 true
  // cellStyles seal on 2:a → 'row',2 true; secretRows [0] → 'row',0 true; secretCols [a] → 'col',0 true
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx tsx --test src/modules/gw/approval/formFields/docSheet.test.ts` / Expected: FAIL
- [ ] **Step 3: 구현** — `sheetOps.ts` 제네릭화 + v3 맵 이동, `docSheet.ts`에 `isStructureLocked`.
- [ ] **Step 4: 통과 + 기존 회귀 확인**
  - `npx tsx --test src/modules/gw/approval/formFields/docSheet.test.ts` → PASS
  - `npx tsx src/modules/gw/approval/formFields/sheetOps.test.ts` → 끝에 `🎉` 통과 메시지, 오류 없음
  - `npx tsx src/modules/gw/approval/formFields/sheetModel.test.ts` → 통과 메시지
  - `npx tsc --noEmit` → 오류 0
- [ ] **Step 5: 커밋** — `git commit -m "feat(결재서식): 시트 행·열 조작을 문서 시트까지 — v3 칸 속성 이동, 연동 칸 행·열 삭제 금지"`

### Task 5: 셀 서식 — 엑셀 색·글꼴 (`sheetStyle.ts`)

**Files:**
- Modify: `src/modules/gw/approval/formFields/sheetModel.ts:17-26`
- Modify: `src/modules/gw/approval/formFields/sheetStyle.ts`
- Test: `src/modules/gw/approval/formFields/sheetStyle.test.ts`

**Interfaces:**
- Produces: `CellStyle`에 `fontSize?: number`(pt), `italic?: boolean`, `underline?: boolean`, `valign?: 'top' | 'middle' | 'bottom'` 추가. `color`·`bg`는 팔레트 토큰 또는 `#rrggbb`. `cellCss`: `#` 로 시작하는 6자리 16진 색은 그대로 `color`/`backgroundColor`(배경만 지정 시 글자색 `#1a1a1a` 규칙은 토큰과 같음), `fontSize` → `${n}pt`, `italic` → `fontStyle: 'italic'`, `underline` → `textDecoration: 'underline'`, `valign` → `verticalAlign`. 잘못된 색 글자(`#12`, `red;x`)는 무시.

- [ ] **Step 1: 실패하는 테스트 작성** (`sheetStyle.test.ts` 파일 방식 그대로 추가)

```ts
assert.deepEqual(cellCss({ color: '#FF0000', bg: '#00ff00' }), { color: '#FF0000', backgroundColor: '#00ff00' });
assert.deepEqual(cellCss({ bg: '#eeeeee' }), { backgroundColor: '#eeeeee', color: '#1a1a1a' });
assert.deepEqual(cellCss({ color: 'red;x', bg: '#12' }), {});
assert.deepEqual(cellCss({ fontSize: 14, italic: true, underline: true, valign: 'middle' }),
  { fontSize: '14pt', fontStyle: 'italic', textDecoration: 'underline', verticalAlign: 'middle' });
assert.equal(cellCss({ color: 'red' }).color, '#c62828'); // 기존 토큰 유지
```

- [ ] **Step 2: 실패 확인** — Run: `npx tsx src/modules/gw/approval/formFields/sheetStyle.test.ts` / Expected: assert 실패
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — 같은 명령 통과, `npx tsc --noEmit` 오류 0
- [ ] **Step 5: 커밋** — `git commit -m "feat(결재서식): 셀 서식에 엑셀 색(#hex)·글자 크기·기울임·밑줄·세로 정렬"`

### Task 6: 단계 마무리 검증

- [ ] **Step 1:** `npx tsx --test $(git ls-files '*.test.ts' '*.test.tsx' '*.test.mjs')` → `fail 0` (현재 474 + 새 테스트)
- [ ] **Step 2:** 기존 실행형 테스트 4개(`formulaEngine`·`sheetModel`·`sheetOps`·`sheetStyle`)를 `npx tsx <파일>`로 실행 → 모두 통과 메시지
- [ ] **Step 3:** `npm run build` → 성공
- [ ] **Step 4:** 화면 변화가 없으므로 운영 배포는 2단계와 함께(사용자 판단). 브랜치 `feat/sheet-form-model` 커밋 상태로 보고.
