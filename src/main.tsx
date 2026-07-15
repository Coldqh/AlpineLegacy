import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppSettings } from './components/AppSettings';
import './styles/global.css';
import './styles/mobile-app.css';
import './styles/mobile-compact.css';
import './styles/expedition-066.css';
import './styles/strategic-expedition.css';
import './styles/topographic-expedition.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <AppSettings />
  </React.StrictMode>,
);
