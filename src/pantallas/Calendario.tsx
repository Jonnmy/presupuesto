import { useState } from 'react';
import { dinero } from '../nucleo/dinero';
import { aFecha, diaSemana, diasDelMes, fmtDia, hoy, MESES, partes, sumarMeses } from '../nucleo/fechas';
import { proximoDia, saldoDeuda, vencimientosEn } from '../nucleo/finanzas';
import type { Datos, Movimiento } from '../nucleo/tipos';
import { Icono, useUi } from '../ui/base';
import { NOMBRE_TIPO } from '../ui/FormMovimiento';
import { PagarVencimiento } from '../ui/Pagar';
import type { Programado } from '../nucleo/tipos';

type Evento =
  | { clase: 'cobro' | 'programado'; texto: string; monto: number; p: Programado; vencido: boolean; esProximo: boolean }
  | { clase: 'ingreso' | 'gasto' | 'pendiente' | 'ahorro' | 'otro'; texto: string; monto: number; m: Movimiento }
  | { clase: 'vence'; texto: string; monto: number };

export function Calendario({ d }: { d: Datos }) {
  const { abrir } = useUi();
  const h = hoy();
  const [mes, setMes] = useState(h.slice(0, 7) + '-01');
  const [sel, setSel] = useState(h);
  const [pagar, setPagar] = useState<Programado | null>(null);
  const [a, m] = partes(mes);
  const ultimo = diasDelMes(a, m);
  const rango = { inicio: mes, fin: aFecha(a, m, ultimo) };

  const eventos = new Map<string, Evento[]>();
  const agregar = (f: string, e: Evento) => eventos.set(f, [...(eventos.get(f) ?? []), e]);
  for (const x of d.movimientos) {
    if (x.fecha < rango.inicio || x.fecha > rango.fin) continue;
    const clase = x.estado === 'pendiente' ? 'pendiente' : x.tipo === 'ingreso' ? 'ingreso' : x.tipo === 'gasto' || x.tipo === 'pagoDeuda' ? 'gasto' : x.tipo === 'aporte' || x.tipo === 'retiro' ? 'ahorro' : 'otro';
    agregar(x.fecha, { clase, texto: x.nombre, monto: x.monto, m: x });
  }
  for (const v of vencimientosEn(d.programados, rango, h)) {
    if (v.fecha < rango.inicio) continue;
    agregar(v.fecha, { clase: v.programado.tipo === 'ingreso' ? 'cobro' : 'programado', texto: v.programado.nombre, monto: v.programado.monto, p: v.programado, vencido: v.vencido, esProximo: v.fecha === v.programado.proximaFecha });
  }
  for (const x of d.deudas.filter((y) => !y.archivada && y.diaVencimiento && saldoDeuda(y, d.movimientos) > 0)) {
    agregar(proximoDia(x.diaVencimiento!, mes), { clase: 'vence', texto: `Cuota ${x.nombre}`, monto: x.cuota });
  }
  for (const c of d.cuentas.filter((y) => y.tipo === 'tarjeta' && !y.archivada)) {
    if (c.diaPago) agregar(proximoDia(c.diaPago, mes), { clase: 'vence', texto: `Pago ${c.nombre}`, monto: 0 });
    if (c.diaCorte) agregar(proximoDia(c.diaCorte, mes), { clase: 'vence', texto: `Corte ${c.nombre}`, monto: 0 });
  }

  const inicioSemana = d.ajustes.inicioSemana;
  const huecos = (diaSemana(mes) - inicioSemana + 7) % 7;
  const nombresDias = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const cabecera = Array.from({ length: 7 }, (_, i) => nombresDias[(i + inicioSemana) % 7]);
  const delDia = eventos.get(sel) ?? [];

  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Calendario financiero</h1><p className="sec">Cobros, pagos programados, vencimientos y movimientos.</p></div>
        <div className="navega">
          <button className="btn icono" aria-label="Mes anterior" onClick={() => setMes(sumarMeses(mes, -1))}><Icono n="izq" /></button>
          <span className="nombre-periodo">{MESES[m - 1]} {a}</span>
          <button className="btn icono" aria-label="Mes siguiente" onClick={() => setMes(sumarMeses(mes, 1))}><Icono n="der" /></button>
        </div>
      </div>
      <div className="leyenda">
        <span><i className="pt ingreso" />Ingreso / cobro</span><span><i className="pt gasto" />Gasto</span><span><i className="pt pend" />Pendiente / programado</span><span><i className="pt ahorro" />Ahorro</span><span><i className="pt vence" />Vencimiento</span>
      </div>
      <div className="rejilla-cal-y-dia">
        <section className="tarjeta calendario" aria-label={`Calendario de ${MESES[m - 1]}`}>
          <div className="cal-cab">{cabecera.map((x, i) => <span key={i}>{x}</span>)}</div>
          <div className="cal-dias">
            {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} />)}
            {Array.from({ length: ultimo }, (_, i) => {
              const f = aFecha(a, m, i + 1);
              const ev = eventos.get(f) ?? [];
              const clases = [...new Set(ev.map((e) => (e.clase === 'cobro' ? 'ingreso' : e.clase === 'programado' ? 'pend' : e.clase === 'pendiente' ? 'pend' : e.clase)))];
              return (
                <button key={f} className={`cal-dia ${f === h ? 'hoy' : ''} ${f === sel ? 'sel' : ''}`} aria-pressed={f === sel} aria-label={`${fmtDia(f)}: ${ev.length} evento(s)`} onClick={() => setSel(f)}>
                  <span className="n">{i + 1}</span>
                  <span className="puntos">{clases.slice(0, 4).map((c) => <i key={c} className={`pt ${c}`} />)}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="tarjeta">
          <div className="tarjeta-cab"><h2 className="titulo-tarjeta">{fmtDia(sel)}</h2><button className="btn chico" onClick={() => abrir({ tipo: 'gasto', valores: { fecha: sel } })}><Icono n="mas" />Gasto</button></div>
          {delDia.length === 0 ? <p className="sec">Sin movimientos ni vencimientos este día.</p> : (
            <ul className="lista">{delDia.map((e, i) => (
              <li key={i} className="fila-lista">
                <i className={`pt ${e.clase === 'cobro' ? 'ingreso' : e.clase === 'programado' || e.clase === 'pendiente' ? 'pend' : e.clase}`} />
                <div className="min0">
                  <div className="recorta">{e.texto}</div>
                  <div className="sec chico">{'m' in e ? `${NOMBRE_TIPO[e.m.tipo]}${e.m.estado === 'pendiente' ? ' · pendiente' : ''}` : 'p' in e ? (e.vencido ? 'Programado · vencido' : e.clase === 'cobro' ? 'Cobro programado' : 'Pago programado') : 'Vencimiento'}</div>
                </div>
                {e.monto > 0 && <span className="num">{dinero(e.monto)}</span>}
                {'m' in e && <button className="btn icono" aria-label="Editar" onClick={() => abrir({ movimiento: e.m })}><Icono n="editar" /></button>}
                {'p' in e && e.esProximo && <button className="btn chico" onClick={() => setPagar(e.p)}>{e.clase === 'cobro' ? 'Recibir' : 'Pagar'}</button>}
              </li>
            ))}</ul>
          )}
        </section>
      </div>
      {pagar && <PagarVencimiento d={d} p={pagar} onCerrar={() => setPagar(null)} />}
    </div>
  );
}
