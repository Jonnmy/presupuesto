import { useMemo, useState } from 'react';
import { marcarPagado } from '../db/acciones';
import { movimientosACsv } from '../db/respaldo';
import { dinero, leerDinero, suma } from '../nucleo/dinero';
import { enRango, fmtFecha, hoy } from '../nucleo/fechas';
import { esGasto } from '../nucleo/finanzas';
import type { Datos, Movimiento, TipoMovimiento } from '../nucleo/tipos';
import { guardarArchivo } from '../ui/archivos';
import { Icono, Vacio, useUi } from '../ui/base';
import { NOMBRE_METODO, NOMBRE_TIPO } from '../ui/FormMovimiento';
import { SelectorPeriodo, usePeriodo } from '../ui/Periodo';

type Orden = 'fecha' | 'nombre' | 'monto' | 'categoria';

export function Movimientos({ d }: { d: Datos }) {
  const { abrir, intentar, avisar } = useUi();
  const consulta = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const [p, e, setE] = usePeriodo(d.ajustes, 'mes');
  const [todo, setTodo] = useState(consulta.get('estado') === 'pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<'' | TipoMovimiento>('');
  const [categoria, setCategoria] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [estado, setEstado] = useState(consulta.get('estado') ?? '');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [orden, setOrden] = useState<{ por: Orden; desc: boolean }>({ por: 'fecha', desc: true });
  const [filtros, setFiltros] = useState(!!consulta.get('estado'));
  const h = hoy();

  const nombreCat = useMemo(() => new Map(d.categorias.map((c) => [c.id, c])), [d.categorias]);
  const nombreCuenta = useMemo(() => new Map(d.cuentas.map((c) => [c.id, c.nombre])), [d.cuentas]);
  const cMin = leerDinero(min), cMax = leerDinero(max);

  const lista = d.movimientos.filter((m) => {
    if (!todo && !enRango(m.fecha, p.rango)) return false;
    if (tipo && m.tipo !== tipo) return false;
    if (categoria && m.categoriaId !== categoria) return false;
    if (cuenta && m.cuentaId !== cuenta && m.cuentaDestinoId !== cuenta) return false;
    if (estado && m.estado !== estado) return false;
    if (cMin !== null && m.monto < cMin) return false;
    if (cMax !== null && m.monto > cMax) return false;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      const texto = [m.nombre, m.notas, m.subcategoria, m.fuente, nombreCat.get(m.categoriaId ?? '')?.nombre].join(' ').toLowerCase();
      if (!texto.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    const k = orden.por;
    const r = k === 'monto' ? a.monto - b.monto : k === 'nombre' ? a.nombre.localeCompare(b.nombre) : k === 'categoria'
      ? (nombreCat.get(a.categoriaId ?? '')?.nombre ?? '').localeCompare(nombreCat.get(b.categoriaId ?? '')?.nombre ?? '')
      : a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn);
    return orden.desc ? -r : r;
  });

  const ingresos = suma(lista.filter((m) => m.tipo === 'ingreso' && m.estado === 'pagado').map((m) => m.monto));
  const gastos = suma(lista.filter((m) => esGasto(m) && m.estado === 'pagado').map((m) => m.monto));
  const activos = [tipo, categoria, cuenta, estado, min, max].filter(Boolean).length;

  const cab = (k: Orden, t: string, clase = '') => (
    <th className={clase} aria-sort={orden.por === k ? (orden.desc ? 'descending' : 'ascending') : undefined}>
      <button className="orden" onClick={() => setOrden({ por: k, desc: orden.por === k ? !orden.desc : k !== 'nombre' && k !== 'categoria' })}>{t}{orden.por === k ? (orden.desc ? ' ↓' : ' ↑') : ''}</button>
    </th>
  );
  const signo = (m: Movimiento) => (m.tipo === 'ingreso' || m.tipo === 'retiro' ? 'ingreso' : m.tipo === 'transferencia' || m.tipo === 'aporte' ? 'neutro' : 'gasto');
  const detalle = (m: Movimiento) => m.tipo === 'transferencia'
    ? `${nombreCuenta.get(m.cuentaId ?? '')} → ${nombreCuenta.get(m.cuentaDestinoId ?? '')}`
    : [nombreCuenta.get(m.cuentaId ?? ''), m.metodo && m.tipo === 'gasto' ? NOMBRE_METODO[m.metodo] : '', m.subcategoria].filter(Boolean).join(' · ');

  async function exportar() {
    const r = await guardarArchivo(`movimientos-${todo ? 'todos' : `${p.rango.inicio}_${p.rango.fin}`}.csv`, movimientosACsv(lista, d.cuentas, d.categorias), 'text/csv;charset=utf-8');
    avisar(r === 'descargado' ? `CSV descargado (${lista.length} movimientos)` : 'CSV listo para guardar o enviar');
  }

  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Movimientos</h1><p className="sec">Ingresos, gastos y transferencias.</p></div>
        <div className="fila-wrap">
          <button className="btn primario" onClick={() => abrir({ tipo: 'gasto' })}><Icono n="mas" />Gasto</button>
          <button className="btn" onClick={() => abrir({ tipo: 'ingreso' })}><Icono n="ingreso" />Ingreso</button>
          <button className="btn" onClick={() => abrir({ tipo: 'transferencia' })}><Icono n="transferir" />Transferir</button>
        </div>
      </div>

      <section className="tarjeta pila">
        <div className="fila-wrap entre">
          {!todo ? <SelectorPeriodo p={p} e={e} onCambio={setE} /> : <span className="fuerte">Todas las fechas</span>}
          <label className="check"><input type="checkbox" checked={todo} onChange={(x) => setTodo(x.target.checked)} /> Todas las fechas</label>
        </div>
        <div className="fila-wrap">
          <label className="buscador"><Icono n="buscar" /><span className="sr">Buscar</span><input type="search" placeholder="Buscar por nombre, nota o categoría" value={busqueda} onChange={(x) => setBusqueda(x.target.value)} /></label>
          <button className="btn" aria-expanded={filtros} onClick={() => setFiltros(!filtros)}>Filtros{activos ? ` (${activos})` : ''}</button>
          <button className="btn" onClick={exportar} disabled={!lista.length}><Icono n="descargar" />CSV</button>
        </div>
        {filtros && (
          <div className="filtros">
            <label className="campo"><span className="campo-etq">Tipo</span><select value={tipo} onChange={(x) => setTipo(x.target.value as TipoMovimiento)}><option value="">Todos</option>{Object.entries(NOMBRE_TIPO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
            <label className="campo"><span className="campo-etq">Categoría</span><select value={categoria} onChange={(x) => setCategoria(x.target.value)}><option value="">Todas</option>{d.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.tipo === 'ingreso' ? ' (ingreso)' : ''}</option>)}</select></label>
            <label className="campo"><span className="campo-etq">Cuenta</span><select value={cuenta} onChange={(x) => setCuenta(x.target.value)}><option value="">Todas</option>{d.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <label className="campo"><span className="campo-etq">Estado</span><select value={estado} onChange={(x) => setEstado(x.target.value)}><option value="">Todos</option><option value="pagado">Pagado</option><option value="pendiente">Pendiente</option></select></label>
            <label className="campo"><span className="campo-etq">Monto mínimo</span><input inputMode="decimal" value={min} onChange={(x) => setMin(x.target.value)} placeholder="0.00" /></label>
            <label className="campo"><span className="campo-etq">Monto máximo</span><input inputMode="decimal" value={max} onChange={(x) => setMax(x.target.value)} placeholder="Sin límite" /></label>
            {activos > 0 && <button className="btn plano" onClick={() => { setTipo(''); setCategoria(''); setCuenta(''); setEstado(''); setMin(''); setMax(''); }}>Limpiar filtros</button>}
          </div>
        )}
        <div className="resumen-filtro">
          <span>{lista.length} movimiento(s)</span>
          <span className="t-ok num">+{dinero(ingresos)}</span>
          <span className="t-gasto num">−{dinero(gastos)}</span>
        </div>
      </section>

      {lista.length === 0 ? (
        <Vacio icono="movimientos" titulo={busqueda || activos ? 'Nada coincide con los filtros' : 'Sin movimientos en este período'}
          texto={busqueda || activos ? 'Prueba con otros filtros o fechas.' : 'Registra un gasto o un ingreso para empezar.'}
          accion={!busqueda && !activos ? <button className="btn primario" onClick={() => abrir({ tipo: 'gasto' })}>Agregar gasto</button> : undefined} />
      ) : (
        <div className="tarjeta sin-relleno">
          <table className="tabla movimientos">
            <thead><tr>{cab('fecha', 'Fecha')}{cab('nombre', 'Descripción')}{cab('categoria', 'Categoría', 'solo-escritorio')}<th className="solo-escritorio">Estado</th>{cab('monto', 'Monto', 'der')}</tr></thead>
            <tbody>
              {lista.slice(0, 500).map((m) => {
                const c = nombreCat.get(m.categoriaId ?? '');
                return (
                  <tr key={m.id} onClick={() => abrir({ movimiento: m })} className="clicable" tabIndex={0} onKeyDown={(x) => { if (x.key === 'Enter') abrir({ movimiento: m }); }}>
                    <td className="num chico fecha-col">{fmtFecha(m.fecha)}</td>
                    <td className="min0">
                      <div className="fuerte recorta">{m.nombre}</div>
                      <div className="sec chico recorta">
                        <span className="solo-movil">{c ? `${c.nombre} · ` : ''}</span>{m.tipo !== 'gasto' && m.tipo !== 'ingreso' ? `${NOMBRE_TIPO[m.tipo]} · ` : ''}{detalle(m)}
                        {m.estado === 'pendiente' && <span className="solo-movil t-alerta"> · pendiente</span>}
                      </div>
                    </td>
                    <td className="solo-escritorio">{c ? <span className="etiqueta-cat"><i className="pt" style={{ background: c.color }} />{c.nombre}</span> : <span className="sec">—</span>}</td>
                    <td className="solo-escritorio" onClick={(x) => x.stopPropagation()}>
                      {m.estado === 'pendiente'
                        ? <button className="btn chico" onClick={() => intentar(() => marcarPagado(m.id, m.fecha < h ? h : m.fecha), 'Marcado como pagado')}>Marcar pagado</button>
                        : <span className="sec chico">{m.programadoId ? 'Programado' : 'Pagado'}</span>}
                    </td>
                    <td className={`der num fuerte monto-${signo(m)}`}>{signo(m) === 'ingreso' ? '+' : signo(m) === 'gasto' ? '−' : ''}{dinero(m.monto)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length > 500 && <p className="sec chico" style={{ padding: 12 }}>Se muestran los primeros 500. Usa los filtros para acotar.</p>}
        </div>
      )}
    </div>
  );
}
