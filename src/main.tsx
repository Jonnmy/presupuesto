import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { sembrar } from './db/db';
import { aplicarRecurrentes } from './db/acciones';
import './fuentes.css';
import './estilos.css';

registerSW({ immediate: true });

// Pide al navegador que no borre los datos guardados por falta de espacio.
navigator.storage?.persist?.().catch(() => {});

sembrar()
  .then(() => aplicarRecurrentes())
  .catch((e) => console.error('Error al preparar los datos', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
