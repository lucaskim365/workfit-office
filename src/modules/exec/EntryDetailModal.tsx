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

/** 사람 한 명 — 사진(없으면 이름 첫 글자)과 이름·직급 */
function Person({ name, position, photo, note }: { name: string; position?: string; photo?: string; note?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel py-0.5 pr-2.5 pl-0.5">
      {photo ? (
        <img src={photo} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#0876c8]/12 text-[11px] font-bold text-[#0876c8]">{name.slice(0, 1)}</span>
      )}
      <span className="text-[12.5px] font-semibold text-ink">{name}</span>
      {position && <span className="text-[11px] text-ink3">{position}</span>}
      {note && <span className="rounded bg-panel-alt px-1 text-[10.5px] font-bold text-ink3">{note}</span>}
    </span>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-panel-alt text-ink3">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-ink3">{label}</div>
        <div className="mt-0.5 min-w-0 break-words text-[13.5px] leading-relaxed text-ink">{children}</div>
      </div>
    </div>
  );
}

/**
 * 일정 상세 — 읽기 전용(고치려면 업무계획에서).
 * 위: 일정 색 띠·종류·제목·시간과 지금 상태 / 가운데: 하루(08~20시) 중 어디쯤인지 / 아래: 장소·사람·문서·메모.
 */
export function EntryDetailModal({ entry, date, onClose }: { entry: DayEntry | null; date: string; onClose: () => void }) {
  const users = useUsers({ status: '사용' }).data ?? [];
  const now = useNowMinutes();
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

  return (
    <Modal open onClose={onClose} width={520} flush>
      {/* 머리 — 일정 색을 옅게 깐 띠 */}
      <div className="relative overflow-hidden px-6 pt-5 pb-5">
        <span className={`absolute inset-0 opacity-[.09] ${color}`} aria-hidden="true" />
        <span className={`absolute inset-x-0 top-0 h-1 ${color}`} aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-panel/80 px-2.5 py-1 text-[11.5px] font-bold text-ink2 shadow-[0_1px_0_rgba(0,0,0,.04)]">
              <i className={`h-2 w-2 rounded-full ${color}`} />
              {kindName(entry)}
              {tagName && <span className="font-semibold text-ink3">· {tagName}</span>}
            </span>
            <button type="button" onClick={onClose} aria-label="닫기" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink3 hover:bg-panel/70 hover:text-ink">
              <X size={17} />
            </button>
          </div>
          <h2 className="mt-3 text-[21px] leading-snug font-extrabold tracking-[-.03em] break-words text-ink">{title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink2">
            <span className="font-semibold">
              {mdOf(date)} {weekdayOf(date)}요일
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            {kind === 'timed' ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-ink tabular-nums">
                <Clock size={14} className="text-ink3" />
                {hm(entry.startTime!)} ~ {entry.endTime ? hm(entry.endTime) : '끝 시각 미정'}
                {startMin !== null && endMin !== null && endMin > startMin && <span className="font-semibold text-ink3">({durationText(endMin - startMin)})</span>}
              </span>
            ) : (
              <span className="font-bold text-ink">{kind === 'allDay' ? '종일' : '시간 미정'}</span>
            )}
            {status && <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${status.tone}`}>{status.text}</span>}
          </div>
        </div>
      </div>

      {/* 하루 중 어디쯤 — 08~20시 */}
      <div className="border-y border-border bg-panel px-6 py-4">
        {kind === 'undecided' ? (
          <div className="grid h-8 place-items-center rounded-lg border border-dashed border-border-hi text-[12px] font-bold text-ink3">시간을 정하지 않은 업무입니다</div>
        ) : (
          <>
            <div className="relative h-8 rounded-lg bg-panel-alt">
              {kind === 'allDay' ? (
                <span className={`absolute inset-1 grid place-items-center rounded-md text-[11.5px] font-bold text-white ${color}`}>하루 종일</span>
              ) : (
                startMin !== null && (
                  <span
                    className={`absolute top-1 bottom-1 rounded-md ${color}`}
                    style={{ left: `${pct(startMin)}%`, width: `max(6px, ${pct(endMin ?? startMin + 30) - pct(startMin)}%)` }}
                  />
                )
              )}
              {nowPct !== null && (
                <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-rose-500" style={{ left: `${nowPct}%` }} aria-hidden="true">
                  <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-rose-500" />
                </span>
              )}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-ink3 tabular-nums">
              {[8, 10, 12, 14, 16, 18, 20].map((h) => (
                <span key={h}>{h}시</span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 자세한 내용 */}
      <div className="divide-y divide-border/70 px-6 py-2">
        {multi && (
          <Row icon={<Clock size={15} />} label="기간">
            {mdOf(multi.from)}({weekdayOf(multi.from)}) ~ {mdOf(multi.to)}({weekdayOf(multi.to)})
            <span className="ml-1.5 text-[12px] font-semibold text-ink3">
              {daysBetween(multi.from, multi.to) + 1}일 중 {daysBetween(multi.from, date) + 1}일째
            </span>
          </Row>
        )}
        {ev?.location && (
          <Row icon={<MapPin size={15} />} label="장소">
            {ev.location}
          </Row>
        )}
        {entry.roomStatus && (
          <Row icon={<DoorOpen size={15} />} label="회의실 예약">
            <span className={`rounded px-1.5 py-0.5 text-[12px] font-bold ${entry.roomStatus === 'PENDING' ? 'bg-amber-500/12 text-amber-700' : 'bg-rose-500/12 text-rose-600'}`}>
              {entry.roomStatus === 'PENDING' ? '승인 대기' : '반려됨'}
            </span>
          </Row>
        )}
        {attendees.length > 0 && (
          <Row icon={<Users size={15} />} label={`참석자 ${attendees.length}명`}>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {attendees.map(({ id, u }) => (
                <Person key={id} name={u!.name} position={u!.position} photo={u!.photoThumbUrl || u!.photoUrl} note={ev?.ownerUserId === id ? '주최' : undefined} />
              ))}
            </div>
          </Row>
        )}
        {o?.destination && (
          <Row icon={<Navigation size={15} />} label="행선지">
            {o.destination}
          </Row>
        )}
        {o?.purpose && (
          <Row icon={<Target size={15} />} label="목적">
            {o.purpose}
          </Row>
        )}
        {o?.companions && (
          <Row icon={<Users size={15} />} label="동행">
            {o.companions}
          </Row>
        )}
        {o?.transportation && (
          <Row icon={<Car size={15} />} label="교통">
            {o.transportation}
          </Row>
        )}
        {owner && (
          <Row icon={<UserRound size={15} />} label="함께 가는 일정 — 등록한 사람">
            <div className="mt-1">
              <Person name={owner.name} position={owner.position} photo={owner.photoThumbUrl || owner.photoUrl} />
            </div>
          </Row>
        )}
        {doc && (
          <Row icon={<FileText size={15} />} label="결재 문서">
            <span className="font-semibold">{doc.docTitle}</span>
            {doc.docNo && <span className="ml-1.5 text-[12px] text-ink3 tabular-nums">{doc.docNo}</span>}
            {sch?.drafterName && <div className="text-[12px] text-ink3">기안 {sch.drafterName}{sch.drafterDept ? ` · ${sch.drafterDept}` : ''}</div>}
          </Row>
        )}
        {routine && entry.item && (
          <Row icon={<Repeat size={15} />} label="반복">
            {routineLabel(entry.item.date, routine)}
          </Row>
        )}
        {ev?.visibility && (
          <Row icon={<Eye size={15} />} label="공개 범위">
            {CALENDAR_VISIBILITY_LABELS[ev.visibility as keyof typeof CALENDAR_VISIBILITY_LABELS] ?? ''}
          </Row>
        )}
        {memo && (
          <div className="py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-ink3">
              <StickyNote size={13} />
              메모
            </div>
            <div className="rounded-xl border-l-[3px] border-border-hi bg-panel-alt px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words text-ink">{memo}</div>
          </div>
        )}
        {!multi && !ev?.location && !attendees.length && !o && !doc && !routine && !memo && !owner && (
          <div className="py-5 text-center text-[12.5px] text-ink3">적어 둔 내용이 없습니다.</div>
        )}
      </div>

      <div className="flex justify-end px-6 pt-1 pb-5">
        <button type="button" onClick={onClose} className="cursor-pointer rounded-lg bg-panel-alt px-5 py-2 text-[13px] font-bold text-ink2 hover:bg-border/60">
          닫기
        </button>
      </div>
    </Modal>
  );
}
