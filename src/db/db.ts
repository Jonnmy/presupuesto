import Dexie, { type Table } from 'dexie';
import { hoy } from '../lib/fechas';
import {
  ajustesIniciales, catalogoInicial, categoriasIniciales, metasIniciales, planificadosIniciales, recurrentesIniciales,
} from '../lib/semilla';
import type {
  Ajustes, Categoria, CompraSirena, DepositoAhorro, DiaLibre, Gasto, GastoPlanificado, Ingreso, MetaAhorro, ProductoSirena, Recurrente,
} from '../lib/tipos';

export class BaseDatos extends Dexie {
  ajustes!: Table<Ajustes, string>;
  categorias!: Table<Categoria, string>;
  gastos!: Table<Gasto, string>;
  ingresos!: Table<Ingreso, string>;
  recurrentes!: Table<Recurrente, string>;
  diasLibres!: Table<DiaLibre, string>;
  productos!: Table<ProductoSirena, string>;
  compras!: Table<CompraSirena, string>;
  metas!: Table<MetaAhorro, string>;
  depositos!: Table<DepositoAhorro, string>;
  planificados!: Table<GastoPlanificado, string>;

  constructor(nombre = 'presupuesto-quincena') {
    super(nombre);
    this.version(1).stores({
      ajustes: 'id',
      categorias: 'id, orden',
      gastos: 'id, fecha, categoriaId, recurrenteId',
      ingresos: 'id, fecha',
      recurrentes: 'id',
      diasLibres: 'fecha',
      productos: 'id, orden',
      compras: 'id, fecha',
      metas: 'id',
      depositos: 'id, fecha',
      planificados: 'id, fecha',
    });
  }
}

export const TABLAS = [
  'ajustes', 'categorias', 'gastos', 'ingresos', 'recurrentes', 'diasLibres', 'productos', 'compras', 'metas', 'depositos', 'planificados',
] as const;
export type NombreTabla = (typeof TABLAS)[number];

export const db = new BaseDatos();

/** Siembra los datos iniciales si la base está vacía. */
export async function sembrar(base: BaseDatos = db, ahora = new Date()): Promise<void> {
  await base.transaction('rw', base.tables, async () => {
    if (await base.ajustes.get('ajustes')) return;
    await base.ajustes.put(ajustesIniciales(ahora.toISOString()));
    await base.categorias.bulkPut(categoriasIniciales());
    await base.productos.bulkPut(catalogoInicial());
    await base.recurrentes.bulkPut(recurrentesIniciales());
    await base.metas.bulkPut(metasIniciales());
    await base.planificados.bulkPut(planificadosIniciales(hoy(ahora)));
  });
}
