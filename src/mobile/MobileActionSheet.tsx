import { createPortal } from 'react-dom';

/** 하단 액션 시트 항목. */
export interface SheetAction {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

/**
 * 모바일 하단 액션 시트 — 우클릭 컨텍스트 메뉴의 터치 대체.
 * 배경 탭 또는 취소로 닫힘. body 로 portal 하여 화면 전체를 덮는다.
 */
export function MobileActionSheet({ title, actions, onClose }: { title?: string; actions: SheetAction[]; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="mx-2 mb-2 overflow-hidden rounded-2xl bg-panel shadow-xl"
        style={{ marginBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="border-b border-border px-4 py-2.5 text-center text-[11.5px] text-ink3">{title}</div>}
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => { a.onClick(); onClose(); }}
            className={`block w-full border-b border-border px-4 py-3.5 text-center text-[14px] font-semibold active:bg-panel-alt ${a.danger ? 'text-danger' : 'text-ink'}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="mx-2 mb-2 rounded-2xl bg-panel py-3.5 text-center text-[14px] font-bold text-ink2 shadow-xl active:bg-panel-alt"
        style={{ marginBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        취소
      </button>
    </div>,
    document.body,
  );
}
