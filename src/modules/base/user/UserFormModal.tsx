import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { ActionButton } from '@/shared/ui/ActionBar';
import { USER_STATUS, userFormSchema, DEFAULT_USER_PASSWORD, type User, type UserFormValues } from '@/domain/user/schema';

export type { UserFormValues };

const EMPTY: UserFormValues = {
  empNo: '',
  name: '',
  dept: '미지정',
  position: '사원',
  jobTitle: '',
  email: '',
  status: '사용',
  password: '',
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
    resolver: zodResolver(userFormSchema) as any,
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      initial
        ? {
            empNo: initial.empNo,
            name: initial.name,
            dept: initial.dept || '미지정',
            position: initial.position || '사원',
            jobTitle: initial.jobTitle ?? '',
            email: initial.email,
            status: initial.status,
            password: '', // 수정 시 항상 빈칸(비우면 기존 비번 보존)
          }
        : EMPTY,
    );
  }, [open, initial, reset]);

  const submit = handleSubmit((values: UserFormValues) => {
    // 인사정보(부서, 직급, 직책)는 임직원 관리에서 발령하므로 기존 값 보존
    const finalPayload: UserFormValues = {
      empNo: values.empNo,
      name: values.name,
      email: values.email,
      status: values.status,
      password: values.password,
      dept: initial?.dept || values.dept || '미지정',
      position: initial?.position || values.position || '사원',
      jobTitle: initial?.jobTitle || values.jobTitle || '',
    };
    onSubmit(finalPayload, initial?.id);
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '사용자 계정 수정' : '사용자 계정 생성'}
      width={460}
      footer={
        <>
          <ActionButton icon="refresh" label="취소" onClick={onClose} />
          <ActionButton icon="save" label="저장" variant="primary" onClick={submit} disabled={isSubmitting} />
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="사번 (ID)" required error={errors.empNo?.message}>
            <TextField {...register('empNo')} invalid={!!errors.empNo} placeholder="A00000" />
          </Field>
          <Field label="이름" required error={errors.name?.message}>
            <TextField {...register('name')} invalid={!!errors.name} placeholder="홍길동" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="이메일" required error={errors.email?.message}>
            <TextField {...register('email')} invalid={!!errors.email} placeholder="user@workfit.co.kr" />
          </Field>
          <Field label="계정 상태" required error={errors.status?.message}>
            <SelectField
              {...register('status')}
              invalid={!!errors.status}
              options={USER_STATUS.map((s) => ({ value: s, label: s }))}
            />
          </Field>
        </div>

        <Field label={initial ? '비밀번호 변경' : '초기 비밀번호'} error={errors.password?.message}>
          <TextField
            type="password"
            autoComplete="new-password"
            {...register('password')}
            invalid={!!errors.password}
            placeholder={initial ? '변경 시에만 입력 (비우면 기존 유지)' : `비우면 기본값 ${DEFAULT_USER_PASSWORD}`}
          />
        </Field>

        <div className="rounded-lg border border-border bg-panel-alt/40 p-3 text-[11px] text-ink3">
          💡 <strong>안내</strong>: 소속 부서, 직급, 직책 등 인사 정보는 <strong>[그룹웨어 &gt; 임직원 관리]</strong> 화면에서 정식 인사 발령할 수 있습니다.
        </div>
      </form>
    </Modal>
  );
}
