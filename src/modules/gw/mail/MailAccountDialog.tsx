import { useState } from 'react';
import type { User } from '@/domain/user/schema';
import {
  MAIL_PROVIDER_PRESETS,
  mailProviderPreset,
  type MailAccount,
  type MailProvider,
} from '@/domain/mailAccount/schema';
import { mailErrorText } from '@/domain/mail/engine';
import {
  MOCK_CREDENTIAL,
  useCreateMailAccount,
  useDeleteMailAccount,
  useTestMailConnection,
  useUpdateMailAccount,
} from '@/features/mail/useMailAccounts';
import { isConnectionOk } from '@/data/mail/mail.gateway';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

interface Props {
  actor: User;
  /** 수정 대상. 없으면 새 계정 등록. */
  account: MailAccount | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

const message = (error: unknown) => mailErrorText(error);

/**
 * 계정 연결 모달.
 *
 * 앱 비밀번호 입력란을 두지 않는다. 자격 증명은 서버에서만 다루기로 했고, 여기에 입력란을
 * 만들면 비밀번호가 브라우저 상태로 들어온다. 실제 연결은 서버가 대신 검증한다.
 * ([[jwheo/feat/mail/DESIGN.md]] §4-3 · §4-6)
 */
export default function MailAccountDialog({ actor, account, onClose, onDone }: Props) {
  const editing = account !== null;
  const [provider, setProvider] = useState<MailProvider>(account?.provider ?? 'naver');
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [signature, setSignature] = useState(account?.signature ?? '');
  const [error, setError] = useState('');
  const [tested, setTested] = useState<'none' | 'ok' | 'fail'>('none');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const test = useTestMailConnection();
  const create = useCreateMailAccount();
  const update = useUpdateMailAccount();
  const remove = useDeleteMailAccount();
  const busy = test.isPending || create.isPending || update.isPending || remove.isPending;

  const preset = mailProviderPreset(provider);
  const draft = { displayName, email, provider, signature };

  const runTest = async () => {
    setError('');
    setTested('none');
    try {
      const result = await test.mutateAsync({ actor, draft });
      setTested(isConnectionOk(result) ? 'ok' : 'fail');
    } catch (caught) {
      setTested('fail');
      setError(message(caught));
    }
  };

  const save = async () => {
    setError('');
    try {
      if (editing) {
        await update.mutateAsync({ actor, id: account.id, draft, credential: MOCK_CREDENTIAL });
        onDone('계정을 수정했습니다.');
      } else {
        await create.mutateAsync({ actor, draft });
        onDone('계정을 연결했습니다.');
      }
    } catch (caught) {
      setError(message(caught));
    }
  };

  const drop = async () => {
    setError('');
    try {
      await remove.mutateAsync({ actor, id: account?.id ?? '' });
      onDone('계정 연결을 해제했습니다.');
    } catch (caught) {
      setError(message(caught));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? '계정 수정' : '메일 계정 연결'}
      width={520}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {editing ? (
            confirmRemove ? (
              <span className="flex items-center gap-1">
                <Button variant="dangerSolid" disabled={busy} onClick={drop}>해제 확인</Button>
                <Button onClick={() => setConfirmRemove(false)}>취소</Button>
              </span>
            ) : (
              <Button variant="danger" onClick={() => setConfirmRemove(true)}>연결 해제</Button>
            )
          ) : <span />}

          <div className="flex items-center gap-1.5">
            <Button onClick={onClose}>취소</Button>
            <Button variant="primary" disabled={busy || !preset.available} onClick={save}>
              {editing ? '저장' : '연결'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[11px] font-semibold text-red-500">{error}</div>}

          <div>
            <span className="mb-1.5 block text-[10px] font-bold text-ink3">공급자</span>
            <div className="grid grid-cols-2 gap-1.5">
              {MAIL_PROVIDER_PRESETS.map((row) => (
                <button
                  key={row.provider}
                  type="button"
                  disabled={!row.available}
                  onClick={() => { setProvider(row.provider); setTested('none'); }}
                  title={row.available ? row.label : row.unavailableReason ?? ''}
                  className={`rounded-lg border px-3 py-2 text-left text-[11px] font-bold transition-colors ${provider === row.provider
                    ? 'border-teal bg-teal-soft/40 text-teal'
                    : row.available
                      ? 'border-border text-ink2 hover:bg-ink3/8'
                      : 'cursor-not-allowed border-border text-ink3 opacity-50'
                    }`}
                >
                  {row.label}
                  {!row.available && <span className="mt-0.5 block text-[8.5px] font-semibold">준비 중</span>}
                </button>
              ))}
            </div>
            {!preset.available && preset.unavailableReason && (
              <div className="mt-1.5 rounded-lg border border-amber/20 bg-amber-soft/25 px-3 py-2 text-[10px] text-amber">
                {preset.unavailableReason}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-teal/20 bg-teal-soft/20 px-3 py-2.5 text-[10px] leading-relaxed text-ink2">
            {preset.guide}
            {preset.helpUrl && (
              <>
                {' '}
                <a href={preset.helpUrl} target="_blank" rel="noreferrer" className="font-bold text-teal underline">공식 안내</a>
              </>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold text-ink3">표시 이름</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="업무용 네이버" className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none" />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold text-ink3">메일 주소</span>
            <input value={email} onChange={(event) => { setEmail(event.target.value); setTested('none'); }} placeholder="you@naver.com" className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none" />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold text-ink3">서명 (선택)</span>
            <textarea value={signature} onChange={(event) => setSignature(event.target.value)} rows={3} placeholder="이름 | 부서 직급&#10;회사명" className="w-full resize-y rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none" />
            <span className="mt-1 block text-[9.5px] text-ink3">새 메일을 쓸 때 본문 아래에 자동으로 붙습니다.</span>
          </label>

          <div className="flex items-center gap-2">
            <Button disabled={busy || !preset.available} onClick={runTest}>
              {test.isPending ? '확인 중…' : '연결 테스트'}
            </Button>
          {tested === 'ok' && <span className="text-[10.5px] font-bold text-teal">SMTP·IMAP 연결을 확인했습니다.</span>}
          {tested === 'fail' && <span className="text-[10.5px] font-bold text-amber">연결하지 못했습니다.</span>}
        </div>
      </div>
    </Modal>
  );
}
