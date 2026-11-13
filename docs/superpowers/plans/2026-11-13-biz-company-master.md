# 사업관리 기업 정보 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사업관리 › 기업 정보 화면을 새 컬렉션(`companies`·`companyBankAccounts`, 첨부 자리 `companyFiles`, 은행 공통코드)으로 만든다.

**Architecture:** 도메인(zod 스키마 + 순수 규칙) → 저장소(`createCrudBackend`) → react-query 훅 → 화면, 이 저장소의 정본 계층을 따른다. 옛 `vendors`·`bizVendorProjects` 는 새 화면이 읽지 않을 뿐 코드·데이터는 남긴다(다음 단계에서 정리).

**Tech Stack:** React 19 + Vite, TypeScript, zod 4, @tanstack/react-query, Appwrite(node-appwrite 스키마 스크립트), 테스트 `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-biz-company-master-design.md`

## Global Constraints

- 화면에 내부 ID·코드(`CMP-…`, 은행코드 `004`)·개발용 안내문 금지. 이모지 금지. 답변·문구 한국어.
- `approvalDocs`·`approvalForms` 는 읽지도 쓰지도 않는다.
- 지우지 않는다: 기업·계좌는 '사용 안 함'(`use=false`). 저장 안 된 계좌 줄만 실제로 뺀다.
- 사업자등록번호: 숫자 10자리만 저장, 필수, DB 유일 인덱스. 검증식 오류는 경고만(저장 허용). 표시는 `000-00-00000`.
- 은행 이름은 계좌에 저장하지 않는다 — `bankCode`(금융결제원 3자리) → 공통코드 `BANK` 그룹에서 이름.
- 권한 키 `biz.vendor.view`/`biz.vendor.manage`·메뉴 ID `S_BIZ_VENDOR`·경로 `/biz/vendor` 그대로, 표시 이름만 '기업 정보'.
- 운영 DB(컬렉션 생성·은행 코드 넣기)·운영 배포는 사용자 지시 후. 개발 DB는 `--dry-run` 확인 후 적용.
- 검증: `npx tsc --noEmit` 오류 0, `npx tsx --test $(git ls-files '*.test.ts' '*.test.tsx' '*.test.mjs')` fail 0, `npm run build` 성공.

## Review Focus

1. 사업자등록번호를 `123-45-67890`·공백 섞어 입력 → 숫자 10자리로 저장, 같은 번호를 다른 모양으로 넣어도 중복으로 막힌다. (Task 1 테스트)
2. '사용 안 함' 기업과 같은 번호로 새로 등록 → 막고 "사용 안 함 상태"임을 알려 준다(새로 만들지 않음). (Task 1 테스트)
3. 기본 계좌를 '사용 안 함'으로 바꾸거나 계좌를 하나만 남김 → 사용 중 계좌 중 정확히 하나가 기본. 사용 중 계좌가 없으면 기본 없음. (Task 1 테스트)
4. 두 사람이 동시에 같은 번호로 저장(앱 검사 통과 후 DB 유일 인덱스 409) → "이미 등록된 사업자등록번호"로 보여 주고 계좌를 반쯤 저장하지 않는다. (Task 3 테스트)
5. 은행 공통코드가 아직 없는 환경(운영에 넣기 전) → 계좌 줄의 은행 고르기가 비고, 저장 시 "은행을 고르세요"로 막힌다(빈 bankCode 저장 금지). (Task 1 테스트 + Task 4 화면 확인)

---

### Task 1: 기업 도메인 — 스키마와 규칙

**Files:**
- Create: `src/domain/company/schema.ts`
- Test: `src/domain/company/schema.test.ts`

**Interfaces:**
- Consumes: `bizNoDigits`, `formatBizNo`, `isValidBizNoChecksum` from `@/domain/bizVendor/schema`(재수출해서 화면은 이 파일만 보게)
- Produces:
  - `companySchema` / `type Company = { id; name; bizNo; ceoName; phone; address; addressDetail; use: boolean; note; createdBy; createdAt; updatedBy; updatedAt }`(문자열 기본값 `''`, `use` 기본 true)
  - `companyBankAccountSchema` / `type CompanyBankAccount = { id; companyId; bankCode; accountNo; holder; isDefault: boolean; use: boolean; note; createdBy; createdAt; updatedBy; updatedAt }`
  - `COMPANY_FILE_KINDS = ['BIZ_REG','BANKBOOK','ETC'] as const`, `companyFileSchema` / `type CompanyFile = { id; companyId; kind; accountId; name; url; storagePath; size: number; contentType; uploadedBy; uploadedAt }`
  - `newCompanyId(): string`(`CMP-`), `newAccountId(): string`(`CBA-`), `newCompanyFileId(): string`(`CFL-`) — `${prefix}-${Date.now().toString(36)}${random 4}`(authz.repo `rid` 와 같은 꼴)
  - `findCompanyByBizNo(companies: Company[], bizNo: string, excludeId?: string): Company | undefined` — 숫자만 비교, 사용 안 함 포함
  - `validateCompanyDraft(draft: CompanyDraft, all: Company[], excludeId?: string): { errors: string[]; warnings: string[]; duplicate?: Company }` — `CompanyDraft = Pick<Company,'name'|'bizNo'|'ceoName'|'phone'|'address'|'addressDetail'|'note'|'use'>`
  - `type AccountDraft = { id?: string; bankCode: string; accountNo: string; holder: string; isDefault: boolean; use: boolean; note: string }`
  - `normalizeDefaultAccount<T extends { use: boolean; isDefault: boolean }>(rows: T[]): T[]`
  - `validateAccountDrafts(rows: AccountDraft[]): string[]`
  - `formatBizNo`, `isValidBizNoChecksum`, `bizNoDigits` 재수출

- [ ] **Step 1: 실패하는 테스트 작성** — `schema.test.ts`

```ts
test('사업자번호는 숫자만 비교 — 모양이 달라도 같은 번호면 중복, 사용 안 함도 포함', () => {
  const all = [co('CMP-1', '대성', '1234567890', false)];
  assert.equal(findCompanyByBizNo(all, '123-45-67890')?.id, 'CMP-1');
  assert.equal(findCompanyByBizNo(all, ' 123 45 67890 ')?.id, 'CMP-1');
  assert.equal(findCompanyByBizNo(all, '1234567890', 'CMP-1'), undefined);
});
test('기업 검사 — 이름·번호 필수, 10자리 아니면 오류, 검증식 틀리면 경고만, 중복이면 오류와 대상', () => {
  assert.deepEqual(validateCompanyDraft(draft({ name: '', bizNo: '' }), []).errors, ['기업명을 입력하세요.', '사업자등록번호를 입력하세요.']);
  assert.deepEqual(validateCompanyDraft(draft({ bizNo: '12345' }), []).errors, ['사업자등록번호는 숫자 10자리입니다.']);
  const bad = validateCompanyDraft(draft({ bizNo: '1234567891' }), []); // 검증식 불일치
  assert.deepEqual(bad.errors, []);
  assert.deepEqual(bad.warnings, ['사업자등록번호 검증식에 맞지 않습니다. 번호를 다시 확인하세요.']);
  const dup = validateCompanyDraft(draft({ bizNo: '123-45-67890' }), [co('CMP-1', '대성', '1234567890', false)]);
  assert.equal(dup.duplicate?.id, 'CMP-1');
  assert.deepEqual(dup.errors, ['이미 등록된 사업자등록번호입니다(대성, 사용 안 함). 그 기업을 다시 사용으로 바꾸세요.']);
});
test('기본 계좌 — 사용 중 계좌 중 정확히 하나, 사용 중이 없으면 없음', () => {
  assert.deepEqual(normalizeDefaultAccount([acc(false, true), acc(true, false)]).map((a) => a.isDefault), [false, true]);
  assert.deepEqual(normalizeDefaultAccount([acc(true, true), acc(true, true)]).map((a) => a.isDefault), [true, false]);
  assert.deepEqual(normalizeDefaultAccount([acc(true, false), acc(true, false)]).map((a) => a.isDefault), [true, false]);
  assert.deepEqual(normalizeDefaultAccount([acc(false, true)]).map((a) => a.isDefault), [false]);
});
test('계좌 검사 — 사용 중 줄은 은행·계좌번호·예금주 필수, 계좌번호는 숫자와 - 만', () => {
  assert.deepEqual(validateAccountDrafts([{ ...accDraft, bankCode: '' }]), ['1번째 계좌: 은행을 고르세요.']);
  assert.deepEqual(validateAccountDrafts([{ ...accDraft, accountNo: '12a-3' }]), ['1번째 계좌: 계좌번호는 숫자와 - 만 쓸 수 있습니다.']);
  assert.deepEqual(validateAccountDrafts([{ ...accDraft, holder: ' ' }]), ['1번째 계좌: 예금주를 입력하세요.']);
  assert.deepEqual(validateAccountDrafts([{ ...accDraft, bankCode: '', use: false }]), []);
});
test('ID 머리 — CMP·CBA·CFL', () => {
  assert.match(newCompanyId(), /^CMP-[a-z0-9]+$/);
  assert.match(newAccountId(), /^CBA-[a-z0-9]+$/);
  assert.match(newCompanyFileId(), /^CFL-[a-z0-9]+$/);
});
```
(`co(id,name,bizNo,use)`·`draft(over)`·`acc(use,isDefault)`·`accDraft` 는 테스트 파일 안의 작은 도우미. 위 테스트의 `1234567890`·`123-45-67890` 은 검증식을 통과하는 `1248100998`·`124-81-00998` 로, 검증식 불일치 예 `1234567891` 은 `1248100999` 로 바꿔 쓴다(기존 `bizVendor/schema.test.ts` 에서 확인된 값).)

- [ ] **Step 2: 실패 확인** — `npx tsx --test src/domain/company/schema.test.ts` → 모듈 없음으로 FAIL
- [ ] **Step 3: 구현** — 위 Produces 그대로. `normalizeDefaultAccount`: 사용 안 함 줄은 모두 false, 사용 중 줄 중 처음 만난 isDefault=true 하나만 남기고, 없으면 첫 사용 중 줄을 true. 원래 순서 유지, 새 배열 반환. `validateCompanyDraft` 경고/오류 문구는 테스트의 문구 그대로. 중복 오류 문구: 사용 중이면 `이미 등록된 사업자등록번호입니다(${name}).`, 사용 안 함이면 위 테스트 문구.
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS
- [ ] **Step 5: 커밋** — `feat(사업관리): 기업 정보 도메인 — 기업·계좌·첨부 스키마, 사업자번호 중복·기본 계좌 규칙`

### Task 2: 컬렉션 정의와 은행 공통코드

**Files:**
- Modify: `scripts/appwrite-schema.ts`(COLLECTIONS 배열, `bizVendorProjects` 정의 다음)
- Modify: `package.json` scripts — `"appwrite:schema:company": "tsx scripts/appwrite-schema.ts --only=companies,companyBankAccounts,companyFiles --new-only"`
- Create: `scripts/seed-bank-codes.ts`
- Create: `src/domain/company/banks.ts`(초기 은행 목록 — 스크립트와 테스트가 함께 씀)
- Test: `src/domain/company/banks.test.ts`

**Interfaces:**
- Produces: `BANK_GROUP_CODE = 'BANK'`, `BANK_GROUP_NAME = '은행'`, `INITIAL_BANKS: ReadonlyArray<{ code: string; name: string }>`

- [ ] **Step 1: 실패 테스트** — `banks.test.ts`: `INITIAL_BANKS` 의 code 는 모두 숫자 3자리이고 서로 다르며, name 도 서로 다르다; `{code:'004',name:'KB국민은행'}`·`{code:'088',name:'신한은행'}`·`{code:'090',name:'카카오뱅크'}` 포함.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/domain/company/banks.test.ts` → FAIL
- [ ] **Step 3: `banks.ts`** — 순서대로: 002 KDB산업은행, 003 IBK기업은행, 004 KB국민은행, 007 수협은행, 011 NH농협은행, 020 우리은행, 023 SC제일은행, 027 한국씨티은행, 031 iM뱅크(대구), 032 부산은행, 034 광주은행, 035 제주은행, 037 전북은행, 039 경남은행, 045 새마을금고, 048 신협, 071 우체국, 081 하나은행, 088 신한은행, 089 케이뱅크, 090 카카오뱅크, 092 토스뱅크.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 스키마 정의 추가** — spec §3.1~3.3 칸 그대로. 도우미 `S/INT/BOOL/EN/IX/UQ` 사용. `companies` 색인 `UQ('cmpBizNo',['bizNo'])`, `IX('cmpName',['name'])`; `companyBankAccounts` `IX('cbaCompany',['companyId'])`; `companyFiles` `EN('kind',['BIZ_REG','BANKBOOK','ETC'])`, `IX('cflCompany',['companyId'])`, `size` 는 `INT('size', false, 0, 0, 2_000_000_000)`. 각 정의 위에 spec 한 줄 요약 주석.
- [ ] **Step 6: `seed-bank-codes.ts`** — `--prod`(운영 프로젝트·`APPWRITE_API_KEY_PROD`)·`--dry-run` 플래그, `.env.local` 읽기는 `scripts/appwrite-schema.ts` 와 같은 방식. `commonCodes` 에서 `groupCode='BANK'` 만 조건 조회 → 없는 code 만 `createDocument($id = BANK__{code}, { groupCode, groupName, code, name, order: (i+1)*10, use: true, regBy: '시스템' })`. 있는 것은 건너뜀(고치지 않음). 출력: 만들 것/건너뛴 것 개수. 다른 그룹 행은 읽지도 쓰지도 않는다.
- [ ] **Step 7: 개발 DB 적용** — `npm run appwrite:schema:company -- --dry-run` 로 새로 만듦 3개 확인 → `npm run appwrite:schema:company` → `npx tsx scripts/seed-bank-codes.ts --dry-run` → `npx tsx scripts/seed-bank-codes.ts`. 기대: 컬렉션 3개 생성, 은행 22건 생성.
- [ ] **Step 8: 커밋** — `feat(사업관리): 기업·계좌·첨부 컬렉션 정의, 은행 공통코드 넣기 스크립트`

### Task 3: 저장소와 훅

**Files:**
- Create: `src/data/company/company.repo.ts`
- Create: `src/features/company/useCompanies.ts`
- Test: `src/data/company/company.repo.test.ts`

**Interfaces:**
- Consumes: Task 1 스키마·규칙, `createCrudBackend`, `DocumentExistsError`
- Produces:
  - `companyRepo.list(): Promise<Company[]>`, `companyRepo.listAccounts(): Promise<CompanyBankAccount[]>`, `companyRepo.listFiles(companyId: string): Promise<CompanyFile[]>`(화면 없음, 자리)
  - `companyRepo.saveCompanyWithAccounts(input: { company: Company; isNew: boolean; accounts: AccountDraft[]; existing: CompanyBankAccount[]; actorId: string }): Promise<Company>` — 기업 먼저(신규 `insert`, 수정 `save`), 그다음 계좌: `normalizeDefaultAccount` 적용 후 id 없는 줄 `insert`, 있는 줄 `save`, `existing` 에 있는데 `accounts` 에 없는 줄은 `use=false,isDefault=false` 로 `save`. created*/updated* 채움.
  - `class DuplicateBizNoError extends Error` — 기업 저장이 409(`DocumentExistsError` 또는 `code===409`)면 이것을 던지고 **계좌는 저장하지 않는다**.
  - 훅: `useCompanies()`(key `['companies']`), `useCompanyAccounts()`(key `['companyBankAccounts']`), `useSaveCompany()`(mutation → `saveCompanyWithAccounts`, 성공 시 두 키 무효화), `useBankOptions()` = `useCodeOptions(BANK_GROUP_CODE)`
- 저장소는 backend 를 주입받는 `createCompanyRepo(backends)` + 기본 인스턴스 `companyRepo` 로 만들어 테스트에서 가짜 backend 를 넣는다.

- [ ] **Step 1: 실패 테스트** — 가짜 backend(메모리 Map, `insert` 는 같은 id 면 `DocumentExistsError`, 옵션으로 409 throw)로:
  - `'신규 기업 + 계좌 2줄 → 기업 insert 1, 계좌 insert 2, 기본은 하나'`
  - `'수정 — 빠진 저장 계좌는 지우지 않고 사용 안 함, 기본 false'`
  - `'기업 저장이 409면 DuplicateBizNoError, 계좌는 하나도 안 저장'`
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/data/company/company.repo.test.ts` → FAIL
- [ ] **Step 3: 구현** — 위 Interfaces. 컬렉션 이름 `companies`·`companyBankAccounts`·`companyFiles`, `idOf: x => x.id`, `seed: []`.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(사업관리): 기업 저장소·훅 — 기업과 계좌 함께 저장, 사업자번호 중복(409) 처리`

### Task 4: 기업 정보 화면

**Files:**
- Create: `src/modules/biz/company/CompanyScreen.tsx`, `CompanyFormModal.tsx`, `CompanyDetailModal.tsx`
- Modify: `src/app/App.tsx:106` — `'/biz/vendor'` → `import('@/modules/biz/company/CompanyScreen')`
- Modify: `src/app/menu-tree.ts:24-25` — 그룹 `G_BIZ_PARTNER` 이름 '도입기업' → '기업', `S_BIZ_VENDOR` 이름 '기업 정보'
- Modify: `src/domain/roleGroup/schema.ts:78` — name '기업 정보', desc '기업 등록·수정, 계좌 관리'
- Modify: `src/domain/authz/permissions.ts:83` — `pair('biz.vendor', '기업 정보', 'biz', '기업 정보를 본다', '기업을 등록·수정한다')`
- 옛 `src/modules/biz/vendor/*` 는 남긴다(다음 단계 정리).

**Interfaces:**
- Consumes: Task 3 훅, Task 1 `validateCompanyDraft`·`validateAccountDrafts`·`formatBizNo`, `usePermission().canAction('S_BIZ_VENDOR', 'create'|'update')`(지금 화면과 같음), `_biz` 의 `BizHead·BizListCard·BizPager·BizEmptyRow·bizTd·bizTh`, `Modal`·`Button`·`Field`·`TextField`·`SelectField`·`Pill`
- 화면 규칙(spec §4): 목록 열 = 기업명 · 사업자등록번호(형식) · 대표자 · 대표번호 · 기본 계좌(은행명 + 계좌번호, 없으면 '-') · 사용 여부(Pill). 검색 = 기업명 포함 또는 번호 숫자 3자리 이상 부분 일치; 거르기 = 사용/사용 안 함; 기업명 가나다순; 쪽 나누기 10.
- 등록·수정 창: 기업 칸 + 계좌 줄(은행 SelectField = `useBankOptions` 이름, 계좌번호, 예금주(새 줄 기본값 = 기업명), 기본 라디오, 사용 체크, 줄 빼기). 오류는 저장 단추 위에 모아서, 경고(검증식)는 사업자번호 칸 아래. 중복이면 오류 문구 + 상세 열기 단추. `DuplicateBizNoError` 도 같은 문구.
- 상세 창: 기업 정보 + 계좌 목록(사용 중 먼저, 기본 표시, 사용 안 함은 흐리게). 관리 권한이면 '수정' 단추.
- 화면에 ID·은행코드 노출 금지.

- [ ] **Step 1: 화면 구현** — 위 규칙. 칸 이름: 기업명·사업자등록번호·대표자·대표번호·주소·상세 주소·메모·사용.
- [ ] **Step 2: 타입·테스트·빌드** — `npx tsc --noEmit` 0, 전체 테스트 fail 0, `npm run build` 성공
- [ ] **Step 3: 개발 화면 확인** — run-app 스킬로 로그인 → `/biz/vendor`: (a) 기업 등록(계좌 2개, 기본 바꾸기) (b) 같은 번호 다른 모양으로 등록 → 막힘 (c) 기본 계좌 사용 안 함 → 남은 계좌가 기본 (d) 메뉴 이름 '기업 정보'. 스크린샷 확인, 콘솔 오류 0.
- [ ] **Step 4: 커밋** — `feat(사업관리): 기업 정보 화면 — 새 기업·계좌 데이터로 목록·등록·수정·상세, 메뉴·권한 이름 '기업 정보'`

### Task 5: 마무리 보고

- [ ] **Step 1:** 운영 반영에 필요한 것 정리해 사용자에게 보고(운영 컬렉션 3개 `--dry-run` 결과, 은행 코드 22건 `--dry-run` 결과, 배포). 운영 쓰기는 지시 후.
