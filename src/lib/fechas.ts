import type { Mes, Quincena } from './tipos';

export const ZONA = 'America/Santo_Domingo';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha de hoy (YYYY-MM-DD) en la zona de Santo Domingo. */
export function hoy(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

export function partes(fecha: string): [number, number, number] {
  const [a, m, d] = fecha.split('-').map(Number);
  return [a, m, d];
}

export function aFecha(anio: number, mes: number, dia: number): string {
  return `${anio}-${pad(mes)}-${pad(dia)}`;
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** 0=domingo … 6=sábado, sin depender de la zona horaria del equipo. */
export function diaSemana(fecha: string): number {
  const [a, m, d] = partes(fecha);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = partes(fecha);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return aFecha(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/** Recorre las fechas de un rango, ambos extremos incluidos. */
export function* rango(inicio: string, fin: string): Generator<string> {
  for (let f = inicio; f <= fin; f = sumarDias(f, 1)) yield f;
}

export function quincenaDe(fecha: string, corte = 15): Quincena {
  const [anio, mes, dia] = partes(fecha);
  const ultimo = diasDelMes(anio, mes);
  const c = Math.min(Math.max(corte, 1), ultimo - 1);
  if (dia <= c) return { inicio: aFecha(anio, mes, 1), fin: aFecha(anio, mes, c), numero: 1, anio, mes };
  return { inicio: aFecha(anio, mes, c + 1), fin: aFecha(anio, mes, ultimo), numero: 2, anio, mes };
}

export function quincenaSiguiente(q: Quincena, corte = 15): Quincena {
  return quincenaDe(sumarDias(q.fin, 1), corte);
}

export function quincenaAnterior(q: Quincena, corte = 15): Quincena {
  return quincenaDe(sumarDias(q.inicio, -1), corte);
}

export function claveQuincena(q: Quincena): string {
  return `${q.anio}-${pad(q.mes)}-Q${q.numero}`;
}

export function mesDe(fecha: string): Mes {
  const [anio, mes] = partes(fecha);
  return { anio, mes };
}

export function rangoMes(m: Mes): { inicio: string; fin: string } {
  return { inicio: aFecha(m.anio, m.mes, 1), fin: aFecha(m.anio, m.mes, diasDelMes(m.anio, m.mes)) };
}

export function mesSiguiente(m: Mes): Mes {
  return m.mes === 12 ? { anio: m.anio + 1, mes: 1 } : { anio: m.anio, mes: m.mes + 1 };
}

export function mesAnterior(m: Mes): Mes {
  return m.mes === 1 ? { anio: m.anio - 1, mes: 12 } : { anio: m.anio, mes: m.mes - 1 };
}

export function quincenasDelMes(m: Mes, corte = 15): [Quincena, Quincena] {
  const q1 = quincenaDe(aFecha(m.anio, m.mes, 1), corte);
  return [q1, quincenaSiguiente(q1, corte)];
}

// ---- Formato ----

/** "22 nov 2026" */
export function formatoFecha(fecha: string): string {
  const [a, m, d] = partes(fecha);
  return `${d} ${MESES_CORTOS[m - 1]} ${a}`;
}

/** "domingo 22 nov" */
export function formatoDia(fecha: string): string {
  const [, m, d] = partes(fecha);
  return `${DIAS[diaSemana(fecha)]} ${d} ${MESES_CORTOS[m - 1]}`;
}

/** "16–30 nov 2026" */
export function formatoQuincena(q: Quincena): string {
  const [, , d1] = partes(q.inicio);
  const [, , d2] = partes(q.fin);
  return `${d1}–${d2} ${MESES_CORTOS[q.mes - 1]} ${q.anio}`;
}

export function formatoMes(m: Mes): string {
  return `${MESES_LARGOS[m.mes - 1]} ${m.anio}`;
}

export function formatoMesCorto(m: Mes): string {
  return `${MESES_CORTOS[m.mes - 1]} ${String(m.anio).slice(2)}`;
}

export const NOMBRES_DIAS = DIAS;
