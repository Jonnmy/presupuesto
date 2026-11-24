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
    { id: ID.dieta, clave: 'dieta', nombre: 'Dieta (Sirena)', tipo: 'gasto', modo: 'quincenal', presupuestoQuincenal: 4639, presupuestoMensual: 8845, orden: 1, activa: true },
    { id: ID.gimnasio, clave: 'gimnasio', nombre: 'Gimnasio', tipo: 'gasto', modo: 'mensual', presupuestoQuincenal: 1400, presupuestoMensual: 2800, orden: 3, activa: true },
    { id: ID.transporte, clave: 'transporte', nombre: 'Transporte', tipo: 'gasto', modo: 'quincenal', presupuestoQuincenal: 3640, presupuestoMensual: 7280, orden: 4, activa: true },
    { id: ID.personal, clave: 'personal', nombre: 'Gastos personales', tipo: 'gasto', modo: 'quincenal', presupuestoQuincenal: 3500, presupuestoMensual: 7000, orden: 5, activa: true },
    { id: ID.ahorro, clave: 'ahorro', nombre: 'Ahorro', tipo: 'ahorro', modo: 'quincenal', presupuestoQuincenal: 8821, presupuestoMensual: 17642, orden: 8, activa: true },
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
    // Precios de sirena.do (22 nov 2026). Cantidad 0 = opcional: no entra en la lista ni en el presupuesto hasta que le pongas cantidad.
    p(11, 'Multivitamínico Centrum Energía 45 tabletas', 1000, 'frasco', 0, 0, 'El único multivitamínico en sirena.do; es fórmula "energía". 45 tabletas: 1 frasco cada mes y medio. Una toma al día, con comida'),
    p(12, 'Tomate de ensalada', 46, 'libra', 2, 4, 'Con la lechuga: unas 2 lb cada 15 días'),
    p(13, 'Zanahoria fresca', 30, 'libra', 1, 2, 'Con la lechuga'),
    p(14, 'Pepino fresco', 24, 'libra', 1, 2, 'Con la lechuga'),
    p(16, 'Aguacate 35% maduro', 45, 'unidad', 3, 6, 'Grasas buenas y calorías; para el almuerzo o la cena'),
    p(17, 'Sardinas en aceite Zerca 125 g', 29, 'lata', 2, 4, '1 lata por semana, además del atún: omega-3'),
    p(18, 'Naranja de jugo', 56, 'libra', 3, 6, 'Vitamina C; unas 3 naranjas por libra'),
    p(19, 'Mango banilejo', 11, 'unidad', 4, 8, 'Barato en temporada; también hay Gota de oro a RD$34'),
    p(20, 'Piña', 106, 'unidad', 0, 0, 'Rinde para varios días'),
    p(21, 'Guayaba fresca', 54, 'libra', 1, 2, 'De las frutas con más vitamina C'),
    p(22, 'Lechosa entera', 20, 'libra', 3, 6, 'De las más baratas por libra; buena para la digestión'),
    p(23, 'Manzana roja', 89, 'libra', 0, 0, 'Fácil de llevar al trabajo'),
    p(24, 'Chinola', 88, 'libra', 0, 0, 'Para jugo'),
    p(25, 'Melón cantaloupe', 99, 'unidad', 0, 0),
    p(26, 'Sandía', 30, 'libra', 0, 0, 'Hidrata; se vende la pieza entera por peso'),
  ];
}

/** Productos de versiones anteriores que se quitaron del catálogo (solo se borran si el usuario no los tocó). */
export const PRODUCTOS_RETIRADOS = ['prod-15'];

/** Cantidades propuestas (v5) para productos que antes venían en 0. */
export const CANTIDADES_V5: Record<string, [number, number]> = {
  'prod-12': [2, 4], 'prod-13': [1, 2], 'prod-14': [1, 2], 'prod-16': [3, 6], 'prod-17': [2, 4],
  'prod-18': [3, 6], 'prod-19': [4, 8], 'prod-21': [1, 2], 'prod-22': [3, 6],
};

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
