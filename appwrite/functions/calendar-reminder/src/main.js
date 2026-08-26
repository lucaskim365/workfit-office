/**
 * Appwrite Function — 일정 시작 10분 전 리마인더.
 *
 * HTTP 요청이 아니라 **스케줄(cron)**로 도는 함수다. 5분마다 깨어나서 "10분 뒤 시작하는데
 * 아직 안 보낸" 시간 일정을 찾아 소유자 + 공유 대상에게 알림을 만든다. 발송 채널(토스트·
 * 알림센터·OS 푸시)은 새로 안 만든다 — `notifications` 컬렉션에 `type:'일정'`으로 문서를
 * 하나 쓰면 이미 있는 파이프라인(결재 알림과 같은 것)이 그대로 처리한다.
 *
 * 대상자 판정은 `calendarEvent.repo.ts`의 공유 알림 로직과 같은 규칙이지만, 이 함수는
 * **소유자도 포함한다** — 공유 알림은 "남에게 알리는" 것이고 리마인더는 "본인이 놓치지
 * 않게" 하는 것이라 PRIVATE 일정도 소유자에게는 보낸다.
 *
 * 창(window)을 좁게 한 번만 보지 않는 이유: 실행 주기(5분)보다 좁은 창을 쓰면 함수가
 * 몇 초 늦게 실행됐을 때 그 틈에 낀 일정을 영영 못 잡는다. 창을 실행 주기보다 넓게 잡고
 * (10분 ± 5분) `reminded` 플래그로 중복 발송만 막는다 — 늦게라도 한 번은 반드시 걸리게.
 *
 * 필요 env: APPWRITE_DATABASE_ID(기본 'workfit'). 그 외에는 함수 실행마다 Appwrite가
 * 주입하는 동적 키(x-appwrite-key)만 쓴다 — 관리자 키를 함수에 심지 않는다.
 */
import { Client, Databases, ID, Query } from 'node-appwrite';

const DB = process.env.APPWRITE_DATABASE_ID || 'workfit';
const LEAD_MIN = 10;
const TOLERANCE_MIN = 5;

/** 내부 호스트는 리다이렉트가 없다. mail Function과 같은 판단 — 평문 http가 정상이다. */
const INTERNAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|appwrite|traefik|.*\.local|.*\.internal)$/i;

/**
 * Appwrite가 주입하는 엔드포인트가 평문 http면 https로 올린다. 301 리다이렉트가 POST를
 * GET으로 바꿔 문서 생성이 조용히 조회로 둔갑하는 걸 막는다(mail Function에서 실제로
 * 겪은 문제 — 새 Function을 만들 때마다 같은 함정을 밟지 않으려고 그대로 옮겨온다).
 */
function normalizeEndpoint(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' || INTERNAL_HOST.test(url.hostname)) return raw;
    url.protocol = 'https:';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

function databases(req) {
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const endpoint = normalizeEndpoint(process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_API_ENDPOINT);
  const key = process.env.APPWRITE_API_KEY || req.headers['x-appwrite-key'];
  return new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(key));
}

/** 어느 시각을 Asia/Seoul 기준 {date:'YYYY-MM-DD', hm:'HH:mm'}로. 프런트 calendarToday()와 같은 방식. */
function seoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  // 자정 각각의 표기가 en-CA에서 "24:00"으로 나오는 로케일 버그가 있어 보정한다.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hm: `${hour}:${get('minute')}` };
}

/**
 * 지금(now)을 기준으로 훑을 창을 만든다. `LEAD_MIN ± TOLERANCE_MIN` 범위가 자정을
 * 넘나들면 그 만큼 날짜를 나눠서 두 구간으로 돌려준다 — `date` 값이 하루 단위 문자열이라
 * 하나의 질의로는 자정을 못 건넌다.
 */
function reminderWindows(now) {
  const low = seoulParts(new Date(now.getTime() + (LEAD_MIN - TOLERANCE_MIN) * 60_000));
  const high = seoulParts(new Date(now.getTime() + (LEAD_MIN + TOLERANCE_MIN) * 60_000));
  if (low.date === high.date) return [{ date: low.date, from: low.hm, to: high.hm }];
  return [
    { date: low.date, from: low.hm, to: '23:59' },
    { date: high.date, from: '00:00', to: high.hm },
  ];
}

/** 부서 ID → 그 부서 소속 재직자 users.id 목록. */
async function deptMemberIds(dbs, deptId) {
  const dept = await dbs.getDocument(DB, 'departments', deptId).catch(() => null);
  if (!dept) return [];
  const members = await dbs.listDocuments(DB, 'users', [
    Query.equal('dept', dept.name), Query.equal('status', '사용'), Query.limit(200),
  ]);
  return members.documents.map((u) => u.$id);
}

/** 이 일정을 볼 수 있는 전원(소유자 포함). 공유 알림(calendarEvent.repo.ts)과 같은 규칙 + 소유자. */
async function recipientsOf(dbs, event) {
  const ids = new Set([event.ownerUserId]);
  if (event.visibility === 'TEAM' && event.deptId) {
    (await deptMemberIds(dbs, event.deptId)).forEach((id) => ids.add(id));
  } else if (event.visibility === 'PROJECT' && event.projectId) {
    const project = await dbs.getDocument(DB, 'workProjects', event.projectId).catch(() => null);
    if (project) {
      ids.add(project.ownerUserId);
      (project.memberUserIds ?? []).forEach((id) => ids.add(id));
    }
  } else if (event.visibility === 'COMPANY') {
    const all = await dbs.listDocuments(DB, 'users', [Query.equal('status', '사용'), Query.limit(500)]);
    all.documents.forEach((u) => ids.add(u.$id));
  }
  return [...ids];
}

function scopeLabel(visibility) {
  if (visibility === 'TEAM') return ' · 부서 공유';
  if (visibility === 'PROJECT') return ' · 프로젝트 공유';
  if (visibility === 'COMPANY') return ' · 전사 공개';
  return '';
}

export default async ({ req, res, log, error }) => {
  const dbs = databases(req);
  const now = new Date();
  const windows = reminderWindows(now);
  log(`실행 ${now.toISOString()} — 창 ${windows.map((w) => `${w.date} ${w.from}~${w.to}`).join(', ')}`);

  let sent = 0;
  let scanned = 0;

  try {
    for (const w of windows) {
      const page = await dbs.listDocuments(DB, 'calendarEvents', [
        Query.equal('date', w.date),
        Query.equal('allDay', false),
        Query.equal('reminded', false),
        Query.greaterThanEqual('startTime', w.from),
        Query.lessThanEqual('startTime', w.to),
        Query.limit(100),
      ]);
      scanned += page.documents.length;

      for (const event of page.documents) {
        const owner = await dbs.getDocument(DB, 'users', event.ownerUserId).catch(() => null);
        const recipients = await recipientsOf(dbs, event);
        const text = `[${event.title}] ${event.date} ${event.startTime}~${event.endTime} 곧 시작합니다${scopeLabel(event.visibility)}`;

        await Promise.all(recipients.map((userId) => dbs.createDocument(DB, 'notifications', ID.unique(), {
          userId,
          type: '일정',
          title: '일정 알림',
          text,
          senderName: owner?.name ?? '일정 알림',
          linkUrl: `/gw/calendar?date=${event.date}`,
          read: false,
          createdAt: new Date().toISOString(),
        })));

        // 먼저 발송하고 나중에 플래그를 세운다 — 중간에 죽으면 다음 실행에서 또 보내는
        // 쪽(중복 가능)이, 플래그부터 세우고 발송이 실패해 영영 못 받는 쪽보다 낫다.
        await dbs.updateDocument(DB, 'calendarEvents', event.$id, { reminded: true });
        sent += recipients.length;
      }
    }
    log(`완료 — 대상 일정 ${scanned}건, 알림 ${sent}건 발송`);
    return res.json({ data: { scanned, sent } });
  } catch (e) {
    error(`리마인더 실행 실패: ${e.message}`);
    return res.json({ error: { code: 'INTERNAL', message: e.message } }, 500);
  }
};
