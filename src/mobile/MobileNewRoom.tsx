import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useCreateRoom } from '@/features/chat/useChatRooms';
import { useUsers } from '@/features/user/useUsers';
import { MobileMemberPicker } from './MobileMemberPicker';

/**
 * 모바일 새 대화 만들기 — 조직도에서 멤버 다중 선택.
 * 1명 선택 → 1:1(direct), 2명↑ → 그룹(group). 생성 후 해당 방으로 이동.
 */
export default function MobileNewRoom() {
  const { user } = useAuth();
  const me = user!.id;
  const nav = useNavigate();
  const { data: users = [] } = useUsers();
  const create = useCreateRoom();
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');

  const isGroup = selected.length >= 2;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const pickedNames = users.filter((u) => selected.includes(u.id)).map((u) => u.name);

  const submit = async () => {
    if (!selected.length || create.isPending) return;
    const roomName = isGroup ? (name.trim() || pickedNames.join(', ')) : (pickedNames[0] ?? '새 대화');
    const room = await create.mutateAsync({
      name: roomName,
      type: isGroup ? 'group' : 'direct',
      members: [me, ...selected],
    });
    nav(`/m/room/${room.id}`, { replace: true });
  };

  return (
    <div className="flex h-full flex-col" style={{ background: '#f2f8fc' }}>
      <header className="flex shrink-0 items-center gap-2 px-2 py-3 text-white" style={{ background: '#101830' }}>
        <button onClick={() => nav('/m')} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[18px] hover:bg-white/10">←</button>
        <span className="text-[15px] font-bold">새 대화</span>
        <button
          onClick={submit}
          disabled={!selected.length || create.isPending}
          className="ml-auto rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white transition-opacity disabled:opacity-40"
          style={{ background: '#4ea8de' }}
        >
          {create.isPending ? '생성 중…' : isGroup ? `그룹 만들기 (${selected.length})` : '대화 시작'}
        </button>
      </header>

      {isGroup && (
        <div className="shrink-0 border-b border-black/10 bg-white px-4 py-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={pickedNames.join(', ')}
            className="w-full rounded-lg border border-border px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink3 focus:border-amber"
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <MobileMemberPicker exclude={[me]} selected={selected} onToggle={toggle} />
      </div>
    </div>
  );
}
