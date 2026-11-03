import { useState } from 'react';
import type { User } from '@/domain/user/schema';
import type { EmployeeProfile } from '@/domain/employeeProfile/schema';
import { useEmployeeProfiles, useUpdateMyEmployeeProfile } from '@/features/employeeProfile/useEmployeeProfiles';
import { calendarToday } from '@/domain/calendarEvent/calendarDate';
import { describeBirthday } from '@/domain/birthday/engine';
import { Card, Feedback, inputClass, labelClass, saveButton } from './shared';

/** 인사 정보(본인 입력) — 웹 MyPersonalInfoSection과 같은 저장 경로. 칸을 비우고 저장하면 그 항목이 지워진다. */
export default function PersonalInfoCard({ user }: { user: User }) {
  const { data: profiles, isLoading } = useEmployeeProfiles();
  const mine = profiles?.find((p) => p.userId === user.id || p.id === user.id) ?? null;
  return (
    <Card title="인사 정보" hint="인명관리에 반영됩니다">
      {isLoading || !profiles ? (
        <p className="text-[11.5px] text-ink3">불러오는 중…</p>
      ) : (
        // 저장 후 다시 읽힌 값으로 폼을 새로 채운다
        <PersonalInfoForm key={mine?.updatedAt ?? 'new'} user={user} profile={mine} />
      )}
    </Card>
  );
}

function PersonalInfoForm({ user, profile }: { user: User; profile: EmployeeProfile | null }) {
  const update = useUpdateMyEmployeeProfile();
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [personalEmail, setPersonalEmail] = useState(profile?.personalEmail ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergencyPhone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [birthLunar, setBirthLunar] = useState(profile?.birthLunar ?? false);
  const [birthdayPublic, setBirthdayPublic] = useState(profile?.birthdayPublic ?? true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const busy = update.isPending;

  const birthdayText = describeBirthday({ birthDate, birthLunar }, calendarToday());

  const save = async () => {
    setMsg(''); setErr('');
    if (personalEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail.trim())) {
      setErr('개인 이메일 형식이 올바르지 않습니다.');
      return;
    }
    try {
      await update.mutateAsync({
        me: { id: user.id, empNo: user.empNo, name: user.name, dept: user.dept, position: user.position, jobTitle: user.jobTitle },
        patch: {
          phone: phone.trim(),
          personalEmail: personalEmail.trim(),
          emergencyPhone: emergencyPhone.trim(),
          address: address.trim(),
          birthDate,
          birthLunar,
          birthdayPublic,
        },
      });
      setMsg('인사 정보가 저장되었습니다.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-3">
      <label className={labelClass}>
        연락처
        <input type="tel" inputMode="tel" value={phone} disabled={busy} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className={inputClass} />
      </label>
      <label className={labelClass}>
        비상 연락처
        <input type="tel" inputMode="tel" value={emergencyPhone} disabled={busy} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="010-0000-0000" className={inputClass} />
      </label>
      <label className={labelClass}>
        개인 이메일
        <input type="email" inputMode="email" value={personalEmail} disabled={busy} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="name@example.com" className={inputClass} />
      </label>
      <label className={labelClass}>
        주소
        <input type="text" value={address} disabled={busy} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </label>

      <div>
        <label className={labelClass}>
          생년월일
          <input type="date" value={birthDate} disabled={busy} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-ink">
            <input type="checkbox" checked={birthLunar} disabled={busy} onChange={(e) => setBirthLunar(e.target.checked)} className="h-4 w-4 accent-teal" />
            음력
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-ink">
            <input type="checkbox" checked={birthdayPublic} disabled={busy} onChange={(e) => setBirthdayPublic(e.target.checked)} className="h-4 w-4 accent-teal" />
            생일 공개
          </label>
          {birthDate && (
            <button type="button" disabled={busy} onClick={() => setBirthDate('')} className="ml-auto text-[11.5px] font-semibold text-ink3">
              날짜 지우기
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink3">
          {birthdayText ? `생일: ${birthdayText}. ` : ''}
          음력이면 매년 양력 날짜로 바꿔 계산합니다. 공개를 끄면 생일 알림·게시에서 빠집니다.
        </p>
      </div>

      <Feedback msg={msg} err={err} />
      <button type="button" disabled={busy} onClick={() => void save()} className={saveButton}>
        {busy ? '저장 중…' : '인사 정보 저장'}
      </button>
    </div>
  );
}
