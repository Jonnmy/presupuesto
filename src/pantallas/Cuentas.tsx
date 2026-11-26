import { useState } from 'react';
import { db } from '../db/db';
import { eliminarCuenta, guardarCuenta } from '../db/acciones';
import { dinero, nuevoId } from '../nucleo/dinero';
import { fmtFecha, hoy } from '../nucleo/fechas';
import { disponible, historialCuenta, LIQUIDAS, patrimonio, saldoCuenta } from '../nucleo/finanzas';
import type { Cuenta, Datos, TipoCuenta } from '../nucleo/tipos';
import { Campo, EntradaDinero, Icono, mensajeError, Modal, useConfirmar, useUi, Vacio } from '../ui/base';
import { NOMBRE_TIPO } from '../ui/FormMovimiento';

export const NOMBRE_CUENTA: Record<TipoCuenta, string> = { efectivo: 'Efectivo', banco: 'Cuenta bancaria', ahorro: 'Cuenta de ahorros', billetera: 'Billetera digital', tarjeta: 'Tarjeta de crédito' };

export function Cuentas({ d }: { d: Datos }) {
  const { abrir } = useUi();
  const [editar, setEditar] = useState<Cuenta | 'nueva' | null>(null);
  const [ver, setVer] = useState<Cuenta | null>(null);
  const activas = d.cuentas.filter((c) => !c.archivada);
  const archivadas = d.cuentas.filter((c) => c.archivada);
  const ahorros = activas.filter((c) => c.tipo === 'ahorro').reduce((s, c) => s + saldoCuenta(c, d.movimientos), 0);
  const deudaTarjetas = activas.filter((c) => c.tipo === 'tarjeta').reduce((s, c) => s + Math.max(0, -saldoCuenta(c, d.movimientos)), 0);

  return (
    <div className="pila-grande">
      <div className="cabecera">
        <div><h1>Cuentas</h1><p className="sec">Dónde está tu dinero.</p></div>
        <div className="fila-wrap">
          <button className="btn" onClick={() => abrir({ tipo: 'transferencia' })} disabled={activas.length < 2}><Icono n="transferir" />Transferir</button>
          <button className="btn primario" onClick={() => setEditar('nueva')}><Icono n="mas" />Nueva cuenta</button>
        </div>
      </div>
      <section className="rejilla-kpi">
        <div className="kpi ingreso"><div className="kpi-etq">Disponible</div><div className="kpi-val num">{dinero(disponible(d))}</div><div className="kpi-sub">efectivo, bancos y billeteras</div></div>
        <div className="kpi ahorro"><div className="kpi-etq">En cuentas de ahorro</div><div className="kpi-val num">{dinero(ahorros)}</div></div>
        <div className="kpi gasto"><div className="kpi-etq">Deuda de tarjetas</div><div className="kpi-val num">{dinero(deudaTarjetas)}</div></div>
        <div className="kpi"><div className="kpi-etq">Patrimonio neto</div><div className="kpi-val num">{dinero(patrimonio(d))}</div><div className="kpi-sub">cuentas + metas − deudas</div></div>
      </section>

      <div className="rejilla-cuentas">
        {activas.map((c) => {
          const s = saldoCuenta(c, d.movimientos);
          return (
            <button key={c.id} className="cuenta" onClick={() => setVer(c)}>
              <div className="fila"><span className="etiqueta">{NOMBRE_CUENTA[c.tipo]}</span><Icono n={c.tipo === 'tarjeta' ? 'tarjeta' : 'cuentas'} /></div>
              <div className="fuerte">{c.nombre}</div>
              {c.tipo === 'tarjeta'
                ? <><div className={`num grande ${s < 0 ? 't-peligro' : ''}`}>{dinero(Math.max(0, -s))}</div><div className="sec chico">adeudado · disponible {dinero((c.limite ?? 0) + s)}</div></>
                : <><div className={`num grande ${s < 0 ? 't-peligro' : ''}`}>{dinero(s)}</div><div className="sec chico">{LIQUIDAS.includes(c.tipo) ? 'cuenta en el disponible' : 'no cuenta en el disponible'}</div></>}
            </button>
          );
        })}
      </div>
      {archivadas.length > 0 && (
        <details className="tarjeta"><summary className="sec">Cuentas archivadas ({archivadas.length})</summary>
          <ul className="lista">{archivadas.map((c) => <li key={c.id} className="fila-lista"><span className="min0">{c.nombre} <span className="sec chico">· {dinero(saldoCuenta(c, d.movimientos))}</span></span><button className="btn chico" onClick={() => setVer(c)}>Historial</button><button className="btn chico" onClick={() => db.cuentas.update(c.id, { archivada: false })}>Restaurar</button></li>)}</ul>
        </details>
      )}
      {editar && <FormCuenta d={d} c={editar === 'nueva' ? undefined : editar} onCerrar={() => setEditar(null)} />}
      {ver && <DetalleCuenta d={d} c={ver} onCerrar={() => setVer(null)} onEditar={() => { setEditar(ver); setVer(null); }} />}
    </div>
  );
}

function DetalleCuenta({ d, c, onCerrar, onEditar }: { d: Datos; c: Cuenta; onCerrar: () => void; onEditar: () => void }) {
  const { abrir } = useUi();
  const filas = historialCuenta(c, d.movimientos);
  const s = saldoCuenta(c, d.movimientos);
  return (
    <Modal titulo={c.nombre} onCerrar={onCerrar} ancho="grande" pie={<>
      <button className="btn" onClick={onEditar}><Icono n="editar" />Editar cuenta</button>
      {c.tipo === 'tarjeta' && s < 0 && <button className="btn primario" onClick={() => { onCerrar(); abrir({ tipo: 'transferencia', valores: { cuentaDestinoId: c.id, nombre: `Pago ${c.nombre}`, monto: -s } }); }}>Pagar tarjeta</button>}
    </>}>
      <div className="fila-wrap entre">
        <div><div className="kpi-etq">{c.tipo === 'tarjeta' ? 'Deuda actual' : 'Saldo actual'}</div><div className="num heroe-val">{dinero(c.tipo === 'tarjeta' ? Math.max(0, -s) : s)}</div></div>
        <div className="sec chico">Saldo inicial {dinero(c.tipo === 'tarjeta' ? -c.saldoInicial : c.saldoInicial)} al {fmtFecha(c.fechaInicial)}</div>
      </div>
      {filas.length === 0 ? <Vacio icono="movimientos" titulo="Sin movimientos en esta cuenta" /> : (
        <table className="tabla compacta">
          <thead><tr><th>Fecha</th><th>Movimiento</th><th className="der">Monto</th><th className="der">Saldo</th></tr></thead>
          <tbody>{filas.slice(0, 300).map(({ m, efecto, saldo }) => (
            <tr key={m.id} className="clicable" onClick={() => { onCerrar(); abrir({ movimiento: m }); }}>
              <td className="num chico">{fmtFecha(m.fecha)}</td>
              <td className="min0"><div className="recorta">{m.nombre}</div><div className="sec chico">{NOMBRE_TIPO[m.tipo]}{m.estado === 'pendiente' ? ' · pendiente (no afecta)' : ''}{m.fecha < c.fechaInicial ? ' · anterior al saldo inicial' : ''}</div></td>
              <td className={`der num ${efecto > 0 ? 't-ok' : efecto < 0 ? 't-gasto' : 'sec'}`}>{efecto > 0 ? '+' : ''}{dinero(efecto)}</td>
              <td className="der num sec">{dinero(saldo)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Modal>
  );
}

export function FormCuenta({ d, c, tipoInicial, onCerrar }: { d: Datos; c?: Cuenta; tipoInicial?: TipoCuenta; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [pedir, confirmacion] = useConfirmar();
  const [x, setX] = useState<Cuenta>(c ?? { id: nuevoId(), nombre: '', tipo: tipoInicial ?? 'banco', saldoInicial: 0, fechaInicial: hoy(), orden: d.cuentas.length, creadoEn: new Date().toISOString() });
  const tarjeta = x.tipo === 'tarjeta';
  const [saldo, setSaldo] = useState<number | null>(c ? (tarjeta ? -c.saldoInicial : c.saldoInicial) : 0);
  const [error, setError] = useState('');
  const set = (y: Partial<Cuenta>) => { setX({ ...x, ...y }); setError(''); };

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await guardarCuenta({ ...x, saldoInicial: tarjeta ? -(saldo ?? 0) : saldo ?? 0 });
      avisar(c ? 'Cuenta actualizada' : 'Cuenta creada');
      onCerrar();
    } catch (err) { setError(mensajeError(err)); }
  }

  return (
    <Modal titulo={c ? 'Editar cuenta' : tarjeta ? 'Nueva tarjeta de crédito' : 'Nueva cuenta'} onCerrar={onCerrar}>
      <form className="pila" onSubmit={guardar} noValidate>
        <div className="dos-col">
          <Campo etiqueta="Nombre"><input type="text" value={x.nombre} maxLength={40} data-autofocus placeholder={tarjeta ? 'Ej.: Visa Popular' : 'Ej.: Banreservas'} onChange={(e) => set({ nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Tipo">
            <select value={x.tipo} onChange={(e) => set({ tipo: e.target.value as TipoCuenta })} disabled={!!c && d.movimientos.some((m) => m.cuentaId === c.id || m.cuentaDestinoId === c.id)}>
              {Object.entries(NOMBRE_CUENTA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Campo>
        </div>
        <div className="dos-col">
          <Campo etiqueta={tarjeta ? 'Lo que debes en esa fecha' : 'Saldo en esa fecha'} ayuda={tarjeta ? 'Balance adeudado de la tarjeta.' : 'Cuánto había en la cuenta ese día.'}>
            <EntradaDinero etiqueta="Saldo inicial" valor={saldo} onCambio={setSaldo} permitirCero />
          </Campo>
          <Campo etiqueta="Fecha del saldo" ayuda="Los movimientos anteriores ya están incluidos en ese saldo."><input type="date" value={x.fechaInicial} onChange={(e) => set({ fechaInicial: e.target.value })} /></Campo>
        </div>
        {tarjeta && (
          <>
            <Campo etiqueta="Límite de crédito"><EntradaDinero etiqueta="Límite" valor={x.limite ?? null} onCambio={(v) => set({ limite: v ?? undefined })} /></Campo>
            <div className="dos-col">
              <Campo etiqueta="Día de corte"><input type="number" min={1} max={31} value={x.diaCorte ?? ''} onChange={(e) => set({ diaCorte: e.target.value ? Number(e.target.value) : undefined })} /></Campo>
              <Campo etiqueta="Día límite de pago"><input type="number" min={1} max={31} value={x.diaPago ?? ''} onChange={(e) => set({ diaPago: e.target.value ? Number(e.target.value) : undefined })} /></Campo>
            </div>
            <p className="sec chico">Las compras con la tarjeta cuentan como gasto el día que compras. Cuando pagues la tarjeta, usa "Transferir" desde tu cuenta hacia la tarjeta: así no se cuenta dos veces.</p>
          </>
        )}
        {error && <p className="error-form" role="alert">{error}</p>}
        <div className="acciones-form">
          {c ? <button type="button" className="btn peligro" onClick={() => pedir({
            titulo: 'Eliminar cuenta', texto: 'Si la cuenta tiene movimientos se archivará para conservar el historial; si no, se borrará.',
            onSi: async () => { try { const r = await eliminarCuenta(c.id); avisar(r === 'archivada' ? 'Cuenta archivada (tiene historial)' : 'Cuenta eliminada'); onCerrar(); } catch (err) { setError(mensajeError(err)); } },
          })}>Eliminar</button> : <span />}
          <div className="fila-wrap"><button type="button" className="btn" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn primario">Guardar</button></div>
        </div>
      </form>
      {confirmacion}
    </Modal>
  );
}
