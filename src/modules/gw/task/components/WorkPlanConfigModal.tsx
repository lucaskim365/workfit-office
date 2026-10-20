import { Modal } from '@/shared/ui/Modal';
import { WorkPlanTagManager } from '../event/WorkPlanTagManager';

interface WorkPlanConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  canEdit: boolean;
}

/** 업무계획 태그 관리 창 — 본문은 WorkPlanTagManager. */
export function WorkPlanConfigModal({ isOpen, onClose, canEdit }: WorkPlanConfigModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="업무계획 태그" width={560}>
      <div className="overflow-y-auto px-5 py-4">
        <WorkPlanTagManager canEdit={canEdit} />
      </div>
    </Modal>
  );
}
