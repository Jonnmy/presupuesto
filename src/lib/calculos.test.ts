import { describe, expect, it } from 'vitest';
import {
  ahorroAcumulado, costoCompraSirena, estadoCategoria, estimadoMeta, fechasRecurrente, gastado, laborablesEnQuincena,
  metaAhorro, presupuestoTransporte, proyeccionAhorro, recurrentesPendientes, totalPresupuestado, vistaMes, vistaQuincena,
  disponible, sobrante, ingresoQuincena, libreParaGastar, vistaBloques, gastoPorMetodo, mensualEquivalente, gastoDiario, comparativaQuincenas,
} from './calculos';
import { quincenaDe, hoy, formatoFecha, formatoQuincena, diaSemana } from './fechas';
import { rd, leerMonto } from './formato';
import { ajustesIniciales, catalogoInicial, categoriasIniciales, ID, recurrentesIniciales } from './semilla';
import type { Datos, Gasto } from './tipos';

const Q2_NOV = quincenaDe('2026-11-16');

function datos(extra: Partial<Datos> = {}): Datos {
  return {
    ajustes: ajustesIniciales('2026-11-01T00:00:00.000Z'),
    categorias: categoriasIniciales(),
    gastos: [], ingresos: [], depositos: [], diasLibres: [], planificados: [],
    ...extra,
  };
}

let n = 0;
const gasto = (fecha: string, monto: number, categoriaId: string, extra: Partial<Gasto> = {}): Gasto =>
  ({ id: `g${++n}`, fecha, monto, categoriaId, origen: 'manual', creadoEn: '2026-11-01T00:00:00Z', ...extra });

describe('Pruebas de aceptación (sección 12)', () => {
  it('1. Catálogo de Sirena: 4,639 por 15 días y 8,845 por mes (3,974 y 7,515 de la lista original + frutas, verduras, aguacate y sardinas)', () => {
    expect(costoCompraSirena(catalogoInicial(), 'quincena')).toBe(4639);
    expect(costoCompraSirena(catalogoInicial(), 'mes')).toBe(8845);
  });

  it('2. Suma de presupuestos de gasto por quincena = 13,179', () => {
    expect(totalPresupuestado(Q2_NOV, datos())).toBe(13179);
  });

  it('3. Meta de ahorro por quincena = 8,821', () => {
    expect(metaAhorro(Q2_NOV, datos())).toBe(8821);
  });

  it('4. Meta con la inscripción del gimnasio (2,000) = 6,821', () => {
    const d = datos({ planificados: [{ id: 'p', nombre: 'Inscripción del gimnasio', monto: 2000, fecha: '2026-11-22' }] });
    expect(metaAhorro(Q2_NOV, d)).toBe(6821);
    // No afecta otras quincenas
    expect(metaAhorro(quincenaDe('2026-12-01'), { ...d, ajustes: { ...d.ajustes, transporteModo: 'fijo' } })).toBe(8821);
  });

  it('5. Presupuesto mensual 26,358 y ahorro mensual 17,642 (transporte en modo fijo de 3,640)', () => {
    const d = datos();
    d.ajustes.transporteModo = 'fijo';
    const v = vistaMes({ anio: 2026, mes: 11 }, d);
    expect(v.ingreso).toBe(44000);
    expect(v.presupuestado).toBe(26358);
    expect(v.meta).toBe(17642);
  });

  it('6. quincenaDe', () => {
    expect(quincenaDe('2026-11-15')).toEqual({ inicio: '2026-11-01', fin: '2026-11-15', numero: 1, anio: 2026, mes: 11 });
    expect(quincenaDe('2026-11-16')).toEqual({ inicio: '2026-11-16', fin: '2026-11-30', numero: 2, anio: 2026, mes: 11 });
    expect(quincenaDe('2027-02-20').fin).toBe('2027-02-28');
    expect(quincenaDe('2028-02-20').fin).toBe('2028-02-29');
  });

  it('7. 13 días laborables del 16 al 30 nov 2026 y transporte 13 × 280 = 3,640', () => {
    const d = datos();
    expect(laborablesEnQuincena(Q2_NOV, d.ajustes, [])).toBe(13);
    expect(presupuestoTransporte(Q2_NOV, d.ajustes, [])).toBe(3640);
  });

  it('8. Un día libre baja a 12 laborables y transporte 3,360', () => {
    const d = datos();
    const libres = [{ fecha: '2026-11-18' }];
    expect(laborablesEnQuincena(Q2_NOV, d.ajustes, libres)).toBe(12);
    expect(presupuestoTransporte(Q2_NOV, d.ajustes, libres)).toBe(3360);
    // Un domingo marcado como libre no cambia nada
    expect(laborablesEnQuincena(Q2_NOV, d.ajustes, [{ fecha: '2026-11-22' }])).toBe(13);
  });

  it('9. Estados de Dieta con presupuesto 3,974', () => {
    expect(estadoCategoria(3000, 3974)).toBe('ok');
    expect(estadoCategoria(3200, 3974)).toBe('alerta');
    expect(estadoCategoria(4000, 3974)).toBe('excedido');
    const d = datos({ gastos: [gasto('2026-11-20', 3800, ID.dieta)] });
    expect(vistaQuincena(Q2_NOV, d).filas.find((f) => f.categoria.id === ID.dieta)?.estado).toBe('alerta');
  });

  it('10. La mensualidad completa del gimnasio en una quincena no queda excedida', () => {
    const d = datos({ gastos: [gasto('2026-11-02', 2800, ID.gimnasio)] });
    const mes = vistaMes({ anio: 2026, mes: 11 }, d).filas.find((f) => f.categoria.id === ID.gimnasio)!;
    expect(mes.presupuesto).toBe(2800);
    expect(mes.estado).not.toBe('excedido');
    const q1 = vistaQuincena(quincenaDe('2026-11-02'), d).filas.find((f) => f.categoria.id === ID.gimnasio)!;
    expect(q1.presupuesto).toBe(1400); // provisión
    expect(q1.estado).not.toBe('excedido'); // se evalúa contra el mes
  });
});

describe('Otros cálculos', () => {
  it('sin presupuesto no hay porcentaje', () => {
    expect(estadoCategoria(500, 0)).toBe('sin-presupuesto');
  });

  it('ingreso, gastado, disponible y sobrante', () => {
    const d = datos({
      gastos: [gasto('2026-11-16', 1000, ID.dieta), gasto('2026-11-15', 999, ID.dieta)],
      ingresos: [{ id: 'i', fecha: '2026-11-20', monto: 3000, nota: 'Bono' }],
      depositos: [{ id: 'd', fecha: '2026-11-30', monto: 5000 }],
    });
    expect(ingresoQuincena(Q2_NOV, d)).toBe(25000);
    expect(gastado(Q2_NOV, d)).toBe(1000);
    expect(disponible(Q2_NOV, d)).toBe(19000);
    expect(sobrante(Q2_NOV, d)).toBe(24000);
  });

  it('proyección: antes de empezar = meta; al terminar = sobrante real', () => {
    const d = datos({ gastos: [gasto('2026-11-17', 6000, ID.personal)] });
    expect(proyeccionAhorro(Q2_NOV, datos(), '2026-11-16')).toBe(8821);
    expect(proyeccionAhorro(Q2_NOV, d, '2026-12-05')).toBe(16000);
    expect(proyeccionAhorro(Q2_NOV, datos(), '2026-11-01')).toBe(8821);
    // A mitad de quincena sin gastos, la proyección sube; pero si la app se instaló hoy, es la meta
    expect(proyeccionAhorro(Q2_NOV, datos(), '2026-11-22')).toBeGreaterThan(8821);
    const nueva = datos();
    nueva.ajustes.creadoEn = '2026-11-22T15:00:00Z';
    expect(proyeccionAhorro(Q2_NOV, nueva, '2026-11-22')).toBe(8821);
  });

  it('ahorro acumulado y estimado de meta', () => {
    const deps = [{ id: 'a', fecha: '2026-10-01', monto: 5000 }, { id: 'b', fecha: '2026-10-31', monto: 5000 }];
    expect(ahorroAcumulado(deps)).toBe(10000);
    expect(estimadoMeta(0, deps, '2026-10-31')).toBeNull();
    expect(estimadoMeta(5000, deps, '2026-10-31')).toBe('2026-10-31');
    expect(estimadoMeta(20000, deps, '2026-10-31')).toBe('2026-11-30');
  });

  it('recurrentes: nunca duplica y respeta días laborables', () => {
    const d = datos();
    const recs = recurrentesIniciales().map((r) => ({ ...r, automatico: true, desde: '2026-11-16' }));
    const pend = recurrentesPendientes(recs, [], '2026-11-22', d.ajustes, []);
    expect(pend.filter((g) => g.recurrenteId === ID.recPasaje)).toHaveLength(6); // lun–sáb
    expect(pend.filter((g) => g.recurrenteId === ID.recGimnasio)).toHaveLength(0); // el día 1 ya pasó
    const yaHechos = pend.map((g, i) => ({ ...g, id: `x${i}`, creadoEn: '' }));
    expect(recurrentesPendientes(recs, yaHechos, '2026-11-22', d.ajustes, [])).toHaveLength(0);
  });

  it('recurrentes cada 2 meses', () => {
    const r = { ...recurrentesIniciales()[1], frecuencia: 'cada-n-meses' as const, cadaNMeses: 2, desde: '2026-11-01' };
    expect(fechasRecurrente(r, '2026-11-01', '2027-04-30', ajustesIniciales(''), [])).toEqual(['2026-11-01', '2027-01-01', '2027-03-01']);
  });

  it('formato', () => {
    expect(rd(22000)).toBe('RD$22,000');
    expect(rd(-500.4)).toBe('−RD$500');
    expect(leerMonto('1,250')).toBe(1250);
    expect(formatoFecha('2026-11-22')).toBe('22 nov 2026');
    expect(formatoQuincena(Q2_NOV)).toBe('16–30 nov 2026');
    expect(diaSemana('2026-11-22')).toBe(0);
    // 23:30 del 21 nov en Santo Domingo = 03:30 UTC del 22
    expect(hoy(new Date('2026-11-22T03:30:00Z'))).toBe('2026-11-21');
  });
});

describe('Rediseño: libre para gastar, ritmo, bloques y métodos', () => {
  it('libre para gastar = presupuesto variable cuando no hay gastos (16–30 nov)', () => {
    const l = libreParaGastar(Q2_NOV, datos(), '2026-11-16');
    expect(l.fijos).toBe(1400); // gimnasio (servicios en 0)
    expect(l.meta).toBe(8821);
    expect(l.presupuestoVariable).toBe(4639 + 3640 + 3500);
    expect(l.libre).toBe(11779);
    expect(l.diasRestantes).toBe(15);
    expect(l.diaActual).toBe(1);
  });

  it('gastos variables bajan el libre; pagar el gimnasio completo sube los fijos', () => {
    const d = datos({ gastos: [gasto('2026-11-17', 1000, ID.dieta), gasto('2026-11-17', 2800, ID.gimnasio)] });
    const l = libreParaGastar(Q2_NOV, d, '2026-11-20');
    expect(l.gastadoVariable).toBe(1000);
    expect(l.fijos).toBe(2800);
    expect(l.libre).toBe(22000 - 2800 - 8821 - 1000);
    expect(l.diasRestantes).toBe(11); // 20 al 30
    expect(l.diario).toBeCloseTo(l.libre / 11);
  });

  it('ritmo: alerta cuando se gasta más rápido que el ideal, excedido cuando el libre es negativo', () => {
    const rapido = datos({ gastos: [gasto('2026-11-16', 6000, ID.personal)] });
    const l = libreParaGastar(Q2_NOV, rapido, '2026-11-17');
    expect(l.ritmo).toBe('alerta');
    expect(l.margen).toBeLessThan(0);
    const sobregiro = datos({ gastos: [gasto('2026-11-16', 15000, ID.personal)] });
    expect(libreParaGastar(Q2_NOV, sobregiro, '2026-11-17').ritmo).toBe('excedido');
    expect(libreParaGastar(Q2_NOV, datos(), '2026-11-25').ritmo).toBe('ok');
  });

  it('bloques 50/30/20 sobre el ingreso', () => {
    const d = datos({
      gastos: [gasto('2026-11-20', 4000, ID.dieta), gasto('2026-11-20', 2800, ID.gimnasio), gasto('2026-11-21', 500, ID.personal)],
      depositos: [{ id: 'x', fecha: '2026-11-30', monto: 3000 }],
    });
    const [n, e, a] = vistaBloques(Q2_NOV, 22000, d);
    expect(n).toMatchObject({ bloque: 'necesidades', limite: 11000, usado: 4000, estado: 'ok' });
    expect(e).toMatchObject({ bloque: 'estilo', limite: 6600, usado: 3300, estado: 'ok' });
    expect(a).toMatchObject({ bloque: 'ahorro', limite: 4400, usado: 3000 });
  });

  it('gasto por método de pago', () => {
    const d = datos({ gastos: [
      gasto('2026-11-20', 100, ID.dieta, { metodo: 'tarjeta' }), gasto('2026-11-20', 50, ID.dieta, { metodo: 'efectivo' }),
      gasto('2026-11-20', 30, ID.dieta), gasto('2026-11-20', 20, ID.dieta, { metodo: 'transferencia' }),
    ] });
    expect(gastoPorMetodo(Q2_NOV, d)).toEqual({ tarjeta: 100, efectivo: 80, transferencia: 20 });
  });

  it('recurrente quincenal cae en las dos quincenas y suma el doble al mes', () => {
    const r = { id: 'r', nombre: 'Internet', categoriaId: 'cat-servicios', monto: 900, frecuencia: 'quincenal' as const, diaDelMes: 5, automatico: true, activo: true };
    expect(fechasRecurrente(r, '2026-11-01', '2026-12-31', ajustesIniciales(''), [])).toEqual(['2026-11-05', '2026-11-20', '2026-12-05', '2026-12-20']);
    expect(mensualEquivalente(r)).toBe(1800);
    expect(mensualEquivalente({ ...r, frecuencia: 'cada-n-meses', cadaNMeses: 3 })).toBe(300);
  });

  it('gasto diario y comparativa', () => {
    const d = datos({ gastos: [gasto('2026-11-16', 100, ID.dieta), gasto('2026-11-16', 50, ID.dieta), gasto('2026-11-18', 70, ID.personal)] });
    const serie = gastoDiario(Q2_NOV, d);
    expect(serie).toHaveLength(15);
    expect(serie[0]).toEqual({ fecha: '2026-11-16', monto: 150 });
    expect(serie[2].monto).toBe(70);
    expect(comparativaQuincenas([Q2_NOV], d)[0]).toMatchObject({ ingreso: 22000, gastado: 220, ahorrado: 0 });
  });

  it('creadoEn en UTC después de las 8 p. m. cuenta como el día local', () => {
    const d = datos();
    d.ajustes = { ...d.ajustes, creadoEn: '2026-11-24T00:30:00.000Z' }; // 23 nov, 8:30 p. m. en Santo Domingo
    const l = libreParaGastar(Q2_NOV, d, '2026-11-23');
    expect(l.diaActual).toBe(1);
    expect(l.diasTotales).toBe(8);
  });
});
