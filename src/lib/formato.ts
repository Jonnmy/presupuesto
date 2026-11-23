const numero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** RD$22,000 — sin decimales, redondeando solo al mostrar. */
export function rd(monto: number): string {
  const r = Math.round(monto);
  return `${r < 0 ? '−' : ''}RD$${numero.format(Math.abs(r))}`;
}

/** 22,000 (sin prefijo) */
export function num(monto: number): string {
  return numero.format(Math.round(monto));
}

export function pct(fraccion: number): string {
  return `${Math.round(fraccion * 100)}%`;
}

/** Interpreta lo que escribe el usuario ("1,250", "1250 ") como entero en pesos. */
export function leerMonto(texto: string): number {
  const limpio = texto.replace(/[^\d.]/g, '');
  const n = Math.round(Number(limpio));
  return Number.isFinite(n) ? n : 0;
}

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
