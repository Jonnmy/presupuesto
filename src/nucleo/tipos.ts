// Modelo de datos. Todos los montos son ENTEROS en centavos (RD$1,000.00 = 100000) para evitar errores de redondeo.
// Las fechas son textos AAAA-MM-DD en la zona horaria configurada.

export type Id = string;
export type Centavos = number;

export type TipoCuenta = 'efectivo' | 'banco' | 'ahorro' | 'billetera' | 'tarjeta';

export interface Cuenta {
  id: Id;
  nombre: string;
  tipo: TipoCuenta;
  /** Saldo el día `fechaInicial`. En tarjetas es negativo: lo que se debe. */
  saldoInicial: Centavos;
  fechaInicial: string;
  /** Solo tarjetas de crédito. */
  limite?: Centavos;
  diaCorte?: number;
  diaPago?: number;
  archivada?: boolean;
  orden: number;
  creadoEn: string;
}

/**
 * ingreso: entra dinero a `cuentaId`.
 * gasto: sale dinero de `cuentaId` (si es tarjeta, aumenta su deuda).
 * transferencia: de `cuentaId` a `cuentaDestinoId`. No es ingreso ni gasto (pagar la tarjeta es una transferencia).
 * aporte / retiro: dinero que pasa de una cuenta a una meta de ahorro, o vuelve.
 * pagoDeuda: abono a un préstamo; baja el saldo de la cuenta y el de la deuda. Cuenta como gasto en la categoría Deudas.
 */
export type TipoMovimiento = 'ingreso' | 'gasto' | 'transferencia' | 'aporte' | 'retiro' | 'pagoDeuda';
export type Clase = 'fijo' | 'variable' | 'extraordinario';
export type Frecuencia = 'unica' | 'semanal' | 'quincenal' | 'mensual' | 'anual' | 'personalizada';
export type Metodo = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro';
export type Estado = 'pagado' | 'pendiente';

export interface Movimiento {
  id: Id;
  tipo: TipoMovimiento;
  nombre: string;
  monto: Centavos;
  fecha: string;
  cuentaId?: Id;
  cuentaDestinoId?: Id;
  categoriaId?: Id;
  subcategoria?: string;
  metodo?: Metodo;
  clase?: Clase;
  /** Los pendientes no tocan los saldos: son compromisos. Solo aplica a gastos. */
  estado: Estado;
  frecuencia?: Frecuencia;
  fuente?: string;
  notas?: string;
  /** Si viene de un compromiso o cobro programado: cuál y qué fecha de vencimiento cubre. */
  programadoId?: Id;
  ocurrencia?: string;
  deudaId?: Id;
  metaId?: Id;
  creadoEn: string;
  actualizadoEn?: string;
}

export interface Categoria {
  id: Id;
  nombre: string;
  tipo: 'gasto' | 'ingreso';
  color: string;
  subcategorias: string[];
  orden: number;
  archivada?: boolean;
}

/** Compromiso (gasto que se repite) o cobro programado (ingreso que se repite). */
export interface Programado {
  id: Id;
  tipo: 'gasto' | 'ingreso';
  nombre: string;
  monto: Centavos;
  frecuencia: Frecuencia;
  /** personalizada: cada cuántos días. */
  cadaDias?: number;
  /** quincenal: los dos días del mes en que ocurre (31 = último día). */
  diasQuincena?: [number, number];
  /** mensual/anual: día original (para no "encogerse" después de febrero). */
  diaMes?: number;
  proximaFecha: string;
  categoriaId?: Id;
  cuentaId?: Id;
  metodo?: Metodo;
  clase: Clase;
  fuente?: string;
  /** Avisar cuántos días antes del vencimiento. */
  avisoDias: number;
  activo: boolean;
  notas?: string;
  creadoEn: string;
}

export interface Deuda {
  id: Id;
  nombre: string;
  acreedor: string;
  montoOriginal: Centavos;
  /** Lo que faltaba por pagar al registrarla. El saldo actual resta los abonos registrados. */
  saldoInicial: Centavos;
  cuota: Centavos;
  diaVencimiento?: number;
  tasaAnual?: number;
  fechaInicio: string;
  notas?: string;
  archivada?: boolean;
  creadoEn: string;
}

export interface Meta {
  id: Id;
  nombre: string;
  objetivo: Centavos;
  /** Lo que ya tenía ahorrado al crearla. */
  saldoInicial: Centavos;
  fechaLimite?: string;
  fechaCreacion: string;
  descripcion?: string;
  archivada?: boolean;
}

export type TipoPeriodo = 'semanal' | 'quincenal' | 'mensual' | 'personalizado';

export interface VersionPresupuesto {
  /** Aplica a los períodos que empiezan en esta fecha o después. Así los períodos anteriores no cambian al editar. */
  desde: string;
  total: Centavos;
  limites: Record<Id, Centavos>;
}

export interface Presupuesto {
  id: Id;
  nombre: string;
  periodo: TipoPeriodo;
  /** Solo personalizado. */
  inicio?: string;
  fin?: string;
  versiones: VersionPresupuesto[];
  activo: boolean;
  creadoEn: string;
}

export interface Ajustes {
  id: 'ajustes';
  moneda: string;
  simbolo: string;
  decimales: 0 | 2;
  formatoFecha: 'DD/MM/AAAA' | 'MM/DD/AAAA' | 'AAAA-MM-DD';
  zona: string;
  tema: 'oscuro' | 'claro' | 'sistema';
  /** 1 = lunes, 0 = domingo. */
  inicioSemana: 0 | 1;
  /** Días del mes en que empiezan las dos quincenas (1 y 16 = 1–15 y 16–fin). */
  quincena: { dia1: number; dia2: number };
  alertas: { presupuestoPct: number; diasPago: number; saldoBajo: Centavos; metaPct: number };
  ultimoRespaldo?: string;
  creadoEn: string;
}

export interface Datos {
  ajustes: Ajustes;
  cuentas: Cuenta[];
  categorias: Categoria[];
  movimientos: Movimiento[];
  programados: Programado[];
  deudas: Deuda[];
  metas: Meta[];
  presupuestos: Presupuesto[];
}

export interface Rango { inicio: string; fin: string }
