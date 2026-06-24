import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, TextInput } from '@/shared/ui/FilterBar';
import { ReadSelect } from '@/modules/prod/_bits';
import { useEquipBoms } from '@/features/equipBom/useEquipBoms';
import type { BomNode } from '@/domain/equipBom/schema';

type Lv = 'line' | 'equip' | 'unit' | 'part';
const LV: Record<Lv, { label: string; glyph: string; color: string; tone: Tone }> = {
  line: { label: '라인', glyph: '▤', color: '#1f2f55', tone: 'info' },
  equip: { label: '설비', glyph: '◫', color: '#17a89a', tone: 'ok' },
  unit: { label: '유닛', glyph: '⬡', color: '#b8860b', tone: 'warn' },
  part: { label: '부품', glyph: '◦', color: '#56607a', tone: 'mute' },
};

/** 트리 노드 타입 — 도메인 스키마(equipBoms)에서 파생. */
type Node = BomNode;

/** NODE_MAP 구성 — 트리를 평탄화해 code→{node,parent} 인덱스 생성. */
function buildNodeMap(root: Node): Record<string, { node: Node; parent: Node | null }> {
  const map: Record<string, { node: Node; parent: Node | null }> = {};
  (function index(node: Node, parent: Node | null) {
    map[node.code] = { node, parent };
    (node.children ?? []).forEach((c) => index(c, node));
  })(root, null);
  return map;
}
const countDesc = (node: Node): number => (node.children ?? []).reduce((n, c) => n + 1 + countDesc(c), 0);

function TreeRow({ node, depth, sel, setSel, expanded, toggle }: { node: Node; depth: number; sel: string; setSel: (c: string) => void; expanded: Set<string>; toggle: (c: string) => void }) {
  const meta = LV[node.lv];
  const kids = node.children ?? [];
  const open = expanded.has(node.code);
  const on = node.code === sel;
  return (
    <div>
      <div onClick={() => setSel(node.code)} style={{ paddingLeft: 10 + depth * 18, ...(on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : {}) }} className={`flex cursor-pointer items-center gap-1.5 rounded-r-[7px] py-1.5 pr-2.5 ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
        {kids.length > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); toggle(node.code); }} className="w-3.5 shrink-0 text-[8px] text-ink3">{open ? '▾' : '▸'}</button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="shrink-0 text-[12px]" style={{ color: meta.color }}>{meta.glyph}</span>
        <span className={`truncate ${node.lv === 'part' ? 'text-[11px] font-medium' : 'text-[12px] font-bold'} ${node.lv === 'line' ? 'font-extrabold' : ''} ${on ? 'text-teal' : node.lv === 'part' ? 'text-ink2' : 'text-ink'}`}>{node.name}</span>
        {node.lv === 'part' && node.qty != null && <span className="font-mono text-[9.5px] text-ink3">×{node.qty}</span>}
        {kids.length > 0 && <span className="ml-auto shrink-0 text-[9.5px] font-semibold text-ink3">{kids.length}</span>}
      </div>
      {open && kids.map((c) => <TreeRow key={c.code} node={c} depth={depth + 1} sel={sel} setSel={setSel} expanded={expanded} toggle={toggle} />)}
    </div>
  );
}

/** 설비 계층 구조(BOM) — 와이어프레임 equip-bom.jsx 정본 (4레벨 트리). */
export default function EquipBomScreen() {
  const { data: boms, isLoading } = useEquipBoms();
  const [sel, setSel] = useState('EQ-CMP02');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['LINE-A', 'EQ-CMP02', 'U-CMP02-HC']));
  const toggle = (code: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  // 첫 트리(단일 BOM 도큐먼트)를 정본으로 사용. NODE_MAP은 훅 데이터로부터 동일 구성.
  const tree = boms?.[0] ?? null;
  const NODE_MAP = useMemo(() => (tree ? buildNodeMap(tree) : {}), [tree]);
  const expandAll = () => { const all = new Set<string>(); Object.keys(NODE_MAP).forEach((k) => { if ((NODE_MAP[k].node.children ?? []).length) all.add(k); }); setExpanded(all); };

  if (isLoading) return <div className="px-1 py-10 text-center text-[12.5px] text-ink3">불러오는 중…</div>;
  if (!tree) return <div className="px-1 py-10 text-center text-[12.5px] text-ink3">설비 BOM 데이터가 없습니다.</div>;

  const cur = NODE_MAP[sel] ?? NODE_MAP[tree.code];
  const node = cur.node;
  const parent = cur.parent;
  const meta = LV[node.lv];
  const kids = node.children ?? [];

  const info: Array<[string, string]> = [
    ['레벨', meta.label], ['코드', node.code], ['명칭', node.name],
    ['상위 구성', parent ? parent.name : '— (최상위)'],
    ['하위 구성 수', `${kids.length}개 (총 ${countDesc(node)}개 노드)`],
  ];
  const extra: Array<[string, string]> =
    node.lv === 'equip' ? [['모델', node.model ?? ''], ['제조사', node.maker ?? ''], ['상태', node.state ?? '']]
    : node.lv === 'unit' ? [['수량', `${node.qty} EA`], ['제조사', node.maker ?? '']]
    : node.lv === 'part' ? [['부품번호', node.partNo ?? ''], ['수량', `${node.qty} EA`], ['제조사', node.maker ?? ''], ['예비품 보유', node.spare === 'Y' ? '보유' : '미보유'], ['교체주기', node.cycle ?? '']]
    : [];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비 계층 구조(BOM)</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 기준정보 관리 / 설비 계층 구조(BOM)</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '구성 추가' }, 'save', { preset: 'delete' }, 'download']} />
      </div>

      <FilterBar onSearch={() => {}}>
        <FilterField label="라인"><ReadSelect value="A라인" w={90} /></FilterField>
        <FilterField label="설비"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="레벨"><ReadSelect value="전체" w={90} /></FilterField>
        <FilterField label="검색"><TextInput value="" onChange={() => {}} placeholder="코드 / 명칭 / 부품번호" width={200} /></FilterField>
      </FilterBar>

      <div className="flex items-center gap-4 px-0.5">
        {(Object.keys(LV) as Lv[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink2">
            <span className="text-[13px]" style={{ color: LV[k].color }}>{LV[k].glyph}</span>{LV[k].label}
          </span>
        ))}
        <span className="ml-auto flex gap-2">
          <button onClick={expandAll} className="rounded-md border border-border-hi px-2.5 py-1 text-[10.5px] font-bold text-teal">전체 펼치기</button>
          <button onClick={() => setExpanded(new Set([tree.code]))} className="rounded-md border border-border-hi px-2.5 py-1 text-[10.5px] font-bold text-ink2">전체 접기</button>
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[380px_1fr]">
        <Card title="구성 트리 (BOM)" action={<span className="text-[10.5px] text-ink3">총 {Object.keys(NODE_MAP).length}개 노드</span>} bodyClassName="p-0">
          <div className="max-h-[560px] overflow-y-auto p-1">
            <TreeRow node={tree} depth={0} sel={sel} setSel={setSel} expanded={expanded} toggle={toggle} />
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card bodyClassName="p-0">
            <div className="flex items-center gap-2.5 border-b border-border px-[18px] py-3.5">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[9px] text-[17px] text-white" style={{ background: meta.color }}>{meta.glyph}</span>
              <div className="flex flex-col">
                <span className="text-[15px] font-extrabold text-ink">{node.name}</span>
                <span className="font-mono text-[10.5px] text-ink3">{node.code}</span>
              </div>
              <span className="ml-auto"><Pill tone={meta.tone}>{meta.label}</Pill></span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 p-[18px] md:grid-cols-2">
              {[...info, ...extra].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[92px_1fr] items-center gap-2.5 rounded-lg bg-panel-alt px-3 py-2">
                  <span className="text-[11px] font-bold text-ink3">{k}</span>
                  <span className="truncate text-[12px] font-bold text-ink">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="하위 구성 목록" action={<span className="flex items-center gap-2"><span className="text-[10.5px] text-ink3">직계 {kids.length}개</span><ActionButton icon="plus" label="구성 추가" /></span>} bodyClassName="p-0">
            {kids.length === 0 ? (
              <div className="px-[18px] py-10 text-center text-[12.5px] text-ink3">최하위 구성(부품)입니다. 하위 구성이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      {['레벨', '코드', '명칭', '부품번호', '수량', '제조사', '예비품', '교체주기'].map((h, i) => (
                        <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 0 || i === 6 || i === 7 ? 'text-center' : i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kids.map((c, i) => {
                      const cm = LV[c.lv];
                      return (
                        <tr key={c.code} onClick={() => setSel(c.code)} className={`cursor-pointer ${i % 2 ? 'bg-panel-alt' : 'bg-panel'}`}>
                          <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={cm.tone}>{cm.label}</Pill></td>
                          <td className="border-b border-border px-3 py-2.5 font-mono font-bold text-teal">{c.code}</td>
                          <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{c.name}</td>
                          <td className="border-b border-border px-3 py-2.5 font-mono text-ink2">{c.partNo ?? '—'}</td>
                          <td className="border-b border-border px-3 py-2.5 text-right font-bold tabular-nums text-ink">{c.qty != null ? c.qty : '—'}</td>
                          <td className="border-b border-border px-3 py-2.5 text-ink2">{c.maker ?? '—'}</td>
                          <td className="border-b border-border px-3 py-2.5 text-center">{c.lv === 'part' ? <Pill tone={c.spare === 'Y' ? 'ok' : 'mute'}>{c.spare === 'Y' ? '보유' : '미보유'}</Pill> : '—'}</td>
                          <td className="border-b border-border px-3 py-2.5 text-center text-ink2">{c.cycle ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
