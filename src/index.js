import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals

// ✅ PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('✅ Nimir SW registered:', reg.scope);

        // listen for sync messages from sw
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SYNC_NEEDED') {
            window.dispatchEvent(new Event('online'));
          }
        });
      })
      .catch((err) => {
        console.log('❌ SW failed:', err);
      });
  });
}