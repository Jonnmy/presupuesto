import { useRef, useState } from 'react';
import { db } from '../db/db';
import { eliminarCategoria, guardarCategoria } from '../db/acciones';
import { borrarTodo, exportarDatos, importarDatos, movimientosACsv, validarRespaldo, type Respaldo } from '../db/respaldo';
import { dinero, nuevoId } from '../nucleo/dinero';
import { diasEntre, fechaDeIso, fmtFecha, fmtRango, hoy } from '../nucleo/fechas';
import { quincenaDe } from '../nucleo/periodos';
import type { Ajustes as TAjustes, Categoria, Datos } from '../nucleo/tipos';
import { esApp, guardarArchivo } from '../ui/archivos';
import { Campo, EntradaDinero, Icono, mensajeError, Modal, Segmentado, useConfirmar, useUi } from '../ui/base';

const MONEDAS = [
  { moneda: 'DOP', simbolo: 'RD$', nombre: 'Peso dominicano (RD$)' },
  { moneda: 'USD', simbolo: 'US$', nombre: 'Dólar estadounidense (US$)' },
  { moneda: 'EUR', simbolo: '€', nombre: 'Euro (€)' },
  { moneda: 'MXN', simbolo: 'MX$', nombre: 'Peso mexicano (MX$)' },
  { moneda: 'COP', simbolo: 'COL$', nombre: 'Peso colombiano (COL$)' },
];
const ZONAS = ['America/Santo_Domingo', 'America/New_York', 'America/Puerto_Rico', 'America/Mexico_City', 'America/Bogota', 'Europe/Madrid', 'UTC'];
const COLORES = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa', '#ec4899', '#22d3ee', '#f97316', '#84cc16', '#ef4444', '#14b8a6', '#eab308', '#6366f1', '#94a3b8'];

export function Ajustes({ d }: { d: Datos }) {
  const { avisar, intentar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const a = d.ajustes;
  const set = (c: Partial<TAjustes>) => db.ajustes.update('ajustes', c);
  const archivo = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState<Categoria | 'nueva-gasto' | 'nueva-ingreso' | null>(null);
  const [borrar, setBorrar] = useState(0);
  const q = quincenaDe(hoy(), a.quincena);
  const diasSinRespaldo = a.ultimoRespaldo ? diasEntre(fechaDeIso(a.ultimoRespaldo), hoy()) : null;

  async function exportarJson() {
    const r = await exportarDatos();
    const res = await guardarArchivo(`respaldo-finanzas-${hoy()}.json`, JSON.stringify(r), 'application/json');
    await set({ ultimoRespaldo: new Date().toISOString() });
    avisar(res === 'descargado' ? 'Respaldo descargado. Guárdalo en Drive o en tu correo.' : 'Elige dónde guardar el respaldo (Drive, correo, WhatsApp…).');
  }

  async function leer(f: File) {
    try {
      const datos = JSON.parse((await f.text()).replace(/^﻿/, ''));
      const error = validarRespaldo(datos);
      if (error) return avisar(error, { tipo: 'error' });
      const r = datos as Respaldo;
      pedir({
        titulo: 'Importar respaldo', si: 'Reemplazar mis datos',
        texto: `El respaldo es del ${fmtFecha(fechaDeIso(r.exportadoEn))} y tiene ${r.datos.movimientos.length} movimientos. Tus datos actuales se reemplazarán por completo.`,
        onSi: () => intentar(() => importarDatos(r), 'Respaldo importado correctamente'),
      });
    } catch { avisar('No se pudo leer el archivo. ¿Es un respaldo JSON de esta app?', { tipo: 'error' }); }
  }

  return (
    <div className="pila-grande">
      <div className="cabecera"><div><h1>Configuración</h1><p className="sec">Región, períodos, alertas, categorías y respaldos.</p></div></div>

      <section className="tarjeta pila">
        <h2 className="titulo-tarjeta">Región</h2>
        <div className="dos-col">
          <Campo etiqueta="Moneda">
            <select value={MONEDAS.some((x) => x.moneda === a.moneda) ? a.moneda : 'otra'} onChange={(e) => { const x = MONEDAS.find((y) => y.moneda === e.target.value); if (x) set({ moneda: x.moneda, simbolo: x.simbolo }); else set({ moneda: 'OTRA' }); }}>
              {MONEDAS.map((x) => <option key={x.moneda} value={x.moneda}>{x.nombre}</option>)}<option value="otra">Otra…</option>
            </select>
          </Campo>
          <Campo etiqueta="Símbolo"><input type="text" value={a.simbolo} maxLength={5} onChange={(e) => set({ simbolo: e.target.value })} /></Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta="Decimales"><select value={a.decimales} onChange={(e) => set({ decimales: Number(e.target.value) as 0 | 2 })}><option value={2}>Con centavos (1,000.00)</option><option value={0}>Sin centavos (1,000)</option></select></Campo>
          <Campo etiqueta="Formato de fecha"><select value={a.formatoFecha} onChange={(e) => set({ formatoFecha: e.target.value as TAjustes['formatoFecha'] })}><option value="DD/MM/AAAA">DD/MM/AAAA</option><option value="MM/DD/AAAA">MM/DD/AAAA</option><option value="AAAA-MM-DD">AAAA-MM-DD</option></select></Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta="Zona horaria"><select value={a.zona} onChange={(e) => set({ zona: e.target.value })}>{ZONAS.map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}</select></Campo>
          <Campo etiqueta="Idioma"><select value="es" disabled><option value="es">Español</option></select></Campo>
        </div>
        <p className="sec chico">Ejemplo: {dinero(123456)} · {fmtFecha(hoy())}</p>
      </section>

      <section className="tarjeta pila">
        <h2 className="titulo-tarjeta">Apariencia</h2>
        <Segmentado etiqueta="Tema" valor={a.tema} onCambio={(t) => set({ tema: t })} opciones={[{ v: 'oscuro', t: 'Oscuro' }, { v: 'claro', t: 'Claro' }, { v: 'sistema', t: 'Según el sistema' }]} />
      </section>

      <section className="tarjeta pila">
        <h2 className="titulo-tarjeta">Semanas y quincenas</h2>
        <Campo etiqueta="La semana empieza el"><select value={a.inicioSemana} onChange={(e) => set({ inicioSemana: Number(e.target.value) as 0 | 1 })}><option value={1}>Lunes</option><option value={0}>Domingo</option></select></Campo>
        <Segmentado etiqueta="Quincenas" valor={a.quincena.dia1 === 1 && a.quincena.dia2 === 16 ? 'calendario' : 'cobro'}
          onCambio={(v) => set({ quincena: v === 'calendario' ? { dia1: 1, dia2: 16 } : { dia1: 15, dia2: 30 } })}
          opciones={[{ v: 'calendario', t: '1–15 y 16–fin de mes' }, { v: 'cobro', t: 'Según mis días de cobro' }]} />
        {!(a.quincena.dia1 === 1 && a.quincena.dia2 === 16) && (
          <div className="dos-col">
            <Campo etiqueta="Primera quincena empieza el día"><select value={a.quincena.dia1} onChange={(e) => set({ quincena: { ...a.quincena, dia1: Number(e.target.value) } })}>{Array.from({ length: 28 }, (_, i) => i + 1).filter((n) => n < a.quincena.dia2).map((n) => <option key={n} value={n}>{n}</option>)}</select></Campo>
            <Campo etiqueta="Segunda quincena empieza el día"><select value={a.quincena.dia2} onChange={(e) => set({ quincena: { ...a.quincena, dia2: Number(e.target.value) } })}>{Array.from({ length: 31 }, (_, i) => i + 1).filter((n) => n > a.quincena.dia1).map((n) => <option key={n} value={n}>{n === 31 ? 'Último día' : n}</option>)}</select></Campo>
          </div>
        )}
        <p className="sec chico">Quincena actual: <strong>{fmtRango(q)}</strong>. Los presupuestos quincenales y el panel usan estas fechas. Tus fechas de cobro se configuran en <a href="#/compromisos">Compromisos → Calendario de cobros</a>.</p>
      </section>

      <section className="tarjeta pila">
        <h2 className="titulo-tarjeta">Alertas</h2>
        <div className="dos-col">
          <Campo etiqueta="Avisar al llegar a este % del presupuesto"><input type="number" min={10} max={100} value={a.alertas.presupuestoPct} onChange={(e) => set({ alertas: { ...a.alertas, presupuestoPct: Math.max(10, Math.min(100, Number(e.target.value) || 80)) } })} /></Campo>
          <Campo etiqueta="Avisar pagos con cuántos días de anticipación"><input type="number" min={0} max={30} value={a.alertas.diasPago} onChange={(e) => set({ alertas: { ...a.alertas, diasPago: Math.max(0, Math.min(30, Number(e.target.value) || 0)) } })} /></Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta="Saldo bajo en una cuenta (0 = no avisar)"><EntradaDinero etiqueta="Saldo bajo" valor={a.alertas.saldoBajo} onCambio={(v) => set({ alertas: { ...a.alertas, saldoBajo: v ?? 0 } })} permitirCero /></Campo>
          <Campo etiqueta="Avisar cuando una meta llegue al %"><input type="number" min={50} max={100} value={a.alertas.metaPct} onChange={(e) => set({ alertas: { ...a.alertas, metaPct: Math.max(50, Math.min(100, Number(e.target.value) || 90)) } })} /></Campo>
        </div>
      </section>

      <section className="tarjeta pila">
        <div className="tarjeta-cab"><h2 className="titulo-tarjeta">Categorías</h2>
          <div className="fila-wrap"><button className="btn chico" onClick={() => setCat('nueva-gasto')}><Icono n="mas" />De gasto</button><button className="btn chico" onClick={() => setCat('nueva-ingreso')}><Icono n="mas" />De ingreso</button></div></div>
        {(['gasto', 'ingreso'] as const).map((tipo) => (
          <div key={tipo}>
            <h3 className="sub-tabla">{tipo === 'gasto' ? 'Gastos' : 'Ingresos'}</h3>
            <ul className="chips">{d.categorias.filter((c) => c.tipo === tipo).map((c) => (
              <li key={c.id}><button className={`chip ${c.archivada ? 'archivada' : ''}`} onClick={() => setCat(c)}><i className="pt" style={{ background: c.color }} />{c.nombre}{c.subcategorias.length ? <span className="sec"> · {c.subcategorias.length}</span> : null}{c.archivada ? ' (oculta)' : ''}</button></li>
            ))}</ul>
          </div>
        ))}
      </section>

      <section className="tarjeta pila">
        <h2 className="titulo-tarjeta">Copias de seguridad</h2>
        <p className="sec">Tus datos se guardan solo en este {esApp() ? 'teléfono' : 'navegador'}. Haz un respaldo con frecuencia y guárdalo en Drive o en tu correo; con él puedes recuperar todo o pasarlo a otro dispositivo.
          {' '}{a.ultimoRespaldo ? <>Último respaldo: <strong>{fmtFecha(fechaDeIso(a.ultimoRespaldo))}</strong>{diasSinRespaldo! > 14 ? <span className="t-alerta"> (hace {diasSinRespaldo} días)</span> : null}.</> : <span className="t-alerta">Aún no has hecho ninguno.</span>}</p>
        <div className="fila-wrap">
          <button className="btn primario" onClick={exportarJson}><Icono n="descargar" />Exportar respaldo (JSON)</button>
          <button className="btn" onClick={() => archivo.current?.click()}><Icono n="subir" />Importar respaldo</button>
          <button className="btn" onClick={async () => { const r = await guardarArchivo(`movimientos-${hoy()}.csv`, movimientosACsv(d.movimientos, d.cuentas, d.categorias), 'text/csv;charset=utf-8'); avisar(r === 'descargado' ? 'CSV descargado' : 'CSV listo para guardar'); }}><Icono n="descargar" />Todos los movimientos (CSV)</button>
          <input ref={archivo} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) leer(f); e.target.value = ''; }} />
        </div>
        <hr className="separador" />
        <button className="btn peligro" style={{ alignSelf: 'flex-start' }} onClick={() => setBorrar(1)}>Borrar todos los datos</button>
      </section>

      <p className="sec chico centro">Finanzas personales · v2.0 · funciona sin internet · tus datos no salen de tu dispositivo</p>

      {cat && <FormCategoria d={d} c={typeof cat === 'string' ? undefined : cat} tipo={cat === 'nueva-ingreso' ? 'ingreso' : typeof cat === 'object' ? cat.tipo : 'gasto'} onCerrar={() => setCat(null)} />}
      {borrar === 1 && <Modal titulo="¿Borrar todos los datos?" onCerrar={() => setBorrar(0)} pie={<><button className="btn" onClick={() => setBorrar(0)} data-autofocus>Cancelar</button><button className="btn peligro" onClick={() => setBorrar(2)}>Continuar</button></>}>
        <p>Se borrarán movimientos, cuentas, presupuestos, compromisos, deudas y metas de este dispositivo. Te recomendamos exportar un respaldo antes.</p></Modal>}
      {borrar === 2 && <Modal titulo="Confirmación final" onCerrar={() => setBorrar(0)} pie={<><button className="btn" onClick={() => setBorrar(0)} data-autofocus>Cancelar</button><button className="btn peligro" onClick={async () => { await borrarTodo(); setBorrar(0); avisar('Datos borrados. Se cargó la configuración inicial.'); }}>Borrar definitivamente</button></>}>
        <p>Esta acción <strong>no se puede deshacer</strong>.</p></Modal>}
      {confirmacion}
    </div>
  );
}

function FormCategoria({ d, c, tipo, onCerrar }: { d: Datos; c?: Categoria; tipo: 'gasto' | 'ingreso'; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [x, setX] = useState<Categoria>(c ?? { id: nuevoId(), nombre: '', tipo, color: COLORES[d.categorias.length % COLORES.length], subcategorias: [], orden: d.categorias.length });
  const [subs, setSubs] = useState(x.subcategorias.join(', '));
  const [borrar, setBorrar] = useState(false);
  const otras = d.categorias.filter((y) => y.tipo === x.tipo && y.id !== x.id && !y.archivada);
  const [reemplazo, setReemplazo] = useState(otras.find((y) => /otros/i.test(y.nombre))?.id ?? otras[0]?.id ?? '');
  const [error, setError] = useState('');
  const usos = c ? d.movimientos.filter((m) => m.categoriaId === c.id).length : 0;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try { await guardarCategoria({ ...x, subcategorias: subs.split(',') }); avisar(c ? 'Categoría actualizada' : 'Categoría creada'); onCerrar(); } catch (err) { setError(mensajeError(err)); }
  }
  return (
    <Modal titulo={c ? 'Editar categoría' : `Nueva categoría de ${tipo}`} onCerrar={onCerrar}>
      {!borrar ? (
        <form className="pila" onSubmit={guardar} noValidate>
          <Campo etiqueta="Nombre"><input type="text" value={x.nombre} maxLength={40} data-autofocus onChange={(e) => setX({ ...x, nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Subcategorías (separadas por coma)"><input type="text" value={subs} onChange={(e) => setSubs(e.target.value)} placeholder="Ej.: Supermercado, Colmado" /></Campo>
          <fieldset className="grupo"><legend className="campo-etq">Color</legend>
            <div className="colores">{COLORES.map((col) => <button type="button" key={col} className="color" style={{ background: col }} aria-label={`Color ${col}`} aria-pressed={x.color === col} onClick={() => setX({ ...x, color: col })} />)}</div>
          </fieldset>
          {c && <label className="check"><input type="checkbox" checked={!!x.archivada} onChange={(e) => setX({ ...x, archivada: e.target.checked })} /> Ocultar (no aparece al registrar, conserva el historial)</label>}
          {error && <p className="error-form" role="alert">{error}</p>}
          <div className="acciones-form">
            {c ? <button type="button" className="btn peligro" onClick={() => setBorrar(true)}>Eliminar</button> : <span />}
            <div className="fila-wrap"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn primario">Guardar</button></div>
          </div>
        </form>
      ) : (
        <div className="pila">
          <p>{usos ? `"${c!.nombre}" tiene ${usos} movimiento(s). Pasarán a la categoría que elijas, igual que sus límites de presupuesto.` : `Se eliminará "${c!.nombre}".`}</p>
          <Campo etiqueta="Mover a"><select value={reemplazo} onChange={(e) => setReemplazo(e.target.value)}>{otras.map((y) => <option key={y.id} value={y.id}>{y.nombre}</option>)}</select></Campo>
          {error && <p className="error-form" role="alert">{error}</p>}
          <div className="acciones-form"><span /><div className="fila-wrap">
            <button className="btn" onClick={() => setBorrar(false)}>Cancelar</button>
            <button className="btn peligro" disabled={!reemplazo} onClick={async () => { try { await eliminarCategoria(c!.id, reemplazo); avisar('Categoría eliminada'); onCerrar(); } catch (err) { setError(mensajeError(err)); } }}>Eliminar categoría</button>
          </div></div>
        </div>
      )}
    </Modal>
  );
}
