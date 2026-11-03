import { useState } from 'react';
import { useUsers } from '@/features/user/useUsers';
import { smallPhotoOf } from '@/domain/user/schema';

/**
 * 메신저 아바타 위에 덮는 프로필 사진 — 사진이 없거나 못 불러오면 아무것도 그리지 않아 밑의 이름 글자가 보인다.
 * 아바타 칸은 relative overflow-hidden 이어야 하고, 모양(원·둥근 사각)은 칸을 따른다.
 */
export function ChatAvatarPhoto({ userId }: { userId?: string | null }) {
  const { data: users = [] } = useUsers();
  const [failedUrl, setFailedUrl] = useState('');
  const url = userId ? smallPhotoOf(users.find((u) => u.id === userId)) : '';
  if (!url || url === failedUrl) return null;
  return <img src={url} alt="" loading="lazy" onError={() => setFailedUrl(url)} className="absolute inset-0 h-full w-full object-cover" />;
}
