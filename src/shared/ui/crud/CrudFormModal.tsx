import { useEffect } from 'react';
import { useForm, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { ActionButton } from '@/shared/ui/ActionBar';
import type { Option } from '@/shared/ui/FilterBar';

export interface FormFieldConfig<V> {
  name: keyof V & string;
  label: string;
  type?: 'text' | 'select';
  required?: boolean;
  options?: Option[];
  placeholder?: string;
  colSpan?: 1 | 2;
}

interface CrudFormModalProps<S extends z.ZodType> {
  open: boolean;
  titleAdd: string;
  titleEdit: string;
  schema: S;
  fields: FormFieldConfig<z.infer<S>>[];
  empty: DefaultValues<z.infer<S>>;
  /** 값이 있으면 수정, 없으면 신규. */
  initial?: z.infer<S> | null;
  onClose: () => void;
  onSubmit: (values: z.infer<S>) => void;
  width?: number;
}

/** 설정 기반 제네릭 CRUD 폼 모달 (RHF + Zod). 필드 배열로 폼을 렌더. */
export function CrudFormModal<S extends z.ZodType>({
  open,
  titleAdd,
  titleEdit,
  schema,
  fields,
  empty,
  initial,
  onClose,
  onSubmit,
  width = 520,
}: CrudFormModalProps<S>) {
  // 제네릭 스키마(z.infer<S>)는 FieldValues 제약을 직접 만족하지 못하므로
  // 내부는 FieldValues 로 다루고 공개 경계(props/onSubmit)에서만 캐스팅한다.
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as Resolver<FieldValues>,
    defaultValues: empty as DefaultValues<FieldValues>,
  });

  useEffect(() => {
    if (!open) return;
    reset((initial ?? empty) as FieldValues);
  }, [open, initial, empty, reset]);

  const submit = handleSubmit((values) => {
    onSubmit(values as z.infer<S>);
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? titleEdit : titleAdd}
      width={width}
      footer={
        <>
          <ActionButton icon="refresh" label="취소" onClick={onClose} />
          <ActionButton
            icon="save"
            label="저장"
            variant="primary"
            onClick={submit}
            disabled={isSubmitting}
          />
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        {fields.map((f) => {
          const err = errors[f.name as keyof typeof errors] as { message?: string } | undefined;
          return (
            <div key={f.name} className={f.colSpan === 2 ? 'col-span-2' : ''}>
              <Field label={f.label} required={f.required} error={err?.message}>
                {f.type === 'select' ? (
                  <SelectField {...register(f.name)} invalid={!!err} options={f.options ?? []} />
                ) : (
                  <TextField {...register(f.name)} invalid={!!err} placeholder={f.placeholder} />
                )}
              </Field>
            </div>
          );
        })}
      </form>
    </Modal>
  );
}
