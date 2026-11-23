import { useState } from 'react';
import { db } from '../db/db';
import { ahorrado, ahorroAcumulado, estimadoMeta, metaAhorro } from '../lib/calculos';
import { formatoFecha, formatoMesCorto, hoy, mesAnterior, mesDe, quincenaDe, rangoMes } from '../lib/fechas';
import { nuevoId, pct, rd } from '../lib/formato';
import type { DepositoAhorro, Mes, MetaAhorro } from '../lib/tipos';
import { Barra, CampoMonto, Cifra, Dialogo, Vacio } from '../ui/comunes';
import { useUi, type TodosLosDatos } from '../ui/contexto';
import { ColumnasAcumulado } from '../ui/Graficos';
import { AvisoCierre } from './Resumen';

export function Ahorro({ d }: { d: TodosLosDatos }) {
  const { avisar } = useUi();
  const h = hoy();
  const q = quincenaDe(h, d.ajustes.diaPago1);
  const [dep, setDep] = useState<DepositoAhorro | 'nuevo' | null>(null);
  const [meta, setMeta] = useState<MetaAhorro | 'nueva' | null>(null);

  const meses: Mes[] = [mesDe(h)];
  for (let i = 0; i < 5; i++) meses.unshift(mesAnterior(meses[0]));
  const serie = meses.map((m) => ({ etiqueta: formatoMesCorto(m), valor: ahorrado(rangoMes(m), d), acumulado: ahorroAcumulado(d.depositos, rangoMes(m).fin) }));
  const depositos = [...d.depositos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const nombreMeta = new Map(d.metas.map((m) => [m.id, m.nombre]));

  return (
    <main>
      <div className="cabecera"><h1>Ahorro</h1><button className="btn primario" onClick={() => setDep('nuevo')}>+ Depósito</button></div>
      <AvisoCierre d={d} />

      <section className="cifras" style={{ marginBottom: 12 }}>
        <Cifra etiqueta="Ahorro acumulado" valor={ahorroAcumulado(d.depositos)} />
        <Cifra etiqueta="Depositado esta quincena" valor={ahorrado(q, d)} sub={<>meta {rd(metaAhorro(q, d))}</>} />
      </section>

      <section className="tarjeta">
        <div className="fila" style={{ marginBottom: 6 }}>
          <h2>Metas</h2>
          <button className="btn" onClick={() => setMeta('nueva')}>+ Meta</button>
        </div>
        {d.metas.length === 0 ? <p className="sec">Crea una meta para ver tu avance.</p> : (
          <ul className="lista">
            {d.metas.map((m) => {
              const deps = d.depositos.filter((x) => x.metaId === m.id);
              const llevas = ahorroAcumulado(deps);
              const est = estimadoMeta(m.objetivo, deps, h);
              return (
                <li key={m.id}>
                  <button className="btn plano ancho" style={{ display: 'block', padding: 0, fontWeight: 400, textAlign: 'left' }} onClick={() => setMeta(m)} aria-label={`Editar meta ${m.nombre}`}>
                    <div className="fila" style={{ marginBottom: 6 }}>
                      <span className="fuerte">{m.nombre}</span>
                      <span className="num chico">{rd(llevas)}{m.objetivo > 0 && <span className="sec"> / {rd(m.objetivo)}</span>}</span>
                    </div>
                    {m.objetivo > 0
                      ? <>
                        <Barra valor={llevas} maximo={m.objetivo} estado="ok" etiqueta={`Avance de ${m.nombre}`} />
                        <p className="sec chico" style={{ marginTop: 4 }}>
                          {pct(Math.min(1, llevas / m.objetivo))}
                          {llevas >= m.objetivo ? ' · ¡Meta alcanzada!' : est ? ` · al ritmo actual, cerca del ${formatoFecha(est)}` : ' · registra depósitos para estimar la fecha'}
                          {m.fechaObjetivo && ` · objetivo: ${formatoFecha(m.fechaObjetivo)}`}
                        </p>
                      </>
                      : <p className="sec chico">Define el monto objetivo de esta meta.</p>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="tarjeta">
        <h2>Ahorro por mes</h2>
        <ColumnasAcumulado titulo="Ahorro por mes" puntos={serie} />
      </section>

      <section className="tarjeta">
        <h2>Depósitos</h2>
        {depositos.length === 0 ? (
          <Vacio titulo="Todavía no hay depósitos"><p>Toca <strong>+ Depósito</strong> cuando apartes dinero. Al cerrar cada quincena la app te sugiere depositar el sobrante.</p></Vacio>
        ) : (
          <ul className="lista">
            {depositos.map((x) => (
              <li key={x.id}>
                <button className="fila btn plano ancho" style={{ padding: 0, fontWeight: 400 }} onClick={() => setDep(x)}>
                  <span style={{ textAlign: 'left' }}>
                    <span className="fuerte">{x.nota || 'Depósito'}</span><br />
                    <span className="sec chico">{formatoFecha(x.fecha)}{x.metaId && nombreMeta.has(x.metaId) ? ` · ${nombreMeta.get(x.metaId)}` : ''}</span>
                  </span>
                  <span className="num fuerte">{rd(x.monto)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dep && <FormDeposito x={dep === 'nuevo' ? undefined : dep} metas={d.metas} onCerrar={() => setDep(null)} avisar={avisar} />}
      {meta && <FormMeta m={meta === 'nueva' ? undefined : meta} onCerrar={() => setMeta(null)} />}
    </main>
  );
}

function FormDeposito({ x, metas, onCerrar, avisar }: { x?: DepositoAhorro; metas: MetaAhorro[]; onCerrar: () => void; avisar: ReturnType<typeof useUi>['avisar'] }) {
  const [monto, setMonto] = useState<number | ''>(x?.monto ?? '');
  const [fecha, setFecha] = useState(x?.fecha ?? hoy());
  const [nota, setNota] = useState(x?.nota ?? '');
  const [metaId, setMetaId] = useState(x?.metaId ?? metas[0]?.id ?? '');
  return (
    <Dialogo titulo={x ? 'Editar depósito' : 'Nuevo depósito'} onCerrar={onCerrar} acciones={<>
      {x && <button className="btn peligro" onClick={async () => {
        await db.depositos.delete(x.id); onCerrar();
        avisar('Depósito borrado', { etiqueta: 'Deshacer', fn: () => db.depositos.put(x) });
      }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!monto} onClick={async () => {
        await db.depositos.put({ id: x?.id ?? nuevoId(), monto: Number(monto), fecha, nota: nota.trim() || undefined, metaId: metaId || undefined });
        avisar(`Depósito de ${rd(Number(monto))} guardado`); onCerrar();
      }}>Guardar</button>
    </>}>
      <div className="pila">
        <CampoMonto etiqueta="Monto (RD$)" valor={monto} onCambio={setMonto} grande autoFocus />
        <label className="campo"><span>Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <label className="campo"><span>Meta</span>
          <select value={metaId} onChange={(e) => setMetaId(e.target.value)}>
            <option value="">Sin meta</option>
            {metas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        <label className="campo"><span>Nota (opcional)</span><input type="text" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={80} /></label>
      </div>
    </Dialogo>
  );
}

function FormMeta({ m, onCerrar }: { m?: MetaAhorro; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(m?.nombre ?? '');
  const [objetivo, setObjetivo] = useState<number | ''>(m?.objetivo || '');
  const [fecha, setFecha] = useState(m?.fechaObjetivo ?? '');
  return (
    <Dialogo titulo={m ? 'Editar meta' : 'Nueva meta'} onCerrar={onCerrar} acciones={<>
      {m && <button className="btn peligro" onClick={async () => { await db.metas.delete(m.id); onCerrar(); }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!nombre.trim()} onClick={async () => {
        await db.metas.put({ id: m?.id ?? nuevoId(), nombre: nombre.trim(), objetivo: Number(objetivo || 0), fechaObjetivo: fecha || undefined });
        onCerrar();
      }}>Guardar</button>
    </>}>
      <div className="pila">
        <label className="campo"><span>Nombre</span><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={50} /></label>
        <CampoMonto etiqueta="Monto objetivo (RD$)" valor={objetivo} onCambio={setObjetivo} />
        <label className="campo"><span>Fecha objetivo (opcional)</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      </div>
    </Dialogo>
  );
}
