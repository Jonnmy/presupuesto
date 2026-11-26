// Operaciones que escriben en la base. Cada una valida, usa transacciones y evita duplicados.
import { nuevoId } from '../nucleo/dinero';
import { hoy } from '../nucleo/fechas';
import { CAT_DEUDAS } from '../nucleo/finanzas';
import { primeraFechaDesde, siguiente } from '../nucleo/recurrencia';
import type { Categoria, Cuenta, Datos, Deuda, Meta, Movimiento, Presupuesto, Programado, VersionPresupuesto } from '../nucleo/tipos';
import { validarCuenta, validarDeuda, validarMeta, validarMovimiento, validarPresupuesto, validarProgramado } from '../nucleo/validar';
import { db, type BaseDatos } from './db';

export class ErrorUsuario extends Error {}

const ahora = () => new Date().toISOString();

async function datosParaValidar(base: BaseDatos) {
  const [cuentas, deudas, metas, movimientos, categorias] = await Promise.all([
    base.cuentas.toArray(), base.deudas.toArray(), base.metas.toArray(), base.movimientos.toArray(), base.categorias.toArray(),
  ]);
  return { cuentas, deudas, metas, movimientos, categorias };
}

/** Limpia campos que no aplican al tipo de movimiento. */
function normalizar(m: Movimiento): Movimiento {
  const x: Movimiento = { ...m, nombre: m.nombre.trim(), notas: m.notas?.trim() || undefined, subcategoria: m.subcategoria?.trim() || undefined, fuente: m.fuente?.trim() || undefined };
  if (x.tipo !== 'transferencia') delete x.cuentaDestinoId;
  if (x.tipo !== 'gasto') x.estado = 'pagado';
  if (x.tipo !== 'aporte' && x.tipo !== 'retiro') delete x.metaId;
  if (x.tipo !== 'pagoDeuda') delete x.deudaId;
  if (x.tipo === 'pagoDeuda' && !x.categoriaId) x.categoriaId = CAT_DEUDAS;
  if (x.tipo === 'transferencia' || x.tipo === 'aporte' || x.tipo === 'retiro') { delete x.categoriaId; delete x.clase; }
  for (const k of Object.keys(x) as (keyof Movimiento)[]) if (x[k] === undefined) delete x[k];
  return x;
}

export async function guardarMovimiento(m: Movimiento, base: BaseDatos = db): Promise<Movimiento> {
  const x = normalizar(m);
  return base.transaction('rw', [base.movimientos, base.cuentas, base.deudas, base.metas, base.categorias], async () => {
    const error = validarMovimiento(x, await datosParaValidar(base));
    if (error) throw new ErrorUsuario(error);
    const previo = await base.movimientos.get(x.id);
    const final = previo ? { ...x, creadoEn: previo.creadoEn, actualizadoEn: ahora() } : { ...x, creadoEn: x.creadoEn || ahora() };
    await base.movimientos.put(final);
    return final;
  });
}

/** Borra un movimiento. Si venía de un compromiso, ese vencimiento vuelve a quedar pendiente. */
export async function eliminarMovimiento(id: string, base: BaseDatos = db): Promise<Movimiento | undefined> {
  return base.transaction('rw', base.movimientos, base.programados, async () => {
    const m = await base.movimientos.get(id);
    if (!m) return undefined;
    await base.movimientos.delete(id);
    if (m.programadoId && m.ocurrencia) {
      const p = await base.programados.get(m.programadoId);
      if (p && (siguiente(m.ocurrencia, p) === p.proximaFecha || (!p.activo && p.frecuencia === 'unica'))) {
        await base.programados.update(p.id, { proximaFecha: m.ocurrencia, activo: true });
      }
    }
    return m;
  });
}

/** Restaura un movimiento borrado (deshacer). */
export async function restaurarMovimiento(m: Movimiento, base: BaseDatos = db) {
  return base.transaction('rw', base.movimientos, base.programados, async () => {
    await base.movimientos.put(m);
    if (m.programadoId && m.ocurrencia) {
      const p = await base.programados.get(m.programadoId);
      if (p && p.proximaFecha === m.ocurrencia) {
        const sig = siguiente(m.ocurrencia, p);
        await base.programados.update(p.id, sig ? { proximaFecha: sig } : { activo: false });
      }
    }
  });
}

export async function marcarPagado(id: string, fecha = hoy(), base: BaseDatos = db) {
  const m = await base.movimientos.get(id);
  if (!m) throw new ErrorUsuario('El gasto ya no existe.');
  return guardarMovimiento({ ...m, estado: 'pagado', fecha }, base);
}

// ---------- Compromisos y cobros ----------

export async function guardarProgramado(p: Programado, base: BaseDatos = db) {
  const datos = { cuentas: await base.cuentas.toArray(), categorias: await base.categorias.toArray() };
  const x: Programado = { ...p, nombre: p.nombre.trim() };
  if (x.frecuencia === 'quincenal' && !x.diasQuincena) x.diasQuincena = undefined;
  if (x.frecuencia === 'mensual' || x.frecuencia === 'anual') x.diaMes = Number(x.proximaFecha.slice(8));
  const error = validarProgramado(x, datos);
  if (error) throw new ErrorUsuario(error);
  if (x.frecuencia === 'quincenal' && x.diasQuincena) x.proximaFecha = primeraFechaDesde(x.proximaFecha, x);
  await base.programados.put(x);
  return x;
}

/**
 * Registra el pago (o cobro) del vencimiento actual de un compromiso y avanza al siguiente.
 * La base rechaza un segundo movimiento con el mismo compromiso y fecha de vencimiento.
 */
export async function registrarVencimiento(
  programadoId: string, opciones: { fecha?: string; monto?: number; cuentaId?: string; estado?: 'pagado' | 'pendiente' } = {}, base: BaseDatos = db,
): Promise<Movimiento> {
  return base.transaction('rw', [base.movimientos, base.programados, base.cuentas, base.deudas, base.metas, base.categorias], async () => {
    const p = await base.programados.get(programadoId);
    if (!p || !p.activo) throw new ErrorUsuario('Este compromiso no está activo.');
    const ocurrencia = p.proximaFecha;
    const ya = await base.movimientos.where('[programadoId+ocurrencia]').equals([p.id, ocurrencia]).first();
    if (ya) throw new ErrorUsuario(`El vencimiento del ${ocurrencia} ya está registrado.`);
    const m: Movimiento = normalizar({
      id: nuevoId(), tipo: p.tipo, nombre: p.nombre, monto: opciones.monto ?? p.monto, fecha: opciones.fecha ?? hoy(),
      cuentaId: opciones.cuentaId ?? p.cuentaId, categoriaId: p.categoriaId, metodo: p.metodo, clase: p.clase, fuente: p.fuente,
      estado: opciones.estado ?? 'pagado', frecuencia: p.frecuencia, programadoId: p.id, ocurrencia, creadoEn: ahora(),
    });
    const error = validarMovimiento(m, await datosParaValidar(base));
    if (error) throw new ErrorUsuario(error);
    await base.movimientos.add(m);
    const sig = siguiente(ocurrencia, p);
    await base.programados.update(p.id, sig ? { proximaFecha: sig } : { activo: false });
    return m;
  });
}

/**
 * Guarda un gasto/ingreso nuevo que se repite: crea el compromiso (o cobro) y registra este movimiento
 * como su primer vencimiento. El siguiente vencimiento queda programado, sin duplicarse.
 */
export async function guardarConRecurrencia(m: Movimiento, regla: Pick<Programado, 'frecuencia' | 'cadaDias' | 'diasQuincena'>, avisoDias = 2, base: BaseDatos = db) {
  if (m.tipo !== 'gasto' && m.tipo !== 'ingreso') throw new ErrorUsuario('Solo gastos e ingresos pueden repetirse.');
  const pid = nuevoId();
  const p: Programado = {
    id: pid, tipo: m.tipo, nombre: m.nombre.trim(), monto: m.monto, frecuencia: regla.frecuencia, cadaDias: regla.cadaDias, diasQuincena: regla.diasQuincena,
    diaMes: Number(m.fecha.slice(8)), proximaFecha: m.fecha, categoriaId: m.categoriaId, cuentaId: m.cuentaId, metodo: m.metodo,
    clase: m.clase ?? 'fijo', fuente: m.fuente, avisoDias, activo: true, creadoEn: ahora(),
  };
  if (!p.diaMes || (p.frecuencia !== 'mensual' && p.frecuencia !== 'anual')) delete p.diaMes;
  if (p.frecuencia !== 'quincenal') delete p.diasQuincena;
  if (p.frecuencia !== 'personalizada') delete p.cadaDias;
  return base.transaction('rw', [base.movimientos, base.programados, base.cuentas, base.deudas, base.metas, base.categorias], async () => {
    const error = validarProgramado(p, await datosParaValidar(base)) ?? validarMovimiento(normalizar(m), await datosParaValidar(base));
    if (error) throw new ErrorUsuario(error);
    const sig = siguiente(m.fecha, p);
    await base.programados.add({ ...p, proximaFecha: sig ?? m.fecha, activo: !!sig });
    const final = normalizar({ ...m, frecuencia: regla.frecuencia, programadoId: pid, ocurrencia: m.fecha, creadoEn: ahora() });
    await base.movimientos.add(final);
    return final;
  });
}

/** Salta un vencimiento sin registrar movimiento (por ejemplo, un mes que no se cobró). */
export async function omitirVencimiento(programadoId: string, base: BaseDatos = db) {
  const p = await base.programados.get(programadoId);
  if (!p) return;
  const sig = siguiente(p.proximaFecha, p);
  await base.programados.update(p.id, sig ? { proximaFecha: sig } : { activo: false });
}

export async function eliminarProgramado(id: string, base: BaseDatos = db) {
  await base.programados.delete(id); // los movimientos ya registrados se conservan
}

// ---------- Cuentas ----------

export async function guardarCuenta(c: Cuenta, base: BaseDatos = db) {
  const x = { ...c, nombre: c.nombre.trim() };
  if (x.tipo !== 'tarjeta') { delete x.limite; delete x.diaCorte; delete x.diaPago; }
  const error = validarCuenta(x);
  if (error) throw new ErrorUsuario(error);
  await base.cuentas.put(x);
  return x;
}

/** Una cuenta con movimientos no se borra: se archiva para conservar el historial. */
export async function eliminarCuenta(id: string, base: BaseDatos = db): Promise<'borrada' | 'archivada'> {
  return base.transaction('rw', base.cuentas, base.movimientos, base.programados, async () => {
    const usada = (await base.movimientos.where('cuentaId').equals(id).count()) + (await base.movimientos.where('cuentaDestinoId').equals(id).count());
    if ((await base.cuentas.filter((c) => !c.archivada).count()) <= 1) throw new ErrorUsuario('Debe quedar al menos una cuenta.');
    if (usada > 0) { await base.cuentas.update(id, { archivada: true }); return 'archivada'; }
    if (await base.programados.filter((p) => p.cuentaId === id).count()) throw new ErrorUsuario('Hay compromisos que usan esta cuenta. Cámbialos antes de borrarla.');
    await base.cuentas.delete(id);
    return 'borrada';
  });
}

// ---------- Categorías ----------

export async function guardarCategoria(c: Categoria, base: BaseDatos = db) {
  const nombre = c.nombre.trim();
  if (!nombre) throw new ErrorUsuario('Escribe el nombre de la categoría.');
  const repetida = await base.categorias.filter((x) => x.id !== c.id && x.tipo === c.tipo && !x.archivada && x.nombre.toLowerCase() === nombre.toLowerCase()).first();
  if (repetida) throw new ErrorUsuario('Ya existe una categoría con ese nombre.');
  await base.categorias.put({ ...c, nombre, subcategorias: [...new Set(c.subcategorias.map((s) => s.trim()).filter(Boolean))] });
}

/** Si la categoría tiene movimientos, estos pasan a `reemplazo` antes de borrarla. */
export async function eliminarCategoria(id: string, reemplazo: string, base: BaseDatos = db) {
  if (id === CAT_DEUDAS) throw new ErrorUsuario('La categoría Deudas la usa la app para los abonos.');
  if (id === reemplazo) throw new ErrorUsuario('Elige otra categoría para mover los movimientos.');
  await base.transaction('rw', [base.categorias, base.movimientos, base.programados, base.presupuestos], async () => {
    await base.movimientos.where('categoriaId').equals(id).modify({ categoriaId: reemplazo });
    await base.programados.filter((p) => p.categoriaId === id).modify({ categoriaId: reemplazo });
    await base.presupuestos.toCollection().modify((p) => {
      for (const v of p.versiones) if (v.limites[id]) { v.limites[reemplazo] = (v.limites[reemplazo] ?? 0) + v.limites[id]; delete v.limites[id]; }
    });
    await base.categorias.delete(id);
  });
}

// ---------- Presupuestos ----------

/**
 * Guarda un presupuesto. Al editar uno existente se crea una versión nueva desde `aplicarDesde`
 * (el inicio del período actual): los períodos anteriores conservan los montos con que se calcularon.
 */
export async function guardarPresupuesto(p: Presupuesto, nueva: Omit<VersionPresupuesto, 'desde'>, aplicarDesde: string, base: BaseDatos = db) {
  const previo = await base.presupuestos.get(p.id);
  const limites = Object.fromEntries(Object.entries(nueva.limites).filter(([, v]) => v > 0));
  let versiones: VersionPresupuesto[];
  if (!previo || previo.periodo !== p.periodo) versiones = [{ desde: '2000-01-01', total: nueva.total, limites }];
  else versiones = [...previo.versiones.filter((v) => v.desde < aplicarDesde), { desde: aplicarDesde, total: nueva.total, limites }];
  const x: Presupuesto = { ...p, nombre: p.nombre.trim(), versiones };
  const error = validarPresupuesto(x);
  if (error) throw new ErrorUsuario(error);
  await base.presupuestos.put(x);
  return x;
}

// ---------- Deudas y metas ----------

export async function guardarDeuda(x: Deuda, base: BaseDatos = db) {
  const y = { ...x, nombre: x.nombre.trim(), acreedor: x.acreedor.trim() };
  const error = validarDeuda(y);
  if (error) throw new ErrorUsuario(error);
  await base.deudas.put(y);
}

export async function eliminarDeuda(id: string, base: BaseDatos = db): Promise<'borrada' | 'archivada'> {
  const abonos = await base.movimientos.where('deudaId').equals(id).count();
  if (abonos) { await base.deudas.update(id, { archivada: true }); return 'archivada'; }
  await base.deudas.delete(id);
  return 'borrada';
}

export async function guardarMeta(x: Meta, base: BaseDatos = db) {
  const y = { ...x, nombre: x.nombre.trim() };
  const error = validarMeta(y);
  if (error) throw new ErrorUsuario(error);
  await base.metas.put(y);
}

export async function eliminarMeta(id: string, base: BaseDatos = db): Promise<'borrada' | 'archivada'> {
  const movs = await base.movimientos.where('metaId').equals(id).count();
  if (movs) { await base.metas.update(id, { archivada: true }); return 'archivada'; }
  await base.metas.delete(id);
  return 'borrada';
}

export async function cargarDatos(base: BaseDatos = db): Promise<Datos | undefined> {
  const [ajustes, cuentas, categorias, movimientos, programados, deudas, metas, presupuestos] = await Promise.all([
    base.ajustes.get('ajustes'), base.cuentas.orderBy('orden').toArray(), base.categorias.orderBy('orden').toArray(), base.movimientos.toArray(),
    base.programados.toArray(), base.deudas.toArray(), base.metas.toArray(), base.presupuestos.toArray(),
  ]);
  if (!ajustes) return undefined;
  return { ajustes, cuentas, categorias, movimientos, programados, deudas, metas, presupuestos };
}
