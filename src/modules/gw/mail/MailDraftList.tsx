import { useState } from 'react';
import { formatAddressList, mailRefKey } from '@/domain/mail/engine';
import type { MailDraft, MailSummary } from '@/domain/mail/schema';
import type { MailAccount } from '@/domain/mailAccount/schema';
import { formatMailListTime } from './mailDate';

interface Props {
  drafts: MailDraft[];
  accounts: MailAccount[];
  onOpen: (id: string) => void;
  onDiscard: (id: string) => void;
  /** 메일 서버(IMAP `DRAFTS`)에 있는 임시보관. 열어볼 수는 있고 편집은 못 한다. */
  serverDrafts: MailSummary[];
  /** 지금 열어 둔 서버 임시보관의 키. 목록에서 강조하는 데 쓴다. */
  selectedKey: string | null;
  onSelectServer: (mail: MailSummary) => void;
}

/** 구역 제목. 임시보관이 두 곳에 나뉜 이유를 여기서 설명한다. */
function SectionHead({ label, count, hint }: { label: string; count: number; hint: string }) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-panel/95 px-3.5 py-2 backdrop-blur">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-bold text-ink2">{label}</span>
        <span className="text-[10px] font-bold text-teal">{count}</span>
      </div>
      <div className="mt-0.5 text-[9.5px] leading-snug text-ink3">{hint}</div>
    </div>
  );
}

/**
 * 임시보관 목록.
 *
 * 임시보관은 두 곳에 나뉘어 있다. 이 화면에서 저장한 것은 **브라우저에** 남고(그래서 다른
 * 기기에서는 안 보인다), 메일 서비스에서 저장한 것은 **메일 서버**에 있다. 둘을 한 목록에
 * 섞으면 왜 어떤 건 고쳐지고 어떤 건 안 고쳐지는지 알 수 없어 구역을 나눠 보여준다.
 * ([[jwheo/feat/mail/DESIGN.md]] §3.1)
 */
export default function MailDraftList({
  drafts, accounts, onOpen, onDiscard, serverDrafts, selectedKey, onSelectServer,
}: Props) {
  const [pendingDiscard, setPendingDiscard] = useState<string | null>(null);
  const nameOf = (accountId: string) =>
    accounts.find((row) => row.id === accountId)?.displayName ?? accountId;

  if (drafts.length === 0 && serverDrafts.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 py-12 text-center">
        <div>
          <div className="text-2xl">📝</div>
          <div className="mt-2 text-[12px] font-bold text-ink">임시보관이 비어 있습니다.</div>
          <div className="mt-1 text-[10.5px] text-ink3">메일을 쓰다가 임시보관을 누르면 여기 남습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {drafts.length > 0 && (
        <>
          <SectionHead
            label="이 기기에 저장됨"
            count={drafts.length}
            hint="이어서 쓸 수 있습니다. 브라우저에 남아 다른 기기에서는 보이지 않습니다."
          />
          <ul>
            {drafts.map((draft) => (
              <li key={draft.id} className="border-b border-border">
                <div className="px-3.5 py-3">
                  <button type="button" onClick={() => onOpen(draft.id)} className="w-full text-left">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink2">
                        {draft.to.length > 0 ? formatAddressList(draft.to) : '받는 사람 없음'}
                      </span>
                      <span className="shrink-0 text-[9.5px] text-ink3">{formatMailListTime(draft.updatedAt)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] font-bold text-ink">
                      {draft.subject || '(제목 없음)'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="shrink-0 rounded bg-ink3/10 px-1.5 py-px text-[8.5px] font-semibold text-ink2">
                        {nameOf(draft.accountId)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-ink3">
                        {draft.textBody.split('\n').find((line) => line.trim() !== '')?.slice(0, 80) ?? ''}
                      </span>
                    </div>
                  </button>

                  <div className="mt-1.5 flex justify-end">
                    {pendingDiscard === draft.id ? (
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => { setPendingDiscard(null); onDiscard(draft.id); }} className="rounded-md bg-red-500 px-2.5 py-1 text-[9.5px] font-bold text-white hover:opacity-90">삭제 확인</button>
                        <button type="button" onClick={() => setPendingDiscard(null)} className="rounded-md border border-border px-2 py-1 text-[9.5px] font-bold text-ink3 hover:bg-ink3/8">취소</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setPendingDiscard(draft.id)} className="text-[9.5px] font-bold text-ink3 hover:text-red-500 hover:underline">삭제</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {serverDrafts.length > 0 && (
        <>
          <SectionHead
            label="메일 서버"
            count={serverDrafts.length}
            hint="열어서 내용을 볼 수 있습니다. 고치려면 전달로 이어 쓰거나 해당 메일 서비스에서 여세요."
          />
          <ul>
            {serverDrafts.map((mail) => {
              const key = mailRefKey(mail.ref);
              /* 임시보관은 보낸 사람이 늘 나라서, 목록에는 받는 사람을 보여야 쓸모 있다. */
              const who = mail.to.length > 0 ? formatAddressList(mail.to) : '받는 사람 없음';
              return (
                <li key={key} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => onSelectServer(mail)}
                    className={`w-full px-3.5 py-3 text-left transition-colors ${selectedKey === key ? 'bg-teal-soft/30' : 'hover:bg-ink3/6'}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink2">{who}</span>
                      <span className="shrink-0 text-[9.5px] text-ink3">{formatMailListTime(mail.receivedAt)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] font-bold text-ink">
                      {mail.subject || '(제목 없음)'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="shrink-0 rounded bg-ink3/10 px-1.5 py-px text-[8.5px] font-semibold text-ink2">
                        {nameOf(mail.ref.accountId)}
                      </span>
                      {mail.hasAttachment && <span className="shrink-0 text-[10px]">📎</span>}
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
