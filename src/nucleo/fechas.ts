// Fechas como texto AAAA-MM-DD. Las operaciones usan UTC para no depender de la zona del equipo.
import type { Rango } from './tipos';

let zona = 'America/Santo_Domingo';
let formato: 'DD/MM/AAAA' | 'MM/DD/AAAA' | 'AAAA-MM-DD' = 'DD/MM/AAAA';

export function configurarFechas(z: string, f: typeof formato) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: z }); zona = z; } catch { /* zona inválida: se mantiene la anterior */ }
  formato = f;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Hoy en la zona configurada. */
export function hoy(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

export function esFecha(f: unknown): f is string {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const [a, m, d] = partes(f);
  return m >= 1 && m <= 12 && d >= 1 && d <= diasDelMes(a, m);
}

export function partes(f: string): [number, number, number] {
  const [a, m, d] = f.split('-').map(Number);
  return [a, m, d];
}

export const aFecha = (a: number, m: number, d: number) => `${a}-${pad(m)}-${pad(d)}`;
export const diasDelMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();

export function diaSemana(f: string): number {
  const [a, m, d] = partes(f);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function sumarDias(f: string, n: number): string {
  const [a, m, d] = partes(f);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return aFecha(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Suma meses conservando el día original cuando se puede (31 ene + 1 mes = 28/29 feb; + 2 meses = 31 mar). */
export function sumarMeses(f: string, n: number, diaOriginal?: number): string {
  const [a, m, d] = partes(f);
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12), nm = (total % 12) + 1;
  return aFecha(na, nm, Math.min(diaOriginal ?? d, diasDelMes(na, nm)));
}

export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

export function* recorrer(r: Rango): Generator<string> {
  for (let f = r.inicio; f <= r.fin; f = sumarDias(f, 1)) yield f;
}

export const enRango = (f: string, r: Rango) => f >= r.inicio && f <= r.fin;
export const minF = (a: string, b: string) => (a < b ? a : b);
export const maxF = (a: string, b: string) => (a > b ? a : b);

/** Fecha local de una marca de tiempo ISO (creadoEn se guarda en UTC). */
export function fechaDeIso(iso: string): string {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso.slice(0, 10) : hoy(t);
}

// ---- Formato para mostrar ----

/** Según la preferencia: 25/11/2026 */
export function fmtFecha(f: string): string {
  if (!esFecha(f)) return f;
  const [a, m, d] = partes(f);
  if (formato === 'AAAA-MM-DD') return f;
  if (formato === 'MM/DD/AAAA') return `${pad(m)}/${pad(d)}/${a}`;
  return `${pad(d)}/${pad(m)}/${a}`;
}

/** 25 nov */
export function fmtCorta(f: string): string {
  const [, m, d] = partes(f);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

/** miércoles 25 nov */
export function fmtDia(f: string): string {
  return `${DIAS[diaSemana(f)]} ${fmtCorta(f)}`;
}

/** 16–30 nov 2026 · 28 nov – 4 dic 2026 */
export function fmtRango(r: Rango): string {
  const [a1, m1, d1] = partes(r.inicio);
  const [a2, m2, d2] = partes(r.fin);
  if (a1 === a2 && m1 === m2) return d1 === d2 ? `${d1} ${MESES_CORTOS[m1 - 1]} ${a1}` : `${d1}–${d2} ${MESES_CORTOS[m1 - 1]} ${a1}`;
  if (a1 === a2) return `${d1} ${MESES_CORTOS[m1 - 1]} – ${d2} ${MESES_CORTOS[m2 - 1]} ${a2}`;
  return `${fmtFecha(r.inicio)} – ${fmtFecha(r.fin)}`;
}

/** "en 3 días", "hoy", "hace 2 días" */
export function relativo(f: string, desde = hoy()): string {
  const n = diasEntre(desde, f);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
