import { useRef, useState } from 'react';
import { db } from '../db/db';
import { agregarGasto, aplicarRecurrentes, recalcularServicios } from '../db/acciones';
import { borrarTodo, descargar, exportarDatos, gastosACsv, importarDatos, validarRespaldo } from '../db/respaldo';
import { yaRegistrado } from '../lib/calculos';
import { formatoFecha, hoy } from '../lib/fechas';
import { nuevoId, rd } from '../lib/formato';
import type { Ajustes as TAjustes, Bloque, Categoria, Recurrente } from '../lib/tipos';
import { NOMBRE_BLOQUE } from './Resumen';
import { CeldaNumero, Confirmar, Dialogo } from '../ui/comunes';
import { useUi, type TodosLosDatos } from '../ui/contexto';

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function Ajustes({ d }: { d: TodosLosDatos }) {
  const { avisar } = useUi();
  const a = d.ajustes;
  const set = (c: Partial<TAjustes>) => db.ajustes.update('ajustes', c);
  const [libre, setLibre] = useState({ fecha: '', motivo: '' });
  const [borrar, setBorrar] = useState<0 | 1 | 2>(0);
  const [importar, setImportar] = useState<unknown>(null);
  const [nuevaSus, setNuevaSus] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const nombreCat = new Map(d.categorias.map((c) => [c.id, c.nombre]));
  const libres = [...d.diasLibres].sort((x, y) => x.fecha.localeCompare(y.fecha));
  const proximos = libres.filter((l) => l.fecha >= hoy());
  const pasados = libres.length - proximos.length;

  async function exportarJson() {
    const r = await exportarDatos();
    descargar(`respaldo-quincena-${hoy()}.json`, JSON.stringify(r, null, 1), 'application/json');
    await set({ ultimoRespaldo: new Date().toISOString() });
    avisar('Respaldo descargado. Guárdalo en Drive o envíatelo.');
  }

  async function leerArchivo(f: File) {
    try {
      const datos = JSON.parse((await f.text()).replace(/^﻿/, ''));
      if (!validarRespaldo(datos)) throw new Error();
      setImportar(datos);
    } catch {
      avisar('Ese archivo no es un respaldo válido de esta app.');
    }
  }

  async function cambiarAuto(r: Recurrente, automatico: boolean) {
    await db.recurrentes.put({ ...r, automatico, desde: automatico ? hoy() : r.desde });
    if (automatico) {
      const n = await aplicarRecurrentes();
      avisar(n ? `${r.nombre}: automático. Se crearon ${n} gasto(s).` : `${r.nombre}: se registrará solo desde hoy.`);
    }
  }

  async function registrarAhora(r: Recurrente) {
    const f = hoy();
    if (yaRegistrado(d.gastos, r.id, f)) return avisar(`${r.nombre} ya está registrado hoy.`);
    const g = await agregarGasto({ fecha: f, monto: r.monto, categoriaId: r.categoriaId, nota: r.nombre, origen: 'recurrente', recurrenteId: r.id });
    avisar(`${r.nombre}: ${rd(r.monto)} registrado`, { etiqueta: 'Deshacer', fn: () => db.gastos.delete(g.id) });
  }

  return (
    <main>
      <div className="cabecera"><h1>Ajustes</h1><a className="btn" href="#/presupuesto">Presupuesto</a></div>

      <section className="tarjeta pila">
        <h2>Ingreso</h2>
        <div className="dos-col">
          <label className="campo"><span>Sueldo neto por quincena</span><CeldaNumero etiqueta="Sueldo neto por quincena" valor={a.ingresoQuincenal} onCambio={(n) => set({ ingresoQuincenal: n })} /></label>
          <label className="campo"><span>Mensual de referencia (bruto)</span><CeldaNumero etiqueta="Ingreso mensual de referencia" valor={a.ingresoMensualReferencia ?? 0} onCambio={(n) => set({ ingresoMensualReferencia: n })} /></label>
        </div>
        <p className="sec chico">El ingreso del mes se calcula como dos quincenas: {rd(a.ingresoQuincenal * 2)}. La referencia es solo informativa.</p>
        <div className="dos-col">
          <label className="campo"><span>Primer pago (fin de la 1ª quincena)</span>
            <select value={a.diaPago1} onChange={(e) => set({ diaPago1: Number(e.target.value) })}>
              {Array.from({ length: 27 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Día {n}</option>)}
            </select>
          </label>
          <label className="campo"><span>Segundo pago</span><select value="fin" disabled><option value="fin">Último día del mes</option></select></label>
        </div>
      </section>

      <section className="tarjeta pila">
        <h2>Reparto del ingreso</h2>
        <p className="sec chico">Porcentaje del ingreso para cada bloque. La regla clásica es 50 / 30 / 20.</p>
        <div className="tres-col">
          {(['necesidades', 'estilo', 'ahorro'] as Bloque[]).map((k) => (
            <label key={k} className="campo"><span>{NOMBRE_BLOQUE[k]} (%)</span>
              <CeldaNumero etiqueta={`${NOMBRE_BLOQUE[k]} en porcentaje`} valor={a.bloques[k]} onCambio={(n) => set({ bloques: { ...a.bloques, [k]: Math.min(100, n) } })} />
            </label>
          ))}
        </div>
        {(() => { const suma = a.bloques.necesidades + a.bloques.estilo + a.bloques.ahorro; return (
          <p className={suma === 100 ? 'sec chico' : 't-alerta chico'}>Suma: {suma}%{suma !== 100 ? ' — debería ser 100%.' : ''} Cada categoría pertenece a un bloque (se cambia en Presupuesto).</p>
        ); })()}
      </section>

      <section className="tarjeta pila">
        <h2>Trabajo y transporte</h2>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="campo-etq">Días laborables</legend>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6, 0].map((n) => (
              <button key={n} className="chip" aria-pressed={a.diasLaborables.includes(n)}
                onClick={() => set({ diasLaborables: a.diasLaborables.includes(n) ? a.diasLaborables.filter((x) => x !== n) : [...a.diasLaborables, n].sort() })}>{DIAS_CORTOS[n]}</button>
            ))}
          </div>
        </fieldset>
        <div className="dos-col">
          <label className="campo"><span>Pasaje diario (ida y vuelta)</span><CeldaNumero etiqueta="Pasaje diario" valor={a.pasajeDiario} onCambio={(n) => { set({ pasajeDiario: n }); db.recurrentes.update('rec-pasaje', { monto: n }); }} /></label>
          <div />
        </div>
        <div>
          <span className="campo-etq">Días libres (feriados, ausencias): no generan pasaje</span>
          <div className="dos-col">
            <label className="campo"><span className="sr">Fecha del día libre</span><input type="date" value={libre.fecha} onChange={(e) => setLibre({ ...libre, fecha: e.target.value })} /></label>
            <label className="campo"><span className="sr">Motivo</span><input type="text" placeholder="Motivo (opcional)" value={libre.motivo} onChange={(e) => setLibre({ ...libre, motivo: e.target.value })} maxLength={40} /></label>
          </div>
          <button className="btn" style={{ marginTop: 8 }} disabled={!libre.fecha} onClick={async () => {
            await db.diasLibres.put({ fecha: libre.fecha, motivo: libre.motivo.trim() || undefined });
            avisar(`${formatoFecha(libre.fecha)} marcado como libre`); setLibre({ fecha: '', motivo: '' });
          }}>Agregar día libre</button>
          {proximos.length > 0 && (
            <ul className="lista" style={{ marginTop: 8 }}>
              {proximos.map((l) => (
                <li key={l.fecha} className="fila">
                  <span>{formatoFecha(l.fecha)}{l.motivo && <span className="sec"> · {l.motivo}</span>}</span>
                  <button className="btn plano" onClick={() => db.diasLibres.delete(l.fecha)} aria-label={`Quitar día libre ${formatoFecha(l.fecha)}`}>Quitar</button>
                </li>
              ))}
            </ul>
          )}
          {pasados > 0 && <p className="sec chico" style={{ marginTop: 6 }}>{pasados} día(s) libre(s) anteriores guardados.</p>}
        </div>
      </section>

      <section className="tarjeta">
        <div className="tarjeta-cab"><h2>Fijos y suscripciones</h2><button className="btn chico" onClick={() => setNuevaSus(true)}>+ Suscripción o servicio</button></div>
        <p className="sec chico" style={{ marginBottom: 6 }}>En automático se registran solos al abrir la app, desde el día en que lo activas. Nunca se duplican en la misma fecha.</p>
        <ul className="lista">
          {d.recurrentes.map((r) => <FilaRecurrente key={r.id} r={r} categoria={nombreCat.get(r.categoriaId) ?? ''} categorias={d.categorias} onAuto={cambiarAuto} onAhora={registrarAhora} />)}
        </ul>
        {nuevaSus && (
          <Dialogo titulo="Nueva suscripción o servicio" onCerrar={() => setNuevaSus(false)}>
            <EditorRecurrente nuevo categorias={d.categorias} onCerrar={() => setNuevaSus(false)} r={{
              id: nuevoId(), nombre: '', categoriaId: 'cat-servicios', monto: 0, frecuencia: 'mensual', diaDelMes: Number(hoy().slice(8)), automatico: true, activo: true, desde: hoy(),
            }} />
          </Dialogo>
        )}
      </section>

      <section className="tarjeta pila">
        <h2>Apariencia</h2>
        <div className="segmentado" role="group" aria-label="Tema">
          {(['oscuro', 'claro', 'sistema'] as const).map((t) => (
            <button key={t} aria-pressed={a.tema === t} onClick={() => set({ tema: t })} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
      </section>

      <section className="tarjeta pila">
        <h2>Respaldo de datos</h2>
        <p className="sec">Tus datos se guardan solo en este dispositivo. Haz un respaldo cada 15 días y guárdalo en Drive o en tu correo.
          {a.ultimoRespaldo ? ` Último respaldo: ${formatoFecha(a.ultimoRespaldo.slice(0, 10))}.` : ' Aún no has hecho ninguno.'}</p>
        <div className="fila-wrap">
          <button className="btn primario" onClick={exportarJson}>Exportar respaldo (JSON)</button>
          <button className="btn" onClick={() => descargar(`gastos-${hoy()}.csv`, gastosACsv(d.gastos, d.categorias), 'text/csv;charset=utf-8', true)}>Exportar gastos (CSV)</button>
          <button className="btn" onClick={() => archivo.current?.click()}>Importar respaldo</button>
          <input ref={archivo} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); e.target.value = ''; }} />
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--borde)', margin: '14px 0' }} />
        <button className="btn peligro" onClick={() => setBorrar(1)}>Borrar todo</button>
      </section>

      <p className="sec chico derecha">Quincena · v1.0 · funciona sin internet</p>

      {borrar === 1 && <Confirmar titulo="¿Borrar todo?" si="Sí, continuar" peligro onNo={() => setBorrar(0)} onSi={() => setBorrar(2)}
        texto="Se borrarán todos tus gastos, ingresos, depósitos y cambios. Te recomendamos exportar un respaldo antes." />}
      {borrar === 2 && <Confirmar titulo="Confirmación final" si="Borrar todo definitivamente" peligro onNo={() => setBorrar(0)}
        onSi={async () => { await borrarTodo(); setBorrar(0); avisar('Datos borrados. Se cargaron los valores iniciales.'); }}
        texto="Esta acción no se puede deshacer. ¿Seguro que quieres borrar todos los datos de este dispositivo?" />}
      {importar !== null && <Confirmar titulo="¿Importar respaldo?" si="Importar y reemplazar" peligro onNo={() => setImportar(null)}
        onSi={async () => { await importarDatos(importar as never); setImportar(null); avisar('Respaldo importado'); }}
        texto="Los datos actuales de este dispositivo se reemplazarán por los del archivo." />}
    </main>
  );
}

function textoFrecuencia(r: Recurrente) {
  if (r.frecuencia === 'diaria-laboral') return 'Cada día laborable';
  if (r.frecuencia === 'quincenal') return `Cada quincena, día ${r.diaDelMes ?? 1} de cada una`;
  if (r.frecuencia === 'mensual') return `Mensual, día ${r.diaDelMes ?? 1}`;
  return `Cada ${r.cadaNMeses ?? 1} ${(r.cadaNMeses ?? 1) === 1 ? 'mes' : 'meses'}, día ${r.diaDelMes ?? 1}`;
}

function FilaRecurrente({ r, categoria, categorias, onAuto, onAhora }: { r: Recurrente; categoria: string; categorias: Categoria[]; onAuto: (r: Recurrente, v: boolean) => void; onAhora: (r: Recurrente) => void }) {
  const [editar, setEditar] = useState(false);
  return (
    <li>
      <div className="fila">
        <div>
          <div className="fuerte">{r.nombre} <span className="num">{rd(r.monto)}</span></div>
          <div className="sec chico">{categoria} · {textoFrecuencia(r)}</div>
        </div>
        <button className="btn plano" onClick={() => setEditar(true)}>Editar</button>
      </div>
      <div className="fila-wrap">
        <label className="check"><input type="checkbox" checked={r.automatico} onChange={(e) => onAuto(r, e.target.checked)} /> Automático</label>
        <button className="btn" onClick={() => onAhora(r)}>Registrar hoy</button>
      </div>
      {editar && (
        <Dialogo titulo={`Editar ${r.nombre}`} onCerrar={() => setEditar(false)}>
          <EditorRecurrente r={r} categorias={categorias} onCerrar={() => setEditar(false)} />
        </Dialogo>
      )}
    </li>
  );
}

const FIJOS_SEMILLA = ['rec-pasaje', 'rec-gimnasio'];

function EditorRecurrente({ r, categorias, nuevo, onCerrar }: { r: Recurrente; categorias: Categoria[]; nuevo?: boolean; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [x, setX] = useState(r);
  const [error, setError] = useState('');
  const diario = x.frecuencia === 'diaria-laboral';
  async function guardar() {
    if (!x.nombre.trim()) return setError('Escribe un nombre.');
    if (!(x.monto > 0)) return setError('Escribe un monto mayor que 0.');
    await db.recurrentes.put({ ...x, nombre: x.nombre.trim() });
    if (x.id === 'rec-pasaje') await db.ajustes.update('ajustes', { pasajeDiario: x.monto });
    await recalcularServicios();
    if (nuevo && x.automatico) await aplicarRecurrentes();
    avisar(nuevo ? `${x.nombre.trim()} agregado` : 'Cambios guardados');
    onCerrar();
  }
  async function borrar() {
    await db.recurrentes.delete(r.id);
    await recalcularServicios();
    avisar(`${r.nombre} eliminado. Los gastos ya registrados se conservan.`);
    onCerrar();
  }
  return (
    <div className="pila">
      {!FIJOS_SEMILLA.includes(x.id) && (
        <label className="campo"><span>Nombre</span><input type="text" value={x.nombre} maxLength={40} placeholder="Ej.: Internet, Netflix, celular" autoFocus={nuevo} onChange={(e) => setX({ ...x, nombre: e.target.value })} /></label>
      )}
      <label className="campo"><span>Monto (RD$)</span><CeldaNumero etiqueta="Monto" valor={x.monto} onCambio={(n) => setX({ ...x, monto: n })} /></label>
      {!diario && (
        <>
          <div className="dos-col">
            <label className="campo"><span>Frecuencia</span>
              <select value={x.frecuencia} onChange={(e) => setX({ ...x, frecuencia: e.target.value as Recurrente['frecuencia'] })}>
                <option value="mensual">Mensual</option>
                <option value="quincenal">Cada quincena</option>
                <option value="cada-n-meses">Cada varios meses</option>
              </select>
            </label>
            <label className="campo"><span>{x.frecuencia === 'quincenal' ? 'Día dentro de la quincena' : 'Día del mes'}</span>
              <select value={x.diaDelMes ?? 1} onChange={(e) => setX({ ...x, diaDelMes: Number(e.target.value) })}>
                {Array.from({ length: x.frecuencia === 'quincenal' ? 15 : 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="dos-col">
            <label className="campo"><span>Categoría</span>
              <select value={x.categoriaId} onChange={(e) => setX({ ...x, categoriaId: e.target.value })}>
                {categorias.filter((c) => c.tipo === 'gasto' && (c.activa || c.id === x.categoriaId)).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            {x.frecuencia === 'cada-n-meses' ? (
              <label className="campo"><span>Cada cuántos meses</span>
                <select value={x.cadaNMeses ?? 2} onChange={(e) => setX({ ...x, cadaNMeses: Number(e.target.value) })}>
                  {[2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            ) : <div />}
          </div>
          {nuevo && <label className="check"><input type="checkbox" checked={x.automatico} onChange={(e) => setX({ ...x, automatico: e.target.checked })} /> Registrar automáticamente</label>}
        </>
      )}
      {error && <p className="t-excedido" role="alert">{error}</p>}
      <div className="acciones" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {!nuevo && !FIJOS_SEMILLA.includes(x.id) ? <button className="btn peligro" onClick={borrar}>Eliminar</button> : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn primario" onClick={guardar}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
