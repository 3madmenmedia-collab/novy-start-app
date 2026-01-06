
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TimeProvider } from './contexts/TimeContext';
import { SettingsProvider } from './contexts/SettingsContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SettingsProvider>
      <TimeProvider>
        <App />
      </TimeProvider>
    </SettingsProvider>
  </React.StrictMode>
);
