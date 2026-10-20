import { useMemo, useState, type ReactNode } from 'react';
import { AlignLeft, ArrowRight, Car, Clock, Eye, MapPin, UserPlus, Users, X } from 'lucide-react';
import { canJoinMeeting } from '@/domain/calendarEvent/meeting';
import { CALENDAR_VISIBILITY_LABELS, type CalendarEvent, type CalendarVisibility } from '@/domain/calendarEvent/schema';
import type { User } from '@/domain/user/schema';
import { DAY_END, durationLabel, toHHmm, toMinutes } from '@/domain/workPlan/timeGrid';
import { useCanDesignate } from '@/features/auth/useCanDesignate';
import { useOutsideSchedulesOf } from '@/features/outsideWork/useOutsideWorks';
import { MemberPicker } from '@/modules/gw/task/MemberPicker';
import { Button } from '@/shared/ui/Button';
import { SelectField } from '@/shared/ui/form/SelectField';
import { TextField } from '@/shared/ui/form/TextField';
import { RoomPicker } from './RoomPicker';
import type { useWorkPlanEventForm } from './useWorkPlanEventForm';

export type EventForm = ReturnType<typeof useWorkPlanEventForm>;

const DEFAULT_LENGTH = 60;

const textareaClass =
  'w-full resize-y rounded-md border border-border-hi bg-panel px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink3 focus:border-teal disabled:bg-panel-alt';

const titleClass =
  'w-full border-0 border-b-2 border-border-hi bg-transparent px-0.5 py-1.5 text-[15px] font-bold text-ink outline-none transition-colors placeholder:font-semibold placeholder:text-ink3 focus:border-blue';

function Row({ icon, label, children }: { icon?: ReactNode; label?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5" role="group" aria-label={label}>
      <span className="flex w-4 shrink-0 justify-center pt-2.5 text-ink3">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

interface EventFieldsProps {
  form: EventForm;
  actor: User;
  users: User[];
  /** 외근·출장 겹침 경고 대상(일정 주인) */
  ownerId: string;
  ownerName: string;
  /** 고치는 외근·출장 원본 id — 겹침 경고에서 자기 자신을 뺀다 */
  outsideSelfId: string | null;
  onJoin: (meeting: CalendarEvent) => void;
}

/** 일정 창 왼쪽 입력 — 종류(일반·회의·외근·출장)마다 칸이 다르다. */
export function EventFields({ form, actor, users, ownerId, ownerName, outsideSelfId, onJoin }: EventFieldsProps) {
  const { state, set, readOnly } = form;
  const isOutside = state.kind === 'OUTSIDE' || state.kind === 'TRIP';
  const isMeeting = state.kind === 'MEETING';
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? '';

  return (
    <div className="flex flex-col gap-3.5">
      <Row label={isOutside ? '행선지' : '제목'}>
        {isOutside ? (
          <input
            aria-label="행선지"
            className={titleClass}
            value={state.destination}
            maxLength={200}
            placeholder="행선지"
            disabled={readOnly}
            autoFocus={!readOnly}
            onChange={(e) => set('destination', e.target.value)}
          />
        ) : (
          <input
            aria-label="제목"
            className={titleClass}
            value={state.title}
            maxLength={100}
            placeholder={isMeeting ? '회의 제목' : '제목'}
            disabled={readOnly}
            autoFocus={!readOnly}
            onChange={(e) => set('title', e.target.value)}
          />
        )}
      </Row>

      {isMeeting && (
        <Row icon={<Users size={15} />} label="참석자">
          <AttendeeField form={form} actor={actor} users={users} />
        </Row>
      )}

      <Row icon={<Clock size={15} />} label="날짜·시간">
        <TimeFields form={form} />
      </Row>

      {isMeeting && (
        <Row icon={<MapPin size={15} />} label="장소">
          <RoomPicker
            mode={state.locationMode}
            onModeChange={(mode) => set('locationMode', mode)}
            text={state.locationText}
            onTextChange={(text) => set('locationText', text)}
            rooms={form.rooms}
            roomId={state.roomId}
            onRoomChange={(roomId) => set('roomId', roomId)}
            disabled={readOnly}
          />
        </Row>
      )}

      {isOutside && (
        <Row icon={<Users size={15} />} label="동행자">
          <CompanionField form={form} actor={actor} users={users} nameOf={nameOf} />
        </Row>
      )}

      {isOutside && (
        <Row icon={<AlignLeft size={15} />} label="목적">
          <textarea
            aria-label="목적"
            className={`${textareaClass} min-h-[52px]`}
            value={state.purpose}
            maxLength={500}
            rows={2}
            placeholder="목적"
            disabled={readOnly}
            onChange={(e) => set('purpose', e.target.value)}
          />
        </Row>
      )}

      <Row icon={isOutside ? <span className="w-[15px]" /> : <AlignLeft size={15} />} label="세부 내용">
        <textarea
          aria-label={isMeeting ? '세부 내용·안건' : '메모'}
          className={`${textareaClass} min-h-[84px]`}
          value={state.memo}
          maxLength={state.kind === 'ITEM' ? 1000 : 2000}
          rows={4}
          placeholder={isMeeting ? '세부 내용 · 안건' : '메모'}
          disabled={readOnly}
          onChange={(e) => set('memo', e.target.value)}
        />
      </Row>

      {isMeeting && (
        <Row icon={<Eye size={15} />} label="공개 범위">
          <div className="w-44">
            <SelectField
              aria-label="공개 범위"
              value={state.visibility}
              disabled={readOnly}
              options={visibilityOptionsOf(form.visibilityOptions, state.visibility)}
              onChange={(e) => set('visibility', e.target.value as CalendarVisibility)}
            />
          </div>
        </Row>
      )}

      {isOutside && (
        <Row icon={<Car size={15} />} label="교통수단·연락처">
          <div className="grid grid-cols-2 gap-2">
            <TextField
              aria-label="교통수단"
              value={state.transportation}
              maxLength={50}
              placeholder="교통수단"
              disabled={readOnly}
              onChange={(e) => set('transportation', e.target.value)}
            />
            <TextField
              aria-label="연락처"
              value={state.contact}
              maxLength={50}
              placeholder="연락처"
              disabled={readOnly}
              onChange={(e) => set('contact', e.target.value)}
            />
          </div>
        </Row>
      )}

      {isOutside && !readOnly && (
        <OutsideOverlapWarning
          ownerId={ownerId}
          ownerName={ownerName}
          selfId={outsideSelfId}
          startDate={state.date}
          endDate={state.endDate < state.date ? state.date : state.endDate}
        />
      )}

      {isMeeting && form.similarMeetings.length > 0 && (
        <SimilarMeetings meetings={form.similarMeetings} actorId={actor.id} nameOf={nameOf} saving={form.saving} onJoin={onJoin} />
      )}
    </div>
  );
}

/** 기존 공개 범위가 선택지에 없으면(예: 부서 없음) 그 값도 남겨 둔다 */
function visibilityOptionsOf(options: CalendarVisibility[], current: CalendarVisibility) {
  const list = options.includes(current) ? options : [...options, current];
  return list.map((value) => ({ value, label: CALENDAR_VISIBILITY_LABELS[value] }));
}

function TimeFields({ form }: { form: EventForm }) {
  const { state, set, readOnly } = form;
  const isOutside = state.kind === 'OUTSIDE' || state.kind === 'TRIP';
  const isMeeting = state.kind === 'MEETING';
  const range = state.range;
  const showTimes = isMeeting || !state.allDay;

  const onStart = (value: string) => {
    if (!value) return;
    const start = toMinutes(value);
    const length = range ? range.end - range.start : DEFAULT_LENGTH;
    form.setRange({ start, end: Math.min(start + Math.max(length, 1), DAY_END) });
  };
  const onEnd = (value: string) => {
    if (!value) return;
    const end = toMinutes(value);
    form.setRange({ start: range?.start ?? Math.max(end - DEFAULT_LENGTH, 0), end });
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TextField
        type="date"
        aria-label={isOutside ? '시작일' : '날짜'}
        value={state.date}
        disabled={readOnly}
        className="w-[140px]"
        onChange={(e) => form.setDate(e.target.value)}
      />
      {isOutside && (
        <>
          <span className="text-ink3">~</span>
          <TextField
            type="date"
            aria-label="종료일"
            value={state.endDate}
            min={state.date}
            disabled={readOnly}
            className="w-[140px]"
            onChange={(e) => e.target.value && set('endDate', e.target.value)}
          />
        </>
      )}
      {showTimes && (
        <>
          <TextField
            type="time"
            aria-label="시작 시각"
            value={range ? toHHmm(range.start) : ''}
            disabled={readOnly}
            className="w-[108px]"
            onChange={(e) => onStart(e.target.value)}
          />
          <ArrowRight size={13} className="text-ink3" />
          <TextField
            type="time"
            aria-label="종료 시각"
            value={range ? toHHmm(range.end) : ''}
            disabled={readOnly}
            className="w-[108px]"
            onChange={(e) => onEnd(e.target.value)}
          />
          {range && range.end > range.start && (
            <span className="text-[11px] font-semibold text-ink3">{durationLabel(range)}</span>
          )}
        </>
      )}
      {!isMeeting && (
        <label className="ml-1 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink2">
          <input
            type="checkbox"
            className="accent-teal"
            checked={state.allDay}
            disabled={readOnly}
            onChange={(e) => form.setAllDay(e.target.checked)}
          />
          종일
        </label>
      )}
    </div>
  );
}

/** 회의 참석자 — 이름·부서 검색 칩(캘린더 회의 창과 같은 후보 규칙) */
function AttendeeField({ form, actor, users }: { form: EventForm; actor: User; users: User[] }) {
  const { state, set, readOnly } = form;
  const { canDesignate } = useCanDesignate();
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => state.attendeeIds.map((id) => users.find((u) => u.id === id)).filter((u): u is User => Boolean(u)),
    [state.attendeeIds, users],
  );

  const candidates = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return [];
    return users
      .filter((u) => u.status === '사용' && !u.resignedAt && u.id !== actor.id && !state.attendeeIds.includes(u.id) && canDesignate(u))
      .filter((u) => u.name.toLowerCase().includes(kw) || u.dept.toLowerCase().includes(kw) || (u.position ?? '').toLowerCase().includes(kw))
      .slice(0, 8);
  }, [users, keyword, actor.id, state.attendeeIds, canDesignate]);

  const add = (id: string) => {
    set('attendeeIds', [...state.attendeeIds, id]);
    setKeyword('');
    setOpen(false);
  };
  const remove = (id: string) => set('attendeeIds', state.attendeeIds.filter((v) => v !== id));

  return (
    <div className="relative">
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-border-hi bg-panel px-1.5 py-1 focus-within:border-teal">
        {selected.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 rounded-full bg-blue-soft py-0.5 pl-2 pr-1 text-[11px] font-semibold text-blue"
          >
            {u.name}{u.position ? ` ${u.position}` : ''}
            {!readOnly && (
              <button
                type="button"
                aria-label={`${u.name} 빼기`}
                className="grid h-4 w-4 place-items-center rounded-full hover:bg-blue/15"
                onClick={() => remove(u.id)}
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <input
            type="text"
            aria-label="참석자 검색"
            value={keyword}
            placeholder={selected.length === 0 ? '이름 또는 부서로 참석자 추가' : ''}
            className="h-6 min-w-[120px] flex-1 bg-transparent px-1 text-[12px] text-ink outline-none placeholder:text-ink3"
            onChange={(e) => {
              setKeyword(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              // 검색 목록만 닫는다(창의 ESC 닫기까지 가지 않게)
              if (e.key !== 'Escape' || !open || !keyword.trim()) return;
              e.nativeEvent.stopPropagation();
              setOpen(false);
            }}
          />
        )}
        {!readOnly && <UserPlus size={13} className="mr-1 shrink-0 text-ink3" />}
      </div>

      {open && keyword.trim() && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-panel py-1 shadow-lg">
          {candidates.length === 0 ? (
            <div className="py-3 text-center text-[11px] text-ink3">일치하는 사원이 없습니다.</div>
          ) : (
            candidates.map((u) => (
              <button
                key={u.id}
                type="button"
                // 입력칸 blur 보다 먼저 받는다
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(u.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] hover:bg-panel-alt"
              >
                <span className="font-bold text-ink">{u.name}</span>
                <span className="text-[10.5px] text-ink3">{u.position}</span>
                <span className="ml-auto rounded bg-panel-alt px-1.5 text-[10px] text-ink3">{u.dept}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** 외근·출장 동행자 — 기존 등록 창과 같은 부서 트리 선택기 */
function CompanionField({ form, actor, users, nameOf }: { form: EventForm; actor: User; users: User[]; nameOf: (id: string) => string }) {
  const { state, set, readOnly } = form;
  const [showPicker, setShowPicker] = useState(false);
  const pickable = useMemo(() => users.filter((u) => u.id !== actor.id), [users, actor.id]);
  const companions = state.companionIds.map((id) => ({ id, name: nameOf(id) })).filter((c) => c.name);

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex flex-wrap items-center gap-1">
        {companions.map(({ id, name }) => (
          <span key={id} className="rounded-full bg-blue-soft px-2 py-0.5 text-[11px] font-semibold text-blue">
            {name}
          </span>
        ))}
        {companions.length === 0 && readOnly && <span className="text-[11.5px] text-ink3">없음</span>}
        {!readOnly && (
          <Button size="sm" variant="accent" onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? '닫기' : '동행자 선택'}
          </Button>
        )}
      </div>
      {showPicker && !readOnly && (
        <MemberPicker users={pickable} selected={state.companionIds} lockedUserId="" onChange={(ids) => set('companionIds', ids)} />
      )}
    </div>
  );
}

/** 같은 사람의 같은 기간 외근·출장(결재 완료 + 직접 등록) — 경고만, 저장은 막지 않는다 */
function OutsideOverlapWarning({
  ownerId,
  ownerName,
  selfId,
  startDate,
  endDate,
}: {
  ownerId: string;
  ownerName: string;
  selfId: string | null;
  startDate: string;
  endDate: string;
}) {
  const existing = useOutsideSchedulesOf(ownerId, ownerName);
  const overlapping = existing.filter(
    (v) => v.key !== (selfId ? `self-${selfId}` : '') && v.startDate <= endDate && v.endDate >= startDate,
  );
  if (overlapping.length === 0) return null;
  return (
    <p className="rounded-md border border-amber/30 bg-amber-soft/30 px-3 py-2 text-[11px] font-semibold text-amber">
      이 기간에 이미 외근·출장이 있습니다:{' '}
      {overlapping.map((v) => `${v.subType}${v.destination ? ` (${v.destination})` : ''}`).join(', ')}
    </p>
  );
}

function SimilarMeetings({
  meetings,
  actorId,
  nameOf,
  saving,
  onJoin,
}: {
  meetings: CalendarEvent[];
  actorId: string;
  nameOf: (id: string) => string;
  saving: boolean;
  onJoin: (meeting: CalendarEvent) => void;
}) {
  return (
    <div className="rounded-lg border border-amber/30 bg-amber-soft/30 px-3 py-2.5">
      <div className="mb-1.5 text-[11px] font-bold text-amber">비슷한 회의가 있습니다</div>
      <div className="flex flex-col gap-1.5">
        {meetings.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-panel px-2.5 py-1.5">
            <div className="min-w-0">
              <div className="truncate text-[11.5px] font-bold text-ink">{m.title}</div>
              <div className="text-[10px] text-ink3">
                {m.allDay ? '종일' : `${m.startTime}~${m.endTime}`} · 주최 {nameOf(m.ownerUserId) || '알 수 없음'} · 참석 {m.attendeeUserIds.length}명
              </div>
            </div>
            {canJoinMeeting(actorId, m) ? (
              <Button size="sm" variant="primary" disabled={saving} onClick={() => onJoin(m)}>
                참석자로 합류
              </Button>
            ) : (
              <span className="shrink-0 text-[10px] font-semibold text-ink3">이미 포함됨</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
