import Dexie, { type Table } from 'dexie';
import { hoy } from '../lib/fechas';
import {
  ajustesIniciales, catalogoInicial, categoriasIniciales, ID, metasIniciales, planificadosIniciales, recurrentesIniciales, RETIRADOS,
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
    // v2: se quitan Suplementos, Ropa y calzado y Otros. Sus gastos pasan a Gastos personales.
    this.version(2).stores({}).upgrade(async (tx) => {
      const viejas = RETIRADOS.categorias;
      await tx.table('gastos').where('categoriaId').anyOf(viejas).modify({ categoriaId: ID.personal });
      await tx.table('planificados').filter((p: GastoPlanificado) => !!p.categoriaId && viejas.includes(p.categoriaId)).modify({ categoriaId: ID.personal });
      await tx.table('categorias').bulkDelete(viejas);
      await tx.table('recurrentes').bulkDelete(RETIRADOS.recurrentes);
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
