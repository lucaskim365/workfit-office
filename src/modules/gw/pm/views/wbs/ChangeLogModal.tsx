import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import type { PmDerived } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';
import { EmptyHint, ProjectTag, Tag } from './parts';

/** 변경 이력 (wbsLogModal 6549) — 최근 것부터. 사업 화면에서 열면 그 사업만 */
export function ChangeLogModal({ d, people, shortOf, projectId, onClose }: {
  d: PmDerived;
  people: ReturnType<typeof usePmPeople>;
  shortOf: (id: string) => string;
  projectId: string;
  onClose: () => void;
}) {
  const L = [...d.snap.logs].reverse().filter((l) => projectId === 'all' || l.projectId === projectId);
  return (
    <Modal open onClose={onClose} width={860} title={`🕘 변경 이력 — ${L.length}건${projectId !== 'all' ? ` (${shortOf(projectId)})` : ''}`} footer={<Button onClick={onClose}>닫기</Button>}>
      {L.length ? (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] text-ink3">
                <th className="py-1.5 pr-2">일자</th><th className="pr-2">작업자</th><th className="pr-2">사업</th><th className="pr-2">번호</th><th className="pr-2">구분</th><th>내용</th>
              </tr>
            </thead>
            <tbody>
              {L.map((l) => (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap py-1.5 pr-2">{l.date}</td>
                  <td className="whitespace-nowrap pr-2">{people.nameOf(l.by) || '-'}</td>
                  <td className="pr-2"><ProjectTag>{shortOf(l.projectId)}</ProjectTag></td>
                  <td className="whitespace-nowrap pr-2">{l.code}</td>
                  <td className="pr-2"><Tag tone={l.kind === '추가' ? 'ok' : l.kind === '삭제' ? 'bad' : 'run'}>{l.kind}</Tag></td>
                  <td className="text-ink2">{l.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyHint title="아직 변경 이력이 없습니다" hint="업무를 추가·수정하거나 진행률을 기록하면 여기에 남습니다. (옮기기 전 데모의 변경 이력은 '이관 전 기록'으로 따로 보관 — 지금 NAS 기록은 0건)" />
      )}
    </Modal>
  );
}
