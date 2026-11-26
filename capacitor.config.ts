import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.finanzas.personal',
  appName: 'Finanzas',
  webDir: 'dist',
  backgroundColor: '#0b0f17',
  android: {
    // Los datos viven en el almacenamiento local de la app (IndexedDB) y no salen del teléfono.
    allowMixedContent: false,
  },
};

export default config;
