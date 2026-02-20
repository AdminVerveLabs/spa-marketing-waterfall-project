import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e2e8f0',
          },
        }}
      />
    </AuthProvider>
  </React.StrictMode>
);
