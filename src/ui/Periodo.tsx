import { useState } from 'react';
import { esFecha, hoy, sumarDias } from '../nucleo/fechas';
import { NOMBRE_VISTA, nombrePeriodo, periodoAnterior, rangoVista, type VistaPeriodo } from '../nucleo/periodos';
import type { Ajustes, Rango } from '../nucleo/tipos';
import { Icono } from './base';

export interface EstadoPeriodo { vista: VistaPeriodo; paso: number; personalizado: Rango }
export interface Periodo { vista: VistaPeriodo; rango: Rango; anterior: Rango; nombre: string; esActual: boolean }

export function usePeriodo(a: Ajustes, inicial: VistaPeriodo = 'quincena'): [Periodo, EstadoPeriodo, (e: EstadoPeriodo) => void] {
  const h = hoy();
  const [e, setE] = useState<EstadoPeriodo>(() => {
    const guardada = sessionStorage.getItem('vista') as VistaPeriodo | null;
    return { vista: guardada && guardada in NOMBRE_VISTA ? guardada : inicial, paso: 0, personalizado: { inicio: sumarDias(h, -13), fin: h } };
  });
  const rango = rangoVista(e.vista, h, a, e.paso, e.personalizado);
  const p: Periodo = { vista: e.vista, rango, anterior: periodoAnterior(e.vista, rango, a), nombre: nombrePeriodo(e.vista, rango), esActual: rango.inicio <= h && rango.fin >= h };
  return [p, e, (n) => { sessionStorage.setItem('vista', n.vista); setE(n); }];
}

export function SelectorPeriodo({ p, e, onCambio }: { p: Periodo; e: EstadoPeriodo; onCambio: (e: EstadoPeriodo) => void }) {
  return (
    <div className="selector-periodo">
      <div className="vistas" role="group" aria-label="Período">
        {(Object.keys(NOMBRE_VISTA) as VistaPeriodo[]).map((v) => (
          <button key={v} type="button" aria-pressed={e.vista === v} onClick={() => onCambio({ ...e, vista: v, paso: 0 })}>
            {v === 'personalizado' ? 'Personalizado' : NOMBRE_VISTA[v].replace(/^(Esta|Este) /, '').replace(/^\w/, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>
      <div className="navega">
        <button className="btn icono" aria-label="Período anterior" onClick={() => onCambio({ ...e, paso: e.paso - 1 })}><Icono n="izq" /></button>
        <span className="nombre-periodo" aria-live="polite">{p.nombre}{!p.esActual && e.vista !== 'personalizado' && <button className="btn plano chico" onClick={() => onCambio({ ...e, paso: 0 })}>Hoy</button>}</span>
        <button className="btn icono" aria-label="Período siguiente" onClick={() => onCambio({ ...e, paso: e.paso + 1 })}><Icono n="der" /></button>
      </div>
      {e.vista === 'personalizado' && (
        <div className="rango-personal">
          <label><span className="sr">Desde</span><input type="date" value={e.personalizado.inicio} max={e.personalizado.fin} onChange={(x) => esFecha(x.target.value) && onCambio({ ...e, paso: 0, personalizado: { ...e.personalizado, inicio: x.target.value } })} /></label>
          <span className="sec">a</span>
          <label><span className="sr">Hasta</span><input type="date" value={e.personalizado.fin} min={e.personalizado.inicio} onChange={(x) => esFecha(x.target.value) && onCambio({ ...e, paso: 0, personalizado: { ...e.personalizado, fin: x.target.value } })} /></label>
        </div>
      )}
    </div>
  );
}
