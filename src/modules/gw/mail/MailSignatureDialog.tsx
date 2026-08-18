import { useState } from 'react';
import type { User } from '@/domain/user/schema';
import type { MailAccount } from '@/domain/mailAccount/schema';
import { mailErrorText } from '@/domain/mail/engine';
import { useUpdateMailAccount } from '@/features/mail/useMailAccounts';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

interface Props {
  actor: User;
  account: MailAccount;
  onClose: () => void;
  onDone: (message: string) => void;
}

/**
 * 서명 편집 모달 — 브리지(실계정) 모드 전용.
 *
 * 브리지는 계정 등록·수정을 막아 두었지만 서명은 보내는 메일의 일부라 화면에서
 * 다뤄야 한다. 계정 정보는 보여 주기만 하고 서명만 받아 updateAccount로 넘긴다.
 * 브리지 gateway는 이걸 이 브라우저(localStorage)에 저장한다.
 */
export default function MailSignatureDialog({ actor, account, onClose, onDone }: Props) {
  const [signature, setSignature] = useState(account.signature);
  const [error, setError] = useState('');
  const update = useUpdateMailAccount();

  const save = async () => {
    setError('');
    try {
      await update.mutateAsync({
        actor,
        id: account.id,
        draft: {
          displayName: account.displayName,
          email: account.email,
          provider: account.provider,
          signature,
        },
        credential: null,
      });
      onDone('서명을 저장했습니다.');
    } catch (caught) {
      setError(mailErrorText(caught));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="서명 편집"
      width={460}
      footer={
        <div className="flex w-full items-center justify-end gap-1.5">
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={update.isPending} onClick={save}>저장</Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[11px] font-semibold text-red-500">{error}</div>}

        <div className="text-[11px] font-bold text-ink">
          {account.displayName}
          <span className="ml-1.5 font-semibold text-ink3">{account.email}</span>
        </div>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold text-ink3">서명</span>
          <textarea
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
            rows={5}
            maxLength={1000}
            placeholder="이름 | 부서 직급&#10;회사명"
            className="w-full resize-y rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none"
          />
          <span className="mt-1 block text-[9.5px] text-ink3">
            새 메일을 쓸 때 본문 아래에 자동으로 붙습니다. 이 브라우저에만 저장됩니다.
          </span>
        </label>
      </div>
    </Modal>
  );
}
