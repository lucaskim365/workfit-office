import { useState, useSyncExternalStore } from 'react';
import { isPmDbSaveError, isPmPartialSave } from '@/data/pm/pm.store';

/**
 * PM 저장 실패 알림 (7-6, DB 모드) — 저장 훅이 실패를 여기 알리면 화면 공통 안내(PmSaveLayer)가 띄움.
 * 창마다 오류 칸이 없는 저장(체크 · 버튼 한 번)도 충돌 · 일부만 저장 안내가 꼭 보이게.
 * 메모리 모드 입력 검사 오류는 알리지 않음 (지금처럼 각 창이 보여 줌).
 */
interface SaveBusState {
  /** 마지막 DB 저장 실패 (닫으면 null) */
  last: { msg: string; at: number; partial: boolean } | null;
  /** '일부만 저장' 이 난 횟수 — 새로 만드는 창이 열린 뒤 늘었으면 [저장]을 막음 (결정 (나)) */
  partials: number;
}

let state: SaveBusState = { last: null, partials: 0 };
const subs = new Set<() => void>();
const emit = () => { for (const f of subs) f(); };
/** 안내를 띄운 오류 — 화면 코드가 받지 않은 거절(void mutateAsync)이 콘솔 오류로 또 나오지 않게 */
const shown = new WeakSet<object>();

export function reportPmSaveError(e: unknown) {
  if (!isPmDbSaveError(e)) return;
  shown.add(e);
  const partial = isPmPartialSave(e);
  state = { last: { msg: e.message, at: Date.now(), partial }, partials: state.partials + (partial ? 1 : 0) };
  emit();
}
export const isShownPmSaveError = (e: unknown) => typeof e === 'object' && e !== null && shown.has(e);
export function clearPmSaveError() { state = { ...state, last: null }; emit(); }

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const usePmSaveBus = () => useSyncExternalStore(subscribe, () => state);
/** 지금 값 (테스트) */
export const pmSaveBusState = () => state;

/**
 * 새로 만드는 창 (견적 · 회의록 · 이슈 · CR · 사업 등록 등 — core 가 id 를 새로 만드는 것):
 * 창이 열린 뒤 '일부만 저장' 이 났으면 true → 그 창의 [저장]을 막고 "창을 닫고 목록에서 확인해 주세요" (결정 (나) 11/26).
 * 같은 창에서 다시 저장하면 새 기록이 또 생기기 때문 (견적 = 계약 2건).
 */
export function usePmPartialLock(open = true): boolean {
  const { partials } = usePmSaveBus();
  // 창이 열린 때의 횟수 (닫혔다 다시 열리면 새로 셈) — 그리기 중에 맞춰 깜빡임 없이
  const [base, setBase] = useState(partials);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) { setWasOpen(open); if (open) setBase(partials); }
  return open && partials > base;
}

export const PARTIAL_LOCK_MSG = '저장 중 연결이 끊겨 일부만 저장됐습니다. 이 창에서 다시 저장하면 같은 기록이 또 생길 수 있어 [저장]을 막았습니다 — 창을 닫고 목록에서 확인해 주세요';
