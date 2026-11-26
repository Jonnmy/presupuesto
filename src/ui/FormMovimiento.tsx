// Registro rápido: nombre → monto → categoría → Guardar. Fecha de hoy y la última cuenta usada vienen por defecto.
import { useMemo, useState } from 'react';
import { ErrorUsuario, eliminarMovimiento, guardarConRecurrencia, guardarMovimiento, restaurarMovimiento } from '../db/acciones';
import { dinero, nuevoId } from '../nucleo/dinero';
import { hoy } from '../nucleo/fechas';
import { saldoDeuda } from '../nucleo/finanzas';
import type { Clase, Cuenta, Datos, Frecuencia, Metodo, Movimiento, TipoMovimiento } from '../nucleo/tipos';
import { posibleDuplicado } from '../nucleo/validar';
import { Campo, EntradaDinero, mensajeError, Modal, Segmentado, useConfirmar, useUi, type AbrirMovimiento } from './base';

export const NOMBRE_TIPO: Record<TipoMovimiento, string> = {
  gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', aporte: 'Aporte a meta', retiro: 'Retiro de meta', pagoDeuda: 'Abono a deuda',
};
export const NOMBRE_METODO: Record<Metodo, string> = { efectivo: 'Efectivo', debito: 'Tarjeta de débito', credito: 'Tarjeta de crédito', transferencia: 'Transferencia', otro: 'Otro' };
export const NOMBRE_CLASE: Record<Clase, string> = { fijo: 'Fijo', variable: 'Variable', extraordinario: 'Extraordinario' };

const metodoPorCuenta = (c?: Cuenta): Metodo => (c?.tipo === 'tarjeta' ? 'credito' : c?.tipo === 'efectivo' ? 'efectivo' : c?.tipo === 'billetera' ? 'otro' : 'debito');

export function FormMovimiento({ d, o, onCerrar }: { d: Datos; o: AbrirMovimiento; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const editando = o.movimiento;
  const activas = d.cuentas.filter((c) => !c.archivada || c.id === editando?.cuentaId || c.id === editando?.cuentaDestinoId);
  const ultimaCuenta = (t: string) => {
    const id = localStorage.getItem(`ultimaCuenta-${t}`);
    return activas.find((c) => c.id === id)?.id ?? (t === 'ingreso' ? activas.find((c) => c.tipo === 'banco')?.id : activas.find((c) => c.tipo === 'efectivo')?.id) ?? activas[0]?.id;
  };
  const tipoInicial = editando?.tipo ?? o.tipo ?? 'gasto';
  const [x, setX] = useState<Movimiento>(() => editando ?? {
    id: nuevoId(), tipo: tipoInicial, nombre: tipoInicial === 'transferencia' ? 'Transferencia' : '', monto: 0, fecha: hoy(),
    cuentaId: ultimaCuenta(tipoInicial), estado: 'pagado', clase: tipoInicial === 'ingreso' ? 'fijo' : 'variable',
    metodo: metodoPorCuenta(activas.find((c) => c.id === ultimaCuenta(tipoInicial))), creadoEn: '', ...o.valores,
  });
  const [monto, setMonto] = useState<number | null>(editando ? editando.monto : o.valores?.monto ?? null);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('unica');
  const [cadaDias, setCadaDias] = useState(30);
  const [mas, setMas] = useState(!!editando || ['transferencia', 'aporte', 'retiro', 'pagoDeuda'].includes(tipoInicial));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const set = (c: Partial<Movimiento>) => { setX({ ...x, ...c }); setError(''); };

  const tipoCat = x.tipo === 'ingreso' ? 'ingreso' : 'gasto';
  const categorias = d.categorias.filter((c) => c.tipo === tipoCat && (!c.archivada || c.id === x.categoriaId));
  const usadas = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const m of d.movimientos.slice(-300)) if (m.categoriaId) cuenta.set(m.categoriaId, (cuenta.get(m.categoriaId) ?? 0) + 1);
    return cuenta;
  }, [d.movimientos]);
  const chips = [...categorias].sort((a, b) => (usadas.get(b.id) ?? 0) - (usadas.get(a.id) ?? 0) || a.orden - b.orden);
  const cat = d.categorias.find((c) => c.id === x.categoriaId);
  const conCategoria = x.tipo === 'gasto' || x.tipo === 'ingreso';
  const deuda = d.deudas.find((y) => y.id === x.deudaId);

  function cambiarTipo(t: TipoMovimiento) {
    const cuentaId = ultimaCuenta(t);
    setX({ ...x, tipo: t, categoriaId: undefined, cuentaId, metodo: metodoPorCuenta(activas.find((c) => c.id === cuentaId)), clase: t === 'ingreso' ? 'fijo' : 'variable', nombre: t === 'transferencia' ? 'Transferencia' : x.nombre === 'Transferencia' ? '' : x.nombre, estado: 'pagado' });
    if (t === 'transferencia') setMas(true);
    setError('');
  }

  async function guardar(e?: React.FormEvent, forzar = false) {
    e?.preventDefault();
    if (guardando) return;
    if (monto === null || monto <= 0) return setError('Escribe un monto mayor que cero.');
    let nombre = x.nombre.trim();
    if (!nombre && x.tipo === 'pagoDeuda') nombre = `Abono ${deuda?.nombre ?? ''}`.trim();
    if (!nombre && x.tipo === 'aporte') nombre = `Aporte a ${d.metas.find((y) => y.id === x.metaId)?.nombre ?? 'meta'}`;
    if (!nombre && x.tipo === 'retiro') nombre = `Retiro de ${d.metas.find((y) => y.id === x.metaId)?.nombre ?? 'meta'}`;
    if (!nombre && cat) nombre = cat.nombre;
    const final: Movimiento = { ...x, nombre, monto };
    if (!forzar && !editando) {
      const dup = posibleDuplicado(final, d.movimientos);
      if (dup) return pedir({ titulo: '¿Registrar de nuevo?', si: 'Sí, registrar', peligro: false, texto: `Ya hay un ${NOMBRE_TIPO[dup.tipo].toLowerCase()} "${dup.nombre}" de ${dinero(dup.monto)} con la misma fecha y cuenta. ¿Es otro distinto?`, onSi: () => guardar(undefined, true) });
    }
    setGuardando(true);
    try {
      const recurrente = !editando && frecuencia !== 'unica' && (x.tipo === 'gasto' || x.tipo === 'ingreso');
      const guardado = recurrente
        ? await guardarConRecurrencia(final, { frecuencia, cadaDias: frecuencia === 'personalizada' ? cadaDias : undefined })
        : await guardarMovimiento(final);
      if (final.cuentaId) localStorage.setItem(`ultimaCuenta-${final.tipo}`, final.cuentaId);
      const texto = editando ? 'Cambios guardados' : `${NOMBRE_TIPO[final.tipo]} de ${dinero(final.monto)} guardado${recurrente ? '. Quedó programado el próximo.' : ''}`;
      avisar(texto, editando || recurrente ? {} : { deshacer: () => eliminarMovimiento(guardado.id) });
      onCerrar();
    } catch (err) {
      setError(err instanceof ErrorUsuario ? err.message : mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  function borrar() {
    if (!editando) return;
    pedir({
      titulo: 'Eliminar movimiento', texto: `Se eliminará "${editando.nombre}" de ${dinero(editando.monto)}. Los saldos se recalculan.`,
      onSi: async () => {
        const borrado = await eliminarMovimiento(editando.id);
        avisar('Movimiento eliminado', { deshacer: () => { if (borrado) restaurarMovimiento(borrado); } });
        onCerrar();
      },
    });
  }

  const titulo = editando ? `Editar ${NOMBRE_TIPO[x.tipo].toLowerCase()}` : x.tipo === 'gasto' ? 'Agregar gasto' : x.tipo === 'ingreso' ? 'Agregar ingreso' : NOMBRE_TIPO[x.tipo];
  const cuentaSel = (etiqueta: string, campo: 'cuentaId' | 'cuentaDestinoId') => (
    <Campo etiqueta={etiqueta}>
      <select value={x[campo] ?? ''} onChange={(e) => set(campo === 'cuentaId' ? { cuentaId: e.target.value, metodo: metodoPorCuenta(activas.find((c) => c.id === e.target.value)) } : { cuentaDestinoId: e.target.value })}>
        <option value="" disabled>Elige…</option>
        {activas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.tipo === 'tarjeta' ? ' (crédito)' : ''}</option>)}
      </select>
    </Campo>
  );

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="pila" noValidate>
        {!editando && ['gasto', 'ingreso', 'transferencia'].includes(x.tipo) && (
          <Segmentado etiqueta="Tipo de movimiento" valor={x.tipo as 'gasto'} onCambio={cambiarTipo}
            opciones={[{ v: 'gasto', t: 'Gasto' }, { v: 'ingreso', t: 'Ingreso' }, { v: 'transferencia', t: 'Transferencia' }] as { v: 'gasto'; t: string }[]} />
        )}

        {x.tipo === 'pagoDeuda' && (
          <Campo etiqueta="Deuda" ayuda={deuda ? `Falta por pagar: ${dinero(saldoDeuda(deuda, d.movimientos.filter((y) => y.id !== x.id)))}` : undefined}>
            <select value={x.deudaId ?? ''} onChange={(e) => set({ deudaId: e.target.value })}>
              <option value="" disabled>Elige…</option>
              {d.deudas.filter((y) => !y.archivada || y.id === x.deudaId).map((y) => <option key={y.id} value={y.id}>{y.nombre}</option>)}
            </select>
          </Campo>
        )}
        {(x.tipo === 'aporte' || x.tipo === 'retiro') && (
          <Campo etiqueta="Meta de ahorro">
            <select value={x.metaId ?? ''} onChange={(e) => set({ metaId: e.target.value })}>
              <option value="" disabled>Elige…</option>
              {d.metas.filter((y) => !y.archivada || y.id === x.metaId).map((y) => <option key={y.id} value={y.id}>{y.nombre}</option>)}
            </select>
          </Campo>
        )}

        <Campo etiqueta="Monto">
          <EntradaDinero etiqueta="Monto" valor={monto} onCambio={(c) => { setMonto(c); setError(''); }} grande autoFocus />
        </Campo>

        {x.tipo !== 'transferencia' && (
          <Campo etiqueta={x.tipo === 'ingreso' ? 'Descripción' : 'Nombre o descripción'}>
            <input type="text" value={x.nombre} maxLength={80} autoComplete="off"
              placeholder={x.tipo === 'ingreso' ? 'Ej.: Salario, comisión, trabajo extra' : x.tipo === 'gasto' ? 'Ej.: Colmado, pasaje, luz' : 'Opcional'}
              list="sugerencias-nombre" onChange={(e) => set({ nombre: e.target.value })} />
            <datalist id="sugerencias-nombre">
              {[...new Set(d.movimientos.filter((m) => m.tipo === x.tipo).slice(-200).map((m) => m.nombre))].slice(0, 30).map((n) => <option key={n} value={n} />)}
            </datalist>
          </Campo>
        )}
        {x.tipo === 'pagoDeuda' && deuda && deuda.cuota > 0 && monto === null && (
          <button type="button" className="btn chico" style={{ alignSelf: 'flex-start' }} onClick={() => setMonto(deuda.cuota)}>Usar la cuota: {dinero(deuda.cuota)}</button>
        )}

        {conCategoria && (
          <fieldset className="grupo">
            <legend className="campo-etq">Categoría</legend>
            <div className="chips" role="radiogroup" aria-label="Categoría">
              {chips.map((c) => (
                <button type="button" key={c.id} className="chip" role="radio" aria-checked={x.categoriaId === c.id} onClick={() => set({ categoriaId: c.id, subcategoria: undefined })}>
                  <i className="pt" style={{ background: c.color }} />{c.nombre}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {x.tipo === 'transferencia' && (
          <div className="dos-col">{cuentaSel('Desde', 'cuentaId')}{cuentaSel('Hacia', 'cuentaDestinoId')}</div>
        )}
        {x.tipo === 'transferencia' && <p className="sec chico">Para pagar una tarjeta de crédito, transfiere desde tu cuenta hacia la tarjeta. No cuenta como gasto (la compra ya se contó).</p>}

        {!mas && (
          <button type="button" className="btn plano chico" style={{ alignSelf: 'flex-start' }} onClick={() => setMas(true)}>
            Más opciones · {activas.find((c) => c.id === x.cuentaId)?.nombre ?? 'cuenta'} · hoy
          </button>
        )}

        {mas && (
          <div className="pila">
            <div className="dos-col">
              <Campo etiqueta={x.tipo === 'ingreso' ? 'Fecha de recepción' : 'Fecha'}><input type="date" value={x.fecha} onChange={(e) => set({ fecha: e.target.value })} required /></Campo>
              {x.tipo !== 'transferencia' && cuentaSel(x.tipo === 'ingreso' || x.tipo === 'retiro' ? 'Cuenta donde entra' : 'Cuenta', 'cuentaId')}
            </div>
            {x.tipo === 'gasto' && (
              <div className="dos-col">
                <Campo etiqueta="Método de pago">
                  <select value={x.metodo ?? 'efectivo'} onChange={(e) => set({ metodo: e.target.value as Metodo })}>
                    {Object.entries(NOMBRE_METODO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Subcategoría (opcional)">
                  <input type="text" value={x.subcategoria ?? ''} maxLength={40} list="subcats" onChange={(e) => set({ subcategoria: e.target.value })} />
                  <datalist id="subcats">{cat?.subcategorias.map((s) => <option key={s} value={s} />)}</datalist>
                </Campo>
              </div>
            )}
            {x.tipo === 'ingreso' && (
              <Campo etiqueta="Fuente"><input type="text" value={x.fuente ?? ''} maxLength={60} placeholder="Ej.: empresa, cliente" onChange={(e) => set({ fuente: e.target.value })} /></Campo>
            )}
            {conCategoria && (
              <div className="dos-col">
                <Campo etiqueta={x.tipo === 'ingreso' ? 'Tipo de ingreso' : 'Tipo de gasto'}>
                  <select value={x.clase ?? 'variable'} onChange={(e) => set({ clase: e.target.value as Clase })}>
                    {Object.entries(NOMBRE_CLASE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </Campo>
                {x.tipo === 'gasto' ? (
                  <Campo etiqueta="Estado">
                    <select value={x.estado} onChange={(e) => set({ estado: e.target.value as Movimiento['estado'] })}>
                      <option value="pagado">Pagado</option>
                      <option value="pendiente">Pendiente de pago</option>
                    </select>
                  </Campo>
                ) : <div />}
              </div>
            )}
            {conCategoria && !editando && (
              <div className="dos-col">
                <Campo etiqueta="Frecuencia" ayuda={frecuencia !== 'unica' ? 'Se programará el próximo automáticamente en Compromisos.' : undefined}>
                  <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}>
                    <option value="unica">Única</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option><option value="anual">Anual</option><option value="personalizada">Personalizada</option>
                  </select>
                </Campo>
                {frecuencia === 'personalizada' ? (
                  <Campo etiqueta="Cada cuántos días"><input type="number" min={1} max={366} value={cadaDias} onChange={(e) => setCadaDias(Number(e.target.value))} /></Campo>
                ) : <div />}
              </div>
            )}
            {editando?.programadoId && <p className="sec chico">Viene de un compromiso programado (vencimiento del {editando.ocurrencia}).</p>}
            <Campo etiqueta="Notas (opcional)"><textarea rows={2} maxLength={300} value={x.notas ?? ''} onChange={(e) => set({ notas: e.target.value })} /></Campo>
          </div>
        )}

        {error && <p className="error-form" role="alert">{error}</p>}
        <div className="acciones-form">
          {editando ? <button type="button" className="btn peligro" onClick={borrar}>Eliminar</button> : <span className="sec chico solo-escritorio">Enter para guardar</span>}
          <div className="fila-wrap">
            <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </form>
      {confirmacion}
    </Modal>
  );
}
