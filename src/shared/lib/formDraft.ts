import { useEffect, useRef, useState } from 'react';

/**
 * 작성 중 내용 자동 보관 — 새로고침·배포 사고에서 입력을 지킨다.
 *
 * ## 왜 localStorage 인가
 * 이 기능이 막으려는 사고가 **페이지 새로고침**이다. 메모리(React state)는 새로고침과
 * 함께 사라지므로 답이 될 수 없다. 서버에 매번 쓰는 방식은 타이핑마다 왕복이 생기고,
 * 네트워크가 끊기면 **쓰던 글을 저장조차 못 하는** 더 나쁜 상황이 된다.
 * 메일 임시보관([[draft.store.ts]])이 같은 이유로 같은 선택을 했다.
 *
 * ## 지켜야 할 것
 * - **복구는 사용자가 결정한다.** 열자마자 덮어쓰면 "새로 쓰려는데 옛 내용이 튀어나온다".
 *   보관된 게 있으면 알려 주고, 되살릴지 버릴지 묻는다.
 * - **저장이 실패해도 화면은 멀쩡해야 한다.** 용량 초과·사생활 보호 모드에서 쓰기가
 *   막히는데, 그것 때문에 폼이 죽으면 본말전도다. 전부 조용히 삼킨다.
 * - **오래된 것은 스스로 지운다.** 안 그러면 몇 달 전 초안이 계속 되살아난다.
 */

const PREFIX = 'gw-form-draft:';
/** 이 기간이 지난 보관본은 없는 것으로 친다. 옛 내용이 튀어나오는 게 더 나쁘다. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredDraft<T> {
  savedAt: number;
  value: T;
}

function keyOf(name: string): string {
  return `${PREFIX}${name}`;
}

/** 보관본 읽기. 형식이 깨졌거나 오래됐으면 없는 것으로 본다. */
export function readDraft<T>(name: string): { value: T; savedAt: Date } | null {
  try {
    const raw = localStorage.getItem(keyOf(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (typeof parsed?.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(keyOf(name));
      return null;
    }
    return { value: parsed.value, savedAt: new Date(parsed.savedAt) };
  } catch {
    return null;
  }
}

export function writeDraft<T>(name: string, value: T): void {
  try {
    localStorage.setItem(keyOf(name), JSON.stringify({ savedAt: Date.now(), value } satisfies StoredDraft<T>));
  } catch {
    // 용량 초과·사생활 보호 모드. 보관 실패가 작성을 막으면 안 된다.
  }
}

export function clearDraft(name: string): void {
  try {
    localStorage.removeItem(keyOf(name));
  } catch {
    /* noop */
  }
}

/** 기한이 지난 보관본 일괄 정리. 앱 시작 때 한 번 부른다. */
export function purgeExpiredDrafts(): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? '') as StoredDraft<unknown>;
        if (Date.now() - (parsed?.savedAt ?? 0) > MAX_AGE_MS) stale.push(key);
      } catch {
        stale.push(key); // 못 읽는 건 남겨 둘 이유가 없다
      }
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export interface FormDraftHandle<T> {
  /** 복구할 보관본이 있으면 그 값. 사용자가 되살리거나 버리기 전까지 유지된다. */
  recovered: { value: T; savedAt: Date } | null;
  /** 되살리기 — 보관본을 돌려주고 안내를 닫는다. 실제 반영은 호출부가 한다. */
  restore: () => T | null;
  /** 버리기 — 보관본을 지우고 안내를 닫는다. */
  discard: () => void;
  /** 제출 완료 등으로 더는 보관할 필요가 없을 때. */
  clear: () => void;
}

/**
 * 폼 값을 자동 보관한다.
 *
 * @param name    보관 키. 사용자·문서별로 갈라야 남의 초안이 튀어나오지 않는다.
 *                예: `approval-draft:U011:new`
 * @param value   현재 폼 값. 바뀔 때마다 디바운스 저장한다.
 * @param enabled 빈 폼까지 보관하면 "복구할까요?"가 의미 없이 뜬다. 호출부가 판단한다.
 */
export function useFormDraft<T>(name: string, value: T, enabled: boolean): FormDraftHandle<T> {
  // 처음 마운트 시점의 보관본만 본다. 저장하면서 자기 자신을 다시 읽으면 안 된다.
  const [recovered, setRecovered] = useState(() => readDraft<T>(name));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    // 타이핑마다 쓰지 않는다. 멈춘 뒤 잠깐 있다가 한 번만 쓴다.
    timer.current = setTimeout(() => writeDraft(name, value), 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [enabled, name, value]);

  return {
    recovered,
    restore: () => {
      const found = recovered;
      setRecovered(null);
      return found?.value ?? null;
    },
    discard: () => {
      clearDraft(name);
      setRecovered(null);
    },
    clear: () => {
      clearDraft(name);
      setRecovered(null);
    },
  };
}

/** 보관 시각 표기 — `오늘 14:32` / `08.27 09:10`. */
export function formatDraftTime(at: Date): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(at);
  const time = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit',
  }).format(at);
  if (day === today) return `오늘 ${time}`;
  return `${day.slice(5).replace('-', '.')} ${time}`;
}
