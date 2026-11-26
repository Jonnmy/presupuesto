import { useState } from 'react';
import { eliminarDeuda, eliminarMovimiento, guardarDeuda, restaurarMovimiento } from '../db/acciones';
import { dinero, fmtPct, nuevoId } from '../nucleo/dinero';
import { fmtFecha, hoy } from '../nucleo/fechas';
import { CAT_DEUDAS, proximoDia, resumenDeudas } from '../nucleo/finanzas';
import type { Datos, Deuda } from '../nucleo/tipos';
import { Barra, Campo, EntradaDinero, Icono, mensajeError, Modal, useConfirmar, useUi, Vacio } from '../ui/base';
import { FormCuenta } from './Cuentas';

export function Deudas({ d }: { d: Datos }) {
  const { abrir, avisar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const [editar, setEditar] = useState<Deuda | 'nueva' | null>(null);
  const [nuevaTarjeta, setNuevaTarjeta] = useState(false);
  const r = resumenDeudas(d);
  const h = hoy();

  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Deudas y tarjetas</h1><p className="sec">Cuánto debes, cuánto has pagado y cuánto falta.</p></div>
        <div className="fila-wrap">
          <button className="btn" onClick={() => setNuevaTarjeta(true)}><Icono n="tarjeta" />Nueva tarjeta</button>
          <button className="btn primario" onClick={() => setEditar('nueva')}><Icono n="mas" />Nueva deuda</button>
        </div>
      </div>
      <section className="rejilla-kpi">
        <div className="kpi peligro"><div className="kpi-etq">Debo en total</div><div className="kpi-val num">{dinero(r.totalPendiente)}</div><div className="kpi-sub">préstamos {dinero(r.totalPrestamos)} · tarjetas {dinero(r.totalTarjetas)}</div></div>
        <div className="kpi ingreso"><div className="kpi-etq">Pagado de préstamos</div><div className="kpi-val num">{dinero(r.totalPagado)}</div><div className="kpi-sub">de {dinero(r.totalOriginal)} originales</div></div>
        <div className="kpi"><div className="kpi-etq">Falta por pagar (préstamos)</div><div className="kpi-val num">{dinero(r.totalPrestamos)}</div><div className="kpi-sub">{r.totalOriginal ? fmtPct((r.totalPagado / r.totalOriginal) * 100) + ' pagado' : ''}</div></div>
      </section>

      <section className="pila">
        <h2 className="titulo-seccion">Préstamos y deudas</h2>
        {r.prestamos.length === 0 ? <Vacio icono="deudas" titulo="Sin deudas registradas" texto="Registra préstamos, financiamientos o dinero que debas a alguien." accion={<button className="btn primario" onClick={() => setEditar('nueva')}>Registrar deuda</button>} /> : r.prestamos.map((p) => (
          <article key={p.deuda.id} className="tarjeta pila">
            <div className="tarjeta-cab">
              <div className="min0"><h3>{p.deuda.nombre}</h3><div className="sec chico">{p.deuda.acreedor}{p.deuda.tasaAnual ? ` · ${p.deuda.tasaAnual}% anual` : ''}{p.deuda.cuota ? ` · cuota ${dinero(p.deuda.cuota)}` : ''}{p.deuda.diaVencimiento && p.pendiente > 0 ? ` · próximo vencimiento ${fmtFecha(proximoDia(p.deuda.diaVencimiento, h))}` : ''}</div></div>
              <div className="fila-wrap">
                {p.pendiente > 0 ? <button className="btn chico primario" onClick={() => abrir({ tipo: 'pagoDeuda', valores: { deudaId: p.deuda.id, categoriaId: CAT_DEUDAS, nombre: `Abono ${p.deuda.nombre}` } })}>Abonar</button> : <span className="etiqueta ok">Saldada</span>}
                <button className="btn icono" aria-label={`Editar ${p.deuda.nombre}`} onClick={() => setEditar(p.deuda)}><Icono n="editar" /></button>
              </div>
            </div>
            <div className="fila"><span className="sec chico">Pagado {dinero(p.pagado)}</span><span className="num fuerte">Falta {dinero(p.pendiente)}</span></div>
            <Barra valor={p.pagado} maximo={p.deuda.montoOriginal} estado="ahorro" etiqueta={`${p.deuda.nombre}: ${fmtPct(p.progreso)} pagado`} />
            <div className="sec chico">{fmtPct(p.progreso)} pagado de {dinero(p.deuda.montoOriginal)}</div>
            {p.abonos.length > 0 && (
              <details><summary className="sec chico">Historial de abonos ({p.abonos.length})</summary>
                <ul className="lista">{p.abonos.map((m) => (
                  <li key={m.id} className="fila-lista"><span className="min0">{fmtFecha(m.fecha)} · {d.cuentas.find((c) => c.id === m.cuentaId)?.nombre}</span><span className="num">{dinero(m.monto)}</span>
                    <button className="btn icono" aria-label="Eliminar abono" onClick={() => pedir({ titulo: 'Eliminar abono', texto: `Se eliminará el abono de ${dinero(m.monto)} del ${fmtFecha(m.fecha)}. El saldo de la deuda y de la cuenta se recalculan.`, onSi: async () => { const b = await eliminarMovimiento(m.id); avisar('Abono eliminado', { deshacer: () => b && restaurarMovimiento(b) }); } })}><Icono n="borrar" /></button></li>
                ))}</ul>
              </details>
            )}
          </article>
        ))}
      </section>

      <section className="pila">
        <h2 className="titulo-seccion">Tarjetas de crédito</h2>
        {r.tarjetas.length === 0 ? <Vacio icono="tarjeta" titulo="Sin tarjetas registradas" texto="Agrega tus tarjetas para ver balance, disponible, corte y pago." accion={<button className="btn" onClick={() => setNuevaTarjeta(true)}>Agregar tarjeta</button>} /> : (
          <div className="rejilla-cuentas">
            {r.tarjetas.map((t) => (
              <article key={t.cuenta.id} className="tarjeta pila">
                <div className="fila"><h3>{t.cuenta.nombre}</h3><Icono n="tarjeta" /></div>
                <div><div className="kpi-etq">Balance adeudado</div><div className="num grande">{dinero(t.deuda)}</div></div>
                <Barra valor={t.deuda} maximo={t.limite} estado={t.uso >= 90 ? 'excedido' : t.uso >= 70 ? 'alerta' : 'ok'} etiqueta={`Uso del límite: ${fmtPct(t.uso)}`} />
                <div className="sec chico">Disponible {dinero(t.disponible)} de {dinero(t.limite)} · {fmtPct(t.uso)} usado</div>
                <div className="sec chico">{t.proximoCorte ? `Corte: ${fmtFecha(t.proximoCorte)}` : 'Sin día de corte'} · {t.proximoPago ? `Pago: ${fmtFecha(t.proximoPago)}` : 'sin día de pago'}</div>
                <div className="fila-wrap">
                  <button className="btn chico" onClick={() => abrir({ tipo: 'gasto', valores: { cuentaId: t.cuenta.id, metodo: 'credito' } })}>Registrar compra</button>
                  {t.deuda > 0 && <button className="btn chico primario" onClick={() => abrir({ tipo: 'transferencia', valores: { cuentaDestinoId: t.cuenta.id, nombre: `Pago ${t.cuenta.nombre}`, monto: t.deuda, cuentaId: d.cuentas.find((c) => c.tipo === 'banco' && !c.archivada)?.id } })}>Pagar tarjeta</button>}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="sec chico">Pagar la tarjeta es una transferencia desde tu cuenta: no cuenta como gasto porque las compras ya se contaron cuando las hiciste.</p>
      </section>

      {editar && <FormDeuda d={d} x={editar === 'nueva' ? undefined : editar} onCerrar={() => setEditar(null)} />}
      {nuevaTarjeta && <FormCuenta d={d} tipoInicial="tarjeta" onCerrar={() => setNuevaTarjeta(false)} />}
      {confirmacion}
    </div>
  );
}

function FormDeuda({ d, x, onCerrar }: { d: Datos; x?: Deuda; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const [y, setY] = useState<Deuda>(x ?? { id: nuevoId(), nombre: '', acreedor: '', montoOriginal: 0, saldoInicial: 0, cuota: 0, fechaInicio: hoy(), creadoEn: new Date().toISOString() });
  const [original, setOriginal] = useState<number | null>(x?.montoOriginal ?? null);
  const [saldo, setSaldo] = useState<number | null>(x?.saldoInicial ?? null);
  const [cuota, setCuota] = useState<number | null>(x?.cuota || null);
  const [error, setError] = useState('');
  const set = (c: Partial<Deuda>) => { setY({ ...y, ...c }); setError(''); };
  const tieneAbonos = !!x && d.movimientos.some((m) => m.deudaId === x.id);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await guardarDeuda({ ...y, montoOriginal: original ?? 0, saldoInicial: saldo ?? original ?? 0, cuota: cuota ?? 0 });
      avisar(x ? 'Deuda actualizada' : 'Deuda registrada');
      onCerrar();
    } catch (err) { setError(mensajeError(err)); }
  }
  return (
    <Modal titulo={x ? 'Editar deuda' : 'Nueva deuda'} onCerrar={onCerrar}>
      <form className="pila" onSubmit={guardar} noValidate>
        <div className="dos-col">
          <Campo etiqueta="Nombre de la deuda"><input type="text" value={y.nombre} maxLength={50} data-autofocus placeholder="Ej.: Préstamo personal" onChange={(e) => set({ nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Entidad o acreedor"><input type="text" value={y.acreedor} maxLength={50} placeholder="Ej.: Banco, cooperativa, persona" onChange={(e) => set({ acreedor: e.target.value })} /></Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta="Monto original"><EntradaDinero etiqueta="Monto original" valor={original} onCambio={setOriginal} /></Campo>
          <Campo etiqueta="Saldo pendiente al registrarla" ayuda={tieneAbonos ? 'Los abonos registrados se restan de este saldo.' : 'Si es nueva, igual al monto original.'}><EntradaDinero etiqueta="Saldo pendiente" valor={saldo} onCambio={setSaldo} /></Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta="Cuota habitual"><EntradaDinero etiqueta="Cuota" valor={cuota} onCambio={setCuota} /></Campo>
          <Campo etiqueta="Día de vencimiento"><input type="number" min={1} max={31} value={y.diaVencimiento ?? ''} onChange={(e) => set({ diaVencimiento: e.target.value ? Number(e.target.value) : undefined })} /></Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta="Tasa de interés anual % (si aplica)"><input type="number" min={0} max={200} step="0.01" value={y.tasaAnual ?? ''} onChange={(e) => set({ tasaAnual: e.target.value ? Number(e.target.value) : undefined })} /></Campo>
          <Campo etiqueta="Fecha de inicio"><input type="date" value={y.fechaInicio} onChange={(e) => set({ fechaInicio: e.target.value })} /></Campo>
        </div>
        <Campo etiqueta="Notas"><input type="text" value={y.notas ?? ''} maxLength={200} onChange={(e) => set({ notas: e.target.value })} /></Campo>
        {error && <p className="error-form" role="alert">{error}</p>}
        <div className="acciones-form">
          {x ? <button type="button" className="btn peligro" onClick={() => pedir({ titulo: 'Eliminar deuda', texto: tieneAbonos ? 'Tiene abonos registrados: se archivará para conservar el historial.' : `Se eliminará "${x.nombre}".`, onSi: async () => { const r = await eliminarDeuda(x.id); avisar(r === 'archivada' ? 'Deuda archivada' : 'Deuda eliminada'); onCerrar(); } })}>Eliminar</button> : <span />}
          <div className="fila-wrap"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn primario">Guardar</button></div>
        </div>
      </form>
      {confirmacion}
    </Modal>
  );
}
