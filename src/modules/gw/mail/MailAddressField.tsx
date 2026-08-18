import { useState } from 'react';
import {
  activeAddressSegment,
  applyRecipientSuggestion,
  parseAddressList,
  suggestRecipients,
} from '@/domain/mail/engine';
import type { RecentRecipient } from '@/domain/mail/schema';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** 최근 받는 사람. 비어 있으면 일반 입력창과 같다. */
  recents: RecentRecipient[];
  placeholder?: string;
}

/**
 * 주소 입력 + 최근 받는 사람 추천.
 *
 * 브라우저 `datalist`는 쉼표로 이어 쓰는 다중 주소 입력에서 전체 값을 갈아치우므로 쓸 수
 * 없다. 마지막 구분자 뒤의 조각만 보고 추천하고, 고르면 그 조각만 교체한다.
 */
export default function MailAddressField({ value, onChange, recents, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const { term } = activeAddressSegment(value);
  const existing = parseAddressList(value).addresses.map((row) => row.email);
  const suggestions = open ? suggestRecipients(recents, term, existing) : [];

  const pick = (row: RecentRecipient) => {
    onChange(applyRecipientSuggestion(value, row));
    setHighlight(0);
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (suggestions.length === 0) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((index) => (index + 1) % suggestions.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => (index - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            pick(suggestions[highlight] ?? suggestions[0]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[11.5px] text-ink outline-none"
      />
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-panel shadow-md">
          {suggestions.map((row, index) => (
            <li key={row.email}>
              {/* blur로 목록이 닫히기 전에 잡히도록 click이 아니라 mousedown에서 고른다. */}
              <button
                type="button"
                onMouseDown={(event) => { event.preventDefault(); pick(row); }}
                className={`block w-full px-3 py-2 text-left text-[11px] ${index === highlight ? 'bg-teal-soft/40 text-teal' : 'text-ink hover:bg-ink3/8'}`}
              >
                {row.name ? `${row.name} · ${row.email}` : row.email}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
