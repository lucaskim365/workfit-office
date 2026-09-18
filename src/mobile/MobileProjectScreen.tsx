import { useState, useMemo } from 'react';
import {
  FolderGit2,
  Calendar,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useProjects } from '@/features/project/useProjects';
import type { WorkProject } from '@/domain/workProject/schema';
import MobileCommonHeader from './MobileCommonHeader';

export default function MobileProjectScreen() {
  const { user } = useAuth();
  const [statusTab, setStatusTab] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [selectedProject, setSelectedProject] = useState<WorkProject | null>(null);

  const projectsQuery = useProjects({
    userId: user?.id || 'guest',
    deptId: user?.dept || null,
    active: user?.status === '사용',
  });
  const projects = projectsQuery.data ?? [];

  const filteredProjects = useMemo(() => {
    if (statusTab === 'ALL') return projects;
    return projects.filter((p) => (statusTab === 'ACTIVE' ? p.status === 'ACTIVE' : p.status === 'COMPLETED'));
  }, [projects, statusTab]);

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader title="프로젝트" subtitle={`총 ${filteredProjects.length}개`} />

      {/* 1. 상태 탭 */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 bg-white/70 border-b border-border/50 shrink-0">
        <button
          type="button"
          onClick={() => setStatusTab('ACTIVE')}
          className={`rounded-xl px-3 py-1 text-[11px] font-bold transition-all ${
            statusTab === 'ACTIVE'
              ? 'bg-teal text-white shadow-xs'
              : 'bg-white text-ink3 hover:bg-panel-alt border border-border/80'
          }`}
        >
          진행 중 ({projects.filter((p) => p.status === 'ACTIVE').length})
        </button>
        <button
          type="button"
          onClick={() => setStatusTab('ALL')}
          className={`rounded-xl px-3 py-1 text-[11px] font-bold transition-all ${
            statusTab === 'ALL'
              ? 'bg-teal text-white shadow-xs'
              : 'bg-white text-ink3 hover:bg-panel-alt border border-border/80'
          }`}
        >
          전체 ({projects.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusTab('COMPLETED')}
          className={`rounded-xl px-3 py-1 text-[11px] font-bold transition-all ${
            statusTab === 'COMPLETED'
              ? 'bg-teal text-white shadow-xs'
              : 'bg-white text-ink3 hover:bg-panel-alt border border-border/80'
          }`}
        >
          완료 ({projects.filter((p) => p.status === 'COMPLETED').length})
        </button>
      </div>

      {/* 2. 프로젝트 목록 */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
        {filteredProjects.length === 0 ? (
          <div className="py-16 text-center text-ink3 border border-dashed border-border/80 rounded-2xl bg-white/60">
            <FolderGit2 size={28} className="mx-auto mb-1.5 text-ink3/40" />
            <p className="text-[12px] font-bold text-ink">프로젝트가 없습니다.</p>
            <p className="text-[10.5px] text-ink3 mt-0.5">참여 중인 프로젝트가 없거나 분류에 맞는 내역이 없습니다.</p>
          </div>
        ) : (
          filteredProjects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => setSelectedProject(proj)}
              className="rounded-2xl border border-border/80 bg-white p-3.5 shadow-2xs hover:border-teal/50 transition-all cursor-pointer active:scale-98 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                    proj.status === 'ACTIVE'
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : 'bg-panel-alt text-ink3'
                  }`}
                >
                  {proj.status === 'ACTIVE' ? '진행 중' : '완료됨'}
                </span>

                <span className="text-[10.5px] text-ink3 font-mono">
                  {proj.code}
                </span>
              </div>

              <h3 className="text-[13.5px] font-bold text-ink leading-snug">
                {proj.name}
              </h3>

              {proj.description && (
                <p className="text-[11px] text-ink3 line-clamp-2 leading-relaxed">
                  {proj.description}
                </p>
              )}

              <div className="flex items-center justify-between text-[11px] text-ink3 pt-1 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-teal" />
                  <span>{(proj.startAt ? proj.startAt.slice(0, 10) : '-') + ' ~ ' + (proj.dueAt ? proj.dueAt.slice(0, 10) : '-')}</span>
                </div>

                <div className="flex items-center gap-1">
                  <User size={12} className="text-ink3" />
                  <span>{proj.ownerUserId}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. 프로젝트 상세 모달 */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in slide-in-from-bottom duration-200">
          <header className="flex items-center justify-between border-b border-border px-3 py-3 shrink-0 bg-[#101830] text-white">
            <span className="text-[13px] font-bold truncate">프로젝트 상세</span>
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 text-white"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5" style={{ background: '#f2f8fc' }}>
            <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs space-y-3">
              <div className="space-y-1.5 border-b border-border/60 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-teal/15 px-1.5 py-0.2 text-[10px] font-bold text-teal">
                    {selectedProject.code}
                  </span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600">
                    {selectedProject.status === 'ACTIVE' ? '진행 중' : '완료됨'}
                  </span>
                </div>
                <h2 className="text-[16px] font-black text-ink">{selectedProject.name}</h2>
                <p className="text-[11px] text-ink3">
                  기간: {(selectedProject.startAt ? selectedProject.startAt.slice(0, 10) : '-') + ' ~ ' + (selectedProject.dueAt ? selectedProject.dueAt.slice(0, 10) : '-')}
                </p>
              </div>

              {selectedProject.description && (
                <div className="rounded-xl bg-panel-alt/50 p-3 text-[12px] text-ink2 leading-relaxed">
                  {selectedProject.description}
                </div>
              )}

              <div className="space-y-2 pt-1 text-[12px]">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-ink3 font-medium">프로젝트 책임자 ID</span>
                  <span className="font-bold text-ink">{selectedProject.ownerUserId}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-ink3 font-medium">공개 범위</span>
                  <span className="font-bold text-ink">{selectedProject.visibility}</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="w-full rounded-xl bg-teal py-2.5 text-[12px] font-bold text-white shadow-xs hover:opacity-90"
                >
                  확인 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
