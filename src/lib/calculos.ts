// Funciones puras de cálculo (sección 11 de la especificación).
import {
  aFecha, diaSemana, fechaLocal, diasDelMes, diasEntre, mesSiguiente, partes, quincenaDe, quincenasDelMes, rango, rangoMes,
} from './fechas';
import type {
  Ajustes, Bloque, Categoria, Datos, DepositoAhorro, DiaLibre, Gasto, Mes, Metodo, ProductoSirena, Quincena, Recurrente,
} from './tipos';

export interface Rango { inicio: string; fin: string }

export type Estado = 'ok' | 'alerta' | 'excedido' | 'sin-presupuesto';

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const enRango = (fecha: string, r: Rango) => fecha >= r.inicio && fecha <= r.fin;

// ---------- Calendario ----------

export function esLaborable(fecha: string, diasLaborables: number[], libres: DiaLibre[]): boolean {
  return diasLaborables.includes(diaSemana(fecha)) && !libres.some((l) => l.fecha === fecha);
}

export function laborablesEnRango(r: Rango, diasLaborables: number[], libres: DiaLibre[]): number {
  let n = 0;
  for (const f of rango(r.inicio, r.fin)) if (esLaborable(f, diasLaborables, libres)) n++;
  return n;
}

export function laborablesEnQuincena(q: Quincena, ajustes: Pick<Ajustes, 'diasLaborables'>, libres: DiaLibre[]): number {
  return laborablesEnRango(q, ajustes.diasLaborables, libres);
}

// ---------- Presupuesto ----------

export function presupuestoTransporte(
  q: Quincena,
  ajustes: Pick<Ajustes, 'diasLaborables' | 'pasajeDiario' | 'transporteModo' | 'transporteFijoQuincena'>,
  libres: DiaLibre[],
): number {
  return ajustes.transporteModo === 'fijo'
    ? ajustes.transporteFijoQuincena
    : laborablesEnQuincena(q, ajustes, libres) * ajustes.pasajeDiario;
}

export function presupuestoMensualDe(c: Categoria): number {
  return c.presupuestoMensual ?? c.presupuestoQuincenal * 2;
}

/** Presupuesto de una categoría para una quincena. En modo mensual es la provisión (mitad del mes). */
export function presupuestoCategoria(c: Categoria, q: Quincena, ajustes: Ajustes, libres: DiaLibre[]): number {
  if (c.clave === 'transporte') return presupuestoTransporte(q, ajustes, libres);
  if (c.modo === 'unico') return c.presupuestoQuincenal || 0;
  if (c.modo === 'mensual') return presupuestoMensualDe(c) / 2;
  return c.presupuestoQuincenal;
}

export const categoriasDeGasto = (cats: Categoria[]) => cats.filter((c) => c.tipo === 'gasto' && c.activa);

export function totalPresupuestado(q: Quincena, d: Pick<Datos, 'ajustes' | 'categorias' | 'diasLibres'>): number {
  return suma(categoriasDeGasto(d.categorias).map((c) => presupuestoCategoria(c, q, d.ajustes, d.diasLibres)));
}

// ---------- Movimientos ----------

export function ingresosExtra(r: Rango, d: Pick<Datos, 'ingresos'>): number {
  return suma(d.ingresos.filter((i) => enRango(i.fecha, r)).map((i) => i.monto));
}

export function ingresoQuincena(q: Quincena, d: Pick<Datos, 'ajustes' | 'ingresos'>): number {
  return d.ajustes.ingresoQuincenal + ingresosExtra(q, d);
}

export function gastosUnicosPlanificados(r: Rango, d: Pick<Datos, 'planificados'>): number {
  return suma(d.planificados.filter((p) => enRango(p.fecha, r)).map((p) => p.monto));
}

export function metaAhorro(q: Quincena, d: Datos): number {
  return ingresoQuincena(q, d) - totalPresupuestado(q, d) - gastosUnicosPlanificados(q, d);
}

export function gastosEn(r: Rango, gastos: Gasto[]): Gasto[] {
  return gastos.filter((g) => enRango(g.fecha, r));
}

export function gastado(r: Rango, d: Pick<Datos, 'gastos'>, categoriaId?: string): number {
  return suma(gastosEn(r, d.gastos).filter((g) => !categoriaId || g.categoriaId === categoriaId).map((g) => g.monto));
}

export function ahorrado(r: Rango, d: Pick<Datos, 'depositos'>): number {
  return suma(d.depositos.filter((x) => enRango(x.fecha, r)).map((x) => x.monto));
}

export function disponible(q: Quincena, d: Datos): number {
  return ingresoQuincena(q, d) - gastado(q, d) - ahorrado(q, d);
}

export function sobrante(q: Quincena, d: Datos): number {
  return ingresoQuincena(q, d) - gastado(q, d);
}

/**
 * Proyección de ahorro de la quincena.
 * Gasto proyectado = lo gastado + la parte del presupuesto que corresponde a los días que faltan.
 * Antes de empezar la quincena equivale a la meta; al terminar, al sobrante real.
 */
export function proyeccionAhorro(q: Quincena, d: Datos, hoyFecha: string): number {
  const ingreso = ingresoQuincena(q, d);
  const plan = totalPresupuestado(q, d) + gastosUnicosPlanificados(q, d);
  const g = gastado(q, d);
  if (hoyFecha < q.inicio) return ingreso - Math.max(g, plan);
  if (hoyFecha > q.fin) return ingreso - g;
  // Si la app se empezó a usar a mitad de quincena, los días anteriores no cuentan (no hay gastos registrados de ellos).
  const creado = d.ajustes.creadoEn ? fechaLocal(d.ajustes.creadoEn) : '';
  const desde = creado > q.inicio ? creado : q.inicio;
  const total = diasEntre(desde, q.fin) + 1;
  const pasados = Math.max(0, diasEntre(desde, hoyFecha)); // días completos ya transcurridos
  const restante = plan * ((total - pasados) / total);
  return ingreso - (g + restante);
}

export function estadoCategoria(g: number, p: number): Estado {
  if (!(p > 0)) return 'sin-presupuesto';
  if (g > p) return 'excedido';
  if (g / p >= 0.8) return 'alerta';
  return 'ok';
}

// ---------- Vistas ----------

export interface FilaCategoria {
  categoria: Categoria;
  presupuesto: number; // lo que se muestra como presupuesto del periodo (provisión en quincena para modo mensual)
  gastado: number; // gastado en el periodo
  /** Gasto y presupuesto con los que se evalúa el estado (el mes en categorías de modo mensual). */
  gastadoEvaluado: number;
  presupuestoEvaluado: number;
  estado: Estado;
}

export interface Vista {
  rango: Rango;
  ingreso: number;
  presupuestado: number;
  planificados: number;
  meta: number;
  gastado: number;
  ahorrado: number;
  disponible: number;
  filas: FilaCategoria[];
}

export function vistaQuincena(q: Quincena, d: Datos): Vista {
  const mes = rangoMes({ anio: q.anio, mes: q.mes });
  const filas = categoriasDeGasto(d.categorias)
    .sort((a, b) => a.orden - b.orden)
    .map((c): FilaCategoria => {
      const presupuesto = presupuestoCategoria(c, q, d.ajustes, d.diasLibres);
      const g = gastado(q, d, c.id);
      if (c.modo === 'mensual') {
        const gMes = gastado(mes, d, c.id);
        const pMes = presupuestoMensualDe(c);
        return { categoria: c, presupuesto, gastado: g, gastadoEvaluado: gMes, presupuestoEvaluado: pMes, estado: estadoCategoria(gMes, pMes) };
      }
      return { categoria: c, presupuesto, gastado: g, gastadoEvaluado: g, presupuestoEvaluado: presupuesto, estado: estadoCategoria(g, presupuesto) };
    });
  const ingreso = ingresoQuincena(q, d);
  const gastadoTotal = gastado(q, d);
  const ahorradoTotal = ahorrado(q, d);
  return {
    rango: q,
    ingreso,
    presupuestado: totalPresupuestado(q, d),
    planificados: gastosUnicosPlanificados(q, d),
    meta: metaAhorro(q, d),
    gastado: gastadoTotal,
    ahorrado: ahorradoTotal,
    disponible: ingreso - gastadoTotal - ahorradoTotal,
    filas,
  };
}

/** Suma de las dos quincenas; las categorías de modo mensual usan su presupuesto mensual. */
export function vistaMes(m: Mes, d: Datos): Vista {
  const qs = quincenasDelMes(m, d.ajustes.diaPago1);
  const r = rangoMes(m);
  const filas = categoriasDeGasto(d.categorias)
    .sort((a, b) => a.orden - b.orden)
    .map((c): FilaCategoria => {
      const presupuesto = c.modo === 'mensual'
        ? presupuestoMensualDe(c)
        : suma(qs.map((q) => presupuestoCategoria(c, q, d.ajustes, d.diasLibres)));
      const g = gastado(r, d, c.id);
      return { categoria: c, presupuesto, gastado: g, gastadoEvaluado: g, presupuestoEvaluado: presupuesto, estado: estadoCategoria(g, presupuesto) };
    });
  const ingreso = suma(qs.map((q) => ingresoQuincena(q, d)));
  const presupuestado = suma(filas.map((f) => f.presupuesto));
  const planificados = gastosUnicosPlanificados(r, d);
  const g = gastado(r, d);
  const a = ahorrado(r, d);
  return {
    rango: r, ingreso, presupuestado, planificados,
    meta: ingreso - presupuestado - planificados,
    gastado: g, ahorrado: a, disponible: ingreso - g - a, filas,
  };
}

// ---------- Sirena ----------

export function costoCompraSirena(items: ProductoSirena[], periodo: 'quincena' | 'mes'): number {
  return suma(items.filter((i) => i.activo).map((i) => i.precio * (periodo === 'quincena' ? i.cantidadQuincena : i.cantidadMes)));
}

// ---------- Ahorro ----------

export function ahorroAcumulado(depositos: DepositoAhorro[], hasta?: string): number {
  return suma(depositos.filter((x) => !hasta || x.fecha <= hasta).map((x) => x.monto));
}

/** Fecha estimada en que se alcanza una meta al ritmo de ahorro actual (promedio por día desde el primer depósito). */
export function estimadoMeta(objetivo: number, depositos: DepositoAhorro[], hoyFecha: string): string | null {
  const total = ahorroAcumulado(depositos);
  if (objetivo <= 0) return null;
  if (total >= objetivo) return hoyFecha;
  if (depositos.length === 0 || total <= 0) return null;
  const primero = depositos.map((x) => x.fecha).sort()[0];
  const dias = Math.max(diasEntre(primero, hoyFecha), 15);
  const porDia = total / dias;
  const faltan = Math.ceil((objetivo - total) / porDia);
  const [a, m, dd] = partes(hoyFecha);
  const t = new Date(Date.UTC(a, m - 1, dd + faltan));
  return aFecha(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// ---------- Recurrentes ----------

export type GastoNuevo = Omit<Gasto, 'id' | 'creadoEn'>;

export function yaRegistrado(gastos: Gasto[], recurrenteId: string, fecha: string): boolean {
  return gastos.some((g) => g.recurrenteId === recurrenteId && g.fecha === fecha);
}

/** Fechas en que toca un recurrente entre `desde` y `hasta` (ambas incluidas). */
export function fechasRecurrente(r: Recurrente, desde: string, hasta: string, ajustes: Ajustes, libres: DiaLibre[]): string[] {
  const out: string[] = [];
  if (desde > hasta) return out;
  if (r.frecuencia === 'diaria-laboral') {
    for (const f of rango(desde, hasta)) if (esLaborable(f, ajustes.diasLaborables, libres)) out.push(f);
    return out;
  }
  if (r.frecuencia === 'quincenal') {
    const corte = ajustes.diaPago1 ?? 15;
    const [a0, m0] = partes(desde);
    for (let mes: Mes = { anio: a0, mes: m0 }; aFecha(mes.anio, mes.mes, 1) <= hasta; mes = mesSiguiente(mes)) {
      const ultimo = diasDelMes(mes.anio, mes.mes);
      const d = Math.min(Math.max(1, r.diaDelMes ?? 1), corte);
      for (const dia of [d, Math.min(corte + d, ultimo)]) {
        const f = aFecha(mes.anio, mes.mes, dia);
        if (f >= desde && f <= hasta && !out.includes(f)) out.push(f);
      }
    }
    return out;
  }
  const paso = r.frecuencia === 'mensual' ? 1 : Math.max(1, r.cadaNMeses ?? 1);
  const [a, m] = partes(desde);
  for (let mes: Mes = { anio: a, mes: m }; aFecha(mes.anio, mes.mes, 1) <= hasta; ) {
    const dia = Math.min(r.diaDelMes ?? 1, diasDelMes(mes.anio, mes.mes));
    const f = aFecha(mes.anio, mes.mes, dia);
    if (f >= desde && f <= hasta) out.push(f);
    for (let i = 0; i < paso; i++) mes = mesSiguiente(mes);
  }
  return out;
}

/** Gastos que deben crearse automáticamente al abrir la app, sin duplicar nunca un recurrente en la misma fecha. */
export function recurrentesPendientes(recs: Recurrente[], gastos: Gasto[], hoyFecha: string, ajustes: Ajustes, libres: DiaLibre[]): GastoNuevo[] {
  const out: GastoNuevo[] = [];
  for (const r of recs) {
    if (!r.activo || !r.automatico || !r.desde) continue;
    for (const fecha of fechasRecurrente(r, r.desde, hoyFecha, ajustes, libres)) {
      if (yaRegistrado(gastos, r.id, fecha)) continue;
      out.push({ fecha, monto: r.monto, categoriaId: r.categoriaId, nota: r.nombre, origen: 'recurrente', recurrenteId: r.id });
    }
  }
  return out;
}

export { quincenaDe };

/** Equivalente mensual de un recurrente (para el panel de suscripciones). */
export function mensualEquivalente(r: Recurrente): number {
  if (r.frecuencia === 'quincenal') return r.monto * 2;
  if (r.frecuencia === 'mensual') return r.monto;
  if (r.frecuencia === 'cada-n-meses') return r.monto / Math.max(1, r.cadaNMeses ?? 1);
  return 0; // diario: depende del calendario
}

// ---------- Libre para gastar y ritmo diario ----------

export interface Libre {
  ingreso: number;
  /** Fijos comprometidos: por categoría fija, lo mayor entre su presupuesto y lo ya pagado. */
  fijos: number;
  meta: number;
  planificados: number;
  presupuestoVariable: number;
  gastadoVariable: number;
  /** Ingreso − fijos − meta de ahorro − únicos − variables gastados. */
  libre: number;
  diasTotales: number;
  diaActual: number; // 1..diasTotales (0 si la quincena no ha empezado)
  diasRestantes: number; // incluye hoy
  diario: number;
  /** Lo que "debería" llevar gastado en variables al terminar hoy, a ritmo parejo. */
  ideal: number;
  /** ideal − gastado: positivo = por debajo del límite. */
  margen: number;
  ritmo: 'ok' | 'alerta' | 'excedido';
}

export function libreParaGastar(q: Quincena, d: Datos, hoyFecha: string): Libre {
  const ingreso = ingresoQuincena(q, d);
  const cats = categoriasDeGasto(d.categorias);
  const fijas = cats.filter((c) => c.fijo);
  const variables = cats.filter((c) => !c.fijo);
  const fijos = suma(fijas.map((c) => Math.max(presupuestoCategoria(c, q, d.ajustes, d.diasLibres), gastado(q, d, c.id))));
  const meta = metaAhorro(q, d);
  const planificados = gastosUnicosPlanificados(q, d);
  const presupuestoVariable = suma(variables.map((c) => presupuestoCategoria(c, q, d.ajustes, d.diasLibres)));
  const idsFijos = new Set(fijas.map((c) => c.id));
  const gastadoVariable = suma(gastosEn(q, d.gastos).filter((g) => !idsFijos.has(g.categoriaId)).map((g) => g.monto));
  const libre = ingreso - fijos - meta - planificados - gastadoVariable;

  // Si la app se instaló a mitad de quincena, el ritmo cuenta desde la instalación (o desde el primer gasto, si es anterior).
  const primerGasto = gastosEn(q, d.gastos).reduce<string | undefined>((m, g) => (!m || g.fecha < m ? g.fecha : m), undefined);
  const creado = d.ajustes.creadoEn ? fechaLocal(d.ajustes.creadoEn) : '';
  let desde = creado > q.inicio && creado <= q.fin ? creado : q.inicio;
  if (hoyFecha >= q.inicio && hoyFecha < desde) desde = hoyFecha;
  if (primerGasto && primerGasto < desde) desde = primerGasto;
  const diasTotales = diasEntre(desde, q.fin) + 1;
  let diaActual: number;
  if (hoyFecha < desde) diaActual = 0;
  else if (hoyFecha > q.fin) diaActual = diasTotales;
  else diaActual = diasEntre(desde, hoyFecha) + 1;
  const diasRestantes = Math.max(0, diasTotales - diaActual + (diaActual > 0 && hoyFecha <= q.fin ? 1 : 0));
  const diario = diasRestantes > 0 ? libre / diasRestantes : 0;
  const ideal = presupuestoVariable * (diaActual / diasTotales);
  const margen = ideal - gastadoVariable;
  const ritmo: Libre['ritmo'] = libre < 0 ? 'excedido' : gastadoVariable > ideal ? 'alerta' : 'ok';
  return { ingreso, fijos, meta, planificados, presupuestoVariable, gastadoVariable, libre, diasTotales, diaActual, diasRestantes, diario, ideal, margen, ritmo };
}

// ---------- Bloques 50/30/20 ----------

export interface FilaBloque { bloque: Bloque; porcentaje: number; limite: number; usado: number; estado: Estado }

export function vistaBloques(r: Rango, ingreso: number, d: Datos): FilaBloque[] {
  const porCat = new Map(d.categorias.map((c) => [c.id, c.bloque ?? (c.tipo === 'ahorro' ? 'ahorro' : 'estilo')]));
  const orden: Bloque[] = ['necesidades', 'estilo', 'ahorro'];
  return orden.map((bloque) => {
    const porcentaje = d.ajustes.bloques?.[bloque] ?? 0;
    const limite = (ingreso * porcentaje) / 100;
    const usado = bloque === 'ahorro'
      ? ahorrado(r, d) + suma(gastosEn(r, d.gastos).filter((g) => porCat.get(g.categoriaId) === 'ahorro').map((g) => g.monto))
      : suma(gastosEn(r, d.gastos).filter((g) => (porCat.get(g.categoriaId) ?? 'estilo') === bloque).map((g) => g.monto));
    // En ahorro, llegar al límite es lo deseado: el estado es siempre 'ok'.
    return { bloque, porcentaje, limite, usado, estado: bloque === 'ahorro' ? 'ok' : estadoCategoria(usado, limite) };
  });
}

// ---------- Métodos de pago ----------

export function gastoPorMetodo(r: Rango, d: Pick<Datos, 'gastos'>): Record<Metodo, number> {
  const out: Record<Metodo, number> = { efectivo: 0, transferencia: 0, tarjeta: 0 };
  for (const g of gastosEn(r, d.gastos)) out[g.metodo ?? 'efectivo'] += g.monto;
  return out;
}

// ---------- Series para gráficos ----------

export function gastoDiario(r: Rango, d: Pick<Datos, 'gastos'>): { fecha: string; monto: number }[] {
  const porDia = new Map<string, number>();
  for (const g of gastosEn(r, d.gastos)) porDia.set(g.fecha, (porDia.get(g.fecha) ?? 0) + g.monto);
  return [...rango(r.inicio, r.fin)].map((fecha) => ({ fecha, monto: porDia.get(fecha) ?? 0 }));
}

export function comparativaQuincenas(qs: Quincena[], d: Datos) {
  return qs.map((q) => ({ q, ingreso: ingresoQuincena(q, d), gastado: gastado(q, d), ahorrado: ahorrado(q, d) }));
}
