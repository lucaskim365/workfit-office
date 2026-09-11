import { useState, useEffect } from 'react';
import type { GalleryFolder } from '@/domain/gallery/schema';
import { X, Folder, FolderPlus } from 'lucide-react';

interface FolderManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentFolder: GalleryFolder | null;
  editingFolder: GalleryFolder | null;
  onSubmit: (name: string, description?: string) => Promise<void>;
}

export function FolderManageModal({
  isOpen,
  onClose,
  parentFolder,
  editingFolder,
  onSubmit,
}: FolderManageModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(editingFolder);

  useEffect(() => {
    if (isOpen) {
      if (editingFolder) {
        setName(editingFolder.name);
        setDescription(editingFolder.description || '');
      } else {
        setName('');
        setDescription('');
      }
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, editingFolder]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('폴더명을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onSubmit(trimmed, description.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err?.message || '폴더 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-panel shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-panel-alt">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal/10 text-teal">
              {isEdit ? <Folder size={18} /> : <FolderPlus size={18} />}
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-ink">
                {isEdit ? '폴더 이름 및 정보 변경' : '새 폴더 생성'}
              </h3>
              {!isEdit && (
                <p className="text-[11px] text-ink3">
                  {parentFolder ? `상위: ${parentFolder.name}` : '위치: 최상위(루트)'}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-ink3 hover:bg-panel hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-danger/10 p-2.5 text-[12px] font-medium text-danger">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold text-ink mb-1.5">
              폴더명 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2026년 행사, 워크숍, 연구소 등"
              maxLength={50}
              autoFocus
              className="w-full rounded-xl border border-border bg-panel px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-ink mb-1.5">
              폴더 설명 <span className="text-[11px] font-normal text-ink3">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 폴더에 담길 사진에 대한 간단한 설명을 입력하세요."
              rows={2}
              maxLength={150}
              className="w-full resize-none rounded-xl border border-border bg-panel px-3.5 py-2 text-[12.5px] text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-border px-4 py-2 text-[12.5px] font-semibold text-ink hover:bg-panel-alt transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-teal px-5 py-2 text-[12.5px] font-bold text-white shadow-xs hover:bg-teal/90 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? '저장 중…' : isEdit ? '수정 완료' : '폴더 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
