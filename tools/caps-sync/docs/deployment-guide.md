# CapsSync 배포 가이드 — 실시간 연동

CAPS 근태 `.mdb`에 출퇴근이 찍히면 **몇 초 안에** 그룹웨어로 넘기는 구성.

> **이전 구성(30분 스냅샷)에서 바뀐 점**
> 예전에는 CAPS PC가 30분마다 `robocopy`로 스냅샷을 뜨고, 내 PC가 그 공유를 읽어 다시 30분마다
> 전송했다. 파일이 두 번 움직이는 동안 **최악 60분이 밀렸다** — 실시간이 될 수 없는 구조였다.
> 이제 `CapsSync.exe`가 상주하면서 **DB를 그 자리에 둔 채 몇 초마다 직접 읽는다.**
> robocopy 작업·스냅샷 폴더·30분 주기 실행·**파일 복사 자체가 전부 없어졌다.**
> (기존 구성 정리는 맨 아래 [예전 구성 걷어내기](#예전-구성-걷어내기))

---

## 구조

```
직원이 출/퇴근을 찍는다
        │
        ▼
   ACCESS.mdb  (그 자리 그대로 — 우리가 옮기거나 복사하지 않는다)
        │
        │  CapsSync.exe (상주) 가 5초마다 읽기 전용으로 SELECT
        ▼
   바뀐 행만 추림  ──HMAC 서명 POST──▶  caps-ingest 함수 ──▶ 저장 ──▶ 그룹웨어 화면
```

### 연속으로 찍어도 안전한 이유

`nOutput`은 이벤트 로그가 아니라 **사람×날짜 1행짜리 집계 테이블**이다. 출근을 찍으면 그 행의
`in_time`이, 퇴근을 찍으면 같은 행의 `out_time`이 채워진다. 우리는 이벤트가 아니라
**행의 현재 상태**를 읽어 보낸다. 그래서:

- 폴링 간격 사이에 몇 명이 몇 번을 찍든, 다음 폴링이 **그 시점의 정확한 상태**를 읽는다.
- 놓칠 "이벤트"라는 개념이 없다. 빠뜨릴 수 있는 건 중간 과정뿐인데, 그건 어차피 최종 값에 반영돼 있다.
- 여러 명이 동시에 찍으면 → 여러 행이 바뀜 → 한 번의 요청에 여러 건이 담겨 나간다.

### 폴링이 동작하는 방식

Access는 변경 알림(트리거·CDC 같은 것)을 주지 않는다. 그래서 **그냥 주기적으로 읽는다.**

1. **폴링**(기본 5초) — 살아있는 `.mdb`를 읽기 전용으로 열어 최근 며칠 치를 `SELECT` 한다.
   출퇴근이 찍히고 **최대 이 시간 안에** 전송된다. 연결은 매번 열고 바로 닫는다.
2. **바뀐 행만 전송** — 읽은 행을 직전에 보낸 값(`state.json`의 지문)과 비교해 **달라진 행만** 보낸다.
   출퇴근 1건이 찍히면 실제로 나가는 건 **그 1건**이고, 아무도 안 찍으면 **아무것도 안 나간다.**
3. **전수 동기화**(기본 30분) — 폴링 창(3일) 밖의 과거 기록이 수정된 경우까지 훑는다.
   서버 `syncMeta.lastRunAt`도 여기서 갱신돼 "에이전트 살아있음"이 보인다.

유실 방지가 세 겹이다 — ①폴링이 한 번 실패해도 다음 회차가 같은 상태를 다시 읽고, ②전송이
실패하면 지문을 커밋하지 않아 다음 회차가 같은 행을 다시 보내고, ③서버가 결정적 ID로 멱등
upsert 하므로 몇 번 더 보내도 결과가 같다.

### CAPS와 부딪히지 않나 (동시 접근)

**Access에는 "세션 매니저"가 없다.** MSSQL·MySQL처럼 중재하는 서버 프로세스가 아예 없고,
각 클라이언트가 자기 프로세스에 Jet/ACE 엔진을 로드해 `.mdb` 파일을 직접 읽고 쓴다.
동시성은 참가자들끼리 **협조적으로** 관리된다:

| 수단 | 역할 |
|---|---|
| `ACCESS.ldb` 잠금 파일 | 접속자 명부. 한 명당 64바이트 슬롯(최대 255명)에 컴퓨터명+사용자명 기록 |
| `.mdb` 파일의 바이트 범위 잠금 | 실제 동시성 제어. 페이지(2~4KB) 또는 행 단위로 파일 구간에 락 |

여러 명이 같은 `.mdb`를 동시에 여는 건 Access의 **정상적인 기본 사용 시나리오**다(공유 폴더에
백엔드 mdb를 두고 여러 명이 쓰는 게 전형적인 배포 형태). 우리는 그중 **읽기만 하는 클라이언트
하나**로 붙는다.

**우리가 구조적으로 못 하는 것** — 연결 문자열이 `Mode=Read`라 **쓰기 자체가 불가능**하다
(UPDATE를 시도해도 엔진이 거부한다). 따라서:

- **쓰기 충돌을 만들 수 없다** — 충돌은 writer 둘 사이에서만 생기는데 우리는 writer가 아니다.
- **데이터를 손상시킬 수 없다** — Access 손상은 압도적으로 *쓰기 도중 중단*(전원·네트워크 끊김,
  크래시)에서 온다. 읽기 전용 클라이언트는 원인이 될 수 없다.

**우리가 유일하게 방해할 수 있는 지점 — 배타 접근.** CAPS가 압축/복구(Compact & Repair)·백업·
단독 모드 열기를 하려면 **배타 접근**이 필요한데, 그때 우리가 `.ldb` 슬롯을 붙들고 있으면
*"데이터베이스가 사용 중입니다"* 로 실패할 수 있다. 그래서 연결 문자열에 `OLE DB Services=-4`로
**세션 풀링을 꺼 두었다** — 안 그러면 풀이 물리적 연결을 유휴 60초쯤 붙들어서, 5초 폴링에선
슬롯을 24시간 점유하게 된다. 지금은 폴링과 폴링 사이에 우리 잠금이 완전히 사라져 그런 작업이
끼어들 수 있다.

> 그래도 CAPS 유지보수 작업이 실패한다면 그 시간 동안만 에이전트를 멈추면 된다:
> `Stop-ScheduledTask -TaskName CapsSync` → 작업 후 `Start-ScheduledTask`.
> 멈춘 동안의 변경은 재시작 시 "기동 직후 전수 동기화"가 따라잡는다.

**발자국을 더 줄이고 싶으면** `PollSeconds`를 늘리면 된다(5 → 15). 실시간성과 맞바꾸는 값이다.

> ⚠️ **DB 폴더에 쓰기 권한이 필요하다.** Access 엔진은 **읽기로 열 때도** `ACCESS.ldb`에 자기
> 슬롯을 기록하기 때문이다. 그래서 완전한 읽기 전용 폴더/공유로는 열리지 않는다.
> `CapsSync.exe --check`의 `열기 시험` 줄이 이걸 그대로 확인해 준다.

---

## 방식 고르기

| | **A. CAPS PC에서 상주 (권장)** | **B. 내 PC에서 공유로 상주** |
|---|---|---|
| 지연 | 폴링 주기(기본 5초) | 폴링 주기(기본 5초) |
| CAPS PC에 설치 | 필요(exe 1개 + 작업 1개) | 불필요 |
| 공유 권한 | 불필요 | **쓰기 권한 필요**(`.ldb` 때문) — 읽기 전용 공유로는 안 됨 |
| 네트워크 | 없음(로컬 파일) | 5초마다 SMB로 Jet 페이지 읽기 — 꽤 수다스럽다 |

**A를 강하게 권장한다.** B는 ① CAPS DB 폴더에 다른 PC의 쓰기 권한을 열어야 하고(보안이 나빠진다),
② Access를 네트워크 공유 너머로 읽는 건 원래 느리고 불안정하다. CAPS PC에 아무것도 설치할 수
없는 경우에만 B로 간다.

---

## 사전 준비

### 전제
- 배포할 PC(A면 CAPS PC, B면 내 PC)에 **관리자 권한**으로 로그인 가능.
- .NET Framework 4.8 — Windows 10/11에 기본 탑재라 설치할 것 없음.
- 64비트 ACE(`Microsoft.ACE.OLEDB.16.0`). 없으면 Access Database Engine 재배포판 설치, 또는
  x86 빌드 + `Microsoft.Jet.OLEDB.4.0` 폴백.

### 먼저 채울 값

| 항목 | 확인 명령 | 내 값 |
|---|---|---|
| CAPS DB 실제 경로 | (CAPS PC) 아래 명령 | `______` |
| mdb 비밀번호 | CAPS 담당자 | `______` |
| 인제스트 URL | 아래 [수신 엔드포인트](#수신-엔드포인트-정하기) 참고 | `______` |
| HMAC 시크릿 | 아래에서 새로 생성 | `______` |

```powershell
# CAPS PC에서 실제 .mdb 위치 찾기 (경로가 문서 예시 C:\CAPS 와 다를 수 있음)
Get-ChildItem C:\ -Recurse -Filter *.mdb -ErrorAction SilentlyContinue |
  Select-Object FullName, Length, LastWriteTime
```
> **CAPS가 지금 쓰고 있는 파일**을 골라야 한다. `LastWriteTime`이 방금인 것, 그리고 같은 폴더에
> `ACCESS.ldb`(잠금 파일)가 있는 것이 살아있는 DB다.

### 수신 엔드포인트 정하기

받는 쪽은 **Appwrite Function `caps-ingest`** 다(`appwrite/functions/caps-ingest/`). 옛 Vercel
`/api/ingest`는 이 함수로 이관됐으므로 **`https://<그룹웨어-도메인>/api/ingest`를 쓰면 안 된다.**

에이전트는 원문 JSON을 그대로 POST하고 헤더는 `X-Caps-Timestamp`·`X-Caps-Signature` 둘뿐이다.
Appwrite가 이런 요청을 받는 경로는 하나뿐이다:

| 경로 | 에이전트가 쓸 수 있나 |
|---|---|
| **함수 도메인** (`https://caps-ingest.<region>.appwrite.run/` 또는 커스텀 도메인) | ✅ 원문이 그대로 `req.bodyRaw`로 전달됨 |
| executions API (`/v1/functions/caps-ingest/executions`) | ❌ `x-appwrite-project` 헤더 + JSON 봉투가 필요 — 에이전트는 못 만듦 |

→ **Appwrite 콘솔에서 `caps-ingest` 함수에 도메인을 붙이고, 그 URL을 `IngestUrl`에 넣는다.**

> **선행 조건(2026-08-25 기준 미완):** 함수가 **운영에 배포돼 있지 않고**, 운영 DB에
> `employees`·`attendance` 컬렉션도 없다. 함수 변수 `CAPS_INGEST_SECRET`도 등록해야 한다
> (에이전트 `secret.txt`와 같은 값). 남은 일 목록은 `jwheo/BACKLOG.md` §2 참고.
>
> 엔드포인트가 아직 없어도 **1~3단계는 지금 진행할 수 있다** — `"SendEnabled": false`(드라이런)로
> 두면 전송 대신 `last_payload.json`에 결과만 남긴다. 준비되면 `true`로 바꾸면 된다.

---

## 1단계 — 파일 배치

배포할 PC에 `C:\CapsSync\` 폴더를 만들고 빌드 산출물을 넣는다.

```powershell
New-Item -ItemType Directory C:\CapsSync -Force
# 빌드: dotnet build ..\CapsSync.sln -c Release
Copy-Item .\CapsSync\bin\Release\net48\CapsSync.exe        C:\CapsSync\
Copy-Item .\CapsSync\bin\Release\net48\CapsSync.exe.config C:\CapsSync\ -ErrorAction SilentlyContinue
Copy-Item .\CapsSync\config.example.json                   C:\CapsSync\config.json
```

`secret.txt` 생성 — `caps-ingest` 함수 변수 `CAPS_INGEST_SECRET`과 **완전히 같은 값**이어야 한다.

```powershell
# 랜덤 시크릿 생성 (이 값을 서버 환경변수에도 그대로 넣을 것)
$secret = [Convert]::ToBase64String((1..48 | % {Get-Random -Max 256}) -as [byte[]])
[System.IO.File]::WriteAllText("C:\CapsSync\secret.txt", $secret)
$secret   # ← 복사해서 Appwrite 콘솔의 caps-ingest 함수 변수(secret)에 등록
```

**파일 잠그기(중요):** 비번과 시크릿이 든 파일이다.
```powershell
icacls C:\CapsSync\secret.txt  /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(R)"
icacls C:\CapsSync\config.json /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(R)"
```

---

## 2단계 — config.json 채우기 (DB 위치는 여기 한 곳)

`C:\CapsSync\config.json`에서 **실제로 바꿔야 하는 건 위 네 줄**이다.

```jsonc
{
  // ── 실제 CAPS DB 위치 ──
  "MdbPath": "C:\\CAPS\\ACCESS.mdb",   // A방식: 로컬 경로 / B방식: \\\\CAPSPC\\caps\\ACCESS.mdb
  "MdbPassword": "실제비번",
  "OleDbProvider": "Microsoft.ACE.OLEDB.16.0",

  "Mode": "watch",                      // 상주 실시간 폴링
  "IngestUrl": "https://caps-ingest.<region>.appwrite.run/",  // 함수 도메인
  "SendEnabled": true,

  // ── 실시간 폴링 (기본값이면 펀치 후 ~5초 내 전송) ──
  "PollSeconds": 5,                     // DB를 다시 읽는 주기 = 실시간성
  "FullSyncMinutes": 30,
  "WatchWindowDays": 3,
  "WindowDays": 45
}
```

> 경로 항목(`SecretFilePath`·`TempDir`·`LogPath`·`SummaryPath`·`StatePath`)을 비워 두면 전부
> **exe 폴더 기준**이라 `C:\CapsSync\` 한 곳에 다 모인다. 특별한 이유 없으면 비워 둘 것.

### 설정이 맞는지 확인 — `--check`

**아무것도 전송하지 않고** 지금 설정이 어디를 보고 있는지 출력한다. 배포 시 제일 먼저 돌릴 것.

```powershell
& C:\CapsSync\CapsSync.exe --check
```
```
===== CapsSync 설정 점검 =====
config.json  : C:\CapsSync\config.json

[DB — 실제로 읽는 위치]
  MdbPath    : C:\CAPS\ACCESS.mdb
  파일        : 있음 (12.4 MB)
  마지막 수정  : 2026-09-02 10:03:22 (3분 전)
  잠금 파일    : C:\CAPS\ACCESS.ldb 있음 → CAPS가 DB를 열어둔 상태(정상)
  Provider   : Microsoft.ACE.OLEDB.16.0 (이 프로세스는 x64)
  비밀번호     : 설정됨(8자)
  열기 시험    : 성공 — 최근 45일 근태 496건 / 직원 14명 / 공휴일 8건
  최신 기록    : 2026-09-02 홍길동 08:12~--:--

[전송]
  SendEnabled: true (실제 전송)
  IngestUrl  : https://caps-ingest.fra.appwrite.run/
  secret.txt : C:\CapsSync\secret.txt (64자)

[실시간 폴링]
  Mode       : watch
  폴링 주기    : 5초  (= 펀치 후 최대 이만큼 뒤에 전송)
  전수동기화   : 30분
  창          : 폴링 3일 / 전수 45일
  상태 캐시    : C:\CapsSync\state.json (아직 없음 — 첫 실행이 창 전체를 보낸다)

[로그·산출물]
  LogPath    : C:\CapsSync\log.txt
  요약 txt    : C:\CapsSync\last_run_summary.txt

판정: 이상 없음
```

`★` 표시가 붙은 줄이 고쳐야 할 항목이다. **`판정: 이상 없음`이 나오기 전엔 다음 단계로 가지 말 것.**
종료 코드도 0(정상)/1(문제)이라 스크립트에서 쓸 수 있다.

---

## 3단계 — B방식일 때만: CAPS PC 공유

A방식(CAPS PC에 설치)이면 **이 단계는 건너뛴다.**

B는 **살아있는 `.mdb`가 든 폴더**를 공유하고, 내 PC의 CapsSync가 그 파일을 네트워크 너머로 직접
연다(복사·robocopy 없음).

> ⚠️ **읽기 전용 공유로는 안 된다.** Access 엔진이 읽기로 열 때도 잠금 파일(`ACCESS.ldb`)에
> 자기 슬롯을 써야 하기 때문이다. 그래서 아래는 **쓰기 권한을 주는** 설정이다. CAPS DB 폴더에
> 다른 PC의 쓰기 권한을 여는 셈이라 보안이 나빠진다 — 가능하면 A방식을 쓸 것.

### 개념: 윈도우 공유는 권한이 "두 겹"
공유 권한(네트워크 관문)과 NTFS 권한(파일 자체) **둘 다** 있어야 접근된다. 하나만 주면 "접근 거부".

### CAPS PC (관리자 PowerShell)

```powershell
$capsDir = "C:\CAPS"   # ← 실제 CAPS DB 폴더

# (1) 내 PC가 접속할 전용 계정 (비번은 지금 새로 정함)
$pw = Read-Host "capspull 비밀번호" -AsSecureString
New-LocalUser -Name capspull -Password $pw -PasswordNeverExpires -AccountNeverExpires
Add-LocalGroupMember -Group "Users" -Member capspull      # 관리자 아님 — 최소권한

# (2) 공유 권한: .ldb 를 써야 하므로 Change 필요 (ReadAccess 로는 열리지 않는다)
New-SmbShare -Name caps -Path $capsDir -ChangeAccess capspull

# (3) NTFS 권한: 이거 빼먹으면 접속 시 "접근 거부"
icacls $capsDir /grant "capspull:(OI)(CI)(M)"

# (4) 네트워크 프로필 개인 + 파일공유 방화벽
Get-NetConnectionProfile                                   # Public 이면 아래로 변경
Set-NetConnectionProfile -InterfaceAlias "이더넷" -NetworkCategory Private
Enable-NetFirewallRule -DisplayGroup "파일 및 프린터 공유" -Profile Private

# (5) 확인
Get-SmbShare -Name caps; Get-SmbShareAccess -Name caps
```

> **권장:** 445 포트를 내 PC IP에서만 열어 범위를 좁힌다.
> ```powershell
> Set-NetFirewallRule -DisplayName "파일 및 프린터 공유(SMB-In)" -RemoteAddress 192.168.0.42
> ```

### 내 PC — 자격증명 등록 + 검증

```powershell
# 1) 포트 도달 — TcpTestSucceeded : True 여야 함
Test-NetConnection CAPSPC -Port 445

# 2) 자격증명 등록 (대화형으로 비번 입력)
cmdkey /add:CAPSPC /user:CAPSPC\capspull /pass
cmdkey /list:CAPSPC

# 3) 실제 접속
dir \\CAPSPC\caps
```
> ⚠️ 자격증명은 **사용자별로 저장**된다. 4단계 작업을 **이 자격증명을 등록한 그 사용자**로 실행해야
> 공유에 붙는다. (SYSTEM으로 돌리면 못 붙음 — 4단계 B쪽 스크립트가 그렇게 되어 있다.)

그리고 `config.json`의 경로를 공유로:
```jsonc
"MdbPath": "\\\\CAPSPC\\caps\\ACCESS.mdb"
```
바꿨으면 **`CapsSync.exe --check`를 다시 돌려** `판정: 이상 없음`을 확인한다.

---

## 4단계 — 상주 실행 등록

먼저 **손으로 한 번 띄워** 눈으로 확인한다(Ctrl+C로 중지).

```powershell
& C:\CapsSync\CapsSync.exe --watch
```
```
2026-09-02 10:20:01 === CapsSync 시작 (watch — 실시간 폴링) ===
2026-09-02 10:20:01 DB          : C:\CAPS\ACCESS.mdb (원본을 직접 읽기 전용으로 연다)
2026-09-02 10:20:01 주기         : 폴링 5초 / 전수동기화 30분
2026-09-02 10:20:03 [기동 직후 전수 동기화] 읽음 496건 → 변경분 근태 496 / 직원 14 / 공휴일 8
2026-09-02 10:20:04 전송 성공 (200): {"ok":true,...}
2026-09-02 10:23:47 [폴링] 읽음 42건 → 변경분 근태 1 / 직원 0 / 공휴일 0
2026-09-02 10:23:47 전송 성공 (200): {"ok":true,...}
```
첫 줄 뭉치(496건)는 **최초 1회**다. 이후로는 실제로 바뀐 행만 나간다.
지문 캐시(`state.json`)가 생겼기 때문 — 지우면 다시 전체를 보낸다.

### 작업 스케줄러에 "상주"로 등록

30분 주기 트리거가 **아니다.** 부팅 시 한 번 떠서 계속 살아 있고, 죽으면 다시 뜨는 형태다.

```powershell
$action = New-ScheduledTaskAction -Execute "C:\CapsSync\CapsSync.exe" -Argument "--watch"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `   # 0 = 무제한 (상주라 반드시 필요)
    -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 999 `
    -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# ── A방식(CAPS PC 로컬): SYSTEM 으로 ──
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

Register-ScheduledTask -TaskName "CapsSync" -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Description "CAPS 근태 실시간 인제스트(상주)"
```

**B방식(공유를 읽는 내 PC)** 은 SYSTEM이 아니라 **자격증명을 등록한 그 사용자**로 등록해야 한다:
```powershell
$cred = Get-Credential -Message "CapsSync 실행 계정 (cmdkey 등록한 그 사용자)" `
                       -UserName "$env:USERDOMAIN\$env:USERNAME"
Register-ScheduledTask -TaskName "CapsSync" -Action $action -Trigger $trigger -Settings $settings `
    -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Highest `
    -Description "CAPS 근태 실시간 인제스트(상주)"
```

시작하고 확인:
```powershell
Start-ScheduledTask -TaskName "CapsSync"
Get-ScheduledTask -TaskName "CapsSync" | Select-Object State        # Running 이어야 함
Get-Process CapsSync -ErrorAction SilentlyContinue                  # 프로세스 살아있는지
Get-Content C:\CapsSync\log.txt -Tail 20
```

> `State`가 `Running`으로 **계속 머물러야** 정상이다. `Ready`로 돌아가 있으면 프로세스가 죽은 것 →
> `log.txt` 확인. (`ExecutionTimeLimit`을 0으로 안 주면 3일 뒤 강제 종료된다.)

---

## 5단계 — 실시간 동작 검증

1. **CAPS에서 출퇴근을 한 건 찍는다**(또는 CAPS 관리화면에서 근태를 한 건 수정).
2. 몇 초 뒤 로그에 그 건이 찍히는지:
   ```powershell
   Get-Content C:\CapsSync\log.txt -Wait -Tail 5     # 실시간으로 흐르는 로그 보기
   ```
   `[폴링] 읽음 N건 → 변경분 근태 1 / ...` + `전송 성공 (200)` 이 나오면 성공.
   아무도 안 찍는 동안엔 로그가 조용하다 — 조용한 폴링은 기록하지 않는다(정상).
3. 그룹웨어 근태 화면에서 그 기록이 보이는지 확인.
4. 요약 txt를 메모장으로 열어도 같은 내용이 보인다: `C:\CapsSync\last_run_summary.txt`

**전송 없이 먼저 보고 싶으면** `config.json`의 `"SendEnabled": false`로 두고 돌린다.
전송 대신 `last_payload.json`에 "보냈을 내용"이 저장된다. 확인 후 `true`로 되돌릴 것.
드라이런은 **별도 상태 파일**(`state.dryrun.json`)을 쓰므로, `true`로 바꾸면 실제 전송은
깨끗한 상태에서 창 전체를 한 번 보내고 그 뒤로 변경분만 나간다.

---

## 운영 / 모니터링

**가장 쉬운 확인 = 요약 txt를 메모장으로 열기** (`C:\CapsSync\last_run_summary.txt`):
```
===== CapsSync 실행 요약 =====
모드     : watch
갱신시각 : 2026-09-02 10:23:47
트리거   : 폴링
전송     : 전송 성공 — 변경분 근태 1 / 직원 0 / 공휴일 0
마지막 성공: 2026-09-02 10:23:47 (12초 전)
DB       : C:\CAPS\ACCESS.mdb
윈도우   : 2026-08-30 ~ 오늘
이번 전송 : 근태 1 / 직원 0 / 공휴일 0

[이번에 보낸 근태 5건]
  홍길동 2026-09-02  08:12~18:15  정상  (기본540분 연장15분)
```
`마지막 성공`이 몇 분 이상 벌어져 있으면 문제다 — 정상이면 최소 `FullSyncMinutes`(30분)마다
하트비트가 나가므로 항상 30분 이내여야 한다.

```powershell
# 상주 상태
Get-ScheduledTask -TaskName CapsSync | Select-Object State     # Running
Get-Process CapsSync | Select-Object StartTime, CPU

# 최근 로그 / 실시간 추적
Get-Content C:\CapsSync\log.txt -Tail 30
Get-Content C:\CapsSync\log.txt -Wait -Tail 5

# 설정·연결 재점검 (전송 안 함, 상주 중에 돌려도 안전)
& C:\CapsSync\CapsSync.exe --check
```

### 손으로 개입해야 할 때

```powershell
# 한 번만 강제 동기화 (상주와 별개로, 지금 즉시)
& C:\CapsSync\CapsSync.exe --once

# 전부 다시 보내기 (지문 캐시를 비우고 창 전체 재전송 — 서버가 멱등이라 안전)
Stop-ScheduledTask -TaskName CapsSync
& C:\CapsSync\CapsSync.exe --once --resync
Start-ScheduledTask -TaskName CapsSync

# 잠시 멈춤 / 재개
Stop-ScheduledTask  -TaskName CapsSync
Start-ScheduledTask -TaskName CapsSync
```

- **놓친 구간은 자동 복구된다**: 재부팅·일시정지 후 다시 뜨면 기동 직후 전수 동기화가 밀린 구간을
  덮어쓴다. PC가 꺼져 있는 동안만 멈추고, 켜지면 따라잡는다.
- 전송이 실패해도 지문을 커밋하지 않으므로 **다음 회차가 같은 행을 다시 보낸다**(데이터 손실 없음).

---

## 트러블슈팅

| 증상 / 에러 | 원인 | 해결 |
|---|---|---|
| 작업 `State`가 곧 `Ready`로 돌아감 | 프로세스가 죽음 | `log.txt` 확인. `ExecutionTimeLimit`이 0인지 |
| 변경했는데 반응 없음 | CAPS가 아직 커밋하지 않음 | 커밋 전 데이터는 다른 연결에서 안 보인다. 커밋되면 다음 폴링이 잡는다 |
| `이미 같은 DB를 감시하는 CapsSync 가 실행 중` | 중복 실행 | 정상 방어. `Get-Process CapsSync`로 기존 것 확인 |
| `열기 시험` 실패 / 상주 중 반복 실패 | DB 폴더에 쓰기 권한이 없어 `.ldb` 생성 불가 | 폴더에 쓰기 권한 부여(3단계). 읽기 전용 공유로는 안 됨 |
| `이미 사용 중` / 공유 위반 | CAPS가 배타 모드로 열었음(압축·복구 중 등) | 일시적이면 다음 폴링이 복구. 지속되면 CAPS 설정 확인 |
| `ACE.OLEDB … 등록되지 않음` | x64 프로세스에 ACE 없음 | Access Database Engine 재배포판 설치, 또는 x86 빌드 + Jet |
| `Not a valid password` | MdbPassword 오타 | `--check`의 `열기 시험` 줄로 확인 |
| HTTP 401 | 시크릿 불일치 / 시각 오차 | `secret.txt` == 서버 `CAPS_INGEST_SECRET`. PC 시계 동기화(`w32tm /resync`) |
| `Test-NetConnection … 445` = False (B) | 방화벽·프로필 Public | 3단계 (4) |
| 시스템 오류 5 / 1326 / 53 (B) | NTFS·공유 권한 / 계정 / 이름해석 | 3단계 (2)(3), `CAPSPC\capspull` 형식, IP로 시도 |
| CapsSync `접근 거부`(UNC) (B) | 작업이 SYSTEM으로 실행됨 | 4단계 B쪽 — 자격증명 등록한 사용자로 등록 |

---

## 예전 구성 걷어내기

30분 스냅샷 구성을 쓰고 있었다면 함께 정리한다. 남겨두면 스냅샷을 계속 뜨면서 디스크만 먹는다.

```powershell
# CAPS PC — robocopy 스냅샷 작업 + 스냅샷 폴더
Unregister-ScheduledTask -TaskName "CapsSnapshot" -Confirm:$false
Remove-Item C:\caps_snapshot -Recurse -Force
Remove-SmbShare -Name caps_snapshot -Force        # 스냅샷 공유였다면

# 내 PC — 30분 주기 CapsSync 작업 (같은 이름으로 새로 등록할 것이므로 먼저 제거)
Unregister-ScheduledTask -TaskName "CapsSync" -Confirm:$false
```
> A방식으로 옮겼다면 `capspull` 계정·공유·자격증명도 더 이상 필요 없다:
> `Remove-SmbShare -Name caps -Force`, `Remove-LocalUser capspull`, `cmdkey /delete:CAPSPC`

---

## 제거 / 롤백

```powershell
Stop-ScheduledTask       -TaskName "CapsSync"
Unregister-ScheduledTask -TaskName "CapsSync" -Confirm:$false
Remove-Item C:\CapsSync -Recurse -Force
# B방식이었다면 (CAPS PC)
Remove-SmbShare -Name caps -Force; Remove-LocalUser -Name capspull
cmdkey /delete:CAPSPC                                     # (내 PC)
```

---

## 체크리스트

**공통**
- [ ] 실제 `.mdb` 경로 확인(`ACCESS.ldb`가 같이 있는 살아있는 파일)
- [ ] `C:\CapsSync\`에 exe + `config.json` + `secret.txt`
- [ ] `secret.txt` == `caps-ingest` 함수 변수 `CAPS_INGEST_SECRET`
- [ ] `icacls`로 `config.json`·`secret.txt` 잠금
- [ ] **`CapsSync.exe --check` → `판정: 이상 없음`**
- [ ] `--watch` 수동 실행 → 기동 직후 전수 동기화 + `전송 성공 (200)`
- [ ] 작업 등록(AtStartup / `ExecutionTimeLimit` **0** / 재시작 999회) → `State: Running` 유지
- [ ] **실제 펀치 1건 → 몇 초 내 로그에 `변경분 근태 1` + 그룹웨어 화면에 반영**
- [ ] 예전 `CapsSnapshot` 작업·스냅샷 폴더 제거

**B방식 추가**
- [ ] CAPS PC: `caps` 읽기전용 공유 + **NTFS 권한** 둘 다
- [ ] 네트워크 프로필 Private + 445 방화벽(가능하면 내 PC IP로 제한)
- [ ] 내 PC: `cmdkey` 자격증명 등록 + `dir \\CAPSPC\caps` 성공
- [ ] 작업을 **자격증명 등록한 사용자**로 등록(SYSTEM 아님)
