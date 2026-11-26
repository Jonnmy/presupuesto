// Dinero en centavos enteros. Formato regional configurable (por defecto RD$ 1,000.00).
import type { Centavos } from './tipos';

let simbolo = 'RD$';
let decimales: 0 | 2 = 2;

export function configurarDinero(s: string, d: 0 | 2) {
  simbolo = s.trim() || 'RD$';
  decimales = d;
}

const formateadores = new Map<number, Intl.NumberFormat>();
function nf(d: number) {
  if (!formateadores.has(d)) formateadores.set(d, new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return formateadores.get(d)!;
}

/** RD$ 1,000.00 (o −RD$ 50.00) */
export function dinero(c: Centavos, opciones: { signo?: boolean; corto?: boolean } = {}): string {
  const d = opciones.corto ? 0 : decimales;
  const valor = Math.abs(c) / 100;
  const texto = `${simbolo} ${nf(d).format(d === 0 ? Math.round(valor) : valor)}`;
  if (c < 0) return `−${texto}`;
  return opciones.signo && c > 0 ? `+${texto}` : texto;
}

/** Solo el número, sin símbolo: 1,000.00 */
export const numero = (c: Centavos) => nf(decimales).format(c / 100);

/** Convierte lo que escribe el usuario ("1,250.50", "1250", "RD$ 3,974") en centavos. null si no es válido. */
export function leerDinero(texto: string): Centavos | null {
  const limpio = texto.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!limpio || !/^-?\d*(\.\d{0,2})?$/.test(limpio) || limpio === '.' || limpio === '-') return null;
  const n = Math.round(Number(limpio) * 100);
  return Number.isFinite(n) ? n : null;
}

/** Pesos a centavos (para semillas y pruebas). */
export const rd = (pesos: number): Centavos => Math.round(pesos * 100);

export const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function porcentaje(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

export const fmtPct = (p: number) => `${Math.round(p)}%`;

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
