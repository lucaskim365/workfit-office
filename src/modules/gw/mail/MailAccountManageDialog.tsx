import { useState } from 'react';
import type { User } from '@/domain/user/schema';
import {
  MAIL_ACCOUNT_STATUS_LABELS,
  MAIL_PROVIDER_LABELS,
  type MailAccount,
} from '@/domain/mailAccount/schema';
import { mailErrorText } from '@/domain/mail/engine';
import { useDeleteMailAccount } from '@/features/mail/useMailAccounts';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

interface Props {
  actor: User;
  accounts: MailAccount[];
  /** 새 계정 등록 모달 열기. */
  onAdd: () => void;
  /** 기존 계정 수정 모달 열기. */
  onEdit: (account: MailAccount) => void;
  onClose: () => void;
  onDone: (message: string) => void;
}

/**
 * 메일 계정 관리.
 *
 * 등록·수정 모달과 분리한다. 계정이 여러 개일 때 "어느 계정이 살아 있고 어느 계정이 인증에
 * 실패했는지"를 한눈에 봐야 하는데, 등록 폼 안에서는 그 자리를 만들 수 없다.
 *
 * 연결 해제는 두 번 눌러야 실행된다. 계정을 지우면 서버에 저장된 앱 비밀번호도 함께 사라져
 * 되돌리려면 다시 발급받아야 한다.
 */
export default function MailAccountManageDialog({ actor, accounts, onAdd, onEdit, onClose, onDone }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const remove = useDeleteMailAccount();

  const drop = async (id: string) => {
    setError('');
    try {
      await remove.mutateAsync({ actor, id });
      setConfirmId(null);
      onDone('계정 연결을 해제했습니다.');
    } catch (caught) {
      setError(mailErrorText(caught));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="메일 계정 관리"
      width={560}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="primary" onClick={onAdd}>+ 계정 추가</Button>
          <Button onClick={onClose}>닫기</Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[11px] font-semibold text-red-500">
            {error}
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-border px-3 py-6 text-center text-[11.5px] text-ink3">
            연결된 계정이 없습니다. 아래 <b className="text-ink2">계정 추가</b>로 시작하세요.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {accounts.map((account) => (
              <li key={account.id} className="rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-bold text-ink">
                        {account.displayName || account.email}
                      </span>
                      <span className="shrink-0 rounded-full bg-ink3/10 px-1.5 py-0.5 text-[9px] font-bold text-ink3">
                        {MAIL_PROVIDER_LABELS[account.provider]}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          account.status === 'active'
                            ? 'bg-teal-soft/40 text-teal'
                            : 'bg-amber-soft/40 text-amber'
                        }`}
                      >
                        {MAIL_ACCOUNT_STATUS_LABELS[account.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[10.5px] text-ink3">{account.email}</div>
                    {/* 언제 인증이 확인됐는지 보여야 "예전엔 됐는데 지금 안 되는" 상황을 구분한다. */}
                    <div className="mt-0.5 text-[9.5px] text-ink3">
                      {account.verifiedAt
                        ? `마지막 연결 확인 ${account.verifiedAt.slice(0, 16).replace('T', ' ')}`
                        : '연결 확인 기록 없음'}
                      {account.lastErrorCode && ` · 최근 오류 ${account.lastErrorCode}`}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {confirmId === account.id ? (
                      <>
                        <Button variant="dangerSolid" disabled={remove.isPending} onClick={() => drop(account.id)}>
                          해제 확인
                        </Button>
                        <Button onClick={() => setConfirmId(null)}>취소</Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => onEdit(account)}>수정</Button>
                        <Button variant="danger" onClick={() => { setError(''); setConfirmId(account.id); }}>
                          연결 해제
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[9.5px] leading-relaxed text-ink3">
          앱 비밀번호는 서버에서 암호화해 보관하며 화면으로 다시 내려오지 않습니다. 비밀번호를 바꾸려면
          해당 계정을 <b className="text-ink2">수정</b>해 새 앱 비밀번호를 입력하세요.
        </p>
      </div>
    </Modal>
  );
}
