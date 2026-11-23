import { useState } from 'react';
import { db } from '../db/db';
import {
  gastosUnicosPlanificados, ingresoQuincena, laborablesEnQuincena, metaAhorro, presupuestoCategoria, presupuestoMensualDe, totalPresupuestado,
} from '../lib/calculos';
import { formatoFecha, formatoQuincena, hoy, quincenaDe } from '../lib/fechas';
import { nuevoId, rd } from '../lib/formato';
import type { Categoria, GastoPlanificado } from '../lib/tipos';
import { CampoMonto, CeldaNumero, Dialogo } from '../ui/comunes';
import { useUi, type TodosLosDatos } from '../ui/contexto';

const MODOS: Record<Categoria['modo'], string> = { quincenal: 'Quincenal', mensual: 'Mensual', unico: 'Puntual' };

export function Presupuesto({ d }: { d: TodosLosDatos }) {
  const { avisar } = useUi();
  const q = quincenaDe(hoy(), d.ajustes.diaPago1);
  const cats = [...d.categorias].sort((a, b) => a.orden - b.orden);
  const gastoCats = cats.filter((c) => c.tipo === 'gasto');
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null);
  const [plan, setPlan] = useState<GastoPlanificado | 'nuevo' | null>(null);

  const total = totalPresupuestado(q, d);
  const unicos = gastosUnicosPlanificados(q, d);
  const meta = metaAhorro(q, d);

  const actualizar = (c: Categoria, cambios: Partial<Categoria>) => db.categorias.put({ ...c, ...cambios });
  async function mover(c: Categoria, dir: -1 | 1) {
    const i = gastoCats.indexOf(c);
    const otro = gastoCats[i + dir];
    if (!otro) return;
    await db.transaction('rw', db.categorias, async () => {
      await db.categorias.update(c.id, { orden: otro.orden });
      await db.categorias.update(otro.id, { orden: c.orden });
    });
  }

  return (
    <main>
      <div className="cabecera"><h1>Presupuesto</h1><a className="btn plano" href="#/">Volver al resumen</a></div>

      <section className="tarjeta" aria-live="polite">
        <p className="sec chico">Quincena actual: {formatoQuincena(q)}</p>
        <div className="cifras" style={{ marginTop: 8 }}>
          <div className="cifra"><div className="etq">Ingreso</div><div className="val">{rd(ingresoQuincena(q, d))}</div></div>
          <div className="cifra"><div className="etq">Total presupuestado</div><div className="val">{rd(total)}</div></div>
          {unicos > 0 && <div className="cifra"><div className="etq">Gastos únicos</div><div className="val">{rd(unicos)}</div></div>}
          <div className="cifra"><div className="etq">Meta de ahorro</div><div className={`val ${meta < 0 ? 't-excedido' : 't-ok'}`}>{rd(meta)}</div></div>
        </div>
      </section>

      <section className="tarjeta">
        <div className="fila" style={{ marginBottom: 6 }}>
          <h2>Categorías</h2>
          <button className="btn" onClick={() => setEditando('nueva')}>+ Categoría</button>
        </div>
        <p className="sec chico" style={{ marginBottom: 6 }}>Monto por quincena. Las mensuales se editan por mes y se provisiona la mitad en cada quincena.</p>
        <ul className="lista">
          {gastoCats.map((c, i) => {
            const transporte = c.clave === 'transporte';
            const calendario = transporte && d.ajustes.transporteModo === 'calendario';
            return (
              <li key={c.id} style={{ opacity: c.activa ? 1 : 0.55 }}>
                <div className="fila">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="fuerte">{c.nombre}{!c.activa && <span className="sec chico"> · oculta</span>}</div>
                    <div className="sec chico">{MODOS[c.modo]}{c.modo === 'mensual' && ` · ${rd(presupuestoMensualDe(c))} al mes`}{c.clave === 'dieta' && ' · se recalcula con Compras'}</div>
                  </div>
                  <div style={{ width: 118 }}>
                    {calendario
                      ? <div className="num derecha fuerte">{rd(presupuestoCategoria(c, q, d.ajustes, d.diasLibres))}</div>
                      : transporte
                        ? <CeldaNumero etiqueta="Transporte fijo por quincena" valor={d.ajustes.transporteFijoQuincena} onCambio={(n) => db.ajustes.update('ajustes', { transporteFijoQuincena: n })} />
                        : c.modo === 'mensual'
                          ? <CeldaNumero etiqueta={`${c.nombre} por mes`} valor={presupuestoMensualDe(c)} onCambio={(n) => actualizar(c, { presupuestoMensual: n, presupuestoQuincenal: n / 2 })} />
                          : <CeldaNumero etiqueta={`${c.nombre} por quincena`} valor={c.presupuestoQuincenal} onCambio={(n) => actualizar(c, { presupuestoQuincenal: n, presupuestoMensual: n * 2 })} />}
                  </div>
                </div>
                {transporte && (
                  <div className="fila-wrap" style={{ marginTop: 6 }}>
                    <div className="segmentado" role="group" aria-label="Cálculo de transporte">
                      <button aria-pressed={calendario} onClick={() => db.ajustes.update('ajustes', { transporteModo: 'calendario' })}>Calendario</button>
                      <button aria-pressed={!calendario} onClick={() => db.ajustes.update('ajustes', { transporteModo: 'fijo' })}>Fijo</button>
                    </div>
                    {calendario && <span className="sec chico">{laborablesEnQuincena(q, d.ajustes, d.diasLibres)} días × {rd(d.ajustes.pasajeDiario)}</span>}
                  </div>
                )}
                <div className="fila-wrap" style={{ marginTop: 4, gap: 0 }}>
                  <button className="btn plano icono" aria-label={`Subir ${c.nombre}`} disabled={i === 0} onClick={() => mover(c, -1)}>↑</button>
                  <button className="btn plano icono" aria-label={`Bajar ${c.nombre}`} disabled={i === gastoCats.length - 1} onClick={() => mover(c, 1)}>↓</button>
                  <button className="btn plano" onClick={() => setEditando(c)}>Editar</button>
                  <button className="btn plano" onClick={async () => { await actualizar(c, { activa: !c.activa }); avisar(c.activa ? `${c.nombre} oculta` : `${c.nombre} visible`); }}>{c.activa ? 'Ocultar' : 'Mostrar'}</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="tarjeta">
        <div className="fila" style={{ marginBottom: 6 }}>
          <h2>Gastos únicos planificados</h2>
          <button className="btn" onClick={() => setPlan('nuevo')}>+ Agregar</button>
        </div>
        <p className="sec chico" style={{ marginBottom: 6 }}>Bajan la meta de ahorro de la quincena en que caen. Cuando lo pagues, regístralo también como gasto.</p>
        {d.planificados.length === 0 ? <p className="sec">No hay gastos únicos planificados.</p> : (
          <ul className="lista">
            {[...d.planificados].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((p) => (
              <li key={p.id}>
                <button className="fila btn plano ancho" style={{ padding: 0, fontWeight: 400 }} onClick={() => setPlan(p)}>
                  <span style={{ textAlign: 'left' }}><span className="fuerte">{p.nombre}</span><br /><span className="sec chico">{formatoFecha(p.fecha)}</span></span>
                  <span className="num fuerte">{rd(p.monto)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editando && <FormCategoria c={editando === 'nueva' ? undefined : editando} orden={Math.max(0, ...cats.map((c) => c.orden)) + 1} onCerrar={() => setEditando(null)} />}
      {plan && <FormPlanificado p={plan === 'nuevo' ? undefined : plan} onCerrar={() => setPlan(null)} />}
    </main>
  );
}

function FormCategoria({ c, orden, onCerrar }: { c?: Categoria; orden: number; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(c?.nombre ?? '');
  const [modo, setModo] = useState<Categoria['modo']>(c?.modo ?? 'quincenal');
  const [monto, setMonto] = useState<number | ''>(c ? (c.modo === 'mensual' ? presupuestoMensualDe(c) : c.presupuestoQuincenal) : '');
  const fija = !!c?.clave && ['transporte', 'dieta'].includes(c.clave);
  return (
    <Dialogo titulo={c ? 'Editar categoría' : 'Nueva categoría'} onCerrar={onCerrar} acciones={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!nombre.trim()} onClick={async () => {
        const m = Number(monto || 0);
        const base: Categoria = c ?? { id: nuevoId(), nombre: '', tipo: 'gasto', modo, presupuestoQuincenal: 0, orden, activa: true };
        await db.categorias.put({
          ...base, nombre: nombre.trim(), modo: fija ? base.modo : modo,
          ...(fija ? {} : modo === 'mensual' ? { presupuestoMensual: m, presupuestoQuincenal: m / 2 } : { presupuestoQuincenal: m, presupuestoMensual: m * 2 }),
        });
        onCerrar();
      }}>Guardar</button>
    </>}>
      <div className="pila">
        <label className="campo"><span>Nombre</span><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} autoFocus /></label>
        {!fija && <>
          <label className="campo"><span>Modo de presupuesto</span>
            <select value={modo} onChange={(e) => setModo(e.target.value as Categoria['modo'])}>
              <option value="quincenal">Quincenal (monto por quincena)</option>
              <option value="mensual">Mensual (monto por mes)</option>
              <option value="unico">Puntual (sin presupuesto fijo)</option>
            </select>
          </label>
          <CampoMonto etiqueta={modo === 'mensual' ? 'Presupuesto por mes (RD$)' : 'Presupuesto por quincena (RD$)'} valor={monto} onCambio={setMonto} />
        </>}
      </div>
    </Dialogo>
  );
}

function FormPlanificado({ p, onCerrar }: { p?: GastoPlanificado; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(p?.nombre ?? '');
  const [monto, setMonto] = useState<number | ''>(p?.monto ?? '');
  const [fecha, setFecha] = useState(p?.fecha ?? hoy());
  return (
    <Dialogo titulo={p ? 'Editar gasto único' : 'Nuevo gasto único'} onCerrar={onCerrar} acciones={<>
      {p && <button className="btn peligro" onClick={async () => { await db.planificados.delete(p.id); onCerrar(); }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!nombre.trim() || !monto} onClick={async () => {
        await db.planificados.put({ id: p?.id ?? nuevoId(), nombre: nombre.trim(), monto: Number(monto), fecha, categoriaId: p?.categoriaId });
        onCerrar();
      }}>Guardar</button>
    </>}>
      <div className="pila">
        <label className="campo"><span>Nombre</span><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Ej.: inscripción del gimnasio" /></label>
        <CampoMonto etiqueta="Monto (RD$)" valor={monto} onCambio={setMonto} />
        <label className="campo"><span>Fecha prevista</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      </div>
    </Dialogo>
  );
}
