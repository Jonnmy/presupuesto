// Registrar el pago de un compromiso (o el cobro de un ingreso programado), con monto, fecha y cuenta editables.
import { useState } from 'react';
import { registrarVencimiento } from '../db/acciones';
import { dinero } from '../nucleo/dinero';
import { fmtFecha, hoy } from '../nucleo/fechas';
import type { Datos, Programado } from '../nucleo/tipos';
import { Campo, EntradaDinero, mensajeError, Modal, useUi } from './base';

export function PagarVencimiento({ d, p, onCerrar }: { d: Datos; p: Programado; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [monto, setMonto] = useState<number | null>(p.monto);
  const [fecha, setFecha] = useState(hoy());
  const [cuentaId, setCuentaId] = useState(p.cuentaId ?? d.cuentas[0]?.id);
  const [error, setError] = useState('');
  const ingreso = p.tipo === 'ingreso';
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!monto || monto <= 0) return setError('Escribe un monto mayor que cero.');
    try {
      await registrarVencimiento(p.id, { monto, fecha, cuentaId });
      avisar(`${p.nombre}: ${ingreso ? 'cobro' : 'pago'} de ${dinero(monto)} registrado`);
      onCerrar();
    } catch (err) { setError(mensajeError(err)); }
  }
  return (
    <Modal titulo={ingreso ? `Recibir ${p.nombre}` : `Pagar ${p.nombre}`} onCerrar={onCerrar}>
      <form className="pila" onSubmit={guardar} noValidate>
        <p className="sec">Vencimiento del {fmtFecha(p.proximaFecha)}. Se registrará como {ingreso ? 'ingreso' : 'gasto'} una sola vez y pasará al siguiente.</p>
        <Campo etiqueta={ingreso ? 'Monto recibido' : 'Monto pagado'}><EntradaDinero etiqueta="Monto" valor={monto} onCambio={setMonto} grande autoFocus /></Campo>
        <div className="dos-col">
          <Campo etiqueta="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
          <Campo etiqueta={ingreso ? 'Cuenta donde entra' : 'Cuenta de pago'}>
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              {d.cuentas.filter((c) => !c.archivada).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>
        {error && <p className="error-form" role="alert">{error}</p>}
        <div className="acciones-form"><span /><div className="fila-wrap">
          <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn primario">{ingreso ? 'Registrar cobro' : 'Marcar como pagado'}</button>
        </div></div>
      </form>
    </Modal>
  );
}
