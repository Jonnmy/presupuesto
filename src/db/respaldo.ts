import { db, TABLAS, sembrar, type BaseDatos, type NombreTabla } from './db';
import type { Categoria, Gasto } from '../lib/tipos';

export interface Respaldo {
  app: 'presupuesto-quincena';
  version: 1;
  exportadoEn: string;
  datos: Record<NombreTabla, unknown[]>;
}

export async function exportarDatos(base: BaseDatos = db, ahora = new Date()): Promise<Respaldo> {
  const datos = {} as Record<NombreTabla, unknown[]>;
  await base.transaction('r', base.tables, async () => {
    for (const t of TABLAS) datos[t] = await base.table(t).toArray();
  });
  return { app: 'presupuesto-quincena', version: 1, exportadoEn: ahora.toISOString(), datos };
}

export function validarRespaldo(x: unknown): x is Respaldo {
  if (!x || typeof x !== 'object') return false;
  const r = x as Partial<Respaldo>;
  return r.app === 'presupuesto-quincena' && r.version === 1 && !!r.datos && typeof r.datos === 'object'
    && TABLAS.every((t) => Array.isArray((r.datos as Record<string, unknown>)[t] ?? []));
}

/** Reemplaza todos los datos por los del respaldo. */
export async function importarDatos(r: Respaldo, base: BaseDatos = db): Promise<void> {
  if (!validarRespaldo(r)) throw new Error('El archivo no es un respaldo válido de esta app.');
  await base.transaction('rw', base.tables, async () => {
    for (const t of TABLAS) {
      await base.table(t).clear();
      const filas = r.datos[t] ?? [];
      if (filas.length) await base.table(t).bulkAdd(filas);
    }
  });
}

/** Borra todo y vuelve a sembrar los valores iniciales. */
export async function borrarTodo(base: BaseDatos = db): Promise<void> {
  await base.transaction('rw', base.tables, async () => {
    for (const t of base.tables) await t.clear();
  });
  await sembrar(base);
}

const csvCelda = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function gastosACsv(gastos: Gasto[], categorias: Categoria[]): string {
  const nombre = new Map(categorias.map((c) => [c.id, c.nombre]));
  const filas = [...gastos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn))
    .map((g) => [g.fecha, g.monto, nombre.get(g.categoriaId) ?? g.categoriaId, g.nota ?? '', g.metodo ?? '', g.origen].map(csvCelda).join(','));
  return ['fecha,monto,categoria,nota,metodo,origen', ...filas].join('\r\n');
}

export function descargar(nombre: string, contenido: string, tipo: string, bom = false): void {
  const blob = new Blob([(bom ? '﻿' : '') + contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
