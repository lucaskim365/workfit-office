# 이슈: Firestore 중첩 배열 제약 → 시드 적재 차단

> 발생/해결: 2026-06-24
> 대상: WorkFit MES 플랫폼 (`/Users/lucaskim/Developer/Work/DemoMes_v0`)
> 관련: [[Firestore_시드_적재_가이드.md]] · [[데이터_계층_구현현황.md]] · 코덱 `src/shared/lib/firestore-codec.ts`
> 커밋: `f48b46c` fix(data): Firestore 중첩배열 코덱

---

## 1. 증상

`npm run seed`로 118컬렉션을 적재하던 중 5번째 컬렉션(`roleGroups`)에서 중단:

```
시드 118개 컬렉션 · 문서 685건
타깃: project=gen-lang-client-0703198317 db=ai-studio-52b2c1bc-...
  ✔ items            6건
  ✔ vendors          6건
  ✔ commonCodes      23건
  ✔ users            12건
3 INVALID_ARGUMENT: Nested arrays are not allowed
```

(`3` = gRPC 코드. 앞 4개 컬렉션은 정상 적재됨)

---

## 2. 원인

**Firestore는 문서 필드에 "배열의 배열"(중첩 배열)을 직접 저장할 수 없다.**
(단, *배열 안의 맵*, *맵 안의 배열*은 허용 — 금지되는 건 배열의 직접 자식이 배열인 경우)

본 앱 일부 도메인 스키마가 화면 mock(튜플)을 그대로 따르느라 **`z.tuple` 배열**(= 배열의 배열) 또는 `z.array(z.array(...))` 형태를 사용했다. 이는 앱 메모리(in-memory seed)에서는 문제없지만, Firestore 저장 시 거부된다.

### 영향받은 컬렉션 12종

| 컬렉션 | 필드 | 형태 |
|---|---|---|
| `roleGroups` | permissions | `boolean[][]` |
| `authRoles` | permissions | `[bool, bool][]` |
| `coa`(coaCertificates) | rows | `string[][]` |
| `calibrations` | pts | `string[][]` |
| `nonconformances` | steps | `[string,string,number][]` |
| `voc` | steps | `[string,string,number][]` |
| `mrbCases` | board | `[string,string,string][]` |
| `capaActions` | actions | `[string×5][]` |
| `traceNodes` | events | `[string×4][]` |
| `spcCharts` | viol | `[string,string,string][]` |
| `equipmentSpecs` | defs | `[string×6,bool][]` |
| `equipParams` | p | `[…][]` |

> ※ `mean`/`rng`/`flag`/`body` 등 **단일 배열**(number[]·string[])은 중첩이 아니라 정상.

---

## 3. 해결 — Firestore 직렬화 코덱

스키마를 객체배열로 전부 바꾸는 대신(스키마·시드·화면 36곳 수정), **repo 경계에서만 변환하는 코덱**을 도입했다. 도메인 스키마·시드·화면은 튜플 그대로 유지(앱 메모리/시드 불변).

### `src/shared/lib/firestore-codec.ts`

- `encodeForFirestore(value)` — 저장 직전, 내부 배열을 `{ __nestedArray: [...] }` 맵으로 감싼다(재귀).
- `decodeFromFirestore(value)` — 로드 직후, 감싼 맵을 배열로 복원한다(재귀).
- 중첩 배열이 없는 데이터에는 무영향(no-op).

```
[[true,false],[…]]  --encode-->  [{__nestedArray:[true,false]}, {…}]   (Firestore 저장 OK: 배열 of 맵)
                    --decode-->  [[true,false],[…]]                     (원형 복원)
```

### 적용 지점
- **시드 러너**(`scripts/seed-firestore.ts`): 모든 `batch.set` 데이터를 `encodeForFirestore`로 통과(중첩 없는 컬렉션엔 무영향).
- **영향 repo 12종**: 읽기 `schema.parse(decodeFromFirestore(d.data()))`, 쓰기 `setDoc(..., encodeForFirestore(valid))`.
- 나머지 ~90 repo는 변경 불필요(인코딩이 no-op이라 저장 형태 동일).

---

## 4. 검증

적재 후 `roleGroups` 1건을 admin SDK로 읽어 round-trip 확인:

```
저장형태 permissions[0]: {"__nestedArray":[true,true,false,false,false,false]}
디코딩후 permissions[0]: [true,true,false,false,false,false]
중첩배열 복원 OK: true
inspections 문서수: 14
총 컬렉션수: 122   (본 앱 118 + 기존 AI Studio MVP 잔여 컬렉션)
```

- 재실행 결과 **118컬렉션 685건 전부 적재 완료**.
- `npm run build` 0에러. 앱이 Firestore에서 읽을 때 12 repo가 자동 복원.

---

## 5. 교훈 / 후속

- **Firestore 데이터 모델링 원칙**: "배열의 배열"을 피하고 **배열 of 맵**을 쓴다. 신규 슬라이스에서 튜플 배열이 필요하면 처음부터 `z.array(z.object({...}))`로 모델링하는 게 정석(코덱 불필요).
- 코덱은 기존 튜플 스키마를 보존하기 위한 **호환 레이어**다. 향후 여유가 있으면 12종 스키마를 객체배열로 정규화하면 코덱 의존을 제거할 수 있다(앱 화면의 `r[0]`→`r.field` 동반 수정 필요).
- 다른 Firestore 제약도 유의: 문서 1MB·필드명 제약·`undefined` 미허용(zod default로 회피 중)·배열 element 비교 쿼리 한계 등.
