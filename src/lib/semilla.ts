// Datos iniciales (sección 10). Sin gastos, ingresos ni depósitos de ejemplo.
import type { Ajustes, Categoria, GastoPlanificado, MetaAhorro, ProductoSirena, Recurrente } from './tipos';

export const ID = {
  dieta: 'cat-dieta',
  gimnasio: 'cat-gimnasio',
  transporte: 'cat-transporte',
  personal: 'cat-personal',
  ahorro: 'cat-ahorro',
  recPasaje: 'rec-pasaje',
  recGimnasio: 'rec-gimnasio',
} as const;

/** Categorías y recurrentes que existían en la v1 y se quitaron. */
export const RETIRADOS = {
  categorias: ['cat-suplementos', 'cat-ropa', 'cat-otros'],
  recurrentes: ['rec-whey', 'rec-creatina'],
};

export function ajustesIniciales(ahoraISO: string): Ajustes {
  return {
    id: 'ajustes',
    ingresoQuincenal: 22000,
    ingresoMensualReferencia: 50040,
    diaPago1: 15,
    diaPago2: 'fin',
    pasajeDiario: 280,
    diasLaborables: [1, 2, 3, 4, 5, 6],
    transporteModo: 'calendario',
    transporteFijoQuincena: 3640,
    tema: 'sistema',
    creadoEn: ahoraISO,
    cierresVistos: [],
  };
}

export function categoriasIniciales(): Categoria[] {
  return [
    { id: ID.dieta, clave: 'dieta', nombre: 'Dieta (Sirena)', tipo: 'gasto', modo: 'quincenal', presupuestoQuincenal: 3974, presupuestoMensual: 7515, orden: 1, activa: true },
    { id: ID.gimnasio, clave: 'gimnasio', nombre: 'Gimnasio', tipo: 'gasto', modo: 'mensual', presupuestoQuincenal: 1400, presupuestoMensual: 2800, orden: 3, activa: true },
    { id: ID.transporte, clave: 'transporte', nombre: 'Transporte', tipo: 'gasto', modo: 'quincenal', presupuestoQuincenal: 3640, presupuestoMensual: 7280, orden: 4, activa: true },
    { id: ID.personal, clave: 'personal', nombre: 'Gastos personales', tipo: 'gasto', modo: 'quincenal', presupuestoQuincenal: 3500, presupuestoMensual: 7000, orden: 5, activa: true },
    { id: ID.ahorro, clave: 'ahorro', nombre: 'Ahorro', tipo: 'ahorro', modo: 'quincenal', presupuestoQuincenal: 9486, presupuestoMensual: 18972, orden: 8, activa: true },
  ];
}

export function catalogoInicial(): ProductoSirena[] {
  const p = (orden: number, nombre: string, precio: number, unidad: string, cantidadQuincena: number, cantidadMes: number, nota?: string): ProductoSirena =>
    ({ id: `prod-${orden}`, nombre, precio, unidad, cantidadQuincena, cantidadMes, nota, activo: true, orden });
  return [
    p(1, 'Huevos Wala (cartón de 30)', 205, 'cartón', 4, 8, '8 huevos al día'),
    p(2, 'Leche entera Wala 3.1% 1 L', 59, 'cartón de 1 L', 17, 33, '1.1 L al día'),
    p(3, 'Yogurt natural bebible Wala 8 oz', 39, 'botella', 15, 30, '1 al día. Tómalo aparte: en la batida ya no cabe'),
    p(4, 'Mantequilla de maní Wala cremosa 12 oz', 214, 'frasco', 1, 2, '1 cucharada al día'),
    p(5, 'Guineo maduro', 20, 'libra', 10, 20, '2 guineos al día'),
    p(6, 'Avena integral Wala 600 g', 49, 'funda', 2, 3, '60 g al día'),
    p(7, 'Pan viga blanco Wala 820 g', 105, 'pan', 2, 3, '2 rebanadas al día (20 por pan, sin verificar)'),
    p(8, 'Queso Gouda Wala en lonjas', 220, 'paquete (1 lb)', 2, 3, '2 lonjas al día (unas 20 por libra, sin verificar)'),
    p(9, 'Atún Zerca desmenuzado en aceite 170 g', 56, 'lata', 4, 8, '2 latas por semana. En aceite: más calorías; unos 25 a 30 g de proteína por lata (estimado)'),
    p(10, 'Lechuga dulce', 36, 'unidad', 5, 10, '1 cada 3 días. Combínala con tomate, zanahoria o pepino'),
    p(11, 'Multivitamínico', 0, 'frasco', 0, 0, 'Una toma al día, cerca del 100% del valor diario, sin hierro extra. Con comida'),
    p(12, 'Tomate', 0, 'libra', 0, 0),
    p(13, 'Zanahoria', 0, 'libra', 0, 0),
    p(14, 'Pepino', 0, 'unidad', 0, 0),
    p(15, 'Fruta variada (naranja, mango, piña o guayaba)', 0, 'libra', 0, 0, 'Una fruta distinta al guineo: vitamina C y variedad'),
    p(16, 'Aguacate', 0, 'unidad', 0, 0, 'Para el almuerzo o la cena'),
    p(17, 'Sardinas en lata', 0, 'lata', 0, 0, 'Pescado 1 o 2 veces por semana: omega-3'),
  ];
}

export function recurrentesIniciales(): Recurrente[] {
  return [
    { id: ID.recPasaje, nombre: 'Pasaje diario', categoriaId: ID.transporte, monto: 280, frecuencia: 'diaria-laboral', automatico: false, activo: true },
    { id: ID.recGimnasio, nombre: 'Mensualidad gimnasio', categoriaId: ID.gimnasio, monto: 2800, frecuencia: 'mensual', diaDelMes: 1, automatico: false, activo: true },
  ];
}

export function metasIniciales(): MetaAhorro[] {
  return [{ id: 'meta-emergencia', nombre: 'Fondo de emergencia', objetivo: 0 }];
}

/** La inscripción del gimnasio se planifica en la quincena del primer arranque. */
export function planificadosIniciales(hoyFecha: string): GastoPlanificado[] {
  return [{ id: 'plan-inscripcion', nombre: 'Inscripción del gimnasio', monto: 2000, fecha: hoyFecha, categoriaId: ID.gimnasio }];
}
