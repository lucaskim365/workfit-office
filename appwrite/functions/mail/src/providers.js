/**
 * 공급자별 접속 정보.
 *
 * 호스트·포트는 **서버에만 둔다.** 클라이언트로 내려보내면 화면이 그 값을 고쳐 보낼 수 있고,
 * 그러면 임의 서버로 앱 비밀번호를 흘려보내는 통로가 된다. (MailHub `provider-presets.ts`와 동일)
 */

const PRESETS = {
  naver: {
    smtp: { host: 'smtp.naver.com', port: 587, security: 'starttls' },
    imap: { host: 'imap.naver.com', port: 993, security: 'tls' },
  },
  daum: {
    smtp: { host: 'smtp.daum.net', port: 465, security: 'tls' },
    imap: { host: 'imap.daum.net', port: 993, security: 'tls' },
  },
};

/** 앱 비밀번호로 열어 둔 공급자. google·microsoft는 OAuth라 여기 없다. */
export const OPEN_PROVIDERS = Object.keys(PRESETS);

export const isOpenProvider = (provider) => OPEN_PROVIDERS.includes(provider);

/**
 * 계정 문서 + 평문 비밀번호 → IMAP·SMTP 접속 설정.
 *
 * custom 공급자는 문서에 저장된 호스트를 쓰는데, 사설·루프백 주소 차단(SSRF 방어)이
 * 아직 없어서 지금은 열지 않는다. 여는 시점에 반드시 검증을 먼저 넣어야 한다.
 */
export function connectionSettings(account, secret) {
  const preset = PRESETS[account.provider];
  if (!preset) {
    throw Object.assign(new Error('아직 지원하지 않는 메일 공급자입니다.'), { code: 'PROVIDER_UNAVAILABLE' });
  }

  return {
    // 인증 아이디를 따로 저장하지 않았으면 주소를 그대로 쓴다(네이버·다음 모두 주소로 로그인).
    authUsername: account.authUsername || account.email,
    secret,
    smtp: preset.smtp,
    imap: preset.imap,
  };
}
