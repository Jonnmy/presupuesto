import { useState } from 'react';
import { eliminarProgramado, guardarProgramado, omitirVencimiento } from '../db/acciones';
import { dinero, nuevoId, suma } from '../nucleo/dinero';
import { diasEntre, fmtFecha, hoy, relativo, sumarDias } from '../nucleo/fechas';
import { vencimientosEn } from '../nucleo/finanzas';
import { diasQuincenaDe, mensualEquivalente, NOMBRE_FRECUENCIA } from '../nucleo/recurrencia';
import type { Clase, Datos, Frecuencia, Programado } from '../nucleo/tipos';
import { Campo, EntradaDinero, Icono, mensajeError, Modal, Segmentado, useConfirmar, useUi, Vacio } from '../ui/base';
import { NOMBRE_CLASE } from '../ui/FormMovimiento';
import { PagarVencimiento } from '../ui/Pagar';

export function textoFrecuencia(p: Programado): string {
  if (p.frecuencia === 'quincenal') { const [a, b] = diasQuincenaDe(p, p.proximaFecha); return `Quincenal (días ${a} y ${b === 31 ? 'último' : b})`; }
  if (p.frecuencia === 'personalizada') return `Cada ${p.cadaDias} días`;
  if (p.frecuencia === 'mensual') return `Mensual (día ${p.diaMes ?? Number(p.proximaFecha.slice(8))})`;
  return NOMBRE_FRECUENCIA[p.frecuencia];
}

export function Compromisos({ d }: { d: Datos }) {
  const { intentar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [editar, setEditar] = useState<Programado | 'nuevo' | null>(null);
  const [pagar, setPagar] = useState<Programado | null>(null);
  const h = hoy();
  const lista = d.programados.filter((p) => p.tipo === tipo).sort((a, b) => Number(b.activo) - Number(a.activo) || a.proximaFecha.localeCompare(b.proximaFecha));
  const activos = lista.filter((p) => p.activo);
  const proximos = vencimientosEn(d.programados, { inicio: h, fin: sumarDias(h, 30) }, h, tipo);
  const nombreCuenta = (id?: string) => d.cuentas.find((c) => c.id === id)?.nombre ?? '';
  const nombreCat = (id?: string) => d.categorias.find((c) => c.id === id)?.nombre ?? '';

  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Compromisos</h1><p className="sec">Pagos que se repiten y tu calendario de cobros.</p></div>
        <button className="btn primario" onClick={() => setEditar('nuevo')}><Icono n="mas" />{tipo === 'gasto' ? 'Nuevo compromiso' : 'Nuevo cobro'}</button>
      </div>
      <Segmentado etiqueta="Tipo" valor={tipo} onCambio={setTipo} opciones={[{ v: 'gasto', t: 'Pagos recurrentes' }, { v: 'ingreso', t: 'Calendario de cobros' }]} />

      <section className="rejilla-kpi">
        <div className="kpi"><div className="kpi-etq">{tipo === 'gasto' ? 'Compromisos al mes' : 'Ingresos fijos al mes'}</div><div className="kpi-val num">{dinero(suma(activos.map(mensualEquivalente)))}</div><div className="kpi-sub">{activos.length} activo(s)</div></div>
        <div className="kpi"><div className="kpi-etq">Próximos 30 días</div><div className="kpi-val num">{dinero(suma(proximos.map((v) => v.programado.monto)))}</div><div className="kpi-sub">{proximos.length} vencimiento(s)</div></div>
        {tipo === 'gasto' && <div className={`kpi ${proximos.some((v) => v.vencido) ? 'peligro' : ''}`}><div className="kpi-etq">Vencidos</div><div className="kpi-val num">{proximos.filter((v) => v.vencido).length}</div><div className="kpi-sub">sin marcar como pagados</div></div>}
      </section>

      {lista.length === 0 ? (
        <Vacio icono="compromisos" titulo={tipo === 'gasto' ? 'Sin pagos recurrentes' : 'Sin cobros programados'}
          texto={tipo === 'gasto' ? 'Agrega internet, teléfono, luz, alquiler, suscripciones, préstamos…' : 'Agrega tu salario y otros ingresos fijos con sus fechas.'}
          accion={<button className="btn primario" onClick={() => setEditar('nuevo')}>Agregar</button>} />
      ) : (
        <section className="tarjeta sin-relleno">
          <ul className="lista compromisos">
            {lista.map((p) => {
              const vencido = p.activo && p.proximaFecha < h;
              const pronto = p.activo && !vencido && diasEntre(h, p.proximaFecha) <= Math.max(p.avisoDias, d.ajustes.alertas.diasPago);
              return (
                <li key={p.id} className={`compromiso ${p.activo ? '' : 'inactivo'}`}>
                  <div className="min0">
                    <div className="fuerte">{p.nombre} {!p.activo && <span className="etiqueta">pausado</span>}</div>
                    <div className="sec chico">{textoFrecuencia(p)} · {nombreCat(p.categoriaId) || p.fuente || ''} · {nombreCuenta(p.cuentaId)}</div>
                    {p.activo && <div className={`chico ${vencido ? 't-peligro' : pronto ? 't-alerta' : 'sec'}`}>{vencido ? 'Vencido' : 'Próximo'}: {fmtFecha(p.proximaFecha)} ({relativo(p.proximaFecha, h)})</div>}
                  </div>
                  <div className={`num fuerte ${p.tipo === 'ingreso' ? 't-ok' : ''}`}>{dinero(p.monto)}</div>
                  <div className="acciones-fila">
                    {p.activo && <button className="btn chico primario" onClick={() => setPagar(p)}>{p.tipo === 'ingreso' ? 'Recibir' : 'Pagar'}</button>}
                    {p.activo && <button className="btn chico" onClick={() => pedir({ titulo: 'Omitir este vencimiento', si: 'Omitir', peligro: false, texto: `No se registrará ${p.tipo === 'ingreso' ? 'cobro' : 'pago'} para el ${fmtFecha(p.proximaFecha)} y pasará al siguiente.`, onSi: () => intentar(() => omitirVencimiento(p.id), 'Vencimiento omitido') })}>Omitir</button>}
                    <button className="btn icono" aria-label={`Editar ${p.nombre}`} onClick={() => setEditar(p)}><Icono n="editar" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {proximos.length > 0 && (
        <section className="tarjeta">
          <h2 className="titulo-tarjeta">Próximos 30 días</h2>
          <ul className="lista">{proximos.map((v) => (
            <li key={`${v.programado.id}-${v.fecha}`} className="fila"><span><span className={v.vencido ? 't-peligro' : 'sec'}>{fmtFecha(v.fecha)}</span> · {v.programado.nombre}</span><span className="num">{dinero(v.programado.monto)}</span></li>
          ))}</ul>
        </section>
      )}

      {editar && <FormProgramado d={d} p={editar === 'nuevo' ? undefined : editar} tipo={tipo} onCerrar={() => setEditar(null)} onEliminar={(p) => pedir({ titulo: 'Eliminar', texto: `Se eliminará "${p.nombre}". Los pagos ya registrados se conservan en Movimientos.`, onSi: () => intentar(async () => { await eliminarProgramado(p.id); setEditar(null); }, 'Eliminado') })} />}
      {pagar && <PagarVencimiento d={d} p={pagar} onCerrar={() => setPagar(null)} />}
      {confirmacion}
    </div>
  );
}

function FormProgramado({ d, p, tipo, onCerrar, onEliminar }: { d: Datos; p?: Programado; tipo: 'gasto' | 'ingreso'; onCerrar: () => void; onEliminar: (p: Programado) => void }) {
  const { avisar } = useUi();
  const h = hoy();
  const t = p?.tipo ?? tipo;
  const [x, setX] = useState<Programado>(p ?? {
    id: nuevoId(), tipo: t, nombre: '', monto: 0, frecuencia: t === 'ingreso' ? 'quincenal' : 'mensual', proximaFecha: h,
    categoriaId: undefined, cuentaId: d.cuentas.find((c) => !c.archivada && c.tipo === 'banco')?.id ?? d.cuentas[0]?.id,
    clase: 'fijo', avisoDias: 3, activo: true, creadoEn: new Date().toISOString(), diasQuincena: t === 'ingreso' ? [15, 31] : undefined,
  });
  const [monto, setMonto] = useState<number | null>(p?.monto ?? null);
  const [error, setError] = useState('');
  const set = (c: Partial<Programado>) => { setX({ ...x, ...c }); setError(''); };
  const dq = x.diasQuincena ?? diasQuincenaDe(x, x.proximaFecha);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!monto) return setError('Escribe el monto esperado.');
    try {
      await guardarProgramado({ ...x, monto, diasQuincena: x.frecuencia === 'quincenal' ? dq : undefined, cadaDias: x.frecuencia === 'personalizada' ? x.cadaDias ?? 30 : undefined });
      avisar(p ? 'Cambios guardados' : 'Agregado');
      onCerrar();
    } catch (err) { setError(mensajeError(err)); }
  }

  const ingreso = x.tipo === 'ingreso';
  return (
    <Modal titulo={p ? `Editar ${ingreso ? 'cobro' : 'compromiso'}` : ingreso ? 'Nuevo cobro programado' : 'Nuevo compromiso'} onCerrar={onCerrar}>
      <form className="pila" onSubmit={guardar} noValidate>
        <div className="dos-col">
          <Campo etiqueta="Nombre"><input type="text" value={x.nombre} maxLength={60} data-autofocus placeholder={ingreso ? 'Ej.: Salario' : 'Ej.: Internet, alquiler'} onChange={(e) => set({ nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Monto esperado"><EntradaDinero etiqueta="Monto esperado" valor={monto} onCambio={setMonto} /></Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta="Frecuencia">
            <select value={x.frecuencia} onChange={(e) => set({ frecuencia: e.target.value as Frecuencia })}>
              {(['semanal', 'quincenal', 'mensual', 'anual', 'personalizada', 'unica'] as Frecuencia[]).map((f) => <option key={f} value={f}>{NOMBRE_FRECUENCIA[f]}</option>)}
            </select>
          </Campo>
          <Campo etiqueta={p ? 'Próximo vencimiento' : 'Primer vencimiento'}><input type="date" value={x.proximaFecha} onChange={(e) => set({ proximaFecha: e.target.value })} /></Campo>
        </div>
        {x.frecuencia === 'quincenal' && (
          <div className="dos-col">
            {[0, 1].map((i) => (
              <Campo key={i} etiqueta={i === 0 ? 'Primer día del mes' : 'Segundo día del mes'}>
                <select value={dq[i]} onChange={(e) => { const n: [number, number] = [...dq] as [number, number]; n[i] = Number(e.target.value); set({ diasQuincena: n }); }}>
                  {Array.from({ length: 31 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n === 31 ? 'Último día' : n}</option>)}
                </select>
              </Campo>
            ))}
          </div>
        )}
        {x.frecuencia === 'personalizada' && <Campo etiqueta="Cada cuántos días"><input type="number" min={1} max={366} value={x.cadaDias ?? 30} onChange={(e) => set({ cadaDias: Number(e.target.value) })} /></Campo>}
        <div className="dos-col">
          {!ingreso ? (
            <Campo etiqueta="Categoría">
              <select value={x.categoriaId ?? ''} onChange={(e) => set({ categoriaId: e.target.value })}>
                <option value="" disabled>Elige…</option>
                {d.categorias.filter((c) => c.tipo === 'gasto' && !c.archivada).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          ) : (
            <Campo etiqueta="Categoría">
              <select value={x.categoriaId ?? ''} onChange={(e) => set({ categoriaId: e.target.value || undefined })}>
                <option value="">Sin categoría</option>
                {d.categorias.filter((c) => c.tipo === 'ingreso' && !c.archivada).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          )}
          <Campo etiqueta={ingreso ? 'Cuenta donde lo recibes' : 'Cuenta de pago'}>
            <select value={x.cuentaId ?? ''} onChange={(e) => set({ cuentaId: e.target.value })}>
              {d.cuentas.filter((c) => !c.archivada).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <div className="dos-col">
          {ingreso
            ? <Campo etiqueta="Fuente"><input type="text" value={x.fuente ?? ''} maxLength={60} placeholder="Ej.: empresa" onChange={(e) => set({ fuente: e.target.value })} /></Campo>
            : <Campo etiqueta="Tipo de gasto"><select value={x.clase} onChange={(e) => set({ clase: e.target.value as Clase })}>{Object.entries(NOMBRE_CLASE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Campo>}
          <Campo etiqueta="Avisarme antes (días)"><input type="number" min={0} max={30} value={x.avisoDias} onChange={(e) => set({ avisoDias: Math.max(0, Math.min(30, Number(e.target.value))) })} /></Campo>
        </div>
        <Campo etiqueta="Notas (opcional)"><input type="text" value={x.notas ?? ''} maxLength={200} onChange={(e) => set({ notas: e.target.value })} /></Campo>
        {p && <label className="check"><input type="checkbox" checked={x.activo} onChange={(e) => set({ activo: e.target.checked })} /> Activo</label>}
        {error && <p className="error-form" role="alert">{error}</p>}
        <div className="acciones-form">
          {p ? <button type="button" className="btn peligro" onClick={() => onEliminar(p)}>Eliminar</button> : <span />}
          <div className="fila-wrap"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn primario">Guardar</button></div>
        </div>
      </form>
    </Modal>
  );
}
