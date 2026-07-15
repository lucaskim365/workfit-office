import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isFirebaseConfigured } from '@/shared/lib/firebase';

/**
 * 프로필 사진 업로드 훅.
 * Firebase Storage가 설정된 경우 Storage에 업로드하고 download URL을 반환.
 * 미설정 시 브라우저에서 200×200px 이내로 리사이즈 후 base64 data URL로 폴백.
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

      if (isFirebaseConfigured && storage) {
        // Firebase Storage 업로드
        const storageRef = ref(storage, `avatars/${userId}/avatar.png`);
        const blob = await dataUrlToBlob(resized);
        await uploadBytes(storageRef, blob, { contentType: 'image/png' });
        const url = await getDownloadURL(storageRef);
        return url;
      } else {
        // 폴백: base64 data URL 그대로 반환
        return resized;
      }
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
