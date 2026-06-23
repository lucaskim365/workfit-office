import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './shell/AppShell';
import PlaceholderScreen from '@/modules/common/PlaceholderScreen';
import { flattenScreens } from './routes';

const SCREENS = flattenScreens();
const HOME = '/ops/dashboard';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={HOME} replace />} />
        {SCREENS.map((screen) => (
          <Route
            key={screen.id}
            path={screen.url}
            element={<PlaceholderScreen screen={screen} />}
          />
        ))}
        <Route path="*" element={<PlaceholderScreen />} />
      </Route>
    </Routes>
  );
}
