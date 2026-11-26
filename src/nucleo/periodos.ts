// Períodos reales del calendario: semana, quincena (según días de cobro), mes, últimos 30 días y personalizado.
import { aFecha, diaSemana, diasDelMes, diasEntre, fmtRango, MESES, partes, sumarDias, sumarMeses } from './fechas';
import type { Ajustes, Rango } from './tipos';

export type VistaPeriodo = 'semana' | 'quincena' | 'mes' | '30d' | 'personalizado';

export const NOMBRE_VISTA: Record<VistaPeriodo, string> = {
  semana: 'Esta semana', quincena: 'Esta quincena', mes: 'Este mes', '30d': 'Últimos 30 días', personalizado: 'Personalizado',
};

export function semanaDe(f: string, inicioSemana: 0 | 1 = 1): Rango {
  const atras = (diaSemana(f) - inicioSemana + 7) % 7;
  const inicio = sumarDias(f, -atras);
  return { inicio, fin: sumarDias(inicio, 6) };
}

export function mesDe(f: string): Rango {
  const [a, m] = partes(f);
  return { inicio: aFecha(a, m, 1), fin: aFecha(a, m, diasDelMes(a, m)) };
}

/** Día `d` del mes ajustado a su largo (31 en febrero = 28/29). */
const diaEn = (a: number, m: number, d: number) => aFecha(a, m, Math.min(d, diasDelMes(a, m)));

/**
 * Quincena que contiene `f`. Las quincenas empiezan los días `dia1` y `dia2` de cada mes.
 * Con 1 y 16: 1–15 y 16–fin de mes. Con 15 y 30: 15–29 y 30–14 del mes siguiente.
 */
export function quincenaDe(f: string, q: Ajustes['quincena'] = { dia1: 1, dia2: 16 }): Rango {
  const d1 = Math.max(1, Math.min(q.dia1, q.dia2 - 1));
  const d2 = Math.max(d1 + 1, Math.min(q.dia2, 31));
  const [a, m] = partes(f);
  const prev = sumarMeses(aFecha(a, m, 1), -1);
  const sig = sumarMeses(aFecha(a, m, 1), 1);
  const [pa, pm] = partes(prev);
  const [sa, sm] = partes(sig);
  const inicio1 = diaEn(a, m, d1), inicio2 = diaEn(a, m, d2);
  if (f >= inicio2) return { inicio: inicio2, fin: sumarDias(diaEn(sa, sm, d1), -1) };
  if (f >= inicio1) return { inicio: inicio1, fin: sumarDias(inicio2, -1) };
  return { inicio: diaEn(pa, pm, d2), fin: sumarDias(inicio1, -1) };
}

/** Rango de una vista, desplazado `paso` períodos (−1 = el anterior). */
export function rangoVista(vista: VistaPeriodo, base: string, a: Ajustes, paso = 0, personalizado?: Rango): Rango {
  switch (vista) {
    case 'semana': return semanaDe(sumarDias(base, paso * 7), a.inicioSemana);
    case 'mes': return mesDe(sumarMeses(mesDe(base).inicio, paso));
    case '30d': { const fin = sumarDias(base, paso * 30); return { inicio: sumarDias(fin, -29), fin }; }
    case 'quincena': {
      let r = quincenaDe(base, a.quincena);
      for (let i = 0; i < Math.abs(paso); i++) r = quincenaDe(paso > 0 ? sumarDias(r.fin, 1) : sumarDias(r.inicio, -1), a.quincena);
      return r;
    }
    case 'personalizado': {
      const r = personalizado ?? mesDe(base);
      const largo = diasEntre(r.inicio, r.fin) + 1;
      return { inicio: sumarDias(r.inicio, paso * largo), fin: sumarDias(r.fin, paso * largo) };
    }
  }
}

/** El período inmediatamente anterior, del mismo tipo y largo, para comparar. */
export function periodoAnterior(vista: VistaPeriodo, r: Rango, a: Ajustes): Rango {
  if (vista === 'mes') return mesDe(sumarDias(r.inicio, -1));
  if (vista === 'quincena') return quincenaDe(sumarDias(r.inicio, -1), a.quincena);
  const largo = diasEntre(r.inicio, r.fin) + 1;
  return { inicio: sumarDias(r.inicio, -largo), fin: sumarDias(r.inicio, -1) };
}

export function nombrePeriodo(vista: VistaPeriodo, r: Rango): string {
  if (vista === 'mes') { const [a, m] = partes(r.inicio); return `${MESES[m - 1]} ${a}`; }
  return fmtRango(r);
}

/** Divide un rango en tramos para gráficos: días si es corto, semanas si es mediano, meses si es largo. */
export function tramos(r: Rango, a: Ajustes): { rango: Rango; etiqueta: string }[] {
  const largo = diasEntre(r.inicio, r.fin) + 1;
  const res: { rango: Rango; etiqueta: string }[] = [];
  if (largo <= 16) {
    for (let f = r.inicio; f <= r.fin; f = sumarDias(f, 1)) res.push({ rango: { inicio: f, fin: f }, etiqueta: String(partes(f)[2]) });
  } else if (largo <= 92) {
    for (let f = r.inicio; f <= r.fin;) {
      const s = semanaDe(f, a.inicioSemana);
      const fin = s.fin < r.fin ? s.fin : r.fin;
      res.push({ rango: { inicio: f, fin }, etiqueta: `${partes(f)[2]}/${partes(f)[1]}` });
      f = sumarDias(fin, 1);
    }
  } else {
    for (let f = r.inicio; f <= r.fin;) {
      const m = mesDe(f);
      const fin = m.fin < r.fin ? m.fin : r.fin;
      res.push({ rango: { inicio: f, fin }, etiqueta: MESES[partes(f)[1] - 1].slice(0, 3) });
      f = sumarDias(fin, 1);
    }
  }
  return res;
}
