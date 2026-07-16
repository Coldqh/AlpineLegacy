import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppSettings } from './components/AppSettings';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { RuntimeNotice } from './components/RuntimeNotice';
import { registerOfflineApp } from './pwa';
import './styles/global.css';
import './styles/mobile-app.css';
import './styles/mobile-compact.css';
import './styles/expedition-066.css';
import './styles/strategic-expedition.css';
import './styles/mountain-grid-expedition.css';
import './styles/ux-rebuild.css';
import './styles/visual-023.css';

registerOfflineApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
      <AppSettings />
      <RuntimeNotice />
    </AppErrorBoundary>
  </React.StrictMode>,
);
