import { flattenScreens } from '../routes';
import type { FlatScreen } from '@/shared/types/menu';

/** 업무 화면 평면 인덱스(검색·탭·즐겨찾기 공용) — 관리자 콘솔 화면은 빠진다. */
export const SCREENS: FlatScreen[] = flattenScreens().filter((s) => s.area !== 'admin');
/** 관리자 콘솔 화면(/admin 아래에 그린다) */
export const ADMIN_SCREENS: FlatScreen[] = flattenScreens().filter((s) => s.area === 'admin');
/** 관리자 콘솔 주소 — 화면 주소 앞에 /admin 을 붙인다(/base/user → /admin/base/user) */
export const ADMIN_URL = '/admin';
export const adminPath = (url: string) => `${ADMIN_URL}${url}`;
export const SCREEN_BY_URL: Record<string, FlatScreen> = Object.fromEntries(
  SCREENS.map((s) => [s.url, s]),
);
export const SCREEN_BY_NAME: Record<string, FlatScreen> = Object.fromEntries(
  SCREENS.map((s) => [s.name, s]),
);

export const HOME_URL = '/exec';
