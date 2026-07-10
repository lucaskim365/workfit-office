import { useAuth } from '@/app/auth/AuthProvider';

interface UserMenuProps {
  onClose: () => void;
  onChangePassword: () => void;
  onThemeOpen: () => void;
}

function Item({ icon, label, sub, onClick }: { icon: string; label: string; sub?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-[18px] py-2 text-left transition-colors hover:bg-panel-alt">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-panel-alt text-[13px]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-ink">{label}</span>
        {sub && <span className="mt-px block text-[10px] text-ink3">{sub}</span>}
      </span>
    </button>
  );
}

/** 계정 팝업 — 와이어프레임 app-shell.UserAccountMenu 정본. */
export function UserMenu({ onClose, onChangePassword, onThemeOpen }: UserMenuProps) {
  const { signOutUser, user } = useAuth();
  // 로그인 사용자 정보(자체 로그인). 미로그인/데모 시 기본 표기.
  const name = user?.name ?? '게스트';
  const email = user?.email ?? '-';
  const initials = name.slice(-2);
  const roleSub = user ? `${user.dept} · ${user.position}` : '-';
  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div className="absolute right-[-4px] top-[calc(100%+12px)] z-[60] w-80 overflow-hidden rounded-2xl border border-border bg-panel shadow-[0_16px_48px_rgba(16,24,48,0.28)]">
        {/* 프로필 헤더 */}
        <div className="flex flex-col items-center gap-2 bg-teal-soft px-[18px] pb-5 pt-[22px]">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-teal text-[25px] font-bold text-white shadow-[0_2px_8px_rgba(23,168,154,0.35)]">{initials}</div>
          <div className="text-center">
            <div className="text-sm font-bold text-ink">{name}</div>
            <div className="text-[11.5px] text-ink2">{email}</div>
          </div>
          <button onClick={onClose} className="mt-1 rounded-full border border-border-hi bg-panel px-4 py-1.5 text-[11.5px] font-bold text-navy">
            내 계정 관리
          </button>
        </div>

        <div className="border-b border-border py-2">
          <Item icon="🔑" label="비밀번호 변경" onClick={() => { onClose(); onChangePassword(); }} />
          <Item icon="🎨" label="테마 설정 (Custom)" sub="메인 / 포인트 색상 변경" onClick={() => { onClose(); onThemeOpen(); }} />
          <Item icon="👤" label="프로필 설정" sub={roleSub} />
          <Item icon="🔔" label="알림 설정" sub="설비 알람 · SPC 위반 수신 중" />
          <Item icon="🌐" label="언어 / 지역" sub="한국어 (Korea)" />
        </div>

        <div className="py-2.5">
          <div className="px-[18px] pb-1.5 pt-0.5 text-[10px] font-extrabold tracking-wide text-ink3">접속 환경</div>
          <button onClick={onClose} className="flex w-full items-center gap-3 px-[18px] py-2 text-left transition-colors hover:bg-panel-alt">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-blue-soft text-[12px] font-extrabold text-blue">M1</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-ink">[WorkFit] M-line · Fab1</span>
              <span className="mt-px block text-[10px] text-ink3">현재 접속 라인</span>
            </span>
            <span className="text-[10px] font-semibold text-ink3">변경 ▾</span>
          </button>
        </div>

        <div className="flex border-t border-border">
          <button onClick={onClose} className="flex-1 border-r border-border py-3 text-[11.5px] font-semibold text-ink2 hover:bg-panel-alt">도움말</button>
          <button
            onClick={() => {
              onClose();
              void signOutUser();
            }}
            className="flex-1 py-3 text-[11.5px] font-bold text-danger hover:bg-panel-alt"
          >
            로그아웃
          </button>
        </div>
      </div>
    </>
  );
}
