// Almacenamiento estructurado en IndexedDB (Dexie). Persiste al recargar y al cerrar la app.
import Dexie, { type Table } from 'dexie';
import type { Ajustes, Categoria, Cuenta, Deuda, Meta, Movimiento, Presupuesto, Programado } from '../nucleo/tipos';

export class BaseDatos extends Dexie {
  ajustes!: Table<Ajustes, string>;
  cuentas!: Table<Cuenta, string>;
  categorias!: Table<Categoria, string>;
  movimientos!: Table<Movimiento, string>;
  programados!: Table<Programado, string>;
  deudas!: Table<Deuda, string>;
  metas!: Table<Meta, string>;
  presupuestos!: Table<Presupuesto, string>;

  constructor(nombre = 'finanzas') {
    super(nombre);
    this.version(1).stores({
      ajustes: 'id',
      cuentas: 'id, orden',
      categorias: 'id, tipo, orden',
      // &[programadoId+ocurrencia]: un vencimiento de un compromiso solo puede registrarse una vez.
      movimientos: 'id, fecha, tipo, cuentaId, cuentaDestinoId, categoriaId, estado, deudaId, metaId, &[programadoId+ocurrencia]',
      programados: 'id, tipo, proximaFecha',
      deudas: 'id',
      metas: 'id',
      presupuestos: 'id',
    });
  }
}

export const db = new BaseDatos();

export const TABLAS = ['ajustes', 'cuentas', 'categorias', 'movimientos', 'programados', 'deudas', 'metas', 'presupuestos'] as const;
export type NombreTabla = (typeof TABLAS)[number];
