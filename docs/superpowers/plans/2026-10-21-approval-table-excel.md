# 결재서식 표 엑셀식 편집기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결재서식 표를 엑셀식 편집기(A1 주소·수식 직접 입력·셀 서식·테두리·자유 틀 변형)로 바꾸고, 서식 관리자와 기안자가 같은 편집기를 쓰게 한다.

**Architecture:** 표 값(JSON 문자열)을 버전 2 형식(`SheetPayload`)으로 확장한다. 예전 형식은 읽을 때 `normalizeTablePayload`로 메모리에서만 변환한다. 계산·틀 변형은 React와 무관한 순수 함수 모듈(`sheetModel.ts`, `sheetOps.ts`, `formulaEngine.ts`)에 두고 tsx 테스트로 고정한다. 화면은 편집기 `SheetEditor`(모달)와 읽기 전용 `SheetView` 두 컴포넌트로 통일한다.

**Tech Stack:** React 18 + TypeScript + Tailwind, lucide-react 아이콘. 테스트는 `node:assert/strict` + `npx tsx <파일>` (기존 `formulaEngine.test.ts` 방식, 테스트 러너 없음).

**Spec:** `docs/superpowers/specs/2026-10-21-approval-table-excel-design.md`

## Global Constraints

- 브랜치 `fix/approval-table-excel`(main 기준). 업무계획·사업관리 브랜치와 섞지 않는다. 이것만 따로 운영 배포.
- 기존 approvalForms·approvalDocs 데이터는 읽기 전용. 일괄 변환·자동 덮어쓰기 금지. 새 형식 저장은 사용자가 편집해 저장할 때만.
- 결재선 금액 연결(`amountFieldOf` → `amountNum`)은 건드리지 않는다.
- 화면에 내부 열 키·개발용 설명 문구 금지(예: "~에 저장되어 표시"). 오류 칸 표시는 `#오류`.
- 비공개 칸 설정 UI는 서식 설계 화면(`isDesignMode === true`)에만. 기안 화면에는 없음.
- 새 편집기에 합계 칸(sumCell) 지정 UI 없음. 예전 `sumCell`/`amountCells`가 있는 표는 기존 규칙(열 키에 '금액' 포함 + amountCells 합)대로 계속 계산.
- 서식 종류: 굵게, 글자색, 배경색(팔레트 토큰), 가로 정렬(left/center/right), 숫자 표시(general/currency/percent), 테두리(all/outer/thickOuter/none).
- 함수: SUM, AVERAGE, MIN, MAX, ROUND(값, 자리). 기존 `SUM(ABOVE)`, `SUM([열])`, `[행:열]`, `[표]![..]`, `[표]!D4` 계속 해석.
- 수식 도우미 버튼: `=` `+` `−` `×` `÷` `(` `)` `합계`. `×`→`*`, `÷`→`/`, `합계`→`SUM(`.
- 계산 결과는 소수 10자리에서 반올림 후 표시 형식 적용.
- 기안 작성 중 입력 시 스크롤 강제이동 회귀 금지.
- 모든 변경 후 `npx tsc --noEmit` 통과.

## Review Focus

1. **예전 계약보고서형 표(제목 행 + 머리글 병합 `startRow:-1` + 수식 + sumCell + 비공개 칸)를 열었을 때 값이 그대로** — Task 3 테스트 `legacy contract table keeps values`.
2. **예전 표의 다른 표 A1 참조(`[매출구분]!D4`)가 변환 후에도 같은 값** — Task 3 테스트 `legacy cross-table A1 ref stays equal`.
3. **기안자가 행을 넣은 뒤 비공개 칸이 다른 칸으로 바뀌지 않음** — Task 4 테스트 `insertRow shifts secret cells`.
4. **엑셀에서 복사한 여러 줄·탭 텍스트 붙여넣기 시 표 크기를 넘으면 행·열이 늘어남(값 유실 없음)** — Task 4 테스트 `pasteTsv grows sheet`.
5. **수식에 0으로 나누기·닫히지 않은 괄호·없는 함수** → 앱이 멈추지 않고 `#오류` — Task 1 테스트 `invalid formulas show error`.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/modules/gw/approval/formFields/formulaEngine.ts` (수정) | 계산. 함수·`#오류`·반올림 추가, 괄호 숫자 행 참조 이동 |
| `src/modules/gw/approval/formFields/sheetModel.ts` (신규) | `SheetPayload`·`CellStyle` 타입, `normalizeTablePayload`, `sheetSignature` |
| `src/modules/gw/approval/formFields/sheetOps.ts` (신규) | 틀 변형·서식·붙여넣기 순수 함수, 문서 내 타 표 참조 전파 |
| `src/modules/gw/approval/formFields/sheetStyle.ts` (신규) | 팔레트, `CellStyle` → CSS 변환(편집기·보기 공용) |
| `src/modules/gw/approval/formFields/SheetView.tsx` (신규) | 읽기 전용 렌더러(문서 보기·인쇄·모바일) |
| `src/modules/gw/approval/formFields/SheetEditor.tsx` (신규) | 편집기 모달: 도구 모음·수식 입력줄·격자·선택·셀 찍기 |
| `src/modules/gw/approval/formFields/TableFieldEditor.tsx` (수정) | 인라인 입력 + `SheetEditor` 열기 |
| `src/modules/gw/approval/ApprovalDocumentView.tsx`, `src/mobile/MobileApprovalDetail.tsx` (수정) | 표 렌더를 `SheetView`로 교체 |
| `src/modules/gw/approval/ApprovalDraftScreen.tsx` (수정) | 서식 마스터 업데이트 비교·반영을 normalize 기반으로 |
| `src/modules/gw/approval/formFields/TableDesignerModal.tsx` (삭제) | 사용처 없어지면 삭제 |
| 테스트: `formulaEngine.test.ts`(확장), `sheetModel.test.ts`, `sheetOps.test.ts` (같은 폴더, 신규 2개) | |

---

### Task 1: 계산 엔진 — 함수·오류·반올림

**Files:**
- Modify: `src/modules/gw/approval/formFields/formulaEngine.ts`
- Test: `src/modules/gw/approval/formFields/formulaEngine.test.ts`

**Interfaces:**
- Produces: `recalculateTableFormulas`는 시그니처 그대로. 수식 칸 결과가 오류면 그 칸 값이 문자열 `'#오류'`. `export const FORMULA_ERROR = '#오류'`. `export function roundResult(n: number): number` (소수 10자리 반올림).

- [ ] **Step 1: 테스트 추가** (`runFormulaEngineTests` 안, 12~14번)

```ts
// 12. 함수
const c = ['A','B','C','D']; const r = [{ A:'10', B:'4', C:'3', D:'' }];
const calc = (e: string) => recalculateTableFormulas(c, r, { '0:D': { expression: e, format: 'number' } })[0].D;
assert.equal(calc('=AVERAGE(A1:C1)'), '5.6666666667');
assert.equal(calc('=MIN(A1:C1)'), '3');
assert.equal(calc('=MAX(A1:C1)'), '10');
assert.equal(calc('=ROUND(A1/C1, 1)'), '3.3');
assert.equal(calc('=sum(a1:c1)*2'), '34');
// 13. 반올림
assert.equal(calc('=SUM(A1:C1)*0.1'), '1.7');
// 14. invalid formulas show error
assert.equal(calc('=A1/0'), '#오류');
assert.equal(calc('=(A1+B1'), '#오류');
assert.equal(calc('=FOO(A1)'), '#오류');
```

- [ ] **Step 2: 실패 확인** — `npx tsx src/modules/gw/approval/formFields/formulaEngine.test.ts` → 12번에서 AssertionError.
- [ ] **Step 3: 구현** — AVERAGE/MIN/MAX는 SUM 범위 처리와 같은 자리에서 범위·쉼표 인자 모두 받기. ROUND(식, 자리)는 안쪽 식을 먼저 치환한 뒤 처리. `evaluateArithmetic`이 잘못된 식(괄호 불일치, 남은 영문자, 0으로 나누기, NaN/Infinity)을 만나면 throw하고, `recalculateTableFormulas`가 잡아서 `FORMULA_ERROR`를 넣는다. 오류 칸을 참조하는 수식도 `#오류`. 정상 결과는 `roundResult` 후 `formatCellValue`.
- [ ] **Step 4: 통과 확인** — 같은 명령, `🎉 모든 formulaEngine 테스트 통과!`.
- [ ] **Step 5: 커밋** — `feat(결재서식): 표 수식 AVERAGE·MIN·MAX·ROUND, #오류 표시, 소수 오차 반올림`

### Task 2: 좌표 이동 — 괄호 숫자 행 참조·타 표 참조

**Files:**
- Modify: `src/modules/gw/approval/formFields/formulaEngine.ts` (`shiftFormulaCoordinates`)
- Test: `formulaEngine.test.ts`

**Interfaces:**
- Produces:
  - `shiftFormulaCoordinates(expression, action)` — 기존 A1·범위 이동에 더해 **같은 표의** `[2:금액]` 형태 숫자 행 참조도 이동(라벨·`LAST`는 그대로). 타 표 참조(`[X]!…`) 부분은 건드리지 않음.
  - `export function shiftCrossTableRefs(expression: string, tableNames: string[], action: ShiftAction): string` — `[X]!D4`, `[X]![2:금액]`에서 X가 `tableNames` 중 하나일 때만 이동. 지워진 칸은 `#REF!`(기존 규칙과 동일 표기, 계산 시 `#오류`).
  - `export type ShiftAction = { type: 'row_add'|'row_del'|'col_add'|'col_del'; atIndex: number }`

- [ ] **Step 1: 테스트** (15~16번)

```ts
assert.equal(shiftFormulaCoordinates('=[2:금액] - [소계:금액] + D3', { type:'row_add', atIndex:0 }), '=[3:금액] - [소계:금액] + D4');
assert.equal(shiftFormulaCoordinates('=[매출]!D4 + D4', { type:'row_add', atIndex:0 }), '=[매출]!D4 + D5');
assert.equal(shiftCrossTableRefs('=[매출]!D4 + [매입]!D4', ['매출'], { type:'row_add', atIndex:0 }), '=[매출]!D5 + [매입]!D4');
assert.equal(shiftCrossTableRefs('=[매출]![2:금액]', ['매출'], { type:'row_del', atIndex:2 }), '=#REF!');
```
- [ ] **Step 2: 실패 확인** — 15번 AssertionError.
- [ ] **Step 3: 구현** — 타 표 참조 구간을 자리표시자로 빼 두고 같은 표 좌표만 이동 후 되돌리는 방식.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(결재서식): 표 수식 좌표 이동 — 숫자 행 참조·타 표 참조`

### Task 3: 시트 모델 — 버전 2 형식과 예전 형식 변환

**Files:**
- Create: `src/modules/gw/approval/formFields/sheetModel.ts`
- Test: `src/modules/gw/approval/formFields/sheetModel.test.ts` (끝에 `if (process.argv[1]?.includes('sheetModel.test.ts')) run()` 패턴)

**Interfaces:**
- Consumes: `shiftFormulaCoordinates`, `shiftCrossTableRefs`(Task 2), `CellMerge`(utils.ts), `CellFormula`(formulaEngine)
- Produces:

```ts
export type BorderW = 'none' | 'thin' | 'thick';
export interface CellStyle {
  bold?: boolean; color?: string; bg?: string;
  align?: 'left' | 'center' | 'right';
  numFmt?: 'general' | 'currency' | 'percent';
  border?: { t?: BorderW; r?: BorderW; b?: BorderW; l?: BorderW };
}
export interface SheetPayload {
  version: 2;
  cols: string[];                         // 내부 열 키
  rows: Array<Record<string, string>>;
  colWidths: Record<string, string>;
  tableWidth: string;
  merges: CellMerge[];                    // startRow >= 0 만
  cellFormulas: Record<string, CellFormula>; // "r:colKey"
  cellStyles: Record<string, CellStyle>;     // "r:colKey"
  secretCols: string[]; secretCells: string[]; secretRows: number[]; // secretCells도 "r:colKey"
  headerValues?: Record<string, string>;  // 예전 수식 열 제목 해석용 별칭. 화면에 안 그림
  legacyHeaderRow?: boolean;              // 0번 행이 변환된 예전 제목 행 → 위쪽 합산(ABOVE/[열])에서 제외
  sumCell?: { rIdx: number; col: string } | null;          // 예전 표에만
  amountCells?: Array<{ rIdx: number; col: string }>;     // 예전 표에만
  baseSig?: string;
}
export function normalizeTablePayload(raw: unknown, fallbackCols?: string[]): SheetPayload;
export function serializeSheet(p: SheetPayload): string; // JSON, rows와 defaultRows 둘 다 기록(기존 읽기 코드 호환)
export function sheetSignature(p: SheetPayload): string; // 구조(cols 수·rows 수·cellFormulas·merges·cellStyles·secret*) 해시, 값 제외
export function recalculateSheet(p: SheetPayload, others?: Record<string, SheetPayload>): SheetPayload; // 엔진 호출 + legacyHeaderRow 반영 + 예전 sumCell 합산
```
- `normalizeTablePayload` 규칙(스펙 §6.2): `version === 2`면 그대로(빠진 필드만 기본값). 아니면 제목 행을 0번 행으로(값 = `headerValues[col] ?? col`, 서식 `{ bold: true, bg: 'gray', align: 'center' }`), 이후 모든 행 좌표 +1: cellFormulas 키·식(같은 표 `shiftFormulaCoordinates` + **모든** 타 표 참조 `shiftCrossTableRefs(expr, <식에 나온 모든 표 이름>, row_add 0)` — 예전 표는 예전 표를 기준으로 쓰였으므로), merges(-1→0), sumCell, amountCells, secretRows, secretCells(`r:cIdx` → `r+1:colKey`). `legacyHeaderRow: true`.
- `recalculateTableFormulas`에 위쪽 합산 시작 행을 넘기는 마지막 선택 인자 `opts?: { aboveStartRow?: number }` 추가(기본 0) — `recalculateSheet`가 `legacyHeaderRow`면 1을 넘김.

- [ ] **Step 1: 테스트**
  - `legacy contract table keeps values`: 기존 `formulaEngine.test.ts` 4번 계약보고서 표(제목 행 있음)에 머리글 병합 `{startRow:-1,...}`, sumCell, secretCells `['1:2']` 추가한 원본 → 원본을 기존 엔진으로 계산한 값과 `recalculateSheet(normalizeTablePayload(원본))`의 1번 행부터 값이 행마다 같음. 0번 행 = 제목 글자. secretCells = `['2:<세 번째 열 키>']`.
  - `legacy cross-table A1 ref stays equal`: 표 X(예전, `D4` 값 있음), 표 Y(예전, `=[X]!D4*2`) → 둘 다 normalize 후 `recalculateSheet(Y, {X})` 값 == 예전 엔진 값.
  - `legacy numeric header does not join sums`: 제목이 `'2026'`인 열에 `SUM(ABOVE)` → 변환 전후 같음.
  - `v2 roundtrip`: `normalizeTablePayload(JSON.parse(serializeSheet(p)))` deepEqual `p`.
  - `signature ignores values`: 값만 바꾼 두 시트의 `sheetSignature` 같음, 서식 하나 바꾸면 다름.
- [ ] **Step 2: 실패 확인** — `npx tsx src/modules/gw/approval/formFields/sheetModel.test.ts` → 모듈 없음.
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — sheetModel·formulaEngine 테스트 둘 다.
- [ ] **Step 5: 커밋** — `feat(결재서식): 표 시트 모델 — 버전 2 형식·예전 형식 읽기 변환`

### Task 4: 시트 조작 — 틀 변형·서식·붙여넣기

**Files:**
- Create: `src/modules/gw/approval/formFields/sheetOps.ts`
- Test: `src/modules/gw/approval/formFields/sheetOps.test.ts`

**Interfaces:**
- Consumes: `SheetPayload`, `CellStyle`(Task 3), `ShiftAction`·`shiftFormulaCoordinates`·`shiftCrossTableRefs`(Task 2)
- Produces (모두 새 객체 반환, 입력 불변):

```ts
export interface CellRange { r1: number; c1: number; r2: number; c2: number } // 포함, 정규화된 순서
export type BorderPreset = 'all' | 'outer' | 'thickOuter' | 'none';
export function insertRow(p: SheetPayload, at: number): SheetPayload;
export function deleteRow(p: SheetPayload, at: number): SheetPayload;
export function insertCol(p: SheetPayload, at: number): SheetPayload; // 새 열 키는 `c_` + 6자리 무작위, 기존 키와 중복 금지
export function deleteCol(p: SheetPayload, at: number): SheetPayload;
export function mergeRange(p: SheetPayload, range: CellRange): SheetPayload; // 범위 안 기존 병합 흡수, 대표 칸 외 값 비움(엑셀과 같음)
export function unmergeAt(p: SheetPayload, r: number, c: number): SheetPayload;
export function setCellValue(p: SheetPayload, r: number, c: number, text: string): SheetPayload; // '='로 시작하면 cellFormulas에, 아니면 값 + 기존 수식 제거
export function applyStyle(p: SheetPayload, range: CellRange, patch: Partial<CellStyle>): SheetPayload;
export function applyBorder(p: SheetPayload, range: CellRange, preset: BorderPreset): SheetPayload;
export function pasteTsv(p: SheetPayload, r: number, c: number, text: string): SheetPayload; // \r\n·\n 행, \t 열. 넘치면 행·열 추가
export function setSecretCell(p: SheetPayload, r: number, c: number, on: boolean): SheetPayload;
export function propagateStructureChange(
  tables: Record<string, SheetPayload>,          // 키 = 필드 key
  labels: Record<string, string>,                // 필드 key → 표 라벨
  changedKey: string, action: ShiftAction
): Record<string, SheetPayload>;                 // changedKey 이외 표들의 [라벨]!/[key]! 참조 이동
```
- 행·열 삽입/삭제는 cellFormulas(키+식), cellStyles, merges(걸치면 크기 조정, 대표 칸 삭제 시 다음 칸이 대표), secretCells/secretRows/secretCols, sumCell/amountCells, colWidths 를 함께 이동.

- [ ] **Step 1: 테스트**
  - `insertRow shifts formulas and styles`: 3행 시트, `'2:A'` 수식 `=A1+A2`, `'0:A'` 굵게 → `insertRow(p,1)` 후 `'3:A'` 수식 `=A1+A3`, `'0:A'` 그대로.
  - `insertRow shifts secret cells`: secretCells `['1:B']`, secretRows `[2]` → `insertRow(p,0)` 후 `['2:B']`, `[3]`.
  - `deleteCol shrinks merge`: 병합 `{0,0,1,3}` → `deleteCol(p,1)` 후 `{0,0,1,2}`.
  - `mergeRange keeps anchor value only`.
  - `applyBorder outer`: 2×2 범위 → 왼쪽 위 칸 `{t:'thin',l:'thin'}`, 오른쪽 아래 `{b:'thin',r:'thin'}`, 안쪽 변 없음. `thickOuter` → 'thick'. `none` → 네 칸 네 변 모두 'none'.
  - `pasteTsv grows sheet`: 2×2 시트 (1,1)에 `"a\tb\nc\td"` → 3×3, `rows[2][cols[2]] === 'd'`.
  - `setCellValue formula vs text`: `'=A1*2'` → cellFormulas 생김; 이어 `'abc'` → 수식 사라지고 값 'abc'.
  - `propagateStructureChange`: Y의 `=[X]!D4` → X에 `insertRow(_,0)` 전파 후 `=[X]!D5`.
- [ ] **Step 2: 실패 확인** — `npx tsx src/modules/gw/approval/formFields/sheetOps.test.ts`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — 세 테스트 파일 모두.
- [ ] **Step 5: 커밋** — `feat(결재서식): 표 시트 조작 — 행열 삽입삭제·병합·서식·테두리·붙여넣기`

### Task 5: 읽기 전용 렌더러 SheetView + 보기 화면 교체

**Files:**
- Create: `src/modules/gw/approval/formFields/sheetStyle.ts`, `src/modules/gw/approval/formFields/SheetView.tsx`
- Modify: `src/modules/gw/approval/ApprovalDocumentView.tsx` (약 700~800행 표 렌더 블록), `src/mobile/MobileApprovalDetail.tsx` (표 렌더 블록)

**Interfaces:**
- Consumes: `SheetPayload`, `normalizeTablePayload`(Task 3)
- Produces:
  - `sheetStyle.ts`: `export const SHEET_PALETTE: Array<{ token: string; label: string; text: string; bg: string }>` (8~10색, `gray` 포함), `export function cellCss(style?: CellStyle): React.CSSProperties`
  - `SheetView.tsx`: `export function SheetView(props: { payload: SheetPayload; hideSecret: boolean; isHalf?: boolean }): JSX.Element` — 저장된 값 그대로(재계산 안 함), 행·열 머리글 없음, 병합·서식·테두리 적용, 비공개 칸은 기존 보기 화면과 같은 가림 표시.
- 보기 화면은 지금 `cfg`(서식 placeholder)와 `parsed`(문서 값)에서 비공개 설정을 읽어 합치는 로직이 있다 — 비공개 설정의 출처는 **서식 마스터 우선**(기안자가 못 바꾸므로)으로 유지, normalize 후 `secretCells` 키 비교.

- [ ] **Step 1: 교체 전 확인용 스크린샷** — run-app 스킬로 dev에서 예전 계약보고서 결재 문서 보기·인쇄 미리보기 캡처(비교 기준).
- [ ] **Step 2: 구현** — 두 보기 화면의 표 렌더 블록을 `normalizeTablePayload` + `<SheetView>`로 교체.
- [ ] **Step 3: 확인** — `npx tsc --noEmit` 통과. 같은 문서 다시 캡처: 제목 행이 굵은 첫 줄로 보이고 값·병합·비공개 가림이 Step 1과 같음. 모바일 상세도 확인.
- [ ] **Step 4: 커밋** — `feat(결재서식): 표 보기 화면을 공통 SheetView로 — 셀 서식·테두리 표시`

### Task 6: 편집기 SheetEditor — 격자·선택·입력

**Files:**
- Create: `src/modules/gw/approval/formFields/SheetEditor.tsx`

**Interfaces:**
- Consumes: Task 3·4 함수, `cellCss`(Task 5), `colIndexToLetter`·`cellToCoord`(formulaEngine)
- Produces: `export function SheetEditor(props: { isOpen: boolean; onClose: () => void; title: string; initial: SheetPayload; others: Record<string, SheetPayload>; labels: Record<string, string>; selfKey: string; isDesignMode: boolean; onApply: (next: SheetPayload, othersPatch: Record<string, SheetPayload>) => void }): JSX.Element | null` — `othersPatch`는 `propagateStructureChange`로 바뀐 다른 표들.

- [ ] **Step 1: 구현** — 열 머리글 A·B·C(드래그로 너비 조절), 행 머리글 1·2·3, 셀 렌더(`cellCss`, 병합). 선택: 클릭=한 칸, 드래그·Shift+클릭=범위(`CellRange`). 키: 방향키, Enter 아래, Tab 오른쪽, F2·더블클릭 편집, Delete 지우기, Ctrl+B 굵게, Ctrl+V → `pasteTsv`. 편집 확정은 `setCellValue` 후 `recalculateSheet`. 머리글 우클릭 메뉴: 위/아래(왼/오른쪽)에 삽입, 삭제. 편집 상태는 모달 안 로컬 state, "적용"에서만 `onApply`.
- [ ] **Step 2: 확인** — `npx tsc --noEmit`. 임시로 TableFieldEditor의 기존 모달 자리에 연결해 run-app으로 클릭 선택·입력·행 삽입·붙여넣기 동작 캡처(Task 8에서 정식 연결).
- [ ] **Step 3: 커밋** — `feat(결재서식): 엑셀식 표 편집기 — 격자·선택·입력·행열 조작`

### Task 7: 편집기 SheetEditor — 도구 모음·수식 입력줄·셀 찍기

**Files:**
- Modify: `src/modules/gw/approval/formFields/SheetEditor.tsx`

**Interfaces:**
- Consumes: `applyStyle`, `applyBorder`, `mergeRange`, `unmergeAt`, `insertRow/Col`, `deleteRow/Col`, `setSecretCell`, `SHEET_PALETTE`

- [ ] **Step 1: 도구 모음(표 위 고정)** — 굵게 / 글자색·배경색(팔레트 팝오버) / 정렬 3종 / 병합·병합 해제 / +행 +열 / 삭제 / 숫자 표시(일반·금액·백분율; 수식 칸이면 `cellFormulas[k].format`을 currency/percent1/number로, 아니면 `cellStyles.numFmt`) / 테두리 4종. `isDesignMode`일 때만 "더보기 → 비공개 칸 지정/해제".
- [ ] **Step 2: 수식 입력줄** — 왼쪽 주소 칸(`C3`, 범위면 `B1:C4`), `fx`, 입력칸(선택 칸 원문: 수식이면 식, 아니면 값). 오른쪽 도우미 버튼 `=` `+` `−` `×` `÷` `(` `)` `합계` → 커서 위치에 `=`,`+`,`-`,`*`,`/`,`(`,`)`,`SUM(` 삽입.
- [ ] **Step 3: 셀 찍기** — 입력 중인 내용이 `=`로 시작하면 셀 클릭 = 커서 위치에 주소 삽입(선택 이동 안 함), 드래그 = `B1:B5`. 찍힌 칸은 점선 테두리로 잠시 표시. Enter로 확정, Esc로 취소.
- [ ] **Step 4: 확인** — `npx tsc --noEmit`. run-app: 키보드 없이 `=` → B1 클릭 → `−` → B2 클릭 → Enter로 차액 수식 완성; `합계` → 드래그 → `)` → Enter; 테두리 4종·색·정렬 적용 캡처.
- [ ] **Step 5: 커밋** — `feat(결재서식): 표 편집기 도구 모음·수식 입력줄·셀 찍기·수식 도우미 버튼`

### Task 8: 연결 — 서식 설계·기안 작성

**Files:**
- Modify: `src/modules/gw/approval/formFields/TableFieldEditor.tsx`, `src/modules/gw/approval/components/ApprovalDraftDocumentSheet.tsx`(약 928~940행 `TableFieldEditor` 사용부, 타 표 패치 반영), `src/modules/gw/approval/formFields/formulaEngine.ts`(`cascadeRecalculateAllTables`가 `normalizeTablePayload`/`recalculateSheet` 사용)
- Delete: `src/modules/gw/approval/formFields/TableDesignerModal.tsx` (import가 남지 않을 때)

**Interfaces:**
- Consumes: `SheetEditor`(Task 6·7), `normalizeTablePayload`·`serializeSheet`·`recalculateSheet`(Task 3)

- [ ] **Step 1: TableFieldEditor** — `parsedData`를 `normalizeTablePayload(v ?? field.placeholder, field.options)`로. 인라인 표는 `cellCss`·병합 적용, 수식 칸 읽기 전용, 일반 칸은 기존 `TableCellTextarea`로 입력(스크롤 회귀 방지 위해 그대로 유지). 행 추가/삭제 버튼은 `insertRow`/`deleteRow`(끝 위치) 사용. "표 편집" 버튼 → `SheetEditor`(`isDesignMode` 전달). 저장은 `serializeSheet`. 처음 값이 없는 기안이면 `baseSig = sheetSignature(normalize(field.placeholder))` 기록.
- [ ] **Step 2: 타 표 반영** — `SheetEditor.onApply`의 `othersPatch`를 `set`으로 같이 저장(ApprovalDraftDocumentSheet의 기존 cascade 경로 옆).
- [ ] **Step 3: 확인** — `npx tsc --noEmit`, 세 테스트 파일 통과. run-app: (a) 서식 설계에서 새 표 만들고 저장 (b) 기안 작성에서 그 서식으로 서식·수식·행열·병합 변경 → 임시저장 → 다시 열기 → 유지 (c) 기안 화면에 비공개 메뉴 없음 (d) 예전 계약보고서 서식으로 기안 시작 → 값·합계 칸 자동 합산 동작 (e) 인라인 입력 중 스크롤 튐 없음.
- [ ] **Step 4: 커밋** — `feat(결재서식): 서식 설계·기안 작성에 엑셀식 표 편집기 연결, 기존 표 편집 모달 제거`

### Task 9: 서식 마스터 업데이트 비교·반영

**Files:**
- Modify: `src/modules/gw/approval/ApprovalDraftScreen.tsx` (약 1050~1245행: 업데이트 감지 `useMemo`, `handleApplyAllMasterUpdates`)

**Interfaces:**
- Consumes: `normalizeTablePayload`, `sheetSignature`, `recalculateSheet`, `serializeSheet`

- [ ] **Step 1: 감지** — 표마다 `master = normalize(f.placeholder)`, `current = normalize(values[f.key])`. `current.baseSig`가 있으면 `sheetSignature(master) !== current.baseSig`일 때만 업데이트 있음. 없으면 `sheetSignature(master) !== sheetSignature(current)`.
- [ ] **Step 2: 반영** — 마스터 구조(cols·merges·cellFormulas·cellStyles·secret*·colWidths) + 현재 문서 값(같은 열 키·행 번호의 값) 보존, `baseSig = sheetSignature(master)`, `recalculateSheet` 후 `serializeSheet`. 확인창 문구: `서식의 최신 표 구조를 적용할까요?\n\n직접 바꾼 표 구조·서식은 서식 기준으로 바뀌고, 입력한 값은 유지됩니다.`
- [ ] **Step 3: 확인** — `npx tsc --noEmit`. run-app: 예전 문서(임시저장) 열었을 때 서식을 안 바꿨으면 안내 없음; 서식 관리자가 열 하나 추가 저장 후에는 안내 뜸 → 반영 시 값 유지.
- [ ] **Step 4: 커밋** — `fix(결재서식): 표 서식 업데이트 안내를 구조 비교로 — 기안자 변경·예전 문서에서 계속 뜨던 문제`

### Task 10: 마무리 검증

- [ ] **Step 1:** `npx tsx` 세 테스트 파일, `npm run build` 통과.
- [ ] **Step 2:** `grep -rn "TableDesignerModal\|headerValues\[" src` — 보기·편집 화면에서 headerValues를 그리는 코드가 남지 않았는지(엔진·sheetModel 별칭 해석 제외).
- [ ] **Step 3:** run-app 종합: 서식 설계 → 기안(서식·수식·도우미 버튼·테두리·붙여넣기) → 상신 → PC 문서 보기·인쇄 미리보기·모바일 상세. 예전 서식·예전 문서 열기. 화면에 내부 열 키(`c_xxxxxx`)나 개발용 문구 없음.
- [ ] **Step 4:** 사용자에게 결과·스크린샷 보고, 운영 배포(업무 시간 외 + 새로고침 공지)는 사용자 지시 후.
