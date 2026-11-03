/**
 * 사용자 ID에 따른 다채로운 파스텔톤 아바타 스타일 매핑 — 웹·모바일 메신저 공용
 * (같은 사람은 어느 화면에서나 같은 색).
 */
export function getAvatarStyle(userId: string): { bg: string; text: string } {
  const PASTEL_PALETTE = [
    { bg: '#e0f2fe', text: '#0369a1' }, // 파스텔 스카이 블루
    { bg: '#fce7f3', text: '#be185d' }, // 파스텔 핑크
    { bg: '#dcfce7', text: '#15803d' }, // 파스텔 민트/그린
    { bg: '#fef9c3', text: '#a16207' }, // 파스텔 옐로우
    { bg: '#f3e8ff', text: '#6b21a8' }, // 파스텔 퍼플
    { bg: '#ffedd5', text: '#c2410c' }, // 파스텔 오렌지
    { bg: '#e0e7ff', text: '#3730a3' }, // 파스텔 인디고
  ];
  if (!userId) return PASTEL_PALETTE[0];
  let sum = 0;
  for (let i = 0; i < userId.length; i++) {
    sum += userId.charCodeAt(i);
  }
  return PASTEL_PALETTE[sum % PASTEL_PALETTE.length];
}
