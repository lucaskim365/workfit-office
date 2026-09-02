# CapsSync 테스트 가이드

웹 연동 전에 정제 파이프라인이 맞는지 자동으로 검증한다. 테스트는 **두 층**:

| 층 | 무엇 | 의존성 | 속도 |
|---|---|---|---|
| **단위(Unit)** | 순수 로직 — 정제(시간·코드·날짜·서명), delta 비교, 명령행 | 없음 | 즉시 |
| **통합(Integration)** | 실제 mdb 를 읽어 정제 결과 검증 | mdb 파일 + ACE 드라이버 + 비번 | 수 초 |

- 프로젝트: `CapsSync.Tests` (xUnit, net48/x64).
- 구조 결정: **`InternalsVisibleTo`** — 별도 라이브러리 분리 없이, exe의 `internal` 메서드를 테스트가 직접 검증. (가벼운 도구엔 이게 적절)
  - `CapsSync/Program.cs` 상단: `[assembly: InternalsVisibleTo("CapsSync.Tests")]`
  - 테스트 대상 메서드는 `private` → `internal`.

## 실행

```powershell
# 리포 루트에서. 단위 테스트는 항상 실행, 통합은 환경변수 있을 때만.
dotnet test

# 통합 테스트까지 (실제 mdb 읽기) — 비번을 환경변수로 주입
$env:CAPS_TEST_PWD = "<mdb 비밀번호>"
dotnet test
```
- **Visual Studio:** 테스트 탐색기(Test Explorer)에서 실행. 통합까지 돌리려면 VS 실행 전에 `CAPS_TEST_PWD` 환경변수 설정(또는 시스템 환경변수).

### 통합 테스트 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `CAPS_TEST_PWD` | (없음) | mdb 비밀번호. **미설정 시 통합 테스트 전체 스킵** |
| `CAPS_TEST_MDB` | `C:\work\db_decryption\ACCESS.mdb` | 테스트용 mdb 경로 |
| `CAPS_TEST_PROVIDER` | `Microsoft.ACE.OLEDB.16.0` | OLEDB provider |

> 비번을 코드/저장소에 넣지 않으려고 환경변수로 주입한다. 파일·비번이 없으면 `Skip.If`로 **건너뜀**(CI 안전). 대상 mdb는 `.txt` 확장자여도 됨 — 테스트가 임시 `.mdb`로 복사 후 연다.

## 커버리지 (현재)

**단위 (`NormalizerTests`)**
- `MinutesToIso`: mod 1440 시각 변환, `-1`=null, 자정 넘긴 퇴근 +1일, 같은 날 퇴근
- `MapDecision`: decision 0~16 전 코드 → status, 미관측 코드 → `unknown`
- `FormatDate`: `yyyyMMdd` → `yyyy-MM-dd`
- `ParseHoliday`: 4자리(MMDD 반복) / 8자리(특정일) / 잘못된 길이 → null
- `Sign`: HMAC-SHA256 골든 벡터 일치, 결정성, 64 hex, 본문 변화 시 서명 변화

**단위 (`SyncStateTests` — 실시간 delta 로직)**
- 문서 ID 규칙: `AttendanceKey` = `{empId}_{yyyyMMdd}`, `HolidayKey` = `md_{MMDD}` / `{yyyyMMdd}` (서버 계약 §4와 일치)
- `Diff`: 첫 실행은 전부 / 커밋 후 같은 값은 0건 / 필드가 바뀌면 그 행만 / 새 날짜만
- **커밋하지 않으면 같은 행을 다시 보낸다** — 전송 실패 시 유실 없음 보장
- 직원 이름 변경 감지, 문서 ID를 만들 수 없는 공휴일 행은 스킵
- `Prune`: 창 밖 지문 제거, 형식이 다른 키는 손대지 않음
- `Save`/`Load` 왕복 + 재기동 후에도 재전송하지 않음, 깨진·없는 파일은 빈 상태로 폴백
- `Fingerprint`: 결정성, 16 hex, `null` 과 `""` 구분

**단위 (`CommandLineTests`)**
- `--watch` / `--once` / `--check`(`--verify`) / `/once` / `once` 인식, `--resync`·`--help`
- 인자 없으면 `Mode=null` → config 의 `Mode` 를 따름, 모르는 플래그는 무시

**통합 (`IntegrationTests`, 실제 mdb)**
- 건수: 근태 1612 / 직원 14 / 공휴일 8
- 알려진 레코드: `empId=1(홍길동) 2026-02-25 → in 08:05, status normal, raw.inTime=1925`
- **`unknown` status 0건** (매핑 누락 회귀 방지 — 실패 시 누락 코드 출력)
- 직원 `empId` 채워짐(fpid/id 안정 키), 홍길동 존재
- 공휴일 전부 `recurring` + `monthDay`, 광복절(08-15) 존재

## E2E — API 호출까지 (로컬 목 엔드포인트)

단위·통합은 "읽기+정제"까지만 검증한다. **실제 exe 실행 + HTTP 전송(서명 포함)** 은
`CapsSync\tools\e2e-mock-test.ps1` 로 확인한다. Vercel이 없어도 로컬 목이 `/api/ingest` 역할.

```powershell
# 리포 루트, dotnet build -c Release 이후
$env:CAPS_TEST_PWD = "<mdb 비밀번호>"    # 명령줄에 직접 적지 말 것(히스토리에 남는다)
powershell -ExecutionPolicy Bypass -File CapsSync\tools\e2e-mock-test.ps1
```
검증하는 전체 사슬:
```
루트 .mdb → exe: 읽기(원본 직접) → 정제 → HMAC 서명 → HTTP POST → 200 응답 처리
                                          목이 HMAC 재계산해 서명 일치 확인
```
성공 시 출력(예):
```
[수동 실행] 읽음 1612건 → 변경분 근태 1612 / 직원 14 / 공휴일 8
전송 성공 (200)
HMAC verify   : PASS
payload counts: attendance=1612 employees=14 holidays=8
exe exit code : 0
E2E OK
```
- 목은 `TcpListener`(관리자·urlacl 불필요). 임시 폴더에 exe+config+secret 깔고 돌린 뒤 정리.
- 파라미터: `-Mdb`(기본 루트 DB) `-Password`(또는 `$env:CAPS_TEST_PWD`) `-Port`(기본 5005) `-Secret`.
- **`Mode="once"` + `--once` 로 돌린다.** 기본 모드는 상주(`watch`)라 그대로 두면 프로세스가 끝나지 않아 테스트가 멈춘다.
- 임시 폴더라 `state.json`이 없다 → 첫 실행이 창 전체(1612건)를 보낸다. 그래서 건수 단언이 유지된다.
  (같은 폴더에서 두 번째로 돌리면 변경분 0건이 되는 게 정상)
- 참고: DB는 `MdbPath` 위치의 **원본을 그 자리에서 읽기 전용으로 연다**(복사하지 않음).
  따라서 그 폴더에 쓰기 권한이 있어야 한다(Access가 `.ldb`를 쓴다).

## 새 테스트 추가

- **정제 로직**이면 → `Program`의 메서드를 `internal`로 열고 `NormalizerTests`에 `[Fact]`/`[Theory]` 추가.
- **delta/상태 로직**이면 → `SyncStateTests`에 추가. `Att()`/`Emp()`/`Hol()` 헬퍼로 행을 만들고
  `Diff` → (필요하면) `Commit` → 다시 `Diff` 하는 패턴으로 "무엇이 다시 나가는지"를 단언한다.
- **DB 의존**이면 → `IntegrationTests`에 `[SkippableFact]` + `Prepare()` 패턴(스킵 가드 + 임시 복사) 사용.
- 폴링 루프는 타이밍·실제 DB에 의존해 단위 테스트가 불안정하다 → 자동 검증 대신
  `--watch`로 띄워 두고 실제로 근태를 한 건 넣어 로그로 확인한다(배포 가이드 5단계).
- 실데이터 기대값이 바뀌면(레코드 추가/재계산) 통합 테스트의 건수·레코드 단언도 함께 갱신.

## CI 참고

- `dotnet test`만 돌리면 단위 테스트(빠름)만 검증, 통합은 스킵 → 파일 없는 CI에서도 초록.
- DB를 붙일 수 있는 러너에선 `CAPS_TEST_PWD`(+필요시 경로/provider)를 시크릿으로 주입하면 통합까지 검증.
- 통합은 **x64 프로세스 + ACE 드라이버** 필요(테스트 프로젝트 `PlatformTarget=x64`).
