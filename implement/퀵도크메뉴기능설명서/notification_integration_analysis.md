# 일정(캘린더) 푸시 알림 연동 분석 및 액션 플랜

대리님께서 주신 피드백의 핵심은 **"현재 하드코딩된 타입 분기 구조를 목적지(Data) 중심의 유연한 구조로 리팩토링하여, 새로운 알림 유형(일정, 설문 등)이 추가될 때마다 여러 파일의 삼항연산자 코드를 수정해야 하는 유지보수 비용을 줄이자"**는 것입니다.

---

## 1. 핵심 문제점과 개선 방향 요약

### ① 서비스워커(`firebase-messaging-sw.js`): 타입 분기 → 목적지 분기 (필수)
* **문제점**: 현재는 알림 클릭 시 `data.type === '결재'`를 판단하여 결재 문서 페이지로 보내고, 그 외에는 무조건 채팅 도크를 열도록 되어 있습니다. 이 구조에서는 '일정' 알림을 클릭하면 채팅 방 ID(`roomId`)가 없으므로 빈 채팅 화면이 열리게 됩니다.
* **해결책**: 푸시 알림 데이터 페이로드에 이미 포함된 목적지 정보(`roomId`, `linkUrl`)를 기준으로 분기합니다.
  * 채팅 알림은 `roomId`가 포함되므로 $\rightarrow$ `roomId`가 있으면 **채팅 도크**를 엽니다.
  * 결재 및 일정 알림 등은 `linkUrl`이 포함되므로 $\rightarrow$ `linkUrl`이 있으면 **해당 URL**로 보냅니다.
  * 이렇게 하면 서비스워커는 새로운 알림 유형의 이름('일정', '설문' 등)을 전혀 알 필요가 없어져 코드를 수정하지 않아도 됩니다.

### ② 타입별 메타데이터 통합: 삼항연산자 제거 → 단일 Map 구조화 (제안)
* **문제점**: 각 알림 타입별 아이콘, 색상, 안드로이드 알림 채널명이 `Topbar.tsx`, `QuickDock.tsx`, `useNotifications.ts` 등 여러 파일에 삼항 연산자로 흩어져 있어, 타입 추가 시 매번 모든 파일을 찾아 고쳐야 합니다.
* **해결책**: 알림 스키마 정의부인 [schema.ts](file:///c:/WorkFit/전자결재시스템/workfit-office/src/domain/liveNotification/schema.ts)에 `NOTIFICATION_TYPE_META`라는 단일 맵을 선언하고, 각 UI 컴포넌트에서는 이 맵을 참조하도록 단축시킵니다.

---

## 2. 파일별 구체적인 변경 사항 및 적용 예시

### [1] `src/domain/liveNotification/schema.ts` (타입 및 맵 추가)
- `z.enum(['결재', '메신저', '시스템'])`에 `'일정'`을 추가합니다.
- `NOTIFICATION_TYPE_META` 상수를 추가하여 타입별 아이콘, 색상, 채널 정보를 한 곳에 모읍니다.

```typescript
export const NOTIFICATION_TYPE_META = {
  결재:   { icon: '🖋️', color: '#6c5ce7', channel: 'workfit_approvals' },
  메신저: { icon: '💬', color: '#16b8cf', channel: 'workfit_messages' },
  일정:   { icon: '📅', color: '#16b8cf', channel: 'workfit_general' },
  시스템: { icon: '📢', color: '#16b8cf', channel: 'workfit_general' },
} as const;
```

### [2] `public/firebase-messaging-sw.js` (서비스워커 클릭 처리 개선)
- `isApproval` 분기 대신 `data`에 실려 있는 속성(`roomId`, `linkUrl`, `docId`) 기준으로 라우팅 목적지를 정합니다.
- PWA/모바일 화면에서 데스크톱용 주소(`linkUrl`이 `/gw/...`로 시작할 때)를 모바일 주소(`/m/...`)로 자동 치환하는 규칙을 더해주면 더욱 깔끔하게 작동합니다.

### [3] `appwrite/functions/push-notifications/src/main.js` (알림 채널 분기 개선)
- 현재 결재가 아닌 알림은 무조건 `workfit_messages` 채널로 고정 전송되는 부분을 수정하여, '일정'과 '시스템'은 일반 알림 채널인 `workfit_general`로 발송되도록 채널 ID 로직을 변경합니다.

```javascript
// 변경 전
const channelId = type === '결재' ? 'workfit_approvals' : 'workfit_messages';

// 변경 후
const channelId = type === '결재' 
  ? 'workfit_approvals' 
  : type === '메신저' 
    ? 'workfit_messages' 
    : 'workfit_general';
```

### [4] UI 컴포넌트 리팩토링 (삼항연산자 단순화)
- `Topbar.tsx` (라인 285 부근), `QuickDock.tsx` (라인 302 부근), `useNotifications.ts` (라인 52-53 부근)에 흩어진 하드코딩 삼항연산자 부분을 `NOTIFICATION_TYPE_META` 참조 방식으로 변경합니다.
```typescript
// 예시 (useNotifications.ts)
const meta = NOTIFICATION_TYPE_META[newest.type] || { icon: '📢', color: '#16b8cf' };
triggerToast(newest.type, newest.senderName, newest.text, meta.icon, meta.color);
```

---

## 3. 당신이 취해야 할 액션 플랜

현재 담당자 분이 직접 변경을 처리하시거나 저에게 역할을 위임하실 수 있습니다. 효율적인 진행을 위해 아래의 액션 중 선택하실 수 있도록 가이드를 제공합니다.

### 💡 옵션 A: AI(나)에게 변경 작업을 일임하기 (추천)
제가 이 구조를 직접 코드에 반영하고 리팩토링할 수 있습니다. 
만약 동의하신다면 바로 작업을 진행하겠습니다.

### 💡 옵션 B: 직접 코드를 단계별로 수정하기
대리님의 의견에 맞춰 직접 코딩을 하고 싶으신 경우, 다음의 순서로 진행해 주시면 됩니다.
1. [schema.ts](file:///c:/WorkFit/전자결재시스템/workfit-office/src/domain/liveNotification/schema.ts)에 `'일정'` 타입 추가 및 `NOTIFICATION_TYPE_META` 정의
2. [firebase-messaging-sw.js](file:///c:/WorkFit/전자결재시스템/workfit-office/public/firebase-messaging-sw.js)의 클릭 핸들러 목적지 분기 리팩토링
3. [main.js](file:///c:/WorkFit/전자결재시스템/workfit-office/appwrite/functions/push-notifications/src/main.js)의 `channelId` 처리 수정
4. `Topbar.tsx`, `QuickDock.tsx`, `useNotifications.ts`의 아이콘/색상 부분을 신규 맵 참조로 리팩토링
5. 변경 후, 로컬 개발 환경에서 타입 체킹 및 빌드 테스트 수행
