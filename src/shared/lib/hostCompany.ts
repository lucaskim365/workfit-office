import type { Company } from '@/domain/company/affiliation';
import { brandOf, hostCompanyOf } from '@/domain/company/host';

const OVERRIDE_KEY = 'workfit:brand';

/**
 * 이 브라우저가 접속한 주소의 회사 — 화면 이름·로고와 기본값(결재함·조직도 보기, 겸직자 새 문서의 회사)에만 쓴다.
 * 권한·데이터는 주소와 상관없다(같은 계정·같은 DB).
 * 시험: 주소 끝 ?brand=lumefab / ?brand=workfit — 이 브라우저에 기억(지우려면 ?brand=auto)
 */
function readHostCompany(): Company {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search).get('brand');
    if (q === 'auto') localStorage.removeItem(OVERRIDE_KEY);
    else if (q === 'lumefab' || q === 'workfit') localStorage.setItem(OVERRIDE_KEY, q);
    const saved = localStorage.getItem(OVERRIDE_KEY);
    if (saved === 'lumefab') return 'lumefab';
    if (saved === 'workfit') return null;
  } catch {
    /* 저장소를 못 쓰면 주소로만 */
  }
  const extra = String(import.meta.env.VITE_LUMEFAB_HOSTS ?? '').split(',');
  return hostCompanyOf(window.location.hostname, extra);
}

/** 접속한 주소의 회사(앱을 연 동안 그대로) */
export const HOST_COMPANY: Company = readHostCompany();
export const HOST_BRAND = brandOf(HOST_COMPANY);
