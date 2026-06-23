import type { ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './shell/AppShell';
import PlaceholderScreen from '@/modules/common/PlaceholderScreen';
import DashboardScreen from '@/modules/ops/dashboard/DashboardScreen';
import UserScreen from '@/modules/base/user/UserScreen';
import VendorScreen from '@/modules/base/vendor/VendorScreen';
import ItemScreen from '@/modules/base/item/ItemScreen';
import EquipScreen from '@/modules/base/equip/EquipScreen';
import DefectScreen from '@/modules/base/defect/DefectScreen';
import CodeScreen from '@/modules/base/code/CodeScreen';
import ProcessScreen from '@/modules/base/process/ProcessScreen';
import { flattenScreens } from './routes';

const SCREENS = flattenScreens();
const HOME = '/ops/dashboard';

/** 실제 구현된 화면 레지스트리 (url → 컴포넌트). 미구현 화면은 PlaceholderScreen. */
const SCREEN_COMPONENTS: Record<string, ComponentType> = {
  '/ops/dashboard': DashboardScreen,
  '/base/user': UserScreen,
  '/base/vendor': VendorScreen,
  '/base/item': ItemScreen,
  '/base/equip': EquipScreen,
  '/base/defect': DefectScreen,
  '/base/code': CodeScreen,
  '/base/process': ProcessScreen,
};

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={HOME} replace />} />
        {SCREENS.map((screen) => {
          const Impl = SCREEN_COMPONENTS[screen.url];
          return (
            <Route
              key={screen.id}
              path={screen.url}
              element={Impl ? <Impl /> : <PlaceholderScreen screen={screen} />}
            />
          );
        })}
        <Route path="*" element={<PlaceholderScreen />} />
      </Route>
    </Routes>
  );
}
