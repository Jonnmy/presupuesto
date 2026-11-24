export type Id = string;

export interface Ajustes {
  id: 'ajustes';
  ingresoQuincenal: number;
  /** Pantalla sencilla: lo que se aparta cada quincena. */
  apartados?: { id: string; nombre: string; monto: number }[];
  ingresoMensualReferencia?: number;
  diaPago1: number; // último día de la quincena 1 (por defecto 15)
  diaPago2: 'fin';
  pasajeDiario: number;
  diasLaborables: number[]; // 0=domingo … 6=sábado
  transporteModo: 'calendario' | 'fijo';
  transporteFijoQuincena: number;
  tema: 'sistema' | 'claro' | 'oscuro';
  ultimoRespaldo?: string;
  creadoEn: string;
  cierresVistos: string[]; // claves de quincena cuyo aviso de cierre ya se atendió
  /** Reparto del ingreso por bloques, en porcentaje (deben sumar 100). */
  bloques: Record<Bloque, number>;
}

export type Bloque = 'necesidades' | 'estilo' | 'ahorro';

/** Rol fijo de algunas categorías, para cálculos especiales. */
export type ClaveCategoria = 'dieta' | 'suplementos' | 'gimnasio' | 'transporte' | 'personal' | 'ropa' | 'otros' | 'ahorro' | 'servicios';

export interface Categoria {
  id: Id;
  nombre: string;
  tipo: 'gasto' | 'ahorro';
  modo: 'quincenal' | 'mensual' | 'unico';
  presupuestoQuincenal: number;
  presupuestoMensual?: number;
  orden: number;
  activa: boolean;
  clave?: ClaveCategoria;
  /** Bloque del reparto 50/30/20 al que pertenece. */
  bloque?: Bloque;
  /** Gasto fijo comprometido (membresías, servicios). Los demás son variables. */
  fijo?: boolean;
}

export type Metodo = 'efectivo' | 'tarjeta' | 'transferencia';

export interface Gasto {
  id: Id;
  fecha: string;
  monto: number;
  categoriaId: Id;
  nota?: string;
  metodo?: Metodo;
  origen: 'manual' | 'recurrente' | 'compra-sirena' | 'demo';
  recurrenteId?: Id;
  creadoEn: string;
}

export interface Ingreso {
  id: Id;
  fecha: string;
  monto: number;
  nota?: string;
  demo?: boolean;
}

export interface Recurrente {
  id: Id;
  nombre: string;
  categoriaId: Id;
  monto: number;
  /** quincenal: el día `diaDelMes` de la 1ª quincena y el mismo día contado desde el corte en la 2ª. */
  frecuencia: 'diaria-laboral' | 'quincenal' | 'mensual' | 'cada-n-meses';
  diaDelMes?: number;
  cadaNMeses?: number;
  automatico: boolean;
  activo: boolean;
  /** Fecha desde la que se generan automáticamente (se fija al activar el modo automático). */
  desde?: string;
}

export interface DiaLibre {
  fecha: string;
  motivo?: string;
}

export interface ProductoSirena {
  id: Id;
  nombre: string;
  precio: number;
  unidad: string;
  cantidadQuincena: number;
  cantidadMes: number;
  nota?: string;
  activo: boolean;
  orden: number;
}

export interface CompraSirena {
  id: Id;
  fecha: string;
  estimado: number;
  real: number;
  gastoId: Id;
}

export interface MetaAhorro {
  id: Id;
  nombre: string;
  objetivo: number;
  fechaObjetivo?: string;
}

export interface DepositoAhorro {
  id: Id;
  fecha: string;
  monto: number;
  metaId?: Id;
  nota?: string;
  demo?: boolean;
}

/** Gasto único que se planifica para una fecha (p. ej., inscripción del gimnasio). Baja la meta de ahorro de su quincena. */
export interface GastoPlanificado {
  id: Id;
  nombre: string;
  monto: number;
  fecha: string;
  categoriaId?: Id;
}

export interface Quincena {
  inicio: string;
  fin: string;
  numero: 1 | 2;
  anio: number;
  mes: number; // 1..12
}

export interface Mes {
  anio: number;
  mes: number;
}

/** Datos que necesitan los cálculos. */
export interface Datos {
  ajustes: Ajustes;
  categorias: Categoria[];
  gastos: Gasto[];
  ingresos: Ingreso[];
  depositos: DepositoAhorro[];
  diasLibres: DiaLibre[];
  planificados: GastoPlanificado[];
}
