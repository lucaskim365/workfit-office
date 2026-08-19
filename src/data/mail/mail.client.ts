import type { MailGateway } from './mail.gateway';
import { appwriteMailGateway, isAppwriteMailConfigured } from './appwriteMail.gateway';
import { isMailHubBridgeConfigured, mailHubGateway } from './mailhub.gateway';
import { mockMailGateway } from './mock.gateway';

/**
 * 샘플 데이터 모드.
 *
 * **명시적으로 켤 때만** 동작한다. 예전에는 메일 서버 설정이 없으면 자동으로 샘플 데이터로
 * 떨어졌는데, 그러면 서버가 안 붙은 배포에서 가짜 메일이 진짜처럼 보인다. 사용자는 자기
 * 메일함을 보고 있다고 믿고, 보낸 적 없는 메일을 보냈다고 여긴다.
 *
 * 화면 작업용으로 필요할 때만 `VITE_MAIL_SAMPLE_DATA="true"`로 켠다.
 */
const useSampleData = import.meta.env.VITE_MAIL_SAMPLE_DATA === 'true';

/**
 * MailHub 개발 브리지를 계속 쓸지.
 *
 * 브리지는 폐기 대상이다(Appwrite Function이 대체). 다만 메일 읽기·보내기 이식이 끝나기
 * 전까지는 그쪽이 유일하게 동작하는 경로라, 되돌릴 수 있게 opt-in 스위치로 남겨 둔다.
 * `VITE_MAIL_USE_MAILHUB="true"` + 브리지 URL·토큰이 모두 있을 때만 쓴다.
 */
const preferMailHub = import.meta.env.VITE_MAIL_USE_MAILHUB === 'true' && isMailHubBridgeConfigured;

/** 메일 서버가 붙어 있는지. 붙어 있지 않으면 화면은 기능을 열지 않는다. */
export const isMailBackendReady = isAppwriteMailConfigured || preferMailHub;

export const isMailSampleData = useSampleData && !isMailBackendReady;

/**
 * 화면이 쓰는 gateway 구현체를 고르는 단 한 곳.
 *
 * 화면과 훅은 `MailGateway`만 알기 때문에 어느 쪽이 붙어도 이 파일 밖은 손대지 않는다.
 *
 * 우선순위는 **Appwrite Function → MailHub 브리지 → 목업**이다. Function이 운영 경로이고,
 * 브리지는 위 스위치를 켰을 때만 쓰인다.
 */
export const mailGateway: MailGateway = preferMailHub
  ? mailHubGateway
  : isAppwriteMailConfigured
    ? appwriteMailGateway
    : mockMailGateway;
