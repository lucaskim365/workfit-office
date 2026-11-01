import { useState } from 'react';
import { fileStorage } from '@/shared/lib/storage';

const AVATAR_MAX_PX = 800;
const AVATAR_THUMB_PX = 200;
const AVATAR_JPEG_QUALITY = 0.85;

/**
 * 프로필 사진 업로드 훅.
 * 한 장을 두 크기(JPEG)로 저장한다 — 크게 보기용 800px, 목록·말풍선 등 작은 자리용 200px(첫 로딩을 줄인다).
 * 저장 백엔드(Firebase / Garage(S3) / data URL 폴백)는 fileStorage 어댑터가 결정한다.
 */
export function useUploadAvatar() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(userId: string, file: File): Promise<{ photoUrl: string; photoThumbUrl: string }> {
    setUploading(true);
    setError(null);
    try {
      const [large, thumb] = await Promise.all(
        [AVATAR_MAX_PX, AVATAR_THUMB_PX].map(async (px) => dataUrlToBlob(await resizeImage(file, px, px))),
      );
      // 매번 새 주소로 — 같은 주소에 덮어쓰면 화면 주소가 안 바뀌어 예전 사진이 계속 보이고, 파일 저장소를 같이 쓰는 개발·운영이 같은 ID 끼리 서로 덮어쓴다
      const stamp = Date.now();
      const contentType = 'image/jpeg';
      const [photoUrl, photoThumbUrl] = await Promise.all([
        fileStorage.put(`avatars/${userId}/${stamp}.jpg`, large, { contentType }),
        fileStorage.put(`avatars/${userId}/${stamp}_thumb.jpg`, thumb, { contentType }),
      ]);
      return { photoUrl, photoThumbUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : '업로드에 실패했습니다.';
      setError(msg);
      throw e;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error };
}

/** File → canvas 리사이즈 → base64 JPEG (투명한 부분은 흰색) */
function resizeImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 오류')); return; }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY));
      };
      img.onerror = reject;
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}
