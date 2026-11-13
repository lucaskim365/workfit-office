import { useEffect, useState, type ReactNode } from 'react';
import { Car, Clock, DoorOpen, Eye, FileText, MapPin, Navigation, Repeat, StickyNote, Target, UserRound, Users, X } from 'lucide-react';
import { useUsers } from '@/features/user/useUsers';
import { CALENDAR_EVENT_TYPE_LABELS, CALENDAR_VISIBILITY_LABELS } from '@/domain/calendarEvent/schema';
import { OUTSIDE_WORK_CATEGORY_LABELS } from '@/domain/outsideWork/schema';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import { stripInlineMarks } from '@/domain/workPlan/richText';
import { routineLabel } from '@/domain/workPlan/routine';
import { chipLook, entryDotClass } from '@/modules/gw/task/components/entryChipLook';
import { Modal } from '@/shared/ui/Modal';
import { minutesOf } from './dashboard';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_FROM = 8 * 60;
const DAY_TO = 20 * 60;

/** 시각 없는 업무는 '시간 미정', 외근·출장·휴가·회의의 시각 없는 일정은 '종일' (업무계획과 같은 규칙) */
export function entryTimeKind(e: DayEntry): 'allDay' | 'timed' | 'undecided' {
  if (!e.allDay && minutesOf(e.startTime) !== null) return 'timed';
  return e.source === 'ITEM' ? 'undecided' : 'allDay';
}

/** 일정 종류 이름 */
function kindName(e: DayEntry): string {
  switch (e.source) {
    case 'ITEM':
      return '업무';
    case 'MEETING':
      return '회의';
    case 'CALENDAR':
      return e.event ? CALENDAR_EVENT_TYPE_LABELS[e.event.eventType as keyof typeof CALENDAR_EVENT_TYPE_LABELS]?.label ?? '일정' : '일정';
    case 'OUTSIDE': {
      if (!e.outside) return '외근·출장';
      const cat = OUTSIDE_WORK_CATEGORY_LABELS[e.outside.category];
      return e.outside.subType && e.outside.subType !== cat ? `${cat} · ${e.outside.subType}` : cat;
    }
    case 'APPROVAL':
      if (e.schedule?.category === 'LEAVE') return e.schedule.leaveType ? `휴가 · ${e.schedule.leaveType}` : '휴가';
      return e.schedule?.subType || e.schedule?.docType || '결재 일정';
    default:
      return '일정';
  }
}

const hm = (t: string) => t.slice(0, 5);
const mdOf = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const weekdayOf = (d: string) => WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** 걸리는 시간 — '1시간 30분' */
function durationText(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}시간` : '', m ? `${m}분` : ''].filter(Boolean).join(' ') || '0분';
}

/** 지금 기준 상태 — 오늘 일정만 */
function useNowMinutes(): number {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
}

function statusOf(start: number, end: number | null, now: number): { text: string; tone: string } {
  if (now < start) {
    const left = start - now;
    return { text: left <= 60 ? `${left}분 뒤 시작` : `${durationText(left)} 뒤 시작`, tone: 'bg-[#0876c8]/10 text-[#0876c8]' };
  }
  if (end === null || now < end) return { text: '진행 중', tone: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' };
  return { text: '끝남', tone: 'bg-panel-alt text-ink3' };
}

/** 시각 있는 일정의 [시작, 끝] 분 — 끝이 없으면 30분으로 본다 */
function spanOf(e: DayEntry): [number, number] | null {
  if (entryTimeKind(e) !== 'timed') return null;
  const s = minutesOf(e.startTime);
  if (s === null) return null;
  const end = minutesOf(e.endTime);
  return [s, end !== null && end > s ? end : s + 30];
}

type Near = { entry: DayEntry; role: 'prev' | 'with' | 'next' | 'day'; note: string };

/**
 * 고른 일정의 앞뒤·겹치는 일정.
 * 시각 있는 일정: 바로 앞(끝난 것 중 가장 늦은 것) · 겹치는 것 · 바로 뒤(시작 중 가장 이른 것), 쉬는 틈도 함께.
 * 종일 일정은 겹침에 넣지 않는다 — 종일을 고르면 목록 없음, 다른 일정의 앞뒤·겹침에도 안 나온다.
 * 시간 미정: 그날의 시각 있는 일정을 순서대로(최대 4개).
 */
function nearOf(entry: DayEntry, all: DayEntry[]): Near[] {
  const others = all.filter((x) => x.key !== entry.key);
  if (entryTimeKind(entry) === 'allDay') return [];
  const me = spanOf(entry);
  const timed = others.map((x) => ({ x, sp: spanOf(x) })).filter((o): o is { x: DayEntry; sp: [number, number] } => o.sp !== null);
  if (!me) {
    return timed
      .sort((a, b) => a.sp[0] - b.sp[0])
      .slice(0, 4)
      .map(({ x }) => ({ entry: x, role: 'day' as const, note: '' }));
  }
  const [s, e] = me;
  const prev = timed.filter((o) => o.sp[1] <= s).sort((a, b) => b.sp[1] - a.sp[1])[0];
  const next = timed.filter((o) => o.sp[0] >= e).sort((a, b) => a.sp[0] - b.sp[0])[0];
  const withs = timed.filter((o) => o.sp[0] < e && s < o.sp[1]).sort((a, b) => a.sp[0] - b.sp[0]);
  const gap = (m: number) => (m <= 0 ? '바로 이어서' : `${durationText(m)} 틈`);
  const overlap = (o: [number, number]) => durationText(Math.min(e, o[1]) - Math.max(s, o[0]));
  return [
    ...(prev ? [{ entry: prev.x, role: 'prev' as const, note: gap(s - prev.sp[1]) }] : []),
    ...withs.map((o) => ({ entry: o.x, role: 'with' as const, note: `${overlap(o.sp)} 겹침` })),
    ...(next ? [{ entry: next.x, role: 'next' as const, note: gap(next.sp[0] - e) }] : []),
  ];
}

const ROLE_LABEL: Record<Near['role'], string> = { prev: '앞', with: '겹침', next: '뒤', day: '' };
const ROLE_TONE: Record<Near['role'], string> = {
  prev: 'bg-panel-alt text-ink3',
  with: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
  next: 'bg-panel-alt text-ink3',
  day: '',
};

function timeText(e: DayEntry): string {
  const k = entryTimeKind(e);
  if (k === 'allDay') return '종일';
  if (k === 'undecided') return '미정';
  return `${hm(e.startTime!)}${e.endTime ? `~${hm(e.endTime)}` : '~'}`;
}

/** 사람 한 명 — 사진(없으면 이름 첫 글자)과 이름·직급 */
function Person({ name, position, photo, note }: { name: string; position?: string; photo?: string; note?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel py-0.5 pr-2.5 pl-0.5">
      {photo ? (
        <img src={photo} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0876c8]/12 text-[10px] font-bold text-[#0876c8]">{name.slice(0, 1)}</span>
      )}
      <span className="text-[12px] font-semibold text-ink">{name}</span>
      {position && <span className="text-[11px] text-ink3">{position}</span>}
      {note && <span className="rounded bg-panel-alt px-1 text-[10.5px] font-bold text-ink3">{note}</span>}
    </span>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 py-2">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-panel-alt text-ink3">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold text-ink3">{label}</div>
        <div className="min-w-0 break-words text-[12.5px] leading-relaxed text-ink">{children}</div>
      </div>
    </div>
  );
}

/**
 * 일정 상세 — 읽기 전용(고치려면 업무계획에서).
 * 위: 일정 색 띠·종류·제목·시간과 지금 상태 / 하루(08~20시) 막대(다른 일정은 옅게) / 앞뒤·겹치는 일정 / 장소·사람·문서·메모.
 */
export function EntryDetailModal({ entry, date, all = [], onPick, onClose }: {
  entry: DayEntry | null;
  date: string;
  /** 그날 일정 전체 — 앞뒤·겹치는 일정을 함께 보인다 */
  all?: DayEntry[];
  /** 앞뒤 일정을 누르면 그 일정으로 바꿔 보기 */
  onPick?: (e: DayEntry) => void;
  onClose: () => void;
}) {
  const users = useUsers({ status: '사용' }).data ?? [];
  const now = useNowMinutes();
  /** 앞뒤 일정 목록에서 커서를 올린 일정 — 하루 막대에서 그 일정을 제 색으로 옅게 */
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  // 다른 일정으로 바꿔 보면 올려 둔 표시는 지운다
  useEffect(() => setHoverKey(null), [entry?.key]);
  if (!entry) return null;

  const userOf = (id: string) => users.find((u) => u.id === id);
  const color = entryDotClass(entry);
  const title = chipLook(entry).label;
  const kind = entryTimeKind(entry);
  const startMin = kind === 'timed' ? minutesOf(entry.startTime) : null;
  const endMin = kind === 'timed' ? minutesOf(entry.endTime) : null;
  const o = entry.outside;
  const ev = entry.event;
  const sch = entry.schedule;
  const isLeave = entry.source === 'APPROVAL' && sch?.category === 'LEAVE';

  // 여러 날 일정 — 기간과 오늘이 며칠째인지
  const range = o ? { from: o.startDate, to: o.endDate } : sch ? { from: sch.startDate, to: sch.endDate } : null;
  const multi = range && range.from !== range.to ? range : null;

  const attendees = (ev?.attendeeUserIds ?? []).map((id) => ({ id, u: userOf(id) })).filter((x) => x.u);
  const owner = entry.companionOf ? userOf(entry.companionOf) : undefined;
  const memo = stripInlineMarks((entry.item?.memo || ev?.memo || (!isLeave ? o?.memo : '') || '').trim());
  const doc = o?.approval ?? (sch && !isLeave ? { docNo: sch.docNo, docTitle: sch.docTitle } : null);
  const tagName = entry.source === 'ITEM' && entry.tag?.name && entry.tag.name !== '업무' ? entry.tag.name : '';
  const routine = entry.item?.routine;

  const status = startMin !== null ? statusOf(startMin, endMin, now) : null;
  const pct = (m: number) => Math.min(100, Math.max(0, ((m - DAY_FROM) / (DAY_TO - DAY_FROM)) * 100));
  const nowPct = now >= DAY_FROM && now <= DAY_TO ? pct(now) : null;
  const near = nearOf(entry, all);
  /** 막대에 옅게 깔 그날의 다른 일정 */
  const otherSpans = all.filter((x) => x.key !== entry.key).map((x) => ({ key: x.key, sp: spanOf(x) })).filter((o) => o.sp);

  return (
    <Modal open onClose={onClose} width={440} flush>
      {/* 머리 — 일정 색을 옅게 깐 띠 */}
      <div className="relative overflow-hidden px-5 pt-4 pb-4">
        <span className={`absolute inset-0 opacity-[.09] ${color}`} aria-hidden="true" />
        <span className={`absolute inset-x-0 top-0 h-1 ${color}`} aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-panel/80 px-2 py-0.5 text-[10.5px] font-bold text-ink2 shadow-[0_1px_0_rgba(0,0,0,.04)]">
              <i className={`h-2 w-2 rounded-full ${color}`} />
              {kindName(entry)}
              {tagName && <span className="font-semibold text-ink3">· {tagName}</span>}
            </span>
            <button type="button" onClick={onClose} aria-label="닫기" className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-ink3 hover:bg-panel/70 hover:text-ink">
              <X size={13} />
            </button>
          </div>
          <h2 className="mt-2 text-[17px] leading-snug font-extrabold tracking-[-.03em] break-words text-ink">{title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink2">
            <span className="font-semibold">
              {mdOf(date)} {weekdayOf(date)}요일
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            {kind === 'timed' ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-ink tabular-nums">
                <Clock size={13} className="text-ink3" />
                {hm(entry.startTime!)} ~ {entry.endTime ? hm(entry.endTime) : '끝 시각 미정'}
                {startMin !== null && endMin !== null && endMin > startMin && <span className="font-semibold text-ink3">({durationText(endMin - startMin)})</span>}
              </span>
            ) : (
              <span className="font-bold text-ink">{kind === 'allDay' ? '종일' : '시간 미정'}</span>
            )}
            {status && <span className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${status.tone}`}>{status.text}</span>}
          </div>
        </div>
      </div>

      {/* 하루 중 어디쯤 — 08~20시. 종일 일정은 막대 없이 내용·메모만 */}
      {kind !== 'allDay' && (
      <div className="border-y border-border bg-panel px-5 py-3">
        {kind === 'undecided' ? (
          <div className="grid h-7 place-items-center rounded-lg border border-dashed border-border-hi text-[12px] font-bold text-ink3">시간을 정하지 않은 업무입니다</div>
        ) : (
          <>
            <div className="relative h-7 rounded-lg bg-panel-alt">
              {otherSpans.map(({ key, sp }) => (
                <span
                  key={key}
                  className={`absolute top-1.5 bottom-1.5 rounded transition-colors ${hoverKey === key ? `${entryDotClass(all.find((x) => x.key === key)!)} opacity-30` : 'bg-ink3/20'}`}
                  style={{ left: `${pct(sp![0])}%`, width: `${Math.max(0.6, pct(sp![1]) - pct(sp![0]))}%` }}
                />
              ))}
              {startMin !== null && (
                <span
                  className={`absolute top-1 bottom-1 rounded-md opacity-55 ${color}`}
                  style={{ left: `${pct(startMin)}%`, width: `max(6px, ${pct(endMin ?? startMin + 30) - pct(startMin)}%)` }}
                />
              )}
              {nowPct !== null && (
                <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-rose-500" style={{ left: `${nowPct}%` }} aria-hidden="true">
                  <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-rose-500" />
                </span>
              )}
            </div>
            <div className="mt-1 flex justify-between text-[9.5px] text-ink3 tabular-nums">
              {[8, 10, 12, 14, 16, 18, 20].map((h) => (
                <span key={h}>{h}시</span>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {/* 앞뒤·겹치는 일정 — 누르면 그 일정으로 */}
      {near.length > 0 && (
        <div className="border-b border-border px-5 py-3">
          <div className="mb-1.5 text-[11px] font-bold text-ink3">{kind === 'timed' ? '앞뒤·겹치는 일정' : '이날 다른 일정'}</div>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {near.map((n) => (
              <li key={n.entry.key}>
                <button
                  type="button"
                  onClick={() => onPick?.(n.entry)}
                  onMouseEnter={() => setHoverKey(n.entry.key)}
                  onMouseLeave={() => setHoverKey((k) => (k === n.entry.key ? null : k))}
                  onFocus={() => setHoverKey(n.entry.key)}
                  onBlur={() => setHoverKey((k) => (k === n.entry.key ? null : k))}
                  className="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-panel-alt"
                >
                  {n.role !== 'day' && <span className={`w-9 shrink-0 rounded px-1 py-px text-center text-[10.5px] font-bold ${ROLE_TONE[n.role]}`}>{ROLE_LABEL[n.role]}</span>}
                  <span className="w-[76px] shrink-0 text-[11.5px] text-ink3 tabular-nums">{timeText(n.entry)}</span>
                  <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${entryDotClass(n.entry)}`} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink group-hover:text-[#0876c8]">{chipLook(n.entry).label}</span>
                  {n.note && <span className="shrink-0 text-[11px] text-ink3">{n.note}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 자세한 내용 */}
      <div className="divide-y divide-border/70 px-5 py-1">
        {multi && (
          <Row icon={<Clock size={13} />} label="기간">
            {mdOf(multi.from)}({weekdayOf(multi.from)}) ~ {mdOf(multi.to)}({weekdayOf(multi.to)})
            <span className="ml-1.5 text-[12px] font-semibold text-ink3">
              {daysBetween(multi.from, multi.to) + 1}일 중 {daysBetween(multi.from, date) + 1}일째
            </span>
          </Row>
        )}
        {ev?.location && (
          <Row icon={<MapPin size={13} />} label="장소">
            {ev.location}
          </Row>
        )}
        {entry.roomStatus && (
          <Row icon={<DoorOpen size={13} />} label="회의실 예약">
            <span className={`rounded px-1.5 py-0.5 text-[12px] font-bold ${entry.roomStatus === 'PENDING' ? 'bg-amber-500/12 text-amber-700' : 'bg-rose-500/12 text-rose-600'}`}>
              {entry.roomStatus === 'PENDING' ? '승인 대기' : '반려됨'}
            </span>
          </Row>
        )}
        {attendees.length > 0 && (
          <Row icon={<Users size={13} />} label={`참석자 ${attendees.length}명`}>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {attendees.map(({ id, u }) => (
                <Person key={id} name={u!.name} position={u!.position} photo={u!.photoThumbUrl || u!.photoUrl} note={ev?.ownerUserId === id ? '주최' : undefined} />
              ))}
            </div>
          </Row>
        )}
        {o?.destination && (
          <Row icon={<Navigation size={13} />} label="행선지">
            {o.destination}
          </Row>
        )}
        {o?.purpose && (
          <Row icon={<Target size={13} />} label="목적">
            {o.purpose}
          </Row>
        )}
        {o?.companions && (
          <Row icon={<Users size={13} />} label="동행">
            {o.companions}
          </Row>
        )}
        {o?.transportation && (
          <Row icon={<Car size={13} />} label="교통">
            {o.transportation}
          </Row>
        )}
        {owner && (
          <Row icon={<UserRound size={13} />} label="함께 가는 일정 — 등록한 사람">
            <div className="mt-1">
              <Person name={owner.name} position={owner.position} photo={owner.photoThumbUrl || owner.photoUrl} />
            </div>
          </Row>
        )}
        {doc && (
          <Row icon={<FileText size={13} />} label="결재 문서">
            <span className="font-semibold">{doc.docTitle}</span>
            {doc.docNo && <span className="ml-1.5 text-[12px] text-ink3 tabular-nums">{doc.docNo}</span>}
            {sch?.drafterName && <div className="text-[12px] text-ink3">기안 {sch.drafterName}{sch.drafterDept ? ` · ${sch.drafterDept}` : ''}</div>}
          </Row>
        )}
        {routine && entry.item && (
          <Row icon={<Repeat size={13} />} label="반복">
            {routineLabel(entry.item.date, routine)}
          </Row>
        )}
        {ev?.visibility && (
          <Row icon={<Eye size={13} />} label="공개 범위">
            {CALENDAR_VISIBILITY_LABELS[ev.visibility as keyof typeof CALENDAR_VISIBILITY_LABELS] ?? ''}
          </Row>
        )}
        {memo && (
          <div className="py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-ink3">
              <StickyNote size={13} />
              메모
            </div>
            <div className="rounded-lg border-l-[3px] border-border-hi bg-panel-alt px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-ink">{memo}</div>
          </div>
        )}
        {!multi && !ev?.location && !attendees.length && !o && !doc && !routine && !memo && !owner && (
          <div className="py-4 text-center text-[12px] text-ink3">적어 둔 내용이 없습니다.</div>
        )}
      </div>

      <div className="flex justify-end px-5 pt-1 pb-4">
        <button type="button" onClick={onClose} className="cursor-pointer rounded-lg bg-panel-alt px-4 py-1.5 text-[12px] font-bold text-ink2 hover:bg-border/60">
          닫기
        </button>
      </div>
    </Modal>
  );
}
