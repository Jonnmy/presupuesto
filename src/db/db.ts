import Dexie, { type Table } from 'dexie';
import { costoCompraSirena } from '../lib/calculos';
import { hoy } from '../lib/fechas';
import {
  BLOQUE_POR_CLAVE, BLOQUES_INICIALES, SERVICIOS_INICIAL, ajustesIniciales, catalogoInicial, categoriasIniciales, ID, metasIniciales, CANTIDADES_V5, planificadosIniciales, PRODUCTOS_RETIRADOS, recurrentesIniciales, RETIRADOS,
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
    // v4: precios de frutas, verduras, sardinas y multivitamínico tomados de sirena.do.
    // Solo se llenan los productos que seguían sin precio; lo que el usuario editó se respeta.
    this.version(4).stores({}).upgrade(async (tx) => {
      const productos = tx.table('productos');
      for (const id of PRODUCTOS_RETIRADOS) {
        const p = (await productos.get(id)) as ProductoSirena | undefined;
        if (p && p.precio === 0 && p.cantidadQuincena === 0 && p.cantidadMes === 0) await productos.delete(id);
      }
      for (const p of catalogoInicial()) {
        const actual = (await productos.get(p.id)) as ProductoSirena | undefined;
        if (!actual) await productos.add(p);
        else if (actual.precio === 0 && p.precio > 0) await productos.update(p.id, { nombre: p.nombre, precio: p.precio, unidad: p.unidad, nota: p.nota });
      }
    });
    // v5: cantidades propuestas de frutas, verduras, aguacate y sardinas, y Dieta recalculado.
    // Solo se tocan productos que seguían en cantidad 0, y Dieta solo si seguía igual al catálogo anterior.
    this.version(5).stores({}).upgrade(async (tx) => {
      const productos = tx.table('productos');
      const nuevos = catalogoInicial();
      for (const [id, [q, m]] of Object.entries(CANTIDADES_V5)) {
        const p = (await productos.get(id)) as ProductoSirena | undefined;
        if (!p) continue;
        if (p.cantidadQuincena === 0 && p.cantidadMes === 0) {
          const semilla = nuevos.find((x) => x.id === id);
          await productos.update(id, { cantidadQuincena: q, cantidadMes: m, ...(semilla ? { nota: semilla.nota } : {}) });
        }
      }
      const todos = (await productos.toArray()) as ProductoSirena[];
      const base = costoCompraSirena(todos.filter((p) => !(p.id in CANTIDADES_V5)), 'quincena');
      const dieta = (await tx.table('categorias').get(ID.dieta)) as Categoria | undefined;
      if (dieta && dieta.presupuestoQuincenal === base) {
        await tx.table('categorias').update(ID.dieta, { presupuestoQuincenal: costoCompraSirena(todos, 'quincena'), presupuestoMensual: costoCompraSirena(todos, 'mes') });
      }
    });
    // v6: rediseño. Bloques 50/30/20, gastos fijos, categoría de servicios y suscripciones, tema oscuro por defecto.
    this.version(6).stores({}).upgrade(async (tx) => {
      const ajustes = tx.table('ajustes');
      const a = (await ajustes.get('ajustes')) as Ajustes | undefined;
      if (a) {
        await ajustes.update('ajustes', {
          ...(a.bloques ? {} : { bloques: { ...BLOQUES_INICIALES } }),
          ...(a.tema === 'sistema' ? { tema: 'oscuro' } : {}),
        });
      }
      const categorias = tx.table('categorias');
      await categorias.toCollection().modify((c: Categoria) => {
        const def = c.clave ? BLOQUE_POR_CLAVE[c.clave] : undefined;
        if (!c.bloque) c.bloque = def?.bloque ?? (c.tipo === 'ahorro' ? 'ahorro' : 'estilo');
        if (c.fijo === undefined && def?.fijo) c.fijo = true;
      });
      if (a && !(await categorias.get(SERVICIOS_INICIAL.id))) await categorias.add({ ...SERVICIOS_INICIAL });
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
