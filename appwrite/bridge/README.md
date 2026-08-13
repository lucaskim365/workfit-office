# 듀얼 라이트 브리지 — Firestore ↔ Appwrite 양방향 동기

계획서 Phase 4. **웹=Appwrite / 모바일=Firestore 공존 기간**(웹 컷오버 P5 → 모바일 컷오버 P7)
동안 공유 컬렉션을 양방향 동기화해 두 앱이 서로의 변경을 본다.

## 1. 아키텍처

```
   ┌─────────────┐   write   ┌───────────┐
   │  모바일 앱   │─────────▶│ Firestore │
   └─────────────┘           └─────┬─────┘
                                    │ onDocumentWritten (Cloud Function)
                                    ▼  [F→A 브리지]  firestore-to-appwrite/
                              ┌───────────┐
                              │  Appwrite │
                              └─────┬─────┘
                                    │ databases.*.create/update/delete (Appwrite Function)
                                    ▼  [A→F 브리지]  appwrite-to-firestore/
   ┌─────────────┐   write   ┌───────────┐
   │   웹 앱      │─────────▶│  Appwrite │  (위와 동일 인스턴스)
   └─────────────┘           └───────────┘
```

- **F→A**: Firebase Cloud Function. Firestore 문서 write → Appwrite 로 미러.
- **A→F**: Appwrite Function. Appwrite row 이벤트 → Firestore 로 미러.
- 매핑 로직은 `shared/bridgeMap.js` (ETL 변환과 동일 규칙) 를 양쪽이 공유.

## 2. 에코 방지 — **콘텐츠 비교**(마커리스)

A→B 미러가 B의 트리거를 깨워 다시 A로 미러되는 무한루프를 막는다.
**마커 필드 대신, 미러 직전에 타깃을 읽어 도메인 내용이 같으면 쓰지 않는다(skip).**

```
변경 수신 → 타깃 문서 읽기 → contentEqual(source, target)?
   같음 → 아무것도 안 함(쓰기 X → 트리거 X → 루프 차단)
   다름 → 타깃에 쓰기
```

트레이스:
1. 모바일이 Firestore.X 수정 → F→A: Appwrite.X 와 다름 → Appwrite.X 갱신
2. Appwrite.X 갱신이 A→F 트리거 → Firestore.X 와 **내용 동일** → skip ✓ (루프 종료)

- **장점**: Appwrite 부분 업데이트로 마커가 남는 문제 없음. 스키마 오염 없음. 진짜 편집(내용 다름)은 정상 전파.
- **비용**: 이벤트당 타깃 1회 읽기. (사내 규모에서 무시 가능)
- `contentEqual` 은 **도메인 필드만** 정규 비교(시스템/타임스탬프/`$*` 제외). 미러가 도메인 내용을 동일하게 쓰므로 미러 직후 양측이 일치 → 에코 skip.

## 3. 충돌 정책

- **Last-write-wins**: 나중 쓴 쪽이 소스. 콘텐츠 비교라 "마지막 상태"가 자연히 양측에 수렴.
- 동시 양측 편집(희소): 두 미러가 교차하나, 콘텐츠 비교로 수 회 내 한 값으로 수렴(진동 후 안정). 사내 저동시성에서 실질 무영향.
- **삭제**: Firestore delete → Appwrite delete, Appwrite delete → Firestore delete (없으면 no-op).

## 4. 동기 대상 컬렉션

공유(양쪽이 쓰거나, 웹 편집을 모바일이 읽어야 하는) 컬렉션:

| 컬렉션 | 양방향성 | 매핑 |
|--------|:--:|------|
| `chatMessages` | 양방향 | json: attachment·replyTo·approvalPayload |
| `chatRooms` | 양방향 | json: lastMessage |
| `notifications` | 양방향 | 스칼라 |
| `documentExecutions` | 양방향 | 스칼라 (history 서브컬렉션은 별도) |
| `approvalDocs` | 양방향 | **payload(JSON 통짜)** ↔ Firestore 원문 |
| `users` | 양방향 | 스칼라 (fcmToken 은 모바일도 씀) |

> id 매핑: 이 컬렉션들은 Firestore 문서ID = Appwrite `$id`(ASCII 자연키, `safeDocId`=항등). 양방향 1:1.
> **마스터**(departments·forms 등, 웹만 편집)는 A→F 단방향으로 확장 가능(같은 프레임워크, 한글키는 `$id`가 해시라 자연키 attribute로 Firestore id 복원).

## 5. 배포

### F→A (Firebase Cloud Function)
`firestore-to-appwrite/` 를 기존 `functions/` 에 합치거나 별도 배포. env: `APPWRITE_ENDPOINT`·`APPWRITE_PROJECT_ID`·`APPWRITE_API_KEY`(databases 스코프)·`APPWRITE_DATABASE_ID`. `firebase deploy --only functions`.

### A→F (Appwrite Function)
`appwrite-to-firestore/` 를 Appwrite Function 으로 배포(푸시 함수와 동일 절차, CLI/콘솔).
이벤트: 6개 컬렉션 × create/update/delete. env: `FCM_SERVICE_ACCOUNT`(=Firestore 쓰기용 서비스계정, 푸시와 공용)·`APPWRITE_DATABASE_ID`.

## 6. 운영·수명

- **가동 시점**: 웹 컷오버(P5) 직전 ~ 모바일 컷오버(P7) 완료까지.
- **최종 정리**: 모바일까지 Appwrite로 넘어가면 **양쪽 브리지 비활성화**(F→A·A→F 함수 삭제), 기존 Cloud Function 푸시도 정리.
- **모니터링**: 각 함수 로그에 `mirror`/`skip(echo)`/`delete` 출력. 루프 의심 시 skip 로그로 확인.
