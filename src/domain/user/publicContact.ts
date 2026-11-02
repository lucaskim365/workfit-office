/**
 * 조직도·비상연락망에 보이는 임원 표시값.
 * 임원의 DB 사번은 로그인 ID 로 쓰이므로 바꾸지 않고, 화면에 보이는 값만 정한다.
 */
const EXECUTIVE_DISPLAY: Record<string, { empNo: string; email?: string }> = {
  U001: { empNo: '0001', email: 'ceo@workfit.kr' }, // 대표이사
  U019: { empNo: '0002' }, // 부위원장
};

interface ContactUser {
  id: string;
  empNo?: string | null;
}

/** 화면에 보일 사번 */
export function displayEmpNo(user: ContactUser): string {
  return EXECUTIVE_DISPLAY[user.id]?.empNo ?? user.empNo ?? '';
}

/** 비공개 대상이어도 보일 사번이 정해져 있는가 */
export function hasDisplayEmpNo(user: ContactUser): boolean {
  return Boolean(EXECUTIVE_DISPLAY[user.id]);
}

/** 비공개 대상이어도 공개하는 이메일. 없으면 null */
export function publicEmailOf(user: ContactUser): string | null {
  return EXECUTIVE_DISPLAY[user.id]?.email ?? null;
}
