import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { BaseDatos, sembrar } from './db';
import { agregarGasto, guardarProducto, marcarCompraHecha, recalcularServicios, registrarPasaje } from './acciones';
import { cargarDemo, quitarDemo } from './demo';
import { borrarTodo, exportarDatos, gastosACsv, importarDatos } from './respaldo';
import { CANTIDADES_V5, catalogoInicial, categoriasIniciales, ID } from '../lib/semilla';

let base: BaseDatos;
let n = 0;

beforeEach(async () => {
  base = new BaseDatos(`prueba-${++n}`);
  await sembrar(base, new Date('2026-11-22T15:00:00Z'));
});

describe('Base de datos', () => {
  it('siembra sin gastos, ingresos ni depósitos', async () => {
    expect(await base.categorias.count()).toBe(6);
    expect(await base.productos.count()).toBe(25);
    expect(await base.recurrentes.count()).toBe(2);
    expect(await base.metas.count()).toBe(1);
    expect(await base.gastos.count()).toBe(0);
    expect(await base.ingresos.count()).toBe(0);
    expect(await base.depositos.count()).toBe(0);
    await sembrar(base); // idempotente
    expect(await base.categorias.count()).toBe(6);
  });

  it('migración v1 → v2: quita Suplementos, Ropa y Otros y pasa sus gastos a Gastos personales', async () => {
    const nombre = `migracion-${++n}`;
    const v1 = new Dexie(nombre);
    v1.version(1).stores({ ajustes: 'id', categorias: 'id, orden', gastos: 'id, fecha, categoriaId, recurrenteId', ingresos: 'id, fecha', recurrentes: 'id', diasLibres: 'fecha', productos: 'id, orden', compras: 'id, fecha', metas: 'id', depositos: 'id, fecha', planificados: 'id, fecha' });
    await v1.table('categorias').bulkAdd([{ id: 'cat-suplementos', orden: 2 }, { id: 'cat-ropa', orden: 6 }, { id: 'cat-otros', orden: 7 }, { id: ID.personal, orden: 5 }]);
    await v1.table('recurrentes').bulkAdd([{ id: 'rec-whey' }, { id: 'rec-creatina' }, { id: ID.recPasaje }]);
    await v1.table('gastos').add({ id: 'g1', fecha: '2026-11-20', categoriaId: 'cat-ropa', monto: 5000 });
    v1.close();

    const v2 = new BaseDatos(nombre);
    expect((await v2.categorias.toArray()).map((c) => c.id)).toEqual([ID.personal]);
    expect((await v2.recurrentes.toArray()).map((r) => r.id)).toEqual([ID.recPasaje]);
    expect((await v2.gastos.get('g1'))?.categoriaId).toBe(ID.personal);
  });

  it('migración a v3: gimnasio 2,800 y pasaje 280 solo si seguían en el valor anterior; agrega productos nuevos', async () => {
    const nombre = `migracion-${++n}`;
    const v1 = new Dexie(nombre);
    v1.version(1).stores({ ajustes: 'id', categorias: 'id, orden', gastos: 'id, fecha, categoriaId, recurrenteId', ingresos: 'id, fecha', recurrentes: 'id', diasLibres: 'fecha', productos: 'id, orden', compras: 'id, fecha', metas: 'id', depositos: 'id, fecha', planificados: 'id, fecha' });
    await v1.table('ajustes').add({ id: 'ajustes', pasajeDiario: 290, transporteFijoQuincena: 4000 });
    await v1.table('categorias').add({ id: ID.gimnasio, orden: 3, presupuestoMensual: 2500, presupuestoQuincenal: 1250 });
    await v1.table('recurrentes').bulkAdd([{ id: ID.recPasaje, monto: 290 }, { id: ID.recGimnasio, monto: 2500 }]);
    await v1.table('productos').bulkAdd([
      { id: 'prod-1', nombre: 'Huevos', precio: 215, orden: 1, nota: 'mío' },
      { id: 'prod-12', nombre: 'Tomate', precio: 0, unidad: 'libra', cantidadQuincena: 0, cantidadMes: 0, orden: 12 },
      { id: 'prod-15', nombre: 'Fruta variada', precio: 0, cantidadQuincena: 0, cantidadMes: 0, orden: 15 },
    ]);
    v1.close();

    const v3 = new BaseDatos(nombre);
    const a = await v3.ajustes.get('ajustes');
    expect(a?.pasajeDiario).toBe(280);
    expect(a?.transporteFijoQuincena).toBe(4000); // editado por el usuario: se respeta
    expect((await v3.categorias.get(ID.gimnasio))?.presupuestoMensual).toBe(2800);
    expect((await v3.recurrentes.get(ID.recGimnasio))?.monto).toBe(2800);
    expect((await v3.productos.get('prod-1'))?.precio).toBe(215);
    expect(await v3.productos.count()).toBe(25);
    expect((await v3.productos.get('prod-12'))?.precio).toBe(46); // v4: precio de sirena.do
    expect(await v3.productos.get('prod-15')).toBeUndefined();
    expect((await v3.productos.get('prod-12'))?.cantidadQuincena).toBe(2); // v5: cantidad propuesta
  });

  it('migración a v5: pone las cantidades propuestas y recalcula Dieta si no se había editado', async () => {
    const nombre = `migracion-${++n}`;
    const v1 = new Dexie(nombre);
    v1.version(1).stores({ ajustes: 'id', categorias: 'id, orden', gastos: 'id, fecha, categoriaId, recurrenteId', ingresos: 'id, fecha', recurrentes: 'id', diasLibres: 'fecha', productos: 'id, orden', compras: 'id, fecha', metas: 'id', depositos: 'id, fecha', planificados: 'id, fecha' });
    const viejo = catalogoInicial().map((p) => (p.id in CANTIDADES_V5 ? { ...p, cantidadQuincena: 0, cantidadMes: 0 } : p));
    await v1.table('productos').bulkAdd(viejo);
    await v1.table('categorias').add({ ...categoriasIniciales()[0], presupuestoQuincenal: 3974, presupuestoMensual: 7515 });
    v1.close();
    const v5 = new BaseDatos(nombre);
    const dieta = await v5.categorias.get(ID.dieta);
    expect(dieta?.presupuestoQuincenal).toBe(4639);
    expect(dieta?.presupuestoMensual).toBe(8845);
  });

  it('migración a v6: bloques, fijos, servicios y tema oscuro', async () => {
    const nombre = `migracion-${++n}`;
    const v1 = new Dexie(nombre);
    v1.version(1).stores({ ajustes: 'id', categorias: 'id, orden', gastos: 'id, fecha, categoriaId, recurrenteId', ingresos: 'id, fecha', recurrentes: 'id', diasLibres: 'fecha', productos: 'id, orden', compras: 'id, fecha', metas: 'id', depositos: 'id, fecha', planificados: 'id, fecha' });
    await v1.table('ajustes').add({ id: 'ajustes', tema: 'sistema', pasajeDiario: 280 });
    await v1.table('categorias').bulkAdd([{ id: ID.gimnasio, clave: 'gimnasio', tipo: 'gasto', orden: 3 }, { id: ID.dieta, clave: 'dieta', tipo: 'gasto', orden: 1 }]);
    v1.close();
    const v6 = new BaseDatos(nombre);
    const a = await v6.ajustes.get('ajustes');
    expect(a?.tema).toBe('oscuro');
    expect(a?.bloques).toEqual({ necesidades: 50, estilo: 30, ahorro: 20 });
    expect(await v6.categorias.get(ID.gimnasio)).toMatchObject({ bloque: 'estilo', fijo: true });
    expect(await v6.categorias.get(ID.dieta)).toMatchObject({ bloque: 'necesidades' });
    expect(await v6.categorias.get('cat-servicios')).toMatchObject({ nombre: 'Servicios y suscripciones', fijo: true });
  });

  it('11. "Hoy trabajé" dos veces el mismo día crea un solo gasto de 280', async () => {
    expect(await registrarPasaje('2026-11-23', base)).toBe('creado');
    expect(await registrarPasaje('2026-11-23', base)).toBe('duplicado');
    const gastos = await base.gastos.toArray();
    expect(gastos).toHaveLength(1);
    expect(gastos[0].monto).toBe(280);
    expect(gastos[0].categoriaId).toBe(ID.transporte);
  });

  it('12. Exportar, borrar todo e importar deja los datos idénticos', async () => {
    await agregarGasto({ fecha: '2026-11-20', monto: 450, categoriaId: ID.personal, nota: 'Barbería, "corte"', origen: 'manual', metodo: 'efectivo' }, base);
    await registrarPasaje('2026-11-20', base);
    await base.depositos.add({ id: 'd1', fecha: '2026-11-30', monto: 7000, metaId: 'meta-emergencia' });
    await base.diasLibres.add({ fecha: '2026-11-18', motivo: 'Feriado' });
    const antes = await exportarDatos(base);
    const json = JSON.stringify(antes);

    await borrarTodo(base);
    expect(await base.gastos.count()).toBe(0);

    await importarDatos(JSON.parse(json), base);
    const despues = await exportarDatos(base);
    expect(despues.datos).toEqual(antes.datos);
  });

  it('importar rechaza archivos que no son respaldos', async () => {
    await expect(importarDatos({ hola: 1 } as never, base)).rejects.toThrow();
  });

  it('marcar compra hecha crea gasto en Dieta y guarda la diferencia', async () => {
    const g = await marcarCompraHecha(3974, 4100, '2026-11-22', base);
    expect(g.categoriaId).toBe(ID.dieta);
    const [c] = await base.compras.toArray();
    expect(c.real - c.estimado).toBe(126);
  });

  it('cambiar un precio recalcula el presupuesto de Dieta', async () => {
    const huevos = (await base.productos.get('prod-1'))!;
    const r = await guardarProducto({ ...huevos, precio: 215 }, base);
    expect(r).toEqual({ antes: 4639, despues: 4679 });
    expect((await base.categorias.get(ID.dieta))!.presupuestoMensual).toBe(8925);
  });

  it('CSV de gastos', async () => {
    await agregarGasto({ fecha: '2026-11-20', monto: 450, categoriaId: ID.personal, nota: 'a, b', origen: 'manual' }, base);
    const csv = gastosACsv(await base.gastos.toArray(), await base.categorias.toArray());
    expect(csv.split('\r\n')[1]).toBe('2026-11-20,450,Gastos personales,"a, b",,manual');
  });

  it('la demostración se carga y se quita sin tocar datos reales', async () => {
    const real = await agregarGasto({ fecha: '2026-11-20', monto: 500, categoriaId: ID.personal, origen: 'manual' }, base);
    const n = await cargarDemo('2026-11-22', 15, base);
    expect(n).toBeGreaterThan(20);
    expect(await base.gastos.count()).toBe(n + 1);
    expect(await base.ingresos.count()).toBe(1);
    await quitarDemo(base);
    expect((await base.gastos.toArray()).map((g) => g.id)).toEqual([real.id]);
    expect(await base.ingresos.count()).toBe(0);
    expect(await base.depositos.count()).toBe(0);
  });

  it('Servicios y suscripciones presupuesta la suma de sus fijos', async () => {
    const r = { categoriaId: 'cat-servicios', automatico: false, activo: true, diaDelMes: 5 };
    await base.recurrentes.bulkAdd([
      { ...r, id: 'i', nombre: 'Internet', monto: 1150, frecuencia: 'mensual' },
      { ...r, id: 'c', nombre: 'Celular', monto: 400, frecuencia: 'quincenal' },
      { ...r, id: 'x', nombre: 'Viejo', monto: 999, frecuencia: 'mensual', activo: false },
    ]);
    expect(await recalcularServicios(base)).toBe(1950);
    const c = await base.categorias.get('cat-servicios');
    expect([c?.presupuestoMensual, c?.presupuestoQuincenal]).toEqual([1950, 975]);
  });
});
