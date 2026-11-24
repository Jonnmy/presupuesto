import { useState } from 'react';
import { db } from '../db/db';
import { agregarGasto, recalcularServicios } from '../db/acciones';
import { hoy } from '../lib/fechas';
import { nuevoId, rd } from '../lib/formato';
import type { Categoria, Gasto, Metodo } from '../lib/tipos';
import { CampoMonto, Dialogo } from './comunes';
import { useUi, type TipoMovimiento } from './contexto';

export const METODOS: { v: Metodo; t: string }[] = [
  { v: 'efectivo', t: 'Efectivo / débito' }, { v: 'transferencia', t: 'Transferencia' }, { v: 'tarjeta', t: 'Tarjeta de crédito' },
];

/** Registro ultrarrápido: monto → categoría → Enter. Sirve para gastos e ingresos extra. */
export function FormGasto({ gasto, tipo: tipoInicial = 'gasto', categorias, corte, onCerrar }: {
  gasto?: Gasto; tipo?: TipoMovimiento; categorias: Categoria[]; corte: number; onCerrar: () => void;
}) {
  const { avisar } = useUi();
  const [tipo, setTipo] = useState<TipoMovimiento>(gasto ? 'gasto' : tipoInicial);
  const [monto, setMonto] = useState<number | ''>(gasto?.monto ?? '');
  const [categoriaId, setCategoriaId] = useState(gasto?.categoriaId ?? localStorage.getItem('ultimaCategoria') ?? '');
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoy());
  const [nota, setNota] = useState(gasto?.nota ?? '');
  const [metodo, setMetodo] = useState<Metodo>(gasto?.metodo ?? (localStorage.getItem('ultimoMetodo') as Metodo | null) ?? 'efectivo');
  const [fijo, setFijo] = useState(false);
  const [error, setError] = useState('');
  const esGasto = tipo === 'gasto';

  const visibles = categorias.filter((c) => c.tipo === 'gasto' && (c.activa || c.id === gasto?.categoriaId)).sort((a, b) => a.orden - b.orden);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!monto || monto <= 0) return setError('Escribe un monto mayor que 0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return setError('Elige una fecha.');
    const notaLimpia = nota.trim() || undefined;

    if (!esGasto) {
      const id = nuevoId();
      await db.ingresos.add({ id, fecha, monto, nota: notaLimpia ?? 'Ingreso extra' });
      avisar(`Ingreso de ${rd(monto)} guardado`, { etiqueta: 'Deshacer', fn: () => db.ingresos.delete(id) });
      return onCerrar();
    }

    if (!visibles.some((c) => c.id === categoriaId)) return setError('Elige una categoría.');
    const datos = { monto, categoriaId, fecha, nota: notaLimpia, metodo };
    localStorage.setItem('ultimaCategoria', categoriaId);
    localStorage.setItem('ultimoMetodo', metodo);
    if (gasto) {
      await db.gastos.put({ ...gasto, ...datos });
      avisar('Gasto actualizado');
      return onCerrar();
    }
    let recurrenteId: string | undefined;
    if (fijo) {
      const dia = Number(fecha.slice(8));
      recurrenteId = nuevoId();
      await db.recurrentes.add({
        id: recurrenteId, nombre: notaLimpia ?? categorias.find((c) => c.id === categoriaId)?.nombre ?? 'Gasto fijo',
        categoriaId, monto, frecuencia: 'quincenal', diaDelMes: dia <= corte ? dia : dia - corte, automatico: true, activo: true, desde: fecha,
      });
    }
    if (fijo) await recalcularServicios();
    const nuevo = await agregarGasto({ ...datos, origen: fijo ? 'recurrente' : 'manual', recurrenteId });
    avisar(fijo ? `Gasto fijo de ${rd(monto)} guardado; se repetirá cada quincena` : `Gasto de ${rd(monto)} guardado`, {
      etiqueta: 'Deshacer',
      fn: () => { db.gastos.delete(nuevo.id); if (recurrenteId) db.recurrentes.delete(recurrenteId); },
    });
    onCerrar();
  }

  async function borrar() {
    if (!gasto) return;
    await db.gastos.delete(gasto.id);
    avisar('Gasto borrado', { etiqueta: 'Deshacer', fn: () => db.gastos.put(gasto) });
    onCerrar();
  }

  const titulo = gasto ? 'Editar gasto' : esGasto ? 'Nuevo gasto' : 'Nuevo ingreso';
  return (
    <Dialogo titulo={titulo} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="pila" noValidate>
        {!gasto && (
          <div className="segmentado tipo" role="group" aria-label="Tipo de movimiento" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className="gasto" aria-pressed={esGasto} onClick={() => setTipo('gasto')}>Gasto</button>
            <button type="button" className="ingreso" aria-pressed={!esGasto} onClick={() => setTipo('ingreso')}>Ingreso</button>
          </div>
        )}
        <CampoMonto etiqueta="Monto (RD$)" valor={monto} onCambio={(n) => { setMonto(n); setError(''); }} grande autoFocus />
        {esGasto && (
          <>
            <fieldset style={{ border: 0, padding: 0, margin: '10px 0 0' }}>
              <legend className="campo-etq">Categoría</legend>
              <div className="chips" role="radiogroup" aria-label="Categoría">
                {visibles.map((c) => (
                  <button type="button" key={c.id} className="chip" role="radio" aria-checked={categoriaId === c.id}
                    onClick={() => { setCategoriaId(c.id); setError(''); }}>{c.nombre}</button>
                ))}
              </div>
            </fieldset>
            <fieldset style={{ border: 0, padding: 0, margin: '10px 0 0' }}>
              <legend className="campo-etq">Método de pago</legend>
              <div className="chips" role="radiogroup" aria-label="Método de pago">
                {METODOS.map((m) => (
                  <button type="button" key={m.v} className="chip" role="radio" aria-checked={metodo === m.v} onClick={() => setMetodo(m.v)}>{m.t}</button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <div className="dos-col">
          <label className="campo"><span>Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="campo"><span>Nota (opcional)</span>
            <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} placeholder={esGasto ? 'Ej.: barbería' : 'Ej.: horas extra'} />
          </label>
        </div>
        {esGasto && !gasto && (
          <label className="check">
            <input type="checkbox" checked={fijo} onChange={(e) => setFijo(e.target.checked)} />
            <span>Fijo recurrente <span className="sec chico">(se repite cada quincena el mismo día)</span></span>
          </label>
        )}
        {error && <p className="t-excedido" role="alert">{error}</p>}
        <div className="acciones" style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
          {gasto ? <button type="button" className="btn peligro" onClick={borrar}>Borrar</button> : <span className="sec chico kbd-pista" style={{ alignSelf: 'center' }}>Enter para guardar</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn primario">Guardar</button>
          </div>
        </div>
      </form>
    </Dialogo>
  );
}
