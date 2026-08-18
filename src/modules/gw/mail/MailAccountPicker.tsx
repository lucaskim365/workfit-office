import { useEffect, useRef, useState } from 'react';
import {
  MAIL_ACCOUNT_STATUS_LABELS,
  MAIL_PROVIDER_LABELS,
  type MailAccount,
} from '@/domain/mailAccount/schema';

interface Props {
  accounts: MailAccount[];
  /** 선택된 계정 ID. 빈 배열이면 전체를 뜻한다. */
  selected: string[];
  onChange: (ids: string[]) => void;
  /** 조회에 실패한 계정 — 목록에 표시해 어느 계정이 비어 보이는지 알려준다. */
  failedIds: string[];
  /** 계정 설정 진입. 목업이면 계정 수정, 브리지면 서명 편집 모달이 열린다. */
  onEdit?: (account: MailAccount) => void;
}

/**
 * 계정 선택기.
 *
 * 빈 선택을 "전체"로 다룬다. 계정을 하나도 고르지 않은 상태와 전부 고른 상태를 따로 두면
 * 빈 목록이 뜨는 이유가 두 가지가 되어 사용자가 구분할 수 없다.
 *
 * `<select multiple>`을 쓰지 않는다. Ctrl+클릭으로만 여러 개를 고를 수 있어 알아채기 어렵고,
 * 계정별 오류 상태를 함께 보여줄 자리도 없다.
 */
export default function MailAccountPicker({ accounts, selected, onChange, failedIds, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const all = selected.length === 0;
  const failed = new Set(failedIds);

  const label = all
    ? `전체 계정 ${accounts.length}`
    : selected.length === 1
      ? accounts.find((row) => row.id === selected[0])?.displayName ?? '계정 1'
      : `계정 ${selected.length}개`;

  const toggle = (id: string) => {
    // 전체 상태에서 하나를 끄면 나머지 전부를 고른 것과 같다.
    const base = all ? accounts.map((row) => row.id) : selected;
    const next = base.includes(id) ? base.filter((row) => row !== id) : [...base, id];
    onChange(next.length === accounts.length ? [] : next);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-panel px-3 text-[10.5px] font-bold text-ink outline-none hover:bg-ink3/8"
      >
        <span>📬</span>
        {label}
        {failedIds.length > 0 && (
          <span className="rounded bg-amber/15 px-1.5 py-px text-[8.5px] font-bold text-amber">
            오류 {failedIds.length}
          </span>
        )}
        <span className="text-ink3">▾</span>
      </button>

      {/* 트리거가 좌측 정렬이라 패널도 왼쪽 기준으로 편다. 오른쪽 기준이면 화면 밖으로 나간다. */}
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-panel shadow-lg">
          <button
            type="button"
            onClick={() => { onChange([]); setOpen(false); }}
            className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[11px] font-bold transition-colors ${all ? 'bg-teal-soft/40 text-teal' : 'text-ink2 hover:bg-ink3/8'}`}
          >
            전체 계정
            <span className="text-[9.5px] font-semibold text-ink3">{accounts.length}개</span>
          </button>

          <div className="max-h-72 overflow-y-auto border-t border-border">
            {accounts.map((account) => {
              const checked = all || selected.includes(account.id);
              return (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-start gap-2 px-3 py-2 transition-colors hover:bg-ink3/8"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(account.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">{account.displayName}</span>
                      {account.status !== 'active' && (
                        <span className="shrink-0 rounded bg-amber/15 px-1.5 py-px text-[8.5px] font-bold text-amber">
                          {MAIL_ACCOUNT_STATUS_LABELS[account.status]}
                        </span>
                      )}
                      {failed.has(account.id) && (
                        <span className="shrink-0 rounded bg-amber/15 px-1.5 py-px text-[8.5px] font-bold text-amber">
                          조회 실패
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[9.5px] text-ink3">{account.email}</span>
                    <span className="mt-0.5 flex items-center justify-between">
                      <span className="text-[9px] text-ink3">{MAIL_PROVIDER_LABELS[account.provider]}</span>
                      {onEdit && (
                        <button
                          type="button"
                          onClick={(event) => { event.preventDefault(); setOpen(false); onEdit(account); }}
                          className="text-[9px] font-bold text-ink3 hover:text-teal hover:underline"
                        >
                          설정
                        </button>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
