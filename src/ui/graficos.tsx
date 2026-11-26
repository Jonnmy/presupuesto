// Gráficos en SVG nativo (sin librerías, funcionan sin internet). Cada uno tiene descripción accesible.
import { dinero } from '../nucleo/dinero';
import { fmtCorta } from '../nucleo/fechas';

const corto = (c: number) => dinero(c, { corto: true });
/** 12,345 → "12.3k" para ejes. */
function eje(c: number) {
  const v = c / 100;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

function Rejilla({ max, W, H, arriba, abajo, izq }: { max: number; W: number; H: number; arriba: number; abajo: number; izq: number }) {
  const lineas = [0, 0.5, 1];
  return (
    <g>
      {lineas.map((f) => {
        const y = arriba + (H - arriba - abajo) * (1 - f);
        return (
          <g key={f}>
            <line x1={izq} x2={W} y1={y} y2={y} className="g-rejilla" />
            <text x={izq - 4} y={y + 3} textAnchor="end" className="g-eje">{eje(max * f)}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Ingresos frente a gastos por tramo (días, semanas o meses). */
export function BarrasIngresoGasto({ datos, titulo }: { datos: { etiqueta: string; ingresos: number; gastos: number }[]; titulo: string }) {
  if (datos.every((d) => d.ingresos === 0 && d.gastos === 0)) return <p className="sec g-vacio">Sin ingresos ni gastos en este período.</p>;
  const W = 360, H = 170, arriba = 8, abajo = 18, izq = 30;
  const max = Math.max(1, ...datos.flatMap((d) => [d.ingresos, d.gastos]));
  const paso = (W - izq) / datos.length;
  const ancho = Math.max(2, Math.min(14, paso * 0.36));
  const y = (v: number) => arriba + (H - arriba - abajo) * (1 - v / max);
  const cadaN = Math.ceil(datos.length / 10);
  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. ${datos.filter((d) => d.ingresos || d.gastos).map((d) => `${d.etiqueta}: ingresos ${corto(d.ingresos)}, gastos ${corto(d.gastos)}`).join('; ')}`}>
        <Rejilla max={max} W={W} H={H} arriba={arriba} abajo={abajo} izq={izq} />
        {datos.map((d, i) => {
          const cx = izq + paso * (i + 0.5);
          return (
            <g key={i}>
              <rect x={cx - ancho - 1} width={ancho} y={y(d.ingresos)} height={H - abajo - y(d.ingresos)} rx="2" className="g-ingreso"><title>{`${d.etiqueta} · ingresos ${corto(d.ingresos)}`}</title></rect>
              <rect x={cx + 1} width={ancho} y={y(d.gastos)} height={H - abajo - y(d.gastos)} rx="2" className="g-gasto"><title>{`${d.etiqueta} · gastos ${corto(d.gastos)}`}</title></rect>
              {i % cadaN === 0 && <text x={cx} y={H - 4} textAnchor="middle" className="g-eje">{d.etiqueta}</text>}
            </g>
          );
        })}
      </svg>
      <figcaption className="leyenda"><span><i className="pt ingreso" />Ingresos</span><span><i className="pt gasto" />Gastos</span></figcaption>
    </figure>
  );
}

/** Distribución de gastos por categoría. */
export function Dona({ filas, titulo }: { filas: { nombre: string; valor: number; color: string }[]; titulo: string }) {
  const datos = filas.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = datos.reduce((s, f) => s + f.valor, 0);
  if (!total) return <p className="sec g-vacio">Cuando registres gastos verás cómo se reparten.</p>;
  const R = 50, C = 2 * Math.PI * R;
  let ac = 0;
  const principales = datos.slice(0, 6);
  const resto = datos.slice(6).reduce((s, f) => s + f.valor, 0);
  const leyenda = resto ? [...principales, { nombre: 'Otras', valor: resto, color: 'var(--texto-3)' }] : principales;
  return (
    <div className="dona">
      <svg viewBox="0 0 128 128" role="img" aria-label={`${titulo}: ${datos.map((f) => `${f.nombre} ${Math.round((f.valor / total) * 100)}%`).join(', ')}`}>
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--barra-fondo)" strokeWidth="14" />
        {datos.map((f) => {
          const largo = (f.valor / total) * C;
          const el = <circle key={f.nombre} cx="64" cy="64" r={R} fill="none" stroke={f.color} strokeWidth="14" strokeDasharray={`${Math.max(0, largo - (datos.length > 1 ? 1.5 : 0))} ${C}`} strokeDashoffset={-ac} transform="rotate(-90 64 64)"><title>{`${f.nombre}: ${corto(f.valor)}`}</title></circle>;
          ac += largo;
          return el;
        })}
        <text x="64" y="60" textAnchor="middle" className="g-eje">TOTAL</text>
        <text x="64" y="76" textAnchor="middle" className="g-total">{corto(total)}</text>
      </svg>
      <ul className="dona-leyenda">
        {leyenda.map((f) => (
          <li key={f.nombre}><i className="pt" style={{ background: f.color }} /><span className="nom">{f.nombre}</span><span className="num sec">{Math.round((f.valor / total) * 100)}%</span><span className="num">{corto(f.valor)}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Gasto acumulado a lo largo del período, con la línea del presupuesto si existe. */
export function Evolucion({ puntos, presupuesto, hoy, titulo }: { puntos: { fecha: string; acumulado: number }[]; presupuesto?: number; hoy: string; titulo: string }) {
  if (!puntos.length || puntos[puntos.length - 1].acumulado === 0) return <p className="sec g-vacio">Aquí verás cómo crece tu gasto día a día.</p>;
  const W = 360, H = 170, arriba = 8, abajo = 18, izq = 30;
  const visibles = puntos.filter((p) => p.fecha <= hoy);
  const max = Math.max(1, presupuesto ?? 0, ...puntos.map((p) => p.acumulado));
  const x = (i: number) => izq + ((W - izq - 4) * i) / Math.max(1, puntos.length - 1);
  const y = (v: number) => arriba + (H - arriba - abajo) * (1 - v / max);
  const linea = visibles.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.acumulado)}`).join(' ');
  const area = visibles.length ? `${linea} L${x(visibles.length - 1)},${H - abajo} L${x(0)},${H - abajo} Z` : '';
  const ultimo = visibles[visibles.length - 1] ?? puntos[0];
  const marcas = [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1];
  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. Acumulado ${corto(ultimo.acumulado)}${presupuesto ? ` de un presupuesto de ${corto(presupuesto)}` : ''}.`}>
        <Rejilla max={max} W={W} H={H} arriba={arriba} abajo={abajo} izq={izq} />
        {presupuesto ? <><line x1={izq} x2={W} y1={y(presupuesto)} y2={y(presupuesto)} className="g-limite" /><line x1={x(0)} y1={y(0)} x2={x(puntos.length - 1)} y2={y(presupuesto)} className="g-ideal" /></> : null}
        <path d={area} className="g-area" />
        <path d={linea} className="g-linea" />
        {visibles.length > 0 && <circle cx={x(visibles.length - 1)} cy={y(ultimo.acumulado)} r="3.5" className="g-punto" />}
        {marcas.map((i) => <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'} className="g-eje">{fmtCorta(puntos[i].fecha)}</text>)}
      </svg>
      <figcaption className="leyenda"><span><i className="pt gasto" />Gasto acumulado</span>{presupuesto ? <><span><i className="raya" />Presupuesto</span><span><i className="raya punteada" />Ritmo ideal</span></> : null}</figcaption>
    </figure>
  );
}

/** Presupuesto usado frente a disponible, por categoría. */
export function UsoPresupuesto({ filas }: { filas: { nombre: string; usado: number; pendiente: number; limite: number }[] }) {
  if (!filas.length) return <p className="sec g-vacio">Define límites por categoría para comparar lo usado con lo disponible.</p>;
  return (
    <div className="uso">
      {filas.map((f) => {
        const max = Math.max(f.limite, f.usado + f.pendiente);
        const u = max > 0 ? (f.usado / max) * 100 : 0;
        const p = max > 0 ? (f.pendiente / max) * 100 : 0;
        const exc = f.usado + f.pendiente > f.limite;
        return (
          <div key={f.nombre} className="uso-fila">
            <div className="fila"><span>{f.nombre}</span><span className="num chico"><span className={exc ? 't-peligro' : ''}>{corto(f.usado + f.pendiente)}</span><span className="sec"> / {corto(f.limite)}</span></span></div>
            <div className="uso-barra" role="img" aria-label={`${f.nombre}: usado ${corto(f.usado)}, pendiente ${corto(f.pendiente)}, límite ${corto(f.limite)}`}>
              <span className={`u ${exc ? 'exc' : ''}`} style={{ width: `${u}%` }} />
              <span className="p" style={{ width: `${p}%` }} />
              {exc && <span className="limite" style={{ left: `${(f.limite / max) * 100}%` }} />}
            </div>
          </div>
        );
      })}
      <div className="leyenda"><span><i className="pt gasto" />Usado</span><span><i className="pt pend" />Pendiente</span><span><i className="pt libre" />Disponible</span></div>
    </div>
  );
}

/** Línea simple (evolución del ahorro). */
export function Linea({ puntos, titulo, clase = 'ahorro' }: { puntos: { etiqueta: string; valor: number }[]; titulo: string; clase?: string }) {
  if (puntos.every((p) => p.valor === 0)) return <p className="sec g-vacio">Sin datos todavía.</p>;
  const W = 360, H = 150, arriba = 8, abajo = 18, izq = 30;
  const max = Math.max(1, ...puntos.map((p) => p.valor));
  const x = (i: number) => izq + ((W - izq - 8) * i) / Math.max(1, puntos.length - 1);
  const y = (v: number) => arriba + (H - arriba - abajo) * (1 - Math.max(0, v) / max);
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.valor)}`).join(' ');
  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. ${puntos.map((p) => `${p.etiqueta}: ${corto(p.valor)}`).join(', ')}`}>
        <Rejilla max={max} W={W} H={H} arriba={arriba} abajo={abajo} izq={izq} />
        <path d={d} className={`g-linea ${clase}`} />
        {puntos.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.valor)} r="3" className={`g-punto ${clase}`}><title>{`${p.etiqueta}: ${corto(p.valor)}`}</title></circle>)}
        {puntos.map((p, i) => (puntos.length <= 8 || i % Math.ceil(puntos.length / 8) === 0) && <text key={`t${i}`} x={x(i)} y={H - 4} textAnchor="middle" className="g-eje">{p.etiqueta}</text>)}
      </svg>
    </figure>
  );
}
