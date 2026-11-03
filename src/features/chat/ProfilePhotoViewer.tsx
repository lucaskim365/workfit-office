import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** 프로필 사진 크게 보기 — 화면 어디를 누르거나 Esc 로 닫는다. 웹 명함·모바일 시트 위에 뜬다. */
export function ProfilePhotoViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-label={`${name} 프로필 사진`}
      className="fixed inset-0 z-[100000] grid place-items-center bg-black/80 p-4"
      // 명함은 바깥 누름(window)에 닫히므로, 사진만 닫히도록 여기서 멈춘다
      onMouseDown={(e) => e.nativeEvent.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <img
        src={url}
        alt={`${name} 프로필 사진`}
        className="max-h-[calc(90vh/var(--font-scale,1))] max-w-[calc(90vw/var(--font-scale,1))] rounded-xl object-contain shadow-2xl"
      />
      <button type="button" aria-label="닫기" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white">
        <X size={20} />
      </button>
    </div>,
    document.body,
  );
}
