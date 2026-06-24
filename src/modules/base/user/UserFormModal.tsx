import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { ActionButton } from '@/shared/ui/ActionBar';
import { ROLE_GROUPS, USER_STATUS, userFormSchema, type User, type UserFormValues } from '@/domain/user/schema';

export type { UserFormValues };

const EMPTY: UserFormValues = {
  empNo: '',
  name: '',
  dept: '',
  position: '',
  roleGroup: 'OPERATOR',
  email: '',
  status: '사용',
};

interface UserFormModalProps {
  open: boolean;
  initial?: User | null;
  onClose: () => void;
  onSubmit: (values: UserFormValues, id?: string) => void;
}

export default function UserFormModal({ open, initial, onClose, onSubmit }: UserFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      initial
        ? {
            empNo: initial.empNo,
            name: initial.name,
            dept: initial.dept,
            position: initial.position,
            roleGroup: initial.roleGroup as UserFormValues['roleGroup'],
            email: initial.email,
            status: initial.status,
          }
        : EMPTY,
    );
  }, [open, initial, reset]);

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
          <TextField {...register('empNo')} invalid={!!errors.empNo} placeholder="A00000" />
        </Field>
        <Field label="이름" required error={errors.name?.message}>
          <TextField {...register('name')} invalid={!!errors.name} placeholder="홍길동" />
        </Field>
        <Field label="부서" required error={errors.dept?.message}>
          <TextField {...register('dept')} invalid={!!errors.dept} placeholder="생산1팀" />
        </Field>
        <Field label="직책" required error={errors.position?.message}>
          <TextField {...register('position')} invalid={!!errors.position} placeholder="담당" />
        </Field>
        <Field label="권한그룹" required error={errors.roleGroup?.message}>
          <SelectField
            {...register('roleGroup')}
            invalid={!!errors.roleGroup}
            options={ROLE_GROUPS.map((r) => ({ value: r, label: r }))}
          />
        </Field>
        <Field label="상태" required error={errors.status?.message}>
          <SelectField
            {...register('status')}
            invalid={!!errors.status}
            options={USER_STATUS.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <div className="col-span-2">
          <Field label="이메일" required error={errors.email?.message}>
            <TextField {...register('email')} invalid={!!errors.email} placeholder="user@workfit.co.kr" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
