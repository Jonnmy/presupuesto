// Guardar archivos (respaldos, CSV). En el navegador se descargan; en la app Android se guardan y se abre "Compartir"
// para enviarlos a Drive, correo o WhatsApp (las descargas normales no funcionan dentro de la app).
import { Capacitor } from '@capacitor/core';

export const esApp = () => Capacitor.isNativePlatform();

export async function guardarArchivo(nombre: string, contenido: string, tipo: string): Promise<'descargado' | 'compartido' | 'guardado'> {
  const texto = tipo.startsWith('text/csv') ? '﻿' + contenido : contenido; // BOM para que Excel lea los acentos
  if (esApp()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const r = await Filesystem.writeFile({ path: nombre, data: texto, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: nombre, text: nombre, url: r.uri, dialogTitle: 'Guardar o enviar el archivo' });
      return 'compartido';
    } catch {
      await Filesystem.writeFile({ path: nombre, data: texto, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      return 'guardado';
    }
  }
  const blob = new Blob([texto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'descargado';
}
