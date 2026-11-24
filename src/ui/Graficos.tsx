import { rd } from '../lib/formato';

export function BarrasH({ filas, titulo }: { filas: { nombre: string; valor: number }[]; titulo: string }) {
  const datos = filas.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  if (datos.length === 0) return <p className="sec">Cuando registres gastos verás aquí cuánto va a cada categoría.</p>;
  const max = Math.max(...datos.map((f) => f.valor));
  return (
    <div className="grafico-h" role="img" aria-label={`${titulo}: ${datos.map((f) => `${f.nombre} ${rd(f.valor)}`).join(', ')}`}>
      {datos.map((f) => (
        <div className="g-fila" key={f.nombre} aria-hidden="true">
          <span className="nom">{f.nombre}</span>
          <span className="g-barra"><span style={{ width: `${(f.valor / max) * 100}%` }} /></span>
          <span className="num">{rd(f.valor)}</span>
        </div>
      ))}
    </div>
  );
}

/** Columnas (aporte del periodo) con una línea de acumulado. */
export function ColumnasAcumulado({ puntos, titulo }: { puntos: { etiqueta: string; valor: number; acumulado: number }[]; titulo: string }) {
  if (puntos.every((p) => p.acumulado === 0)) return <p className="sec">Tus depósitos de ahorro se verán aquí, periodo por periodo.</p>;
  const W = 320, H = 150, pie = 18, arriba = 14;
  const max = Math.max(1, ...puntos.map((p) => p.acumulado), ...puntos.map((p) => p.valor));
  const paso = W / puntos.length;
  const y = (v: number) => arriba + (H - pie - arriba) * (1 - v / max);
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${(i + 0.5) * paso},${y(p.acumulado)}`).join(' ');
  const ultimo = puntos[puntos.length - 1];
  return (
    <figure className="grafico-v" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. Acumulado actual ${rd(ultimo.acumulado)}.`}>
        <line x1="0" x2={W} y1={H - pie} y2={H - pie} stroke="var(--borde)" />
        {puntos.map((p, i) => (
          <g key={i}>
            <rect x={i * paso + paso * 0.2} width={paso * 0.6} y={y(p.valor)} height={Math.max(0, H - pie - y(p.valor))} rx="2" fill="var(--azul)" opacity="0.45" />
            <text x={(i + 0.5) * paso} y={H - 5} textAnchor="middle">{p.etiqueta}</text>
          </g>
        ))}
        <path d={linea} fill="none" stroke="var(--azul)" strokeWidth="2.5" strokeLinejoin="round" />
        {puntos.map((p, i) => <circle key={i} cx={(i + 0.5) * paso} cy={y(p.acumulado)} r="3" fill="var(--azul)" />)}
        <text x={W - 2} y={10} textAnchor="end">{rd(ultimo.acumulado)}</text>
      </svg>
      <figcaption className="sec chico">Columnas: depositado en el periodo. Línea: acumulado.</figcaption>
    </figure>
  );
}

export const COLORES_CATEGORIA = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa', '#ec4899', '#22d3ee', '#f97316', '#84cc16'];

/** Dona de distribución por categoría, en SVG nativo. */
export function Dona({ filas, titulo }: { filas: { nombre: string; valor: number; color: string }[]; titulo: string }) {
  const datos = filas.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = datos.reduce((s, f) => s + f.valor, 0);
  if (total === 0) return <p className="sec">Cuando registres gastos verás aquí cómo se reparten por categoría.</p>;
  const R = 52, C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <div className="dona-caja">
      <svg viewBox="0 0 132 132" role="img" aria-label={`${titulo}: ${datos.map((f) => `${f.nombre} ${Math.round((f.valor / total) * 100)}%`).join(', ')}`}>
        <circle cx="66" cy="66" r={R} fill="none" stroke="var(--barra-fondo)" strokeWidth="16" />
        {datos.map((f) => {
          const largo = (f.valor / total) * C;
          const el = (
            <circle key={f.nombre} cx="66" cy="66" r={R} fill="none" stroke={f.color} strokeWidth="16"
              strokeDasharray={`${Math.max(0, largo - (datos.length > 1 ? 2 : 0))} ${C}`} strokeDashoffset={-acumulado} transform="rotate(-90 66 66)" />
          );
          acumulado += largo;
          return el;
        })}
        <text x="66" y="62" textAnchor="middle" className="svg-texto" style={{ fontSize: 9 }}>TOTAL</text>
        <text x="66" y="78" textAnchor="middle" style={{ fill: 'var(--texto)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fuente-num)' }}>{rd(total)}</text>
      </svg>
      <ul className="leyenda-lista" aria-hidden="true">
        {datos.map((f) => (
          <li key={f.nombre}>
            <span className="punto" style={{ background: f.color }} />
            <span className="nom">{f.nombre}</span>
            <span className="num">{Math.round((f.valor / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Gasto por día de la quincena con la línea del ritmo ideal. */
export function BarrasDiarias({ serie, idealPorDia, hoyFecha, titulo }: { serie: { fecha: string; monto: number }[]; idealPorDia: number; hoyFecha: string; titulo: string }) {
  if (serie.every((p) => p.monto === 0)) return <p className="sec">Aquí verás cuánto gastas cada día de la quincena.</p>;
  const W = 320, H = 130, pie = 16, arriba = 8;
  const max = Math.max(1, idealPorDia, ...serie.map((p) => p.monto));
  const paso = W / serie.length;
  const y = (v: number) => arriba + (H - pie - arriba) * (1 - v / max);
  return (
    <figure className="grafico-v" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. ${serie.filter((p) => p.monto > 0).map((p) => `${p.fecha.slice(8)}: ${rd(p.monto)}`).join(', ')}`}>
        {serie.map((p, i) => {
          const futuro = p.fecha > hoyFecha;
          const color = p.monto > idealPorDia * 1.5 ? 'var(--ambar)' : 'var(--verde)';
          return (
            <g key={p.fecha}>
              <rect x={i * paso + paso * 0.18} width={paso * 0.64} y={y(p.monto)} height={Math.max(p.monto > 0 ? 2 : 0, H - pie - y(p.monto))} rx="2" fill={color} opacity={futuro ? 0.3 : 0.9} />
              {(i % 2 === 0 || serie.length <= 8) && <text x={(i + 0.5) * paso} y={H - 3} textAnchor="middle">{Number(p.fecha.slice(8))}</text>}
            </g>
          );
        })}
        {idealPorDia > 0 && <line x1="0" x2={W} y1={y(idealPorDia)} y2={y(idealPorDia)} stroke="var(--texto-3)" strokeDasharray="4 4" />}
      </svg>
      <div className="leyenda-inline"><span><span className="punto" style={{ background: 'var(--verde)' }} />Gasto del día</span><span>– – Ritmo ideal ({rd(idealPorDia)}/día)</span></div>
    </figure>
  );
}

/** Ingreso vs. gasto vs. ahorro de las últimas quincenas. */
export function Comparativa({ datos, titulo }: { datos: { etiqueta: string; ingreso: number; gastado: number; ahorrado: number }[]; titulo: string }) {
  if (datos.every((p) => p.gastado === 0 && p.ahorrado === 0)) return <p className="sec">Cuando tengas movimientos en varias quincenas podrás compararlas aquí.</p>;
  const W = 320, H = 150, pie = 18, arriba = 8;
  const max = Math.max(1, ...datos.flatMap((p) => [p.ingreso, p.gastado, p.ahorrado]));
  const grupo = W / datos.length, ancho = (grupo * 0.72) / 3;
  const y = (v: number) => arriba + (H - pie - arriba) * (1 - v / max);
  const series: [keyof (typeof datos)[number], string][] = [['ingreso', 'var(--verde)'], ['gastado', 'var(--rojo)'], ['ahorrado', 'var(--azul)']];
  return (
    <figure className="grafico-v" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}. ${datos.map((p) => `${p.etiqueta}: ingreso ${rd(p.ingreso)}, gasto ${rd(p.gastado)}, ahorro ${rd(p.ahorrado)}`).join('; ')}`}>
        <line x1="0" x2={W} y1={H - pie} y2={H - pie} stroke="var(--borde)" />
        {datos.map((p, i) => (
          <g key={p.etiqueta}>
            {series.map(([k, color], j) => {
              const v = p[k] as number;
              return <rect key={k} x={i * grupo + grupo * 0.14 + j * ancho} width={ancho - 1} y={y(v)} height={Math.max(0, H - pie - y(v))} rx="1.5" fill={color} opacity="0.9" />;
            })}
            <text x={(i + 0.5) * grupo} y={H - 4} textAnchor="middle">{p.etiqueta}</text>
          </g>
        ))}
      </svg>
      <div className="leyenda-inline">
        <span><span className="punto" style={{ background: 'var(--verde)' }} />Ingreso</span>
        <span><span className="punto" style={{ background: 'var(--rojo)' }} />Gasto</span>
        <span><span className="punto" style={{ background: 'var(--azul)' }} />Ahorro</span>
      </div>
    </figure>
  );
}
