/**
 * Appwrite 스키마 IaC — Firestore→Appwrite 이관 Phase 0.
 * Database·Collection·Attribute·Index·Permission 을 코드로 멱등 생성한다(재실행 안전).
 * 콘솔 수작업을 대체해 Phase 1 PoC(chatMessages·notifications) 실측을 즉시 가능케 한다.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 0 산출물 / PoC 실행가이드 §2)
 *
 * 실행: npm run appwrite:schema   (내부적으로 tsx scripts/appwrite-schema.ts)
 *
 * 필요 env (.env.local 또는 프로세스 환경):
 *   APPWRITE_ENDPOINT     (없으면 VITE_APPWRITE_ENDPOINT)   예: https://appwrite.widdyax.com/v1
 *   APPWRITE_PROJECT_ID   (없으면 VITE_APPWRITE_PROJECT_ID) 예: 6a6bf85e002acb7f71d6
 *   APPWRITE_DATABASE_ID  (없으면 VITE_APPWRITE_DATABASE_ID) 예: workfit
 *   APPWRITE_API_KEY      ★서버 API 키(비밀). Console > 프로젝트 > API Keys 에서
 *                          databases.read/write + collections/attributes/indexes 스코프로 발급.
 *                          ⚠️ VITE_ 아님(번들 노출 금지). .env.local 에만 두고 Git 커밋 금지.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Client,
  Databases,
  Permission,
  Query,
  Role,
  DatabasesIndexType,
  type Models,
} from 'node-appwrite';

/**
 * `listAttributes` 는 기본 25건만 돌려준다. 속성이 그보다 많은 컬렉션(예: resources 29개)에서
 * 뒤쪽 속성이 목록에 안 잡혀 "없는 것"으로 오인되고, 재생성 → 409 → available 대기가
 * 영원히 끝나지 않는다. 모든 조회에 상한을 명시한다.
 */
const ATTR_PAGE = [Query.limit(500)];

// ─────────────────────────────────────────────────────────────
// 스키마 정의 (데이터 주도) — Phase 3에서 컬렉션을 여기 추가하면 된다.
// ─────────────────────────────────────────────────────────────
type AttrDef =
  | { kind: 'string'; key: string; size: number; required?: boolean; array?: boolean }
  | { kind: 'enum'; key: string; elements: string[]; required?: boolean; xdefault?: string }
  | { kind: 'integer'; key: string; required?: boolean; array?: boolean; xdefault?: number; min?: number; max?: number }
  | { kind: 'float'; key: string; required?: boolean; array?: boolean }
  | { kind: 'boolean'; key: string; required?: boolean; xdefault?: boolean };

interface IndexDef {
  key: string;
  type: DatabasesIndexType;
  attributes: string[];
}

interface CollectionDef {
  id: string;
  name: string;
  attributes: AttrDef[];
  indexes: IndexDef[];
  /**
   * 생성 시 컬렉션 권한. 생략하면 `POC_PERMISSIONS`(누구나 CRUD)를 쓴다.
   *
   * **빈 배열이면 서버 전용** — 브라우저가 직접 붙으면 401이고 API 키를 가진 Function만
   * 읽고 쓸 수 있다. 개인정보나 자격 증명을 담는 컬렉션은 반드시 이쪽이어야 한다.
   */
  permissions?: string[];
}

// ── 빌더 헬퍼 (가독성) ──
const S = (key: string, size: number, required = false): AttrDef => ({ kind: 'string', key, size, required });
const SA = (key: string, size: number): AttrDef => ({ kind: 'string', key, size, array: true }); // 문자열 배열
const J = (key: string, size = 16000): AttrDef => ({ kind: 'string', key, size }); // 중첩/배열-of-객체 → JSON 문자열
const EN = (key: string, elements: string[], required = false): AttrDef => ({ kind: 'enum', key, elements, required });
/**
 * Appwrite 1.9.6 실측: integer 속성에 min/max 를 **생략하면 워커가 processing 에서 멈춘다**
 * (속성이 available 로 넘어오지 않아 뒤따르는 인덱스 생성까지 막힌다).
 * 그래서 호출부가 지정하지 않으면 안전한 전범위 기본값을 넣는다 — 의미상 무제한이되
 * "지정은 된" 상태로 만드는 것이 목적이다.
 */
const INT_MIN = Number.MIN_SAFE_INTEGER;
const INT_MAX = Number.MAX_SAFE_INTEGER;
const INT = (key: string, required = false, xdefault?: number, min?: number, max?: number): AttrDef =>
  ({ kind: 'integer', key, required, xdefault, min: min ?? INT_MIN, max: max ?? INT_MAX });
const BOOL = (key: string, xdefault?: boolean): AttrDef => ({ kind: 'boolean', key, xdefault });
const IX = (name: string, attributes: string[]): IndexDef => ({
  key: `idx_${name}`,
  type: DatabasesIndexType.Key,
  attributes,
});
/** 유일 인덱스 — 같은 값 조합의 문서가 둘 생기는 것을 DB에서 막는다. */
const UQ = (name: string, attributes: string[]): IndexDef => ({
  key: `uq_${name}`,
  type: DatabasesIndexType.Unique,
  attributes,
});

/**
 * 보존 대상 컬렉션 카탈로그(계획서 §1.4). 각 정의는 zod 도메인 스키마에서 파생.
 *
 * [required 판정 규칙 — 정밀 재검토 2026-08-12]
 *   required=true  ⟺  zod에 `.min(1)`(문자열)/`.min(n)`(숫자)이 있고
 *                     `.default()`/`.optional()`/`.nullable()` 가 없음.
 *                     + 각 컬렉션의 필수 FK/소유키(roomId·userId·documentId·executionId·seq)는 강제 true.
 *   그 외(bare z.string(), default/nullable/optional, **default 없는 enum**)는 false(ETL 관용).
 *   → enum은 required=false여도 Appwrite Enum이 값 자체는 제약하며, 누락 시 앱 zod가 기본값 보충.
 *
 * [size 규칙]  zod `.max(N)` 선언 시 그 값. 없으면 역할별: id/code 64 · name 128 · url 512 ·
 *   addr/homepage 256 · tel/bizNo 32 · detail/comment 1000 · body 8000 ·
 *   JSON(J) 기본 16000, 대형(fields/steps/fieldValues) 65535.
 *
 * [타입]  z.number().int()·금액(원)→Integer · z.boolean→Boolean ·
 *   z.array(string)→String[] · 중첩객체/배열-of-객체/record/tuple→JSON 문자열(J).
 *
 * 제외: localStorage 전용(approvalProcess·absence·succession), 폐기 대상(영업 8종).
 */
const COLLECTIONS: CollectionDef[] = [
  // ── 메신저 (PoC) ──
  {
    id: 'chatMessages',
    name: '채팅 메시지',
    attributes: [
      S('roomId', 64, true),
      S('senderId', 64),
      S('senderName', 128),
      S('text', 4000),
      EN('type', ['text', 'system', 'image', 'file', 'approval_bot']),
      S('at', 40),
      SA('readBy', 64),
      BOOL('isEdited', false), // 메시지 수정 여부(팀 기능)
      J('attachment', 4000), // url/name/size/mime
      J('replyTo', 2000),
      J('approvalPayload', 2000),
    ],
    indexes: [IX('roomId', ['roomId']), IX('at', ['at'])],
  },
  {
    id: 'chatRooms',
    name: '채팅방',
    attributes: [
      S('id', 64, true),
      S('name', 128, true),
      S('type', 32),
      SA('members', 64),
      S('color', 16),
      S('createdAt', 40),
      S('createdBy', 64), // 방 생성자(팀 기능 — 생성자만 이름변경)
      S('deletedAt', 40),
      S('deletedBy', 64),
      J('lastMessage', 8000), // text/at/senderId
    ],
    indexes: [IX('type', ['type'])],
  },
  // ── 실시간 알림 (PoC) ──
  {
    id: 'notifications',
    name: '실시간 알림',
    attributes: [
      S('userId', 64, true), // FK/소유키 → 강제 required
      S('type', 20), // 결재/메신저/시스템 (한글 → String, enum-무default)
      S('title', 200),
      S('text', 2000),
      S('senderName', 128),
      S('linkUrl', 500),
      BOOL('read', false),
      S('createdAt', 40),
    ],
    indexes: [IX('userId', ['userId']), IX('createdAt', ['createdAt']), IX('userId_read', ['userId', 'read'])],
  },

  // ── 마스터 / 조직 ──
  {
    id: 'users',
    name: '사용자',
    attributes: [
      S('id', 64, true),
      S('empNo', 20, true),
      S('name', 30, true),
      S('dept', 30, true),
      S('position', 20, true),
      S('jobTitle', 20),
      S('roleGroup', 32), // enum-무default → false
      S('email', 128, true),
      S('status', 16),
      S('lastLogin', 40),
      S('managerId', 64),
      S('password', 128), // SHA-256 hex (자체 로그인)
      S('sealUrl', 512),
      S('signUrl', 512),
      S('signType', 16),
      S('photoUrl', 512),
      S('activeChatRoomId', 64),
      S('resignedAt', 40),
      S('fcmToken', 256),
    ],
    indexes: [IX('empNo', ['empNo']), IX('dept', ['dept']), IX('roleGroup', ['roleGroup'])],
  },
  {
    id: 'departments',
    name: '부서',
    attributes: [S('id', 64, true), S('name', 128, true), S('parentId', 64), S('headUserId', 64), S('deptType', 16), INT('order')],
    indexes: [IX('parentId', ['parentId'])],
  },
  {
    id: 'positions',
    name: '직급',
    attributes: [S('id', 64, true), S('name', 64, true), INT('rank', true), BOOL('isDeptHead', false)],
    indexes: [IX('rank', ['rank'])],
  },
  {
    id: 'jobTitles',
    name: '직책',
    attributes: [S('id', 64, true), S('name', 64, true)],
    indexes: [],
  },
  {
    id: 'companyInfo',
    name: '회사정보',
    attributes: [
      S('id', 64), // default('main') → false
      S('name', 128, true),
      S('nameEn', 128),
      S('bizNo', 32),
      S('corpNo', 32),
      S('ceo', 64, true),
      S('foundedDate', 40),
      S('bizType', 64),
      S('bizItem', 64),
      S('companyType', 16),
      S('fiscalStart', 8),
      BOOL('active', true),
      S('tel', 32),
      S('fax', 32),
      S('email', 128),
      S('homepage', 256),
      S('address', 256),
      S('sysName', 128),
      S('reportHeader', 256),
      S('docFooter', 256),
      S('logoUrl', 512),
      S('logoPath', 256),
      BOOL('mask', true),
    ],
    indexes: [],
  },
  {
    id: 'companySites',
    name: '사업장',
    attributes: [S('name', 128, true), S('kind', 32, true), S('addr', 256), S('tel', 32), S('mgr', 64), BOOL('active', true)],
    indexes: [],
  },
  {
    id: 'commonCodes',
    name: '공통코드',
    attributes: [
      S('groupCode', 64, true),
      S('groupName', 128),
      S('code', 64, true),
      S('name', 128, true),
      INT('order'),
      BOOL('use', true),
      S('regBy', 64),
    ],
    indexes: [IX('groupCode', ['groupCode'])],
  },

  // ── 권한 / 설정 ──
  {
    id: 'authRoles',
    name: '권한역할',
    attributes: [S('code', 64, true), S('name', 128, true), J('permissions')], // array of [bool,bool]
    indexes: [],
  },
  {
    id: 'roleGroups',
    name: '역할그룹',
    attributes: [S('code', 64, true), S('name', 128, true), S('desc', 256), BOOL('use', true), J('members'), J('permissions')],
    indexes: [],
  },
  {
    id: 'sysAdmins',
    name: '시스템관리자',
    attributes: [
      S('id', 64, true),
      S('name', 64, true),
      S('level', 32), // enum-무default → false
      S('modules', 256),
      S('status', 16),
      S('twoFa', 8),
      S('ip', 64),
      S('lastLogin', 40),
    ],
    indexes: [],
  },
  {
    id: 'backupPolicies',
    name: '백업정책',
    attributes: [S('id', 64, true), S('name', 128, true), S('cycle', 32), S('keep', 32), S('after', 32), S('size', 32), BOOL('on', false)],
    indexes: [],
  },
  {
    id: 'interfaces',
    name: '시스템 인터페이스',
    attributes: [
      S('id', 64, true),
      S('name', 128, true),
      S('target', 32), // enum-무default → false
      S('dir', 32),
      S('cycle', 32),
      S('last', 40),
      S('status', 16), // enum-무default → false
      S('addr', 256),
      S('method', 32),
      S('remark', 256),
    ],
    indexes: [],
  },
  {
    id: 'approvalForms',
    name: '결재 서식',
    attributes: [
      S('id', 64, true),
      S('code', 64, true),
      S('name', 128, true),
      S('icon', 16),
      S('docTitle', 128),
      S('closing', 128),
      J('fields', 65535), // array of formField (대형)
      BOOL('active', true),
      INT('order'),
      BOOL('system', false),
      S('folderId', 64),
      S('recipientDeptId', 64),
      S('recipientUserId', 64),
      BOOL('recipientDrafter'),
      INT('allowedPositionFromRank'),
      INT('allowedPositionToRank'),
      SA('allowedDeptIds', 64),
      S('preservationPeriod', 32),
      S('securityLevel', 16),
      S('visibility', 16),
    ],
    indexes: [IX('code', ['code'])],
  },
  {
    id: 'approvalRouteRules',
    name: '결재선 룰',
    attributes: [
      S('id', 64, true),
      S('name', 128, true),
      INT('priority'),
      BOOL('active', true),
      S('docType', 32),
      S('conditionKey', 64),
      SA('conditionValues', 64),
      J('deptScope', 2000), // deptScope 중첩객체(kind/deptId/deptType)
      INT('positionFromRank'),
      INT('positionToRank'),
      INT('amountFrom'),
      INT('amountTo'),
      J('steps'), // array of routeStep
    ],
    indexes: [IX('docType', ['docType']), IX('priority', ['priority'])],
  },
  {
    id: 'approvalRules',
    name: '결재 규칙',
    attributes: [S('id', 64, true), S('docType', 32), INT('amountFrom'), INT('amountTo'), S('finalApproverKey', 32)],
    indexes: [IX('docType', ['docType'])],
  },
  {
    id: 'approvalFolders',
    name: '결재 서식 폴더',
    attributes: [S('id', 64, true), S('name', 128, true), INT('order')],
    indexes: [],
  },

  // ── 거래처 / 품목 ──
  {
    id: 'vendors',
    name: '거래처',
    attributes: [
      S('code', 64, true),
      S('name', 128, true),
      S('type', 32),
      S('use', 16),
      S('bizNo', 32),
      S('ceo', 64),
      S('manager', 64),
      S('addr', 256),
      INT('creditLimit'),
      S('grade', 16),
    ],
    indexes: [IX('type', ['type'])],
  },
  {
    id: 'items',
    name: '품목',
    attributes: [
      S('code', 64, true),
      S('name', 128, true),
      S('spec', 128),
      S('unit', 16),
      S('type', 32),
      S('use', 16),
      INT('safetyStock'),
      S('remark', 256),
    ],
    indexes: [IX('type', ['type'])],
  },
  {
    id: 'creditLimits',
    name: '여신한도',
    attributes: [S('cust', 128, true), INT('limit'), INT('balance'), S('grade', 16)],
    indexes: [IX('cust', ['cust'])],
  },

  // ── 결재 (트랜잭션 보존) ──
  {
    // 필드가 40여개·깊은 중첩(steps·fieldValues·execution·postApproval*…)이라
    // **전체 문서를 payload(JSON)에 통짜 저장** + 쿼리/표시용 스칼라 컬럼만 별도.
    // 필드 유실 0, 스키마 진화에 안전. (로드 후 JS 필터가 정본이라 서버쿼리 불필요)
    id: 'approvalDocs',
    name: '전자결재 문서',
    attributes: [
      S('id', 64, true),
      S('docNo', 64, true),
      S('docType', 32, true),
      S('title', 200, true),
      S('drafterId', 64, true),
      S('status', 16),
      S('drafterName', 64),
      J('payload', 1000000), // ApprovalDoc 전체 JSON (SSOT)
    ],
    indexes: [IX('docNo', ['docNo']), IX('drafterId', ['drafterId']), IX('status', ['status'])],
  },
  {
    id: 'documentExecutions',
    name: '문서 시행(실행)',
    attributes: [
      S('id', 64), // = $id, bare z.string → false
      S('documentId', 64, true), // FK→approvalDocs → 강제 required
      S('docNo', 64),
      S('docTitle', 200),
      S('docType', 32),
      S('drafterId', 64),
      S('drafterName', 64),
      S('targetDeptId', 64),
      S('targetDeptNameSnapshot', 128),
      S('assigneeId', 64),
      S('assigneeNameSnapshot', 128),
      S('status', 16), // executionStatus enum
      S('visibility', 16),
      S('dispatchedAt', 40),
      S('receivedAt', 40),
      S('assignedAt', 40),
      S('completedAt', 40),
      S('updatedAt', 40),
      S('comment', 1000),
      S('returnReasonType', 32),
      INT('claimVersion', false, 0), // 원자 claim 낙관적 락(버전 증가). 도메인 무관 저장전용.
    ],
    indexes: [IX('documentId', ['documentId']), IX('targetDeptId', ['targetDeptId']), IX('status', ['status'])],
  },
  {
    // Firestore 서브컬렉션 documentExecutions/{id}/history 를 평탄화(executionId FK).
    id: 'executionHistory',
    name: '시행 이력',
    attributes: [
      S('eventId', 64), // = $id, bare → false
      S('executionId', 64, true), // FK→documentExecutions → 강제 required
      S('type', 32), // enum → false
      S('actorId', 64),
      S('actorName', 64),
      S('comment', 1000),
      S('createdAt', 40),
    ],
    indexes: [IX('executionId', ['executionId'])],
  },

  // ── 기타 ──
  {
    id: 'systemLogs',
    name: '시스템 로그',
    attributes: [S('id', 64, true), S('at', 40, true), S('user', 64, true), S('type', 32), S('screen', 128), S('detail', 1000), S('ip', 64)],
    indexes: [IX('at', ['at']), IX('user', ['user'])],
  },
  {
    id: 'issues',
    name: '자재 불출',
    attributes: [S('no', 64, true), S('wo', 64), S('target', 128), S('kit', 64), S('warehouse', 64), S('status', 16), J('materials')],
    indexes: [IX('wo', ['wo']), IX('status', ['status'])],
  },
  {
    // 채번 시퀀스. 문서 $id = 채널(예: AP-20260812). 전자결재 채번은 보존(SO-*는 폐기).
    id: 'counters',
    name: '채번 카운터',
    attributes: [INT('seq', true)],
    indexes: [],
  },

  // ── 영업 (fresh 전환 — 기존 데이터 폐기, 컬렉션만 신규) ──
  {
    id: 'salesOrders',
    name: '수주',
    attributes: [S('no', 64, true), S('customer', 128, true), S('orderDate', 40), S('reqDeliveryDate', 40), S('paymentTerms', 64), S('salesperson', 64), J('lines')],
    indexes: [],
  },
  {
    id: 'quotes',
    name: '견적',
    attributes: [S('no', 64, true), S('cust', 128, true), S('item', 128), INT('qty'), S('amt', 32), S('sent', 40), S('progress', 32)],
    indexes: [],
  },
  {
    id: 'shipments',
    name: '출하',
    attributes: [S('no', 64, true), S('salesOrder', 64, true), S('customer', 128), S('item', 64, true), S('itemName', 128), INT('qty'), S('location', 64), S('warehouse', 32), S('status', 16)],
    indexes: [],
  },
  {
    id: 'receipts',
    name: '입고',
    attributes: [S('po', 64, true), S('item', 64, true), S('itemName', 128), S('vendor', 128), INT('poQty'), INT('recvQty'), S('warehouse', 32)],
    indexes: [],
  },
  {
    id: 'taxInvoices',
    name: '세금계산서',
    attributes: [S('no', 64, true), S('sale', 64, true), S('cust', 128, true), S('type', 32, true), INT('amt'), S('date', 40), S('status', 32, true), S('nts', 32)],
    indexes: [],
  },
  {
    id: 'salesRevenues',
    name: '매출',
    attributes: [S('no', 64, true), S('doNo', 64, true), S('cust', 128, true), S('date', 40), INT('supply'), INT('vat'), INT('total'), S('status', 16)],
    indexes: [],
  },
  {
    id: 'salesCollections',
    name: '수금',
    attributes: [S('no', 64, true), S('cust', 128, true), S('date', 40, true), S('method', 32, true), INT('amt'), S('doc', 64), S('match', 64)],
    indexes: [],
  },
  {
    id: 'accountsReceivable',
    name: '채권',
    attributes: [S('cust', 128, true), INT('limit'), INT('d30'), INT('d60'), INT('over'), S('status', 16)],
    indexes: [],
  },
  {
    id: 'posts',
    name: '게시판 게시글',
    attributes: [
      S('id', 64, true),
      S('boardId', 64, true),
      S('title', 200, true),
      S('content', 8000, true),
      S('author', 64, true),
      S('date', 40, true),
      INT('views', false, 0),
      BOOL('isPinned', false),
      BOOL('hasAttachment', false),
      J('attachedFiles', 8000),
    ],
    indexes: [IX('boardId', ['boardId'])],
  },

  // ── 업무 모듈 (일정관리 / 자원예약 / 업무관리 / 전자설문) ──
  // repo 7개를 crudBackend 로 전환하면서 필요해진 컬렉션들. 근태(employees·attendance)는
  // 서버 전용 권한이라 이 스크립트가 아니라 인제스트 쪽 프로비저닝이 담당한다.
  {
    id: 'calendarEvents',
    name: '일정',
    attributes: [
      S('id', 64, true),
      S('ownerUserId', 64, true),
      S('title', 100, true),
      S('date', 40, true),
      BOOL('allDay'),
      S('startTime', 8),
      S('endTime', 8),
      S('memo', 2000),
      /*
        공개 범위. 기존 문서에는 이 세 필드가 없고, 없으면 도메인 스키마가 `PRIVATE`로
        읽으므로 마이그레이션 없이도 예전 일정은 나만 보는 상태로 남는다.
        한글 값이 아니라 영문 코드라 enum도 가능하지만, 다른 컬렉션과 같이 String으로 둔다.
      */
      S('visibility', 16),
      S('deptId', 64),
      S('projectId', 64),
      S('createdAt', 40),
      S('updatedAt', 40),
    ],
    /*
      공유 조회는 소유자 외에 부서·프로젝트로도 찾는다. 지금 repo는 전건을 읽어 거르지만
      서버측 질의로 옮길 때 필요하므로 인덱스를 미리 만들어 둔다.
    */
    indexes: [
      IX('calOwner', ['ownerUserId']),
      IX('calDate', ['date']),
      IX('calVisibility', ['visibility']),
      IX('calDept', ['deptId']),
      IX('calProject', ['projectId']),
    ],
  },
  {
    id: 'resources',
    name: '예약 자원',
    attributes: [
      S('id', 64, true),
      S('code', 30, true),
      S('name', 60, true),
      EN('typeCode', ['ROOM', 'VEHICLE', 'EQUIPMENT', 'SUPPLY']),
      EN('bookingMode', ['TIME_SLOT', 'QUANTITY']),
      S('location', 100, true),
      S('description', 300),
      INT('capacity'),
      INT('totalQuantity'),
      S('unitCode', 20),
      S('managerUserId', 64),
      S('ownerDeptId', 64),
      EN('approvalMode', ['INSTANT', 'APPROVAL']),
      INT('slotMinutes'),
      INT('minDurationMinutes'),
      INT('maxDurationMinutes'),
      INT('bufferBeforeMinutes'),
      INT('bufferAfterMinutes'),
      INT('maxAdvanceDays'),
      INT('cancelDeadlineMinutes'),
      S('availableFrom', 8),
      S('availableTo', 8),
      EN('status', ['ACTIVE', 'MAINTENANCE', 'INACTIVE']),
      S('imageUrl', 512),
      S('notes', 500),
      S('createdBy', 64, true),
      S('createdAt', 40),
      S('updatedBy', 64, true),
      S('updatedAt', 40),
    ],
    indexes: [IX('resCode', ['code']), IX('resStatus', ['status'])],
  },
  {
    id: 'resourceReservations',
    name: '자원 예약',
    attributes: [
      S('id', 64, true),
      S('resourceId', 64, true),
      S('resourceCodeSnapshot', 30, true),
      S('resourceNameSnapshot', 60, true),
      S('requesterUserId', 64, true),
      S('requesterDeptId', 64),
      S('title', 100, true),
      S('purpose', 500, true),
      S('startAt', 40),
      S('endAt', 40),
      INT('quantity'),
      INT('attendeeCount'),
      SA('attendeeUserIds', 64),
      EN('status', ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED']),
      EN('approvalModeSnapshot', ['INSTANT', 'APPROVAL']),
      S('approverUserId', 64),
      S('approvedAt', 40),
      S('rejectedAt', 40),
      S('rejectionReason', 500),
      S('cancelledAt', 40),
      S('cancelReason', 500),
      INT('version'),
      S('createdAt', 40),
      S('updatedAt', 40),
    ],
    indexes: [
      IX('rsvResource', ['resourceId']),
      IX('rsvRequester', ['requesterUserId']),
      IX('rsvStatus', ['status']),
      IX('rsvStart', ['startAt']),
    ],
  },
  {
    id: 'workProjects',
    name: '업무 프로젝트',
    attributes: [
      S('id', 64, true),
      S('code', 30, true),
      S('name', 100, true),
      S('description', 2000),
      S('ownerUserId', 64, true),
      SA('memberUserIds', 64),
      S('deptId', 64),
      EN('visibility', ['PRIVATE', 'TEAM', 'COMPANY']),
      EN('status', ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']),
      S('startAt', 40),
      S('dueAt', 40),
      S('color', 16),
      S('chatRoomId', 64),
      S('createdBy', 64, true),
      S('createdAt', 40),
      S('updatedBy', 64, true),
      S('updatedAt', 40),
    ],
    indexes: [IX('prjOwner', ['ownerUserId']), IX('prjStatus', ['status'])],
  },
  {
    id: 'workPhases',
    name: 'WBS 단계',
    attributes: [
      S('id', 64, true),
      S('projectId', 64, true),
      S('name', 80, true),
      INT('sortOrder'),
      S('createdBy', 64, true),
      S('createdAt', 40),
      S('updatedBy', 64, true),
      S('updatedAt', 40),
    ],
    indexes: [IX('phaseProject', ['projectId'])],
  },
  {
    id: 'workTasks',
    name: 'WBS 작업',
    attributes: [
      S('id', 64, true),
      S('projectId', 64, true),
      S('phaseId', 64, true),
      S('title', 150, true),
      S('description', 2000),
      S('assigneeUserId', 64, true),
      S('startAt', 40),
      S('dueAt', 40),
      EN('status', ['TODO', 'IN_PROGRESS', 'DONE']),
      INT('progress', false, undefined, 0, 100),
      INT('sortOrder'),
      S('completedAt', 40),
      INT('version'),
      S('createdBy', 64, true),
      S('createdAt', 40),
      S('updatedBy', 64, true),
      S('updatedAt', 40),
    ],
    indexes: [
      IX('taskProject', ['projectId']),
      IX('taskPhase', ['phaseId']),
      IX('taskAssignee', ['assigneeUserId']),
    ],
  },
  {
    id: 'surveys',
    name: '전자설문',
    attributes: [
      S('id', 64, true),
      S('title', 100, true),
      S('description', 1000),
      S('categoryCode', 64, true),
      S('ownerUserId', 64, true),
      EN('status', ['DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED']),
      EN('audienceType', ['COMPANY', 'DEPARTMENT', 'USERS']),
      SA('audienceDeptIds', 64),
      SA('audienceUserIds', 64),
      BOOL('anonymous'),
      S('startsAt', 40),
      S('endsAt', 40),
      BOOL('showResultToRespondent'),
      INT('questionCount', false, 0),
      INT('responseCount', false, 0),
      S('publishedAt', 40),
      S('firstRespondedAt', 40),
      S('closedAt', 40),
      INT('version'),
      S('createdAt', 40),
      S('updatedAt', 40),
    ],
    indexes: [IX('surOwner', ['ownerUserId']), IX('surStatus', ['status'])],
  },
  {
    id: 'surveyQuestions',
    name: '설문 질문',
    attributes: [
      S('id', 64, true),
      S('surveyId', 64, true),
      EN('type', ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'RATING']),
      S('title', 300, true),
      S('description', 500),
      BOOL('required'),
      INT('order'),
      J('options'), // array of surveyOption(id/label/order)
      S('ratingMinLabel', 30),
      S('ratingMaxLabel', 30),
      INT('maxLength'),
      S('createdAt', 40),
      S('updatedAt', 40),
    ],
    indexes: [IX('sqSurvey', ['surveyId'])],
  },
  {
    id: 'surveyResponses',
    name: '설문 응답',
    attributes: [
      S('id', 64, true),
      S('surveyId', 64, true),
      // 익명 설문에서는 두 필드가 비어 있다(응답자 역추적 불가가 설계 의도).
      S('respondentUserId', 64),
      S('respondentDeptId', 64),
      INT('surveyVersion'),
      S('submittedAt', 40),
    ],
    indexes: [IX('srSurvey', ['surveyId'])],
  },
  {
    id: 'surveyAnswers',
    name: '설문 답변',
    attributes: [
      S('id', 64, true),
      S('surveyId', 64, true),
      S('responseId', 64, true),
      S('questionId', 64, true),
      SA('selectedOptionIds', 64),
      S('textValue', 2000),
      INT('ratingValue', false, undefined, 1, 5),
      S('createdAt', 40),
    ],
    indexes: [
      IX('saSurvey', ['surveyId']),
      IX('saResponse', ['responseId']),
      IX('saQuestion', ['questionId']),
    ],
  },
  {
    id: 'surveyParticipations',
    name: '설문 참여기록',
    attributes: [
      // 문서 ID = `설문ID__사용자ID` — 중복 제출 경쟁에서 문서가 하나만 생기게 하는 결정적 키.
      S('id', 128, true),
      S('surveyId', 64, true),
      S('userId', 64, true),
      BOOL('responded'),
      S('respondedAt', 40),
    ],
    indexes: [IX('spSurvey', ['surveyId']), IX('spUser', ['userId'])],
  },

  // ── 메일 ──
  {
    id: 'mailAccounts',
    name: '메일 계정',
    /**
     * **서버 전용.** 브라우저는 이 컬렉션에 직접 붙지 못하고 mail Function만 API 키로 접근한다.
     *
     * 다른 컬렉션과 달리 `POC_PERMISSIONS`를 쓰면 안 된다. 누구나 read면 남의 메일 주소
     * 목록이 그대로 열리고, 누구나 update/delete면 남의 계정을 지우거나 서버 주소를 바꿔
     * 자격 증명을 탈취할 수 있다. `encryptedSecret`이 암호문이라는 것과는 별개 문제다.
     */
    permissions: [],
    attributes: [
      S('id', 64, true),
      /** 소유자. Function이 서명 토큰에서 도출한 uid와 대조해 남의 계정 접근을 막는다. */
      S('workfitUserId', 64, true),
      EN('provider', ['naver', 'daum', 'google', 'microsoft', 'custom']),
      S('email', 255, true),
      S('displayName', 50),
      /** IMAP·SMTP 인증 아이디. 주소와 다른 공급자가 있어 따로 둔다. */
      S('authUsername', 255),
      /**
       * 앱 비밀번호 암호문. `v1.{iv}.{authTag}.{ciphertext}`(AES-256-GCM, base64url).
       * 평문은 어디에도 저장하지 않고 Function이 인증 직전에만 푼다.
       */
      S('encryptedSecret', 1024, true),
      EN('authType', ['app_password', 'oauth2']),
      EN('transport', ['imap_smtp', 'gmail_api', 'microsoft_graph']),
      EN('status', ['active', 'error', 'disabled']),
      // custom 공급자용 접속 정보. 프리셋 공급자는 Function이 호스트를 알고 있어 비워 둔다.
      S('smtpHost', 255),
      INT('smtpPort'),
      EN('smtpSecurity', ['tls', 'starttls', 'plain']),
      S('imapHost', 255),
      INT('imapPort'),
      EN('imapSecurity', ['tls', 'starttls', 'plain']),
      S('signature', 1000),
      S('verifiedAt', 40),
      /** 실패 원인은 정규화된 코드만. 서버 내부 메시지는 남기지 않는다. */
      S('lastErrorCode', 64),
      S('createdAt', 40),
      S('updatedAt', 40),
    ],
    indexes: [
      IX('mailAcctOwner', ['workfitUserId']),
      // 같은 사용자가 같은 주소를 두 번 등록하지 못하게 DB에서 막는다(MailHub와 동일 제약).
      UQ('mailAcctOwnerEmail', ['workfitUserId', 'email']),
    ],
  },
  {
    /*
      발신 기록.

      보낸메일함은 IMAP 서버에 있고 거기엔 헤더뿐이라, 공용 메일 계정을 여럿이 쓰면
      "우리 팀 누가 보냈나"를 알 수 없다. From 표시 이름으로도 대개 갈리지만 그건
      문자열이라 동명이인이면 겹치고 공급자가 고쳐 쓸 수도 있다.
      `Message-ID`를 키로 확정 정보를 우리 쪽에 남긴다.

      우리 앱으로 보낸 메일만 기록된다 — 네이버 웹메일에서 직접 보낸 것은 여기 없고,
      그때는 화면이 From 헤더로 물러선다.
    */
    id: 'mailSentBy',
    name: '메일 발신 기록',
    attributes: [
      S('id', 64, true),
      /*
        조인 키는 Message-ID 자체가 아니라 그 해시(sha256 hex 64자)다. Message-ID는 길이가
        들쭉날쭉해 넉넉히 잡으면 인덱스 키 길이 상한에 걸리고(512로 만들었다가 실제로 걸렸다),
        짧게 자르면 잘린 뒤가 같은 메일끼리 뭉친다. 계산은 `sentBy.js`의 `messageIdKey`.
      */
      S('messageIdKey', 64, true),
      // 원본은 조회·디버깅용으로만 둔다. 인덱스를 걸지 않는다.
      S('messageId', 512),
      S('accountId', 64, true),
      S('workfitUserId', 64, true),
      // 보낸 시점의 이름 스냅샷. 사람이 나가거나 개명해도 그때 누가 보냈는지는 남는다.
      S('senderName', 30),
      S('sentAt', 40),
    ],
    indexes: [
      IX('sentByMessageKey', ['messageIdKey']),
      IX('sentByAccount', ['accountId']),
      IX('sentByUser', ['workfitUserId']),
    ],
  },
];

/** PoC 검증용 권한 — 누구나 CRUD. ⚠️ 운영 전 좁힐 것(계획서 §6). */
const POC_PERMISSIONS = [
  Permission.read(Role.any()),
  Permission.create(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any()),
];

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────
function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`));
    if (m) return m[1].trim();
  }
  return undefined;
}

const isCode = (e: unknown, code: number) => (e as { code?: number })?.code === code;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
// 멱등 연산
// ─────────────────────────────────────────────────────────────
async function ensureDatabase(dbs: Databases, dbId: string) {
  try {
    await dbs.get(dbId);
    console.log(`• database "${dbId}" 존재 — 건너뜀`);
  } catch (e) {
    if (!isCode(e, 404)) throw e;
    await dbs.create(dbId, 'workfit');
    console.log(`✓ database "${dbId}" 생성`);
  }
}

async function ensureCollection(dbs: Databases, dbId: string, c: CollectionDef) {
  try {
    await dbs.getCollection(dbId, c.id);
    console.log(`• collection "${c.id}" 존재 — 건너뜀`);
  } catch (e) {
    if (!isCode(e, 404)) throw e;
    await dbs.createCollection(dbId, c.id, c.name, c.permissions ?? POC_PERMISSIONS, /* documentSecurity */ false);
    console.log(`✓ collection "${c.id}" 생성`);
  }
}

async function existingAttrKeys(dbs: Databases, dbId: string, collId: string): Promise<Set<string>> {
  const res = await dbs.listAttributes(dbId, collId, ATTR_PAGE);
  return new Set(res.attributes.map((a) => (a as unknown as { key: string }).key));
}

async function ensureAttribute(dbs: Databases, dbId: string, collId: string, a: AttrDef, have: Set<string>) {
  if (have.has(a.key)) {
    console.log(`  • attr "${a.key}" 존재 — 건너뜀`);
    return;
  }
  try {
    if (a.kind === 'string') {
      await dbs.createStringAttribute(dbId, collId, a.key, a.size, a.required ?? false, undefined, a.array ?? false);
    } else if (a.kind === 'enum') {
      await dbs.createEnumAttribute(dbId, collId, a.key, a.elements, a.required ?? false, a.xdefault);
    } else if (a.kind === 'integer') {
      await dbs.createIntegerAttribute(dbId, collId, a.key, a.required ?? false, a.min, a.max, a.xdefault, a.array ?? false);
    } else if (a.kind === 'float') {
      await dbs.createFloatAttribute(dbId, collId, a.key, a.required ?? false, undefined, undefined, undefined, a.array ?? false);
    } else {
      await dbs.createBooleanAttribute(dbId, collId, a.key, a.required ?? false, a.xdefault);
    }
    console.log(`  ✓ attr "${a.key}" (${a.kind}) 생성`);
  } catch (e) {
    if (isCode(e, 409)) console.log(`  • attr "${a.key}" 이미 존재(409) — 건너뜀`);
    else throw e;
  }
}

/**
 * 속성은 서버에서 비동기 처리 — 인덱스 생성 전 전부 available 될 때까지 폴링.
 *
 * 대기 한도는 속성 수에 비례한다(과거 60초 고정). 큰 컬렉션일수록 워커가 오래 걸린다.
 * 단 `resources`(29개)에서 났던 무한 대기의 진짜 원인은 시간이 아니라 **위 ATTR_PAGE 의
 * 페이지네이션**이었다 — 25건 상한 밖의 속성은 목록에 없으니 status 판정이 영원히
 * pending 이었다. 시간 여유는 보조 수단일 뿐이라 상한 명시가 본질적인 수정이다.
 */
async function waitAttributesAvailable(dbs: Databases, dbId: string, collId: string, keys: string[]) {
  const deadline = Date.now() + Math.max(120_000, keys.length * 10_000);
  for (;;) {
    const res = await dbs.listAttributes(dbId, collId, ATTR_PAGE);
    const byKey = new Map(res.attributes.map((a) => [(a as unknown as { key: string }).key, a as unknown as { status: string }]));
    const pending = keys.filter((k) => byKey.get(k)?.status !== 'available');
    if (pending.length === 0) return;
    if (Date.now() > deadline) throw new Error(`속성 available 대기 시간 초과: ${pending.join(', ')}`);
    console.log(`  … 속성 처리 대기(${pending.length}개): ${pending.join(', ')}`);
    await sleep(1500);
  }
}

async function ensureIndex(dbs: Databases, dbId: string, collId: string, idx: IndexDef, haveIdx: Set<string>) {
  if (haveIdx.has(idx.key)) {
    console.log(`  • index "${idx.key}" 존재 — 건너뜀`);
    return;
  }
  try {
    await dbs.createIndex(dbId, collId, idx.key, idx.type, idx.attributes);
    console.log(`  ✓ index "${idx.key}" [${idx.attributes.join(', ')}] 생성`);
  } catch (e) {
    if (isCode(e, 409)) console.log(`  • index "${idx.key}" 이미 존재(409) — 건너뜀`);
    else throw e;
  }
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
async function main() {
  const endpoint = readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT');
  const projectId = readEnv('APPWRITE_PROJECT_ID') ?? readEnv('VITE_APPWRITE_PROJECT_ID');
  const databaseId = readEnv('APPWRITE_DATABASE_ID') ?? readEnv('VITE_APPWRITE_DATABASE_ID');
  /**
   * `.env.local`은 dev·prod 키를 접미어로 구분해 둔다(`APPWRITE_API_KEY_DEV` / `_PROD`).
   * 접미어 없는 이름이 없으면 **dev 키로만** 폴백한다 — 기본값이 운영이면 스키마 스크립트가
   * 실수로 prod를 건드린다. prod에 적용할 때는 `APPWRITE_API_KEY`를 명시적으로 넘긴다.
   */
  const apiKey = readEnv('APPWRITE_API_KEY') ?? readEnv('APPWRITE_API_KEY_DEV');

  const missing = [
    ['APPWRITE_ENDPOINT', endpoint],
    ['APPWRITE_PROJECT_ID', projectId],
    ['APPWRITE_DATABASE_ID', databaseId],
    ['APPWRITE_API_KEY', apiKey],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`필수 env 누락: ${missing.join(', ')}\n(.env.local 또는 환경변수에 설정하세요. API_KEY는 서버 비밀키)`);
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(endpoint as string)
    .setProject(projectId as string)
    .setKey(apiKey as string);
  const dbs = new Databases(client);
  const dbId = databaseId as string;

  console.log(`▶ Appwrite 스키마 적용 — ${endpoint} / project ${projectId} / db ${dbId}\n`);

  await ensureDatabase(dbs, dbId);

  for (const c of COLLECTIONS) {
    console.log(`\n[${c.id}] ${c.name}`);
    await ensureCollection(dbs, dbId, c);

    const haveAttr = await existingAttrKeys(dbs, dbId, c.id);
    for (const a of c.attributes) await ensureAttribute(dbs, dbId, c.id, a, haveAttr);

    await waitAttributesAvailable(dbs, dbId, c.id, c.attributes.map((a) => a.key));

    const coll = await dbs.getCollection(dbId, c.id);
    const haveIdx = new Set((coll.indexes as Models.Index[]).map((i) => i.key));
    for (const idx of c.indexes) await ensureIndex(dbs, dbId, c.id, idx, haveIdx);
  }

  console.log('\n✅ 스키마 적용 완료. (재실행해도 안전 — 멱등)');
}

main().catch((e) => {
  console.error('\n✗ 실패:', e instanceof Error ? e.message : e);
  process.exit(1);
});
