import { useState } from 'react';
import { fileStorage } from '@/shared/lib/storage';

/**
 * 프로필 사진 업로드 훅.
 * 브라우저에서 200×200px 이내로 리사이즈(PNG) 후 파일 스토리지에 업로드하고 URL을 반환.
 * 저장 백엔드(Firebase / Garage(S3) / data URL 폴백)는 fileStorage 어댑터가 결정한다.
 */
export function useUploadAvatar() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(userId: string, file: File): Promise<string> {
    setUploading(true);
    setError(null);
    try {
      // 이미지 리사이즈 (200×200 max, PNG 변환)
      const resized = await resizeImage(file, 200, 200);
      const blob = await dataUrlToBlob(resized);
      // 매번 새 주소로 — 같은 주소에 덮어쓰면 화면 주소가 안 바뀌어 예전 사진이 계속 보이고, 파일 저장소를 같이 쓰는 개발·운영이 같은 ID 끼리 서로 덮어쓴다
      return await fileStorage.put(`avatars/${userId}/${Date.now()}.png`, blob, {
        contentType: 'image/png',
      });
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

/** File → canvas 리사이즈 → base64 PNG */
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
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
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
