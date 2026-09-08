import React from 'react';
import { FolderPlus, Pencil, Sparkles, X } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';

interface AlbumManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAlbumId: string | null;
  albumName: string;
  setAlbumName: React.Dispatch<React.SetStateAction<string>>;
  albumDesc: string;
  setAlbumDesc: (desc: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const EMOJI_PRESETS = ['📁', '🏢', '🎉', '📸', '✈️', '🏆', '💡', '👥', '🍕', '☕', '🏃', '🏖️', '🌿', '🎁', '🎓', '🎨'];

export const AlbumManageModal: React.FC<AlbumManageModalProps> = ({
  isOpen,
  onClose,
  editingAlbumId,
  albumName,
  setAlbumName,
  albumDesc,
  setAlbumDesc,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-border bg-panel p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between border-b border-border pb-3.5">
          <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
            {editingAlbumId ? (
              <>
                <Pencil className="h-4 w-4 text-teal" />
                <span>앨범 정보 수정</span>
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4 text-teal" />
                <span>새 앨범 만들기</span>
              </>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-sm font-bold text-ink3 hover:bg-panel-alt hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11.5px] font-bold text-ink2">앨범 이름 *</label>
              <span className="text-[10.5px] text-teal font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>이모지 꾸미기 지원</span>
              </span>
            </div>

            {/* 이모지 빠른 추가 프리셋 바 */}
            <div className="mb-2 p-2 rounded-xl bg-panel-alt/50 border border-border/60">
              <div className="text-[10px] text-ink3 mb-1.5 font-medium flex items-center justify-between">
                <span>추천 이모지 클릭 시 제목에 추가:</span>
                <span className="text-[9.5px] text-ink3/80 font-mono">단축키: Win + .</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {EMOJI_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setAlbumName((prev) => {
                        const trimmed = prev.trim();
                        // 맨 앞 글자가 이미 이모지인지 정규식으로 감지
                        const emojiRegex = /^(\p{Extended_Pictographic}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF])\s*/u;
                        const match = trimmed.match(emojiRegex);
                        if (match) {
                          return `${emoji} ${trimmed.slice(match[0].length)}`;
                        }
                        return trimmed ? `${emoji} ${trimmed}` : `${emoji} `;
                      });
                    }}
                    className="h-7 w-7 rounded-lg hover:bg-panel hover:scale-110 active:scale-95 transition-all text-sm grid place-items-center border border-transparent hover:border-border/80 shadow-2xs cursor-pointer"
                    title={`${emoji} 추가/교체`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <input
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              placeholder="예: 🎉 2026 워크핏 확장 이전, 🏢 전사 행사 등"
              className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-ink outline-none focus:border-teal transition-all"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-ink2 mb-1">
              앨범 설명 (선택)
            </label>
            <input
              value={albumDesc}
              onChange={(e) => setAlbumDesc(e.target.value)}
              placeholder="간단한 앨범 설명을 입력하세요..."
              className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12px] text-ink outline-none focus:border-teal transition-all"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              취소
            </Button>
            <Button type="submit" variant="primary" size="md">
              {editingAlbumId ? '저장' : '앨범 생성'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
