import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { rd } from '../nucleo/dinero';
import { saldoCuenta } from '../nucleo/finanzas';
import type { Movimiento } from '../nucleo/tipos';
import {
  cargarDatos, eliminarCategoria, eliminarCuenta, eliminarMovimiento, ErrorUsuario, guardarMovimiento, guardarPresupuesto,
  omitirVencimiento, registrarVencimiento, restaurarMovimiento,
} from './acciones';
import { BaseDatos } from './db';
import { borrarTodo, exportarDatos, importarDatos, movimientosACsv, validarRespaldo } from './respaldo';
import { CAT, CUENTA, importarLegado, sembrar } from './semilla';

let base: BaseDatos;
let n = 0;
beforeEach(async () => {
  base = new BaseDatos(`prueba-${++n}`);
  await sembrar(base, new Date('2026-11-25T15:00:00Z'));
});

const gasto = (x: Partial<Movimiento> = {}): Movimiento => ({
  id: `g${Math.random()}`, tipo: 'gasto', nombre: 'Colmado', monto: rd(250), fecha: '2026-11-25', cuentaId: CUENTA.efectivo,
  categoriaId: CAT.alimentacion, estado: 'pagado', creadoEn: '', ...x,
});

describe('Semilla', () => {
  it('crea cuentas, 13 categorías de gasto, el salario quincenal y el presupuesto de la quincena', async () => {
    const d = (await cargarDatos(base))!;
    expect(d.cuentas.map((c) => c.nombre)).toEqual(['Efectivo', 'Cuenta bancaria']);
    expect(d.categorias.filter((c) => c.tipo === 'gasto')).toHaveLength(13);
    expect(d.programados[0]).toMatchObject({ nombre: 'Salario', monto: rd(22000), proximaFecha: '2026-11-30' });
    expect(d.presupuestos[0].versiones[0]).toMatchObject({ total: rd(22000), limites: { [CAT.alimentacion]: rd(3974), [CAT.transporte]: rd(4200) } });
    expect(d.ajustes).toMatchObject({ moneda: 'DOP', formatoFecha: 'DD/MM/AAAA', zona: 'America/Santo_Domingo' });
    expect(await sembrar(base)).toBe(false); // idempotente
  });
});

describe('Movimientos', () => {
  it('crear, editar y eliminar un gasto actualiza el saldo', async () => {
    const g = await guardarMovimiento(gasto(), base);
    let d = (await cargarDatos(base))!;
    expect(saldoCuenta(d.cuentas[0], d.movimientos)).toBe(-rd(250));
    await guardarMovimiento({ ...g, monto: rd(400) }, base);
    d = (await cargarDatos(base))!;
    expect(saldoCuenta(d.cuentas[0], d.movimientos)).toBe(-rd(400));
    expect(d.movimientos[0].actualizadoEn).toBeTruthy();
    await eliminarMovimiento(g.id, base);
    expect(await base.movimientos.count()).toBe(0);
  });
  it('rechaza datos inválidos con un mensaje claro', async () => {
    await expect(guardarMovimiento(gasto({ monto: -5 }), base)).rejects.toThrow(ErrorUsuario);
    await expect(guardarMovimiento(gasto({ categoriaId: 'nada' }), base)).rejects.toThrow('Elige una categoría.');
    await expect(guardarMovimiento(gasto({ fecha: '2026-02-30' }), base)).rejects.toThrow('fecha');
  });
});

describe('Compromisos sin duplicados', () => {
  it('pagar registra el gasto una sola vez y avanza al siguiente vencimiento; borrar lo devuelve', async () => {
    await base.programados.add({ id: 'net', tipo: 'gasto', nombre: 'Internet', monto: rd(1500), frecuencia: 'mensual', diaMes: 28, proximaFecha: '2026-11-28', categoriaId: CAT.internet, cuentaId: CUENTA.banco, clase: 'fijo', avisoDias: 3, activo: true, creadoEn: '' });
    const m = await registrarVencimiento('net', {}, base);
    expect(m).toMatchObject({ ocurrencia: '2026-11-28', monto: rd(1500), tipo: 'gasto' });
    expect((await base.programados.get('net'))!.proximaFecha).toBe('2026-12-28');
    // un movimiento manual con el mismo vencimiento es rechazado por la base
    await expect(base.movimientos.add({ ...m, id: 'dup' })).rejects.toThrow();
    await eliminarMovimiento(m.id, base);
    expect((await base.programados.get('net'))!.proximaFecha).toBe('2026-11-28');
    await restaurarMovimiento(m, base);
    expect((await base.programados.get('net'))!.proximaFecha).toBe('2026-12-28');
    await omitirVencimiento('net', base);
    expect((await base.programados.get('net'))!.proximaFecha).toBe('2027-01-28');
    expect(await base.movimientos.count()).toBe(1);
  });
  it('recibir el salario crea el ingreso y salta al siguiente cobro', async () => {
    await registrarVencimiento('prog-salario', { fecha: '2026-11-30' }, base);
    const d = (await cargarDatos(base))!;
    expect(saldoCuenta(d.cuentas[1], d.movimientos)).toBe(rd(22000));
    expect(d.programados[0].proximaFecha).toBe('2026-12-15');
  });
});

describe('Cuentas, categorías y presupuestos', () => {
  it('una cuenta con movimientos se archiva en lugar de borrarse', async () => {
    await guardarMovimiento(gasto(), base);
    expect(await eliminarCuenta(CUENTA.efectivo, base)).toBe('archivada');
    await base.programados.update('prog-salario', { cuentaId: CUENTA.efectivo });
    await expect(eliminarCuenta(CUENTA.banco, base)).rejects.toThrow('al menos una cuenta');
  });
  it('borrar una categoría mueve sus movimientos y límites a otra', async () => {
    await guardarMovimiento(gasto(), base);
    await eliminarCategoria(CAT.alimentacion, CAT.otros, base);
    const d = (await cargarDatos(base))!;
    expect(d.movimientos[0].categoriaId).toBe(CAT.otros);
    expect(d.presupuestos[0].versiones[0].limites[CAT.otros]).toBe(rd(3974));
  });
  it('editar un presupuesto crea una versión desde el período actual', async () => {
    const p = (await base.presupuestos.get('pres-quincena'))!;
    await guardarPresupuesto(p, { total: rd(20000), limites: { [CAT.alimentacion]: rd(4000) } }, '2026-11-16', base);
    const x = (await base.presupuestos.get('pres-quincena'))!;
    expect(x.versiones.map((v) => [v.desde, v.total])).toEqual([['2000-01-01', rd(22000)], ['2026-11-16', rd(20000)]]);
    await expect(guardarPresupuesto(p, { total: rd(100), limites: { [CAT.alimentacion]: rd(4000) } }, '2026-11-16', base)).rejects.toThrow('suma de los límites');
  });
});

describe('Respaldos', () => {
  it('exportar, borrar todo e importar deja los datos idénticos; persiste al reabrir', async () => {
    await guardarMovimiento(gasto(), base);
    const r = await exportarDatos(base);
    expect(validarRespaldo(r)).toBeNull();
    await borrarTodo(base);
    expect(await base.movimientos.count()).toBe(0);
    await importarDatos(JSON.parse(JSON.stringify(r)), base);
    expect(await exportarDatos(base)).toMatchObject({ datos: r.datos });
    base.close();
    const reabierta = new BaseDatos(base.name);
    expect(await reabierta.movimientos.count()).toBe(1);
  });
  it('rechaza archivos que no son respaldos', () => {
    expect(validarRespaldo({ hola: 1 })).toMatch(/no es un respaldo/);
    expect(validarRespaldo({ formato: 'finanzas-personales', version: 1, datos: {} })).toMatch(/falta la tabla/);
  });
  it('CSV con encabezados y montos con decimales', async () => {
    const d = (await cargarDatos(base))!;
    const csv = movimientosACsv([gasto({ nombre: 'Pan, leche', monto: 12345 })], d.cuentas, d.categorias);
    expect(csv.split('\r\n')[1]).toBe('2026-11-25,Gasto,"Pan, leche",123.45,Alimentación,,Efectivo,,,,pagado,,');
  });
});

describe('Importación de la versión anterior', () => {
  it('trae gastos, ingresos y ahorro sin los datos de demostración', async () => {
    const vieja = new Dexie(`vieja-${n}`);
    vieja.version(1).stores({ gastos: 'id', ingresos: 'id', depositos: 'id' });
    await vieja.table('gastos').bulkAdd([
      { id: 'a', fecha: '2026-11-20', monto: 280, categoriaId: 'cat-transporte', nota: 'Pasaje', metodo: 'efectivo', origen: 'manual' },
      { id: 'b', fecha: '2026-11-20', monto: 999, categoriaId: 'cat-dieta', origen: 'demo' },
    ]);
    await vieja.table('ingresos').add({ id: 'i', fecha: '2026-11-18', monto: 2500, nota: 'Horas extra' });
    await vieja.table('depositos').add({ id: 'd', fecha: '2026-11-15', monto: 6000 });
    vieja.close();
    expect(await importarLegado(base, `vieja-${n}`)).toBe(2);
    const d = (await cargarDatos(base))!;
    expect(d.movimientos.find((m) => m.nombre === 'Pasaje')).toMatchObject({ monto: 28000, categoriaId: CAT.transporte });
    expect(d.metas[0]).toMatchObject({ saldoInicial: 600000 });
  });
});
