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
            <rect x={i * paso + paso * 0.2} width={paso * 0.6} y={y(p.valor)} height={Math.max(0, H - pie - y(p.valor))} rx="2" fill="var(--barra-neutra)" opacity="0.55" />
            <text x={(i + 0.5) * paso} y={H - 5} textAnchor="middle">{p.etiqueta}</text>
          </g>
        ))}
        <path d={linea} fill="none" stroke="var(--acento)" strokeWidth="2.5" strokeLinejoin="round" />
        {puntos.map((p, i) => <circle key={i} cx={(i + 0.5) * paso} cy={y(p.acumulado)} r="3" fill="var(--acento)" />)}
        <text x={W - 2} y={10} textAnchor="end">{rd(ultimo.acumulado)}</text>
      </svg>
      <figcaption className="sec chico">Columnas: depositado en el periodo. Línea: acumulado.</figcaption>
    </figure>
  );
}
