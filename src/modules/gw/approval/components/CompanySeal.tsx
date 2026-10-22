import { useCompanyInfo } from '@/features/companyInfo/useCompanyInfo';

/**
 * 회사 직인 — 결재 완료(stamped)이고 회사 정보에 직인이 등록돼 있으면 이미지, 아니면 흐린 "(직인)" 자리 표시.
 */
export function SealImage({ stamped, size = 64 }: { stamped: boolean; size?: number }) {
  const { data: info } = useCompanyInfo();
  const url = info?.sealUrl;
  if (stamped && url) {
    return <img src={url} alt="회사 직인" style={{ width: size, height: size }} className="object-contain" />;
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

/** 표 칸 직인(작성 화면) — 입력칸 오른쪽에 겹쳐 표시 */
export function CellSealOverlay({ stamped }: { stamped: boolean }) {
  return (
    <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2">
      <SealImage stamped={stamped} size={56} />
    </span>
  );
}

/**
 * 표 칸 직인(문서 보기·PDF) — 칸 글자 끝(보통 "(인)")에 겹쳐 찍힘. 글자가 없으면 칸 가운데.
 * 직인이 글자를 밀어내지 않도록 글자 줄 위에 띄워 그린다.
 */
export function CellSealText({ text, stamped }: { text: string; stamped: boolean }) {
  if (!text.trim()) {
    return (
      <span className="flex items-center justify-center">
        <SealImage stamped={stamped} size={56} />
      </span>
    );
  }
  // 여러 줄이면 마지막 줄 끝에 찍는다
  const cut = text.replace(/\s+$/, '').lastIndexOf('\n');
  const head = cut >= 0 ? text.slice(0, cut + 1) : '';
  const last = cut >= 0 ? text.slice(cut + 1) : text;
  return (
    <>
      {head}
      <span className="relative inline-block">
        {last}
        <span className="pointer-events-none absolute left-full top-1/2 -translate-x-1/2 -translate-y-1/2">
          <SealImage stamped={stamped} size={56} />
        </span>
      </span>
    </>
  );
}
