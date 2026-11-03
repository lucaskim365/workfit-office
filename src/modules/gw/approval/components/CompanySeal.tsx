import { createContext, useContext, type ReactNode } from 'react';
import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';
import { useCompanyMarks } from '@/features/companyMark/useCompanyMarks';
import { markUrlOf } from '@/domain/companyMark/schema';

/** 이 문서가 쓸 직인(회사 로고·직인 목록의 id) — 없으면 대표 직인. 문서 보기·작성 화면이 서식 설정으로 감싼다 */
const SealMarkContext = createContext<string | undefined>(undefined);
export function SealMarkProvider({ markId, children }: { markId: string | undefined; children: ReactNode }) {
  return <SealMarkContext.Provider value={markId}>{children}</SealMarkContext.Provider>;
}

/**
 * 회사 직인 — 결재 완료(stamped)이고 직인이 등록돼 있으면 이미지, 아니면 흐린 "(직인)" 자리 표시.
 * 서식이 고른 직인이 있으면 그것, 없으면 회사 정보의 대표 직인.
 */
export function SealImage({ stamped, size = 64 }: { stamped: boolean; size?: number }) {
  const { data: info } = useCompanyInfo();
  const { data: marks } = useCompanyMarks();
  const markId = useContext(SealMarkContext);
  const url = markUrlOf(marks, 'seal', markId, info?.sealUrl);
  if (stamped && url) {
    // maxWidth none — 글자 끝에 띄운 칸처럼 폭이 0인 곳에서도 공통 스타일(img max-width:100%)에 눌려 폭 0으로 사라지지 않게
    return (
      <img src={url} alt="회사 직인" style={{ width: size, height: size, maxWidth: 'none' }} className="shrink-0 object-contain" />
    );
  }
  return <span className="text-[12px] font-semibold text-[#bbb] select-none">(직인)</span>;
}

/**
 * 직인 필드 — 문구(예: 주식회사 ○○ 대표이사 ○○○) 끝에 직인이 겹쳐 찍힘.
 * onLabelChange 를 주면(기안 중) 문구를 그 자리에서 고칠 수 있다 — 서식 문구가 기본값.
 */
export function SealFieldRow({ label, stamped, onLabelChange }: { label: string; stamped: boolean; onLabelChange?: (v: string) => void }) {
  return (
    <div className="flex items-center justify-end py-3">
      {onLabelChange ? (
        <input
          aria-label="발신 명의"
          value={label}
          maxLength={100}
          onChange={(e) => onLabelChange(e.target.value)}
          // 한글은 글자 폭이 넓어 size(영문 기준)로는 잘린다 — 글자 수만큼 em 으로
          style={{ width: `${Math.max(8, label.length) * 1.1 + 1}em` }}
          className="min-w-0 max-w-full rounded border border-dashed border-[#ccc] bg-transparent px-1.5 py-0.5 text-right text-[15px] font-bold tracking-[0.05em] text-[#111] outline-none focus:border-teal"
        />
      ) : (
        <span className="text-[15px] font-bold tracking-[0.05em] text-[#111]">{label}</span>
      )}
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
