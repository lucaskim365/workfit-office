import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/auth/AuthProvider';
import type { User } from '@/domain/user/schema';
import { useUploadSeal } from '@/features/user/useUploadSeal';
import SignaturePad from '@/modules/profile/components/SignaturePad';
import { Card, Feedback, dangerOutlineButton, outlineButton } from './shared';

/** 결재 인증 설정 — 웹 프로필 설정과 같은 저장 경로(도장·서명 업로드 후 사용자 정보에 URL 저장). */
export default function SignCard({ user }: { user: User }) {
  const { updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const { upload, uploading } = useUploadSeal();
  const sealInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const busy = uploading || saving;
  const usesStamp = user.signType !== 'signature';

  // 저장 → 사용자 목록 새로고침 → 결과 안내까지 한 흐름으로 묶는다.
  const run = async (work: () => Promise<void>, done: string, failed: string) => {
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

  const changeType = (type: 'stamp' | 'signature') => {
    if ((type === 'stamp') === usesStamp) return;
    void run(() => updateProfile({ signType: type }), type === 'stamp' ? '인감(도장)을 사용합니다.' : '수필 서명을 사용합니다.', '설정 변경에 실패했습니다.');
  };

  const handleSealFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg(''); setErr('파일이 너무 큽니다. 5MB 이내로 선택하세요.'); return; }
    void run(async () => { await updateProfile({ sealUrl: await upload(user.id, file) }); }, '인감 이미지가 저장되었습니다.', '업로드에 실패했습니다.');
  };

  const deleteSeal = () => {
    if (!window.confirm('인감 이미지를 삭제하시겠습니까?')) return;
    void run(() => updateProfile({ sealUrl: '' }), '인감 이미지가 삭제되었습니다.', '삭제에 실패했습니다.');
  };

  const saveSignature = (file: File) => {
    void run(async () => { await updateProfile({ signUrl: await upload(user.id, file) }); }, '서명이 저장되었습니다.', '서명 저장에 실패했습니다.');
  };

  const deleteSignature = () => {
    if (!window.confirm('등록된 서명을 삭제하시겠습니까?')) return;
    void run(() => updateProfile({ signUrl: '' }), '서명이 삭제되었습니다.', '서명 삭제에 실패했습니다.');
  };

  return (
    <Card title="결재 인증 설정">
      <p className="mb-3 text-[11px] leading-relaxed text-ink3">전자결재 문서 서명란에 표시될 인증 수단을 고르고 등록합니다.</p>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-panel-alt p-1" role="radiogroup" aria-label="결재 인증 수단">
        {([['stamp', '인감(도장)'], ['signature', '수필 서명']] as const).map(([type, label]) => {
          const selected = (type === 'stamp') === usesStamp;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => changeType(type)}
              className={`rounded-lg py-2 text-[12px] font-bold disabled:opacity-60 ${selected ? 'bg-white text-teal shadow-2xs' : 'text-ink3'}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {usesStamp ? (
        <div className="flex items-center gap-4">
          <div className="grid h-[96px] w-[96px] shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-panel-alt text-center">
            {user.sealUrl ? (
              <img src={user.sealUrl} alt="인감" className="h-full w-full object-contain" />
            ) : (
              <div className="space-y-1">
                <div className="mx-auto grid h-[52px] w-[52px] place-items-center rounded-full border-2 border-[#c0392b] text-[12px] font-bold text-[#c0392b]">{user.name.slice(-2)}</div>
                <div className="text-[9px] text-ink3">미등록</div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={sealInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSealFile} />
            <button type="button" disabled={busy} onClick={() => sealInputRef.current?.click()} className={outlineButton}>
              {busy ? '저장 중…' : user.sealUrl ? '이미지 변경' : '이미지 등록'}
            </button>
            {user.sealUrl && <button type="button" disabled={busy} onClick={deleteSeal} className={dangerOutlineButton}>이미지 삭제</button>}
          </div>
        </div>
      ) : user.signUrl ? (
        <div className="flex items-center gap-3">
          <div className="grid h-[90px] min-w-0 flex-1 place-items-center overflow-hidden rounded-xl border border-border bg-panel-alt">
            <img src={user.signUrl} alt="등록된 서명" className="h-full w-full object-contain" />
          </div>
          <button type="button" disabled={busy} onClick={deleteSignature} className={`${dangerOutlineButton} shrink-0`}>서명 삭제</button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-[11px] text-ink3">아래 빈 칸에 손가락으로 서명을 그려 등록하세요.</p>
          <SignaturePad onSave={saveSignature} saving={busy} />
        </div>
      )}

      <div className="mt-3"><Feedback msg={msg} err={err} /></div>
    </Card>
  );
}
