import { useCallback, useEffect, useState } from 'react';
import { db } from './db/db';
import type { Gasto } from './lib/tipos';
import { ProveedorUi, useDatos, type TipoMovimiento } from './ui/contexto';
import { FormGasto } from './ui/FormGasto';
import { Resumen } from './pantallas/Resumen';
import { Gastos } from './pantallas/Gastos';
import { Ahorro } from './pantallas/Ahorro';
import { Compras } from './pantallas/Compras';
import { Ajustes } from './pantallas/Ajustes';
import { Presupuesto } from './pantallas/Presupuesto';
import { Simple } from './pantallas/Simple';

/** Modo sencillo: solo ingreso y apartados. Las demás pantallas siguen en el código para más adelante. */
const SENCILLO = true;

type Ruta = 'resumen' | 'gastos' | 'ahorro' | 'compras' | 'ajustes' | 'presupuesto';
const RUTAS: Ruta[] = ['resumen', 'gastos', 'ahorro', 'compras', 'ajustes', 'presupuesto'];

function leerRuta(): Ruta {
  const r = location.hash.replace(/^#\/?/, '') as Ruta;
  return RUTAS.includes(r) ? r : 'resumen';
}

const ICONOS: Record<Exclude<Ruta, 'presupuesto'>, string> = {
  resumen: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gastos: 'M4 6h16M4 12h16M4 18h10',
  ahorro: 'M12 3v18M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.5s2.2 3 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3',
  compras: 'M3 4h2l2.4 11h11.2L21 7H6.2M9 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z',
  ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 01-2.1 1.2L14.7 21h-4l-.3-2.1a7 7 0 01-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 010-2.6L4.4 9.9l2-3.4 1.9.7a7 7 0 012.1-1.2L10.7 4h4l.3 2.1a7 7 0 012.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 010 2.6z',
};
const NOMBRES: Record<Exclude<Ruta, 'presupuesto'>, string> = { resumen: 'Resumen', gastos: 'Gastos', ahorro: 'Ahorro', compras: 'Compras', ajustes: 'Ajustes' };

export default function App() {
  const d = useDatos();
  const [ruta, setRuta] = useState<Ruta>(leerRuta);
  const [form, setForm] = useState<{ gasto?: Gasto; tipo?: TipoMovimiento } | null>(null);
  const abrirGasto = useCallback((g?: Gasto, tipo?: TipoMovimiento) => setForm({ gasto: g, tipo }), []);

  useEffect(() => {
    const f = () => { setRuta(leerRuta()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  // Atajo de teclado: N abre "Nuevo gasto" (salvo que se esté escribiendo o haya un diálogo abierto).
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (SENCILLO || document.querySelector('[role="dialog"]')) return;
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0b0f17' : '#f8fafc');
  }, [oscuro]);

  if (!d) return <div className="app"><p className="sec" role="status">Cargando…</p></div>;

  const activa = ruta === 'presupuesto' ? 'resumen' : ruta;
  return (
    <ProveedorUi abrirGasto={abrirGasto}>
      <div className="app">
        <header className="barra-sup">
          <a className="marca" href="#/" style={{ color: 'inherit', textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l5-5 3.5 2.6L20 7" fill="none" stroke="var(--verde)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Quincena
          </a>
          <button className="btn plano chico" aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            onClick={() => db.ajustes.update('ajustes', { tema: oscuro ? 'claro' : 'oscuro' })}>
            {oscuro ? '☀ Claro' : '☾ Oscuro'}
          </button>
        </header>
        {SENCILLO && <Simple a={d.ajustes} />}
        {!SENCILLO && ruta === 'resumen' && <Resumen d={d} />}
        {!SENCILLO && ruta === 'gastos' && <Gastos d={d} />}
        {!SENCILLO && ruta === 'ahorro' && <Ahorro d={d} />}
        {!SENCILLO && ruta === 'compras' && <Compras d={d} />}
        {!SENCILLO && ruta === 'ajustes' && <Ajustes d={d} />}
        {!SENCILLO && ruta === 'presupuesto' && <Presupuesto d={d} />}
      </div>
      {!SENCILLO && <>
      <button className="fab" onClick={() => abrirGasto(undefined, 'gasto')} aria-label="Agregar gasto (atajo N)">+ Gasto <kbd aria-hidden="true">N</kbd></button>
      <nav className="nav" aria-label="Secciones">
        {(Object.keys(NOMBRES) as (keyof typeof NOMBRES)[]).map((r) => (
          <a key={r} href={`#/${r === 'resumen' ? '' : r}`} aria-current={activa === r ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONOS[r]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {NOMBRES[r]}
          </a>
        ))}
      </nav>
      </>}
      {form && <FormGasto gasto={form.gasto} tipo={form.tipo} categorias={d.categorias} corte={d.ajustes.diaPago1} onCerrar={() => setForm(null)} />}
    </ProveedorUi>
  );
}
