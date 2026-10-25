import type { ReactNode } from 'react';
import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';

/**
 * 회사 직인 — 결재 완료(stamped)이고 회사 정보에 직인이 등록돼 있으면 이미지, 아니면 흐린 "(직인)" 자리 표시.
 */
export function SealImage({ stamped, size = 64 }: { stamped: boolean; size?: number }) {
  const { data: info } = useCompanyInfo();
  const url = info?.sealUrl;
  if (stamped && url) {
    // maxWidth none — 글자 끝에 띄운 칸처럼 폭이 0인 곳에서도 공통 스타일(img max-width:100%)에 눌려 폭 0으로 사라지지 않게
    return (
      <img src={url} alt="회사 직인" style={{ width: size, height: size, maxWidth: 'none' }} className="shrink-0 object-contain" />
    );
  }
  return <span className="text-[12px] font-semibold text-[#bbb] select-none">(직인)</span>;
}

/** 직인 필드 — 라벨 문구(예: 주식회사 ○○ 대표이사 ○○○) 끝에 직인이 겹쳐 찍힘 */
export function SealFieldRow({ label, stamped }: { label: string; stamped: boolean }) {
  return (
    <div className="flex items-center justify-end py-3">
      <span className="text-[15px] font-bold tracking-[0.05em] text-[#111]">{label}</span>
      <span className="relative -ml-3 inline-flex h-[72px] w-[72px] items-center justify-center">
        <SealImage stamped={stamped} size={72} />
      </span>
    </div>
  );
}

/**
 * 표 칸 직인 — 칸 오른쪽 끝에 띄워 찍는다(작성 화면·문서 보기·PDF 공용).
 * 칸의 너비·높이는 그대로 두고, 직인은 칸 밖으로 넘쳐도 되게 글자 위층에 그린다.
 */
export function CellSealSlot({ stamped, children }: { stamped: boolean; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-0 top-1/2 z-10 -translate-y-1/2" style={{ width: 56, height: 56 }}>
        <SealImage stamped={stamped} size={56} />
      </span>
    </div>
  );
}
