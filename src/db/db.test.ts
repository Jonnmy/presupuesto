import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { BaseDatos, sembrar } from './db';
import { agregarGasto, guardarProducto, marcarCompraHecha, registrarPasaje } from './acciones';
import { borrarTodo, exportarDatos, gastosACsv, importarDatos } from './respaldo';
import { ID } from '../lib/semilla';

let base: BaseDatos;
let n = 0;

beforeEach(async () => {
  base = new BaseDatos(`prueba-${++n}`);
  await sembrar(base, new Date('2026-11-22T15:00:00Z'));
});

describe('Base de datos', () => {
  it('siembra sin gastos, ingresos ni depósitos', async () => {
    expect(await base.categorias.count()).toBe(5);
    expect(await base.productos.count()).toBe(14);
    expect(await base.recurrentes.count()).toBe(2);
    expect(await base.metas.count()).toBe(1);
    expect(await base.gastos.count()).toBe(0);
    expect(await base.ingresos.count()).toBe(0);
    expect(await base.depositos.count()).toBe(0);
    await sembrar(base); // idempotente
    expect(await base.categorias.count()).toBe(5);
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

  it('11. "Hoy trabajé" dos veces el mismo día crea un solo gasto de 290', async () => {
    expect(await registrarPasaje('2026-11-23', base)).toBe('creado');
    expect(await registrarPasaje('2026-11-23', base)).toBe('duplicado');
    const gastos = await base.gastos.toArray();
    expect(gastos).toHaveLength(1);
    expect(gastos[0].monto).toBe(290);
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
    expect(r).toEqual({ antes: 3974, despues: 4014 });
    expect((await base.categorias.get(ID.dieta))!.presupuestoMensual).toBe(7595);
  });

  it('CSV de gastos', async () => {
    await agregarGasto({ fecha: '2026-11-20', monto: 450, categoriaId: ID.personal, nota: 'a, b', origen: 'manual' }, base);
    const csv = gastosACsv(await base.gastos.toArray(), await base.categorias.toArray());
    expect(csv.split('\r\n')[1]).toBe('2026-11-20,450,Gastos personales,"a, b",,manual');
  });
});
