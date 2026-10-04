import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { AppToaster } from './app/AppToaster';
import { createAppRouter } from './router';
import { useSessionStore } from './store/session.store';
import { useThemeStore } from './store/theme.store';
import './styles/index.css';

// Tema antes do primeiro render (sem script inline no HTML, por causa da CSP).
useThemeStore.getState().init();
useSessionStore.getState().init();

const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <AppToaster />
  </StrictMode>,
);
