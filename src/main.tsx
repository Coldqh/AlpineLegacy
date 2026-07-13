import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppSettings } from './components/AppSettings';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <AppSettings />
  </React.StrictMode>,
);
