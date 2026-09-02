# CapsSync — CAPS 근태 실시간 연동 에이전트

CAPS 출입통제 시스템의 Access `.mdb`에 출퇴근이 찍히면, 몇 초 안에 그룹웨어로 넘기는 사내 PC 상주 프로그램.

```
직원이 출/퇴근을 찍는다
        │
        ▼
   ACCESS.mdb  (CAPS PC에 그대로 — 옮기거나 복사하지 않는다)
        │
        │  CapsSync.exe (상주) 가 5초마다 읽기 전용으로 SELECT
        ▼
   바뀐 행만 추림  ──HMAC 서명 POST──▶  caps-ingest 함수 ──▶ 그룹웨어 근태 화면
```

## 어디부터 보면 되나

| 문서 | 내용 |
|---|---|
| **[docs/deployment-guide.md](docs/deployment-guide.md)** | **배포 담당자는 여기부터.** 설치·설정·검증·운영·트러블슈팅 전 과정 |
| [CapsSync/README.md](CapsSync/README.md) | 프로그램 자체(빌드·실행 모드·설정값) |
| [docs/ingest-api-and-schema.md](docs/ingest-api-and-schema.md) | 서버가 받는 형식·저장 규칙 (웹 담당자용) |
| [docs/testing.md](docs/testing.md) | 테스트 실행 방법과 커버리지 |

## 빌드

Windows + Visual Studio 2022(또는 .NET SDK). 대상은 **.NET Framework 4.8** — Windows 10/11에
기본 탑재라 배포 PC에 런타임을 설치할 필요가 없다.

```powershell
dotnet build CapsSync.sln -c Release
dotnet test                              # 단위 테스트 (통합은 mdb 없으면 자동 스킵)
```

산출물: `CapsSync/bin/Release/net48/CapsSync.exe`

## 5분 안에 확인하기

```powershell
# 1) 설정 템플릿 복사 후 MdbPath·MdbPassword 채우기
copy CapsSync\config.example.json CapsSync\bin\Release\net48\config.json

# 2) 전송 없이 설정·DB 연결만 점검 — "판정: 이상 없음" 이 나와야 한다
CapsSync\bin\Release\net48\CapsSync.exe --check
```

`--check`가 지금 어느 DB를 보고 있는지, 열리는지, 어디로 보내는지 전부 출력한다.
그 다음은 [배포 가이드](docs/deployment-guide.md)를 따라가면 된다.

## ⚠️ 커밋 전 반드시 확인

이 프로그램은 **실제 근태 개인정보**(직원 실명 + 출퇴근 시각)와 **두 개의 비밀**
(mdb 비밀번호, 서버와 공유하는 HMAC 시크릿)을 다룬다.

- `config.json`(비밀번호), `secret.txt`(시크릿), `*.mdb`(개인정보),
  `last_payload.json`·`last_run_summary.txt`·`log.txt`(실데이터)는 **커밋 금지**다.
- [.gitignore](.gitignore)가 막고 있지만, 새 산출물을 만들면 **거기 먼저 추가**할 것.
- 한 번 커밋되면 히스토리에 영구히 남는다.

실제 `.mdb`는 저장소에 없다. CAPS 담당자에게 받아서 로컬에만 두고 쓸 것.
