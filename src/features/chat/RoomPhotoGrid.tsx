import { useMemo } from 'react';
import type { Attachment } from '@/domain/chatMessage/schema';
import { groupRoomFilesByDay, type RoomFile } from '@/domain/chatMessage/roomFiles';

/**
 * 파일함 [사진] 탭 — 날짜별로 묶은 바둑판(웹·PWA 공용).
 * 누르면 onOpen(그 사진, 이 방 사진 전체) — 크게 보기에서 좌우로 다른 사진도 넘겨 본다.
 */
export function RoomPhotoGrid({
  photos,
  onOpen,
  cols = 3,
}: {
  photos: readonly RoomFile[];
  onOpen: (att: Attachment, list: Attachment[]) => void;
  cols?: 3 | 4;
}) {
  const days = useMemo(() => groupRoomFilesByDay(photos), [photos]);
  const list = useMemo(() => photos.map((f) => f.attachment), [photos]);

  if (photos.length === 0) return <div className="py-20 text-center text-[12px] text-ink3">공유된 사진이 없습니다.</div>;

  return (
    <div className="pb-3">
      {days.map((d) => (
        <section key={d.day}>
          <h3 className="sticky top-0 z-[1] bg-white/95 px-3 pb-1.5 pt-3 text-[11.5px] font-bold text-ink2">{d.label}</h3>
          <div className={`grid gap-0.5 px-0.5 ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {d.files.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onOpen(f.attachment, list)}
                title={`${f.attachment.name} · ${f.senderName}`}
                className="relative block aspect-square overflow-hidden bg-black/5 cursor-pointer hover:brightness-95"
              >
                <img src={f.attachment.url} alt={f.attachment.name} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
