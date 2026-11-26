import { useCallback, useEffect, useState } from 'react';
import { db } from './db/db';
import { Icono, ProveedorUi, useDatos, type AbrirMovimiento, type NombreIcono } from './ui/base';
import { FormMovimiento } from './ui/FormMovimiento';
import { Panel } from './pantallas/Panel';
import { Movimientos } from './pantallas/Movimientos';
import { Presupuestos } from './pantallas/Presupuestos';
import { Compromisos } from './pantallas/Compromisos';
import { Cuentas } from './pantallas/Cuentas';
import { Deudas } from './pantallas/Deudas';
import { Metas } from './pantallas/Metas';
import { Calendario } from './pantallas/Calendario';
import { Reportes } from './pantallas/Reportes';
import { Ajustes } from './pantallas/Ajustes';

const RUTAS = {
  panel: { nombre: 'Panel', icono: 'panel' },
  movimientos: { nombre: 'Movimientos', icono: 'movimientos' },
  presupuestos: { nombre: 'Presupuestos', icono: 'presupuestos' },
  compromisos: { nombre: 'Compromisos', icono: 'compromisos' },
  cuentas: { nombre: 'Cuentas', icono: 'cuentas' },
  deudas: { nombre: 'Deudas y tarjetas', icono: 'deudas' },
  metas: { nombre: 'Metas de ahorro', icono: 'metas' },
  calendario: { nombre: 'Calendario', icono: 'calendario' },
  reportes: { nombre: 'Reportes', icono: 'reportes' },
  ajustes: { nombre: 'Configuración', icono: 'ajustes' },
} satisfies Record<string, { nombre: string; icono: NombreIcono }>;
export type Ruta = keyof typeof RUTAS;
const ABAJO: Ruta[] = ['panel', 'movimientos', 'presupuestos', 'compromisos'];

function leerRuta(): Ruta {
  const r = location.hash.replace(/^#\/?/, '').split('?')[0] as Ruta;
  return r in RUTAS ? r : 'panel';
}

export default function App() {
  const d = useDatos();
  const [ruta, setRuta] = useState<Ruta>(leerRuta);
  const [form, setForm] = useState<AbrirMovimiento | null>(null);
  const [menu, setMenu] = useState(false);
  const abrir = useCallback((o: AbrirMovimiento = {}) => setForm(o), []);

  useEffect(() => {
    const f = () => { setRuta(leerRuta()); setMenu(false); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  // Atajo: tecla N = agregar gasto (si no se está escribiendo ni hay una ventana abierta).
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setForm({ tipo: 'gasto' });
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  const tema = d?.ajustes.tema ?? 'oscuro';
  const [sistemaOscuro, setSistemaOscuro] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const f = () => setSistemaOscuro(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && sistemaOscuro);
  useEffect(() => {
    document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0b0f17' : '#f4f6fa');
  }, [oscuro]);

  if (!d) return <div className="cargando" role="status">Cargando tus finanzas…</div>;

  const enlace = (r: Ruta, clase = '') => (
    <a key={r} href={`#/${r}`} className={clase} aria-current={ruta === r ? 'page' : undefined}>
      <Icono n={RUTAS[r].icono} tam={20} /><span>{RUTAS[r].nombre}</span>
    </a>
  );

  return (
    <ProveedorUi abrir={abrir}>
      <div className="marco">
        <aside className="lateral" aria-label="Navegación principal">
          <a className="marca" href="#/panel"><span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 16l5-5 3.5 2.6L20 7" /></svg></span>Finanzas</a>
          <button className="btn primario ancho" onClick={() => abrir({ tipo: 'gasto' })}><Icono n="mas" />Agregar gasto<kbd>N</kbd></button>
          <nav>{(Object.keys(RUTAS) as Ruta[]).map((r) => enlace(r))}</nav>
          <button className="btn plano tema" onClick={() => db.ajustes.update('ajustes', { tema: oscuro ? 'claro' : 'oscuro' })}>
            <Icono n={oscuro ? 'sol' : 'luna'} />{oscuro ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </aside>

        <div className="contenido">
          <header className="barra-movil">
            <a className="marca" href="#/panel"><span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 16l5-5 3.5 2.6L20 7" /></svg></span>{RUTAS[ruta].nombre}</a>
            <button className="btn icono" aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={() => db.ajustes.update('ajustes', { tema: oscuro ? 'claro' : 'oscuro' })}><Icono n={oscuro ? 'sol' : 'luna'} /></button>
          </header>
          <main className="pagina">
            {ruta === 'panel' && <Panel d={d} />}
            {ruta === 'movimientos' && <Movimientos d={d} />}
            {ruta === 'presupuestos' && <Presupuestos d={d} />}
            {ruta === 'compromisos' && <Compromisos d={d} />}
            {ruta === 'cuentas' && <Cuentas d={d} />}
            {ruta === 'deudas' && <Deudas d={d} />}
            {ruta === 'metas' && <Metas d={d} />}
            {ruta === 'calendario' && <Calendario d={d} />}
            {ruta === 'reportes' && <Reportes d={d} />}
            {ruta === 'ajustes' && <Ajustes d={d} />}
          </main>
        </div>
      </div>

      <button className="fab" onClick={() => abrir({ tipo: 'gasto' })} aria-label="Agregar gasto"><Icono n="mas" tam={22} />Gasto</button>
      <nav className="abajo" aria-label="Navegación">
        {ABAJO.map((r) => enlace(r))}
        <button className={menu || !ABAJO.includes(ruta) ? 'activo' : ''} onClick={() => setMenu(true)} aria-haspopup="dialog"><Icono n="menu" tam={20} /><span>Más</span></button>
      </nav>
      {menu && (
        <div className="hoja-velo" onClick={() => setMenu(false)}>
          <nav className="hoja" aria-label="Más secciones" onClick={(e) => e.stopPropagation()}>
            {(Object.keys(RUTAS) as Ruta[]).filter((r) => !ABAJO.includes(r)).map((r) => enlace(r))}
          </nav>
        </div>
      )}

      {form && <FormMovimiento d={d} o={form} onCerrar={() => setForm(null)} />}
    </ProveedorUi>
  );
}
