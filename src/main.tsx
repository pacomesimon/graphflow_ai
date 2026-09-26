import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';

// REVIEWER: The non-null assertion `getElementById('root')!` will throw at runtime if the
// element is missing (e.g. wrong HTML template). Add a guard or a descriptive error for DX:
//   const rootEl = document.getElementById('root');
//   if (!rootEl) throw new Error('Mount point #root not found in index.html');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
