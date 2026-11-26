# Finanzas personales

App para controlar ingresos, gastos, presupuestos (semanales, quincenales, mensuales o personalizados), pagos recurrentes, deudas, tarjetas, cuentas y metas de ahorro. Está pensada para República Dominicana (RD$, español, fechas DD/MM/AAAA, zona America/Santo_Domingo), y todo eso se puede cambiar en Configuración.

Funciona **sin internet** y los datos se guardan **solo en el dispositivo**: no hay cuentas, servidor ni claves en el código.

- **APK para Android:** https://github.com/Jonnmy/presupuesto/releases/latest/download/Finanzas.apk
- **Versión web (también se instala como app):** https://jonnmy.github.io/presupuesto/

## Instalar el APK en Android

1. Desde el teléfono, abre el enlace del APK de arriba. Se descarga `Finanzas.apk`.
2. Ábrelo. Si Android lo pide, permite **Instalar apps desconocidas** para Chrome o para Archivos.
3. Toca **Instalar** y abre **Finanzas**.

Las versiones nuevas se publican en la misma dirección y se instalan **encima** de la anterior sin perder los datos (todas van firmadas con la misma clave).

> La app del APK y la versión web tienen datos separados. Para pasar datos de una a otra: **Configuración → Exportar respaldo** en una e **Importar respaldo** en la otra.

## Qué hace

| Módulo | Qué incluye |
|---|---|
| **Panel** | Balance disponible, ingresos y gastos del período, restante del presupuesto y % consumido, pendientes, libre hasta el próximo cobro (y por día), próximos compromisos, metas, alertas y comparación con el período anterior. Gráficos: ingresos vs. gastos, gastos por categoría, evolución del gasto y presupuesto usado vs. disponible. Selector de semana / quincena / mes / últimos 30 días / personalizado. |
| **Movimientos** | Ingresos, gastos y transferencias: crear, editar, eliminar (con deshacer), buscar, filtrar por fecha, tipo, categoría, cuenta, estado y monto, ordenar y exportar a CSV. Aviso de posible duplicado. Registro rápido: monto → categoría → Guardar (tecla **N** en computadora). |
| **Presupuestos** | Semanal, quincenal (1–15 y 16–fin, o según tus días de cobro), mensual o personalizado, con límite total y por categoría. Al editarlo se guarda una versión nueva: los períodos pasados no cambian. Historial por período. |
| **Compromisos** | Ingresos y pagos recurrentes (semanal, quincenal, mensual, anual, cada N días, única vez), próxima fecha, aviso previo, marcar como pagado/recibido (crea el movimiento una sola vez), omitir una fecha, calendario de cobros. |
| **Cuentas** | Efectivo, banco, ahorro, billetera y tarjeta de crédito con saldo, historial y transferencias. Las transferencias no cuentan como ingreso ni gasto. |
| **Deudas y tarjetas** | Monto original, saldo, cuota, día de vencimiento, tasa e historial de abonos. Tarjetas con saldo, límite, día de corte y de pago. Pagar la tarjeta es una transferencia (el gasto ya se contó al comprar), así no se cuenta dos veces. |
| **Metas de ahorro** | Objetivo, fecha límite, aportes y retiros desde una cuenta, progreso y cuánto apartar por quincena. |
| **Calendario** | Vista mensual con cobros, pagos programados, vencimientos y movimientos; al tocar un día ves el detalle y puedes pagar o registrar. |
| **Reportes** | Resumen semanal, quincenal o mensual, gastos por categoría, mayores gastos, evolución del ahorro, historial de presupuestos, deudas, comparación entre períodos, recomendaciones y exportación CSV. |
| **Configuración** | Moneda, símbolo, decimales, formato de fecha, zona horaria, tema claro/oscuro, inicio de semana, días de quincena, umbrales de alertas, categorías (crear, editar, ocultar, eliminar moviendo sus movimientos) y respaldos (exportar/importar JSON, CSV, borrar todo con doble confirmación). |

### Reglas de cálculo

- **Balance disponible** = saldo de cuentas de efectivo, banco y billetera (las de ahorro y las tarjetas se muestran aparte).
- Solo los movimientos **pagados** cambian saldos; los **pendientes** se muestran como compromisos.
- **Transferencias** y **pagos de tarjeta**: mueven dinero entre cuentas, no son gasto.
- **Compra con tarjeta**: es gasto el día de la compra y aumenta la deuda de la tarjeta.
- **Abono a una deuda**: cuenta como gasto (categoría Deudas) y baja el saldo de la deuda.
- **Aportes a metas**: sacan dinero de la cuenta pero no son gasto; los retiros lo devuelven.
- Los montos se guardan en **centavos enteros** para evitar errores de redondeo.
- Los recurrentes usan un índice único (compromiso + fecha) para que un pago nunca se registre dos veces.

## Respaldo de los datos

Los datos viven solo en el teléfono (o navegador). Si desinstalas la app, borras sus datos o cambias de teléfono, se pierden. Por eso:

1. Entra a **Configuración → Copias de seguridad → Exportar respaldo (JSON)** de vez en cuando (la app te recuerda si pasan más de 14 días).
2. En el APK se abre el menú de compartir: guárdalo en **Drive**, envíalo por correo o WhatsApp.
3. Para recuperar: **Importar respaldo** y elige el archivo.

La primera vez que se abre esta versión en un navegador donde se usó la versión anterior ("Quincena"), sus gastos, ingresos y ahorros se importan automáticamente.

## Desarrollo

Requisitos: Node.js 20 o superior.

```powershell
npm install
npm run iconos       # íconos de la versión web
npm run dev          # servidor de desarrollo
npm test             # pruebas (Vitest)
npm run build        # compilación de producción en dist/
```

### Compilar el APK

El APK se compila solo en **GitHub Actions** con cada cambio en `main` (`.github/workflows/apk.yml`) y se publica en **Releases**. Para compilarlo en una computadora propia hace falta JDK 21 y el SDK de Android:

```powershell
npm run android                  # compila la web y la copia al proyecto Android
cd android; .\gradlew assembleDebug
```

La firma de la versión publicada se lee de variables de entorno (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), que en GitHub vienen de los **secretos** del repositorio. La clave **no** está en el repositorio (`*.p12`, `*.jks` y `*.keystore` están ignorados). Guarda una copia de la carpeta de la clave en un lugar seguro: sin ella no se pueden publicar actualizaciones que se instalen encima.

## Arquitectura

- **Vite + React 19 + TypeScript**: interfaz.
- **Dexie (IndexedDB)**: base de datos local `finanzas`.
- **Capacitor 8**: empaqueta la misma app web como APK de Android (botón atrás, guardar/compartir archivos).
- **vite-plugin-pwa**: versión web instalable y sin internet.

```
src/
  nucleo/        Lógica financiera pura y probada (sin interfaz ni base de datos)
    tipos.ts       Modelo de datos
    dinero.ts      Centavos, formato de moneda, porcentajes
    fechas.ts      Fechas locales, formatos, zona horaria
    periodos.ts    Semana, quincena, mes, últimos 30 días, personalizado
    recurrencia.ts Próximas fechas de pagos e ingresos recurrentes
    finanzas.ts    Saldos, totales, presupuestos, deudas, metas, alertas, recomendaciones
    validar.ts     Validaciones y detección de duplicados
  db/            Base de datos, datos iniciales, acciones (guardar/eliminar/pagar) y respaldos
  ui/            Componentes comunes, formularios, gráficos SVG, selector de período
  pantallas/     Panel, Movimientos, Presupuestos, Compromisos, Cuentas, Deudas, Metas,
                 Calendario, Reportes, Configuración
android/         Proyecto nativo generado por Capacitor
scripts/         Generación de íconos del APK
```

Toda la lógica de cálculo está en `src/nucleo` y las pantallas solo la usan, así los números son los mismos en el panel, los reportes y las alertas.

## Estado

**Terminado:** todos los módulos de la tabla, tema claro/oscuro, diseño adaptable (barra lateral en computadora, navegación inferior en el teléfono), validaciones, confirmación antes de eliminar, deshacer, protección contra duplicados, respaldos e importación, exportación CSV, APK firmado y publicación automática, 33 pruebas automáticas del núcleo y de la base de datos.

**Limitaciones conocidas:**

- Las alertas y recordatorios se ven **dentro de la app** (panel y compromisos); todavía no hay notificaciones push del sistema.
- No hay sincronización entre dispositivos: se pasa la información con respaldos.
- Solo está en español.
- La tasa de interés de las deudas se registra como referencia; la app no calcula intereses automáticamente.
- Las pantallas de la versión anterior (lista de la Sirena y dieta) se retiraron; sus gastos, ingresos y ahorros se importan como se indica arriba.
- El APK se instala fuera de Google Play, por eso Android pide permitir la instalación.
