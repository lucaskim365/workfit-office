import { systemLogSchema, type SystemLog } from '@/domain/systemLog/schema';
import { SYSTEM_LOG_SEED } from '@/data/seeds/systemLog.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 시스템 로그 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<SystemLog>({
  coll: 'systemLogs',
  parse: (raw) => {
    const p = systemLogSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse systemLog:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: SYSTEM_LOG_SEED.map((it) => systemLogSchema.parse(it)),
});

export interface SystemLogFilter {
  type?: string;
  q?: string;
}

function applyFilter(rows: SystemLog[], f?: SystemLogFilter): SystemLog[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.type || it.type === f.type) &&
      (!kw || it.user.toLowerCase().includes(kw)),
  );
}

export const systemLogRepo = {
  /** 전체 조회 + 클라이언트 필터 + 최신순 정렬. */
  async list(filter?: SystemLogFilter): Promise<SystemLog[]> {
    const all = await backend.loadAll();
    const sorted = [...all].sort((a, b) => b.at.localeCompare(a.at));
    return applyFilter(sorted, filter);
  },

  async get(id: string): Promise<SystemLog | null> {
    return (await backend.loadAll()).find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 로그 id. */
  async save(item: SystemLog): Promise<void> {
    await backend.save(systemLogSchema.parse(item));
  },

  /** 실시간 로그인 로그 기록 헬퍼 */
  async recordLogin(user: { id: string; empNo?: string; name: string; dept?: string }, platform: 'Web' | 'Mobile' = 'Web'): Promise<void> {
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const at = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const logItem: SystemLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at,
        user: `${user.name} (${user.empNo || user.id})`,
        type: '접속',
        screen: `로그인 (${platform})`,
        detail: `시스템 로그인 성공 (소속: ${user.dept || '미지정'})`,
        ip: typeof window !== 'undefined' ? `${window.navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Web'} Client` : '127.0.0.1',
      };
      await backend.save(systemLogSchema.parse(logItem));
    } catch (err) {
      console.error('Failed to record login log:', err);
    }
  },
};
