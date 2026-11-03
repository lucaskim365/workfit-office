import { checkDeviceEnvironment } from './IosPwaGuideModal';

/**
 * 알림을 켤 수 없는 이유와 푸는 방법 (기기·브라우저별).
 * 한 번 차단하면 브라우저는 요청 창을 다시 띄우지 않으므로, 사용자가 설정에서 직접 풀어야 한다.
 */
export interface PushGuide {
  /** 한 줄 요약 */
  title: string;
  /** 따라 할 순서 */
  steps: string[];
  /** 설정을 바꾼 뒤 [다시 확인]으로 해결되는 경우 true. 앱 안 브라우저처럼 여기서 안 되는 경우 false */
  recheckable: boolean;
}

/** 이 환경에서 알림을 요청할 수조차 없으면 그 안내. 요청해도 되면 null. */
export function pushUnavailableGuide(): PushGuide | null {
  const env = checkDeviceEnvironment();
  if (env.isInApp) {
    return {
      title: '카카오톡·네이버 같은 앱 안의 화면에서는 알림을 받을 수 없어요.',
      steps: [
        env.isIos
          ? '오른쪽 아래(또는 위) 메뉴에서 "Safari로 열기"를 눌러 주세요.'
          : '오른쪽 위 메뉴에서 "다른 브라우저로 열기"를 눌러 Chrome에서 열어 주세요.',
        '홈 화면에 WorkFit 앱을 설치했다면, 설치한 앱에서 알림을 켜 주세요.',
      ],
      recheckable: false,
    };
  }
  if (env.isIos && !env.isStandalone) {
    return {
      title: '아이폰은 홈 화면에 설치한 앱에서만 알림을 받을 수 있어요.',
      steps: ['Safari 아래쪽 공유 버튼 → "홈 화면에 추가"로 설치해 주세요.', '설치한 WorkFit 앱을 열고 알림을 켜 주세요.'],
      recheckable: false,
    };
  }
  return null;
}

/** 알림이 차단(denied)됐을 때 푸는 방법 */
export function pushBlockedGuide(): PushGuide {
  const env = checkDeviceEnvironment();
  const unavailable = pushUnavailableGuide();
  if (unavailable) return unavailable;

  const title = '이 기기에서 WorkFit 알림이 차단되어 있어요. 한 번 차단하면 앱에서 다시 켤 수 없어 설정에서 직접 풀어야 해요.';
  const last = '바꾼 뒤 앱으로 돌아와 [다시 확인]을 눌러 주세요.';
  if (env.isIos) {
    return { title, steps: ['아이폰 설정 → 알림 → WorkFit → "알림 허용"을 켜 주세요.', last], recheckable: true };
  }
  if (env.isAndroid && env.isStandalone) {
    return {
      title,
      steps: [
        '휴대폰 설정 → 애플리케이션 → WorkFit → 알림 → 허용으로 바꿔 주세요.',
        '목록에 WorkFit이 없으면: Chrome 앱 → 오른쪽 위 ⋮ → 설정 → 사이트 설정 → 알림에서 이 사이트를 허용으로 바꿔 주세요.',
        last,
      ],
      recheckable: true,
    };
  }
  if (env.isSamsung) {
    return {
      title,
      steps: ['삼성 인터넷 아래쪽 ☰ → 설정 → 사이트 및 다운로드 → 알림에서 이 사이트를 허용으로 바꿔 주세요.', last],
      recheckable: true,
    };
  }
  if (env.isAndroid) {
    return {
      title,
      steps: ['Chrome 주소창 왼쪽 아이콘 → 권한(또는 사이트 설정) → 알림 → 허용으로 바꿔 주세요.', last],
      recheckable: true,
    };
  }
  return { title, steps: ['주소창 왼쪽 아이콘 → 알림 → 허용으로 바꿔 주세요.', last], recheckable: true };
}
