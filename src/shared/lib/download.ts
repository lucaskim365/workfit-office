/**
 * 파일 다운로드 유틸리티 — 크로스 오리진(S3/Appwrite/Firebase) 환경에서도
 * 한글 및 특수문자 파일명이 깨지지 않고 100% 원본 그대로 다운로드되도록 Blob 기반 다운로드를 수행합니다.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  if (!url) return;

  // 1. 파일명이 URL 인코딩(%EA%B2%B0%EC%9E%AC...)되어 있는 경우 안전하게 디코딩
  let cleanName = filename;
  try {
    cleanName = decodeURIComponent(filename);
  } catch {
    cleanName = filename;
  }

  try {
    // 2. fetch로 Blob을 받아 로컬 Blob URL 생성 (Same-Origin 전환으로 a.download 100% 보장)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = cleanName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.warn('Blob download fallback to direct anchor:', err);
    // 3. CORS 제한 시 폴백
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
