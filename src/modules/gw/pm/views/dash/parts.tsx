import { useState, type ReactNode } from 'react';
import { diffDays, leftText, monthDay, type PmSiteStatus } from '@/domain/pm/rules';
import { GOV_BAD, SIDE_TEXT, SITE_STAGES, type Deadline, type SiteStage } from '@/domain/pm/site';
import { ProjectTag, Tag } from '../wbs/parts';
import { FavStar } from '../../ui/PmShell';

/**
 * 대시보드 작은 부품 — 데모 stBadge · stageBadge · dlRow 를 그룹웨어 토큰으로 (PM 전용, §3.2.2).
 */

const ST_TONE: Record<PmSiteStatus, 'ok' | 'run' | 'warn' | 'bad' | 'plain'> = {
  정상: 'ok', 선행: 'run', 소폭지연: 'warn', 지연: 'bad', 완료: 'ok', '착수 전': 'plain', 준비: 'plain', 종료: 'ok',
};
/** 사업 상태 꼬리표 (stBadge) */
export function SiteStatusTag({ st }: { st: PmSiteStatus }) {
  return <Tag tone={ST_TONE[st]}>● {st}</Tag>;
}
/** 상태 신호 (관제 보드 왼쪽 점): 소폭지연 = 주의, 지연 = 위험, 그 외 정상 */
export const signalOf = (st: PmSiteStatus): 'ok' | 'warn' | 'bad' => (st === '소폭지연' ? 'warn' : st === '지연' ? 'bad' : 'ok');
export const SIGNAL_BG = { ok: 'bg-ok', warn: 'bg-amber', bad: 'bg-danger' } as const;

/** 사업 단계 꼬리표 "구축 · 착수계 완료 체크 안 됨" (stageBadge) */
export function StagePill({ s }: { s: SiteStage }) {
  return (
    <span
      title={SITE_STAGES[s.i].hint}
      className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-px text-[10.5px] font-bold ${s.bad ? 'bg-danger/10 text-danger' : 'bg-blue-soft text-blue'}`}
    >
      {s.n}{s.sub ? ` · ${s.sub}` : ''}
    </span>
  );
}

/** 숫자 칩 — 누르면 그 목록 (latechip) */
export function CountChip({ n, onClick, title, bad }: { n: number; onClick: () => void; title?: string; bad?: boolean }) {
  if (!n) return <span className="text-ink3">-</span>;
  return (
    <button type="button" onClick={onClick} title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${bad ? 'border-danger/30 bg-danger/10 text-danger' : 'border-border-hi bg-panel text-ink2 hover:border-teal'}`}>
      {n}건 <span aria-hidden>›</span>
    </button>
  );
}

/** 기한 1줄의 신호: 나쁜 판정 · 완료 · 지남 · 2주 안 · 그 외 (dlRow lv) */
export function deadlineLevel(x: Deadline, today: string): 'bad' | 'ok' | 'warn' | 'info' {
  const rec = x.gov && 'rec' in x.gov ? x.gov.rec : null;
  if (rec && GOV_BAD.includes(rec.v)) return 'bad';
  if (x.done) return 'ok';
  if (!x.due) return 'info';
  const n = diffDays(today, x.due);
  const ni = x.inner ? diffDays(today, x.inner) : n;
  return n < 0 ? 'bad' : ni <= 14 ? 'warn' : 'info';
}
const DOT = { bad: 'bg-danger', ok: 'bg-ok', warn: 'bg-amber', info: 'bg-blue' } as const;

/** 남은 날 글자 — 내부 마감이 있으면 '내부 11/7 · 7일 남음' / 내부 마감이 지났으면 '내부 마감 지남 · 기한 3일 남음' */
export function deadlineLeft(x: Deadline, today: string): ReactNode {
  if (x.done) return '';
  if (!x.due) return '날짜 미정';
  if (x.inner) {
    const n = diffDays(today, x.due);
    const ni = diffDays(today, x.inner);
    return ni < 0 && n >= 0 ? <><span className="text-danger">내부 마감 지남</span> · 기한 {leftText(x.due, today)}</> : `내부 ${monthDay(x.inner)} · ${leftText(x.inner, today)}`;
  }
  return leftText(x.due, today);
}

/** 기한 1줄 (dlRow 의 읽기 부분) — 오른쪽 버튼은 부르는 쪽이 */
export function DeadlineRow({ x, today, project, right }: { x: Deadline; today: string; project?: string; right?: ReactNode }) {
  const lv = deadlineLevel(x, today);
  return (
    <div className={`flex items-center gap-2 border-b border-border py-1.5 text-[12px] last:border-b-0 ${x.done ? 'opacity-55' : ''}`}>
      <span className={`h-2 w-2 flex-none rounded-full ${DOT[lv]}`} />
      {project && <ProjectTag>{project}</ProjectTag>}
      <Tag>{x.src}</Tag>
      <b className="w-[38px] flex-none text-ink" title={x.inner ? `실제 기한 ${x.due} · 내부 마감 ${x.inner}` : ''}>{x.due ? monthDay(x.due) : '미정'}</b>
      {SIDE_TEXT[x.side] && <Tag tone={x.side === 'buyer' ? 'warn' : 'plain'} title={x.side === 'buyer' ? '도입기업이 해야 하는 일 — PM이 챙김' : '도입기업과 함께 하는 일'}>{SIDE_TEXT[x.side]}</Tag>}
      <span className="min-w-0 flex-1 truncate text-ink" title={`${x.t} — ${x.sub}`}>{x.t}</span>
      <span className={`whitespace-nowrap text-[11px] ${lv === 'bad' ? 'text-danger' : 'text-ink3'}`}>
        {deadlineLeft(x, today)}
        {x.shift ? <> · <span className={x.shift > 0 ? 'text-danger' : ''} title="기준선(최초 계획) 대비">최초 대비 {x.shift > 0 ? '+' : ''}{x.shift}일</span></> : null}
      </span>
      {right}
    </div>
  );
}

/** 카드 머리 */
export function CardHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      <h3 className="text-[13px] font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}

/**
 * 화면 머리 (head 2712): 제목 + [?] 설명 펼치기 + 오른쪽 버튼. 설명은 [?]를 눌러야 보임 (데모 그대로).
 * 데모는 펼친 상태를 사람 · 화면마다 저장(S.descOn)했지만 여기선 화면을 떠나면 닫힘 — 업무 목록 · 티켓 목록과 같음.
 */
export function ScreenHead({ title, desc, children }: { title: ReactNode; desc: ReactNode; children?: ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        <FavStar />
        <button type="button" onClick={() => setOn((o) => !o)} title={on ? '설명 닫기' : '이 화면 설명 보기'}
          className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] font-bold ${on ? 'border-teal bg-teal text-white' : 'border-border-hi text-ink3'}`}>?</button>
        <span className="flex-1" />
        {children}
      </div>
      {on && <p className="mt-2 rounded-lg bg-panel-alt px-3 py-2 text-[11.5px] leading-relaxed text-ink2">{desc}</p>}
    </div>
  );
}
