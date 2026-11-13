import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Pill';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import { nextOrder, sortMasters, validateMasterName } from '@/domain/company/masters';
import { BizEmptyRow, BizListCard, bizTd, bizTh } from '../_biz';

export interface MasterRow {
  id: string;
  name: string;
  order: number;
  use: boolean;
  note: string;
  singlePerProject?: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

/**
 * 기준정보 목록(기업분류·사업구분 공용) — 목록 + 추가·수정 창. 지우지 않고 '사용 안 함'.
 * `withSingle` 이면 '프로젝트당' 칸(한 곳만 / 여러 곳)을 함께 다룬다(기업분류).
 */
export function MasterListView<T extends MasterRow>({
  head,
  label,
  rows,
  isLoading,
  canEdit,
  withSingle = false,
  newRow,
  onSave,
}: {
  head: ReactNode;
  label: string;
  rows: T[];
  isLoading: boolean;
  canEdit: boolean;
  withSingle?: boolean;
  newRow: (order: number) => T;
  onSave: (input: { item: T; isNew: boolean }) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState<{ item: T; isNew: boolean } | null>(null);
  const list = sortMasters(rows);
  const cols = ['No.', `${label} 이름`, ...(withSingle ? ['프로젝트당'] : []), '순서', '메모', '사용', ...(canEdit ? ['관리'] : [])];

  return (
    <div className="flex flex-col gap-4">
      {head}
      <BizListCard
        title={`${label} 목록`}
        count={
          <span className="flex items-center gap-3">
            <span>사용 {rows.filter((r) => r.use).length} · 사용 안 함 {rows.filter((r) => !r.use).length}</span>
            {canEdit && <Button size="sm" variant="accent" onClick={() => setEditing({ item: newRow(nextOrder(rows)), isNew: true })}><Plus size={12} /> {label} 추가</Button>}
          </span>
        }
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>{cols.map((h, i) => <th key={h} className={`${bizTh} ${i === 0 || ['프로젝트당', '순서', '사용', '관리'].includes(h) ? 'text-center' : ''}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {isLoading && <BizEmptyRow colSpan={cols.length}>불러오는 중…</BizEmptyRow>}
            {!isLoading && list.length === 0 && <BizEmptyRow colSpan={cols.length}>등록된 {label}이 없습니다.</BizEmptyRow>}
            {list.map((r, i) => (
              <tr key={r.id} className={r.use ? '' : '[&_td]:opacity-60'}>
                <td className={`${bizTd} text-center text-ink3`}>{i + 1}</td>
                <td className={`${bizTd} font-bold text-ink`}>{r.name}</td>
                {withSingle && (
                  <td className={`${bizTd} text-center`}>
                    <Pill tone={r.singlePerProject ? 'info' : 'mute'}>{r.singlePerProject ? '한 곳만' : '여러 곳'}</Pill>
                  </td>
                )}
                <td className={`${bizTd} text-center text-ink2`}>{r.order}</td>
                <td className={`${bizTd} text-ink3`}>{r.note || '-'}</td>
                <td className={`${bizTd} text-center`}><Pill tone={r.use ? 'ok' : 'mute'}>{r.use ? '사용' : '사용 안 함'}</Pill></td>
                {canEdit && (
                  <td className={`${bizTd} text-center`}>
                    <Button size="sm" onClick={() => setEditing({ item: r, isNew: false })}>수정</Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </BizListCard>

      {editing && (
        <MasterForm
          key={editing.item.id}
          label={label}
          initial={editing.item}
          isNew={editing.isNew}
          all={rows}
          withSingle={withSingle}
          onClose={() => setEditing(null)}
          onSave={async (item) => { await onSave({ item, isNew: editing.isNew }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function MasterForm<T extends MasterRow>({
  label,
  initial,
  isNew,
  all,
  withSingle,
  onClose,
  onSave,
}: {
  label: string;
  initial: T;
  isNew: boolean;
  all: T[];
  withSingle: boolean;
  onClose: () => void;
  onSave: (item: T) => Promise<void>;
}) {
  const [form, setForm] = useState<T>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof T>(k: K, v: T[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const errs = validateMasterName(form.name, all, label, isNew ? undefined : form.id);
    if (!Number.isInteger(form.order) || form.order < 0) errs.push('순서는 0 이상의 정수입니다.');
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try {
      await onSave({ ...form, note: form.note.trim() });
    } catch {
      setErrors(['저장하지 못했습니다. 잠시 뒤 다시 시도하세요.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? `${label} 추가` : `${label} 수정`}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="col-span-2">
          <Field label={`${label} 이름`} required>
            <TextField value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={64} className="w-full" autoFocus />
          </Field>
        </div>
        {withSingle && (
          <div className="col-span-2">
            <Field label="프로젝트당">
              <SelectField
                value={form.singlePerProject ? 'one' : 'many'}
                onChange={(e) => set('singlePerProject', (e.target.value === 'one') as T['singlePerProject'])}
                options={[{ value: 'one', label: '한 곳만' }, { value: 'many', label: '여러 곳' }]}
              />
            </Field>
          </div>
        )}
        <Field label="순서">
          <TextField type="number" value={String(form.order)} onChange={(e) => set('order', Number(e.target.value))} min={0} step={10} />
        </Field>
        <Field label="사용 여부">
          <SelectField value={form.use ? 'Y' : 'N'} onChange={(e) => set('use', e.target.value === 'Y')} options={[{ value: 'Y', label: '사용' }, { value: 'N', label: '사용 안 함' }]} />
        </Field>
        <div className="col-span-2">
          <Field label="메모">
            <TextField value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={200} className="w-full" />
          </Field>
        </div>
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-danger/10 px-3 py-2 text-[11.5px] font-semibold text-danger">
          {errors.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </Modal>
  );
}
