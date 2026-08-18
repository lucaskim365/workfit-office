import { useState } from 'react';
import { formatAddressList } from '@/domain/mail/engine';
import type { MailDraft } from '@/domain/mail/schema';
import type { MailAccount } from '@/domain/mailAccount/schema';
import { formatMailListTime } from './mailDate';

interface Props {
  drafts: MailDraft[];
  accounts: MailAccount[];
  onOpen: (id: string) => void;
  onDiscard: (id: string) => void;
  /** 메일 서버에 있는 임시보관 건수. 여기서는 편집할 수 없어 존재만 알린다. */
  serverDraftCount: number;
}

/**
 * 임시보관 목록.
 *
 * 서버 메일이 아니라 로컬에 둔 작성 중 메일이라 `MailList`와 다루는 값이 다르다.
 * 받는 사람이 비어 있을 수 있고 읽음·첨부 개념도 없다. ([[jwheo/feat/mail/DESIGN.md]] §3.1)
 */
export default function MailDraftList({ drafts, accounts, onOpen, onDiscard, serverDraftCount }: Props) {
  const [pendingDiscard, setPendingDiscard] = useState<string | null>(null);
  const nameOf = (accountId: string) =>
    accounts.find((row) => row.id === accountId)?.displayName ?? accountId;

  // 서버에도 임시보관이 있는데 안 보이면 사라진 것으로 오해한다. 편집은 못 해도 존재는 알린다.
  const serverNotice = serverDraftCount > 0 ? (
    <div className="border-b border-amber/25 bg-amber-soft/25 px-3 py-2.5 text-[10px] leading-relaxed text-amber">
      메일 서버에 임시보관 <strong className="font-bold">{serverDraftCount}건</strong>이 더 있습니다.
      <span className="text-ink3"> 이 화면에서 저장한 것만 이어서 쓸 수 있고, 서버에 있는 것은 각 메일 서비스에서 열어야 합니다.</span>
    </div>
  ) : null;

  if (drafts.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {serverNotice}
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <div>
            <div className="text-2xl">📝</div>
            <div className="mt-2 text-[12px] font-bold text-ink">임시보관이 비어 있습니다.</div>
            <div className="mt-1 text-[10.5px] text-ink3">메일을 쓰다가 임시보관을 누르면 여기 남습니다.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {serverNotice}
      <ul className="min-h-0 flex-1 overflow-y-auto">
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
    </div>
  );
}
