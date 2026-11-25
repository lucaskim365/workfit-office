import { leftText } from '@/domain/pm/rules';
import { tkLate, type PmTicket, type PmTicketPrio, type PmTicketStatus, type PmTicketType } from '@/domain/pm/ticket';
import { ProjectTag, Tag } from '../wbs/parts';

/**
 * 티켓 작은 부품 — 데모 TK_ST_CLS · TK_TYPE_CLS · prioBadge · tkCard 를 그룹웨어 토큰으로 (§3.2.2).
 */
type Tone = 'plain' | 'bad' | 'run' | 'ok' | 'warn' | 'navy';
const ST_TONE: Record<PmTicketStatus, Tone> = { 발행: 'warn', 접수: 'run', 진행중: 'run', 검토요청: 'navy', 완료: 'ok', 보류: 'plain', 취소: 'plain' };
const TYPE_TONE: Record<PmTicketType, Tone> = { 개발: 'run', 인프라: 'navy', '시험·검증': 'warn', 설계: 'plain', 분석: 'plain', PM: 'plain', '영업·기획': 'plain', '운영·이관': 'ok' };

export const StatusTag = ({ s }: { s: PmTicketStatus }) => <Tag tone={ST_TONE[s]}>{s}</Tag>;
export const TypeTag = ({ t }: { t: PmTicketType }) => <Tag tone={TYPE_TONE[t]}>{t}</Tag>;
export const PrioTag = ({ p }: { p: PmTicketPrio }) => <Tag tone={p === '긴급' ? 'bad' : p === '높음' ? 'warn' : 'plain'}>{p}</Tag>;
/** 옛 업무(예전 WBS 번호) — 지금 업무 목록과 연결 없음 (11/24 사용자) */
export const LegacyTag = ({ k }: { k: string }) => <Tag tone="plain" title="예전 WBS 번호에 묶여 있던 기록입니다. 지금 업무 목록과 연결되지 않습니다">옛 업무 {k.split('|')[1] ?? k}</Tag>;

/** 업무 번호 자리: 옛 티켓은 '옛 업무 5.24', 아니면 '01-01' */
export const workLabel = (x: PmTicket) => (x.legacyKey ? `옛 업무 ${x.legacyKey.split('|')[1] ?? x.legacyKey}` : x.code);

/** 보드 카드 (tkCard 1865): 사업 꼬리표 · 종류 · 우선순위 · 번호 / 제목 / 업무 한 줄 / 진행 막대 / 담당 · 첨부 · 마감 */
export function TicketCard({ x, short, who, today, onOpen, onDragStart }: {
  x: PmTicket; short: string; who: string; today: string; onOpen: () => void; onDragStart: () => void;
}) {
  const late = tkLate(x, today);
  const done = x.status === '완료';
  const due = done ? '완료' : x.due ? leftText(x.due, today) : '마감 없음';
  const work = x.subtaskId && x.parent ? x.parent : '';
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className={`cursor-pointer rounded-lg border border-border bg-panel px-2.5 py-2 shadow-sm hover:border-teal ${late ? 'border-l-4 border-l-danger' : ''} ${done ? 'opacity-70' : ''}`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <ProjectTag>{short}</ProjectTag>
        <TypeTag t={x.type} />
        {(x.prio === '긴급' || x.prio === '높음') && <PrioTag p={x.prio} />}
        {x.taskChange && <Tag tone="bad" title="업무 원본이 바뀜">업무 {x.taskChange}</Tag>}
        {x.legacyKey && <LegacyTag k={x.legacyKey} />}
        <span className="flex-1" />
        <span className="text-[10px] text-ink3">{x.no}</span>
      </div>
      <div className="line-clamp-2 text-[12px] font-bold text-ink">{x.title}</div>
      <div className="mt-0.5 truncate text-[10.5px] text-ink3" title={`${x.subtaskId ? '세부 작업 · ' : ''}업무 ${workLabel(x)}${work ? ` ${work}` : ''}`}>
        {x.subtaskId && <b>세부 · </b>}{workLabel(x)}{work ? ` ${work}` : ''}
      </div>
      {!done && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border"><i className="block h-full bg-teal" style={{ width: `${x.prog}%` }} /></div>
      )}
      <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px]">
        <b className="text-ink">{who || '담당 없음'}</b>
        <span className="flex-1" />
        {x.files.length > 0 && <span className="text-ink3">📎{x.files.length}</span>}
        <span className={late ? 'font-bold text-danger' : 'text-ink3'}>{due}</span>
      </div>
    </div>
  );
}
