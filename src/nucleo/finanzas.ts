// Lógica financiera centralizada. Todas las pantallas calculan con estas funciones; ninguna repite cálculos.
//
// Reglas:
// - Un ingreso cuenta cuando se recibe (su fecha). Los gastos pendientes NO tocan saldos: son compromisos.
// - Transferencias (incluido pagar la tarjeta) no son ingreso ni gasto: el patrimonio no cambia.
// - Una compra con tarjeta es gasto el día de la compra; pagar la tarjeta luego es transferencia (no se cuenta dos veces).
// - Abonar a un préstamo baja la cuenta y la deuda; cuenta como gasto (categoría Deudas) porque es dinero que sale.
// - Aportes/retiros a metas mueven dinero entre una cuenta y la meta; no son gasto.
// - "Disponible" = dinero real en efectivo, bancos y billeteras. "Presupuesto" es un plan, no dinero.
import { suma } from './dinero';
import { diasEntre, enRango, hoy as hoyFn, sumarDias } from './fechas';
import { quincenaDe, mesDe, semanaDe, tramos } from './periodos';
import { vencimientos } from './recurrencia';
import type { Ajustes, Centavos, Cuenta, Datos, Deuda, Id, Meta, Movimiento, Presupuesto, Programado, Rango, TipoCuenta, VersionPresupuesto } from './tipos';

export const CAT_DEUDAS = 'cat-deudas';
export const LIQUIDAS: TipoCuenta[] = ['efectivo', 'banco', 'billetera'];

const pagados = (ms: Movimiento[]) => ms.filter((m) => m.estado === 'pagado');
const en = (ms: Movimiento[], r: Rango) => ms.filter((m) => enRango(m.fecha, r));

// ---------- Cuentas ----------

/** Efecto de un movimiento en el saldo de una cuenta. */
export function efectoEnCuenta(m: Movimiento, cuentaId: Id): Centavos {
  if (m.estado !== 'pagado') return 0;
  let e = 0;
  if (m.cuentaId === cuentaId) {
    if (m.tipo === 'ingreso' || m.tipo === 'retiro') e += m.monto;
    else e -= m.monto; // gasto, transferencia (origen), aporte, pagoDeuda
  }
  if (m.tipo === 'transferencia' && m.cuentaDestinoId === cuentaId) e += m.monto;
  return e;
}

/** Saldo = saldo inicial + movimientos desde su fecha (lo anterior ya está reflejado en el saldo inicial). */
export function saldoCuenta(c: Cuenta, movimientos: Movimiento[], hasta?: string): Centavos {
  return c.saldoInicial + suma(movimientos.filter((m) => m.fecha >= c.fechaInicial && (!hasta || m.fecha <= hasta)).map((m) => efectoEnCuenta(m, c.id)));
}

/** Historial de una cuenta con el saldo después de cada movimiento (más reciente primero). */
export function historialCuenta(c: Cuenta, movimientos: Movimiento[]) {
  const propios = movimientos
    .filter((m) => m.cuentaId === c.id || m.cuentaDestinoId === c.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn));
  let saldo = c.saldoInicial;
  const filas = propios.map((m) => { const efecto = m.fecha >= c.fechaInicial ? efectoEnCuenta(m, c.id) : 0; saldo += efecto; return { m, efecto, saldo }; });
  return filas.reverse();
}

export function saldos(d: Pick<Datos, 'cuentas' | 'movimientos'>): Map<Id, Centavos> {
  return new Map(d.cuentas.map((c) => [c.id, saldoCuenta(c, d.movimientos)]));
}

/** Dinero real que se puede usar hoy: efectivo + bancos + billeteras (no ahorros, no crédito). */
export function disponible(d: Pick<Datos, 'cuentas' | 'movimientos'>): Centavos {
  return suma(d.cuentas.filter((c) => !c.archivada && LIQUIDAS.includes(c.tipo)).map((c) => saldoCuenta(c, d.movimientos)));
}

export interface Tarjeta { cuenta: Cuenta; deuda: Centavos; limite: Centavos; disponible: Centavos; uso: number; proximoCorte?: string; proximoPago?: string }

export function tarjetas(d: Pick<Datos, 'cuentas' | 'movimientos'>, hoy = hoyFn()): Tarjeta[] {
  return d.cuentas.filter((c) => c.tipo === 'tarjeta' && !c.archivada).map((c) => {
    const saldo = saldoCuenta(c, d.movimientos);
    const deuda = Math.max(0, -saldo);
    const limite = c.limite ?? 0;
    return {
      cuenta: c, deuda, limite, disponible: limite - deuda, uso: limite > 0 ? (deuda / limite) * 100 : 0,
      proximoCorte: c.diaCorte ? proximoDia(c.diaCorte, hoy) : undefined,
      proximoPago: c.diaPago ? proximoDia(c.diaPago, hoy) : undefined,
    };
  });
}

/** Próxima fecha (hoy incluido) que cae en el día `dia` del mes, ajustado a meses cortos. */
export function proximoDia(dia: number, desde: string): string {
  const enMes = (r: Rango) => sumarDias(r.inicio, Math.min(dia, Number(r.fin.slice(8))) - 1);
  const este = enMes(mesDe(desde));
  return este >= desde ? este : enMes(mesDe(sumarDias(mesDe(desde).fin, 1)));
}

// ---------- Deudas y metas ----------

export function saldoDeuda(x: Deuda, movimientos: Movimiento[]): Centavos {
  return Math.max(0, x.saldoInicial - suma(pagados(movimientos).filter((m) => m.tipo === 'pagoDeuda' && m.deudaId === x.id).map((m) => m.monto)));
}

export function resumenDeudas(d: Pick<Datos, 'deudas' | 'movimientos' | 'cuentas'>) {
  const prestamos = d.deudas.filter((x) => !x.archivada).map((x) => {
    const pendiente = saldoDeuda(x, d.movimientos);
    const abonos = d.movimientos.filter((m) => m.tipo === 'pagoDeuda' && m.deudaId === x.id && m.estado === 'pagado').sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { deuda: x, pendiente, pagado: x.montoOriginal - pendiente, abonos, progreso: x.montoOriginal > 0 ? ((x.montoOriginal - pendiente) / x.montoOriginal) * 100 : 100 };
  });
  const tarj = tarjetas(d);
  const totalPrestamos = suma(prestamos.map((p) => p.pendiente));
  const totalTarjetas = suma(tarj.map((t) => t.deuda));
  return {
    prestamos, tarjetas: tarj,
    totalOriginal: suma(prestamos.map((p) => p.deuda.montoOriginal)),
    totalPagado: suma(prestamos.map((p) => p.pagado)),
    totalPendiente: totalPrestamos + totalTarjetas,
    totalPrestamos, totalTarjetas,
  };
}

export function ahorradoMeta(x: Meta, movimientos: Movimiento[], hasta?: string): Centavos {
  return x.saldoInicial + suma(pagados(movimientos).filter((m) => m.metaId === x.id && (!hasta || m.fecha <= hasta)).map((m) => (m.tipo === 'aporte' ? m.monto : m.tipo === 'retiro' ? -m.monto : 0)));
}

export function progresoMetas(d: Pick<Datos, 'metas' | 'movimientos'>) {
  return d.metas.filter((x) => !x.archivada).map((meta) => {
    const ahorrado = ahorradoMeta(meta, d.movimientos);
    return {
      meta, ahorrado, falta: Math.max(0, meta.objetivo - ahorrado),
      progreso: meta.objetivo > 0 ? Math.min(100, (ahorrado / meta.objetivo) * 100) : 0,
      historial: d.movimientos.filter((m) => m.metaId === meta.id).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn)),
    };
  });
}

/** Patrimonio = cuentas (tarjetas restan) + metas − préstamos. Las transferencias no lo cambian. */
export function patrimonio(d: Pick<Datos, 'cuentas' | 'movimientos' | 'metas' | 'deudas'>): Centavos {
  return suma(d.cuentas.filter((c) => !c.archivada).map((c) => saldoCuenta(c, d.movimientos)))
    + suma(d.metas.filter((m) => !m.archivada).map((m) => ahorradoMeta(m, d.movimientos)))
    - suma(d.deudas.filter((x) => !x.archivada).map((x) => saldoDeuda(x, d.movimientos)));
}

// ---------- Totales de un período ----------

export const esGasto = (m: Movimiento) => m.tipo === 'gasto' || m.tipo === 'pagoDeuda';
export const categoriaDe = (m: Movimiento) => (m.tipo === 'pagoDeuda' ? m.categoriaId ?? CAT_DEUDAS : m.categoriaId ?? 'sin-categoria');

export interface Totales { ingresos: Centavos; gastos: Centavos; pendientes: Centavos; ahorro: Centavos; neto: Centavos }

export function totales(movimientos: Movimiento[], r: Rango): Totales {
  const ms = en(movimientos, r);
  const ingresos = suma(pagados(ms).filter((m) => m.tipo === 'ingreso').map((m) => m.monto));
  const gastos = suma(pagados(ms).filter(esGasto).map((m) => m.monto));
  const pendientes = suma(ms.filter((m) => esGasto(m) && m.estado === 'pendiente').map((m) => m.monto));
  const ahorro = suma(pagados(ms).map((m) => (m.tipo === 'aporte' ? m.monto : m.tipo === 'retiro' ? -m.monto : 0)));
  return { ingresos, gastos, pendientes, ahorro, neto: ingresos - gastos };
}

export function gastosPorCategoria(movimientos: Movimiento[], r: Rango, incluirPendientes = false): Map<Id, Centavos> {
  const res = new Map<Id, Centavos>();
  for (const m of en(movimientos, r)) {
    if (!esGasto(m) || (m.estado !== 'pagado' && !incluirPendientes)) continue;
    const k = categoriaDe(m);
    res.set(k, (res.get(k) ?? 0) + m.monto);
  }
  return res;
}

export function serie(movimientos: Movimiento[], r: Rango, a: Ajustes) {
  return tramos(r, a).map((t) => ({ etiqueta: t.etiqueta, rango: t.rango, ...totales(movimientos, t.rango) }));
}

/** Gasto acumulado día a día dentro del rango (para la evolución). */
export function gastoAcumulado(movimientos: Movimiento[], r: Rango): { fecha: string; acumulado: Centavos }[] {
  const porDia = new Map<string, number>();
  for (const m of pagados(en(movimientos, r))) if (esGasto(m)) porDia.set(m.fecha, (porDia.get(m.fecha) ?? 0) + m.monto);
  const res: { fecha: string; acumulado: Centavos }[] = [];
  let ac = 0;
  for (let f = r.inicio; f <= r.fin; f = sumarDias(f, 1)) { ac += porDia.get(f) ?? 0; res.push({ fecha: f, acumulado: ac }); }
  return res;
}

export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return ((actual - anterior) / anterior) * 100;
}

// ---------- Presupuestos ----------

/** Período del presupuesto que contiene la fecha. */
export function periodoPresupuesto(p: Presupuesto, f: string, a: Ajustes): Rango {
  switch (p.periodo) {
    case 'semanal': return semanaDe(f, a.inicioSemana);
    case 'quincenal': return quincenaDe(f, a.quincena);
    case 'mensual': return mesDe(f);
    case 'personalizado': return { inicio: p.inicio ?? f, fin: p.fin ?? f };
  }
}

/** Versión vigente al inicio del período: editar un presupuesto no cambia los períodos pasados. */
export function versionVigente(p: Presupuesto, inicio: string): VersionPresupuesto {
  const ordenadas = [...p.versiones].sort((x, y) => x.desde.localeCompare(y.desde));
  return ordenadas.filter((v) => v.desde <= inicio).pop() ?? ordenadas[0];
}

export type EstadoLimite = 'ok' | 'alerta' | 'excedido' | 'sin-limite';

export function estadoLimite(usado: number, limite: number, avisoPct: number): EstadoLimite {
  if (!(limite > 0)) return usado > 0 ? 'excedido' : 'sin-limite';
  if (usado > limite) return 'excedido';
  return (usado / limite) * 100 >= avisoPct ? 'alerta' : 'ok';
}

export interface FilaLimite { categoriaId: Id; limite: Centavos; gastado: Centavos; pendiente: Centavos; restante: Centavos; pct: number; estado: EstadoLimite }

export interface InstanciaPresupuesto {
  presupuesto: Presupuesto; rango: Rango; version: VersionPresupuesto;
  total: Centavos; gastado: Centavos; pendiente: Centavos; restante: Centavos; pct: number; estado: EstadoLimite;
  filas: FilaLimite[]; sinLimite: { categoriaId: Id; gastado: Centavos }[];
  diasRestantes: number; diarioDisponible: Centavos;
}

/** Cómo va un presupuesto en el período que contiene `f`. Gastado = pagados; pendiente = comprometido aún sin pagar. */
export function instanciaPresupuesto(p: Presupuesto, f: string, d: Pick<Datos, 'movimientos' | 'ajustes'>, hoy = hoyFn()): InstanciaPresupuesto {
  const rango = periodoPresupuesto(p, f, d.ajustes);
  const version = versionVigente(p, rango.inicio);
  const pagado = gastosPorCategoria(d.movimientos, rango);
  const todo = gastosPorCategoria(d.movimientos, rango, true);
  const aviso = d.ajustes.alertas.presupuestoPct;
  const filas: FilaLimite[] = Object.entries(version.limites).filter(([, l]) => l > 0).map(([categoriaId, limite]) => {
    const gastado = pagado.get(categoriaId) ?? 0;
    const pendiente = (todo.get(categoriaId) ?? 0) - gastado;
    return { categoriaId, limite, gastado, pendiente, restante: limite - gastado - pendiente, pct: (gastado / limite) * 100, estado: estadoLimite(gastado + pendiente, limite, aviso) };
  });
  const conLimite = new Set(filas.map((x) => x.categoriaId));
  const sinLimite = [...pagado].filter(([k]) => !conLimite.has(k)).map(([categoriaId, gastado]) => ({ categoriaId, gastado }));
  const gastado = suma([...pagado.values()]);
  const pendiente = suma([...todo.values()]) - gastado;
  const restante = version.total - gastado - pendiente;
  const diasRestantes = hoy > rango.fin ? 0 : diasEntre(hoy < rango.inicio ? rango.inicio : hoy, rango.fin) + 1;
  return {
    presupuesto: p, rango, version, total: version.total, gastado, pendiente, restante,
    pct: version.total > 0 ? (gastado / version.total) * 100 : 0, estado: estadoLimite(gastado + pendiente, version.total, aviso),
    filas, sinLimite, diasRestantes, diarioDisponible: diasRestantes > 0 ? Math.floor(Math.max(0, restante) / diasRestantes) : 0,
  };
}

/** Últimos `n` períodos de un presupuesto (historial). */
export function historialPresupuesto(p: Presupuesto, d: Pick<Datos, 'movimientos' | 'ajustes'>, hoy = hoyFn(), n = 6): InstanciaPresupuesto[] {
  if (p.periodo === 'personalizado') return [instanciaPresupuesto(p, p.inicio ?? hoy, d, hoy)];
  const res: InstanciaPresupuesto[] = [];
  let f = hoy;
  for (let i = 0; i < n; i++) {
    const inst = instanciaPresupuesto(p, f, d, hoy);
    if (i > 0 && inst.rango.fin < p.creadoEn.slice(0, 10) && inst.gastado === 0) break;
    res.push(inst);
    f = sumarDias(inst.rango.inicio, -1);
  }
  return res;
}

/** Presupuesto que corresponde a una vista del panel (semana → semanal, etc.). */
export function presupuestoParaVista(ps: Presupuesto[], vista: string): Presupuesto | undefined {
  const tipo = vista === 'semana' ? 'semanal' : vista === 'quincena' ? 'quincenal' : vista === 'mes' ? 'mensual' : null;
  return ps.find((p) => p.activo && p.periodo === tipo);
}

// ---------- Compromisos, cobros y pendientes ----------

export interface Vencimiento { programado: Programado; fecha: string; vencido: boolean; dias: number }

export function vencimientosEn(ps: Programado[], r: Rango, hoy = hoyFn(), tipo?: 'gasto' | 'ingreso'): Vencimiento[] {
  return ps.filter((p) => p.activo && (!tipo || p.tipo === tipo))
    .flatMap((p) => vencimientos(p, { inicio: p.proximaFecha < r.inicio ? p.proximaFecha : r.inicio, fin: r.fin })
      .filter((f) => f >= r.inicio || f < hoy)
      .map((f) => ({ programado: p, fecha: f, vencido: f < hoy, dias: diasEntre(hoy, f) })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function proximoCobro(d: Pick<Datos, 'programados'>, hoy = hoyFn()): Vencimiento | undefined {
  return vencimientosEn(d.programados, { inicio: hoy, fin: sumarDias(hoy, 400) }, hoy, 'ingreso').find((v) => v.fecha >= hoy);
}

export function gastosPendientes(movimientos: Movimiento[]): Movimiento[] {
  return movimientos.filter((m) => esGasto(m) && m.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Cuánto puedo gastar hasta el próximo cobro: disponible hoy − compromisos que vencen antes (incluidos los vencidos)
 * − gastos pendientes hasta esa fecha. Cada compromiso se resta una sola vez.
 */
export function libreHastaCobro(d: Datos, hoy = hoyFn()) {
  const cobro = proximoCobro(d, hoy);
  const hasta = cobro ? sumarDias(cobro.fecha, -1) : sumarDias(hoy, 14);
  const disp = disponible(d);
  const compromisos = vencimientosEn(d.programados, { inicio: hoy, fin: hasta }, hoy, 'gasto');
  const pendientes = gastosPendientes(d.movimientos).filter((m) => m.fecha <= hasta && !(m.cuentaId && d.cuentas.find((c) => c.id === m.cuentaId)?.tipo === 'tarjeta'));
  const comprometido = suma(compromisos.filter((v) => !tarjetaDe(v.programado, d)).map((v) => v.programado.monto)) + suma(pendientes.map((m) => m.monto));
  const libre = disp - comprometido;
  const dias = Math.max(1, diasEntre(hoy, hasta) + 1);
  return { cobro, hasta, disponible: disp, compromisos, pendientes, comprometido, libre, dias, diario: Math.floor(Math.max(0, libre) / dias) };
}

const tarjetaDe = (p: Programado, d: Datos) => !!p.cuentaId && d.cuentas.find((c) => c.id === p.cuentaId)?.tipo === 'tarjeta';

// ---------- Alertas ----------

export interface Alerta { id: string; nivel: 'info' | 'alerta' | 'peligro' | 'exito'; texto: string; enlace?: string }

export function alertas(d: Datos, hoy = hoyFn(), nombreCat: (id: Id) => string = (x) => x, fmt: (c: number) => string = String): Alerta[] {
  const a = d.ajustes.alertas;
  const res: Alerta[] = [];
  for (const p of d.presupuestos.filter((x) => x.activo)) {
    const i = instanciaPresupuesto(p, hoy, d, hoy);
    if (i.rango.fin < hoy && p.periodo === 'personalizado') continue;
    if (i.estado === 'excedido') res.push({ id: `p-${p.id}`, nivel: 'peligro', texto: `Superaste el presupuesto "${p.nombre}" por ${fmt(-i.restante)}.`, enlace: 'presupuestos' });
    else if (i.estado === 'alerta') res.push({ id: `p-${p.id}`, nivel: 'alerta', texto: `"${p.nombre}" va en ${Math.round(((i.gastado + i.pendiente) / Math.max(1, i.total)) * 100)}% del límite. Quedan ${fmt(i.restante)}.`, enlace: 'presupuestos' });
    for (const f of i.filas) {
      if (f.estado === 'excedido') res.push({ id: `pc-${p.id}-${f.categoriaId}`, nivel: 'peligro', texto: `${nombreCat(f.categoriaId)}: superaste el límite por ${fmt(-f.restante)}.`, enlace: 'presupuestos' });
      else if (f.estado === 'alerta') res.push({ id: `pc-${p.id}-${f.categoriaId}`, nivel: 'alerta', texto: `${nombreCat(f.categoriaId)}: vas en ${Math.round(((f.gastado + f.pendiente) / f.limite) * 100)}% del límite.`, enlace: 'presupuestos' });
    }
  }
  for (const v of vencimientosEn(d.programados, { inicio: hoy, fin: sumarDias(hoy, 60) }, hoy, 'gasto')) {
    if (v.vencido) res.push({ id: `v-${v.programado.id}-${v.fecha}`, nivel: 'peligro', texto: `${v.programado.nombre} venció hace ${-v.dias} ${v.dias === -1 ? 'día' : 'días'} (${fmt(v.programado.monto)}).`, enlace: 'compromisos' });
    else if (v.dias <= Math.max(a.diasPago, v.programado.avisoDias)) res.push({ id: `v-${v.programado.id}-${v.fecha}`, nivel: 'alerta', texto: `${v.programado.nombre} vence ${v.dias === 0 ? 'hoy' : v.dias === 1 ? 'mañana' : `en ${v.dias} días`} (${fmt(v.programado.monto)}).`, enlace: 'compromisos' });
  }
  const pend = gastosPendientes(d.movimientos);
  const vencidos = pend.filter((m) => m.fecha < hoy);
  if (vencidos.length) res.push({ id: 'pend-vencidos', nivel: 'peligro', texto: `Tienes ${vencidos.length} gasto(s) pendiente(s) con fecha pasada.`, enlace: 'movimientos' });
  else if (pend.length) res.push({ id: 'pend', nivel: 'info', texto: `Tienes ${pend.length} gasto(s) pendiente(s) de pago.`, enlace: 'movimientos' });
  for (const c of d.cuentas.filter((x) => !x.archivada && LIQUIDAS.includes(x.tipo))) {
    const s = saldoCuenta(c, d.movimientos);
    if (s < 0) res.push({ id: `c-${c.id}`, nivel: 'peligro', texto: `${c.nombre} está en negativo (${fmt(s)}).`, enlace: 'cuentas' });
    else if (a.saldoBajo > 0 && s < a.saldoBajo && d.movimientos.some((m) => m.cuentaId === c.id || m.cuentaDestinoId === c.id)) res.push({ id: `c-${c.id}`, nivel: 'alerta', texto: `Saldo bajo en ${c.nombre}: ${fmt(s)}.`, enlace: 'cuentas' });
  }
  for (const t of tarjetas(d, hoy)) {
    if (t.limite > 0 && t.uso >= 90) res.push({ id: `t-${t.cuenta.id}`, nivel: 'alerta', texto: `${t.cuenta.nombre} usa el ${Math.round(t.uso)}% del límite.`, enlace: 'deudas' });
    if (t.deuda > 0 && t.proximoPago && diasEntre(hoy, t.proximoPago) <= a.diasPago) res.push({ id: `tp-${t.cuenta.id}`, nivel: 'alerta', texto: `Pago de ${t.cuenta.nombre} ${diasEntre(hoy, t.proximoPago) === 0 ? 'hoy' : `en ${diasEntre(hoy, t.proximoPago)} días`}: debes ${fmt(t.deuda)}.`, enlace: 'deudas' });
  }
  for (const x of d.deudas.filter((y) => !y.archivada && y.diaVencimiento)) {
    if (saldoDeuda(x, d.movimientos) <= 0) continue;
    const f = proximoDia(x.diaVencimiento!, hoy);
    const pagadoEsteMes = d.movimientos.some((m) => m.deudaId === x.id && m.tipo === 'pagoDeuda' && m.fecha.slice(0, 7) === f.slice(0, 7));
    if (!pagadoEsteMes && diasEntre(hoy, f) <= a.diasPago) res.push({ id: `d-${x.id}`, nivel: 'alerta', texto: `Cuota de ${x.nombre} ${diasEntre(hoy, f) === 0 ? 'hoy' : `en ${diasEntre(hoy, f)} días`} (${fmt(x.cuota)}).`, enlace: 'deudas' });
  }
  for (const g of progresoMetas(d)) {
    if (g.progreso >= 100) res.push({ id: `m-${g.meta.id}`, nivel: 'exito', texto: `¡Cumpliste la meta "${g.meta.nombre}"!`, enlace: 'metas' });
    else if (g.progreso >= a.metaPct) res.push({ id: `m-${g.meta.id}`, nivel: 'exito', texto: `"${g.meta.nombre}" está al ${Math.round(g.progreso)}%. Faltan ${fmt(g.falta)}.`, enlace: 'metas' });
  }
  const orden = { peligro: 0, alerta: 1, info: 2, exito: 3 };
  return res.sort((x, y) => orden[x.nivel] - orden[y.nivel]);
}

// ---------- Resumen con recomendaciones ----------

export function recomendaciones(d: Datos, r: Rango, anterior: Rango, nombreCat: (id: Id) => string, fmt: (c: number) => string): string[] {
  const t = totales(d.movimientos, r);
  const ta = totales(d.movimientos, anterior);
  const cats = [...gastosPorCategoria(d.movimientos, r)].sort((a, b) => b[1] - a[1]);
  const catsAnt = gastosPorCategoria(d.movimientos, anterior);
  const res: string[] = [];
  if (t.gastos === 0 && t.ingresos === 0) return ['Todavía no hay movimientos en este período.'];
  if (cats.length) {
    const [id, monto] = cats[0];
    res.push(`Donde más gastas es ${nombreCat(id)}: ${fmt(monto)} (${Math.round((monto / Math.max(1, t.gastos)) * 100)}% de tus gastos).`);
  }
  if (t.ingresos > 0) {
    const tasa = ((t.ingresos - t.gastos) / t.ingresos) * 100;
    res.push(tasa >= 0 ? `Te quedó el ${Math.round(tasa)}% de lo que recibiste (${fmt(t.ingresos - t.gastos)}).` : `Gastaste ${fmt(t.gastos - t.ingresos)} más de lo que recibiste.`);
  }
  const v = variacion(t.gastos, ta.gastos);
  if (v !== null && ta.gastos > 0 && Math.abs(v) >= 5) res.push(`Tus gastos ${v > 0 ? 'subieron' : 'bajaron'} ${Math.abs(Math.round(v))}% frente al período anterior.`);
  const subidas = cats.map(([id, m]) => ({ id, m, dif: m - (catsAnt.get(id) ?? 0) })).filter((x) => x.dif > 0 && (catsAnt.get(x.id) ?? 0) > 0).sort((a, b) => b.dif - a.dif);
  if (subidas[0]) res.push(`${nombreCat(subidas[0].id)} subió ${fmt(subidas[0].dif)} frente al período anterior: es el primer lugar para recortar.`);
  const variables = suma(pagados(en(d.movimientos, r)).filter((m) => esGasto(m) && m.clase === 'variable').map((m) => m.monto));
  if (variables > 0 && t.gastos > 0) {
    const pct = (variables / t.gastos) * 100;
    if (pct >= 40) res.push(`El ${Math.round(pct)}% de tus gastos son variables. Recortar un 10% ahí liberaría ${fmt(Math.round(variables * 0.1))}.`);
  }
  const extra = suma(pagados(en(d.movimientos, r)).filter((m) => esGasto(m) && m.clase === 'extraordinario').map((m) => m.monto));
  if (extra > 0) res.push(`Tuviste ${fmt(extra)} en gastos extraordinarios. Un fondo de emergencia ayuda a cubrirlos sin desbalancear el mes.`);
  return res;
}
