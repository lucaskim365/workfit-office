import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';

const LANGS = ['한국어', 'English', '中文', 'Tiếng Việt'];
const ROWS: string[][] = [
  ['MENU.PRODUCTION', '생산 관리', 'Production', '生产管理', 'Sản xuất'],
  ['BTN.SAVE', '저장', 'Save', '保存', 'Lưu'],
  ['BTN.SEARCH', '조회', 'Search', '查询', 'Tìm kiếm'],
  ['MSG.SAVE_OK', '저장되었습니다.', 'Saved successfully.', '已保存。', 'Đã lưu.'],
  ['ALM.TEMP_HIGH', '챔버 온도 초과', 'Chamber temp exceeded', '腔体温度超限', 'Nhiệt độ vượt mức'],
  ['LBL.EQUIP', '설비', 'Equipment', '设备', 'Thiết bị'],
];

/** 다국어 관리 — 언어 탭 + 메시지 번역 테이블. 와이어프레임 sys-screens-2.I18nMgmtContent 정본. */
export default function I18nScreen() {
  const [lang, setLang] = useState('English');

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">다국어 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 다국어 관리</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '키 추가' }, 'save', 'upload', 'download']} />
      </div>

      <div className="flex items-center gap-3 rounded-[10px] border border-border bg-panel px-3.5 py-2.5">
        <span className="text-[11px] font-semibold text-ink3">대상 언어</span>
        <div className="flex gap-1.5">
          {LANGS.map((l) => {
            const on = l === lang;
            return (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-[7px] border px-3.5 py-1.5 text-[11.5px] font-bold ${on ? 'border-navy bg-navy text-white' : 'border-border bg-panel-alt text-ink2'}`}
              >
                {l}
              </button>
            );
          })}
          <button className="rounded-[7px] px-3 py-1.5 text-[11.5px] font-bold text-blue">＋ 언어</button>
        </div>
        <span className="ml-auto text-[11px] text-ink3">번역 완료율 <b className="text-teal">92%</b></span>
      </div>

      <Card title="메시지 번역" action={<span className="text-[10.5px] text-ink3">총 1,420건 중 6건</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['메시지 키', ...LANGS].map((h) => (
                  <th key={h} className="border-b border-border bg-panel-alt px-3 py-2.5 text-left text-[10.5px] font-bold whitespace-nowrap text-ink2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r[0]} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className="border-b border-border px-3 py-2.5 font-mono text-[11px] font-bold whitespace-nowrap text-navy">{r[0]}</td>
                  <td className="border-b border-border px-3 py-2.5 font-semibold text-ink">{r[1]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-ink2">{r[2]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-ink2">{r[3]}</td>
                  <td className="border-b border-border px-3 py-2.5 text-ink2">{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
