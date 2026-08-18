import type { MailAccount } from '@/domain/mailAccount/schema';
import type { MailDetail } from '@/domain/mail/schema';

/**
 * 메일 로컬 목업 fixture.
 *
 * 실제 개인 메일 계정과 운영 비밀번호는 쓰지 않는다. 주소는 전부 가상이고 자격 증명은
 * 어디에도 없다. ([[jwheo/feat/mail/DESIGN.md]] §12)
 *
 * 계정 3개는 각각 다른 상태를 확인하려고 둔다 — 정상, 인증 실패, 빈 편지함. 화면을 붙인 뒤
 * 부분 실패와 빈 목록을 실제로 보려면 fixture에 그 상태가 있어야 한다.
 */
const AT = '2026-08-01T00:00:00.000Z';
const OWNER = 'U009';

export const MAIL_ACCOUNT_FIXTURE: MailAccount[] = [
  {
    id: 'MA-0001',
    workfitUserId: OWNER,
    displayName: '업무용 네이버',
    email: 'mgpark.work@naver.com',
    provider: 'naver',
    authType: 'app_password',
    transport: 'imap_smtp',
    status: 'active',
    verifiedAt: '2026-08-11T23:40:00.000Z',
    signature: '박명규 | 사업관리팀 부장\n워크핏 주식회사\n02-000-0000',
    lastErrorCode: null,
    createdAt: AT,
    updatedAt: '2026-08-11T23:40:00.000Z',
  },
  {
    id: 'MA-0002',
    workfitUserId: OWNER,
    displayName: '개인 다음',
    email: 'mgpark.personal@daum.net',
    provider: 'daum',
    authType: 'app_password',
    transport: 'imap_smtp',
    status: 'error',
    verifiedAt: '2026-08-05T01:00:00.000Z',
    signature: '',
    lastErrorCode: 'AUTH_FAILED',
    createdAt: AT,
    updatedAt: '2026-08-12T00:10:00.000Z',
  },
  {
    id: 'MA-0003',
    workfitUserId: OWNER,
    displayName: '예비 네이버',
    email: 'mgpark.spare@naver.com',
    provider: 'naver',
    authType: 'app_password',
    transport: 'imap_smtp',
    status: 'active',
    verifiedAt: '2026-08-11T23:40:00.000Z',
    signature: '',
    lastErrorCode: null,
    createdAt: AT,
    updatedAt: AT,
  },
];

/** 조회 시 실패를 흉내 낼 계정. 앱 비밀번호가 만료된 상황을 가정한다. */
export const FAILING_ACCOUNT_IDS: Record<string, 'AUTH_FAILED' | 'TIMEOUT' | 'PROVIDER_UNAVAILABLE'> = {
  'MA-0002': 'AUTH_FAILED',
};

/** 계정별 IMAP 세대. 메일함이 재생성되지 않는 한 고정이다. */
export const UID_VALIDITY: Record<string, string> = {
  'MA-0001': '1754000001',
  'MA-0002': '1754000002',
  'MA-0003': '1754000003',
};

const address = (email: string, name = '') => ({ name, email });

const ME = address('mgpark.work@naver.com', '박명규');

interface MailSeed {
  uid: string;
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
  replyTo: { name: string; email: string } | null;
  subject: string;
  receivedAt: string;
  seen: boolean;
  hasAttachment: boolean;
  flagged?: boolean;
  convertedFromHtml: boolean;
  messageId: string | null;
  references: string[];
  textBody: string;
  /** 서버가 정화한 HTML 본문이 있는 메일. 대부분은 없다. */
  htmlBody?: string;
}

const SEEDS: MailSeed[] = [
  {
    uid: '2041',
    from: address('sales@hanmiparts.co.kr', '한미부품 김영수'),
    to: [ME],
    cc: [address('purchase@workfit.kr', '구매팀'), address('grpark@workfit.kr', '박광래')],
    replyTo: address('order@hanmiparts.co.kr', '한미부품 주문접수'),
    subject: '9월 납품 일정 회신 요청 드립니다',
    receivedAt: '2026-08-12T04:12:00.000Z',
    seen: false,
    hasAttachment: true,
    flagged: true,
    convertedFromHtml: false,
    messageId: '<20260812-0412@hanmiparts.co.kr>',
    references: [],
    textBody: [
      '안녕하세요, 한미부품 김영수입니다.',
      '',
      '9월 납품 건 일정 확인 부탁드립니다. 첨부한 일정표 기준으로 진행 가능하신지',
      '금주 내 회신 주시면 생산 일정에 반영하겠습니다.',
      '',
      '- 1차 납품: 9월 8일',
      '- 2차 납품: 9월 22일',
      '',
      '감사합니다.',
    ].join('\n'),
  },
  {
    uid: '2040',
    from: address('no-reply@bill.example.kr', '전자세금계산서'),
    to: [ME],
    cc: [],
    replyTo: null,
    subject: '[알림] 전자세금계산서가 발행되었습니다',
    receivedAt: '2026-08-12T02:35:00.000Z',
    seen: false,
    hasAttachment: false,
    convertedFromHtml: true,
    messageId: '<bill-20260812@bill.example.kr>',
    references: [],
    htmlBody: [
      '<p><strong>전자세금계산서</strong>가 발행되었습니다.</p>',
      '<table><thead><tr><th>항목</th><th>내용</th></tr></thead><tbody>',
      '<tr><td>공급자</td><td>워크핏</td></tr>',
      '<tr><td>발행일</td><td>2026-08-12</td></tr>',
      '</tbody></table>',
      '<p><a href="https://bill.example.kr">국세청 홈택스에서 확인</a></p>',
    ].join('\n'),
    textBody: [
      '전자세금계산서가 발행되었습니다.',
      '',
      '공급자: 한미부품',
      '작성일자: 2026-08-12',
      '합계금액: 4,730,000원',
      '',
      '자세한 내용은 홈페이지에서 확인하세요.',
    ].join('\n'),
  },
  {
    uid: '2039',
    from: address('jhlee@daehanlogis.co.kr', '대한물류 이지현'),
    to: [ME, address('grpark@workfit.kr', '박광래')],
    cc: [],
    replyTo: null,
    subject: 'Re: 8월 출고 물량 정산 건',
    receivedAt: '2026-08-11T08:20:00.000Z',
    seen: true,
    hasAttachment: false,
    convertedFromHtml: false,
    messageId: '<20260811-0820@daehanlogis.co.kr>',
    references: ['<20260810-0100@workfit.kr>'],
    textBody: [
      '보내주신 정산 내역 확인했습니다.',
      '',
      '8월 3주차 물량에 차이가 있어 재확인 후 다시 회신드리겠습니다.',
      '',
      '이지현 드림',
    ].join('\n'),
  },
  {
    uid: '2038',
    from: address('newsletter@techbrief.example.com', 'Tech Brief'),
    to: [ME],
    cc: [],
    replyTo: null,
    subject: '이번 주 제조업 자동화 동향 5選',
    receivedAt: '2026-08-10T22:00:00.000Z',
    seen: true,
    hasAttachment: false,
    convertedFromHtml: true,
    messageId: '<tb-20260810@techbrief.example.com>',
    references: [],
    textBody: [
      '이번 주 주요 소식',
      '',
      '1. 스마트팩토리 도입 사례',
      '2. 설비 예지보전 트렌드',
      '3. 물류 로봇 시장 동향',
      '',
      '수신을 원하지 않으시면 홈페이지에서 해지하실 수 있습니다.',
    ].join('\n'),
  },
  {
    uid: '2037',
    from: address('support@cloudmail.example.net', '고객지원'),
    to: [ME],
    cc: [],
    replyTo: null,
    subject: '문의하신 계정 설정 안내',
    receivedAt: '2026-08-09T05:45:00.000Z',
    seen: true,
    hasAttachment: false,
    convertedFromHtml: false,
    messageId: '<sup-20260809@cloudmail.example.net>',
    references: [],
    textBody: '문의 주신 내용에 대한 안내입니다.\n\n설정 화면에서 IMAP 사용을 켜신 뒤 다시 시도해 주세요.',
  },
  {
    uid: '2036',
    from: address('ceo@sinheung.co.kr', '신흥산업 대표이사'),
    to: [ME],
    cc: [address('mgpark.spare@naver.com', '박명규')],
    replyTo: null,
    subject: '창립기념 행사 초청의 건',
    receivedAt: '2026-08-08T01:00:00.000Z',
    seen: true,
    hasAttachment: true,
    convertedFromHtml: false,
    messageId: '<inv-20260808@sinheung.co.kr>',
    references: [],
    textBody: '평소 성원에 감사드리며 창립기념 행사에 초청합니다.\n\n일시와 장소는 첨부를 참고해 주세요.',
  },
];

export const MAIL_DETAIL_FIXTURE: MailDetail[] = SEEDS.map((seed) => ({
  ref: {
    accountId: 'MA-0001',
    folder: 'INBOX' as const,
    uidValidity: UID_VALIDITY['MA-0001'],
    uid: seed.uid,
  },
  from: seed.from,
  to: seed.to,
  cc: seed.cc,
  replyTo: seed.replyTo,
  subject: seed.subject,
  preview: seed.textBody.split('\n').find((line) => line.trim() !== '')?.slice(0, 120) ?? '',
  receivedAt: seed.receivedAt,
  seen: seed.seen,
  answered: false,
  flagged: seed.flagged ?? false,
  hasAttachment: seed.hasAttachment,
  textBody: seed.textBody,
  htmlBody: seed.htmlBody ?? null,
  messageId: seed.messageId,
  references: seed.references,
  convertedFromHtml: seed.convertedFromHtml,
  // 첨부가 있다고 표시한 메일에만 목록을 붙인다. 표시와 실제가 어긋나면 화면을 못 믿는다.
  attachments: seed.hasAttachment
    ? [{ index: 0, filename: `${seed.uid}-첨부.pdf`, contentType: 'application/pdf', size: 128_000 }]
    : [],
}));
