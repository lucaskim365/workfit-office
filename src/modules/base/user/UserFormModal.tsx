import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { ActionButton } from '@/shared/ui/ActionBar';
import type { User } from './mock';

const STATUS = ['활성', '휴직', '잠금'] as const;

const schema = z.object({
  empNo: z.string().min(1, '사번을 입력하세요').max(20, '사번이 너무 깁니다'),
  name: z.string().min(1, '이름을 입력하세요').max(30),
  dept: z.string().min(1, '부서를 선택하세요'),
  role: z.string().min(1, '역할을 입력하세요').max(40),
  email: z.string().min(1, '이메일을 입력하세요').email('올바른 이메일 형식이 아닙니다'),
  status: z.enum(STATUS),
});

export type UserFormValues = z.infer<typeof schema>;

const EMPTY: UserFormValues = {
  empNo: '',
  name: '',
  dept: '',
  role: '',
  email: '',
  status: '활성',
};

interface UserFormModalProps {
  open: boolean;
  /** 값이 있으면 수정, 없으면 신규. */
  initial?: User | null;
  deptOptions: string[];
  onClose: () => void;
  onSubmit: (values: UserFormValues, id?: string) => void;
}

export default function UserFormModal({
  open,
  initial,
  deptOptions,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  // 열릴 때마다 초기값 동기화
  useEffect(() => {
    if (!open) return;
    reset(
      initial
        ? {
            empNo: initial.empNo,
            name: initial.name,
            dept: initial.dept,
            role: initial.role,
            email: initial.email,
            status: initial.status,
          }
        : EMPTY,
    );
  }, [open, initial, reset]);

  const deptSelectOptions = [
    { value: '', label: '부서 선택' },
    ...deptOptions.map((d) => ({ value: d, label: d })),
  ];
  const statusOptions = STATUS.map((s) => ({ value: s, label: s }));

  const submit = handleSubmit((values) => {
    onSubmit(values, initial?.id);
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '사용자 수정' : '사용자 추가'}
      width={520}
      footer={
        <>
          <ActionButton icon="refresh" label="취소" onClick={onClose} />
          <ActionButton icon="save" label="저장" variant="primary" onClick={submit} disabled={isSubmitting} />
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Field label="사번" required error={errors.empNo?.message}>
          <TextField {...register('empNo')} invalid={!!errors.empNo} placeholder="E2024-001" />
        </Field>
        <Field label="이름" required error={errors.name?.message}>
          <TextField {...register('name')} invalid={!!errors.name} placeholder="홍길동" />
        </Field>
        <Field label="부서" required error={errors.dept?.message}>
          <SelectField {...register('dept')} invalid={!!errors.dept} options={deptSelectOptions} />
        </Field>
        <Field label="상태" required error={errors.status?.message}>
          <SelectField {...register('status')} invalid={!!errors.status} options={statusOptions} />
        </Field>
        <div className="col-span-2">
          <Field label="역할" required error={errors.role?.message}>
            <TextField {...register('role')} invalid={!!errors.role} placeholder="생산 관리자" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="이메일" required error={errors.email?.message}>
            <TextField
              {...register('email')}
              invalid={!!errors.email}
              placeholder="user@workfit.co.kr"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
