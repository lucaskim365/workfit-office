import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

interface ReservationReasonDialogProps {
  title: string;
  /** 어떤 예약을 처리하는지 확인용 요약 한 줄. */
  description: string;
  label: string;
  confirmLabel: string;
  onClose: () => void;
  /** 실패하면 던진다 — 모달이 오류를 보여주고 열려 있는다. 닫기는 성공한 쪽(부모)이 한다. */
  onSubmit: (reason: string) => Promise<void>;
}

/**
 * 취소·반려 사유 입력 모달.
 *
 * 저장 계층이 빈 사유를 거부하므로(도메인 규칙) 입력이 비면 확정 버튼을 잠근다.
 * `window.prompt`를 대체한다 — prompt는 대상 예약이 안 보이고 취소 마감 같은
 * 실패 사유를 보여줄 자리도 없다.
 */
export default function ReservationReasonDialog({ title, description, label, confirmLabel, onClose, onSubmit }: ReservationReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await onSubmit(reason.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '처리에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={420}
      footer={
        <div className="flex w-full items-center justify-end gap-1.5">
          <Button onClick={onClose}>닫기</Button>
          <Button variant="dangerSolid" disabled={busy || reason.trim() === ''} onClick={() => void submit()}>
            {busy ? '처리 중…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-[11px] font-semibold text-red-500">{error}</div>}

        <div className="rounded-lg border border-border bg-panel-alt/30 px-3 py-2.5 text-[10.5px] font-semibold text-ink2">{description}</div>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold text-ink3">{label}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            autoFocus
            placeholder="상대방에게 전달됩니다."
            className="w-full resize-y rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}
