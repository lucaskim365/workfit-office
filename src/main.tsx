import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { QueryProvider } from './app/QueryProvider';
import { AuthProvider } from './app/auth/AuthProvider';
import AuthGate from './app/auth/AuthGate';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <QueryProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
