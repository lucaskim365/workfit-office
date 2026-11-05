import { Modal } from '@/shared/ui/Modal';
import type { ApprovalForm } from '@/domain/approvalForm/schema';
import { linkTypeDef } from '@/domain/approvalForm/sheet/approvalSheet';
import { STARTER_FORMS } from './starterForms';

/**
 * 새 시트 서식 — 빈 시트로 시작할지, 기본 서식 묶음(휴가원·지출결의서 등)에서 시작할지 고른다.
 * 고르면 편집기가 그 모양으로 열릴 뿐 저장은 관리자가 [저장]을 눌러야 된다.
 */
export function StarterPicker({ open, onClose, onBlank, onStarter }: { open: boolean; onClose: () => void; onBlank: () => void; onStarter: (seed: ApprovalForm) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="새 시트 서식" width={640}>
      <div className="space-y-3 text-[12px]">
        <button
          type="button"
          onClick={onBlank}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-panel px-3 py-2.5 text-left hover:border-teal"
        >
          <span className="text-[20px]">📄</span>
          <span>
            <span className="block font-bold text-ink">빈 서식</span>
            <span className="block text-[11px] text-ink3">문서 머리만 든 빈 시트 — 엑셀 양식을 불러오거나 직접 그립니다.</span>
          </span>
        </button>
        <div>
          <div className="mb-1.5 font-bold text-ink2">기본 서식에서 시작</div>
          <div className="mb-2 text-[11px] text-ink3">
            흔히 쓰는 서식을 시트로 만들어 엽니다. 회사에 맞게 다듬고 저장하세요 — 저장 전엔 아무것도 생기지 않고, 저장해도 '사용 안 함'으로 시작합니다.
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {STARTER_FORMS.map((f) => {
              const link = linkTypeDef(f.code);
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => onStarter(f)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-2 text-left hover:border-teal"
                  title={link ? `연동 기능: ${link.feature}` : undefined}
                >
                  <span className="w-5 shrink-0 text-center text-[15px]">{f.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{f.name}</span>
                    {link && <span className="block truncate text-[10px] text-teal">연동 · {link.code}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
