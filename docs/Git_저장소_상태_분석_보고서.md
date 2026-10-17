# Git 저장소 상태 분석 보고서

- **저장소**: `lucaskim365/workfit-office` (GitHub, **Public**)
- **기본 브랜치**: `main`
- **분석 일자**: 2026-07-09
- **분석 기준 커밋**: `origin/main` = `9f261ee` (2026-07-07, lucaskim365)

---

## 1. 요약

원격에 **브랜치 10개**(`main` + 작업 브랜치 9개)가 존재하며, **`main`에 머지된 작업은 하나도 없고 열린 PR도 0건**입니다.

작업 브랜치 9개는 모두 `hongchaerish <hcw.workfit@gmail.com>` 이 2026-07-08 하루에 작성한 커밋 16개로 구성되어 있습니다. 이 중 **`fix/doc-logo` 한 브랜치가 나머지 8개를 모두 포함**하는 통합 브랜치입니다.

> 참고: 로컬 저장소에는 `main` 브랜치만 존재합니다. 아래 9개 브랜치는 원격에만 있으며, 이번 `git fetch` 시점에 처음 로컬로 내려왔습니다.

---

## 2. 브랜치 구조

```
main (9f261ee)
 │
 ├─ feature/approval-service-upgrade      +1 커밋 / 6 파일
 ├─ fix/approval-form-error               +1 커밋 / 2 파일
 ├─ fix/approval-rule-document-type-list  +1 커밋 / 1 파일
 ├─ fix/approval-rule-logic               +1 커밋 / 1 파일
 ├─ fix/field-range-calendar-picker       +1 커밋 / 1 파일
 ├─ fix/login                             +1 커밋 / 1 파일
 ├─ refactor/cleanup                      +2 커밋 / 3 파일
 │
 ├─ fix/id        +15 커밋 / 14 파일   ← 위 7개 브랜치를 전부 머지 + 자체 커밋 1개
 └─ fix/doc-logo  +16 커밋 / 15 파일   ← fix/id + 로고 추가 커밋 1개  ★ 최종 통합본
```

### 포함 관계 검증

`git merge-base --is-ancestor <브랜치> origin/fix/doc-logo` 실행 결과, **8개 브랜치 전부가 `fix/doc-logo`의 조상**으로 확인되었습니다.

| 브랜치 | `fix/doc-logo`에 포함 |
|---|---|
| feature/approval-service-upgrade | 포함됨 |
| fix/approval-form-error | 포함됨 |
| fix/approval-rule-document-type-list | 포함됨 |
| fix/approval-rule-logic | 포함됨 |
| fix/field-range-calendar-picker | 포함됨 |
| fix/login | 포함됨 |
| refactor/cleanup | 포함됨 |
| fix/id | 포함됨 |

모든 브랜치가 `main` 대비 **behind 0** 입니다. 즉 `main`은 브랜치 분기 이후 전진하지 않았고, 리베이스 없이 바로 머지 가능합니다.

### 커밋 그래프 (`main..fix/doc-logo`)

```
* f03db72  워크핏 로고 추가
* 118ecb3  결재선 규칙관리시 id 직관성 수정
*   5d35c84  (merge) 공장관련 값 삭제 반영
|\
| * 026c20b  공장관련 내용 삭제(로직 및 스키마 보존)
| * bcec414  refactor: 공장관련내용 삭제(스키마,로직은 남겨둠)
*   50bb236  (merge) 다중 탭 로그인 사용자 덮어씀 수정 반영
|\
| * 1f917d5  fix: 새로고침시 사용자가 엎어씌워지는 오류 수정
*   cb11169  (merge) 기간 선택 달력 한개 반영
|\
| * c0630b0  fix: 기간 필드 입력시 달력 1개에서 선택하도록 수정
*   bc62166  (merge) 결재선 숫자→문자열 오류 수정 반영
|\
| * 475dd29  결재선 논리오류 수정
*   a7307a5  (merge) 문서유형 선택시 결재서식 동기화 반영
|\
| * 46c464b  fix: 결재선 관리 문서유형 선택 시 현재 결재서식과 동기화
*   0f99a2e  Merge branch 'fix/approval-form-error' into develop
|\
| * f5cfc19  fix: 결재서식-2열오류 및 섹션설정시 문서 미리보기 오류 수정
* 6eb10cb  feature: 임시저장문서 휴지통기능 구현
```

`0f99a2e`의 커밋 메시지가 `Merge branch 'fix/approval-form-error' into develop` 인 점으로 보아, 로컬에서 `develop` 브랜치로 통합한 뒤 `fix/doc-logo`라는 이름으로 푸시한 것으로 추정됩니다.

---

## 3. 변경 내용 (`main...fix/doc-logo` 기준)

총 **15개 파일, +525 / -71**

| 파일 | 증감 | 관련 작업 |
|---|---|---|
| `src/modules/gw/approval/formFields.tsx` | +193 | 기간 필드 달력 1개 선택 |
| `src/modules/base/approvalRule/ApprovalRuleScreen.tsx` | +143 | 문서유형 동기화 · 공장 항목 제거 |
| `src/modules/gw/approval/ApprovalDocumentView.tsx` | +103 | 결재서식 2열 오류 · 미리보기 |
| `src/data/approvalDoc/approvalDoc.repo.ts` | +31 | 임시저장 휴지통 |
| `src/modules/base/approvalForm/ApprovalFormScreen.tsx` | +31 | 결재서식 오류 수정 |
| `src/modules/gw/approval/ApprovalScreen.tsx` | +31 | 임시저장 휴지통 |
| `src/features/gw/useApprovals.ts` | +27 | 임시저장 휴지통 |
| `src/domain/approvalRoute/engine.ts` | +15 | 결재선 논리오류 (숫자/문자열) |
| `src/app/auth/AuthProvider.tsx` | +8 | 다중 탭 로그인 덮어씀 수정 |
| `src/domain/approvalDoc/engine.ts` | +5 | 임시저장 휴지통 |
| `src/domain/approvalDoc/schema.ts` | +4 | 임시저장 휴지통 |
| `src/modules/base/department/DepartmentScreen.tsx` | +2 | 공장 항목 제거 |
| `src/modules/base/position/PositionScreen.tsx` | +2 | 공장 항목 제거 |
| `src/modules/gw/_gw.tsx` | +1 | 휴지통 라우팅 |
| `src/assets/logo.png` | 신규 (61.7KB) | 워크핏 로고 |

기능 단위로 묶으면 다음 6가지입니다.

1. **임시저장 문서 휴지통** (신규 기능)
2. **결재서식 2열 렌더링 오류 및 섹션 설정 시 미리보기 미표시 오류** 수정
3. **결재선 관리** — 문서유형 선택 시 결재서식과 동기화, id 직관성 개선, 숫자가 문자열로 입력되어 결재자가 잘못 선정되던 논리오류 수정
4. **기간 필드** — 달력 2개 → 1개에서 범위 선택
5. **로그인** — 다중 탭에서 다른 사용자로 로그인 시 사용자 데이터가 덮어씌워지던 오류 수정
6. **공장 관련 UI 제거** (스키마·로직은 보존)

---

## 4. 발견된 문제

### 4.1 브랜치 이름이 실제 내용과 불일치 — 중간

`fix/doc-logo`는 이름상 로고 추가지만 실제로는 15개 파일 +525/-71의 통합 브랜치입니다. `fix/id`(14파일 +484/-69)도 마찬가지입니다. 이 이름으로 PR을 열 경우 리뷰어가 변경 범위를 오해할 소지가 큽니다.

### 4.2 `refactor/cleanup`에 중복 커밋 — 낮음

`bcec414 refactor: 공장관련내용 삭제(스키마,로직은 남겨둠)` 와 `026c20b 공장관련 내용 삭제(로직 및 스키마 보존)` 가 동일 작업입니다.

### 4.3 개별 PR로 분할 시 충돌 발생 — 중간

`src/modules/base/approvalRule/ApprovalRuleScreen.tsx` 를 아래 두 브랜치가 함께 수정합니다.

- `fix/approval-rule-document-type-list`
- `refactor/cleanup`

두 브랜치를 각각 별도 PR로 `main`에 머지하면 나중에 머지되는 쪽에서 충돌합니다. 분할 머지를 택한다면 순서를 정하고 뒤쪽 브랜치를 리베이스해야 합니다.

### 4.4 저장소가 Public — 확인 필요

사내 그룹웨어 애플리케이션이며 조직도·사용자 실명·결재선 정보가 시드 데이터에 포함되어 있으나, 저장소 공개 범위가 **Public** 입니다. 의도한 설정인지 확인이 필요합니다.

### 4.5 로컬 미추적 파일 — 낮음

```
docs/시놀로지_NAS_연동_문서관리_개발_계획서.md   (untracked)
```

---

## 5. 권장 조치

### 5.1 머지 전략

`fix/doc-logo` 하나만 PR로 올려 `main`에 머지하는 방식을 권장합니다. 나머지 8개 브랜치는 이미 그 안에 포함되어 있으므로, 머지 후 일괄 삭제하면 됩니다.

개별 PR로 분할하는 방식은 4.3의 충돌 때문에 머지 순서 조정과 리베이스가 필요해, 얻는 리뷰 단위의 이점 대비 비용이 큽니다.

다만 4.1에 따라 브랜치 이름은 내용에 맞게 변경하는 것이 좋습니다.

```bash
# 1) 내용에 맞는 이름으로 원격 브랜치 재생성
git push origin origin/fix/doc-logo:refs/heads/develop

# 2) PR 생성
gh pr create --base main --head develop \
  --title "전자결재 개선 통합 (결재서식·결재선·로그인·휴지통·로고)"

# 3) 머지 후 정리
git push origin --delete \
  feature/approval-service-upgrade \
  fix/approval-form-error \
  fix/approval-rule-document-type-list \
  fix/approval-rule-logic \
  fix/doc-logo \
  fix/field-range-calendar-picker \
  fix/id \
  fix/login \
  refactor/cleanup
```

### 5.2 머지 전 확인 사항

- [ ] `fix/doc-logo` 코드 리뷰 (특히 `AuthProvider.tsx`의 다중 탭 세션 처리, `approvalRoute/engine.ts`의 타입 변환)
- [ ] 앱 실행하여 6개 기능 동작 확인
- [ ] 저장소 공개 범위(Public) 의도 여부 확인
- [ ] `docs/시놀로지_NAS_연동_문서관리_개발_계획서.md` 커밋 여부 결정

### 5.3 향후 브랜치 운영 제안

- 브랜치 이름은 실제 변경 범위를 반영할 것 (통합 브랜치는 `develop` 또는 `release/*`)
- 작업 완료 시 PR을 생성해 `main`에 머지하고, 통합 브랜치가 장기간 누적되지 않도록 할 것
- 동일 파일을 수정하는 브랜치는 분기 전에 순서를 조율할 것
