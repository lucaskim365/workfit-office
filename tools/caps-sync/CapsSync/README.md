# CapsSync (사내 PC 에이전트)

CAPS의 Access `.mdb` 근태를 **실시간으로** 읽어 정제 → 그룹웨어 인제스트 함수(`caps-ingest`)로 push 하는 상주 콘솔앱.
Windows 10/11 + **.NET Framework 4.8**(기본 탑재, 런타임 설치 불필요).

## 동작

```
살아있는 .mdb 를 N초마다 읽기전용으로 SELECT
     → 직전에 보낸 값과 비교해 바뀐 행만 → HMAC 서명 POST
```

**DB를 그 자리에 둔 채 직접 읽는다** — 복사도, 파일 이동도 없다. 원본은 수정하지 않는다
(`Mode=Read`). 출퇴근이 찍히면 **폴링 주기(기본 5초) 안에** 전송되고, 나가는 건 **실제로 바뀐 행뿐**이다.

Access는 변경 알림을 주지 않으므로 그냥 주기적으로 읽는다. 여기에 `FullSyncMinutes`마다
창 전체를 다시 훑어 자동 복구한다.

**연속으로 찍어도 안전하다.** `nOutput`은 이벤트 로그가 아니라 사람×날짜 1행짜리 집계 테이블이라,
우리는 이벤트가 아니라 **행의 현재 상태**를 읽어 보낸다. 폴링 사이에 몇 번을 찍든 다음 폴링이
정확한 최종 상태를 읽으므로 놓칠 "이벤트"가 없다.

> ⚠️ Access 엔진은 읽기로 열 때도 잠금 파일(`.ldb`)에 자기 슬롯을 쓴다.
> **DB 폴더에 쓰기 권한이 필요하다** — 읽기 전용 공유로는 열리지 않는다(`--check`로 확인).

**유실 방지 3중:** ①감지를 놓쳐도 전수 동기화가 잡고 ②전송 실패 시 지문을 커밋하지 않아 다음 회차가
같은 행을 다시 보내고 ③서버가 결정적 ID로 멱등 upsert 하므로 몇 번 더 보내도 결과가 같다.

## 실행 모드

| 명령 | 하는 일 |
|---|---|
| `CapsSync.exe` | `config.json`의 `Mode`대로 (기본 `watch`) |
| `CapsSync.exe --watch` | 상주하며 DB를 실시간 폴링 |
| `CapsSync.exe --once` | 한 번 훑고 종료 (수동 점검·복구) |
| `CapsSync.exe --check` | **전송 없이** 설정·DB 연결 상태만 출력 |
| `CapsSync.exe --once --resync` | 지문 캐시를 비우고 창 전체 재전송 |
| `CapsSync.exe --help` | 도움말 |

종료 코드: `0` 성공 / `1` 실패 / `2` 설정 오류.

## 빌드

솔루션은 **리포 루트 `..\CapsSync.sln`** (앱 + 테스트 프로젝트 포함). VS에선 이 sln 을 열 것.

```
dotnet build ..\CapsSync.sln -c Release
```

- 드라이버 비트수 = 프로세스 비트수여야 함. 기본은 **x64 + `Microsoft.ACE.OLEDB.16.0`**.
- ACE로 안 열리면 `.csproj`의 `<PlatformTarget>`을 `x86`으로, `config.json`의 `OleDbProvider`를 `Microsoft.Jet.OLEDB.4.0`으로.

## 테스트

```
dotnet test                              # 단위 테스트(빠름). 통합은 자동 스킵
$env:CAPS_TEST_PWD="<mdb 비번>"; dotnet test   # 실제 mdb 읽는 통합까지
```
자세한 건 `..\docs\testing.md`.

## 설정

1. `config.example.json` → `config.json` 복사 후 값 채우기.
   **실제 DB 위치는 `MdbPath` 한 곳**이다(파일 맨 위 블록).
2. `secret.txt` 생성 — 길고 무작위한 HMAC 시크릿 1줄. 서버 `CAPS_INGEST_SECRET`과 **동일 값**.
   ```powershell
   $s = [Convert]::ToBase64String((1..48 | % {Get-Random -Max 256}) -as [byte[]])
   [System.IO.File]::WriteAllText("C:\CapsSync\secret.txt", $s); $s
   ```
3. **확인:** `CapsSync.exe --check` → 지금 어느 DB를 보고 있는지·열리는지·어디로 보내는지 전부 출력.
   `판정: 이상 없음`이 나와야 한다.
4. **파일 잠그기(중요):** `config.json`, `secret.txt`는 실행 계정만 읽게 NTFS 권한 제한.
   ```powershell
   icacls C:\CapsSync\secret.txt /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(R)"
   ```

### 주요 설정값

| 키 | 기본 | 뜻 |
|---|---|---|
| `MdbPath` | — | **실제 CAPS DB 경로.** 로컬 또는 UNC |
| `MdbPassword` | — | mdb 비밀번호 |
| `Mode` | `watch` | `watch`(상주) / `once` / `check` |
| `PollSeconds` | 5 | **DB를 다시 읽는 주기(초). 이게 곧 실시간성** |
| `FullSyncMinutes` | 30 | 변경이 없어도 창 전체 재확인 + 서버에 하트비트 |
| `WatchWindowDays` | 3 | 폴링이 훑는 최근 일수(짧을수록 가볍다) |
| `WindowDays` | 45 | 전수 동기화가 훑는 일수 |
| `StatePath` | exe 폴더 | 지문 캐시. 지우면 다음 실행이 창 전체 재전송 |
| `SendEnabled` | true | false면 전송 대신 `last_payload.json`으로만 저장(드라이런) |

경로 항목을 비워 두면 전부 exe 폴더 기준이라 한 폴더에 모인다.

## 상주 등록 (작업 스케줄러)

주기 실행이 **아니다.** 부팅 시 떠서 계속 살아 있고, 죽으면 다시 뜬다.

```powershell
$action = New-ScheduledTaskAction -Execute "C:\CapsSync\CapsSync.exe" -Argument "--watch"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `        # 0 = 무제한 (상주라 반드시)
    -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 999
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Register-ScheduledTask -TaskName "CapsSync" -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal
```

- `Get-ScheduledTask CapsSync | Select State` 가 **`Running`으로 계속 머물러야** 정상.
- 공유(UNC)를 읽는 구성이면 SYSTEM이 아니라 **자격증명을 등록한 사용자**로 등록해야 한다.
- 상세 절차·검증·트러블슈팅은 `..\docs\deployment-guide.md`.

## 파일

| 파일 | 설명 |
|---|---|
| `Program.cs` | 모드 분기·폴링 루프·읽기·정제·서명·전송 |
| `SyncState.cs` | 지문 캐시 — "바뀐 행만" 골라내는 비교 로직 |
| `config.example.json` | 설정 템플릿 |
| `CapsSync.csproj` | net48 / x64 |
| (런타임 생성) `config.json`, `secret.txt`, `state.json` | **git 커밋 금지** |

전송 형식·서버 처리 계약은 `../docs/ingest-api-and-schema.md` 참고.
