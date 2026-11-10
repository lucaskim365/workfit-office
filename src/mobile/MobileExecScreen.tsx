import { useMemo } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { arrange, mobilePath } from '@/modules/exec/dashboard';
import { loadLayout, MOBILE_DEFAULT_LAYOUT, placementsOf, WIDGETS } from '@/modules/exec/registry';
import { WidgetLinkProvider } from '@/modules/exec/widgets';

/**
 * 하단 탭 '경영 현황' — 웹 경영 현황과 같은 위젯을 위에서부터 한 줄로 쌓는다.
 * 이 기기에 저장된 배치가 있으면 그 칸 순서(위→아래, 왼→오)대로, 없으면 휴대폰 기본 위젯.
 * 위젯 안의 링크는 모바일 화면으로 연다.
 */
export default function MobileExecScreen() {
  const { user } = useAuth();
  const order = useMemo(() => {
    const layout = loadLayout(user?.id, MOBILE_DEFAULT_LAYOUT);
    const boxes = arrange(placementsOf(layout));
    return [...layout].sort((a, b) => {
      const p = boxes.get(a.id)!;
      const q = boxes.get(b.id)!;
      return p.y - q.y || p.x - q.x;
    });
  }, [user?.id]);

  return (
    <WidgetLinkProvider value={mobilePath}>
      <div className="h-full overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-3 px-3 pt-3 pb-6">
          {order.map((slot) => {
            const { Component } = WIDGETS[slot.id];
            return (
              <div key={slot.id} className="min-w-0">
                <Component />
              </div>
            );
          })}
        </div>
      </div>
    </WidgetLinkProvider>
  );
}
