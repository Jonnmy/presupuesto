import { useState } from 'react';
import { marcarPagado } from '../db/acciones';
import { dinero, fmtPct } from '../nucleo/dinero';
import { diasEntre, fmtCorta, fmtFecha, hoy, relativo, sumarDias } from '../nucleo/fechas';
import {
  alertas, gastoAcumulado, gastosPendientes, gastosPorCategoria, instanciaPresupuesto, libreHastaCobro, presupuestoParaVista,
  progresoMetas, serie, totales, variacion, vencimientosEn,
} from '../nucleo/finanzas';
import type { Datos, Programado } from '../nucleo/tipos';
import { Barra, Icono, Kpi, Variacion, Vacio, useUi } from '../ui/base';
import { BarrasIngresoGasto, Dona, Evolucion, UsoPresupuesto } from '../ui/graficos';
import { PagarVencimiento } from '../ui/Pagar';
import { SelectorPeriodo, usePeriodo } from '../ui/Periodo';

export function Panel({ d }: { d: Datos }) {
  const { abrir, intentar } = useUi();
  const [p, e, setE] = usePeriodo(d.ajustes);
  const [pagar, setPagar] = useState<Programado | null>(null);
  const h = hoy();
  const nombreCat = (id: string) => d.categorias.find((c) => c.id === id)?.nombre ?? 'Sin categoría';
  const colorCat = (id: string) => d.categorias.find((c) => c.id === id)?.color ?? '#94a3b8';

  const t = totales(d.movimientos, p.rango);
  const ta = totales(d.movimientos, p.anterior);
  const libre = libreHastaCobro(d, h);
  const pres = presupuestoParaVista(d.presupuestos, p.vista);
  const inst = pres ? instanciaPresupuesto(pres, p.rango.inicio <= h && p.rango.fin >= h ? h : p.rango.inicio, d, h) : undefined;
  const cats = gastosPorCategoria(d.movimientos, p.rango);
  const proximos = vencimientosEn(d.programados, { inicio: h, fin: sumarDias(h, 14) }, h).slice(0, 8);
  const pendientes = gastosPendientes(d.movimientos);
  const metas = progresoMetas(d).slice(0, 4);
  const avisos = alertas(d, h, nombreCat, (c) => dinero(c));
  const sinDatos = d.movimientos.length === 0;
  const sinSaldos = d.cuentas.every((c) => c.saldoInicial === 0);

  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Panel</h1><p className="sec">Tu situación financiera de un vistazo.</p></div>
        <SelectorPeriodo p={p} e={e} onCambio={setE} />
      </div>

      {(sinDatos || sinSaldos) && (
        <section className="tarjeta bienvenida">
          <h2 className="titulo-tarjeta">Empecemos</h2>
          <ol className="pasos">
            <li className={sinSaldos ? '' : 'hecho'}><a href="#/cuentas">Indica cuánto dinero tienes hoy en cada cuenta</a> para que el balance sea real.</li>
            <li><a href="#/compromisos">Revisa tu salario y agrega tus pagos fijos</a> (internet, luz, alquiler…).</li>
            <li className={sinDatos ? '' : 'hecho'}><button className="enlace" onClick={() => abrir({ tipo: 'gasto' })}>Registra tu primer gasto</button> en segundos.</li>
          </ol>
        </section>
      )}

      <section className="rejilla-heroe">
        <div className="heroe">
          <div className="kpi-etq"><Icono n="cuentas" />Balance disponible ahora</div>
          <div className={`heroe-val num ${libre.disponible < 0 ? 't-peligro' : ''}`}>{dinero(libre.disponible)}</div>
          <p className="sec">Efectivo, bancos y billeteras. <a href="#/cuentas">Ver cuentas</a></p>
        </div>
        <div className={`heroe ${libre.libre < 0 ? 'peligro' : ''}`}>
          <div className="kpi-etq"><Icono n="reloj" />Libre hasta {libre.cobro ? `tu cobro del ${fmtCorta(libre.cobro.fecha)}` : 'las próximas 2 semanas'}</div>
          <div className={`heroe-val num ${libre.libre < 0 ? 't-peligro' : 't-ok'}`}>{dinero(libre.libre)}</div>
          <p className="sec">
            {libre.libre >= 0 ? <><strong className="num">{dinero(libre.diario)}</strong> por día durante {libre.dias} {libre.dias === 1 ? 'día' : 'días'}. </> : 'Tus compromisos superan lo disponible. '}
            {libre.comprometido > 0 && <>Ya descuenta {dinero(libre.comprometido)} en compromisos.</>}
          </p>
        </div>
      </section>

      <section className="rejilla-kpi" aria-label="Indicadores del período">
        <Kpi etiqueta="Ingresos" icono="ingreso" tono="ingreso" valor={dinero(t.ingresos)} sub={<Variacion pct={variacion(t.ingresos, ta.ingresos)} />} />
        <Kpi etiqueta="Gastos" icono="gasto" tono="gasto" valor={dinero(t.gastos)} sub={<Variacion pct={variacion(t.gastos, ta.gastos)} inverso />} />
        {inst ? (
          <Kpi etiqueta={`Restante · ${inst.presupuesto.nombre}`} icono="presupuestos" tono={inst.estado === 'excedido' ? 'peligro' : inst.estado === 'alerta' ? 'alerta' : undefined}
            valor={dinero(inst.restante)} sub={<><Barra valor={inst.gastado} pendiente={inst.pendiente} maximo={inst.total} estado={inst.estado} etiqueta="Presupuesto consumido" /><span>{fmtPct(inst.pct)} consumido de {dinero(inst.total)}</span></>} />
        ) : (
          <Kpi etiqueta="Presupuesto" icono="presupuestos" valor="—" sub={p.vista === '30d' || p.vista === 'personalizado' ? 'Elige semana, quincena o mes' : <a href="#/presupuestos">Crear un presupuesto {p.vista === 'semana' ? 'semanal' : p.vista === 'mes' ? 'mensual' : 'quincenal'}</a>} />
        )}
        <Kpi etiqueta="Pendiente de pago" icono="reloj" tono={pendientes.length ? 'alerta' : undefined} valor={dinero(pendientes.reduce((s, m) => s + m.monto, 0))} sub={`${pendientes.length} gasto(s) por pagar`} />
      </section>

      {avisos.length > 0 && (
        <section className="tarjeta" aria-label="Alertas">
          <h2 className="titulo-tarjeta">Alertas</h2>
          <ul className="alertas">
            {avisos.slice(0, 5).map((a) => (
              <li key={a.id} className={a.nivel}><Icono n={a.nivel === 'exito' ? 'check' : a.nivel === 'info' ? 'info' : 'alerta'} /><span>{a.texto}</span>{a.enlace && <a href={`#/${a.enlace}`} className="sec chico">Ver</a>}</li>
            ))}
          </ul>
          {avisos.length > 5 && <p className="sec chico">y {avisos.length - 5} más.</p>}
        </section>
      )}

      <div className="rejilla-2">
        <section className="tarjeta">
          <div className="tarjeta-cab"><h2 className="titulo-tarjeta">Ingresos vs. gastos</h2><span className="sec chico">{p.nombre}</span></div>
          <BarrasIngresoGasto titulo="Ingresos frente a gastos" datos={serie(d.movimientos, p.rango, d.ajustes)} />
        </section>
        <section className="tarjeta">
          <h2 className="titulo-tarjeta">Gastos por categoría</h2>
          <Dona titulo="Distribución de gastos" filas={[...cats].map(([id, valor]) => ({ nombre: nombreCat(id), valor, color: colorCat(id) }))} />
        </section>
        <section className="tarjeta">
          <h2 className="titulo-tarjeta">Evolución del gasto</h2>
          <Evolucion titulo="Gasto acumulado" puntos={gastoAcumulado(d.movimientos, p.rango)} presupuesto={inst?.total} hoy={h} />
        </section>
        <section className="tarjeta">
          <div className="tarjeta-cab"><h2 className="titulo-tarjeta">Presupuesto usado vs. disponible</h2>{inst && <a className="sec chico" href="#/presupuestos">Detalle</a>}</div>
          {inst ? <UsoPresupuesto filas={[
            { nombre: 'Total', usado: inst.gastado, pendiente: inst.pendiente, limite: inst.total },
            ...inst.filas.map((f) => ({ nombre: nombreCat(f.categoriaId), usado: f.gastado, pendiente: f.pendiente, limite: f.limite })),
          ]} /> : <p className="sec g-vacio">No hay un presupuesto para este tipo de período.</p>}
        </section>
      </div>

      <div className="rejilla-2">
        <section className="tarjeta">
          <div className="tarjeta-cab"><h2 className="titulo-tarjeta">Próximos compromisos</h2><a className="sec chico" href="#/compromisos">Todos</a></div>
          {proximos.length === 0 ? <Vacio icono="compromisos" titulo="Nada en los próximos 14 días" texto="Agrega tus pagos fijos en Compromisos." /> : (
            <ul className="lista">
              {proximos.map((v) => (
                <li key={`${v.programado.id}-${v.fecha}`} className="fila-lista">
                  <div className="min0">
                    <div className="fuerte">{v.programado.nombre}</div>
                    <div className={`chico ${v.vencido ? 't-peligro' : v.dias <= d.ajustes.alertas.diasPago ? 't-alerta' : 'sec'}`}>{v.vencido ? `Vencido ${relativo(v.fecha, h)}` : `${fmtFecha(v.fecha)} · ${relativo(v.fecha, h)}`}</div>
                  </div>
                  <span className={`num ${v.programado.tipo === 'ingreso' ? 't-ok' : ''}`}>{v.programado.tipo === 'ingreso' ? '+' : ''}{dinero(v.programado.monto)}</span>
                  {v.fecha === v.programado.proximaFecha && <button className="btn chico" onClick={() => setPagar(v.programado)}>{v.programado.tipo === 'ingreso' ? 'Recibir' : 'Pagar'}</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="tarjeta">
          <div className="tarjeta-cab"><h2 className="titulo-tarjeta">Gastos pendientes de pago</h2><a className="sec chico" href="#/movimientos?estado=pendiente">Ver</a></div>
          {pendientes.length === 0 ? <Vacio icono="check" titulo="No tienes gastos pendientes" /> : (
            <ul className="lista">
              {pendientes.slice(0, 6).map((m) => (
                <li key={m.id} className="fila-lista">
                  <div className="min0"><div className="fuerte">{m.nombre}</div><div className={`chico ${m.fecha < h ? 't-peligro' : 'sec'}`}>{fmtFecha(m.fecha)}{m.fecha < h ? ` · ${diasEntre(m.fecha, h)} días de atraso` : ''}</div></div>
                  <span className="num">{dinero(m.monto)}</span>
                  <button className="btn chico" onClick={() => intentar(() => marcarPagado(m.id), `${m.nombre} marcado como pagado`)}>Pagado</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="rejilla-2">
        <section className="tarjeta">
          <div className="tarjeta-cab"><h2 className="titulo-tarjeta">Metas de ahorro</h2><a className="sec chico" href="#/metas">Todas</a></div>
          {metas.length === 0 ? <Vacio icono="metas" titulo="Sin metas todavía" accion={<a className="btn" href="#/metas">Crear una meta</a>} /> : metas.map((g) => (
            <div key={g.meta.id} className="meta-mini">
              <div className="fila"><span className="fuerte">{g.meta.nombre}</span><span className="num chico">{dinero(g.ahorrado)} <span className="sec">/ {dinero(g.meta.objetivo)}</span></span></div>
              <Barra valor={g.ahorrado} maximo={g.meta.objetivo} estado="ahorro" etiqueta={`${g.meta.nombre}: ${fmtPct(g.progreso)}`} />
              <div className="sec chico">{fmtPct(g.progreso)}{g.meta.fechaLimite ? ` · meta al ${fmtFecha(g.meta.fechaLimite)}` : ''}</div>
            </div>
          ))}
        </section>
        <section className="tarjeta">
          <h2 className="titulo-tarjeta">Comparación con el período anterior</h2>
          <table className="tabla compacta">
            <thead><tr><th></th><th className="der">Este período</th><th className="der">Anterior</th><th className="der">Cambio</th></tr></thead>
            <tbody>
              {([['Ingresos', t.ingresos, ta.ingresos, false], ['Gastos', t.gastos, ta.gastos, true], ['Ahorro', t.ahorro, ta.ahorro, false], ['Balance neto', t.neto, ta.neto, false]] as const).map(([n, a, b, inv]) => (
                <tr key={n}><td>{n}</td><td className="der num">{dinero(a)}</td><td className="der num sec">{dinero(b)}</td><td className="der chico"><Variacion pct={variacion(a, b)} inverso={inv} /></td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {pagar && <PagarVencimiento d={d} p={pagar} onCerrar={() => setPagar(null)} />}
    </div>
  );
}
