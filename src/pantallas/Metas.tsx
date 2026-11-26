import { useState } from 'react';
import { eliminarMeta, eliminarMovimiento, guardarMeta, restaurarMovimiento } from '../db/acciones';
import { dinero, fmtPct, nuevoId } from '../nucleo/dinero';
import { diasEntre, fmtFecha, hoy } from '../nucleo/fechas';
import { progresoMetas } from '../nucleo/finanzas';
import type { Datos, Meta } from '../nucleo/tipos';
import { Barra, Campo, EntradaDinero, Icono, mensajeError, Modal, useConfirmar, useUi, Vacio } from '../ui/base';

export function Metas({ d }: { d: Datos }) {
  const { abrir, avisar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const [editar, setEditar] = useState<Meta | 'nueva' | null>(null);
  const metas = progresoMetas(d);
  const h = hoy();
  const total = metas.reduce((s, g) => s + g.ahorrado, 0);
  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Metas de ahorro</h1><p className="sec">Ahorrado en total: <strong className="num">{dinero(total)}</strong></p></div>
        <button className="btn primario" onClick={() => setEditar('nueva')}><Icono n="mas" />Nueva meta</button>
      </div>
      {metas.length === 0 && <Vacio icono="metas" titulo="Todavía no tienes metas" texto="Ej.: fondo de emergencia, comprar un equipo, un viaje." accion={<button className="btn primario" onClick={() => setEditar('nueva')}>Crear meta</button>} />}
      <div className="rejilla-2">
        {metas.map((g) => {
          const dias = g.meta.fechaLimite ? diasEntre(h, g.meta.fechaLimite) : null;
          const quincenas = dias !== null && dias > 0 ? Math.max(1, Math.ceil(dias / 15)) : null;
          return (
            <article key={g.meta.id} className="tarjeta pila">
              <div className="tarjeta-cab">
                <div className="min0"><h3>{g.meta.nombre}</h3>{g.meta.descripcion && <p className="sec chico">{g.meta.descripcion}</p>}</div>
                <button className="btn icono" aria-label={`Editar ${g.meta.nombre}`} onClick={() => setEditar(g.meta)}><Icono n="editar" /></button>
              </div>
              <div className="fila"><span className="num grande t-ahorro">{dinero(g.ahorrado)}</span><span className="sec num">de {dinero(g.meta.objetivo)}</span></div>
              <Barra valor={g.ahorrado} maximo={g.meta.objetivo} estado="ahorro" etiqueta={`${g.meta.nombre}: ${fmtPct(g.progreso)}`} />
              <div className="sec chico">
                {g.progreso >= 100 ? '¡Meta cumplida!' : <>{fmtPct(g.progreso)} · faltan {dinero(g.falta)}</>}
                {g.meta.fechaLimite && g.progreso < 100 && <> · {dias! < 0 ? <span className="t-peligro">venció el {fmtFecha(g.meta.fechaLimite)}</span> : <>para el {fmtFecha(g.meta.fechaLimite)}{quincenas ? ` (≈ ${dinero(Math.ceil(g.falta / quincenas))} por quincena)` : ''}</>}</>}
              </div>
              <div className="sec chico">Creada el {fmtFecha(g.meta.fechaCreacion)}</div>
              <div className="fila-wrap">
                <button className="btn chico primario" onClick={() => abrir({ tipo: 'aporte', valores: { metaId: g.meta.id } })}>Aportar</button>
                <button className="btn chico" disabled={g.ahorrado <= 0} onClick={() => abrir({ tipo: 'retiro', valores: { metaId: g.meta.id } })}>Retirar</button>
              </div>
              {g.historial.length > 0 && (
                <details><summary className="sec chico">Movimientos ({g.historial.length})</summary>
                  <ul className="lista">{g.historial.map((m) => (
                    <li key={m.id} className="fila-lista">
                      <span className="min0 chico">{fmtFecha(m.fecha)} · {m.tipo === 'aporte' ? 'Aporte' : 'Retiro'} · {d.cuentas.find((c) => c.id === m.cuentaId)?.nombre}</span>
                      <span className={`num ${m.tipo === 'aporte' ? 't-ok' : 't-gasto'}`}>{m.tipo === 'aporte' ? '+' : '−'}{dinero(m.monto)}</span>
                      <button className="btn icono" aria-label="Eliminar movimiento" onClick={() => pedir({ titulo: 'Eliminar movimiento', texto: `Se eliminará este ${m.tipo} de ${dinero(m.monto)}.`, onSi: async () => { const b = await eliminarMovimiento(m.id); avisar('Eliminado', { deshacer: () => b && restaurarMovimiento(b) }); } })}><Icono n="borrar" /></button>
                    </li>
                  ))}</ul>
                </details>
              )}
            </article>
          );
        })}
      </div>
      <p className="sec chico">Aportar mueve dinero de una cuenta a la meta (deja de estar "disponible" pero sigue siendo tuyo). Retirar lo devuelve. Ninguno cuenta como gasto.</p>
      {editar && <FormMeta d={d} x={editar === 'nueva' ? undefined : editar} onCerrar={() => setEditar(null)} />}
      {confirmacion}
    </div>
  );
}

function FormMeta({ d, x, onCerrar }: { d: Datos; x?: Meta; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const [y, setY] = useState<Meta>(x ?? { id: nuevoId(), nombre: '', objetivo: 0, saldoInicial: 0, fechaCreacion: hoy() });
  const [objetivo, setObjetivo] = useState<number | null>(x?.objetivo ?? null);
  const [inicial, setInicial] = useState<number | null>(x?.saldoInicial ?? 0);
  const [error, setError] = useState('');
  const set = (c: Partial<Meta>) => { setY({ ...y, ...c }); setError(''); };
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try { await guardarMeta({ ...y, objetivo: objetivo ?? 0, saldoInicial: inicial ?? 0 }); avisar(x ? 'Meta actualizada' : 'Meta creada'); onCerrar(); } catch (err) { setError(mensajeError(err)); }
  }
  return (
    <Modal titulo={x ? 'Editar meta' : 'Nueva meta de ahorro'} onCerrar={onCerrar}>
      <form className="pila" onSubmit={guardar} noValidate>
        <Campo etiqueta="Nombre"><input type="text" value={y.nombre} maxLength={50} data-autofocus placeholder="Ej.: Fondo de emergencia" onChange={(e) => set({ nombre: e.target.value })} /></Campo>
        <div className="dos-col">
          <Campo etiqueta="Cantidad objetivo"><EntradaDinero etiqueta="Cantidad objetivo" valor={objetivo} onCambio={setObjetivo} /></Campo>
          <Campo etiqueta="Ya tengo ahorrado" ayuda="Sin movimiento; solo el punto de partida."><EntradaDinero etiqueta="Ahorrado al inicio" valor={inicial} onCambio={setInicial} permitirCero /></Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta="Fecha límite (opcional)"><input type="date" value={y.fechaLimite ?? ''} onChange={(e) => set({ fechaLimite: e.target.value || undefined })} /></Campo>
          <Campo etiqueta="Fecha de creación"><input type="date" value={y.fechaCreacion} onChange={(e) => set({ fechaCreacion: e.target.value })} /></Campo>
        </div>
        <Campo etiqueta="Descripción (opcional)"><input type="text" value={y.descripcion ?? ''} maxLength={200} onChange={(e) => set({ descripcion: e.target.value })} /></Campo>
        {error && <p className="error-form" role="alert">{error}</p>}
        <div className="acciones-form">
          {x ? <button type="button" className="btn peligro" onClick={() => pedir({ titulo: 'Eliminar meta', texto: d.movimientos.some((m) => m.metaId === x.id) ? 'Tiene aportes registrados: se archivará para conservar el historial.' : `Se eliminará "${x.nombre}".`, onSi: async () => { const r = await eliminarMeta(x.id); avisar(r === 'archivada' ? 'Meta archivada' : 'Meta eliminada'); onCerrar(); } })}>Eliminar</button> : <span />}
          <div className="fila-wrap"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn primario">Guardar</button></div>
        </div>
      </form>
      {confirmacion}
    </Modal>
  );
}
