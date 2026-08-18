import {
  MAIL_FOLDER_ICONS,
  MAIL_FOLDER_LABELS,
  MAIL_FOLDERS,
  type MailFolder,
} from '@/domain/mail/schema';
import { GwSideNav } from '@/modules/gw/_gw';

interface Props {
  current: MailFolder;
  /** 선택된 계정들이 실제로 갖고 있는 폴더. 비어 있으면 아직 조회 전이다. */
  available: MailFolder[] | null;
  onSelect: (folder: MailFolder) => void;
  /** 받은메일함 안 읽은 수. 0이거나 모르면 배지를 달지 않는다. */
  unseenCount?: number;
}

/**
 * 폴더 목록 — 다른 그룹웨어 화면과 같은 좌측 세부 메뉴 카드.
 *
 * 계정에 없는 폴더는 비활성으로 두고 이유를 붙인다. 그냥 열어 두면 눌렀을 때 빈 목록이
 * 나오고, 메일이 없는 것인지 폴더가 없는 것인지 구분할 수 없다.
 * ([[jwheo/feat/mail/DESIGN.md]] §3.1)
 */
export default function MailFolderNav({ current, available, onSelect, unseenCount }: Props) {
  return (
    <GwSideNav
      title="메일함"
      desc="폴더별 메일을 확인합니다."
      items={MAIL_FOLDERS.map((folder) => {
        // 조회 전에는 모두 눌리게 둔다. 로딩 동안 전부 비활성이면 화면이 멈춘 것처럼 보인다.
        const usable = available === null || available.includes(folder);
        return {
          id: folder,
          icon: MAIL_FOLDER_ICONS[folder],
          label: MAIL_FOLDER_LABELS[folder],
          disabled: !usable,
          hint: usable ? MAIL_FOLDER_LABELS[folder] : '연결한 계정에 이 폴더가 없습니다.',
          // 안 읽은 수는 받은메일함에만 단다. 다른 폴더는 STATUS를 따로 물어야 해 비용만 는다.
          badge: folder === 'INBOX' && unseenCount && unseenCount > 0
            ? (unseenCount > 99 ? '99+' : String(unseenCount))
            : undefined,
        };
      })}
      activeId={current}
      onSelect={(id) => onSelect(id as MailFolder)}
    />
  );
}
