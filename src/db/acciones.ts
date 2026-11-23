import { db, type BaseDatos } from './db';
import { costoCompraSirena, recurrentesPendientes, yaRegistrado, type GastoNuevo } from '../lib/calculos';
import { hoy } from '../lib/fechas';
import { nuevoId } from '../lib/formato';
import { ID } from '../lib/semilla';
import type { Gasto, ProductoSirena } from '../lib/tipos';

export async function agregarGasto(g: GastoNuevo, base: BaseDatos = db): Promise<Gasto> {
  const nuevo: Gasto = { ...g, monto: Math.round(g.monto), id: nuevoId(), creadoEn: new Date().toISOString() };
  await base.gastos.add(nuevo);
  return nuevo;
}

export type ResultadoPasaje = 'creado' | 'duplicado';

/** "Hoy trabajé": registra el pasaje del día una sola vez por fecha. */
export async function registrarPasaje(fecha: string = hoy(), base: BaseDatos = db): Promise<ResultadoPasaje> {
  return base.transaction('rw', base.gastos, base.ajustes, base.recurrentes, async () => {
    const existentes = await base.gastos.where('fecha').equals(fecha).toArray();
    if (yaRegistrado(existentes, ID.recPasaje, fecha)) return 'duplicado';
    const ajustes = await base.ajustes.get('ajustes');
    const rec = await base.recurrentes.get(ID.recPasaje);
    await agregarGasto({
      fecha, monto: ajustes?.pasajeDiario ?? rec?.monto ?? 290, categoriaId: rec?.categoriaId ?? ID.transporte,
      nota: 'Pasaje (hoy trabajé)', origen: 'recurrente', recurrenteId: ID.recPasaje, metodo: 'efectivo',
    }, base);
    return 'creado';
  });
}

/** Crea los gastos recurrentes automáticos pendientes. Devuelve cuántos creó. */
export async function aplicarRecurrentes(fecha: string = hoy(), base: BaseDatos = db): Promise<number> {
  return base.transaction('rw', [base.gastos, base.recurrentes, base.ajustes, base.diasLibres], async () => {
    const ajustes = await base.ajustes.get('ajustes');
    if (!ajustes) return 0;
    const pendientes = recurrentesPendientes(
      await base.recurrentes.toArray(), await base.gastos.toArray(), fecha, ajustes, await base.diasLibres.toArray(),
    );
    for (const g of pendientes) await agregarGasto(g, base);
    return pendientes.length;
  });
}

/** Registra la compra de Sirena: crea el gasto en Dieta y guarda la diferencia estimado/real. */
export async function marcarCompraHecha(estimado: number, real: number, fecha: string = hoy(), base: BaseDatos = db) {
  return base.transaction('rw', base.gastos, base.compras, async () => {
    const gasto = await agregarGasto({ fecha, monto: real, categoriaId: ID.dieta, nota: 'Compra Sirena', origen: 'compra-sirena', metodo: 'tarjeta' }, base);
    await base.compras.add({ id: nuevoId(), fecha, estimado: Math.round(estimado), real: Math.round(real), gastoId: gasto.id });
    return gasto;
  });
}

/** Guarda un producto y recalcula el presupuesto de Dieta. Devuelve el presupuesto quincenal anterior y el nuevo. */
export async function guardarProducto(p: ProductoSirena, base: BaseDatos = db): Promise<{ antes: number; despues: number }> {
  return base.transaction('rw', base.productos, base.categorias, async () => {
    await base.productos.put(p);
    return recalcularDieta(base);
  });
}

export async function borrarProducto(id: string, base: BaseDatos = db) {
  return base.transaction('rw', base.productos, base.categorias, async () => {
    await base.productos.delete(id);
    return recalcularDieta(base);
  });
}

async function recalcularDieta(base: BaseDatos) {
  const productos = await base.productos.toArray();
  const dieta = await base.categorias.get(ID.dieta);
  const despues = costoCompraSirena(productos, 'quincena');
  const antes = dieta?.presupuestoQuincenal ?? 0;
  if (dieta) await base.categorias.put({ ...dieta, presupuestoQuincenal: despues, presupuestoMensual: costoCompraSirena(productos, 'mes') });
  return { antes, despues };
}
