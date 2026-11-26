// Validación de entradas antes de guardar. Devuelve el primer error en texto claro, o null si todo está bien.
import { esFecha } from './fechas';
import { saldoDeuda, ahorradoMeta } from './finanzas';
import type { Cuenta, Datos, Deuda, Meta, Movimiento, Presupuesto, Programado } from './tipos';

const MAX = 100_000_000_000; // RD$1,000 millones en centavos

function monto(m: number, nombre = 'El monto'): string | null {
  if (!Number.isInteger(m) || m <= 0) return `${nombre} debe ser mayor que cero.`;
  if (m > MAX) return `${nombre} es demasiado grande.`;
  return null;
}

export function validarMovimiento(m: Movimiento, d: Pick<Datos, 'cuentas' | 'deudas' | 'metas' | 'movimientos' | 'categorias'>): string | null {
  if (!m.nombre.trim()) return 'Escribe un nombre o descripción.';
  const e = monto(m.monto); if (e) return e;
  if (!esFecha(m.fecha)) return 'La fecha no es válida.';
  const cuenta = (id?: string) => d.cuentas.find((c) => c.id === id);
  if (m.tipo === 'transferencia') {
    if (!cuenta(m.cuentaId) || !cuenta(m.cuentaDestinoId)) return 'Elige la cuenta de origen y la de destino.';
    if (m.cuentaId === m.cuentaDestinoId) return 'La cuenta de origen y destino deben ser distintas.';
  } else if (m.tipo === 'aporte' || m.tipo === 'retiro') {
    const meta = d.metas.find((x) => x.id === m.metaId);
    if (!meta) return 'Elige la meta de ahorro.';
    if (!cuenta(m.cuentaId)) return 'Elige la cuenta.';
    if (m.tipo === 'retiro') {
      const otros = d.movimientos.filter((x) => x.id !== m.id);
      if (m.monto > ahorradoMeta(meta, otros)) return 'No puedes retirar más de lo ahorrado en la meta.';
    }
  } else if (m.tipo === 'pagoDeuda') {
    const deuda = d.deudas.find((x) => x.id === m.deudaId);
    if (!deuda) return 'Elige la deuda.';
    if (!cuenta(m.cuentaId)) return 'Elige la cuenta con la que pagas.';
    if (m.monto > saldoDeuda(deuda, d.movimientos.filter((x) => x.id !== m.id))) return 'El abono es mayor que lo que falta por pagar.';
  } else {
    if (!cuenta(m.cuentaId)) return m.tipo === 'ingreso' ? 'Elige la cuenta donde recibiste el dinero.' : 'Elige la cuenta o el medio de pago.';
    if (!m.categoriaId || !d.categorias.some((c) => c.id === m.categoriaId)) return 'Elige una categoría.';
  }
  if (m.estado === 'pendiente' && m.tipo !== 'gasto') return 'Solo los gastos pueden quedar pendientes.';
  return null;
}

/** ¿Hay otro movimiento igual (mismo tipo, nombre, monto, fecha y cuenta)? Para pedir confirmación antes de duplicar. */
export function posibleDuplicado(m: Movimiento, movimientos: Movimiento[]): Movimiento | undefined {
  const n = m.nombre.trim().toLowerCase();
  return movimientos.find((x) => x.id !== m.id && x.tipo === m.tipo && x.monto === m.monto && x.fecha === m.fecha && x.cuentaId === m.cuentaId && x.nombre.trim().toLowerCase() === n);
}

export function validarCuenta(c: Cuenta): string | null {
  if (!c.nombre.trim()) return 'Escribe el nombre de la cuenta.';
  if (!esFecha(c.fechaInicial)) return 'La fecha del saldo inicial no es válida.';
  if (!Number.isInteger(c.saldoInicial)) return 'El saldo inicial no es válido.';
  if (c.tipo === 'tarjeta') {
    if (!(c.limite && c.limite > 0)) return 'Indica el límite de crédito.';
    if (c.diaCorte && (c.diaCorte < 1 || c.diaCorte > 31)) return 'El día de corte debe estar entre 1 y 31.';
    if (c.diaPago && (c.diaPago < 1 || c.diaPago > 31)) return 'El día de pago debe estar entre 1 y 31.';
  }
  return null;
}

export function validarProgramado(p: Programado, d: Pick<Datos, 'cuentas' | 'categorias'>): string | null {
  if (!p.nombre.trim()) return 'Escribe un nombre.';
  const e = monto(p.monto, 'El monto esperado'); if (e) return e;
  if (!esFecha(p.proximaFecha)) return 'La fecha del próximo vencimiento no es válida.';
  if (p.frecuencia === 'personalizada' && !(p.cadaDias && p.cadaDias >= 1 && p.cadaDias <= 366)) return 'Indica cada cuántos días (1 a 366).';
  if (p.frecuencia === 'quincenal' && p.diasQuincena && (p.diasQuincena[0] === p.diasQuincena[1])) return 'Los dos días de la quincena deben ser distintos.';
  if (!d.cuentas.some((c) => c.id === p.cuentaId)) return 'Elige la cuenta.';
  if (p.tipo === 'gasto' && !d.categorias.some((c) => c.id === p.categoriaId)) return 'Elige una categoría.';
  return null;
}

export function validarDeuda(x: Deuda): string | null {
  if (!x.nombre.trim()) return 'Escribe el nombre de la deuda.';
  let e = monto(x.montoOriginal, 'El monto original'); if (e) return e;
  if (!Number.isInteger(x.saldoInicial) || x.saldoInicial < 0) return 'El saldo pendiente no es válido.';
  if (x.saldoInicial > x.montoOriginal) return 'El saldo pendiente no puede ser mayor que el monto original.';
  if (x.cuota) { e = monto(x.cuota, 'La cuota'); if (e) return e; }
  if (x.tasaAnual !== undefined && (x.tasaAnual < 0 || x.tasaAnual > 200)) return 'La tasa de interés no es válida.';
  if (x.diaVencimiento && (x.diaVencimiento < 1 || x.diaVencimiento > 31)) return 'El día de vencimiento debe estar entre 1 y 31.';
  return null;
}

export function validarMeta(x: Meta): string | null {
  if (!x.nombre.trim()) return 'Escribe el nombre de la meta.';
  const e = monto(x.objetivo, 'La cantidad objetivo'); if (e) return e;
  if (!Number.isInteger(x.saldoInicial) || x.saldoInicial < 0) return 'Lo ahorrado no es válido.';
  if (x.fechaLimite && !esFecha(x.fechaLimite)) return 'La fecha límite no es válida.';
  return null;
}

export function validarPresupuesto(p: Presupuesto): string | null {
  if (!p.nombre.trim()) return 'Escribe un nombre.';
  if (p.periodo === 'personalizado') {
    if (!esFecha(p.inicio) || !esFecha(p.fin)) return 'Indica las fechas de inicio y fin.';
    if (p.fin! < p.inicio!) return 'La fecha final debe ser después de la inicial.';
  }
  const v = p.versiones[p.versiones.length - 1];
  if (!v) return 'Falta el monto.';
  const e = monto(v.total, 'El monto total'); if (e) return e;
  const sumaLim = Object.values(v.limites).reduce((s, x) => s + (x > 0 ? x : 0), 0);
  if (Object.values(v.limites).some((x) => !Number.isInteger(x) || x < 0)) return 'Hay un límite por categoría no válido.';
  if (sumaLim > v.total) return 'La suma de los límites por categoría es mayor que el total.';
  return null;
}
