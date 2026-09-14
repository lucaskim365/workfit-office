import { useState, useEffect } from 'react';
import type { FormField, FieldValue } from '@/domain/approvalForm/schema';

interface SelectFieldEditorProps {
  field: FormField;
  sv: string;
  set: (patch: Record<string, FieldValue>) => void;
  inp?: string;
  onCustomChange?: (nextVal: string) => void;
}

export function SelectFieldEditor({ field, sv, set, inp, onCustomChange }: SelectFieldEditorProps) {
  const options = field.options || [];

  // 옵션 목록에 '직접 입력', '직접입력' 또는 '직접'이 포함된 항목이 있는지 검사
  const isDirectOption = (o: string) =>
    o === '직접 입력' || o === '직접입력' || o.includes('직접입력') || o.includes('직접 입력');

  const hasDirectInputOption = options.some(isDirectOption);

  // 값이 직접입력 옵션이거나 옵션 목록에 없는 사용자 지정 값인 경우 직접 입력 모드로 간주
  const isDirectInputState =
    isDirectOption(sv) || (sv !== '' && !options.includes(sv));
  const isCustomValue = hasDirectInputOption && isDirectInputState;

  const [showInput, setShowInput] = useState(isCustomValue);

  // sv가 외부에서 변경될 때 (예: 복구 또는 임시저장 불러오기 시) showInput 동기화
  useEffect(() => {
    if (isCustomValue) {
      setShowInput(true);
    }
  }, [isCustomValue]);

  const applyChange = (val: string) => {
    set({ [field.key]: val });
    onCustomChange?.(val);
  };

  const defaultInputStyle =
    inp ||
    'w-full bg-transparent px-1.5 py-1 text-[12px] text-[#222] border border-[#bbb] rounded outline-none focus:border-teal';

  // 1. 직접 입력 모드 활성화 상태
  if (hasDirectInputOption && showInput) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        <input
          type="text"
          value={isDirectOption(sv) ? '' : sv}
          onChange={(e) => applyChange(e.target.value)}
          placeholder="직접 입력하세요"
          className={defaultInputStyle}
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setShowInput(false);
            applyChange('');
          }}
          className="text-[11px] text-teal hover:underline shrink-0 px-1 py-0.5 font-semibold cursor-pointer"
        >
          선택으로 돌아가기
        </button>
      </div>
    );
  }

  // 2. 일반 드롭다운 모드
  return (
    <select
      value={sv}
      onChange={(e) => {
        const val = e.target.value;
        if (hasDirectInputOption && isDirectOption(val)) {
          setShowInput(true);
          applyChange('');
        } else {
          applyChange(val);
        }
      }}
      className={defaultInputStyle}
    >
      <option value="">선택</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
