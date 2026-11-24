# Quincena: control de gastos y ahorros

App personal para saber, cada quincena, cuánto entra, cuánto se ha gastado por categoría y cuánto queda para ahorrar. Funciona en el teléfono, se instala como app y trabaja sin internet. Los datos se guardan solo en el dispositivo (IndexedDB); no hay cuentas ni servidor.

**Dirección:** https://jonnmy.github.io/presupuesto/

## Cómo se usa

- **Libre para gastar** (arriba en Resumen) = ingreso − gastos fijos comprometidos − meta de ahorro − gastos variables. Debajo verás cuánto puedes gastar **por día** en lo que queda de quincena.
- **Barra de ritmo**: compara lo gastado en variables con los días transcurridos. La rayita blanca marca dónde "deberías" ir hoy. Verde = vas bien; ámbar = vas más rápido de lo ideal; rojo = te pasaste.
- **Registrar rápido**: botón **+ Gasto** (o la tecla **N** en la computadora), escribe el monto, toca la categoría y pulsa **Enter**. En el mismo formulario puedes cambiar a **Ingreso** (horas extra, regalos) o marcar **Fijo recurrente** para que se repita cada quincena.
- **Método de pago**: Efectivo/débito, Transferencia o Tarjeta de crédito. Lo gastado con tarjeta aparece en *Efectivo vs. tarjeta* como dinero a **reservar para el corte**.
- **Reparto 50/30/20**: cada categoría pertenece a Necesidades, Estilo de vida o Ahorro. Los porcentajes se cambian en Ajustes y el bloque de cada categoría en Presupuesto.
- **Suscripciones y servicios**: en **Ajustes → Fijos y suscripciones → + Suscripción o servicio** (internet, celular, streaming). El presupuesto de *Servicios y suscripciones* es la suma de ellos.
- **Cierre de quincena**: si sobró dinero, la app pregunta si quieres **ahorrarlo**, **pasarlo a la quincena nueva** o empezar en cero.
- **Demostración**: si aún no tienes movimientos, *Cargar quincena de demostración* llena las gráficas con datos de ejemplo. Se quitan con *Quitar demostración* sin tocar tus datos.
- **Tema**: oscuro por defecto; botón Claro/Oscuro arriba a la derecha.

## Instalarla en el teléfono (Android)

1. Abre la dirección de arriba en **Chrome**.
2. Toca el menú **⋮** y elige **Instalar app** (o **Agregar a la pantalla principal**).
3. Ábrela desde el ícono. Desde ese momento funciona sin internet.

Cada teléfono o navegador tiene sus propios datos. Si usas la app en el teléfono, registra todo ahí.

## Respaldo de los datos

Como los datos viven solo en el teléfono, si borras los datos de Chrome o cambias de teléfono, se pierden. Para evitarlo:

1. Ve a **Ajustes → Respaldo de datos → Exportar respaldo (JSON)**.
2. Guarda el archivo en Google Drive o envíatelo por correo.
3. Para recuperarlo: **Ajustes → Importar respaldo** y elige el archivo. Reemplaza los datos actuales.

La app te recuerda hacer un respaldo cada 15 días. También puedes exportar los gastos a CSV para abrirlos en Excel o Google Sheets.

## Correrla en la computadora

Necesitas [Node.js](https://nodejs.org) 20 o más reciente.

```powershell
npm install
npm run iconos   # genera los íconos PNG a partir de public/icono.svg
npm run dev      # abre http://localhost:5173/
npm test         # pruebas de los cálculos
npm run build    # compila en dist/
```

## Publicación

Cada cambio en la rama `main` ejecuta las pruebas, compila y publica en GitHub Pages (`.github/workflows/publicar.yml`).

## Decisiones sobre la especificación

- **Estado al 100 %:** una categoría queda *excedida* solo cuando el gasto pasa el presupuesto. Si es exactamente igual queda en ámbar. Así, pagar la mensualidad completa del gimnasio (2,800 de 2,800) no sale en rojo (prueba 10).
- **Proyección de ahorro:** gasto proyectado = lo gastado + la parte del presupuesto que corresponde a los días que faltan. Antes de empezar la quincena coincide con la meta y al terminar coincide con lo que sobró. Si la app se empezó a usar a mitad de quincena, los días anteriores no cuentan.
- **Categorías:** se quitaron Suplementos, Ropa y calzado y Otros (y los recurrentes de whey y creatina). Quedan Dieta, Gimnasio, Transporte y Gastos personales. Si ya había gastos en las categorías quitadas, pasan a Gastos personales.
- **Montos actualizados:** gimnasio RD$2,800 al mes (RD$1,400 de provisión por quincena) y pasaje RD$280 por día laborable, de lunes a sábado (13 días × 280 = RD$3,640 en una quincena típica).
- **Presupuesto mensual (prueba 5):** 26,358 sale con transporte en modo fijo (2 × 3,640). En modo calendario el mes usa los días laborables reales de cada quincena.
- **Inscripción del gimnasio:** está como *gasto único planificado* (Presupuesto → Gastos únicos planificados) en la quincena del primer uso y baja esa meta a RD$6,821. Cuando la pagues, regístrala también como gasto.
- **Dieta:** su presupuesto se recalcula cuando cambias precios o cantidades en el catálogo de Sirena. En **Compras** puedes ver la lista por quincena o por mes. A la lista original (RD$3,974 / RD$7,515) se sumaron, con precios de sirena.do del 22 nov 2026, cada 15 días: 3 lb de lechosa, 3 lb de naranja, 1 lb de guayaba, 4 mangos, 2 lb de tomate, 1 lb de zanahoria, 1 lb de pepino, 3 aguacates y 2 latas de sardinas (+RD$665). Dieta queda en **RD$4,639** por quincena y **RD$8,845** al mes. Piña, manzana, chinola, melón, sandía y el multivitamínico quedan como opcionales (cantidad 0). En **Compras → Notas de la dieta** están las recomendaciones de la batida, qué añadir y cómo elegir el multivitamínico.
- **Cifras actuales:** presupuesto por quincena **RD$13,179**, meta de ahorro **RD$8,821** (RD$6,821 con la inscripción), presupuesto mensual **RD$26,358** y ahorro mensual **RD$17,642**.
- **Recurrentes automáticos:** vienen desactivados. Al activarlos se registran solos desde ese día, nunca en fechas anteriores ni dos veces en la misma fecha.
- **Rediseño (nov 2026):** se mantuvo React + TypeScript + IndexedDB (no localStorage) para no perder los datos existentes; la migración v6 solo añade los bloques 50/30/20, marca Gimnasio y Servicios como *fijos* y crea la categoría *Servicios y suscripciones* (presupuesto 0 hasta que agregues suscripciones). Los gastos fijos cuentan completos en "Libre para gastar" aunque todavía no se hayan pagado. Las gráficas son SVG propio, sin librerías, para que la app siga funcionando sin internet.
