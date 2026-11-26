// Datos iniciales (República Dominicana) e importación única de la versión anterior de la app.
import Dexie from 'dexie';
import { rd } from '../nucleo/dinero';
import { esFecha, fechaDeIso, hoy } from '../nucleo/fechas';
import { CAT_DEUDAS } from '../nucleo/finanzas';
import { primeraFechaDesde } from '../nucleo/recurrencia';
import type { Ajustes, Categoria, Cuenta, Movimiento, Presupuesto, Programado } from '../nucleo/tipos';
import { db, type BaseDatos } from './db';

export function ajustesIniciales(ahora = new Date()): Ajustes {
  return {
    id: 'ajustes', moneda: 'DOP', simbolo: 'RD$', decimales: 2, formatoFecha: 'DD/MM/AAAA', zona: 'America/Santo_Domingo',
    tema: 'oscuro', inicioSemana: 1, quincena: { dia1: 1, dia2: 16 },
    alertas: { presupuestoPct: 80, diasPago: 3, saldoBajo: rd(1000), metaPct: 90 },
    creadoEn: ahora.toISOString(),
  };
}

const COLORES = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa', '#ec4899', '#22d3ee', '#f97316', '#84cc16', '#ef4444', '#14b8a6', '#eab308', '#6366f1', '#94a3b8'];

export const CAT = {
  alimentacion: 'cat-alimentacion', transporte: 'cat-transporte', vivienda: 'cat-vivienda', servicios: 'cat-servicios',
  internet: 'cat-internet', salud: 'cat-salud', educacion: 'cat-educacion', entretenimiento: 'cat-entretenimiento',
  compras: 'cat-compras', suscripciones: 'cat-suscripciones', deudas: CAT_DEUDAS, ahorros: 'cat-ahorros', otros: 'cat-otros',
  salario: 'cat-salario', comisiones: 'cat-comisiones', independiente: 'cat-independiente', otrosIngresos: 'cat-otros-ingresos',
};

export function categoriasIniciales(): Categoria[] {
  const g: [string, string, string[]][] = [
    [CAT.alimentacion, 'Alimentación', ['Supermercado', 'Comida fuera', 'Colmado']],
    [CAT.transporte, 'Transporte', ['Pasaje', 'Combustible', 'Taxi / app']],
    [CAT.vivienda, 'Vivienda', ['Alquiler', 'Mantenimiento']],
    [CAT.servicios, 'Servicios básicos', ['Electricidad', 'Agua', 'Gas']],
    [CAT.internet, 'Internet y teléfono', []],
    [CAT.salud, 'Salud', ['Gimnasio', 'Farmacia', 'Consultas']],
    [CAT.educacion, 'Educación', []],
    [CAT.entretenimiento, 'Entretenimiento', []],
    [CAT.compras, 'Compras personales', ['Ropa', 'Cuidado personal']],
    [CAT.suscripciones, 'Suscripciones', []],
    [CAT.deudas, 'Deudas', ['Préstamos', 'Tarjetas']],
    [CAT.ahorros, 'Ahorros', []],
    [CAT.otros, 'Otros', []],
  ];
  const i: [string, string][] = [[CAT.salario, 'Salario'], [CAT.comisiones, 'Comisiones'], [CAT.independiente, 'Trabajo independiente'], [CAT.otrosIngresos, 'Otros ingresos']];
  return [
    ...g.map(([id, nombre, subcategorias], n) => ({ id, nombre, tipo: 'gasto' as const, color: COLORES[n % COLORES.length], subcategorias, orden: n })),
    ...i.map(([id, nombre], n) => ({ id, nombre, tipo: 'ingreso' as const, color: COLORES[n % COLORES.length], subcategorias: [], orden: 100 + n })),
  ];
}

export const CUENTA = { efectivo: 'cta-efectivo', banco: 'cta-banco' };

/** Primera vez: cuentas, categorías, el salario quincenal y un presupuesto quincenal con lo que el usuario aparta. */
export async function sembrar(base: BaseDatos = db, ahora = new Date()): Promise<boolean> {
  if (await base.ajustes.get('ajustes')) return false;
  const f = hoy(ahora);
  const iso = ahora.toISOString();
  const cuentas: Cuenta[] = [
    { id: CUENTA.efectivo, nombre: 'Efectivo', tipo: 'efectivo', saldoInicial: 0, fechaInicial: f, orden: 0, creadoEn: iso },
    { id: CUENTA.banco, nombre: 'Cuenta bancaria', tipo: 'banco', saldoInicial: 0, fechaInicial: f, orden: 1, creadoEn: iso },
  ];
  const salario: Programado = {
    id: 'prog-salario', tipo: 'ingreso', nombre: 'Salario', monto: rd(22000), frecuencia: 'quincenal', diasQuincena: [15, 31],
    proximaFecha: primeraFechaDesde(f, { frecuencia: 'quincenal', diasQuincena: [15, 31] }),
    categoriaId: CAT.salario, cuentaId: CUENTA.banco, clase: 'fijo', fuente: 'Empleador', avisoDias: 0, activo: true, creadoEn: iso,
  };
  const presupuesto: Presupuesto = {
    id: 'pres-quincena', nombre: 'Mi quincena', periodo: 'quincenal', activo: true, creadoEn: iso,
    versiones: [{ desde: '2000-01-01', total: rd(22000), limites: { [CAT.alimentacion]: rd(3974), [CAT.transporte]: rd(4200) } }],
  };
  await base.transaction('rw', [base.ajustes, base.cuentas, base.categorias, base.programados, base.presupuestos], async () => {
    await base.ajustes.add(ajustesIniciales(ahora));
    await base.cuentas.bulkAdd(cuentas);
    await base.categorias.bulkAdd(categoriasIniciales());
    await base.programados.add(salario);
    await base.presupuestos.add(presupuesto);
  });
  return true;
}

// ---------- Importación única de la versión anterior ("Quincena") ----------

const MAPA_LEGADO: Record<string, string> = {
  'cat-dieta': CAT.alimentacion, 'cat-transporte': CAT.transporte, 'cat-gimnasio': CAT.salud, 'cat-personal': CAT.compras,
  'cat-servicios': CAT.suscripciones, 'cat-suplementos': CAT.alimentacion, 'cat-ropa': CAT.compras, 'cat-otros': CAT.otros,
};

interface GastoViejo { id: string; fecha: string; monto: number; categoriaId: string; nota?: string; metodo?: string; origen?: string; creadoEn?: string }
interface IngresoViejo { id: string; fecha: string; monto: number; nota?: string; demo?: boolean }
interface DepositoViejo { id: string; fecha: string; monto: number; nota?: string; demo?: boolean }

/** Copia gastos, ingresos extra y depósitos de ahorro de la app anterior (en pesos enteros) a la nueva (centavos). */
export async function importarLegado(base: BaseDatos = db, nombreViejo = 'presupuesto-quincena'): Promise<number> {
  if (!(await Dexie.exists(nombreViejo))) return 0;
  const vieja = new Dexie(nombreViejo);
  try {
    await vieja.open();
    const tabla = <T,>(n: string) => (vieja.tables.some((t) => t.name === n) ? (vieja.table(n).toArray() as Promise<T[]>) : Promise.resolve([] as T[]));
    const [gastos, ingresos, depositos] = await Promise.all([tabla<GastoViejo>('gastos'), tabla<IngresoViejo>('ingresos'), tabla<DepositoViejo>('depositos')]);
    const ahora = new Date().toISOString();
    const movs: Movimiento[] = [];
    for (const g of gastos) {
      if (g.origen === 'demo' || !esFecha(g.fecha) || !(g.monto > 0)) continue;
      movs.push({
        id: `leg-${g.id}`, tipo: 'gasto', nombre: g.nota || 'Gasto', monto: Math.round(g.monto * 100), fecha: g.fecha,
        cuentaId: CUENTA.efectivo, categoriaId: MAPA_LEGADO[g.categoriaId] ?? CAT.otros, estado: 'pagado',
        metodo: g.metodo === 'tarjeta' ? 'credito' : g.metodo === 'transferencia' ? 'transferencia' : 'efectivo',
        clase: 'variable', notas: 'Importado de la versión anterior', creadoEn: g.creadoEn ?? ahora,
      });
    }
    for (const i of ingresos) {
      if (i.demo || !esFecha(i.fecha) || !(i.monto > 0)) continue;
      movs.push({ id: `leg-${i.id}`, tipo: 'ingreso', nombre: i.nota || 'Ingreso', monto: Math.round(i.monto * 100), fecha: i.fecha, cuentaId: CUENTA.efectivo, categoriaId: CAT.otrosIngresos, estado: 'pagado', clase: 'extraordinario', creadoEn: ahora });
    }
    const deps = depositos.filter((x) => !x.demo && esFecha(x.fecha) && x.monto > 0);
    if (deps.length) {
      // Lo ya ahorrado pasa como saldo inicial de la meta (no se inventan ingresos para cubrirlo).
      const total = deps.reduce((s, x) => s + Math.round(x.monto * 100), 0);
      await base.metas.put({ id: 'meta-emergencia', nombre: 'Fondo de emergencia', objetivo: Math.max(rd(50000), total), saldoInicial: total, fechaCreacion: fechaDeIso(ahora), descripcion: 'Ahorro importado de la versión anterior' });
    }
    await base.movimientos.bulkPut(movs);
    return movs.length;
  } finally {
    vieja.close();
  }
}
