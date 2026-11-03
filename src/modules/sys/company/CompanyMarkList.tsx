import { useRef, useState } from "react";
import {
  marksOf,
  type CompanyMark,
  type CompanyMarkKind,
} from "@/domain/companyMark/schema";
import {
  useAddCompanyMark,
  useAddExistingCompanyMark,
  useCompanyMarks,
  useRemoveCompanyMark,
  useSaveCompanyMark,
} from "@/features/companyMark/useCompanyMarks";

const KIND_LABEL: Record<CompanyMarkKind, string> = {
  logo: "로고",
  seal: "직인",
};
const btn =
  "rounded-md border border-border-hi bg-panel px-2 py-0.5 text-[11px] font-bold text-ink transition-colors hover:bg-panel-alt disabled:opacity-50";

/**
 * 회사 로고·직인 목록 — 여러 개 등록하고 하나를 대표로. 대표는 회사 기본정보의 그림 칸(representative)에 복사돼
 * 기존 화면(상단 바·직인 서식)이 그대로 쓴다. 결재서식은 칸마다 이 목록에서 고른다.
 */
export function CompanyMarkList({
  kind,
  representative,
  onChooseRepresentative,
}: {
  kind: CompanyMarkKind;
  /** 지금 대표 그림 주소·경로(회사 기본정보) */
  representative: { url: string; path: string };
  onChooseRepresentative: (mark: { url: string; path: string }) => void;
}) {
  const label = KIND_LABEL[kind];
  const { data } = useCompanyMarks();
  const marks = marksOf(data, kind);
  const add = useAddCompanyMark();
  const addExisting = useAddExistingCompanyMark();
  const save = useSaveCompanyMark();
  const remove = useRemoveCompanyMark();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const nextOrder = marks.reduce((max, m) => Math.max(max, m.order), 0) + 1;
  const repInList =
    !representative.url || marks.some((m) => m.url === representative.url);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setError("이미지 파일만 올릴 수 있습니다.");
    if (file.size > 5 * 1024 * 1024)
      return setError("5MB 이하 이미지만 올릴 수 있습니다.");
    setError("");
    add.mutate(
      { kind, name: `${label} ${marks.length + 1}`, file, order: nextOrder },
      {
        // 처음 올린 그림은 대표가 없으면 대표로
        onSuccess: (mark) => {
          if (!representative.url) onChooseRepresentative(mark);
        },
        onError: () => setError(`${label} 업로드에 실패했습니다.`),
      },
    );
  };

  const rename = (mark: CompanyMark, name: string) => {
    const next = name.trim();
    if (!next || next === mark.name) return;
    save.mutate({ ...mark, name: next.slice(0, 40) });
  };

  const onRemove = (mark: CompanyMark) => {
    if (mark.url === representative.url)
      return setError(
        `대표 ${label}는 지울 수 없습니다. 다른 ${label}를 대표로 고른 뒤 지우세요.`,
      );
    if (
      !window.confirm(
        `'${mark.name}' ${label}를 목록에서 지우시겠습니까?\n이 ${label}를 고른 결재서식은 대표 ${label}를 쓰게 됩니다.`,
      )
    )
      return;
    setError("");
    remove.mutate(mark.id);
  };

  const thumb = (url: string) => (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border p-1 ${
        kind === "logo"
          ? "h-[44px] w-[110px] border-[#2b313d] bg-[#3a414f]"
          : "h-[48px] w-[48px] border-border-hi bg-white"
      }`}
    >
      <img src={url} alt={label} className="h-full w-full object-contain" />
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {!repInList && (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border-hi px-2 py-1.5">
          {thumb(representative.url)}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span className="whitespace-nowrap text-[11.5px] font-semibold text-ink2">
              지금 대표 {label}
            </span>
            <button
              type="button"
              className={btn}
              disabled={addExisting.isPending}
              onClick={() =>
                addExisting.mutate({
                  kind,
                  name: `기본 ${label}`,
                  url: representative.url,
                  path: representative.path,
                  order: 0,
                })
              }
            >
              목록에 추가
            </button>
          </div>
        </div>
      )}
      {marks.map((mark) => {
        const isRep = mark.url === representative.url;
        return (
          <div key={mark.id} className="flex items-center gap-2">
            {thumb(mark.url)}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                key={mark.name}
                aria-label={`${label} 이름`}
                defaultValue={mark.name}
                maxLength={40}
                onBlur={(e) => rename(mark, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-full min-w-0 rounded-md border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none focus:border-teal"
              />
              <div className="flex items-center gap-1.5">
                {isRep ? (
                  <span className="shrink-0 rounded-md bg-teal/10 px-2 py-0.5 text-[11px] font-bold text-teal">
                    대표
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`${btn} shrink-0`}
                    onClick={() => onChooseRepresentative(mark)}
                  >
                    대표로
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(mark)}
                  className="shrink-0 rounded-md border border-border-hi px-2 py-0.5 text-[11px] font-bold text-danger transition-colors hover:border-danger hover:bg-danger/10"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          disabled={add.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {add.isPending ? "업로드 중…" : `+ ${label} 추가`}
        </button>
        <span className="text-[10.5px] text-ink3">
          {kind === "seal" ? "배경 없는 PNG" : "PNG"} · 5MB 이하
        </span>
      </div>
      {error && (
        <p className="text-[11px] font-semibold text-danger">{error}</p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
