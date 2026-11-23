import {
  aFecha, formatoMes, formatoQuincena, mesAnterior, mesDe, mesSiguiente, quincenaAnterior, quincenaDe, quincenaSiguiente, hoy,
} from '../lib/fechas';
import type { Mes, Quincena } from '../lib/tipos';

export type Periodo = { tipo: 'quincena'; q: Quincena } | { tipo: 'mes'; m: Mes };

export function periodoActual(corte: number, tipo: 'quincena' | 'mes' = 'quincena'): Periodo {
  const h = hoy();
  return tipo === 'quincena' ? { tipo, q: quincenaDe(h, corte) } : { tipo, m: mesDe(h) };
}

const Flecha = ({ izq }: { izq?: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d={izq ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function SelectorPeriodo({ periodo, onCambio, corte, permitirMes = true }: {
  periodo: Periodo; onCambio: (p: Periodo) => void; corte: number; permitirMes?: boolean;
}) {
  const mover = (dir: 1 | -1) => {
    if (periodo.tipo === 'quincena') onCambio({ tipo: 'quincena', q: dir > 0 ? quincenaSiguiente(periodo.q, corte) : quincenaAnterior(periodo.q, corte) });
    else onCambio({ tipo: 'mes', m: dir > 0 ? mesSiguiente(periodo.m) : mesAnterior(periodo.m) });
  };
  const titulo = periodo.tipo === 'quincena' ? formatoQuincena(periodo.q) : formatoMes(periodo.m);
  const actual = periodoActual(corte, periodo.tipo);
  const esActual = JSON.stringify(actual) === JSON.stringify(periodo);
  return (
    <div className="cabecera">
      <div className="selector">
        <button className="btn plano icono" onClick={() => mover(-1)} aria-label="Periodo anterior"><Flecha izq /></button>
        <button className="btn plano titulo" onClick={() => onCambio(actual)} aria-label={`${titulo}. Ir al periodo actual`} title="Ir al periodo actual" style={{ padding: '0 4px' }}>
          <span className="num" style={{ textTransform: periodo.tipo === 'mes' ? 'capitalize' : undefined }}>{titulo}</span>
          {!esActual && <span className="sr"> (no es el actual)</span>}
        </button>
        <button className="btn plano icono" onClick={() => mover(1)} aria-label="Periodo siguiente"><Flecha /></button>
      </div>
      {permitirMes && (
        <div className="segmentado" role="group" aria-label="Ver por">
          <button aria-pressed={periodo.tipo === 'quincena'} onClick={() => {
            if (periodo.tipo === 'quincena') return;
            const h = hoy();
            const mismoMes = mesDe(h).anio === periodo.m.anio && mesDe(h).mes === periodo.m.mes;
            onCambio({ tipo: 'quincena', q: quincenaDe(mismoMes ? h : aFecha(periodo.m.anio, periodo.m.mes, 1), corte) });
          }}>Quincena</button>
          <button aria-pressed={periodo.tipo === 'mes'} onClick={() => periodo.tipo !== 'mes' && onCambio({ tipo: 'mes', m: { anio: periodo.q.anio, mes: periodo.q.mes } })}>Mes</button>
        </div>
      )}
    </div>
  );
}
