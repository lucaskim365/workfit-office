import { z } from 'zod';
import { clockOf } from '@/domain/commute/overtimeDraft';
import { HOLIDAY_WORK_DOC_TYPES } from '@/domain/approvalDoc/holidayWorkDuplicate';

/**
 * 대체휴무 원장 — 결재 완료된 휴일근로를 분 × 1.5 로 지급(GRANT), 그 문서가 취소완료되면 같은 분을 차감(REVOKE).
 * 결재 문서는 읽기만 하고, 원장 줄의 id 를 근거 문서로 정해 같은 문서로 두 번 들어가지 않는다.
 * 설계: docs/superpowers/specs/2026-11-13-substitute-holiday-minutes-design.md
 */
export const SUBSTITUTE_RATE = 1.5;
/** 하루 기본 근무(분) — 대체휴무 종일 1개 */
export const DAY_MIN = 480;

export const substituteLedgerEntrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  kind: z.enum(['GRANT', 'REVOKE']),
  minutes: z.number().int(),
  sourceDocId: z.string().min(1),
  sourceDocNo: z.string().default(''),
  workDate: z.string().default(''),
  expiresOn: z.string().default(''),
  workMinutes: z.number().int().default(0),
  createdAt: z.string().default(''),
  createdBy: z.string().default(''),
  note: z.string().default(''),
});
export type SubstituteLedgerEntry = z.infer<typeof substituteLedgerEntrySchema>;

interface DocLike {
  id: string;
  docNo?: string | null;
  docType: string;
  status: string;
  drafterId: string;
  fieldValues?: Record<string, unknown> | null;
}

type BreakPolicy = { breakStartTime: string; breakEndTime: string };

const toMin = (clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};

const workDateOf = (doc: DocLike) => {
  const d = String(doc.fieldValues?.workDate ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
};

/** 휴일근로 문서 — 서식이 휴일근로이고 근무 구분이 휴일(값이 없으면 근무일이 주말). */
export function isHolidayWorkDoc(doc: DocLike): boolean {
  if (!HOLIDAY_WORK_DOC_TYPES.includes(doc.docType)) return false;
  const kind = String(doc.fieldValues?.workKind ?? '').trim();
  if (kind) return kind === '휴일';
  const date = workDateOf(doc);
  if (!date) return false;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * 휴일근로 분 — 출근~퇴근(퇴근이 이르면 자정 넘김) − 휴게시간과 겹친 분.
 * 시각이 없는 예전 문서는 근무 시간(시간) 칸 × 60.
 */
export function holidayWorkMinutes(doc: DocLike, policy: BreakPolicy): number {
  const start = clockOf(doc.fieldValues?.workStart);
  const end = clockOf(doc.fieldValues?.workEnd);
  if (!start || !end) {
    if (doc.fieldValues?.workStart || doc.fieldValues?.workEnd) return 0;
    const hours = Number(doc.fieldValues?.workHours);
    return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0;
  }
  const from = toMin(start);
  const to = toMin(end) + (toMin(end) < from ? 1440 : 0);
  const overlap = Math.min(to, toMin(policy.breakEndTime)) - Math.max(from, toMin(policy.breakStartTime));
  return Math.max(0, to - from - Math.max(0, overlap));
}

const plusOneYear = (date: string) => {
  const [y, m, d] = date.split('-');
  return m === '02' && d === '29' ? `${Number(y) + 1}-02-28` : `${Number(y) + 1}-${m}-${d}`;
};

/** 결재 완료 휴일근로 문서의 지급 줄. 지급할 것이 없으면 null. */
export function grantEntryOf(doc: DocLike, policy: BreakPolicy, now: string): SubstituteLedgerEntry | null {
  if (doc.status !== '완료' || !isHolidayWorkDoc(doc)) return null;
  const workDate = workDateOf(doc);
  const workMinutes = holidayWorkMinutes(doc, policy);
  const minutes = Math.floor(workMinutes * SUBSTITUTE_RATE);
  if (!workDate || minutes <= 0) return null;
  return {
    id: `SHL-G-${doc.id}`,
    userId: doc.drafterId,
    kind: 'GRANT',
    minutes,
    sourceDocId: doc.id,
    sourceDocNo: doc.docNo ?? '',
    workDate,
    expiresOn: plusOneYear(workDate),
    workMinutes,
    createdAt: now,
    createdBy: '시스템',
    note: '',
  };
}

/** 취소완료된 문서의 차감 줄 — 지급과 같은 분을 음수로. */
export function revokeEntryOf(grant: SubstituteLedgerEntry, now: string): SubstituteLedgerEntry {
  return { ...grant, id: `SHL-R-${grant.sourceDocId}`, kind: 'REVOKE', minutes: -Math.abs(grant.minutes), createdAt: now, note: '휴일근로 취소' };
}

/** 원장에 빠진 줄 — 완료 문서인데 지급이 없으면 지급, 취소완료 문서인데 지급만 있고 차감이 없으면 차감. */
export function missingLedgerEntries(docs: readonly DocLike[], ledger: readonly SubstituteLedgerEntry[], policy: BreakPolicy, now: string): SubstituteLedgerEntry[] {
  const ids = new Set(ledger.map((e) => e.id));
  const out: SubstituteLedgerEntry[] = [];
  for (const doc of docs) {
    if (doc.status === '완료') {
      const g = grantEntryOf(doc, policy, now);
      if (g && !ids.has(g.id)) out.push(g);
    } else if (doc.status === '취소완료') {
      const grant = ledger.find((e) => e.id === `SHL-G-${doc.id}`);
      if (grant && !ids.has(`SHL-R-${doc.id}`)) out.push(revokeEntryOf(grant, now));
    }
  }
  return out;
}

/** 대체휴무 휴가 사용 분 — 종일 1 = 480, 반차 0.5 = 240, 반반차 0.25 = 120. */
export function substituteUseMinutes(days: number): number {
  return Math.round(days * DAY_MIN);
}

export interface SubstituteDetail {
  entry: SubstituteLedgerEntry;
  netMin: number;
  usedMin: number;
  pendingMin: number;
  status: 'USED' | 'AVAILABLE' | 'EXPIRED' | 'REVOKED';
}

export interface SubstituteSummary {
  totalMin: number;
  usedMin: number;
  pendingMin: number;
  remainingMin: number;
  expiringSoonCount: number;
  /** 근거 문서별(지급 줄 기준), 최근 근무일 먼저 */
  detailList: SubstituteDetail[];
}

/** 원장과 사용 분으로 잔여 계산 — 근무일 오래된 지급부터 쓴다(선입선출). 만료·취소된 지급은 빼고 센다. */
export function allocateSubstitute(entries: readonly SubstituteLedgerEntry[], usedMin: number, pendingMin: number, refDate: string): SubstituteSummary {
  const grants = entries.filter((e) => e.kind === 'GRANT');
  const revokedBy = new Map<string, number>();
  for (const e of entries) if (e.kind === 'REVOKE') revokedBy.set(e.sourceDocId, (revokedBy.get(e.sourceDocId) ?? 0) + e.minutes);

  const soon = new Date(`${refDate}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 30);
  const soonStr = soon.toISOString().slice(0, 10);

  let leftUsed = usedMin;
  let leftPending = pendingMin;
  const details = [...grants]
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.id.localeCompare(b.id))
    .map((entry): SubstituteDetail => {
      const netMin = Math.max(0, entry.minutes + (revokedBy.get(entry.sourceDocId) ?? 0));
      if (netMin === 0) return { entry, netMin, usedMin: 0, pendingMin: 0, status: 'REVOKED' };
      if (entry.expiresOn && entry.expiresOn < refDate) return { entry, netMin, usedMin: 0, pendingMin: 0, status: 'EXPIRED' };
      const u = Math.min(netMin, leftUsed);
      leftUsed -= u;
      const p = Math.min(netMin - u, leftPending);
      leftPending -= p;
      return { entry, netMin, usedMin: u, pendingMin: p, status: u >= netMin ? 'USED' : 'AVAILABLE' };
    });

  const active = details.filter((d) => d.status === 'USED' || d.status === 'AVAILABLE');
  const totalMin = active.reduce((s, d) => s + d.netMin, 0);
  const used = active.reduce((s, d) => s + d.usedMin, 0);
  const pending = active.reduce((s, d) => s + d.pendingMin, 0);
  return {
    totalMin,
    usedMin: used,
    pendingMin: pending,
    remainingMin: Math.max(0, totalMin - used - pending),
    expiringSoonCount: active.filter((d) => d.usedMin + d.pendingMin < d.netMin && d.entry.expiresOn <= soonStr && d.entry.expiresOn >= refDate).length,
    detailList: details.reverse(),
  };
}

/** 분 → 'N시간 M분'. */
export function formatMinutes(min: number): string {
  const sign = min < 0 ? '-' : '';
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60);
  const m = a % 60;
  if (h && m) return `${sign}${h}시간 ${m}분`;
  if (m) return `${sign}${m}분`;
  return `${sign}${h}시간`;
}
