import { describe, expect, it } from 'vitest';
import { ajustesIniciales, categoriasIniciales, CAT } from '../db/semilla';
import { dinero, leerDinero, rd } from './dinero';
import { sumarMeses } from './fechas';
import {
  alertas, disponible, gastosPorCategoria, historialPresupuesto, instanciaPresupuesto, libreHastaCobro, patrimonio, proximoDia, recomendaciones,
  resumenDeudas, saldoCuenta, tarjetas, totales, vencimientosEn,
} from './finanzas';
import { periodoAnterior, quincenaDe, rangoVista, semanaDe } from './periodos';
import { mensualEquivalente, primeraFechaDesde, siguiente, vencimientos } from './recurrencia';
import type { Cuenta, Datos, Movimiento, Presupuesto, Programado } from './tipos';
import { posibleDuplicado, validarMovimiento } from './validar';

const A = ajustesIniciales(new Date('2026-11-01T12:00:00Z'));
let n = 0;
const mov = (x: Partial<Movimiento>): Movimiento => ({
  id: `m${++n}`, tipo: 'gasto', nombre: 'x', monto: rd(100), fecha: '2026-11-20', cuentaId: 'banco', categoriaId: CAT.alimentacion,
  estado: 'pagado', creadoEn: `2026-11-20T10:00:0${n % 10}Z`, ...x,
});
const cuenta = (id: string, tipo: Cuenta['tipo'], saldo = 0, extra: Partial<Cuenta> = {}): Cuenta => ({ id, nombre: id, tipo, saldoInicial: saldo, fechaInicial: '2026-11-01', orden: 0, creadoEn: '', ...extra });

function datos(movimientos: Movimiento[] = [], extra: Partial<Datos> = {}): Datos {
  return {
    ajustes: A,
    cuentas: [cuenta('efectivo', 'efectivo', rd(2000)), cuenta('banco', 'banco', rd(10000)), cuenta('ahorros', 'ahorro', rd(5000)), cuenta('visa', 'tarjeta', 0, { limite: rd(20000), diaCorte: 20, diaPago: 10 })],
    categorias: categoriasIniciales(), movimientos, programados: [], deudas: [], metas: [], presupuestos: [], ...extra,
  };
}

describe('Dinero', () => {
  it('formatea en RD$ con dos decimales y lee lo que escribe el usuario', () => {
    expect(dinero(100000)).toBe('RD$ 1,000.00');
    expect(dinero(-5050)).toBe('−RD$ 50.50');
    expect(leerDinero('1,250.50')).toBe(125050);
    expect(leerDinero('RD$ 3,974')).toBe(397400);
    expect(leerDinero('12.345')).toBeNull();
    expect(leerDinero('abc')).toBeNull();
  });
  it('suma centavos sin errores de punto flotante', () => {
    expect(rd(0.1) + rd(0.2)).toBe(rd(0.3));
  });
});

describe('Períodos', () => {
  it('quincena 1–15 y 16–fin de mes, también en febrero', () => {
    expect(quincenaDe('2026-11-15')).toEqual({ inicio: '2026-11-01', fin: '2026-11-15' });
    expect(quincenaDe('2026-11-16')).toEqual({ inicio: '2026-11-16', fin: '2026-11-30' });
    expect(quincenaDe('2026-02-20')).toEqual({ inicio: '2026-02-16', fin: '2026-02-28' });
  });
  it('quincenas según días de cobro personalizados (15 y 30)', () => {
    const q = { dia1: 15, dia2: 30 };
    expect(quincenaDe('2026-11-20', q)).toEqual({ inicio: '2026-11-15', fin: '2026-11-29' });
    expect(quincenaDe('2026-12-03', q)).toEqual({ inicio: '2026-11-30', fin: '2026-12-14' });
    expect(quincenaDe('2026-02-28', q)).toEqual({ inicio: '2026-02-28', fin: '2026-03-14' });
    expect(quincenaDe('2026-03-01', q)).toEqual({ inicio: '2026-02-28', fin: '2026-03-14' });
  });
  it('semanas de lunes a domingo y navegación entre períodos', () => {
    expect(semanaDe('2026-11-25', 1)).toEqual({ inicio: '2026-11-23', fin: '2026-11-29' });
    expect(semanaDe('2026-11-29', 1)).toEqual({ inicio: '2026-11-23', fin: '2026-11-29' });
    expect(rangoVista('quincena', '2026-11-25', A, -1)).toEqual({ inicio: '2026-11-01', fin: '2026-11-15' });
    expect(rangoVista('quincena', '2026-11-25', A, -2)).toEqual({ inicio: '2026-10-16', fin: '2026-10-31' });
    expect(rangoVista('mes', '2026-01-31', A, 1)).toEqual({ inicio: '2026-02-01', fin: '2026-02-28' });
    expect(rangoVista('30d', '2026-11-25', A)).toEqual({ inicio: '2026-10-27', fin: '2026-11-25' });
    expect(periodoAnterior('semana', semanaDe('2026-11-25'), A)).toEqual({ inicio: '2026-11-16', fin: '2026-11-22' });
  });
  it('sumar meses conserva el día original después de febrero', () => {
    expect(sumarMeses('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(sumarMeses('2026-02-28', 1, 31)).toBe('2026-03-31');
  });
});

describe('Recurrencia', () => {
  const salario: Programado = { id: 's', tipo: 'ingreso', nombre: 'Salario', monto: rd(22000), frecuencia: 'quincenal', diasQuincena: [15, 31], proximaFecha: '2026-11-15', clase: 'fijo', avisoDias: 0, activo: true, creadoEn: '' };
  it('quincenal los días 15 y último de cada mes', () => {
    expect(vencimientos(salario, { inicio: '2026-11-01', fin: '2027-03-01' })).toEqual([
      '2026-11-15', '2026-11-30', '2026-12-15', '2026-12-31', '2027-01-15', '2027-01-31', '2027-02-15', '2027-02-28',
    ]);
    expect(primeraFechaDesde('2026-11-25', salario)).toBe('2026-11-30');
  });
  it('mensual el 31 no se encoge después de febrero; semanal y personalizado', () => {
    const r = { frecuencia: 'mensual' as const, diaMes: 31 };
    expect(siguiente('2026-01-31', r)).toBe('2026-02-28');
    expect(siguiente('2026-02-28', r)).toBe('2026-03-31');
    expect(siguiente('2026-11-25', { frecuencia: 'semanal' })).toBe('2026-12-02');
    expect(siguiente('2026-11-25', { frecuencia: 'personalizada', cadaDias: 10 })).toBe('2026-12-05');
    expect(siguiente('2026-11-25', { frecuencia: 'unica' })).toBeNull();
    expect(mensualEquivalente({ ...salario, monto: rd(1000), frecuencia: 'quincenal' })).toBe(rd(2000));
  });
});

describe('Saldos y patrimonio', () => {
  it('ingresos suman, gastos restan, pendientes no tocan el saldo', () => {
    const d = datos([
      mov({ tipo: 'ingreso', monto: rd(22000), categoriaId: CAT.salario }),
      mov({ monto: rd(1500) }),
      mov({ monto: rd(800), estado: 'pendiente' }),
    ]);
    expect(saldoCuenta(d.cuentas[1], d.movimientos)).toBe(rd(10000 + 22000 - 1500));
    expect(disponible(d)).toBe(rd(2000 + 30500));
    const t = totales(d.movimientos, { inicio: '2026-11-01', fin: '2026-11-30' });
    expect(t).toMatchObject({ ingresos: rd(22000), gastos: rd(1500), pendientes: rd(800) });
  });
  it('las transferencias no cambian el patrimonio ni cuentan como gasto o ingreso', () => {
    const antes = datos();
    const d = datos([mov({ tipo: 'transferencia', monto: rd(3000), cuentaId: 'banco', cuentaDestinoId: 'efectivo', categoriaId: undefined })]);
    expect(saldoCuenta(d.cuentas[0], d.movimientos)).toBe(rd(5000));
    expect(saldoCuenta(d.cuentas[1], d.movimientos)).toBe(rd(7000));
    expect(patrimonio(d)).toBe(patrimonio(antes));
    expect(totales(d.movimientos, { inicio: '2026-11-01', fin: '2026-11-30' })).toMatchObject({ ingresos: 0, gastos: 0 });
  });
  it('compra con tarjeta es gasto; pagar la tarjeta es transferencia y no se cuenta dos veces', () => {
    const d = datos([
      mov({ monto: rd(4000), cuentaId: 'visa', metodo: 'credito' }),
      mov({ tipo: 'transferencia', monto: rd(4000), cuentaId: 'banco', cuentaDestinoId: 'visa', categoriaId: undefined, fecha: '2026-11-25' }),
    ]);
    const r = { inicio: '2026-11-01', fin: '2026-11-30' };
    expect(totales(d.movimientos, r).gastos).toBe(rd(4000));
    expect(tarjetas(d)[0].deuda).toBe(0);
    expect(saldoCuenta(d.cuentas[1], d.movimientos)).toBe(rd(6000));
    // la compra sí reduce el patrimonio, una sola vez
    expect(patrimonio(d)).toBe(patrimonio(datos()) - rd(4000));
  });
  it('la tarjeta muestra deuda, disponible y próximas fechas de corte y pago', () => {
    const d = datos([mov({ monto: rd(5000), cuentaId: 'visa' })]);
    const t = tarjetas(d, '2026-11-25')[0];
    expect(t).toMatchObject({ deuda: rd(5000), disponible: rd(15000), proximoCorte: '2026-12-20', proximoPago: '2026-12-10' });
    expect(proximoDia(31, '2027-02-10')).toBe('2027-02-28');
  });
  it('movimientos anteriores al saldo inicial no lo alteran', () => {
    const d = datos([mov({ fecha: '2026-10-20', monto: rd(999) })]);
    expect(saldoCuenta(d.cuentas[1], d.movimientos)).toBe(rd(10000));
  });
});

describe('Deudas y metas', () => {
  it('los abonos bajan el saldo de la deuda y de la cuenta, y cuentan como gasto en Deudas', () => {
    const deuda = { id: 'p1', nombre: 'Préstamo', acreedor: 'Banco', montoOriginal: rd(50000), saldoInicial: rd(30000), cuota: rd(5000), fechaInicio: '2026-01-01', creadoEn: '' };
    const d = datos([mov({ tipo: 'pagoDeuda', deudaId: 'p1', monto: rd(5000), categoriaId: undefined })], { deudas: [deuda] });
    const r = resumenDeudas(d);
    expect(r.prestamos[0]).toMatchObject({ pendiente: rd(25000), pagado: rd(25000) });
    expect(saldoCuenta(d.cuentas[1], d.movimientos)).toBe(rd(5000));
    expect(gastosPorCategoria(d.movimientos, { inicio: '2026-11-01', fin: '2026-11-30' }).get(CAT.deudas)).toBe(rd(5000));
    expect(patrimonio(d)).toBe(patrimonio(datos([], { deudas: [deuda] })));
  });
  it('validación impide abonar más de lo que se debe o retirar más de lo ahorrado', () => {
    const deuda = { id: 'p1', nombre: 'P', acreedor: 'B', montoOriginal: rd(1000), saldoInicial: rd(1000), cuota: 0, fechaInicio: '2026-01-01', creadoEn: '' };
    const meta = { id: 'm1', nombre: 'Viaje', objetivo: rd(10000), saldoInicial: rd(500), fechaCreacion: '2026-11-01' };
    const d = datos([], { deudas: [deuda], metas: [meta] });
    expect(validarMovimiento(mov({ tipo: 'pagoDeuda', deudaId: 'p1', monto: rd(1500) }), d)).toMatch(/mayor/);
    expect(validarMovimiento(mov({ tipo: 'retiro', metaId: 'm1', monto: rd(600) }), d)).toMatch(/retirar/);
    expect(validarMovimiento(mov({ tipo: 'transferencia', cuentaDestinoId: 'banco' }), d)).toMatch(/distintas/);
    expect(validarMovimiento(mov({ monto: 0 }), d)).toMatch(/mayor que cero/);
  });
});

describe('Presupuestos', () => {
  const p: Presupuesto = {
    id: 'q', nombre: 'Mi quincena', periodo: 'quincenal', activo: true, creadoEn: '2026-10-01T00:00:00Z',
    versiones: [{ desde: '2000-01-01', total: rd(22000), limites: { [CAT.alimentacion]: rd(3974), [CAT.transporte]: rd(4200) } }],
  };
  it('se calcula con las fechas reales de la quincena y separa pagado de pendiente', () => {
    const d = datos([
      mov({ fecha: '2026-11-15', monto: rd(9999) }), // quincena anterior: no cuenta
      mov({ fecha: '2026-11-16', monto: rd(3000) }),
      mov({ fecha: '2026-11-20', monto: rd(500), categoriaId: CAT.transporte }),
      mov({ fecha: '2026-11-28', monto: rd(1200), estado: 'pendiente' }),
      mov({ fecha: '2026-11-21', monto: rd(700), categoriaId: CAT.entretenimiento }),
    ]);
    const i = instanciaPresupuesto(p, '2026-11-25', d, '2026-11-25');
    expect(i.rango).toEqual({ inicio: '2026-11-16', fin: '2026-11-30' });
    expect(i.gastado).toBe(rd(4200));
    expect(i.pendiente).toBe(rd(1200));
    expect(i.restante).toBe(rd(22000 - 4200 - 1200));
    const ali = i.filas.find((f) => f.categoriaId === CAT.alimentacion)!;
    expect(ali).toMatchObject({ gastado: rd(3000), pendiente: rd(1200), estado: 'excedido' });
    expect(i.sinLimite).toEqual([{ categoriaId: CAT.entretenimiento, gastado: rd(700) }]);
    expect(i.diasRestantes).toBe(6);
  });
  it('editar el presupuesto no cambia los períodos anteriores (versiones)', () => {
    const editado = { ...p, versiones: [...p.versiones, { desde: '2026-11-16', total: rd(20000), limites: {} }] };
    const d = datos();
    expect(instanciaPresupuesto(editado, '2026-11-10', d).total).toBe(rd(22000));
    expect(instanciaPresupuesto(editado, '2026-11-20', d).total).toBe(rd(20000));
    expect(historialPresupuesto(editado, d, '2026-11-25', 3).map((x) => x.rango.inicio)).toEqual(['2026-11-16', '2026-11-01', '2026-10-16']);
  });
});

describe('Compromisos, libre hasta el cobro y alertas', () => {
  const internet: Programado = { id: 'net', tipo: 'gasto', nombre: 'Internet', monto: rd(1500), frecuencia: 'mensual', diaMes: 28, proximaFecha: '2026-11-28', categoriaId: CAT.internet, cuentaId: 'banco', clase: 'fijo', avisoDias: 3, activo: true, creadoEn: '' };
  const luz: Programado = { ...internet, id: 'luz', nombre: 'Luz', monto: rd(900), proximaFecha: '2026-11-20' };
  const salario: Programado = { id: 's', tipo: 'ingreso', nombre: 'Salario', monto: rd(22000), frecuencia: 'quincenal', diasQuincena: [15, 31], proximaFecha: '2026-11-30', cuentaId: 'banco', clase: 'fijo', avisoDias: 0, activo: true, creadoEn: '' };
  it('libre = disponible − compromisos (incluidos vencidos) − pendientes antes del cobro', () => {
    const d = datos([mov({ fecha: '2026-11-27', monto: rd(600), estado: 'pendiente' })], { programados: [internet, luz, salario] });
    const l = libreHastaCobro(d, '2026-11-25');
    expect(l.cobro?.fecha).toBe('2026-11-30');
    expect(l.disponible).toBe(rd(12000));
    expect(l.comprometido).toBe(rd(1500 + 900 + 600));
    expect(l.libre).toBe(rd(12000 - 3000));
    expect(l.dias).toBe(5);
    expect(vencimientosEn(d.programados, { inicio: '2026-11-25', fin: '2026-12-31' }, '2026-11-25', 'gasto').map((v) => v.fecha)).toEqual(['2026-11-20', '2026-11-28', '2026-12-28', '2026-12-28']);
  });
  it('alertas de presupuesto, vencimientos y saldo negativo', () => {
    const p: Presupuesto = { id: 'q', nombre: 'Q', periodo: 'quincenal', activo: true, creadoEn: '', versiones: [{ desde: '2000-01-01', total: rd(1000), limites: {} }] };
    const d = datos([mov({ fecha: '2026-11-24', monto: rd(900), cuentaId: 'efectivo' }), mov({ fecha: '2026-11-24', monto: rd(1500), cuentaId: 'efectivo', categoriaId: CAT.otros })], { programados: [internet, luz], presupuestos: [p] });
    const textos = alertas(d, '2026-11-25').map((a) => a.texto).join(' | ');
    expect(textos).toMatch(/Superaste el presupuesto "Q"/);
    expect(textos).toMatch(/Luz venció/);
    expect(textos).toMatch(/Internet vence en 3 días/);
    expect(textos).toMatch(/efectivo está en negativo/);
  });
  it('recomendaciones señalan la categoría principal', () => {
    const d = datos([mov({ monto: rd(5000) }), mov({ monto: rd(1000), categoriaId: CAT.transporte }), mov({ tipo: 'ingreso', monto: rd(10000), categoriaId: CAT.salario })]);
    const r = recomendaciones(d, { inicio: '2026-11-01', fin: '2026-11-30' }, { inicio: '2026-10-01', fin: '2026-10-31' }, (id) => id === CAT.alimentacion ? 'Alimentación' : id, (c) => dinero(c));
    expect(r[0]).toMatch(/Alimentación/);
    expect(r[1]).toMatch(/40%/);
  });
  it('detecta posibles duplicados', () => {
    const a = mov({ nombre: 'Colmado' });
    expect(posibleDuplicado({ ...a, id: 'otro', nombre: 'colmado ' }, [a])).toBe(a);
    expect(posibleDuplicado({ ...a, id: 'otro', monto: rd(101) }, [a])).toBeUndefined();
  });
});
