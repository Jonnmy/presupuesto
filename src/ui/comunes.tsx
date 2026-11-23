import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Estado } from '../lib/calculos';
import { pct, rd } from '../lib/formato';

export function Dialogo({ titulo, onCerrar, children, acciones }: { titulo: string; onCerrar: () => void; children: ReactNode; acciones?: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const primero = ref.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button');
    primero?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar.current(); };
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = ''; previo?.focus?.(); };
  }, []);
  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="fila" style={{ marginBottom: 12 }}>
          <h2 id={id}>{titulo}</h2>
          <button className="btn plano icono" onClick={onCerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        {children}
        {acciones && <div className="acciones">{acciones}</div>}
      </div>
    </div>
  );
}

export function Barra({ valor, maximo, estado, etiqueta }: { valor: number; maximo: number; estado: Estado; etiqueta: string }) {
  if (!(maximo > 0)) return null;
  const ancho = Math.min(100, (valor / maximo) * 100);
  return (
    <div className={`barra ${estado}`} role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((valor / maximo) * 100)}>
      <span style={{ width: `${ancho}%` }} />
    </div>
  );
}

const TEXTO_ESTADO: Record<Estado, string> = { ok: 'Bien', alerta: 'Cerca del límite', excedido: 'Excedido', 'sin-presupuesto': 'Sin presupuesto' };

export function EtiquetaEstado({ estado, gastado, presupuesto }: { estado: Estado; gastado: number; presupuesto: number }) {
  if (estado === 'sin-presupuesto') return <span className="tag">Sin presupuesto</span>;
  return <span className={`tag ${estado}`} title={TEXTO_ESTADO[estado]}>{pct(gastado / presupuesto)}<span className="sr"> · {TEXTO_ESTADO[estado]}</span></span>;
}

/** Campo de monto entero con teclado numérico. */
export function CampoMonto({ etiqueta, valor, onCambio, grande, autoFocus, id }: {
  etiqueta: string; valor: number | ''; onCambio: (n: number | '') => void; grande?: boolean; autoFocus?: boolean; id?: string;
}) {
  const [texto, setTexto] = useState(valor === '' ? '' : String(valor));
  useEffect(() => {
    setTexto((t) => (Number(t.replace(/\D/g, '')) === valor ? t : valor === '' ? '' : String(valor)));
  }, [valor]);
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <input
        id={id}
        className={grande ? 'monto-grande' : 'celda'}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoFocus={autoFocus}
        value={texto}
        placeholder="0"
        onChange={(e) => {
          const limpio = e.target.value.replace(/\D/g, '').slice(0, 9);
          setTexto(limpio);
          onCambio(limpio === '' ? '' : Number(limpio));
        }}
      />
    </label>
  );
}

/** Input numérico compacto para tablas (sin etiqueta visible). */
export function CeldaNumero({ valor, onCambio, etiqueta, decimales }: { valor: number; onCambio: (n: number) => void; etiqueta: string; decimales?: boolean }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => { setTexto((t) => (Number(t) === valor ? t : String(valor))); }, [valor]);
  return (
    <input
      className="celda"
      aria-label={etiqueta}
      inputMode={decimales ? 'decimal' : 'numeric'}
      value={texto}
      onChange={(e) => {
        const limpio = e.target.value.replace(decimales ? /[^\d.]/g : /\D/g, '').slice(0, 9);
        setTexto(limpio);
        const n = Number(limpio);
        if (limpio !== '' && Number.isFinite(n)) onCambio(n);
      }}
      onBlur={() => { if (texto === '') { setTexto('0'); onCambio(0); } }}
    />
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return <div className="vacio"><span className="fuerte">{titulo}</span>{children}</div>;
}

export function Cifra({ etiqueta, valor, sub, clase }: { etiqueta: string; valor: number; sub?: ReactNode; clase?: string }) {
  return (
    <div className="cifra">
      <div className="etq">{etiqueta}</div>
      <div className={`val ${clase ?? ''}`}>{rd(valor)}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/** Pide confirmación en un diálogo. */
export function Confirmar({ titulo, texto, si, onSi, onNo, peligro }: { titulo: string; texto: ReactNode; si: string; onSi: () => void; onNo: () => void; peligro?: boolean }) {
  return (
    <Dialogo titulo={titulo} onCerrar={onNo} acciones={<>
      <button className="btn" onClick={onNo}>Cancelar</button>
      <button className={`btn ${peligro ? 'peligro lleno' : 'primario'}`} onClick={onSi}>{si}</button>
    </>}>
      <p>{texto}</p>
    </Dialogo>
  );
}
