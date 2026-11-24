import { useMemo, useState } from 'react';
import { db } from '../db/db';
import { registrarPasaje } from '../db/acciones';
import { esLaborable, enRango, ingresosExtra } from '../lib/calculos';
import { formatoDia, formatoFecha, hoy, rangoMes } from '../lib/fechas';
import { nuevoId, rd } from '../lib/formato';
import type { Ingreso } from '../lib/tipos';
import { CampoMonto, Confirmar, Dialogo, Vacio } from '../ui/comunes';
import { useUi, type TodosLosDatos } from '../ui/contexto';
import { SelectorPeriodo, periodoActual, type Periodo } from '../ui/Selector';

const METODO: Record<string, string> = { efectivo: 'Efectivo/débito', tarjeta: 'Tarjeta de crédito', transferencia: 'Transferencia' };

export function Gastos({ d }: { d: TodosLosDatos }) {
  const { avisar, abrirGasto } = useUi();
  const corte = d.ajustes.diaPago1;
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoActual(corte));
  const [filtro, setFiltro] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');
  const [metodo, setMetodo] = useState<string>('');
  const [confirmarPasaje, setConfirmarPasaje] = useState(false);
  const [ingreso, setIngreso] = useState<Ingreso | 'nuevo' | null>(null);

  const r = periodo.tipo === 'quincena' ? periodo.q : rangoMes(periodo.m);
  const nombre = useMemo(() => new Map(d.categorias.map((c) => [c.id, c.nombre])), [d.categorias]);
  const h = hoy();
  const pasajeHoy = d.gastos.some((g) => g.recurrenteId === 'rec-pasaje' && g.fecha === h);

  const lista = d.gastos
    .filter((g) => enRango(g.fecha, r))
    .filter((g) => !filtro || g.categoriaId === filtro)
    .filter((g) => !metodo || (g.metodo ?? 'efectivo') === metodo)
    .filter((g) => !busqueda.trim() || (g.nota ?? '').toLowerCase().includes(busqueda.trim().toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn));
  const porDia = new Map<string, typeof lista>();
  for (const g of lista) porDia.set(g.fecha, [...(porDia.get(g.fecha) ?? []), g]);
  const total = lista.reduce((s, g) => s + g.monto, 0);
  const extras = d.ingresos.filter((i) => enRango(i.fecha, r)).sort((a, b) => b.fecha.localeCompare(a.fecha));

  async function pasaje() {
    setConfirmarPasaje(false);
    const res = await registrarPasaje(h);
    if (res === 'duplicado') avisar('El pasaje de hoy ya estaba registrado.');
    else avisar(`Pasaje de ${rd(d.ajustes.pasajeDiario)} registrado`, {
      etiqueta: 'Deshacer',
      fn: async () => { const g = await db.gastos.where('fecha').equals(h).filter((x) => x.recurrenteId === 'rec-pasaje').first(); if (g) await db.gastos.delete(g.id); },
    });
  }

  const usadas = new Set(d.gastos.filter((g) => enRango(g.fecha, r)).map((g) => g.categoriaId));

  return (
    <main>
      <SelectorPeriodo periodo={periodo} onCambio={setPeriodo} corte={corte} />
      <h1 className="sr">Gastos</h1>

      <section className="tarjeta">
        <div className="fila">
          <div>
            <div className="fuerte">Pasaje de hoy</div>
            <div className="sec chico">{pasajeHoy ? `Registrado · ${formatoFecha(h)}` : `${rd(d.ajustes.pasajeDiario)} a Transporte`}</div>
          </div>
          <button className="btn primario" disabled={pasajeHoy}
            onClick={() => (esLaborable(h, d.ajustes.diasLaborables, d.diasLibres) ? pasaje() : setConfirmarPasaje(true))}>
            {pasajeHoy ? 'Ya registrado' : 'Hoy trabajé'}
          </button>
        </div>
      </section>

      <section className="tarjeta">
        <div className="fila" style={{ marginBottom: 8 }}>
          <h2>Ingresos extra</h2>
          <button className="btn" onClick={() => setIngreso('nuevo')}>+ Ingreso</button>
        </div>
        {extras.length === 0
          ? <p className="sec">El sueldo ({rd(d.ajustes.ingresoQuincenal)} por quincena) se cuenta solo. Registra aquí bonos, regalos u horas extra.</p>
          : (
            <ul className="lista">
              {extras.map((i) => (
                <li key={i.id}>
                  <button className="item-gasto btn plano ancho" style={{ justifyContent: 'flex-start', padding: 0, fontWeight: 400 }} onClick={() => setIngreso(i)}>
                    <span className="info" style={{ textAlign: 'left' }}><span className="fuerte">{i.nota || 'Ingreso extra'}</span><br /><span className="sec chico">{formatoFecha(i.fecha)}</span></span>
                    <span className="num fuerte t-ok">+{rd(i.monto)}</span>
                  </button>
                </li>
              ))}
              <li className="fila sec chico"><span>Total extra</span><span className="num">{rd(ingresosExtra(r, d))}</span></li>
            </ul>
          )}
      </section>

      <section className="tarjeta">
        <div className="fila" style={{ marginBottom: 8 }}>
          <h2>Gastos</h2>
          <span className="num fuerte">{rd(total)}</span>
        </div>
        <label className="campo" style={{ marginBottom: 8 }}>
          <span className="sr">Buscar por nota</span>
          <input type="search" placeholder="Buscar por nota" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Filtrar por categoría" style={{ marginBottom: 4 }}>
          <button className="chip" aria-pressed={filtro === ''} onClick={() => setFiltro('')}>Todas</button>
          {d.categorias.filter((c) => c.tipo === 'gasto' && (c.activa || usadas.has(c.id))).map((c) => (
            <button key={c.id} className="chip" aria-pressed={filtro === c.id} onClick={() => setFiltro(filtro === c.id ? '' : c.id)}>{c.nombre}</button>
          ))}
        </div>

        <div className="chips" role="group" aria-label="Filtrar por método de pago" style={{ marginBottom: 4 }}>
          <button className="chip" aria-pressed={metodo === ''} onClick={() => setMetodo('')}>Todos los métodos</button>
          {Object.entries(METODO).map(([v, t]) => (
            <button key={v} className="chip" aria-pressed={metodo === v} onClick={() => setMetodo(metodo === v ? '' : v)}>{t}</button>
          ))}
        </div>

        {lista.length === 0 ? (
          <Vacio titulo={filtro || metodo || busqueda ? 'Nada coincide con el filtro' : 'Sin gastos en este periodo'}>
            {!filtro && !metodo && !busqueda && <p>Toca <strong>+ Gasto</strong> para registrar el primero. Aparecerán aquí agrupados por día.</p>}
          </Vacio>
        ) : (
          [...porDia.entries()].map(([fecha, gs]) => (
            <div key={fecha}>
              <div className="dia-cab"><span>{formatoDia(fecha)}</span><span className="num">{rd(gs.reduce((s, g) => s + g.monto, 0))}</span></div>
              <ul className="lista">
                {gs.map((g) => (
                  <li key={g.id}>
                    <button className="item-gasto btn plano ancho" style={{ justifyContent: 'flex-start', padding: 0, fontWeight: 400, minHeight: 44 }}
                      onClick={() => abrirGasto(g)} aria-label={`Editar gasto de ${rd(g.monto)} en ${nombre.get(g.categoriaId)}`}>
                      <span className="info" style={{ textAlign: 'left' }}>
                        <span className="fuerte">{nombre.get(g.categoriaId) ?? 'Sin categoría'}</span>
                        <span className="sec chico nota" style={{ display: 'block' }}>
                          {[g.nota, g.metodo && METODO[g.metodo], g.origen === 'recurrente' ? 'recurrente' : g.origen === 'compra-sirena' ? 'compra Sirena' : ''].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="num fuerte">{rd(g.monto)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {confirmarPasaje && (
        <Confirmar titulo="¿Trabajaste hoy?" si="Sí, registrar pasaje" onSi={pasaje} onNo={() => setConfirmarPasaje(false)}
          texto={`Hoy (${formatoDia(h)}) no es día laborable o está marcado como libre. ¿Registrar el pasaje de ${rd(d.ajustes.pasajeDiario)} de todos modos?`} />
      )}
      {ingreso && <FormIngreso ingreso={ingreso === 'nuevo' ? undefined : ingreso} onCerrar={() => setIngreso(null)} />}
    </main>
  );
}

function FormIngreso({ ingreso, onCerrar }: { ingreso?: Ingreso; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [monto, setMonto] = useState<number | ''>(ingreso?.monto ?? '');
  const [fecha, setFecha] = useState(ingreso?.fecha ?? hoy());
  const [nota, setNota] = useState(ingreso?.nota ?? '');
  const ok = !!monto && monto > 0 && /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  return (
    <Dialogo titulo={ingreso ? 'Editar ingreso extra' : 'Ingreso extra'} onCerrar={onCerrar} acciones={<>
      {ingreso && <button className="btn peligro" onClick={async () => {
        await db.ingresos.delete(ingreso.id); onCerrar();
        avisar('Ingreso borrado', { etiqueta: 'Deshacer', fn: () => db.ingresos.put(ingreso) });
      }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!ok} onClick={async () => {
        await db.ingresos.put({ id: ingreso?.id ?? nuevoId(), monto: monto as number, fecha, nota: nota.trim() || undefined });
        avisar('Ingreso guardado'); onCerrar();
      }}>Guardar</button>
    </>}>
      <div className="pila">
        <CampoMonto etiqueta="Monto (RD$)" valor={monto} onCambio={setMonto} grande autoFocus />
        <label className="campo"><span>Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <label className="campo"><span>Concepto</span><input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Bono, regalo, horas extra…" maxLength={80} /></label>
      </div>
    </Dialogo>
  );
}
