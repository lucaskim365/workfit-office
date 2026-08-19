import type { MailGateway } from './mail.gateway';
import { appwriteMailGateway, isAppwriteMailConfigured } from './appwriteMail.gateway';
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
export const isMailBackendReady = isAppwriteMailConfigured;

export const isMailSampleData = useSampleData && !isMailBackendReady;

/**
 * 화면이 쓰는 gateway 구현체를 고르는 단 한 곳.
 *
 * 화면과 훅은 `MailGateway`만 알기 때문에 어느 쪽이 붙어도 이 파일 밖은 손대지 않는다.
 *
 * Appwrite Function이 유일한 실제 경로다. MailHub 개발 브리지는 14개 동작이 전부
 * Function으로 이식된 뒤 폐기했다(2026-08-19) — 되살릴 일이 생기면 git 이력의
 * `mailhub.gateway.ts`를 참고하되, 브리지는 단일 사용자 전제라 소유권 검증이 없다.
 */
export const mailGateway: MailGateway = isAppwriteMailConfigured
  ? appwriteMailGateway
  : mockMailGateway;
