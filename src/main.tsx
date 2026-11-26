import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { db } from './db/db';
import { importarLegado, sembrar } from './db/semilla';
import './fuentes.css';
import './estilos.css';

// En la web se instala como PWA (funciona sin internet). Dentro del APK no hace falta: los archivos ya vienen en la app.
if (!Capacitor.isNativePlatform()) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}

// Pide que el almacenamiento sea persistente (que el sistema no lo borre por falta de espacio).
navigator.storage?.persist?.().catch(() => {});

async function preparar() {
  const nuevo = await sembrar(db);
  // La primera vez, trae los datos de la versión anterior de la app si existen en este navegador.
  if (nuevo) await importarLegado(db).catch((e) => console.warn('No se pudo importar la versión anterior', e));
}

const raiz = createRoot(document.getElementById('root')!);
preparar()
  .catch((e) => console.error('Error al preparar los datos', e))
  .finally(() => raiz.render(<StrictMode><App /></StrictMode>));

// Botón "atrás" de Android: cierra la ventana abierta o vuelve; en el panel, sale de la app.
if (Capacitor.isNativePlatform()) {
  import('@capacitor/app').then(({ App: AppNativa }) => {
    AppNativa.addListener('backButton', () => {
      const cerrar = document.querySelector<HTMLButtonElement>('.modal [aria-label="Cerrar"]');
      if (cerrar) return cerrar.click();
      const hoja = document.querySelector<HTMLElement>('.hoja-velo');
      if (hoja) return hoja.click();
      if (location.hash && !/^#\/?(panel)?$/.test(location.hash)) history.back();
      else AppNativa.exitApp();
    });
  });
}
