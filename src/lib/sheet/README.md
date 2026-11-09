# 엑셀 편집기 모듈 (`src/lib/sheet`)

엑셀처럼 셀 단위로 값·병합·서식·수식을 다루는 시트 모듈입니다. 전자결재 시트 서식에서 쓰고, 다른 프로젝트에서도 그대로 가져다 쓸 수 있게 만들었습니다.

## 경계 규칙

- 이 폴더 안 파일은 **같은 폴더 파일(`./…`)과 `react`만** 불러옵니다. 프로젝트 별칭(`@/…`)이나 폴더 밖 코드는 불러오지 않습니다. `boundary.test.ts`가 이를 검사합니다.
- 바깥에서는 `index.ts`(`@/lib/sheet`)로만 불러옵니다.
- 업무 의미(예: 결재 칸 이름, 비공개, 직인)는 이 모듈에 넣지 않고, 쓰는 쪽에서 **부가 정보 이름공간**으로 얹습니다.

## 다른 프로젝트로 옮기기

폴더를 통째로 복사하면 됩니다. 패키지로 만들 때는 `react`를 peer 의존성으로 두면 됩니다. 테스트는 `node:test` 방식이며 `npx tsx --test src/lib/sheet/*.test.ts`로 실행합니다.

## 데이터 구조 (`Sheet`)

| 항목 | 내용 |
|---|---|
| `cols` | 내부 열 키 목록(화면에 안 보임). 주소 A·B·C는 위치로 계산 |
| `rows` | 행마다 `{열키: 글자}`. 수식 칸에는 계산 결과가 들어 있음 |
| `colWidths` / `rowHeights` | 열 키 → px / 행 번호 → px |
| `merges` | 병합 블록(시작 행·열, 행·열 수) |
| `formulas` | `"행:열키"` → `'=A1+B1'` |
| `styles` | `"행:열키"` → 굵게·기울임·밑줄·글자 크기(pt)·글자/배경색(`#rrggbb`)·정렬·숫자 표시·테두리 |
| `cellMeta` / `rowMeta` / `colMeta` | 부가 정보. `이름공간 → 키 → 값`. 키는 각각 `"행:열키"` / 행 번호 / 열 키 |

부가 정보는 모듈이 뜻을 모르는 자유 값입니다. 행·열을 넣거나 지우면 모듈이 키를 함께 옮기거나 지웁니다.

```ts
import { createSheet, setCellMeta, insertRow } from '@/lib/sheet';

let s = createSheet(10, 5);
s = setCellMeta(s, 'name', 2, 1, 'amount'); // B3 칸에 'name' 이름공간 값
s = insertRow(s, 0);                         // 값은 B4로 따라 내려감
```

## 공개 API

- 수식: `evaluateFormula`, `shiftFormula`, `parseNumber`, `valueText`, `colLetter`, `colIndex`, `FormulaError`, `FORMULA_ERROR`
- 데이터: `createSheet`, `parseSheet`, `serializeSheet`, `recalculate`, `sheetSignature`, `cellKey`, `newColKey`
- 조작(모두 새 시트를 돌려주는 순수 함수): `insertRow`, `deleteRow`, `insertCol`, `deleteCol`, `mergeRange`, `unmergeAt`, `setCellValue`, `applyStyle`, `applyBorder`, `pasteTsv`(옵션: 늘리지 않기·칸별 쓰기/수식 허용), `setCellMeta`, `setRowMeta`, `setColMeta`
- 표시: `cellCss`, `displayValue`, `defaultAlign`, `SHEET_COLORS`
- 엑셀 불러오기: `importXlsx(bytes)` → `{ sheet, warnings }` — 첫 시트의 값·병합·너비·높이·글꼴·배경·정렬·테두리·숫자 표시·수식. 외부 라이브러리 없이 브라우저 기본 압축 해제(`DecompressionStream`)로 읽는다. 색은 rgb·옛 색인 색·테마 색(밝기 포함), 숫자 서식의 소수 자릿수, 인쇄 영역이 있으면 그 안만. 계산 못 하는 수식은 저장된 값만, 그림·차트·메모·조건부 서식은 가져오지 않음
- 화면: `SheetEditor`(머리글·격자·도구 모음·수식 입력줄. `mode` 'design' 은 틀까지, 'input' 은 `canEditCell` 이 허락한 칸의 값만) · `SheetView`(머리글 없이 문서 모양, `fitWidth` 로 비율 맞춤, `renderCell` 로 칸 내용 바꿔 그리기 — 예: 작성 화면 입력 상자, `renderOverlay` 로 덧그리기 — 예: 직인)
  - 되돌리기(Ctrl+Z)·다시 실행(Ctrl+Y)은 편집기가 관리한다. 쓰는 쪽이 `value` 를 바깥에서 바꿔도(속성 패널·엑셀 불러오기 등) 바꾸기 전 값이 되돌리기 목록에 들어간다
  - 업무 규칙은 모른다 — 병합·행/열 삭제 허락(`canMerge`·`canDeleteRow`·`canDeleteCol`), 값 넣기·붙여넣기(`setValue`·`paste`), 칸 표시(`renderBadge`)를 쓰는 쪽이 넘긴다

## 지원 수식

- 연산: `+ - * / ^`, 퍼센트 `%`, 결합 `&`, 비교 `= <> < > <= >=`, 괄호, 단항 `-` (엑셀처럼 `-2^2 = 4`)
- 참조: `A1`, 절대 참조 `$A$1`, 범위 `A1:C3`(함수 인자에서)
- 함수: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `SUMIF`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `ABS`, `IF`, `IFERROR`, `TODAY`(계산하는 날 — 상신된 문서는 다시 계산하지 않으므로 상신일로 남음)
- 규칙: 0으로 나누면 0, 순환 참조는 0, 잘못된 식은 `#오류`, 숫자로 안 읽히는 글자로 산술하면 `#오류`, `IF`의 거짓값을 생략하면 빈 칸, 병합에 가려진 칸은 빈 칸으로 읽음
