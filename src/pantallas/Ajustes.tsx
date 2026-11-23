import { useRef, useState } from 'react';
import { db } from '../db/db';
import { agregarGasto, aplicarRecurrentes } from '../db/acciones';
import { borrarTodo, descargar, exportarDatos, gastosACsv, importarDatos, validarRespaldo } from '../db/respaldo';
import { yaRegistrado } from '../lib/calculos';
import { formatoFecha, hoy } from '../lib/fechas';
import { rd } from '../lib/formato';
import type { Ajustes as TAjustes, Recurrente } from '../lib/tipos';
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
        <h2>Gastos recurrentes</h2>
        <p className="sec chico" style={{ marginBottom: 6 }}>En automático se registran solos al abrir la app, desde el día en que lo activas. Nunca se duplican en la misma fecha.</p>
        <ul className="lista">
          {d.recurrentes.map((r) => <FilaRecurrente key={r.id} r={r} categoria={nombreCat.get(r.categoriaId) ?? ''} onAuto={cambiarAuto} onAhora={registrarAhora} />)}
        </ul>
      </section>

      <section className="tarjeta pila">
        <h2>Apariencia</h2>
        <div className="segmentado" role="group" aria-label="Tema">
          {(['sistema', 'claro', 'oscuro'] as const).map((t) => (
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
  if (r.frecuencia === 'mensual') return `Mensual, día ${r.diaDelMes ?? 1}`;
  return `Cada ${r.cadaNMeses ?? 1} ${(r.cadaNMeses ?? 1) === 1 ? 'mes' : 'meses'}, día ${r.diaDelMes ?? 1}`;
}

function FilaRecurrente({ r, categoria, onAuto, onAhora }: { r: Recurrente; categoria: string; onAuto: (r: Recurrente, v: boolean) => void; onAhora: (r: Recurrente) => void }) {
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
          <EditorRecurrente r={r} onCerrar={() => setEditar(false)} />
        </Dialogo>
      )}
    </li>
  );
}

function EditorRecurrente({ r, onCerrar }: { r: Recurrente; onCerrar: () => void }) {
  const [x, setX] = useState(r);
  return (
    <div className="pila">
      <label className="campo"><span>Monto (RD$)</span><CeldaNumero etiqueta="Monto" valor={x.monto} onCambio={(n) => setX({ ...x, monto: n })} /></label>
      {x.frecuencia !== 'diaria-laboral' && (
        <div className="dos-col">
          <label className="campo"><span>Día del mes</span>
            <select value={x.diaDelMes ?? 1} onChange={(e) => setX({ ...x, diaDelMes: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {x.frecuencia === 'cada-n-meses' && (
            <label className="campo"><span>Cada cuántos meses</span>
              <select value={x.cadaNMeses ?? 1} onChange={(e) => setX({ ...x, cadaNMeses: Number(e.target.value) })}>
                {[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      <div className="acciones">
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn primario" onClick={async () => { await db.recurrentes.put(x); if (x.id === 'rec-pasaje') await db.ajustes.update('ajustes', { pasajeDiario: x.monto }); onCerrar(); }}>Guardar</button>
      </div>
    </div>
  );
}
