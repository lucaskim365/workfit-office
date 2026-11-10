import type { Company } from './affiliation';

/*
  접속한 주소(도메인)의 회사 — 같은 프로그램을 주소만 달리해 회사별 인트라넷으로 보여 준다.
  루미팹 주소: 주소에 'lumefab' 이 들어 있거나, VITE_LUMEFAB_HOSTS(쉼표로 여러 개)에 적은 주소.
  그 밖의 주소(워크핏 주소·개발 localhost)는 워크핏.
  개발·시험: 주소 끝에 ?brand=lumefab 을 붙이면 이 브라우저에서 루미팹 주소처럼 보인다(?brand=workfit 로 되돌림).
*/

export function hostCompanyOf(hostname: string, extraHosts: readonly string[] = []): Company {
  const h = hostname.trim().toLowerCase();
  if (!h) return null;
  if (h.includes('lumefab')) return 'lumefab';
  const hit = extraHosts.some((x) => {
    const e = x.trim().toLowerCase();
    return e !== '' && (h === e || h.endsWith(`.${e}`));
  });
  return hit ? 'lumefab' : null;
}

/** 회사별 인트라넷 이름 */
export interface Brand {
  /** 상단 굵은 글자 */
  name: string;
  /** 상단 색 글자 */
  product: string;
  /** 상단 작은 글자 */
  tagline: string;
  /** 브라우저 탭 제목 */
  title: string;
  /** 로그인 화면 회사명(회사 정보에 등록한 이름이 없을 때) */
  loginName: string;
}

export const BRANDS: Record<'workfit' | 'lumefab', Brand> = {
  workfit: { name: 'WorkFit', product: 'Intranet', tagline: 'Enterprise Portal Suite', title: 'WorkFit Intranet', loginName: 'WorkFit' },
  lumefab: { name: 'LumeFab', product: 'Intranet', tagline: 'Enterprise Portal Suite', title: 'LumeFab Intranet', loginName: 'LumeFab' },
};

export const brandOf = (c: Company): Brand => BRANDS[c ?? 'workfit'];

/** 루미팹 로고 — 회사 정보 화면의 로고 목록에서 이름에 'LumeFab'·'루미팹'이 든 것 */
export function lumefabLogoOf(marks: readonly { kind: string; name: string; url: string }[] | null | undefined): string {
  return (marks ?? []).find((m) => m.kind === 'logo' && /lumefab|루미팹/i.test(m.name))?.url ?? '';
}
