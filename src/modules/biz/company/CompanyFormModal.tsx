import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/form/Field';
import { TextField } from '@/shared/ui/form/TextField';
import { SelectField } from '@/shared/ui/form/SelectField';
import {
  formatBizNo,
  newCompanyId,
  normalizeDefaultAccount,
  validateAccountDrafts,
  validateCompanyDraft,
  type AccountDraft,
  type Company,
  type CompanyBankAccount,
} from '@/domain/company/schema';
import { DuplicateBizNoError } from '@/data/company/company.repo';
import { useBankNames, useBankOptions, useSaveCompany } from '@/features/company/useCompanies';

type Row = AccountDraft & { k: string };
let seq = 0;
const key = () => `r${++seq}`;

const blankCompany = (): Company => ({
  id: newCompanyId(), name: '', bizNo: '', ceoName: '', phone: '', address: '', addressDetail: '', use: true, note: '',
  createdBy: '', createdAt: '', updatedBy: '', updatedAt: '',
});

/** 기업 등록·수정 — 기업 칸과 계좌 여러 줄을 한 번에 저장. `company` 가 없으면 신규. */
export function CompanyFormModal({
  company,
  accounts,
  allCompanies,
  actorId,
  onClose,
  onSaved,
  onOpenCompany,
}: {
  company: Company | null;
  /** 이 기업의 저장된 계좌(사용 안 함 포함). */
  accounts: CompanyBankAccount[];
  allCompanies: Company[];
  actorId: string;
  onClose: () => void;
  onSaved: (c: Company) => void;
  /** 중복 번호의 기존 기업 열기. */
  onOpenCompany: (id: string) => void;
}) {
  const isNew = company === null;
  const [form, setForm] = useState<Company>(() => (company ? { ...company, bizNo: formatBizNo(company.bizNo) } : blankCompany()));
  const [rows, setRows] = useState<Row[]>(() =>
    [...accounts]
      .sort((a, b) => Number(b.use) - Number(a.use) || Number(b.isDefault) - Number(a.isDefault))
      .map((a) => ({ k: key(), id: a.id, bankCode: a.bankCode, accountNo: a.accountNo, holder: a.holder, isDefault: a.isDefault, use: a.use, note: a.note })),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const save = useSaveCompany();
  const { data: banks = [] } = useBankOptions();
  const bankNames = useBankNames();

  const set = <K extends keyof Company>(k: K, v: Company[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setRow = (k: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.k === k ? { ...r, ...patch } : r)));
  const check = validateCompanyDraft(form, allCompanies, isNew ? undefined : form.id);
  const shown = useMemo(() => normalizeDefaultAccount(rows), [rows]);

  const addRow = () => setRows((rs) => [...rs, { k: key(), bankCode: '', accountNo: '', holder: form.name.trim(), isDefault: rs.every((r) => !r.use), use: true, note: '' }]);
  /** 저장 안 된 줄은 빼고, 저장된 줄은 사용 안 함으로(지우지 않음). */
  const dropRow = (r: Row) => (r.id ? setRow(r.k, { use: false, isDefault: false }) : setRows((rs) => rs.filter((x) => x.k !== r.k)));
  const pickDefault = (k: string) => setRows((rs) => rs.map((r) => ({ ...r, isDefault: r.k === k })));

  const submit = async () => {
    const errs = [...check.errors, ...validateAccountDrafts(rows)];
    setErrors(errs);
    if (errs.length) return;
    try {
      const saved = await save.mutateAsync({
        company: { ...form, ceoName: form.ceoName.trim(), phone: form.phone.trim(), address: form.address.trim(), addressDetail: form.addressDetail.trim(), note: form.note.trim() },
        isNew,
        accounts: rows.map(({ k: _k, ...d }) => d),
        existing: accounts,
        actorId,
      });
      onSaved(saved);
    } catch (e) {
      setErrors([e instanceof DuplicateBizNoError ? '이미 등록된 사업자등록번호입니다. 목록을 새로 불러온 뒤 다시 확인하세요.' : '저장하지 못했습니다. 잠시 뒤 다시 시도하세요.']);
    }
  };

  const bankOptions = (code: string) => {
    const opts = banks.map((b) => ({ value: b.code, label: b.name }));
    if (code && !opts.some((o) => o.value === code)) opts.push({ value: code, label: bankNames.get(code) ?? '선택한 은행' });
    return [{ value: '', label: '은행 선택' }, ...opts];
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? '기업 신규 등록' : '기업 정보 수정'}
      width={760}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={save.isPending}>{save.isPending ? '저장 중…' : '저장'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="기업명" required>
            <TextField value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={128} placeholder="예: 대성반도체(주)" />
          </Field>
          <Field label="사업자등록번호" required error={check.duplicate ? check.errors.find((m) => m.startsWith('이미')) : undefined} hint={check.warnings[0]}>
            <TextField
              value={form.bizNo}
              onChange={(e) => set('bizNo', e.target.value)}
              onBlur={() => set('bizNo', formatBizNo(form.bizNo))}
              invalid={Boolean(check.duplicate)}
              maxLength={20}
              placeholder="000-00-00000"
              className="font-mono"
            />
          </Field>
          {check.duplicate && (
            <div className="col-span-2 -mt-1 flex justify-end">
              <Button size="sm" onClick={() => onOpenCompany(check.duplicate!.id)}>등록된 기업 보기</Button>
            </div>
          )}
          <Field label="대표자">
            <TextField value={form.ceoName} onChange={(e) => set('ceoName', e.target.value)} maxLength={64} />
          </Field>
          <Field label="대표번호">
            <TextField value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={32} placeholder="예: 02-1234-5678" />
          </Field>
          <div className="col-span-2">
            <Field label="주소">
              <TextField value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={256} className="w-full" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="상세 주소">
              <TextField value={form.addressDetail} onChange={(e) => set('addressDetail', e.target.value)} maxLength={128} className="w-full" />
            </Field>
          </div>
          <Field label="사용 여부">
            <SelectField value={form.use ? 'Y' : 'N'} onChange={(e) => set('use', e.target.value === 'Y')} options={[{ value: 'Y', label: '사용' }, { value: 'N', label: '사용 안 함' }]} />
          </Field>
          <Field label="메모">
            <TextField value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={1000} />
          </Field>
        </div>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-extrabold text-ink">계좌</h3>
            <Button size="sm" onClick={addRow}><Plus size={12} /> 계좌 추가</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead>
                <tr className="bg-panel-alt/60 text-[11px] font-bold text-ink3 whitespace-nowrap">
                  <th className="px-2 py-2 text-center">기본</th>
                  <th className="px-2 py-2">은행</th>
                  <th className="px-2 py-2">계좌번호</th>
                  <th className="px-2 py-2">예금주</th>
                  <th className="px-2 py-2">메모</th>
                  <th className="px-2 py-2 text-center">사용</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-ink3">등록된 계좌가 없습니다.</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.k} className={`border-t border-border ${r.use ? '' : 'opacity-50'}`}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="radio" name="defaultAccount" aria-label="기본 계좌" checked={shown[i].isDefault} disabled={!r.use} onChange={() => pickDefault(r.k)} />
                    </td>
                    <td className="px-2 py-1.5 w-40">
                      <SelectField value={r.bankCode} onChange={(e) => setRow(r.k, { bankCode: e.target.value })} options={bankOptions(r.bankCode)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <TextField value={r.accountNo} onChange={(e) => setRow(r.k, { accountNo: e.target.value })} maxLength={32} className="w-full font-mono" placeholder="숫자와 -" />
                    </td>
                    <td className="px-2 py-1.5 w-32">
                      <TextField value={r.holder} onChange={(e) => setRow(r.k, { holder: e.target.value })} maxLength={64} className="w-full" />
                    </td>
                    <td className="px-2 py-1.5 w-32">
                      <TextField value={r.note} onChange={(e) => setRow(r.k, { note: e.target.value })} maxLength={200} className="w-full" placeholder="용도 등" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" aria-label="사용" checked={r.use} onChange={(e) => setRow(r.k, { use: e.target.checked })} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {(r.use || !r.id) && (
                        <button type="button" aria-label="계좌 빼기" title={r.id ? '사용 안 함으로' : '빼기'} onClick={() => dropRow(r)} className="rounded p-1 text-ink3 hover:bg-panel-alt hover:text-danger">
                          <X size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {errors.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg bg-danger/10 px-3 py-2 text-[11.5px] font-semibold text-danger">
            {errors.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
      </div>
    </Modal>
  );
}
