import type { ApprovalForm } from '@/domain/approvalForm/schema';
import type { LegacyConversion } from '@/modules/gw/approval/sheetForm/fromLegacyForm';

/*
  시트 서식 편집기 새 탭 — 결재서식 관리 목록에서 시트 서식을 열면 편집기만 있는 새 탭(/sheet-editor)으로 연다.
  앱 상단바·탭·메뉴 없이 화면을 통째로 쓰고, 서식 여러 개를 나란히 열 수 있다.

  - 열 때 넘길 것(새 서식·기존 서식에서 변환한 초안 등 아직 저장 안 된 것 포함)은 localStorage 에 잠깐 맡기고 주소엔 그 열쇠만(?k=).
    저장된 서식이면 주소에 서식 코드도(?form=) — 새로고침하거나 주소를 직접 열어도 DB 에서 다시 읽는다.
  - 탭끼리 BroadcastChannel 로 알린다: 저장함(목록 새로고침) · 기존 양식 편집으로(목록 창이 연다) · 같은 서식이 열려 있는지
*/

export interface SheetEditorPayload {
  form: ApprovalForm;
  /** 열 때의 최신 버전(새 시트 서식·처음 붙이는 시트는 null) */
  version: number | null;
  /** 기존 서식에서 변환한 초안 */
  draft?: LegacyConversion;
  source?: string;
  /** 기본 서식 묶음에서 시작한 새 서식 */
  starter?: boolean;
}

export type SheetEditorMessage =
  | { type: 'saved'; formId: string }
  | { type: 'open-legacy'; formId: string }
  | { type: 'hello'; formId: string; tabId: string }
  | { type: 'here'; formId: string; tabId: string };

export const SHEET_EDITOR_PATH = '/sheet-editor';
const CHANNEL = 'workfit:sheet-editor';
const PAYLOAD_PREFIX = 'sheetEditor.open.';
/** 맡긴 내용은 하루 지나면 지운다(탭을 닫아도 남는 것 정리) */
const PAYLOAD_TTL = 24 * 60 * 60 * 1000;

export function sheetEditorChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

export function postSheetEditorMessage(msg: SheetEditorMessage) {
  const ch = sheetEditorChannel();
  if (!ch) return;
  ch.postMessage(msg);
  ch.close();
}

/** 새 탭으로 연다 — 못 열면(팝업 막힘·저장소 못 씀) false: 부르는 쪽이 이 창 안에서 연다 */
export function openSheetEditorTab(payload: SheetEditorPayload): boolean {
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try {
    pruneSheetEditorPayloads();
    localStorage.setItem(PAYLOAD_PREFIX + key, JSON.stringify({ at: Date.now(), payload }));
  } catch {
    return false;
  }
  const form = payload.form.id ? `&form=${encodeURIComponent(payload.form.id)}` : '';
  const win = window.open(`${SHEET_EDITOR_PATH}?k=${key}${form}`, '_blank');
  if (!win) {
    try {
      localStorage.removeItem(PAYLOAD_PREFIX + key);
    } catch {
      /* 정리 못 해도 하루 뒤 지운다 */
    }
    return false;
  }
  return true;
}

/** 맡긴 내용 읽기(새로고침해도 다시 읽게 지우지 않는다 — 저장·닫기 때 지움) */
export function readSheetEditorPayload(key: string | null): SheetEditorPayload | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(PAYLOAD_PREFIX + key);
    if (!raw) return null;
    return (JSON.parse(raw) as { payload: SheetEditorPayload }).payload ?? null;
  } catch {
    return null;
  }
}

export function dropSheetEditorPayload(key: string | null) {
  if (!key) return;
  try {
    localStorage.removeItem(PAYLOAD_PREFIX + key);
  } catch {
    /* 하루 뒤 지운다 */
  }
}

export function pruneSheetEditorPayloads(now = Date.now()) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PAYLOAD_PREFIX)) continue;
      const at = (JSON.parse(localStorage.getItem(k) ?? '{}') as { at?: number }).at ?? 0;
      if (now - at > PAYLOAD_TTL) localStorage.removeItem(k);
    }
  } catch {
    /* 정리 못 해도 동작엔 지장 없음 */
  }
}
