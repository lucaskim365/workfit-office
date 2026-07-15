/**
 * 하이브리드 SHA-256 패스워드 해싱 유틸리티.
 * 브라우저 환경에서는 Web Crypto API를 사용하고, Node.js 환경(시드 스크립트 등)에서는 내장 node:crypto를 동적으로 불러와 처리합니다.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto) {
    // Node.js 환경 호환 (동적 import)
    const cryptoModule = await import('node:crypto');
    return cryptoModule.createHash('sha256').update(password).digest('hex');
  }

  // 브라우저 환경 호환 (Web Crypto API)
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
