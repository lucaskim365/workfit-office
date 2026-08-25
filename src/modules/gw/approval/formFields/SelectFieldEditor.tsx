import { useState } from 'react';
import type { FormField, FieldValue } from '@/domain/approvalForm/schema';

interface SelectFieldEditorProps {
  field: FormField;
  sv: string;
  set: (patch: Record<string, FieldValue>) => void;
  inp: string;
}

export function SelectFieldEditor({ field, sv, set, inp }: SelectFieldEditorProps) {
  // 템플릿 옵션 목록에 '직접 입력' 혹은 '직접입력'이 포함되어 있는지 여부 판단
  const hasDirectInputOption = field.options.includes('직접 입력') || field.options.includes('직접입력');

  // 값이 '직접 입력'/'직접입력' 상태이거나 옵션 리스트에 없는 다른 값인 경우 직접 입력 모드로 간주
  const isDirectInputState = sv === '직접 입력' || sv === '직접입력' || (sv !== '' && !field.options.includes(sv));
  const isCustomValue = hasDirectInputOption && isDirectInputState;
  
  const [showInput, setShowInput] = useState(isCustomValue);

  // 1. 직접 입력 모드 활성화 상태 (템플릿에 '직접 입력' 옵션이 있을 때만 동작)
  if (hasDirectInputOption && showInput) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        <input
          type="text"
          value={(sv === '직접 입력' || sv === '직접입력') ? '' : sv}
          onChange={(e) => set({ [field.key]: e.target.value })}
          placeholder="직접 입력하세요"
          className={inp}
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setShowInput(false);
            set({ [field.key]: '' });
          }}
          className="text-xs text-ink3 hover:text-ink hover:underline shrink-0 p-1 font-semibold"
        >
          선택으로 돌아가기
        </button>
      </div>
    );
  }

  // 2. 일반 드롭다운 모드 (템플릿에 '직접 입력'이 명시되어 있는 경우에만 선택 시 직접 입력 인풋으로 전환)
  return (
    <select
      value={sv}
      onChange={(e) => {
        const val = e.target.value;
        if (hasDirectInputOption && (val === '직접 입력' || val === '직접입력')) {
          setShowInput(true);
          set({ [field.key]: '' });
        } else {
          set({ [field.key]: val });
        }
      }}
      className={inp}
    >
      <option value="">선택</option>
      {field.options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
