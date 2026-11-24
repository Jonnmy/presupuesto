// Quincena de demostración: datos de ejemplo marcados como demo, para probar las gráficas. Se quitan con un toque.
import { db, type BaseDatos } from './db';
import { quincenaAnterior, quincenaDe, rango, diaSemana } from '../lib/fechas';
import { nuevoId } from '../lib/formato';
import { ID } from '../lib/semilla';
import type { Gasto, Metodo } from '../lib/tipos';

/** Generador pseudoaleatorio con semilla, para que la demo sea siempre igual. */
function aleatorio(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function cargarDemo(hoyFecha: string, corte = 15, base: BaseDatos = db): Promise<number> {
  const azar = aleatorio(20261122);
  const actual = quincenaDe(hoyFecha, corte);
  const qs = [quincenaAnterior(quincenaAnterior(actual, corte), corte), quincenaAnterior(actual, corte), actual];
  const gastos: Gasto[] = [];
  const ahora = new Date().toISOString();
  const g = (fecha: string, monto: number, categoriaId: string, nota: string, metodo: Metodo) =>
    gastos.push({ id: nuevoId(), fecha, monto: Math.round(monto), categoriaId, nota, metodo, origen: 'demo', creadoEn: ahora });

  for (const q of qs) {
    const fin = q.fin < hoyFecha ? q.fin : hoyFecha;
    if (q.inicio > fin) continue;
    g(q.inicio, 3800 + azar() * 600, ID.dieta, 'Compra Sirena (demo)', 'tarjeta');
    if (q.inicio.endsWith('-01')) g(q.inicio, 2800, ID.gimnasio, 'Mensualidad (demo)', 'transferencia');
    g(q.inicio, 1150, 'cat-servicios', 'Internet (demo)', 'transferencia');
    for (const f of rango(q.inicio, fin)) {
      const dia = diaSemana(f);
      if (dia >= 1 && dia <= 6) g(f, 280, ID.transporte, 'Pasaje (demo)', 'efectivo');
      if (azar() < 0.35) g(f, 150 + azar() * 650, ID.personal, ['Café', 'Barbería', 'Merienda', 'Recarga', 'Cine'][Math.floor(azar() * 5)] + ' (demo)', azar() < 0.4 ? 'tarjeta' : 'efectivo');
    }
  }
  await base.transaction('rw', base.gastos, base.depositos, base.ingresos, async () => {
    await base.gastos.bulkAdd(gastos);
    await base.depositos.bulkAdd(qs.slice(0, 2).map((q, i) => ({ id: nuevoId(), fecha: q.fin, monto: 6000 + i * 1500, nota: 'Ahorro (demo)', metaId: 'meta-emergencia', demo: true })));
    await base.ingresos.add({ id: nuevoId(), fecha: qs[1].fin, monto: 2500, nota: 'Horas extra (demo)', demo: true });
  });
  return gastos.length;
}

export async function quitarDemo(base: BaseDatos = db): Promise<void> {
  await base.transaction('rw', base.gastos, base.depositos, base.ingresos, async () => {
    await base.gastos.filter((x) => x.origen === 'demo').delete();
    await base.depositos.filter((x) => !!x.demo).delete();
    await base.ingresos.filter((x) => !!x.demo).delete();
  });
}
