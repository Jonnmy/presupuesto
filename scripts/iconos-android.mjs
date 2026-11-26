// Genera el ícono y la pantalla de inicio del APK a partir del logo de la app.
// Uso: node scripts/iconos-android.mjs   (se ejecuta después de `npx cap add android`)
import sharp from 'sharp';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RES = 'android/app/src/main/res';
const FONDO = '#0b0f17';
const trazo = `
  <path d="M120 344 L210 256 L276 306 L392 176" fill="none" stroke="#10b981" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="392" cy="176" r="30" fill="#10b981"/>
  <rect x="120" y="380" width="272" height="20" rx="10" fill="#3b82f6" opacity="0.85"/>`;

const cuadrado = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${FONDO}"/>${trazo}</svg>`;
const redondo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="${FONDO}"/>${trazo}</svg>`;
// Ícono adaptable: el dibujo debe caber en el 66 % central (zona segura de Android).
const frente = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-136 -136 784 784">${trazo}</svg>`;

const densidades = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const png = (svg, tam) => sharp(Buffer.from(svg), { density: 300 }).resize(tam, tam).png();

for (const [d, f] of Object.entries(densidades)) {
  const dir = join(RES, `mipmap-${d}`);
  await png(cuadrado, 48 * f).toFile(join(dir, 'ic_launcher.png'));
  await png(redondo, 48 * f).toFile(join(dir, 'ic_launcher_round.png'));
  await png(frente, 108 * f).toFile(join(dir, 'ic_launcher_foreground.png'));
}

// Pantallas de inicio: fondo oscuro con el logo al centro, del mismo tamaño que las originales.
for (const carpeta of readdirSync(RES).filter((x) => x.startsWith('drawable'))) {
  const archivo = join(RES, carpeta, 'splash.png');
  if (!existsSync(archivo)) continue;
  const { width, height } = await sharp(archivo).metadata();
  const lado = Math.round(Math.min(width, height) * 0.28);
  const logo = await png(cuadrado, lado).toBuffer();
  const salida = await sharp({ create: { width, height, channels: 4, background: FONDO } })
    .composite([{ input: logo, gravity: 'center' }]).png().toBuffer();
  await sharp(salida).toFile(archivo);
}
console.log('Íconos y pantallas de inicio generados.');
