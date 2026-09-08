import { Camera, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

interface EmptyStateProps {
  keyword: string;
  onUpload: () => void;
  canCreate: boolean;
}

export function EmptyState({ keyword, onUpload, canCreate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-panel-alt/20 py-20 text-center">
      <Camera className="h-12 w-12 text-ink3/40 stroke-[1.2]" />
      <h3 className="mt-4 text-base font-bold text-ink">
        {keyword ? '검색 결과와 일치하는 사진이 없습니다.' : '이 영역에 등록된 사진이 없습니다.'}
      </h3>
      <p className="mt-1 text-[12px] text-ink3 max-w-sm">
        {keyword
          ? '다른 검색어로 다시 시도해보시거나 검색어를 초기화해보세요.'
          : '사진을 업로드하여 갤러리를 채워보세요.'}
      </p>
      {!keyword && canCreate && (
        <div className="mt-5">
          <Button size="md" variant="primary" onClick={onUpload}>
            <Plus className="h-4 w-4 mr-1" />
            <span>사진 올리기</span>
          </Button>
        </div>
      )}
    </div>
  );
}
