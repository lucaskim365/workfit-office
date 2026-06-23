import { Fragment, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { MENU_TREE } from '@/app/menu-tree';
import type { MenuNode } from '@/shared/types/menu';

const LS_KEY = 'mes_menu_tree_v5';
const LV_NAME = ['모듈', '그룹', '화면'];

function clone(t: MenuNode[]): MenuNode[] {
  return JSON.parse(JSON.stringify(t));
}
function loadTree(): MenuNode[] {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved) as MenuNode[];
  } catch { /* noop */ }
  return clone(MENU_TREE);
}
function saveTree(t: MenuNode[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(t)); } catch { /* noop */ }
}

interface Found {
  node: MenuNode;
  level: number;
  siblings: MenuNode[];
}
function findNode(tree: MenuNode[], id: string, level = 0): Found | null {
  for (const n of tree) {
    if (n.id === id) return { node: n, level, siblings: tree };
    if (n.children) {
      const r = findNode(n.children, id, level + 1);
      if (r) return r;
    }
  }
  return null;
}
function breadcrumb(tree: MenuNode[], id: string): MenuNode[] {
  const path: MenuNode[] = [];
  const dfs = (nodes: MenuNode[], trail: MenuNode[]): boolean => {
    for (const n of nodes) {
      const t = [...trail, n];
      if (n.id === id) { path.push(...t); return true; }
      if (n.children && dfs(n.children, t)) return true;
    }
    return false;
  };
  dfs(tree, []);
  return path;
}
function countNodes(tree: MenuNode[]): number {
  let c = 0;
  const walk = (ns: MenuNode[]) => ns.forEach((n) => { c++; if (n.children) walk(n.children); });
  walk(tree);
  return c;
}

const inputCls = 'h-[38px] w-full rounded-md border border-border-hi bg-panel px-3 text-[12.5px] font-semibold text-ink outline-none focus:border-teal';

/** 메뉴 관리 — 3단계 트리(모듈→그룹→화면) 편집기. 와이어프레임 menu-mgmt.jsx 정본. */
export default function MenuMgmtScreen() {
  const [tree, setTree] = useState<MenuNode[]>(loadTree);
  const [selId, setSelId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    MENU_TREE.forEach((m) => { s[m.id] = true; (m.children ?? []).forEach((g) => (s[g.id] = true)); });
    return s;
  });

  const commit = (next: MenuNode[]) => { setTree(next); saveTree(next); };
  const sel = selId ? findNode(tree, selId) : null;

  const updateField = <K extends keyof MenuNode>(field: K, value: MenuNode[K]) => {
    if (!selId) return;
    const next = clone(tree);
    const r = findNode(next, selId);
    if (r) { r.node[field] = value; commit(next); }
  };
  const addChild = (parentId: string | null, level: number) => {
    const next = clone(tree);
    const newId = (level === 0 ? 'M_' : level === 1 ? 'G_' : 'S_') + Math.abs(countNodes(next) * 97 + 13).toString(36).toUpperCase();
    const newNode: MenuNode = {
      id: newId, name: LV_NAME[level] + ' 신규', order: 99, use: true, icon: '▫',
      url: level === 2 ? '/new' : undefined, children: level < 2 ? [] : undefined,
    };
    if (parentId == null) next.push(newNode);
    else {
      const r = findNode(next, parentId);
      if (r) { r.node.children = r.node.children ?? []; r.node.children.push(newNode); setExpanded((e) => ({ ...e, [parentId]: true })); }
    }
    commit(next);
    setSelId(newId);
  };
  const removeNode = (id: string) => {
    const next = clone(tree);
    const r = findNode(next, id);
    if (r) {
      const i = r.siblings.findIndex((n) => n.id === id);
      if (i >= 0) r.siblings.splice(i, 1);
      commit(next);
      if (selId === id) setSelId(null);
    }
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'menu-tree.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const resetTree = () => { commit(clone(MENU_TREE)); setSelId(null); };

  const renderNodes = (nodes: MenuNode[], level: number) =>
    [...nodes].sort((a, b) => (a.order || 0) - (b.order || 0)).map((n) => {
      const hasKids = !!n.children?.length;
      const open = expanded[n.id];
      const active = selId === n.id;
      const accent = level === 0 ? 'text-navy' : level === 1 ? 'text-teal' : 'text-ink2';
      return (
        <div key={n.id}>
          <div
            onClick={() => setSelId(n.id)}
            style={{ paddingLeft: 10 + level * 18, ...(active ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : {}) }}
            className={`flex cursor-pointer items-center gap-1.5 py-[7px] pr-2.5 ${active ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}
          >
            <span
              onClick={(e) => { e.stopPropagation(); if (level < 2) setExpanded((ex) => ({ ...ex, [n.id]: !ex[n.id] })); }}
              className={`w-3.5 text-center text-[9px] text-ink3 ${level < 2 ? '' : 'opacity-0'}`}
            >
              {level < 2 ? (open ? '▾' : '▸') : ''}
            </span>
            <span className={`text-[12.5px] opacity-80 ${accent}`}>{n.icon || '▫'}</span>
            <span className={`flex-1 truncate text-[12px] ${level === 0 ? 'font-bold' : level === 1 ? 'font-semibold' : 'font-medium'} ${active ? 'text-teal' : level === 0 ? 'text-ink' : 'text-ink2'}`}>{n.name}</span>
            <span className="rounded bg-panel-alt px-1.5 py-px text-[8.5px] font-bold text-ink3">{LV_NAME[level]}</span>
            {!n.use && <span className="text-[8.5px] text-ink3">미사용</span>}
          </div>
          {hasKids && open && renderNodes(n.children!, level + 1)}
        </div>
      );
    });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">메뉴 관리 <span className="text-[11px] font-bold text-teal">· 3단계</span></h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 메뉴 관리 · 모듈 → 그룹 → 화면 (자동저장)</p>
        </div>
        <span className="text-[10px] text-ink3">편집 즉시 자동저장</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[380px_1fr]">
        {/* 트리 */}
        <Card
          title="메뉴 구조 (3단계)"
          action={<button onClick={() => addChild(null, 0)} className="text-[10.5px] font-bold text-blue">＋ 모듈</button>}
          bodyClassName="p-0"
        >
          <div className="max-h-[460px] overflow-y-auto py-1.5">{renderNodes(tree, 0)}</div>
          <div className="flex gap-2 border-t border-border bg-panel-alt p-3">
            <button onClick={exportJSON} className="flex-1 rounded-lg bg-navy py-2 text-[11px] font-bold text-white">💾 파일 저장</button>
            <button onClick={resetTree} title="기본값 복원" className="rounded-lg border border-border-hi bg-panel px-3 py-2 text-[11px] font-bold text-ink3">초기화</button>
          </div>
        </Card>

        {/* 속성 */}
        <div className="flex flex-col gap-3.5">
          {sel ? (
            <Card
              title={<span>메뉴 속성 · <span className="text-teal">{LV_NAME[sel.level]}</span></span>}
              action={<button onClick={() => removeNode(sel.node.id)} className="text-[10.5px] font-bold text-danger">삭제</button>}
            >
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="메뉴명" required>
                  <input value={sel.node.name} onChange={(e) => updateField('name', e.target.value)} className={inputCls} />
                </Field>
                <Field label="메뉴 ID">
                  <input value={sel.node.id} readOnly className={`${inputCls} bg-panel-alt text-ink3`} />
                </Field>
                <Field label="아이콘">
                  <input value={sel.node.icon ?? ''} onChange={(e) => updateField('icon', e.target.value)} className={inputCls} />
                </Field>
                <Field label="정렬순서">
                  <input type="number" value={sel.node.order} onChange={(e) => updateField('order', Number(e.target.value))} className={inputCls} />
                </Field>
                {sel.level === 2 && (
                  <Field label="화면 URL">
                    <input value={sel.node.url ?? ''} onChange={(e) => updateField('url', e.target.value)} className={inputCls} />
                  </Field>
                )}
                <Field label="사용여부">
                  <div className="flex gap-1.5">
                    {([['사용', true], ['미사용', false]] as const).map(([lbl, v]) => (
                      <button
                        key={lbl}
                        onClick={() => updateField('use', v)}
                        className={`flex-1 rounded-[7px] border py-2 text-[11.5px] font-bold ${sel.node.use === v ? 'border-teal bg-teal-soft text-teal' : 'border-border-hi bg-panel text-ink3'}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              {sel.level < 2 && (
                <div className="mt-3.5 flex items-center gap-2.5 border-t border-border pt-3.5">
                  <span className="text-[11.5px] font-semibold text-ink3">하위 {LV_NAME[sel.level + 1]} {sel.node.children?.length ?? 0}개</span>
                  <button onClick={() => addChild(sel.node.id, sel.level + 1)} className="ml-auto rounded-lg bg-teal px-4 py-2 text-[11.5px] font-bold text-white">＋ {LV_NAME[sel.level + 1]} 추가</button>
                </div>
              )}
            </Card>
          ) : (
            <Card title="메뉴 속성">
              <div className="py-6 text-center text-[12px] text-ink3">왼쪽 트리에서 메뉴를 선택하세요.</div>
            </Card>
          )}

          <Card title="구조 미리보기">
            {sel ? (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                {breadcrumb(tree, sel.node.id).map((b, i, arr) => (
                  <Fragment key={b.id}>
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${i === arr.length - 1 ? 'bg-teal-soft font-bold text-teal' : 'bg-panel-alt font-medium text-ink2'}`}>
                      <span className="opacity-70">{b.icon}</span>{b.name}
                    </span>
                    {i < arr.length - 1 && <span className="text-ink3">›</span>}
                  </Fragment>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-ink3">선택된 메뉴의 경로가 여기에 표시됩니다.</div>
            )}
            <div className="mt-3 text-[10.5px] text-ink3">총 {countNodes(tree)}개 메뉴 · 모듈 {tree.length}개</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-3">
      <span className="text-[12px] font-bold text-ink2">{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
    </div>
  );
}
