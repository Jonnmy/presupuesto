import { useState } from 'react';
import { db } from '../db/db';
import { guardarPresupuesto } from '../db/acciones';
import { dinero, fmtPct, nuevoId, suma } from '../nucleo/dinero';
import { fmtRango, hoy, sumarDias } from '../nucleo/fechas';
import { historialPresupuesto, instanciaPresupuesto, periodoPresupuesto, versionVigente } from '../nucleo/finanzas';
import { quincenaDe } from '../nucleo/periodos';
import type { Datos, Presupuesto, TipoPeriodo } from '../nucleo/tipos';
import { Barra, Campo, EntradaDinero, Icono, mensajeError, Modal, useConfirmar, useUi, Vacio } from '../ui/base';

export const NOMBRE_PERIODO: Record<TipoPeriodo, string> = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', personalizado: 'Rango de fechas' };
const ESTADO_TXT = { ok: 'En orden', alerta: 'Cerca del límite', excedido: 'Superado', 'sin-limite': 'Sin límite' };

export function Presupuestos({ d }: { d: Datos }) {
  const [editar, setEditar] = useState<Presupuesto | 'nuevo' | null>(null);
  const q = quincenaDe(hoy(), d.ajustes.quincena);
  const activos = d.presupuestos.filter((p) => p.activo);
  const inactivos = d.presupuestos.filter((p) => !p.activo);
  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Presupuestos</h1><p className="sec">Tu quincena actual: {fmtRango(q)}. <a href="#/ajustes">Cambiar días de cobro</a></p></div>
        <button className="btn primario" onClick={() => setEditar('nuevo')}><Icono n="mas" />Nuevo presupuesto</button>
      </div>
      {d.presupuestos.length === 0 && <Vacio icono="presupuestos" titulo="Sin presupuestos" texto="Crea uno semanal, quincenal, mensual o para un rango de fechas." accion={<button className="btn primario" onClick={() => setEditar('nuevo')}>Crear presupuesto</button>} />}
      {activos.map((p) => <TarjetaPresupuesto key={p.id} d={d} p={p} onEditar={() => setEditar(p)} />)}
      {inactivos.length > 0 && (
        <section className="tarjeta">
          <h2 className="titulo-tarjeta">Pausados</h2>
          <ul className="lista">{inactivos.map((p) => (
            <li key={p.id} className="fila-lista"><span className="min0">{p.nombre} <span className="sec chico">· {NOMBRE_PERIODO[p.periodo]}</span></span>
              <button className="btn chico" onClick={() => db.presupuestos.update(p.id, { activo: true })}>Reactivar</button>
              <button className="btn chico" onClick={() => setEditar(p)}>Editar</button></li>
          ))}</ul>
        </section>
      )}
      {editar && <FormPresupuesto d={d} p={editar === 'nuevo' ? undefined : editar} onCerrar={() => setEditar(null)} />}
    </div>
  );
}

function TarjetaPresupuesto({ d, p, onEditar }: { d: Datos; p: Presupuesto; onEditar: () => void }) {
  const h = hoy();
  const [fecha, setFecha] = useState(p.periodo === 'personalizado' ? p.inicio ?? h : h);
  const [historial, setHistorial] = useState(false);
  const i = instanciaPresupuesto(p, fecha, d, h);
  const cat = (id: string) => d.categorias.find((c) => c.id === id);
  const actual = i.rango.inicio <= h && i.rango.fin >= h;
  const mover = (dir: -1 | 1) => setFecha(dir < 0 ? sumarDias(i.rango.inicio, -1) : sumarDias(i.rango.fin, 1));
  return (
    <section className="tarjeta pila">
      <div className="tarjeta-cab">
        <div className="min0">
          <h2 className="titulo-grande">{p.nombre}</h2>
          <div className="sec chico">{NOMBRE_PERIODO[p.periodo]} · {fmtRango(i.rango)}{actual ? ' · actual' : ''}</div>
        </div>
        <div className="fila-wrap">
          {p.periodo !== 'personalizado' && <>
            <button className="btn icono" aria-label="Período anterior" onClick={() => mover(-1)}><Icono n="izq" /></button>
            {!actual && <button className="btn chico" onClick={() => setFecha(h)}>Actual</button>}
            <button className="btn icono" aria-label="Período siguiente" onClick={() => mover(1)}><Icono n="der" /></button>
          </>}
          <button className="btn icono" aria-label={`Editar ${p.nombre}`} onClick={onEditar}><Icono n="editar" /></button>
        </div>
      </div>

      <div className="rejilla-kpi mini">
        <div><div className="kpi-etq">Presupuesto</div><div className="num fuerte">{dinero(i.total)}</div></div>
        <div><div className="kpi-etq">Gastado</div><div className="num fuerte t-gasto">{dinero(i.gastado)}</div></div>
        <div><div className="kpi-etq">Pendiente</div><div className="num fuerte t-alerta">{dinero(i.pendiente)}</div></div>
        <div><div className="kpi-etq">Te queda</div><div className={`num fuerte ${i.restante < 0 ? 't-peligro' : 't-ok'}`}>{dinero(i.restante)}</div></div>
      </div>
      <Barra valor={i.gastado} pendiente={i.pendiente} maximo={i.total} estado={i.estado} etiqueta={`${p.nombre}: ${fmtPct(i.pct)} consumido`} />
      <p className={`chico ${i.estado === 'excedido' ? 't-peligro' : i.estado === 'alerta' ? 't-alerta' : 'sec'}`}>
        {fmtPct(i.pct)} consumido · {ESTADO_TXT[i.estado]}
        {actual && i.diasRestantes > 0 && i.restante > 0 && <> · puedes gastar <strong className="num">{dinero(i.diarioDisponible)}</strong> por día los próximos {i.diasRestantes} días</>}
      </p>

      {i.filas.length > 0 && (
        <div className="pila">
          {i.filas.sort((a, b) => b.gastado + b.pendiente - (a.gastado + a.pendiente)).map((f) => (
            <div key={f.categoriaId}>
              <div className="fila"><span className="etiqueta-cat"><i className="pt" style={{ background: cat(f.categoriaId)?.color }} />{cat(f.categoriaId)?.nombre ?? 'Categoría eliminada'}</span>
                <span className="num chico">{dinero(f.gastado + f.pendiente)} <span className="sec">/ {dinero(f.limite)}</span></span></div>
              <Barra valor={f.gastado} pendiente={f.pendiente} maximo={f.limite} estado={f.estado} etiqueta={`${cat(f.categoriaId)?.nombre}: ${fmtPct(f.pct)}`} />
              <div className={`chico ${f.restante < 0 ? 't-peligro' : 'sec'}`}>{f.restante < 0 ? `Superado por ${dinero(-f.restante)}` : `Quedan ${dinero(f.restante)}`}{f.pendiente > 0 ? ` · ${dinero(f.pendiente)} pendiente` : ''}</div>
            </div>
          ))}
        </div>
      )}
      {i.sinLimite.length > 0 && (
        <details>
          <summary className="sec chico">Otras categorías sin límite: {dinero(suma(i.sinLimite.map((x) => x.gastado)))}</summary>
          <ul className="lista">{i.sinLimite.map((x) => <li key={x.categoriaId} className="fila"><span>{cat(x.categoriaId)?.nombre ?? 'Sin categoría'}</span><span className="num">{dinero(x.gastado)}</span></li>)}</ul>
        </details>
      )}

      {p.periodo !== 'personalizado' && (
        <div>
          <button className="btn plano chico" aria-expanded={historial} onClick={() => setHistorial(!historial)}>{historial ? 'Ocultar historial' : 'Ver historial'}</button>
          {historial && (
            <table className="tabla compacta">
              <thead><tr><th>Período</th><th className="der">Presupuesto</th><th className="der">Gastado</th><th className="der">Resultado</th></tr></thead>
              <tbody>{historialPresupuesto(p, d, h, 8).map((x) => (
                <tr key={x.rango.inicio}><td className="chico">{fmtRango(x.rango)}</td><td className="der num">{dinero(x.total)}</td><td className="der num">{dinero(x.gastado)}</td>
                  <td className={`der num ${x.gastado > x.total ? 't-peligro' : 't-ok'}`}>{x.gastado > x.total ? `−${dinero(x.gastado - x.total)}` : `+${dinero(x.total - x.gastado)}`}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

function FormPresupuesto({ d, p, onCerrar }: { d: Datos; p?: Presupuesto; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const h = hoy();
  const v = p ? versionVigente(p, periodoPresupuesto(p, h, d.ajustes).inicio) : undefined;
  const [nombre, setNombre] = useState(p?.nombre ?? '');
  const [periodo, setPeriodo] = useState<TipoPeriodo>(p?.periodo ?? 'quincenal');
  const [inicio, setInicio] = useState(p?.inicio ?? h);
  const [fin, setFin] = useState(p?.fin ?? sumarDias(h, 13));
  const [total, setTotal] = useState<number | null>(v?.total ?? null);
  const [limites, setLimites] = useState<Record<string, number>>(v?.limites ?? {});
  const [desde, setDesde] = useState<'actual' | 'siguiente'>('actual');
  const [error, setError] = useState('');
  const cats = d.categorias.filter((c) => c.tipo === 'gasto' && !c.archivada);
  const sumaLim = suma(Object.values(limites).filter((x) => x > 0));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!total) return setError('Escribe el monto total del presupuesto.');
    const base: Presupuesto = p ? { ...p, nombre, periodo, inicio, fin } : { id: nuevoId(), nombre, periodo, inicio, fin, versiones: [], activo: true, creadoEn: new Date().toISOString() };
    if (periodo !== 'personalizado') { delete base.inicio; delete base.fin; }
    const r = periodoPresupuesto(base, h, d.ajustes);
    try {
      await guardarPresupuesto(base, { total, limites }, desde === 'actual' ? r.inicio : sumarDias(r.fin, 1));
      avisar(p ? 'Presupuesto actualizado' : 'Presupuesto creado');
      onCerrar();
    } catch (err) { setError(mensajeError(err)); }
  }

  return (
    <Modal titulo={p ? 'Editar presupuesto' : 'Nuevo presupuesto'} onCerrar={onCerrar} ancho="grande">
      <form className="pila" onSubmit={guardar} noValidate>
        <div className="dos-col">
          <Campo etiqueta="Nombre"><input type="text" value={nombre} maxLength={50} placeholder="Ej.: Mi quincena" onChange={(e) => setNombre(e.target.value)} data-autofocus /></Campo>
          <Campo etiqueta="Período">
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as TipoPeriodo)}>
              {Object.entries(NOMBRE_PERIODO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </Campo>
        </div>
        {periodo === 'personalizado' && (
          <div className="dos-col">
            <Campo etiqueta="Desde"><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
            <Campo etiqueta="Hasta"><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></Campo>
          </div>
        )}
        <Campo etiqueta={`Dinero disponible para ${periodo === 'semanal' ? 'cada semana' : periodo === 'quincenal' ? 'cada quincena' : periodo === 'mensual' ? 'cada mes' : 'el rango'}`}>
          <EntradaDinero etiqueta="Monto total" valor={total} onCambio={setTotal} grande />
        </Campo>
        <fieldset className="grupo">
          <legend className="campo-etq">Límites por categoría (opcional)</legend>
          <div className="limites">
            {cats.map((c) => (
              <div key={c.id} className="limite-fila">
                <span className="etiqueta-cat"><i className="pt" style={{ background: c.color }} />{c.nombre}</span>
                <EntradaDinero etiqueta={`Límite de ${c.nombre}`} valor={limites[c.id] || null} onCambio={(x) => setLimites({ ...limites, [c.id]: x ?? 0 })} />
              </div>
            ))}
          </div>
          <p className={`chico ${total && sumaLim > total ? 't-peligro' : 'sec'}`}>Asignado a categorías: {dinero(sumaLim)}{total ? ` de ${dinero(total)} · sin asignar ${dinero(total - sumaLim)}` : ''}</p>
        </fieldset>
        {p && p.periodo === periodo && periodo !== 'personalizado' && (
          <Campo etiqueta="Aplicar los cambios" ayuda="Los períodos anteriores conservan sus montos.">
            <select value={desde} onChange={(e) => setDesde(e.target.value as 'actual')}><option value="actual">Desde el período actual</option><option value="siguiente">Desde el próximo período</option></select>
          </Campo>
        )}
        {error && <p className="error-form" role="alert">{error}</p>}
        <div className="acciones-form">
          {p ? (
            <div className="fila-wrap">
              <button type="button" className="btn peligro" onClick={() => pedir({ titulo: 'Eliminar presupuesto', texto: `Se eliminará "${p.nombre}". Tus movimientos no se borran.`, onSi: async () => { await db.presupuestos.delete(p.id); avisar('Presupuesto eliminado'); onCerrar(); } })}>Eliminar</button>
              <button type="button" className="btn" onClick={async () => { await db.presupuestos.update(p.id, { activo: !p.activo }); onCerrar(); }}>{p.activo ? 'Pausar' : 'Reactivar'}</button>
            </div>
          ) : <span />}
          <div className="fila-wrap"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn primario">Guardar</button></div>
        </div>
      </form>
      {confirmacion}
    </Modal>
  );
}
