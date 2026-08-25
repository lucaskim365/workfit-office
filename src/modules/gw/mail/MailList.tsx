import type { MailAccount } from '@/domain/mailAccount/schema';
import { MAIL_ERROR_GUIDE, mailRefKey, type MailAccountFailure } from '@/domain/mail/engine';
import type { MailSummary } from '@/domain/mail/schema';
import { formatMailListTime, mailDateGroupLabel } from './mailDate';

interface Props {
  mails: MailSummary[];
  failures: MailAccountFailure[];
  accounts: MailAccount[];
  selectedKey: string | null;
  onSelect: (mail: MailSummary) => void;
  folderLabel: string;
  /** 검색·필터가 걸려 있는지. 빈 목록의 이유를 구분해 안내한다. */
  filtered: boolean;
  /** 일괄 처리용 선택 상태. 넘기지 않으면 체크박스 없이 렌더된다(임시보관 등). */
  checkedKeys?: ReadonlySet<string>;
  onToggleCheck?: (key: string) => void;
  onToggleAll?: () => void;
  /** 별표(중요) 토글. 행을 열지 않고 목록에서 바로 누른다. */
  onToggleFlag?: (mail: MailSummary) => void;
}

/**
 * 통합 받은메일 목록.
 *
 * 실패한 계정은 목록 위에 따로 알린다. 빈 목록으로 만들어 버리면 사용자는 메일이 없는
 * 것인지 못 불러온 것인지 구분할 수 없다. ([[jwheo/feat/mail/DESIGN.md]] §8)
 */
export default function MailList({ mails, failures, accounts, selectedKey, onSelect, folderLabel, filtered, checkedKeys, onToggleCheck, onToggleAll, onToggleFlag }: Props) {
  const nameOf = (accountId: string) =>
    accounts.find((row) => row.id === accountId)?.displayName ?? accountId;
  const selectable = checkedKeys !== undefined && onToggleCheck !== undefined;
  const allChecked = selectable && mails.length > 0
    && mails.every((mail) => checkedKeys.has(mailRefKey(mail.ref)));

  return (
    <div className="flex h-full flex-col">
      {failures.length > 0 && (
        <div className="border-b border-amber/25 bg-amber-soft/25 px-3 py-2.5">
          {failures.map((failure) => (
            <div key={failure.accountId} className="text-[10px] leading-relaxed text-amber">
              <strong className="font-bold">{nameOf(failure.accountId)}</strong> 계정을 불러오지 못했습니다.
              <span className="text-ink3"> {MAIL_ERROR_GUIDE[failure.code]}</span>
            </div>
          ))}
        </div>
      )}

      {mails.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <div>
            <div className="text-2xl">{filtered ? '🔍' : '📭'}</div>
            <div className="mt-2 text-[12px] font-bold text-ink">
              {filtered ? '조건에 맞는 메일이 없습니다.' : `${folderLabel}이(가) 비어 있습니다.`}
            </div>
            <div className="mt-1 text-[10.5px] text-ink3">
              {failures.length > 0
                ? '연결된 계정에서 메일을 불러오지 못했습니다.'
                : filtered
                  ? '검색어를 바꾸거나 조건을 해제해 보세요.'
                  : '새 메일이 오면 여기에 표시됩니다.'}
            </div>
          </div>
        </div>
      ) : (
        <>
          {selectable && onToggleAll && (
            <label className="flex cursor-pointer items-center gap-2 border-b border-border px-3.5 py-2">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={onToggleAll}
                aria-label="전체 선택"
                className="h-3.5 w-3.5 accent-teal"
              />
              <span className="text-[9.5px] font-semibold text-ink3">
                {checkedKeys.size > 0 ? `${checkedKeys.size}건 선택됨` : '전체 선택'}
              </span>
            </label>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto">
          {mails.map((mail, index) => {
            const key = mailRefKey(mail.ref);
            const selected = key === selectedKey;
            // 최신순 목록이라 라벨이 앞 행과 달라지는 지점이 곧 날짜 경계다.
            const groupLabel = mailDateGroupLabel(mail.receivedAt);
            const showGroup = index === 0 || groupLabel !== mailDateGroupLabel(mails[index - 1].receivedAt);
            return (
              <li key={key} className="flex flex-wrap items-stretch border-b border-border">
                {showGroup && (
                  <div className="w-full bg-panel-alt/60 px-3.5 py-1 text-[9px] font-bold text-ink3">
                    {groupLabel}
                  </div>
                )}
                {selectable && (
                  // 체크박스는 열기 버튼과 형제로 둔다. 버튼 안에 넣으면 중첩 인터랙션이라
                  // 체크만 하려던 클릭이 메일을 연다.
                  <label className="flex shrink-0 cursor-pointer items-center pl-3">
                    <input
                      type="checkbox"
                      checked={checkedKeys.has(key)}
                      onChange={() => onToggleCheck(key)}
                      aria-label="메일 선택"
                      className="h-3.5 w-3.5 accent-teal"
                    />
                  </label>
                )}
                {onToggleFlag && (
                  <button
                    type="button"
                    onClick={() => onToggleFlag(mail)}
                    title={mail.flagged ? '중요 표시 해제' : '중요 표시'}
                    aria-label={mail.flagged ? '중요 표시 해제' : '중요 표시'}
                    className={`flex shrink-0 items-center px-1.5 text-[13px] transition-colors ${mail.flagged ? 'text-amber' : 'text-ink3/40 hover:text-amber'}`}
                  >
                    {mail.flagged ? '★' : '☆'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(mail)}
                  className={`min-w-0 flex-1 px-3.5 py-3 text-left transition-colors ${selected ? 'bg-teal-soft/35' : 'hover:bg-ink3/5'}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[11.5px] ${mail.seen ? 'text-ink2' : 'font-bold text-ink'}`}>
                      {/*
                        보낸메일함은 이 칸이 받는사람이다(서버가 바꿔 보낸다). 보낸 사람은
                        늘 나라서 상대를 보여야 목록이 쓸모 있다. 누가 보냈는지는 상세에서
                        본다 — 목록에 방향 표시나 발신자 배지를 겹쳐 놓으니 이름이 둘로
                        보여 더 헷갈렸다.
                      */}
                      {mail.from.name || mail.from.email}
                    </span>
                    <span className="shrink-0 text-[9.5px] text-ink3">{formatMailListTime(mail.receivedAt)}</span>
                  </div>
                  <div className={`mt-0.5 flex items-center gap-1.5 ${mail.seen ? '' : 'font-bold'}`}>
                    {!mail.seen && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />}
                    {mail.answered && <span className="shrink-0 text-[9.5px] text-teal">↩</span>}
                    {mail.hasAttachment && <span className="shrink-0 text-[9.5px] text-ink3">📎</span>}
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{mail.subject || '(제목 없음)'}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="shrink-0 rounded bg-ink3/10 px-1.5 py-px text-[8.5px] font-semibold text-ink2">
                      {nameOf(mail.ref.accountId)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-ink3">{mail.preview}</span>
                  </div>
                </button>
              </li>
            );
          })}
          </ul>
        </>
      )}
    </div>
  );
}
