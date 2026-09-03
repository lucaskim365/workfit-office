import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/shared/ui/Modal';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { ActionButton } from '@/shared/ui/ActionBar';
import { USER_STATUS, userFormSchema, DEFAULT_USER_PASSWORD, type User, type UserFormValues } from '@/domain/user/schema';
import { usePositions } from '@/features/position/usePositions';
import { useJobTitles } from '@/features/jobTitle/useJobTitles';
import { useUsers } from '@/features/user/useUsers';
import { useDepartments } from '@/features/department/useDepartments';


export type { UserFormValues };

const EMPTY: UserFormValues = {
  empNo: '',
  name: '',
  dept: '',
  position: '',
  jobTitle: '',
  roleGroup: 'OPERATOR',
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
  const { data: users = [] } = useUsers();
  const { data: positions = [] } = usePositions();
  const { data: jobTitles = [] } = useJobTitles();
  const { data: departments = [] } = useDepartments();


  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: EMPTY,
  });

  const selectedDeptName = watch('dept');
  const selectedDeptObj = departments.find((d) => d.name === selectedDeptName);
  const headUser = selectedDeptObj?.headUserId ? users.find((u) => u.id === selectedDeptObj.headUserId) : null;
  const isSelfHead = Boolean(initial?.id && selectedDeptObj?.headUserId === initial.id);

  useEffect(() => {
    if (!open) return;
    reset(
      initial
        ? {
            empNo: initial.empNo,
            name: initial.name,
            dept: initial.dept,
            position: initial.position,
            jobTitle: initial.jobTitle ?? '',
            roleGroup: initial.roleGroup as UserFormValues['roleGroup'],
            email: initial.email,
            status: initial.status,
            password: '', // 수정 시 항상 빈칸(비우면 기존 비번 보존)
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
        <div className="col-span-2">
          <Field label="부서" required error={errors.dept?.message}>
            <SelectField
              {...register('dept')}
              invalid={!!errors.dept}
              options={[
                { value: '', label: '부서 선택' },
                ...departments.map((d) => ({ value: d.name, label: d.name }))
              ]}
            />
            {selectedDeptName && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px]">
                {isSelfHead ? (
                  <span className="rounded bg-teal-soft/30 px-1.5 py-0.5 font-bold text-teal">
                    해당 부서의 부서장으로 임명되어 있습니다 (부서 관리 연동)
                  </span>
                ) : headUser ? (
                  <span className="text-ink3">
                    소속 부서장: <strong className="text-ink2">{headUser.name}</strong> ({headUser.position || '팀장'})
                  </span>
                ) : (
                  <span className="text-ink3">소속 부서장: 미지정 (부서 관리에서 임명 가능)</span>
                )}
              </div>
            )}
          </Field>
        </div>

        <Field label="직급" required error={errors.position?.message}>
          <SelectField
            {...register('position')}
            invalid={!!errors.position}
            options={[{ value: '', label: '직급 선택' }, ...positions.map((p) => ({ value: p.name, label: p.name }))]}
          />
        </Field>
        <Field label="직책" error={errors.jobTitle?.message}>
          <SelectField
            {...register('jobTitle')}
            invalid={!!errors.jobTitle}
            options={[{ value: '', label: '직책 선택 (미지정)' }, ...jobTitles.map((j) => ({ value: j.name, label: j.name }))]}
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
        <div className="col-span-2">
          <Field label={initial ? '비밀번호 변경' : '초기 비밀번호'} error={errors.password?.message}>
            <TextField
              type="password"
              autoComplete="new-password"
              {...register('password')}
              invalid={!!errors.password}
              placeholder={initial ? '변경 시에만 입력 (비우면 기존 유지)' : `비우면 기본값 ${DEFAULT_USER_PASSWORD}`}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
