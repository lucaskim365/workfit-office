import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useUploadAvatar } from '@/features/user/useUploadAvatar';
import MobileCommonHeader from './MobileCommonHeader';
import PersonalInfoCard from './profile/PersonalInfoCard';
import SignCard from './profile/SignCard';
import { Card, Feedback, dangerOutlineButton, inputClass, labelClass, outlineButton, saveButton } from './profile/shared';

const PASSWORD_RULE = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{9,}$/;

/**
 * PWA 내 프로필 — 웹 프로필 설정(/profile)과 같은 항목·저장 경로.
 * 업무 이메일은 로그인 ID라 잘못 바꾸면 로그인이 꼬일 수 있어 PWA에서는 보기만 한다(변경은 웹에서).
 */
export default function MobileProfileScreen() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader title="내 프로필" />
      <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <BasicInfoCard />
        <PersonalInfoCard user={user} />
        <PasswordCard />
        <SignCard user={user} />
      </div>
    </div>
  );
}

function BasicInfoCard() {
  const { user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const { upload, uploading } = useUploadAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  if (!user) return null;
  const busy = uploading || saving;

  const save = async (work: () => Promise<void>, done: string, failed: string) => {
    setSaving(true); setMsg(''); setErr('');
    try {
      await work();
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setMsg(done);
    } catch (e) {
      setErr(e instanceof Error ? e.message : failed);
    } finally {
      setSaving(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg(''); setErr('파일이 너무 큽니다. 5MB 이내로 선택하세요.'); return; }
    void save(async () => { await updateProfile({ photoUrl: await upload(user.id, file) }); }, '프로필 사진이 저장되었습니다.', '업로드에 실패했습니다.');
  };

  const handleDelete = () => {
    if (!window.confirm('프로필 사진을 삭제하시겠습니까?')) return;
    void save(() => updateProfile({ photoUrl: '' }), '프로필 사진이 삭제되었습니다.', '삭제에 실패했습니다.');
  };

  const rows: Array<[string, string]> = [
    ['사번', user.empNo],
    ['부서', user.dept],
    ['직급', user.position],
    ['직책', user.jobTitle || '—'],
  ];

  return (
    <Card title="기본 정보">
      <div className="flex items-center gap-4 border-b border-border/60 pb-4">
        <button
          type="button"
          aria-label="프로필 사진 변경"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="relative h-[72px] w-[72px] shrink-0 rounded-full disabled:opacity-60"
        >
          <span className="grid h-full w-full place-items-center overflow-hidden rounded-full border border-border bg-panel-alt">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="프로필 사진" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[19px] font-black text-ink3">{user.name ? user.name.slice(-2) : 'WF'}</span>
            )}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-teal text-white"><Camera size={12} /></span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-ink">{user.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={outlineButton}>
              {busy ? '저장 중…' : user.photoUrl ? '사진 변경' : '사진 등록'}
            </button>
            {user.photoUrl && <button type="button" disabled={busy} onClick={handleDelete} className={dangerOutlineButton}>삭제</button>}
          </div>
        </div>
      </div>
      {(msg || err) && <div className="pt-3"><Feedback msg={msg} err={err} /></div>}

      <dl className="mt-1 divide-y divide-border/60">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3 py-2.5">
            <dt className="w-16 shrink-0 text-[11.5px] font-bold text-ink3">{label}</dt>
            <dd className="min-w-0 flex-1 break-words text-[12.5px] font-semibold text-ink">{value || '—'}</dd>
          </div>
        ))}
        <div className="flex gap-3 py-2.5">
          <dt className="w-16 shrink-0 text-[11.5px] font-bold text-ink3">업무 이메일</dt>
          <dd className="min-w-0 flex-1">
            <p className="break-all text-[12.5px] font-semibold text-ink">{user.email}</p>
            <p className="mt-0.5 text-[10.5px] text-ink3">로그인 ID라 변경은 웹 프로필 설정에서 할 수 있습니다.</p>
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function PasswordCard() {
  const { changePassword } = useAuth();
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(''); setErr('');
    if (!curPw) { setErr('현재 비밀번호를 입력하세요.'); return; }
    if (!PASSWORD_RULE.test(newPw)) { setErr('비밀번호는 영문자, 숫자, 특수기호가 포함된 9자 이상이어야 합니다.'); return; }
    if (newPw !== confirmPw) { setErr('새 비밀번호가 일치하지 않습니다.'); return; }
    setSaving(true);
    try {
      await changePassword(curPw, newPw);
      setCurPw(''); setNewPw(''); setConfirmPw('');
      setMsg('비밀번호가 변경되었습니다.');
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : '변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<[string, string, (v: string) => void, string]> = [
    ['현재 비밀번호', curPw, setCurPw, 'current-password'],
    ['새 비밀번호', newPw, setNewPw, 'new-password'],
    ['새 비밀번호 확인', confirmPw, setConfirmPw, 'new-password'],
  ];

  return (
    <Card title="비밀번호 변경">
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        {fields.map(([label, value, setter, autoComplete]) => (
          <label key={label} className={labelClass}>
            {label}
            <input type="password" autoComplete={autoComplete} value={value} disabled={saving} onChange={(e) => setter(e.target.value)} className={inputClass} />
          </label>
        ))}
        <p className="text-[10.5px] text-ink3">영문자, 숫자, 특수기호를 포함해 9자 이상</p>
        <Feedback msg={msg} err={err} />
        <button type="submit" disabled={saving} className={saveButton}>{saving ? '변경 중…' : '비밀번호 변경'}</button>
      </form>
    </Card>
  );
}
