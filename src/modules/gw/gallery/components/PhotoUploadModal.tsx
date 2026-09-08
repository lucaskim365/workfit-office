import React from 'react';
import { Camera, Pencil, Plus, X } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';
import type { GalleryAlbum, UploadImageItem } from '../types';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  albums: GalleryAlbum[];
  formAlbumId: string;
  setFormAlbumId: (id: string) => void;
  formDate: string;
  setFormDate: (date: string) => void;
  uploadImages: UploadImageItem[];
  setUploadImages: React.Dispatch<React.SetStateAction<UploadImageItem[]>>;
  editingItemId: string | null;
  editCaption: string;
  setEditCaption: (caption: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpdateImageCaption: (id: string, caption: string) => void;
  handleRemoveUploadImage: (id: string) => void;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  albums,
  formAlbumId,
  setFormAlbumId,
  formDate,
  setFormDate,
  uploadImages,
  setUploadImages,
  editingItemId,
  editCaption,
  setEditCaption,
  onSubmit,
  fileInputRef,
  handleFilesChange,
  handleUpdateImageCaption,
  handleRemoveUploadImage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-panel p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between border-b border-border pb-3.5">
          <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
            {editingItemId ? (
              <>
                <Pencil className="h-4 w-4 text-teal" />
                <span>사진 정보 수정</span>
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 text-teal" />
                <span>사진 업로드</span>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-bold text-ink2 mb-1">저장할 앨범 *</label>
              <select
                value={formAlbumId}
                onChange={(e) => setFormAlbumId(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12px] text-ink outline-none focus:border-teal"
              >
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11.5px] font-bold text-ink2 mb-1">
                촬영 / 등록 일자 *
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12px] text-ink outline-none focus:border-teal"
                required
              />
            </div>
          </div>

          {/* 사진 첨부 및 개별 이미지별 캡션 작성 영역 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11.5px] font-bold text-ink2">
                사진 및 캡션 * ({uploadImages.length}장 선택됨)
              </label>
              {uploadImages.length > 0 && !editingItemId && (
                <button
                  type="button"
                  onClick={() => setUploadImages([])}
                  className="text-[10.5px] font-semibold text-danger hover:underline"
                >
                  전체 비우기
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFilesChange}
              className="hidden"
            />

            {uploadImages.length > 0 ? (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {uploadImages.map((imgItem, idx) => (
                  <div
                    key={imgItem.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-panel-alt/40 p-3"
                  >
                    {/* 썸네일 */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-panel">
                      <img
                        src={imgItem.url}
                        alt="미리보기"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.2 font-mono text-[9px] text-white">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* 개별 캡션 입력창 */}
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11px] font-bold text-ink2 mb-1">
                        {uploadImages.length > 1 ? `사진 #${idx + 1} 캡션 (설명)` : '사진 캡션 (설명)'}
                      </label>
                      <input
                        type="text"
                        value={editingItemId ? editCaption : imgItem.caption}
                        onChange={(e) => {
                          if (editingItemId) {
                            setEditCaption(e.target.value);
                          } else {
                            handleUpdateImageCaption(imgItem.id, e.target.value);
                          }
                        }}
                        placeholder="이 사진의 이야기, 장소, 설명을 적어주세요..."
                        className="h-9 w-full rounded-xl border border-border bg-panel px-3 text-[12px] text-ink outline-none focus:border-teal transition-all placeholder:text-ink3"
                      />
                    </div>

                    {/* 삭제 버튼 (수정 모드가 아닐 때) */}
                    {!editingItemId && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUploadImage(imgItem.id)}
                        title="이 사진 제외"
                        className="grid h-7 w-7 place-items-center rounded-lg text-ink3 hover:bg-danger/10 hover:text-danger transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                {!editingItemId && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border hover:border-teal/50 bg-panel-alt/20 py-3.5 cursor-pointer transition-all text-xs font-bold text-ink2 hover:text-teal"
                  >
                    <Plus className="h-4 w-4 text-teal" />
                    <span>사진 더 추가하기</span>
                    <span className="text-[11px] text-ink3 font-normal">(최대 50장)</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-teal/50 bg-panel-alt/30 hover:bg-panel-alt/60 cursor-pointer transition-all"
              >
                <Camera className="h-9 w-9 text-teal/70" />
                <span className="mt-2 text-[12.5px] font-bold text-ink">
                  클릭하여 사진 선택 (다중 선택 가능)
                </span>
                <span className="mt-0.5 text-[11px] text-teal font-medium">
                  각 사진별로 개별 캡션을 자유롭게 입력할 수 있습니다.
                </span>
              </div>
            )}
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
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={uploadImages.length === 0}
            >
              {editingItemId
                ? '캡션 수정 완료'
                : `${uploadImages.length}장의 사진 올리기`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
