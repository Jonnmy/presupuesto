import { useState } from 'react';
import { db } from '../db/db';
import { agregarGasto } from '../db/acciones';
import { hoy } from '../lib/fechas';
import { rd } from '../lib/formato';
import type { Categoria, Gasto, Metodo } from '../lib/tipos';
import { CampoMonto, Dialogo } from './comunes';
import { useUi } from './contexto';

const METODOS: { v: Metodo; t: string }[] = [
  { v: 'efectivo', t: 'Efectivo' }, { v: 'tarjeta', t: 'Tarjeta' }, { v: 'transferencia', t: 'Transferencia' },
];

export function FormGasto({ gasto, categorias, onCerrar }: { gasto?: Gasto; categorias: Categoria[]; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [monto, setMonto] = useState<number | ''>(gasto?.monto ?? '');
  const [categoriaId, setCategoriaId] = useState(gasto?.categoriaId ?? localStorage.getItem('ultimaCategoria') ?? '');
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoy());
  const [nota, setNota] = useState(gasto?.nota ?? '');
  const [metodo, setMetodo] = useState<Metodo>(gasto?.metodo ?? (localStorage.getItem('ultimoMetodo') as Metodo) ?? 'efectivo');
  const [error, setError] = useState('');

  const visibles = categorias.filter((c) => c.tipo === 'gasto' && (c.activa || c.id === gasto?.categoriaId)).sort((a, b) => a.orden - b.orden);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!monto || monto <= 0) return setError('Escribe un monto mayor que 0.');
    if (!visibles.some((c) => c.id === categoriaId)) return setError('Elige una categoría.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return setError('Elige una fecha.');
    const datos = { monto, categoriaId, fecha, nota: nota.trim() || undefined, metodo };
    localStorage.setItem('ultimaCategoria', categoriaId);
    localStorage.setItem('ultimoMetodo', metodo);
    if (gasto) {
      await db.gastos.put({ ...gasto, ...datos });
      avisar('Gasto actualizado');
    } else {
      const nuevo = await agregarGasto({ ...datos, origen: 'manual' });
      avisar(`Gasto de ${rd(monto)} guardado`, { etiqueta: 'Deshacer', fn: () => db.gastos.delete(nuevo.id) });
    }
    onCerrar();
  }

  async function borrar() {
    if (!gasto) return;
    await db.gastos.delete(gasto.id);
    avisar('Gasto borrado', { etiqueta: 'Deshacer', fn: () => db.gastos.put(gasto) });
    onCerrar();
  }

  return (
    <Dialogo titulo={gasto ? 'Editar gasto' : 'Nuevo gasto'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="pila" noValidate>
        <CampoMonto etiqueta="Monto (RD$)" valor={monto} onCambio={(n) => { setMonto(n); setError(''); }} grande autoFocus />
        <fieldset style={{ border: 0, padding: 0, margin: '10px 0 0' }}>
          <legend className="campo-etq">Categoría</legend>
          <div className="chips" role="radiogroup" aria-label="Categoría">
            {visibles.map((c) => (
              <button type="button" key={c.id} className="chip" role="radio" aria-checked={categoriaId === c.id}
                onClick={() => { setCategoriaId(c.id); setError(''); }}>{c.nombre}</button>
            ))}
          </div>
        </fieldset>
        <div className="dos-col">
          <label className="campo"><span>Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="campo"><span>Método</span>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)}>
              {METODOS.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
            </select>
          </label>
        </div>
        <label className="campo"><span>Nota (opcional)</span>
          <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} placeholder="Ej.: barbería" />
        </label>
        {error && <p className="t-excedido" role="alert">{error}</p>}
        <div className="acciones" style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
          {gasto ? <button type="button" className="btn peligro" onClick={borrar}>Borrar</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn primario">Guardar</button>
          </div>
        </div>
      </form>
    </Dialogo>
  );
}
