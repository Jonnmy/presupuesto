import { useEffect, useState } from 'react';
import { borrarProducto, guardarProducto, marcarCompraHecha } from '../db/acciones';
import { costoCompraSirena } from '../lib/calculos';
import { formatoFecha, hoy } from '../lib/fechas';
import { nuevoId, rd } from '../lib/formato';
import type { ProductoSirena } from '../lib/tipos';
import { CampoMonto, CeldaNumero, Dialogo } from '../ui/comunes';
import { useUi, type TodosLosDatos } from '../ui/contexto';

const CLAVE_MARCAS = 'compraMarcas';

export function Compras({ d }: { d: TodosLosDatos }) {
  const { avisar } = useUi();
  const [marcas, setMarcas] = useState<string[]>(() => JSON.parse(localStorage.getItem(CLAVE_MARCAS) ?? '[]'));
  const [producto, setProducto] = useState<ProductoSirena | 'nuevo' | null>(null);
  const [comprando, setComprando] = useState(false);
  const [periodo, setPeriodo] = useState<'quincena' | 'mes'>(() => (localStorage.getItem('compraPeriodo') === 'mes' ? 'mes' : 'quincena'));
  useEffect(() => localStorage.setItem(CLAVE_MARCAS, JSON.stringify(marcas)), [marcas]);
  useEffect(() => localStorage.setItem('compraPeriodo', periodo), [periodo]);

  const cant = (p: ProductoSirena) => (periodo === 'quincena' ? p.cantidadQuincena : p.cantidadMes);
  const activos = d.productos.filter((p) => p.activo);
  const aComprar = activos.filter((p) => cant(p) > 0);
  const opcionales = activos.filter((p) => cant(p) === 0 && p.precio > 0);
  const sinPrecio = activos.filter((p) => p.precio === 0);
  const quincena = costoCompraSirena(d.productos, 'quincena');
  const mes = costoCompraSirena(d.productos, 'mes');
  const estimado = periodo === 'quincena' ? quincena : mes;
  const enCarrito = aComprar.filter((p) => marcas.includes(p.id)).reduce((s, p) => s + p.precio * cant(p), 0);
  const etiqueta = periodo === 'quincena' ? '15 días' : 'un mes';
  const compras = [...d.compras].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);

  async function guardar(p: ProductoSirena) {
    const { antes, despues } = await guardarProducto(p);
    if (antes !== despues) avisar(`Presupuesto de Dieta: ${rd(antes)} → ${rd(despues)} (${despues > antes ? '+' : ''}${rd(despues - antes)})`);
  }

  return (
    <main>
      <div className="cabecera">
        <h1>Compras de Sirena</h1>
        <div className="segmentado" role="group" aria-label="Ver compra">
          <button aria-pressed={periodo === 'quincena'} onClick={() => setPeriodo('quincena')}>Quincenal</button>
          <button aria-pressed={periodo === 'mes'} onClick={() => setPeriodo('mes')}>Mensual</button>
        </div>
      </div>

      <section className="tarjeta" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="fila">
          <div>
            <div className="sec chico">Compra de {etiqueta} (estimado)</div>
            <div className="grande num">{rd(estimado)}</div>
            <div className="sec chico num">En el carrito: {rd(enCarrito)} · {periodo === 'quincena' ? `Mes: ${rd(mes)}` : `Quincena: ${rd(quincena)}`}</div>
          </div>
          <button className="btn primario" onClick={() => setComprando(true)}>Marcar compra hecha</button>
        </div>
      </section>

      <section className="tarjeta">
        <div className="fila" style={{ marginBottom: 6 }}>
          <h2>Lista para {etiqueta}</h2>
          {marcas.length > 0 && <button className="btn plano" onClick={() => setMarcas([])}>Desmarcar todo</button>}
        </div>
        <ul className="lista">
          {aComprar.map((p) => (
            <li key={p.id}>
              <label className="check" style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <input type="checkbox" checked={marcas.includes(p.id)} onChange={(e) => setMarcas(e.target.checked ? [...marcas, p.id] : marcas.filter((x) => x !== p.id))} />
                  <span style={{ minWidth: 0, textDecoration: marcas.includes(p.id) ? 'line-through' : undefined }}>
                    <span>{p.nombre}</span><br />
                    <span className="sec chico num">{cant(p)} × {p.unidad} · {p.precio ? rd(p.precio) : 'precio por definir'}</span>
                  </span>
                </span>
                <span className="num fuerte">{rd(p.precio * cant(p))}</span>
              </label>
            </li>
          ))}
        </ul>
        {sinPrecio.length > 0 && <p className="sec chico" style={{ marginTop: 8 }}>Sin precio todavía: {sinPrecio.map((p) => p.nombre).join(', ')}. Edítalos en el catálogo.</p>}
      </section>

      {opcionales.length > 0 && (
        <section className="tarjeta">
          <h2>Frutas y extras para añadir</h2>
          <p className="sec chico" style={{ margin: '4px 0 6px' }}>Precios de sirena.do (22 nov 2026). No están en la lista ni en el presupuesto hasta que les pongas cantidad.</p>
          <ul className="lista">
            {opcionales.map((p) => (
              <li key={p.id} className="fila">
                <span style={{ minWidth: 0 }}>
                  <span>{p.nombre}</span><br />
                  <span className="sec chico num">{rd(p.precio)} por {p.unidad}{p.nota ? ` · ${p.nota}` : ''}</span>
                </span>
                <button className="btn" onClick={() => setProducto(p)} aria-label={`Añadir ${p.nombre} a la lista`}>Añadir</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tarjeta">
        <div className="fila" style={{ marginBottom: 6 }}>
          <h2>Catálogo</h2>
          <button className="btn" onClick={() => setProducto('nuevo')}>+ Producto</button>
        </div>
        <p className="sec chico" style={{ marginBottom: 6 }}>Cambia el precio aquí mismo. El presupuesto de Dieta se recalcula solo.</p>
        <table className="tabla">
          <thead><tr><th>Producto</th><th className="n">Precio</th><th className="n">15 d</th><th className="n">Mes</th></tr></thead>
          <tbody>
            {d.productos.map((p) => (
              <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                <td>
                  <button className="btn plano" style={{ padding: 0, minHeight: 40, fontWeight: 400, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setProducto(p)}>
                    <span>{p.nombre}{p.precio === 0 && <span className="tag alerta" style={{ marginLeft: 4 }}>precio por definir</span>}</span>
                  </button>
                </td>
                <td className="n" style={{ width: 84 }}><CeldaNumero etiqueta={`Precio de ${p.nombre}`} valor={p.precio} onCambio={(n) => guardar({ ...p, precio: n })} /></td>
                <td className="n">{p.cantidadQuincena}</td>
                <td className="n">{p.cantidadMes}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td /><td className="n" colSpan={2}>{rd(quincena)} / {rd(mes)}</td></tr></tfoot>
        </table>
      </section>

      <NotasDieta />

      {compras.length > 0 && (
        <section className="tarjeta">
          <h2>Compras anteriores</h2>
          <ul className="lista">
            {compras.map((c) => (
              <li key={c.id} className="fila">
                <span>{formatoFecha(c.fecha)}<br /><span className="sec chico num">Estimado {rd(c.estimado)}</span></span>
                <span className="derecha"><span className="num fuerte">{rd(c.real)}</span><br />
                  <span className={`chico num ${c.real > c.estimado ? 't-excedido' : 't-ok'}`}>{c.real === c.estimado ? 'igual' : `${c.real > c.estimado ? '+' : ''}${rd(c.real - c.estimado)}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {producto && <FormProducto p={producto === 'nuevo' ? undefined : producto} orden={Math.max(0, ...d.productos.map((p) => p.orden)) + 1} onGuardar={guardar} onCerrar={() => setProducto(null)} />}
      {comprando && <FormCompra estimado={estimado} onCerrar={() => setComprando(false)} onHecho={async (real, fecha) => {
        await marcarCompraHecha(estimado, real, fecha);
        setMarcas([]); setComprando(false);
        avisar(`Compra de ${rd(real)} registrada en Dieta`);
      }} />}
    </main>
  );
}

function NotasDieta() {
  return (
    <section className="tarjeta">
      <details>
        <summary className="fuerte" style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Notas de la dieta</summary>
        <div className="pila sec" style={{ marginTop: 6 }}>
          <div>
            <p className="fuerte" style={{ color: 'var(--texto)' }}>Batida</p>
            <p>Con 1.1 L de leche, 4 huevos, 2 guineos, avena y whey salen unos 1.5 a 1.7 L: no cabe en la botella de 1.2 L. Toma el yogurt aparte o lleva un segundo envase de 500 a 750 mL. Usa una licuadora de 1.5 L o más, o hazla en dos tandas.</p>
          </div>
          <div>
            <p className="fuerte" style={{ color: 'var(--texto)' }}>Para añadir (sin quitar nada)</p>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              <li>Una fruta distinta al guineo: naranja, mango, piña o guayaba.</li>
              <li>Verduras en el almuerzo y la cena: ensalada, vegetales o aguacate.</li>
              <li>Pescado 1 o 2 veces por semana: sardinas o atún en lata.</li>
              <li>Snack a las 3 o 4 p.m., antes del gym: pan con mantequilla de maní o un guineo.</li>
              <li>Agua con algo de sal si sudas mucho; 55 a 65 oz al día.</li>
            </ul>
          </div>
          <div>
            <p className="fuerte" style={{ color: 'var(--texto)' }}>Multivitamínico</p>
            <p>Una toma al día, cerca del 100% del valor diario, sin megadosis ni hierro extra, de los sencillos. Tómalo con comida. No interfiere con la creatina y no reemplaza las verduras. Si tomas algún medicamento, consulta a un farmacéutico.</p>
          </div>
          <p className="chico">Cuando tengas los precios de la fruta, verduras, aguacate, sardinas o el multivitamínico, ponlos en el catálogo con su cantidad y el presupuesto de Dieta se ajusta solo.</p>
        </div>
      </details>
    </section>
  );
}

function FormCompra({ estimado, onCerrar, onHecho }: { estimado: number; onCerrar: () => void; onHecho: (real: number, fecha: string) => void }) {
  const [real, setReal] = useState<number | ''>(estimado);
  const [fecha, setFecha] = useState(hoy());
  const dif = Number(real || 0) - estimado;
  return (
    <Dialogo titulo="Compra hecha" onCerrar={onCerrar} acciones={<>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!real} onClick={() => onHecho(Number(real), fecha)}>Registrar gasto</button>
    </>}>
      <div className="pila">
        <p className="sec">Estimado: <span className="num">{rd(estimado)}</span>. Escribe lo que pagaste de verdad.</p>
        <CampoMonto etiqueta="Monto pagado (RD$)" valor={real} onCambio={setReal} grande autoFocus />
        <label className="campo"><span>Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        {real !== '' && dif !== 0 && <p className={dif > 0 ? 't-excedido' : 't-ok'}>{dif > 0 ? `${rd(dif)} más de lo estimado` : `${rd(-dif)} menos de lo estimado`}</p>}
      </div>
    </Dialogo>
  );
}

function FormProducto({ p, orden, onGuardar, onCerrar }: { p?: ProductoSirena; orden: number; onGuardar: (p: ProductoSirena) => Promise<void>; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [x, setX] = useState<ProductoSirena>(p ?? { id: nuevoId(), nombre: '', precio: 0, unidad: 'unidad', cantidadQuincena: 1, cantidadMes: 2, activo: true, orden });
  const set = (c: Partial<ProductoSirena>) => setX({ ...x, ...c });
  return (
    <Dialogo titulo={p ? 'Editar producto' : 'Nuevo producto'} onCerrar={onCerrar} acciones={<>
      {p && <button className="btn peligro" onClick={async () => { const r = await borrarProducto(p.id); onCerrar(); avisar(`Producto borrado. Dieta: ${rd(r.despues)}`); }}>Borrar</button>}
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!x.nombre.trim()} onClick={async () => { await onGuardar({ ...x, nombre: x.nombre.trim() }); onCerrar(); }}>Guardar</button>
    </>}>
      <div className="pila">
        <label className="campo"><span>Nombre</span><input type="text" value={x.nombre} onChange={(e) => set({ nombre: e.target.value })} maxLength={80} /></label>
        <div className="dos-col">
          <CampoMonto etiqueta="Precio (RD$)" valor={x.precio} onCambio={(n) => set({ precio: Number(n || 0) })} />
          <label className="campo"><span>Unidad</span><input type="text" value={x.unidad} onChange={(e) => set({ unidad: e.target.value })} maxLength={30} /></label>
        </div>
        <div className="dos-col">
          <label className="campo"><span>Cantidad por 15 días</span><CeldaNumero etiqueta="Cantidad por 15 días" valor={x.cantidadQuincena} onCambio={(n) => set({ cantidadQuincena: n })} decimales /></label>
          <label className="campo"><span>Cantidad por mes</span><CeldaNumero etiqueta="Cantidad por mes" valor={x.cantidadMes} onCambio={(n) => set({ cantidadMes: n })} decimales /></label>
        </div>
        <label className="campo"><span>Nota</span><input type="text" value={x.nota ?? ''} onChange={(e) => set({ nota: e.target.value || undefined })} maxLength={100} /></label>
        <label className="check"><input type="checkbox" checked={x.activo} onChange={(e) => set({ activo: e.target.checked })} /> Incluir en la lista y en el presupuesto</label>
        {x.nota && <p className="sec chico">{x.nota}</p>}
      </div>
    </Dialogo>
  );
}
