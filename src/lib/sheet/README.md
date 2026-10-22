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
- 조작(모두 새 시트를 돌려주는 순수 함수): `insertRow`, `deleteRow`, `insertCol`, `deleteCol`, `mergeRange`, `unmergeAt`, `setCellValue`, `applyStyle`, `applyBorder`, `pasteTsv`, `setCellMeta`, `setRowMeta`, `setColMeta`
- 표시: `cellCss`, `displayValue`, `defaultAlign`, `SHEET_COLORS`

## 지원 수식

- 연산: `+ - * /`, 결합 `&`, 비교 `= <> < > <= >=`, 괄호, 단항 `-`
- 참조: `A1`, 절대 참조 `$A$1`, 범위 `A1:C3`(함수 인자에서)
- 함수: `SUM`, `AVERAGE`, `MIN`, `MAX`, `ROUND`, `IF`
- 규칙: 0으로 나누면 0, 순환 참조는 0, 잘못된 식은 `#오류`, 숫자로 안 읽히는 글자로 산술하면 `#오류`, `IF`의 거짓값을 생략하면 빈 칸, 병합에 가려진 칸은 빈 칸으로 읽음
