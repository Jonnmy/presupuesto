import { useState } from 'react';
import { db } from '../db/db';
import { cargarDemo, quitarDemo } from '../db/demo';
import {
  ahorrado, comparativaQuincenas, disponible, gastoDiario, gastoPorMetodo, libreParaGastar, mensualEquivalente, vistaBloques, vistaMes,
  vistaQuincena, type FilaCategoria, type Libre,
} from '../lib/calculos';
import { claveQuincena, diasEntre, formatoFecha, formatoQuincena, hoy, quincenaAnterior, quincenaDe } from '../lib/fechas';
import { nuevoId, pct, rd } from '../lib/formato';
import type { Bloque, Quincena } from '../lib/tipos';
import { Barra, CeldaNumero, Dialogo, EtiquetaEstado } from '../ui/comunes';
import { useUi, type TodosLosDatos } from '../ui/contexto';
import { BarrasDiarias, COLORES_CATEGORIA, Comparativa, Dona } from '../ui/Graficos';
import { SelectorPeriodo, periodoActual, type Periodo } from '../ui/Selector';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const NOMBRE_BLOQUE: Record<Bloque, string> = { necesidades: 'Necesidades', estilo: 'Estilo de vida', ahorro: 'Ahorro e inversión' };
const FRECUENCIA: Record<string, string> = { quincenal: 'cada quincena', mensual: 'al mes', 'cada-n-meses': 'cada pocos meses', 'diaria-laboral': 'por día laborable' };

export function Resumen({ d }: { d: TodosLosDatos }) {
  const corte = d.ajustes.diaPago1;
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoActual(corte));
  const h = hoy();
  const esQuincena = periodo.tipo === 'quincena';
  const v = esQuincena ? vistaQuincena(periodo.q, d) : vistaMes(periodo.m, d);
  const q = esQuincena ? periodo.q : quincenaDe(v.rango.fin, corte);
  const libre = esQuincena ? libreParaGastar(periodo.q, d, h) : null;
  const plan = v.presupuestado + v.planificados;
  const colores = new Map(d.categorias.map((c, i) => [c.id, COLORES_CATEGORIA[i % COLORES_CATEGORIA.length]]));

  return (
    <main>
      <h1 className="sr">Resumen</h1>
      <SelectorPeriodo periodo={periodo} onCambio={setPeriodo} corte={corte} />

      {libre ? <Heroe l={libre} q={periodo.tipo === 'quincena' ? periodo.q : q} h={h} /> : <HeroeMes disponible={v.disponible} ingreso={v.ingreso} gastado={v.gastado} />}

      <section className="cifras cuatro" aria-label="Cifras clave">
        <div className="cifra ingreso"><div className="etq">Ingreso</div><div className="val">{rd(v.ingreso)}</div><div className="sub">{v.ingreso > (esQuincena ? d.ajustes.ingresoQuincenal : d.ajustes.ingresoQuincenal * 2) ? 'incluye extras' : 'sueldo'}</div></div>
        <div className="cifra"><div className="etq">Gastado</div><div className={`val ${v.gastado > plan ? 't-excedido' : ''}`}>{rd(v.gastado)}</div><div className="sub">de {rd(plan)}</div></div>
        <div className="cifra"><div className="etq">{libre ? 'Fijos' : 'Disponible'}</div><div className="val">{rd(libre ? libre.fijos : v.disponible)}</div><div className="sub">{libre ? 'comprometidos' : 'ingreso − gasto − ahorro'}</div></div>
        <div className="cifra ahorro"><div className="etq">Ahorro</div><div className="val">{rd(v.ahorrado)}</div><div className="sub">meta {rd(v.meta)}</div></div>
      </section>

      <Onboarding d={d} />
      <AvisoCierre d={d} />
      <AvisoRespaldo d={d} />

      <section className="tarjeta">
        <div className="tarjeta-cab"><h2>Reparto del ingreso</h2><a className="sec chico" href="#/ajustes">{d.ajustes.bloques.necesidades}/{d.ajustes.bloques.estilo}/{d.ajustes.bloques.ahorro} · editar</a></div>
        {vistaBloques(v.rango, v.ingreso, d).map((b) => (
          <div className="cat-fila" key={b.bloque}>
            <div className="fila">
              <span className="fuerte">{NOMBRE_BLOQUE[b.bloque]} <span className="sec chico num">{b.porcentaje}%</span></span>
              <span className="fila-wrap" style={{ gap: 8 }}>
                <span className="num chico">{rd(b.usado)}<span className="sec"> / {rd(b.limite)}</span></span>
                {b.bloque === 'ahorro'
                  ? <span className="tag ahorro">{b.limite > 0 ? pct(b.usado / b.limite) : '—'}</span>
                  : <EtiquetaEstado estado={b.estado} gastado={b.usado} presupuesto={b.limite} />}
              </span>
            </div>
            <Barra valor={b.usado} maximo={b.limite} estado={b.bloque === 'ahorro' ? 'ok' : b.estado} etiqueta={`${NOMBRE_BLOQUE[b.bloque]}: ${rd(b.usado)} de ${rd(b.limite)}`} clase={b.bloque === 'ahorro' ? 'ahorro' : undefined} />
          </div>
        ))}
      </section>

      <section className="tarjeta">
        <div className="tarjeta-cab"><h2>Por categoría</h2><a className="sec chico" href="#/presupuesto">Editar presupuesto</a></div>
        {v.filas.map((f) => <FilaCat key={f.categoria.id} f={f} mes={!esQuincena} color={colores.get(f.categoria.id)} />)}
      </section>

      <div className="rejilla-2">
        <Metodos d={d} periodo={v.rango} />
        <Suscripciones d={d} />
      </div>

      <div className="rejilla-2">
        <section className="tarjeta">
          <h2>Distribución del gasto</h2>
          <Dona titulo="Distribución del gasto por categoría" filas={v.filas.map((f) => ({ nombre: f.categoria.nombre, valor: f.gastado, color: colores.get(f.categoria.id) ?? '#888' }))} />
        </section>
        <section className="tarjeta">
          <h2>Gasto diario de la quincena</h2>
          <BarrasDiarias titulo="Gasto diario" serie={gastoDiario(q, d)} hoyFecha={h} idealPorDia={plan / (diasEntre(q.inicio, q.fin) + 1)} />
        </section>
      </div>

      <section className="tarjeta">
        <h2>Últimas quincenas: ingreso, gasto y ahorro</h2>
        <Comparativa titulo="Comparativa de quincenas" datos={ultimasQuincenas(q, corte).filter((x, i, todas) => i === todas.length - 1 || x.fin >= d.ajustes.creadoEn.slice(0, 10) || comparativaQuincenas([x], d)[0].gastado > 0).map((x) => {
          const c = comparativaQuincenas([x], d)[0];
          return { etiqueta: `${x.numero === 1 ? '1ª' : '2ª'} ${MESES[x.mes - 1]}`, ingreso: c.ingreso, gastado: c.gastado, ahorrado: c.ahorrado };
        })} />
      </section>
    </main>
  );
}

function ultimasQuincenas(ultima: Quincena, corte: number): Quincena[] {
  const qs: Quincena[] = [ultima];
  for (let i = 0; i < 5; i++) qs.unshift(quincenaAnterior(qs[0], corte));
  return qs;
}

function Heroe({ l, q, h }: { l: Libre; q: Quincena; h: string }) {
  const { abrirGasto } = useUi();
  const usado = l.presupuestoVariable > 0 ? Math.min(100, (l.gastadoVariable / l.presupuestoVariable) * 100) : 0;
  const marca = (l.diaActual / l.diasTotales) * 100;
  let mensaje: React.ReactNode;
  if (l.diaActual === 0) mensaje = <>La quincena empieza el {formatoFecha(q.inicio)}. Tendrás <strong className="num">{rd(l.libre)}</strong> libres para gastar.</>;
  else if (h > q.fin) mensaje = <>Quincena cerrada. Gastaste <strong className="num">{rd(l.gastadoVariable)}</strong> en variables de <strong className="num">{rd(l.presupuestoVariable)}</strong>.</>;
  else if (l.ritmo === 'excedido') mensaje = <span className="t-excedido">Te pasaste <strong className="num">{rd(-l.libre)}</strong> del dinero libre de esta quincena.</span>;
  else if (l.ritmo === 'alerta') mensaje = <span className="t-alerta">Alerta: llevas el {pct(l.presupuestoVariable ? l.gastadoVariable / l.presupuestoVariable : 1)} del presupuesto variable en el día {l.diaActual} de {l.diasTotales}.</span>;
  else mensaje = <>Vas <strong className="num t-ok">{rd(l.margen)}</strong> por debajo de tu límite ideal.</>;

  return (
    <section className={`heroe ${l.ritmo !== 'ok' && h <= q.fin && l.diaActual > 0 ? l.ritmo : ''}`} aria-label="Libre para gastar">
      <div className="fila" style={{ alignItems: 'flex-start' }}>
        <div className="etq">Libre para gastar</div>
        {l.diaActual > 0 && h <= q.fin && <span className="tag num">Día {l.diaActual}/{l.diasTotales}</span>}
      </div>
      <div className="cifra-grande" aria-live="polite">{rd(l.libre)}</div>
      <div className="diario">
        {l.diasRestantes > 0
          ? <><strong>{rd(Math.max(0, l.diario))}</strong><span>por día · {l.diasRestantes} {l.diasRestantes === 1 ? 'día restante' : 'días restantes'}</span></>
          : <span>Ingreso − fijos − meta de ahorro − gastos variables</span>}
      </div>
      <div className={`ritmo ${l.ritmo}`}>
        <div className="pista" role="progressbar" aria-label="Ritmo de gasto variable" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usado)}>
          <div className="relleno" style={{ width: `${usado}%` }} />
          {l.diaActual > 0 && h <= q.fin && <div className="marca-hoy" style={{ left: `calc(${marca}% - 1px)` }} title="Ritmo ideal a hoy" />}
        </div>
        <div className="leyenda"><span className="num">{rd(l.gastadoVariable)} gastado</span><span className="num">{rd(l.presupuestoVariable)} variable</span></div>
        <p className="mensaje">{mensaje}</p>
      </div>
      <div className="acciones-heroe">
        <button className="btn primario" onClick={() => abrirGasto(undefined, 'gasto')}>+ Gasto <kbd className="kbd-pista sec chico">N</kbd></button>
        <button className="btn secundario" onClick={() => abrirGasto(undefined, 'ingreso')}>+ Ingreso</button>
      </div>
    </section>
  );
}

function HeroeMes({ disponible: disp, ingreso, gastado }: { disponible: number; ingreso: number; gastado: number }) {
  const { abrirGasto } = useUi();
  return (
    <section className={`heroe ${disp < 0 ? 'excedido' : ''}`} aria-label="Disponible del mes">
      <div className="etq">Disponible del mes</div>
      <div className="cifra-grande">{rd(disp)}</div>
      <div className="diario"><span>Ingreso {rd(ingreso)} · gastado {rd(gastado)}</span></div>
      <div className="acciones-heroe">
        <button className="btn primario" onClick={() => abrirGasto(undefined, 'gasto')}>+ Gasto</button>
        <button className="btn secundario" onClick={() => abrirGasto(undefined, 'ingreso')}>+ Ingreso</button>
      </div>
    </section>
  );
}

function FilaCat({ f, mes, color }: { f: FilaCategoria; mes: boolean; color?: string }) {
  const mensual = f.categoria.modo === 'mensual' && !mes;
  return (
    <div className="cat-fila">
      <div className="fila">
        <span className="fila-wrap" style={{ gap: 8, minWidth: 0 }}>
          <span className="punto" style={{ background: color }} aria-hidden="true" />
          <span className="fuerte">{f.categoria.nombre}</span>
          {f.categoria.fijo && <span className="tag">fijo</span>}
        </span>
        <span className="fila-wrap" style={{ gap: 8 }}>
          <span className="num chico">{rd(f.gastado)}{f.presupuesto > 0 && <span className="sec"> / {rd(f.presupuesto)}</span>}</span>
          <EtiquetaEstado estado={f.estado} gastado={f.gastadoEvaluado} presupuesto={f.presupuestoEvaluado} />
        </span>
      </div>
      <Barra valor={f.gastadoEvaluado} maximo={f.presupuestoEvaluado} estado={f.estado} etiqueta={`${f.categoria.nombre}: ${rd(f.gastadoEvaluado)} de ${rd(f.presupuestoEvaluado)}`} />
      {mensual && f.presupuestoEvaluado > 0 && <p className="sec chico" style={{ marginTop: 4 }}>Provisión de la quincena {rd(f.presupuesto)}. En el mes: {rd(f.gastadoEvaluado)} de {rd(f.presupuestoEvaluado)}.</p>}
      {f.categoria.clave === 'servicios' && f.presupuestoEvaluado === 0 && <p className="sec chico" style={{ marginTop: 4 }}>Agrega tus servicios y suscripciones en el panel de abajo.</p>}
    </div>
  );
}

function Metodos({ d, periodo }: { d: TodosLosDatos; periodo: { inicio: string; fin: string } }) {
  const m = gastoPorMetodo(periodo, d);
  const total = m.efectivo + m.transferencia + m.tarjeta;
  return (
    <section className="tarjeta">
      <h2>Efectivo vs. tarjeta</h2>
      <div className="metodos">
        <div className="metodo"><div className="sec chico">Efectivo / débito</div><div className="val">{rd(m.efectivo)}</div></div>
        <div className="metodo"><div className="sec chico">Transferencia</div><div className="val">{rd(m.transferencia)}</div></div>
      </div>
      <div className="metodo tarjeta" style={{ marginTop: 8 }}>
        <div className="fila"><span className="sec chico">Tarjeta de crédito</span>{total > 0 && <span className="tag alerta">{pct(m.tarjeta / total)}</span>}</div>
        <div className="val t-alerta">{rd(m.tarjeta)}</div>
        <p className="sec chico">{m.tarjeta > 0 ? `Reserva ${rd(m.tarjeta)} para pagar el corte sin descuadrar la quincena.` : 'Sin consumos con tarjeta en este periodo.'}</p>
      </div>
    </section>
  );
}

function Suscripciones({ d }: { d: TodosLosDatos }) {
  const fijos = d.recurrentes.filter((r) => r.activo && r.frecuencia !== 'diaria-laboral');
  const mensual = fijos.reduce((s, r) => s + mensualEquivalente(r), 0);
  return (
    <section className="tarjeta">
      <div className="tarjeta-cab"><h2>Suscripciones y fijos</h2><a className="sec chico" href="#/ajustes">Administrar</a></div>
      {fijos.length === 0 ? <p className="sec">Agrega internet, celular, streaming o membresías en Ajustes.</p> : (
        <ul className="lista">
          {fijos.map((r) => (
            <li key={r.id} className="fila">
              <span style={{ minWidth: 0 }}><span>{r.nombre}</span><br /><span className="sec chico">{FRECUENCIA[r.frecuencia]}{r.automatico ? ' · automático' : ''}</span></span>
              <span className="num fuerte">{rd(r.monto)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="metodos" style={{ marginTop: 10 }}>
        <div className="metodo"><div className="sec chico">Por quincena</div><div className="val">{rd(mensual / 2)}</div></div>
        <div className="metodo"><div className="sec chico">Por mes</div><div className="val">{rd(mensual)}</div></div>
      </div>
    </section>
  );
}

/** Estado inicial: demostración o configuración en 2 pasos. También avisa cuando hay datos de demo. */
function Onboarding({ d }: { d: TodosLosDatos }) {
  const { avisar } = useUi();
  const [configurar, setConfigurar] = useState(false);
  const hayDemo = d.gastos.some((g) => g.origen === 'demo') || d.depositos.some((x) => x.demo) || d.ingresos.some((x) => x.demo);
  const hayReales = d.gastos.some((g) => g.origen !== 'demo') || d.depositos.some((x) => !x.demo);
  if (hayDemo) {
    return (
      <section className="tarjeta aviso demo" aria-label="Datos de demostración">
        <p>Estás viendo <strong>datos de demostración</strong>. Tus datos reales no se tocan.</p>
        <button className="btn" style={{ marginTop: 10 }} onClick={async () => { await quitarDemo(); avisar('Datos de demostración quitados'); }}>Quitar demostración</button>
      </section>
    );
  }
  if (hayReales) return null;
  return (
    <section className="tarjeta aviso" aria-label="Primeros pasos">
      <p className="fuerte">Todavía no hay movimientos.</p>
      <p className="sec" style={{ marginTop: 4 }}>Prueba las gráficas con una quincena de ejemplo o revisa tu configuración en 2 pasos.</p>
      <div className="fila-wrap" style={{ marginTop: 10 }}>
        <button className="btn" onClick={async () => { const n = await cargarDemo(hoy(), d.ajustes.diaPago1); avisar(`Demostración cargada (${n} gastos de ejemplo)`); }}>Cargar quincena de demostración</button>
        <button className="btn primario" onClick={() => setConfigurar(true)}>Configurar mi primera quincena</button>
      </div>
      {configurar && <Configurar d={d} onCerrar={() => setConfigurar(false)} />}
    </section>
  );
}

function Configurar({ d, onCerrar }: { d: TodosLosDatos; onCerrar: () => void }) {
  const { avisar } = useUi();
  const [paso, setPaso] = useState(1);
  const [ingreso, setIngreso] = useState(d.ajustes.ingresoQuincenal);
  const [pasaje, setPasaje] = useState(d.ajustes.pasajeDiario);
  const [b, setB] = useState({ ...d.ajustes.bloques });
  const suma = b.necesidades + b.estilo + b.ahorro;
  return (
    <Dialogo titulo={`Configurar (paso ${paso} de 2)`} onCerrar={onCerrar} acciones={paso === 1 ? <>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primario" disabled={!ingreso} onClick={() => setPaso(2)}>Siguiente</button>
    </> : <>
      <button className="btn" onClick={() => setPaso(1)}>Atrás</button>
      <button className="btn primario" disabled={suma !== 100} onClick={async () => {
        await db.ajustes.update('ajustes', { ingresoQuincenal: ingreso, pasajeDiario: pasaje, bloques: b });
        await db.recurrentes.update('rec-pasaje', { monto: pasaje });
        avisar('Configuración guardada'); onCerrar();
      }}>Guardar</button>
    </>}>
      {paso === 1 ? (
        <div className="pila">
          <label className="campo"><span>Ingreso neto por quincena (RD$)</span><CeldaNumero etiqueta="Ingreso neto por quincena" valor={ingreso} onCambio={setIngreso} /></label>
          <label className="campo"><span>Pasaje por día laborable (RD$)</span><CeldaNumero etiqueta="Pasaje diario" valor={pasaje} onCambio={setPasaje} /></label>
          <p className="sec chico">Los presupuestos por categoría y los gastos fijos los ajustas luego en Presupuesto y Ajustes.</p>
        </div>
      ) : (
        <div className="pila">
          <p className="sec">¿Cómo repartes el ingreso? Por defecto 50 / 30 / 20.</p>
          {(['necesidades', 'estilo', 'ahorro'] as Bloque[]).map((k) => (
            <label key={k} className="campo"><span>{NOMBRE_BLOQUE[k]} (%) · {rd((ingreso * b[k]) / 100)}</span><CeldaNumero etiqueta={`${NOMBRE_BLOQUE[k]} en porcentaje`} valor={b[k]} onCambio={(n) => setB({ ...b, [k]: n })} /></label>
          ))}
          <p className={suma === 100 ? 'sec chico' : 't-excedido chico'}>Suma: {suma}%{suma !== 100 ? ' (debe ser 100%)' : ''}</p>
        </div>
      )}
    </Dialogo>
  );
}

/** Cierre de quincena: depositar el sobrante o pasarlo a la quincena actual. */
export function AvisoCierre({ d }: { d: TodosLosDatos }) {
  const { avisar } = useUi();
  const h = hoy();
  const actual = quincenaDe(h, d.ajustes.diaPago1);
  const previa = quincenaAnterior(actual, d.ajustes.diaPago1);
  const clave = claveQuincena(previa);
  const resto = disponible(previa, d);
  if (d.ajustes.cierresVistos.includes(clave) || resto <= 0 || previa.fin < d.ajustes.creadoEn.slice(0, 10)) return null;
  const marcar = () => db.ajustes.update('ajustes', { cierresVistos: [...d.ajustes.cierresVistos, clave] });
  return (
    <section className="tarjeta aviso" aria-label="Cierre de quincena">
      <p>La quincena {formatoQuincena(previa)} cerró con <strong className="num t-ok">{rd(resto)}</strong> sin usar. ¿Qué hacemos con ese dinero?</p>
      <div className="fila-wrap" style={{ marginTop: 10 }}>
        <button className="btn primario" onClick={async () => {
          await db.depositos.add({ id: nuevoId(), fecha: previa.fin, monto: resto, nota: 'Sobrante de quincena', metaId: d.metas[0]?.id });
          await marcar();
          avisar(`Depósito de ${rd(resto)} registrado`);
        }}>Ahorrarlo</button>
        <button className="btn" onClick={async () => {
          await db.ingresos.add({ id: nuevoId(), fecha: actual.inicio, monto: resto, nota: 'Saldo de la quincena anterior' });
          await marcar();
          avisar(`${rd(resto)} pasados a esta quincena`);
        }}>Pasarlo a esta quincena</button>
        <button className="btn plano" onClick={marcar}>Empezar en cero</button>
      </div>
    </section>
  );
}

function AvisoRespaldo({ d }: { d: TodosLosDatos }) {
  const desde = (d.ajustes.ultimoRespaldo ?? d.ajustes.creadoEn).slice(0, 10);
  const dias = diasEntre(desde, hoy());
  if (dias < 15 || d.gastos.filter((g) => g.origen !== 'demo').length + d.depositos.length === 0) return null;
  return (
    <section className="tarjeta aviso alerta" aria-label="Recordatorio de respaldo">
      <p>{d.ajustes.ultimoRespaldo ? `Hace ${dias} días que no haces un respaldo.` : 'Todavía no has hecho un respaldo de tus datos.'} Tus datos viven solo en este dispositivo.</p>
      <a className="btn" href="#/ajustes" style={{ marginTop: 10 }}>Hacer respaldo</a>
    </section>
  );
}

export { ahorrado };
