// Fechas de compromisos y cobros que se repiten. Cada vencimiento se identifica por su fecha (`ocurrencia`),
// y la base de datos no admite dos movimientos con el mismo programado + ocurrencia: así nunca se duplican.
import { aFecha, diasDelMes, partes, sumarDias, sumarMeses } from './fechas';
import type { Programado, Rango } from './tipos';

type Regla = Pick<Programado, 'frecuencia' | 'cadaDias' | 'diasQuincena' | 'diaMes'>;

/** Siguiente vencimiento después de `f` (o null si es único). */
export function siguiente(f: string, r: Regla): string | null {
  switch (r.frecuencia) {
    case 'unica': return null;
    case 'semanal': return sumarDias(f, 7);
    case 'personalizada': return sumarDias(f, Math.max(1, r.cadaDias ?? 30));
    case 'mensual': return sumarMeses(f, 1, r.diaMes ?? partes(f)[2]);
    case 'anual': return sumarMeses(f, 12, r.diaMes ?? partes(f)[2]);
    case 'quincenal': {
      const [x, y] = diasQuincenaDe(r, f);
      const [a, m] = partes(f);
      const candidatos = [x, y].map((d) => aFecha(a, m, Math.min(d, diasDelMes(a, m))));
      const [sa, sm] = partes(sumarMeses(aFecha(a, m, 1), 1));
      candidatos.push(aFecha(sa, sm, Math.min(x, diasDelMes(sa, sm))));
      return candidatos.filter((c) => c > f).sort()[0];
    }
  }
}

/** Días de una regla quincenal; si no están definidos se deducen de la fecha (15 → 15 y 30). */
export function diasQuincenaDe(r: Regla, f: string): [number, number] {
  if (r.diasQuincena) {
    const [a, b] = r.diasQuincena;
    return a < b ? [a, b] : [b, a];
  }
  const d = partes(f)[2];
  return d <= 15 ? [d, Math.min(31, d + 15)] : [d - 15, d];
}

/** Primer vencimiento en o después de `desde`, para crear un programado nuevo. */
export function primeraFechaDesde(desde: string, r: Regla): string {
  if (r.frecuencia !== 'quincenal') return desde;
  const [x, y] = diasQuincenaDe(r, desde);
  const [a, m] = partes(desde);
  const c = [x, y].map((d) => aFecha(a, m, Math.min(d, diasDelMes(a, m)))).filter((c) => c >= desde).sort()[0];
  return c ?? siguiente(desde, { ...r, diasQuincena: [x, y] })!;
}

/** Todos los vencimientos de un programado dentro del rango, empezando por su próxima fecha (los vencidos incluidos). */
export function vencimientos(p: Programado, r: Rango, maximo = 400): string[] {
  if (!p.activo) return [];
  const res: string[] = [];
  let f: string | null = p.proximaFecha;
  while (f && f <= r.fin && res.length < maximo) {
    if (f >= r.inicio) res.push(f);
    f = siguiente(f, p);
  }
  return res;
}

/** Monto equivalente por mes, para comparar compromisos de distinta frecuencia. */
export function mensualEquivalente(p: Programado): number {
  switch (p.frecuencia) {
    case 'semanal': return Math.round((p.monto * 52) / 12);
    case 'quincenal': return p.monto * 2;
    case 'mensual': return p.monto;
    case 'anual': return Math.round(p.monto / 12);
    case 'personalizada': return Math.round((p.monto * 30) / Math.max(1, p.cadaDias ?? 30));
    default: return 0;
  }
}

export const NOMBRE_FRECUENCIA: Record<Programado['frecuencia'], string> = {
  unica: 'Única', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', anual: 'Anual', personalizada: 'Personalizada',
};
