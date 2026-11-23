import { useState } from 'react';
import { db } from '../db/db';
import {
  ahorroAcumulado, ahorrado, disponible, proyeccionAhorro, vistaMes, vistaQuincena, type FilaCategoria,
} from '../lib/calculos';
import { claveQuincena, diasEntre, formatoQuincena, hoy, quincenaAnterior, quincenaDe } from '../lib/fechas';
import { nuevoId, rd } from '../lib/formato';
import type { Quincena } from '../lib/tipos';
import { Barra, Cifra, EtiquetaEstado } from '../ui/comunes';
import { useUi, type TodosLosDatos } from '../ui/contexto';
import { BarrasH, ColumnasAcumulado } from '../ui/Graficos';
import { SelectorPeriodo, periodoActual, type Periodo } from '../ui/Selector';

export function Resumen({ d }: { d: TodosLosDatos }) {
  const corte = d.ajustes.diaPago1;
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoActual(corte));
  const h = hoy();
  const v = periodo.tipo === 'quincena' ? vistaQuincena(periodo.q, d) : vistaMes(periodo.m, d);
  const plan = v.presupuestado + v.planificados;

  let frase2: string;
  if (periodo.tipo === 'quincena') {
    const q = periodo.q;
    if (h < q.inicio) frase2 = `Meta de ahorro: ${rd(v.meta)}.`;
    else if (h > q.fin) frase2 = `Sobraron ${rd(v.ingreso - v.gastado)} en esta quincena.`;
    else frase2 = `Si sigues así, ahorras ${rd(proyeccionAhorro(q, d, h))} esta quincena.`;
  } else {
    frase2 = `Meta de ahorro del mes: ${rd(v.meta)}.`;
  }

  return (
    <main>
      <SelectorPeriodo periodo={periodo} onCambio={setPeriodo} corte={corte} />
      <h1 className="sr">Resumen</h1>

      <AvisoCierre d={d} />
      <AvisoRespaldo d={d} />

      <section className="tarjeta" aria-label="Estado">
        <p className="estado-frase">Llevas <strong>{rd(v.gastado)}</strong> de <strong>{rd(plan)}</strong>. {frase2}</p>
      </section>

      <section className="cifras" aria-label="Cifras" style={{ marginBottom: 12 }}>
        <Cifra etiqueta="Ingreso" valor={v.ingreso} sub={v.ingreso !== (periodo.tipo === 'quincena' ? d.ajustes.ingresoQuincenal : d.ajustes.ingresoQuincenal * 2) ? 'Incluye ingresos extra' : undefined} />
        <Cifra etiqueta="Gastado" valor={v.gastado} sub={<>presupuesto {rd(plan)}</>} clase={v.gastado > plan ? 't-excedido' : ''} />
        <Cifra etiqueta="Disponible" valor={v.disponible} sub="ingreso − gastado − ahorrado" clase={v.disponible < 0 ? 't-excedido' : ''} />
        <Cifra etiqueta="Ahorro depositado" valor={v.ahorrado} sub={<>meta {rd(v.meta)}{v.planificados > 0 ? ` (−${rd(v.planificados)} únicos)` : ''}</>} />
      </section>

      <section className="tarjeta">
        <div className="fila" style={{ marginBottom: 4 }}>
          <h2>Por categoría</h2>
          <a className="btn plano" href="#/presupuesto">Editar presupuesto</a>
        </div>
        {v.filas.map((f) => <FilaCat key={f.categoria.id} f={f} mes={periodo.tipo === 'mes'} />)}
      </section>

      <section className="tarjeta">
        <h2>Gasto por categoría</h2>
        <BarrasH titulo="Gasto por categoría" filas={v.filas.map((f) => ({ nombre: f.categoria.nombre, valor: f.gastado }))} />
      </section>

      <section className="tarjeta">
        <h2>Ahorro acumulado por quincena</h2>
        <ColumnasAcumulado titulo="Ahorro acumulado por quincena" puntos={seriePorQuincena(d, periodo.tipo === 'quincena' ? periodo.q : quincenaDe(v.rango.fin, corte), corte)} />
      </section>
    </main>
  );
}

function FilaCat({ f, mes }: { f: FilaCategoria; mes: boolean }) {
  const mensual = f.categoria.modo === 'mensual' && !mes;
  return (
    <div className="cat-fila">
      <div className="fila">
        <span className="fuerte">{f.categoria.nombre}</span>
        <span className="fila-wrap" style={{ gap: 8 }}>
          <span className="num chico">{rd(f.gastado)}{f.presupuesto > 0 && <span className="sec"> / {rd(f.presupuesto)}</span>}</span>
          <EtiquetaEstado estado={f.estado} gastado={f.gastadoEvaluado} presupuesto={f.presupuestoEvaluado} />
        </span>
      </div>
      <Barra valor={f.gastadoEvaluado} maximo={f.presupuestoEvaluado} estado={f.estado} etiqueta={`${f.categoria.nombre}: ${rd(f.gastadoEvaluado)} de ${rd(f.presupuestoEvaluado)}`} />
      {mensual && <p className="sec chico" style={{ marginTop: 4 }}>Provisión de la quincena {rd(f.presupuesto)}. En el mes: {rd(f.gastadoEvaluado)} de {rd(f.presupuestoEvaluado)}.</p>}
      {f.categoria.modo === 'unico' && f.presupuesto === 0 && <p className="sec chico">Compras puntuales, sin presupuesto fijo.</p>}
    </div>
  );
}

function seriePorQuincena(d: TodosLosDatos, ultima: Quincena, corte: number) {
  const qs: Quincena[] = [ultima];
  for (let i = 0; i < 5; i++) qs.unshift(quincenaAnterior(qs[0], corte));
  return qs.map((q) => ({
    etiqueta: `${q.numero === 1 ? '1ª' : '2ª'} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][q.mes - 1]}`,
    valor: ahorrado(q, d),
    acumulado: ahorroAcumulado(d.depositos, q.fin),
  }));
}

/** "Esta quincena sobraron RD$X. ¿Lo depositas en ahorro?" — para la quincena que acaba de cerrar. */
export function AvisoCierre({ d }: { d: TodosLosDatos }) {
  const { avisar } = useUi();
  const h = hoy();
  const previa = quincenaAnterior(quincenaDe(h, d.ajustes.diaPago1), d.ajustes.diaPago1);
  const clave = claveQuincena(previa);
  const resto = disponible(previa, d);
  if (d.ajustes.cierresVistos.includes(clave) || resto <= 0 || previa.fin < d.ajustes.creadoEn.slice(0, 10)) return null;
  const marcar = () => db.ajustes.update('ajustes', { cierresVistos: [...d.ajustes.cierresVistos, clave] });
  return (
    <section className="tarjeta aviso" aria-label="Cierre de quincena">
      <p>La quincena {formatoQuincena(previa)} cerró. Sobraron <strong className="num">{rd(resto)}</strong>. ¿Lo depositas en ahorro?</p>
      <div className="fila-wrap" style={{ marginTop: 10 }}>
        <button className="btn primario" onClick={async () => {
          await db.depositos.add({ id: nuevoId(), fecha: previa.fin, monto: resto, nota: 'Sobrante de quincena', metaId: d.metas[0]?.id });
          await marcar();
          avisar(`Depósito de ${rd(resto)} registrado`);
        }}>Depositar {rd(resto)}</button>
        <button className="btn" onClick={marcar}>Ahora no</button>
      </div>
    </section>
  );
}

function AvisoRespaldo({ d }: { d: TodosLosDatos }) {
  const desde = (d.ajustes.ultimoRespaldo ?? d.ajustes.creadoEn).slice(0, 10);
  const dias = diasEntre(desde, hoy());
  if (dias < 15 || d.gastos.length + d.depositos.length === 0) return null;
  return (
    <section className="tarjeta aviso alerta" aria-label="Recordatorio de respaldo">
      <p>{d.ajustes.ultimoRespaldo ? `Hace ${dias} días que no haces un respaldo.` : 'Todavía no has hecho un respaldo de tus datos.'} Tus datos viven solo en este teléfono.</p>
      <a className="btn" href="#/ajustes" style={{ marginTop: 10 }}>Hacer respaldo</a>
    </section>
  );
}
