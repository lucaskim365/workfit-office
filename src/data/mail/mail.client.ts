import type { MailGateway } from './mail.gateway';
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

/** 메일 서버가 붙어 있는지. 붙어 있지 않으면 화면은 기능을 열지 않는다. */
export const isMailBackendReady = isMailHubBridgeConfigured;

export const isMailSampleData = useSampleData && !isMailHubBridgeConfigured;

/**
 * 화면이 쓰는 gateway 구현체를 고르는 단 한 곳.
 *
 * 화면과 훅은 `MailGateway`만 알기 때문에 어느 쪽이 붙어도 이 파일 밖은 손대지 않는다.
 * 운영 서버가 준비되면 여기에 그 구현체를 더한다. ([[jwheo/feat/mail/DESIGN.md]] §17)
 */
export const mailGateway: MailGateway = isMailHubBridgeConfigured
  ? mailHubGateway
  : mockMailGateway;
