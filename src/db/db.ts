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
    // v3: gimnasio RD$2,800 al mes, pasaje RD$280 por día y catálogo de Sirena ampliado.
    // Solo se cambian los valores que siguen en el valor por defecto anterior, para respetar lo que el usuario editó.
    this.version(3).stores({}).upgrade(async (tx) => {
      const ajustes = tx.table('ajustes');
      const a = (await ajustes.get('ajustes')) as Ajustes | undefined;
      if (a) {
        await ajustes.update('ajustes', {
          ...(a.pasajeDiario === 290 ? { pasajeDiario: 280 } : {}),
          ...(a.transporteFijoQuincena === 3770 ? { transporteFijoQuincena: 3640 } : {}),
        });
      }
      await tx.table('categorias').where('id').equals(ID.gimnasio)
        .modify((c: Categoria) => { if (c.presupuestoMensual === 2500) { c.presupuestoMensual = 2800; c.presupuestoQuincenal = 1400; } });
      await tx.table('recurrentes').where('id').equals(ID.recPasaje).modify((r: Recurrente) => { if (r.monto === 290) r.monto = 280; });
      await tx.table('recurrentes').where('id').equals(ID.recGimnasio).modify((r: Recurrente) => { if (r.monto === 2500) r.monto = 2800; });
      const productos = tx.table('productos');
      for (const p of catalogoInicial()) {
        const actual = (await productos.get(p.id)) as ProductoSirena | undefined;
        if (!actual) await productos.add(p);
        else if (!actual.nota && p.nota) await productos.update(p.id, { nota: p.nota });
        else if (p.id === 'prod-8' && actual.unidad === 'libra') await productos.update(p.id, { unidad: p.unidad, nota: p.nota });
        else if (actual.nota && p.nota && p.nota.startsWith(actual.nota) && actual.nota !== p.nota) await productos.update(p.id, { nota: p.nota });
      }
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
