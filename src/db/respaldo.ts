// Copias de seguridad (JSON completo), exportación CSV y borrado total.
import { esFecha } from '../nucleo/fechas';
import type { Categoria, Cuenta, Movimiento } from '../nucleo/tipos';
import { db, TABLAS, type BaseDatos } from './db';
import { sembrar } from './semilla';

export const FORMATO = 'finanzas-personales';
export const VERSION_RESPALDO = 1;

export interface Respaldo {
  formato: typeof FORMATO;
  version: number;
  exportadoEn: string;
  datos: Record<(typeof TABLAS)[number], unknown[]>;
}

export async function exportarDatos(base: BaseDatos = db): Promise<Respaldo> {
  const datos = {} as Respaldo['datos'];
  for (const t of TABLAS) datos[t] = await base.table(t).toArray();
  return { formato: FORMATO, version: VERSION_RESPALDO, exportadoEn: new Date().toISOString(), datos };
}

/** Revisa que el archivo sea un respaldo de esta app y que sus datos tengan la forma esperada. */
export function validarRespaldo(x: unknown): string | null {
  if (!x || typeof x !== 'object') return 'El archivo no es un respaldo válido.';
  const r = x as Respaldo;
  if (r.formato !== FORMATO) return 'Este archivo no es un respaldo de esta app.';
  if (typeof r.version !== 'number' || r.version > VERSION_RESPALDO) return 'El respaldo es de una versión más nueva de la app.';
  if (!r.datos || typeof r.datos !== 'object') return 'Al respaldo le faltan los datos.';
  for (const t of TABLAS) if (!Array.isArray(r.datos[t])) return `Al respaldo le falta la tabla "${t}".`;
  if (r.datos.ajustes.length !== 1) return 'El respaldo no tiene la configuración.';
  for (const m of r.datos.movimientos as Movimiento[]) {
    if (!m || typeof m.id !== 'string' || !esFecha(m.fecha) || !Number.isInteger(m.monto) || m.monto <= 0) return 'Hay movimientos con datos inválidos en el respaldo.';
  }
  return null;
}

/** Reemplaza todos los datos por los del respaldo, en una sola transacción (si algo falla, no cambia nada). */
export async function importarDatos(r: Respaldo, base: BaseDatos = db) {
  const error = validarRespaldo(r);
  if (error) throw new Error(error);
  await base.transaction('rw', TABLAS.map((t) => base.table(t)), async () => {
    for (const t of TABLAS) {
      await base.table(t).clear();
      await base.table(t).bulkAdd(r.datos[t]);
    }
  });
}

export async function borrarTodo(base: BaseDatos = db) {
  await base.transaction('rw', TABLAS.map((t) => base.table(t)), async () => {
    for (const t of TABLAS) await base.table(t).clear();
  });
  await sembrar(base);
}

const celda = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function aCsv(filas: unknown[][]): string {
  return filas.map((f) => f.map(celda).join(',')).join('\r\n');
}

const TIPO: Record<Movimiento['tipo'], string> = { ingreso: 'Ingreso', gasto: 'Gasto', transferencia: 'Transferencia', aporte: 'Aporte a meta', retiro: 'Retiro de meta', pagoDeuda: 'Pago de deuda' };

export function movimientosACsv(ms: Movimiento[], cuentas: Cuenta[], categorias: Categoria[]): string {
  const nc = new Map(cuentas.map((c) => [c.id, c.nombre]));
  const ncat = new Map(categorias.map((c) => [c.id, c.nombre]));
  const filas: unknown[][] = [['Fecha', 'Tipo', 'Descripción', 'Monto', 'Categoría', 'Subcategoría', 'Cuenta', 'Cuenta destino', 'Método', 'Clase', 'Estado', 'Fuente', 'Notas']];
  for (const m of [...ms].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    filas.push([m.fecha, TIPO[m.tipo], m.nombre, (m.monto / 100).toFixed(2), ncat.get(m.categoriaId ?? '') ?? '', m.subcategoria ?? '', nc.get(m.cuentaId ?? '') ?? '', nc.get(m.cuentaDestinoId ?? '') ?? '', m.metodo ?? '', m.clase ?? '', m.estado, m.fuente ?? '', m.notas ?? '']);
  }
  return aCsv(filas);
}
