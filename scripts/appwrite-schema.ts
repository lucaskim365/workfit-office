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
  Role,
  DatabasesIndexType,
  type Models,
} from 'node-appwrite';

// ─────────────────────────────────────────────────────────────
// 스키마 정의 (데이터 주도) — Phase 3에서 컬렉션을 여기 추가하면 된다.
// ─────────────────────────────────────────────────────────────
type AttrDef =
  | { kind: 'string'; key: string; size: number; required?: boolean; array?: boolean }
  | { kind: 'enum'; key: string; elements: string[]; required?: boolean; xdefault?: string }
  | { kind: 'integer'; key: string; required?: boolean; array?: boolean; xdefault?: number }
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
}

// ── 빌더 헬퍼 (가독성) ──
const S = (key: string, size: number, required = false): AttrDef => ({ kind: 'string', key, size, required });
const SA = (key: string, size: number): AttrDef => ({ kind: 'string', key, size, array: true }); // 문자열 배열
const J = (key: string, size = 16000): AttrDef => ({ kind: 'string', key, size }); // 중첩/배열-of-객체 → JSON 문자열
const EN = (key: string, elements: string[], required = false): AttrDef => ({ kind: 'enum', key, elements, required });
const INT = (key: string, required = false, xdefault?: number): AttrDef => ({ kind: 'integer', key, required, xdefault });
const BOOL = (key: string, xdefault?: boolean): AttrDef => ({ kind: 'boolean', key, xdefault });
const IX = (name: string, attributes: string[]): IndexDef => ({
  key: `idx_${name}`,
  type: DatabasesIndexType.Key,
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
    await dbs.createCollection(dbId, c.id, c.name, POC_PERMISSIONS, /* documentSecurity */ false);
    console.log(`✓ collection "${c.id}" 생성`);
  }
}

async function existingAttrKeys(dbs: Databases, dbId: string, collId: string): Promise<Set<string>> {
  const res = await dbs.listAttributes(dbId, collId);
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
      await dbs.createIntegerAttribute(dbId, collId, a.key, a.required ?? false, undefined, undefined, a.xdefault, a.array ?? false);
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

/** 속성은 서버에서 비동기 처리 — 인덱스 생성 전 전부 available 될 때까지 폴링. */
async function waitAttributesAvailable(dbs: Databases, dbId: string, collId: string, keys: string[]) {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const res = await dbs.listAttributes(dbId, collId);
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
  const apiKey = readEnv('APPWRITE_API_KEY');

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
