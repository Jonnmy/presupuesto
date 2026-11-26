import { useState } from 'react';
import { aCsv, movimientosACsv } from '../db/respaldo';
import { dinero, fmtPct, suma } from '../nucleo/dinero';
import { fmtRango, hoy, MESES_CORTOS, partes, sumarDias } from '../nucleo/fechas';
import { ahorradoMeta, gastosPorCategoria, historialPresupuesto, recomendaciones, resumenDeudas, serie, totales, variacion } from '../nucleo/finanzas';
import { mesDe, quincenaDe, semanaDe } from '../nucleo/periodos';
import type { Datos, Rango } from '../nucleo/tipos';
import { guardarArchivo } from '../ui/archivos';
import { Icono, Segmentado, useUi, Variacion } from '../ui/base';
import { BarrasIngresoGasto, Dona, Linea } from '../ui/graficos';
import { SelectorPeriodo, usePeriodo } from '../ui/Periodo';
import { NOMBRE_PERIODO } from './Presupuestos';

type Agrupar = 'semana' | 'quincena' | 'mes';

function dividir(r: Rango, g: Agrupar, d: Datos): Rango[] {
  const res: Rango[] = [];
  for (let f = r.inicio; f <= r.fin;) {
    const t = g === 'semana' ? semanaDe(f, d.ajustes.inicioSemana) : g === 'quincena' ? quincenaDe(f, d.ajustes.quincena) : mesDe(f);
    const fin = t.fin < r.fin ? t.fin : r.fin;
    res.push({ inicio: f, fin });
    f = sumarDias(fin, 1);
  }
  return res;
}

export function Reportes({ d }: { d: Datos }) {
  const { avisar } = useUi();
  const [p, e, setE] = usePeriodo(d.ajustes, 'mes');
  const [agrupar, setAgrupar] = useState<Agrupar>('quincena');
  const h = hoy();
  const cat = (id: string) => d.categorias.find((c) => c.id === id);
  const nombreCat = (id: string) => cat(id)?.nombre ?? 'Sin categoría';
  const t = totales(d.movimientos, p.rango);
  const ta = totales(d.movimientos, p.anterior);
  const porCat = [...gastosPorCategoria(d.movimientos, p.rango)].sort((a, b) => b[1] - a[1]);
  const porCatAnt = gastosPorCategoria(d.movimientos, p.anterior);
  const tramos = dividir(p.rango, agrupar, d).map((r) => ({ r, ...totales(d.movimientos, r) }));
  const consejos = recomendaciones(d, p.rango, p.anterior, nombreCat, (c) => dinero(c));
  const deudas = resumenDeudas(d);
  const tasa = t.ingresos > 0 ? ((t.ingresos - t.gastos) / t.ingresos) * 100 : null;

  // Evolución del ahorro: total en metas + cuentas de ahorro al cierre de cada uno de los últimos 12 meses.
  const ahorroMeses = Array.from({ length: 12 }, (_, i) => {
    let f = mesDe(h).fin;
    for (let k = 0; k < 11 - i; k++) f = sumarDias(mesDe(f).inicio, -1);
    const enMetas = suma(d.metas.map((x) => (x.fechaCreacion <= f ? ahorradoMeta(x, d.movimientos, f) : 0)));
    const enCuentas = suma(d.cuentas.filter((c) => c.tipo === 'ahorro' && c.fechaInicial <= f).map((c) => c.saldoInicial + suma(d.movimientos.filter((m) => m.estado === 'pagado' && m.fecha >= c.fechaInicial && m.fecha <= f).map((m) => (m.cuentaId === c.id ? (m.tipo === 'ingreso' || m.tipo === 'retiro' ? m.monto : -m.monto) : 0) + (m.tipo === 'transferencia' && m.cuentaDestinoId === c.id ? m.monto : 0)))));
    return { etiqueta: MESES_CORTOS[partes(f)[1] - 1], valor: enMetas + enCuentas };
  });

  async function exportar() {
    const filas: unknown[][] = [
      ['Reporte financiero', fmtRango(p.rango)], [],
      ['Concepto', 'Este período', 'Período anterior'],
      ['Ingresos', t.ingresos / 100, ta.ingresos / 100], ['Gastos', t.gastos / 100, ta.gastos / 100],
      ['Ahorro (aportes − retiros)', t.ahorro / 100, ta.ahorro / 100], ['Balance neto', t.neto / 100, ta.neto / 100], [],
      ['Desglose', 'Desde', 'Hasta', 'Ingresos', 'Gastos', 'Ahorro', 'Neto'],
      ...tramos.map((x) => ['', x.r.inicio, x.r.fin, x.ingresos / 100, x.gastos / 100, x.ahorro / 100, x.neto / 100]), [],
      ['Categoría', 'Gasto', '% del total', 'Período anterior'],
      ...porCat.map(([id, v]) => [nombreCat(id), v / 100, t.gastos ? ((v / t.gastos) * 100).toFixed(1) : '0', (porCatAnt.get(id) ?? 0) / 100]), [],
      ['Deuda', 'Acreedor', 'Original', 'Pagado', 'Pendiente'],
      ...deudas.prestamos.map((x) => [x.deuda.nombre, x.deuda.acreedor, x.deuda.montoOriginal / 100, x.pagado / 100, x.pendiente / 100]),
      ...deudas.tarjetas.map((x) => [x.cuenta.nombre, 'Tarjeta de crédito', x.limite / 100, '', x.deuda / 100]), [],
      ['Recomendaciones'], ...consejos.map((c) => [c]),
    ];
    const enRango = d.movimientos.filter((m) => m.fecha >= p.rango.inicio && m.fecha <= p.rango.fin);
    const r1 = await guardarArchivo(`reporte-${p.rango.inicio}_${p.rango.fin}.csv`, aCsv(filas), 'text/csv;charset=utf-8');
    await guardarArchivo(`movimientos-${p.rango.inicio}_${p.rango.fin}.csv`, movimientosACsv(enRango, d.cuentas, d.categorias), 'text/csv;charset=utf-8');
    avisar(r1 === 'descargado' ? 'Reporte y movimientos descargados en CSV' : 'Archivos listos para guardar o enviar');
  }

  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Reportes</h1><p className="sec">Entiende tus hábitos y compara períodos.</p></div>
        <div className="fila-wrap"><SelectorPeriodo p={p} e={e} onCambio={setE} /><button className="btn" onClick={exportar}><Icono n="descargar" />Exportar CSV</button></div>
      </div>

      <section className="rejilla-kpi">
        <div className="kpi ingreso"><div className="kpi-etq">Ingresos</div><div className="kpi-val num">{dinero(t.ingresos)}</div><div className="kpi-sub"><Variacion pct={variacion(t.ingresos, ta.ingresos)} /></div></div>
        <div className="kpi gasto"><div className="kpi-etq">Gastos</div><div className="kpi-val num">{dinero(t.gastos)}</div><div className="kpi-sub"><Variacion pct={variacion(t.gastos, ta.gastos)} inverso /></div></div>
        <div className="kpi ahorro"><div className="kpi-etq">Ahorrado en metas</div><div className="kpi-val num">{dinero(t.ahorro)}</div><div className="kpi-sub"><Variacion pct={variacion(t.ahorro, ta.ahorro)} /></div></div>
        <div className="kpi"><div className="kpi-etq">Balance neto</div><div className={`kpi-val num ${t.neto < 0 ? 't-peligro' : ''}`}>{dinero(t.neto)}</div><div className="kpi-sub">{tasa !== null ? `te quedó el ${Math.round(tasa)}% de lo recibido` : 'sin ingresos en el período'}</div></div>
      </section>

      <section className="tarjeta resumen-ia">
        <h2 className="titulo-tarjeta">Resumen financiero</h2>
        <ul>{consejos.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </section>

      <div className="rejilla-2">
        <section className="tarjeta"><h2 className="titulo-tarjeta">Ingresos vs. gastos</h2><BarrasIngresoGasto titulo="Ingresos frente a gastos" datos={serie(d.movimientos, p.rango, d.ajustes)} /></section>
        <section className="tarjeta"><h2 className="titulo-tarjeta">Gastos por categoría</h2><Dona titulo="Gastos por categoría" filas={porCat.map(([id, v]) => ({ nombre: nombreCat(id), valor: v, color: cat(id)?.color ?? '#94a3b8' }))} /></section>
      </div>

      <section className="tarjeta">
        <div className="tarjeta-cab"><h2 className="titulo-tarjeta">Resumen por período</h2>
          <Segmentado etiqueta="Agrupar por" valor={agrupar} onCambio={setAgrupar} opciones={[{ v: 'semana', t: 'Semanal' }, { v: 'quincena', t: 'Quincenal' }, { v: 'mes', t: 'Mensual' }]} /></div>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Período</th><th className="der">Ingresos</th><th className="der">Gastos</th><th className="der">Ahorro</th><th className="der">Neto</th></tr></thead>
            <tbody>{tramos.map((x) => (
              <tr key={x.r.inicio}><td className="chico">{fmtRango(x.r)}</td><td className="der num t-ok">{dinero(x.ingresos)}</td><td className="der num">{dinero(x.gastos)}</td><td className="der num t-ahorro">{dinero(x.ahorro)}</td><td className={`der num fuerte ${x.neto < 0 ? 't-peligro' : ''}`}>{dinero(x.neto)}</td></tr>
            ))}</tbody>
            <tfoot><tr><td className="fuerte">Total</td><td className="der num">{dinero(t.ingresos)}</td><td className="der num">{dinero(t.gastos)}</td><td className="der num">{dinero(t.ahorro)}</td><td className="der num fuerte">{dinero(t.neto)}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <section className="tarjeta">
        <h2 className="titulo-tarjeta">Categorías donde más gastas</h2>
        {porCat.length === 0 ? <p className="sec">Sin gastos en este período.</p> : (
          <div className="tabla-scroll"><table className="tabla">
            <thead><tr><th>#</th><th>Categoría</th><th className="der">Gasto</th><th className="der">% del total</th><th className="der">Anterior</th><th className="der">Cambio</th></tr></thead>
            <tbody>{porCat.map(([id, v], i) => (
              <tr key={id}><td className="sec">{i + 1}</td><td><span className="etiqueta-cat"><i className="pt" style={{ background: cat(id)?.color }} />{nombreCat(id)}</span></td>
                <td className="der num fuerte">{dinero(v)}</td><td className="der num">{fmtPct(t.gastos ? (v / t.gastos) * 100 : 0)}</td>
                <td className="der num sec">{dinero(porCatAnt.get(id) ?? 0)}</td><td className="der chico"><Variacion pct={variacion(v, porCatAnt.get(id) ?? 0)} inverso /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <div className="rejilla-2">
        <section className="tarjeta"><h2 className="titulo-tarjeta">Evolución de tus ahorros</h2><p className="sec chico">Metas y cuentas de ahorro al cierre de cada mes.</p><Linea titulo="Evolución del ahorro" puntos={ahorroMeses} /></section>
        <section className="tarjeta">
          <div className="tarjeta-cab"><h2 className="titulo-tarjeta">Deudas pendientes</h2><a className="sec chico" href="#/deudas">Detalle</a></div>
          {deudas.prestamos.length + deudas.tarjetas.length === 0 ? <p className="sec">No tienes deudas registradas.</p> : (
            <table className="tabla compacta">
              <thead><tr><th>Deuda</th><th className="der">Pagado</th><th className="der">Pendiente</th></tr></thead>
              <tbody>
                {deudas.prestamos.map((x) => <tr key={x.deuda.id}><td>{x.deuda.nombre}</td><td className="der num t-ok">{dinero(x.pagado)}</td><td className="der num">{dinero(x.pendiente)}</td></tr>)}
                {deudas.tarjetas.map((x) => <tr key={x.cuenta.id}><td>{x.cuenta.nombre} <span className="sec chico">(tarjeta)</span></td><td className="der sec">—</td><td className="der num">{dinero(x.deuda)}</td></tr>)}
              </tbody>
              <tfoot><tr><td className="fuerte">Total</td><td className="der num">{dinero(deudas.totalPagado)}</td><td className="der num fuerte">{dinero(deudas.totalPendiente)}</td></tr></tfoot>
            </table>
          )}
        </section>
      </div>

      <section className="tarjeta">
        <h2 className="titulo-tarjeta">Historial de presupuestos</h2>
        {d.presupuestos.length === 0 ? <p className="sec">Sin presupuestos.</p> : d.presupuestos.map((pr) => (
          <div key={pr.id} className="tabla-scroll">
            <h3 className="sub-tabla">{pr.nombre} <span className="sec chico">· {NOMBRE_PERIODO[pr.periodo]}</span></h3>
            <table className="tabla compacta">
              <thead><tr><th>Período</th><th className="der">Presupuesto</th><th className="der">Gastado</th><th className="der">% usado</th><th className="der">Resultado</th></tr></thead>
              <tbody>{historialPresupuesto(pr, d, h, 6).map((x) => (
                <tr key={x.rango.inicio}><td className="chico">{fmtRango(x.rango)}</td><td className="der num">{dinero(x.total)}</td><td className="der num">{dinero(x.gastado)}</td><td className="der num">{fmtPct(x.pct)}</td>
                  <td className={`der num ${x.gastado > x.total ? 't-peligro' : 't-ok'}`}>{x.gastado > x.total ? `Superado ${dinero(x.gastado - x.total)}` : `Sobró ${dinero(x.total - x.gastado)}`}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
