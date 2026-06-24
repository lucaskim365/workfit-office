import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  d8ReportSchema,
  type D8Report,
  type D8ReportDraft,
} from '@/domain/d8Report/schema';
import { canTransition } from '@/domain/d8Report/status';
import { yymmdd, format8dNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { D8_REPORT_SEED } from '@/data/seeds/d8Report.seed';

/**
 * 8D 보고서 Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'd8Reports';

export interface D8Filter {
  status?: string;
  q?: string;
}

let memory: D8Report[] = D8_REPORT_SEED.map((d) => d8ReportSchema.parse(d));

function applyFilter(rows: D8Report[], f?: D8Filter): D8Report[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (d) =>
      (!f.status || d.status === f.status) &&
      (!kw || d.no.toLowerCase().includes(kw) || d.title.includes(kw) || d.cust.includes(kw)),
  );
}

async function loadAll(): Promise<D8Report[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => d8ReportSchema.parse(d.data()));
  }
  return memory;
}

async function persist(d: D8Report): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, d.no), d);
    return;
  }
  const i = memory.findIndex((m) => m.no === d.no);
  if (i >= 0) memory[i] = d;
  else memory = [d, ...memory];
}

export const d8ReportRepo = {
  async list(filter?: D8Filter): Promise<D8Report[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<D8Report | null> {
    const rows = await loadAll();
    return rows.find((d) => d.no === no) ?? null;
  },

  /** 신규 발행 — 8D-YYMMDD-NNN 채번 후 '작성중' 상태로 생성. */
  async create(draft: D8ReportDraft, now: Date): Promise<D8Report> {
    const dateKey = yymmdd(now);
    const seq = await counterRepo.next(`8D-${dateKey}`);
    const report = d8ReportSchema.parse({
      ...draft,
      no: format8dNo(dateKey, seq),
      status: '작성중',
    });
    await persist(report);
    return report;
  },

  /** 등록/수정(upsert). */
  async save(d: D8Report): Promise<void> {
    await persist(d8ReportSchema.parse(d));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: D8Report['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`8D 보고서를 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
