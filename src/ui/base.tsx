import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { cargarDatos, ErrorUsuario } from '../db/acciones';
import { configurarDinero, dinero, leerDinero, numero } from '../nucleo/dinero';
import { configurarFechas } from '../nucleo/fechas';
import type { EstadoLimite } from '../nucleo/finanzas';
import type { Datos, Movimiento, TipoMovimiento } from '../nucleo/tipos';

/** Todos los datos en memoria; se actualizan solos cuando cambia la base. */
export function useDatos(): Datos | undefined {
  const d = useLiveQuery(() => cargarDatos());
  if (d) {
    configurarDinero(d.ajustes.simbolo, d.ajustes.decimales);
    configurarFechas(d.ajustes.zona, d.ajustes.formatoFecha);
  }
  return d;
}

// ---------- Contexto de interfaz: avisos y formulario rápido ----------

export interface AbrirMovimiento { tipo?: TipoMovimiento; movimiento?: Movimiento; valores?: Partial<Movimiento> }
interface Aviso { id: number; texto: string; tipo: 'ok' | 'error'; deshacer?: () => void }
interface Ui {
  avisar: (texto: string, opciones?: { tipo?: 'ok' | 'error'; deshacer?: () => void }) => void;
  abrir: (o?: AbrirMovimiento) => void;
  /** Ejecuta una acción y muestra su error como aviso. Devuelve true si salió bien. */
  intentar: (fn: () => Promise<unknown>, exito?: string) => Promise<boolean>;
}
const UiCtx = createContext<Ui>({ avisar: () => {}, abrir: () => {}, intentar: async () => false });
export const useUi = () => useContext(UiCtx);

export function mensajeError(e: unknown): string {
  if (e instanceof ErrorUsuario) return e.message;
  if (e instanceof Error && /Key already exists|ConstraintError/i.test(e.name + e.message)) return 'Ese registro ya existe: no se guardó dos veces.';
  if (e instanceof Error && e.message) return e.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}

export function ProveedorUi({ children, abrir }: { children: ReactNode; abrir: (o?: AbrirMovimiento) => void }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const t = useRef<number | undefined>(undefined);
  const avisar = useCallback<Ui['avisar']>((texto, o = {}) => {
    window.clearTimeout(t.current);
    setAviso({ id: Date.now(), texto, tipo: o.tipo ?? 'ok', deshacer: o.deshacer });
    t.current = window.setTimeout(() => setAviso(null), o.deshacer ? 6000 : o.tipo === 'error' ? 5000 : 3000);
  }, []);
  const intentar = useCallback<Ui['intentar']>(async (fn, exito) => {
    try { await fn(); if (exito) avisar(exito); return true; } catch (e) { avisar(mensajeError(e), { tipo: 'error' }); return false; }
  }, [avisar]);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <UiCtx.Provider value={{ avisar, abrir, intentar }}>
      {children}
      <div className="sr" aria-live="polite">{aviso?.texto}</div>
      {aviso && (
        <div className={`toast ${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'} key={aviso.id}>
          <span>{aviso.texto}</span>
          {aviso.deshacer && <button onClick={() => { aviso.deshacer!(); setAviso(null); }}>Deshacer</button>}
          <button className="cerrar-toast" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>×</button>
        </div>
      )}
    </UiCtx.Provider>
  );
}

// ---------- Modal ----------

export function Modal({ titulo, onCerrar, children, pie, ancho }: { titulo: string; onCerrar: () => void; children: ReactNode; pie?: ReactNode; ancho?: 'normal' | 'grande' }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  const abiertoEn = useRef(Date.now());
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const caja = ref.current;
    if (caja && !caja.contains(document.activeElement)) {
      (caja.querySelector<HTMLElement>('[data-autofocus]') ?? caja.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=date]), select, textarea') ?? caja)?.focus();
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrar.current(); }
      if (e.key === 'Tab' && caja) {
        const f = [...caja.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', tecla);
    document.body.classList.add('con-modal');
    return () => {
      document.removeEventListener('keydown', tecla);
      if (!document.querySelector('.modal-velo ~ .modal-velo')) document.body.classList.remove('con-modal');
      previo?.focus?.();
    };
  }, []);
  return (
    <div className="modal-velo" onMouseDown={(e) => { if (e.target === e.currentTarget && Date.now() - abiertoEn.current > 400) onCerrar(); }}>
      <div className={`modal ${ancho === 'grande' ? 'grande' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <header className="modal-cab">
          <h2 id={id}>{titulo}</h2>
          <button className="btn icono" onClick={onCerrar} aria-label="Cerrar"><Icono n="x" /></button>
        </header>
        <div className="modal-cuerpo">{children}</div>
        {pie && <footer className="modal-pie">{pie}</footer>}
      </div>
    </div>
  );
}

export function Confirmar({ titulo, texto, si = 'Eliminar', peligro = true, onSi, onNo }: { titulo: string; texto: ReactNode; si?: string; peligro?: boolean; onSi: () => void; onNo: () => void }) {
  return (
    <Modal titulo={titulo} onCerrar={onNo} pie={<>
      <button className="btn" onClick={onNo} data-autofocus>Cancelar</button>
      <button className={`btn ${peligro ? 'peligro' : 'primario'}`} onClick={onSi}>{si}</button>
    </>}>
      <p>{texto}</p>
    </Modal>
  );
}

/** Hook para pedir confirmación antes de eliminar: const [pedir, dialogo] = useConfirmar(); */
export function useConfirmar(): [(o: { titulo: string; texto: ReactNode; si?: string; peligro?: boolean; onSi: () => void }) => void, ReactNode] {
  const [o, setO] = useState<{ titulo: string; texto: ReactNode; si?: string; peligro?: boolean; onSi: () => void } | null>(null);
  const dialogo = o ? <Confirmar {...o} onNo={() => setO(null)} onSi={() => { setO(null); o.onSi(); }} /> : null;
  return [setO, dialogo];
}

// ---------- Campos ----------

export function Campo({ etiqueta, children, ayuda, error }: { etiqueta: string; children: ReactNode; ayuda?: ReactNode; error?: string }) {
  return (
    <label className={`campo ${error ? 'con-error' : ''}`}>
      <span className="campo-etq">{etiqueta}</span>
      {children}
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
      {error && <span className="campo-error">{error}</span>}
    </label>
  );
}

/** Entrada de dinero: acepta "1,250.50", guarda centavos. null = vacío o inválido. */
export function EntradaDinero({ valor, onCambio, grande, etiqueta, autoFocus, permitirCero }: {
  valor: number | null; onCambio: (c: number | null) => void; grande?: boolean; etiqueta: string; autoFocus?: boolean; permitirCero?: boolean;
}) {
  const [texto, setTexto] = useState(valor === null ? '' : numero(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    if (!foco) setTexto(valor === null || (valor === 0 && !permitirCero) ? (valor === 0 && permitirCero ? '0' : '') : numero(valor));
  }, [valor, foco, permitirCero]);
  return (
    <div className={`entrada-dinero ${grande ? 'grande' : ''}`}>
      <span className="prefijo" aria-hidden="true">{dinero(0).split(' ')[0]}</span>
      <input
        type="text" inputMode="decimal" autoComplete="off" aria-label={etiqueta} value={texto} placeholder="0.00"
        data-autofocus={autoFocus ? '' : undefined}
        onFocus={(e) => { setFoco(true); setTexto(texto.replace(/,/g, '')); requestAnimationFrame(() => e.target.select()); }}
        onBlur={() => { setFoco(false); }}
        onChange={(e) => { const t = e.target.value.replace(/[^\d.,]/g, ''); setTexto(t); onCambio(t.trim() === '' ? null : leerDinero(t)); }}
      />
    </div>
  );
}

export function Segmentado<T extends string>({ opciones, valor, onCambio, etiqueta }: { opciones: { v: T; t: string }[]; valor: T; onCambio: (v: T) => void; etiqueta: string }) {
  return (
    <div className="segmentado" role="group" aria-label={etiqueta}>
      {opciones.map((o) => <button type="button" key={o.v} aria-pressed={valor === o.v} onClick={() => onCambio(o.v)}>{o.t}</button>)}
    </div>
  );
}

// ---------- Visuales ----------

export function Barra({ valor, maximo, estado = 'ok', etiqueta, pendiente = 0 }: { valor: number; maximo: number; estado?: EstadoLimite | 'ahorro'; etiqueta: string; pendiente?: number }) {
  const pct = maximo > 0 ? Math.min(100, (valor / maximo) * 100) : valor > 0 ? 100 : 0;
  const pctP = maximo > 0 ? Math.min(100 - pct, (pendiente / maximo) * 100) : 0;
  return (
    <div className={`barra ${estado}`} role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(maximo > 0 ? (valor / maximo) * 100 : 0)}>
      <span style={{ width: `${pct}%` }} />
      {pctP > 0 && <span className="pend" style={{ width: `${pctP}%` }} />}
    </div>
  );
}

export function Vacio({ icono = 'vacio', titulo, texto, accion }: { icono?: NombreIcono; titulo: string; texto?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="vacio">
      <div className="vacio-icono"><Icono n={icono} /></div>
      <p className="vacio-titulo">{titulo}</p>
      {texto && <p className="sec">{texto}</p>}
      {accion && <div style={{ marginTop: 12 }}>{accion}</div>}
    </div>
  );
}

export function Kpi({ etiqueta, valor, sub, tono, icono }: { etiqueta: string; valor: ReactNode; sub?: ReactNode; tono?: 'ingreso' | 'gasto' | 'ahorro' | 'alerta' | 'peligro'; icono?: NombreIcono }) {
  return (
    <div className={`kpi ${tono ?? ''}`}>
      <div className="kpi-etq">{icono && <Icono n={icono} />}{etiqueta}</div>
      <div className="kpi-val num">{valor}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function Variacion({ pct, inverso }: { pct: number | null; inverso?: boolean }) {
  if (pct === null) return <span className="sec">sin datos previos</span>;
  if (Math.abs(pct) < 0.5) return <span className="sec">igual que el período anterior</span>;
  const sube = pct > 0;
  const malo = inverso ? sube : !sube;
  return <span className={malo ? 't-peligro' : 't-ok'}>{sube ? '▲' : '▼'} {Math.abs(Math.round(pct))}% vs. anterior</span>;
}

// ---------- Íconos (SVG en línea, sin dependencias) ----------

const ICONOS = {
  panel: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
  movimientos: 'M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3',
  presupuestos: 'M12 3a9 9 0 109 9h-9z M14 3.3A9 9 0 0120.7 10H14z',
  compromisos: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M8 14h3',
  cuentas: 'M3 7h18v12H3zM3 11h18M16 15h2',
  deudas: 'M3 6h18v12H3zM3 10h18M7 15h4',
  metas: 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 16a4 4 0 110-8 4 4 0 010 8zM12 12h.01',
  calendario: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  reportes: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 01-2.1 1.2L14.7 21h-4l-.3-2.1a7 7 0 01-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 010-2.6L4.4 9.9l2-3.4 1.9.7a7 7 0 012.1-1.2L10.7 4h4l.3 2.1a7 7 0 012.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 010 2.6z',
  mas: 'M12 5v14M5 12h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  x: 'M6 6l12 12M18 6L6 18',
  izq: 'M15 18l-6-6 6-6',
  der: 'M9 6l6 6-6 6',
  buscar: 'M11 18a7 7 0 110-14 7 7 0 010 14zM21 21l-5-5',
  editar: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  borrar: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  check: 'M5 12l5 5L20 7',
  alerta: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  info: 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 11v6M12 7h.01',
  vacio: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
  sol: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  luna: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  descargar: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  subir: 'M12 20V8M7 13l5-5 5 5M4 4h16',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  transferir: 'M4 8h14l-4-4M20 16H6l4 4',
  ingreso: 'M12 19V5M5 12l7-7 7 7',
  gasto: 'M12 5v14M5 12l7 7 7-7',
  reloj: 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 7v5l3 3',
  tarjeta: 'M3 6h18v12H3zM3 10h18M7 15h4',
} as const;
export type NombreIcono = keyof typeof ICONOS;

export function Icono({ n, tam = 18 }: { n: NombreIcono; tam?: number }) {
  return (
    <svg className="icono-svg" width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONOS[n]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const m = (c: number) => dinero(c);
