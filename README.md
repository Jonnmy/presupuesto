# Quincena: control de gastos y ahorros

App personal para saber, cada quincena, cuánto entra, cuánto se ha gastado por categoría y cuánto queda para ahorrar. Funciona en el teléfono, se instala como app y trabaja sin internet. Los datos se guardan solo en el dispositivo (IndexedDB); no hay cuentas ni servidor.

**Dirección:** https://jonnmy.github.io/presupuesto/

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
npm run dev      # abre http://localhost:5173/presupuesto/
npm test         # pruebas de los cálculos
npm run build    # compila en dist/
```

## Publicación

Cada cambio en la rama `main` ejecuta las pruebas, compila y publica en GitHub Pages (`.github/workflows/publicar.yml`).

## Decisiones sobre la especificación

- **Estado al 100 %:** una categoría queda *excedida* solo cuando el gasto pasa el presupuesto. Si es exactamente igual queda en ámbar. Así, pagar la mensualidad completa del gimnasio (2,800 de 2,800) no sale en rojo (prueba 10).
- **Proyección de ahorro:** gasto proyectado = lo gastado + la parte del presupuesto que corresponde a los días que faltan. Antes de empezar la quincena coincide con la meta y al terminar coincide con lo que sobró. Si la app se empezó a usar a mitad de quincena, los días anteriores no cuentan.
- **Categorías:** se quitaron Suplementos, Ropa y calzado y Otros (y los recurrentes de whey y creatina). Quedan Dieta, Gimnasio, Transporte y Gastos personales. Si ya había gastos en las categorías quitadas, pasan a Gastos personales.
- **Montos actualizados:** gimnasio RD$2,800 al mes (RD$1,400 de provisión por quincena) y pasaje RD$280 por día laborable, de lunes a sábado (13 días × 280 = RD$3,640 en una quincena típica). Con esto las cifras quedan: presupuesto por quincena **RD$12,514**, meta de ahorro **RD$9,486** (RD$7,486 con la inscripción), presupuesto mensual **RD$25,028** y ahorro mensual **RD$18,972**.
- **Presupuesto mensual (prueba 5):** 25,028 sale con transporte en modo fijo (2 × 3,640). En modo calendario el mes usa los días laborables reales de cada quincena.
- **Inscripción del gimnasio:** está como *gasto único planificado* (Presupuesto → Gastos únicos planificados) en la quincena del primer uso y baja esa meta a RD$7,486. Cuando la pagues, regístrala también como gasto.
- **Dieta:** su presupuesto se recalcula cuando cambias precios o cantidades en el catálogo de Sirena. El catálogo trae, sin precio, fruta variada, aguacate, sardinas, tomate, zanahoria, pepino y el multivitamínico; en **Compras → Notas de la dieta** están las recomendaciones de la batida, qué añadir y cómo elegir el multivitamínico.
- **Recurrentes automáticos:** vienen desactivados. Al activarlos se registran solos desde ese día, nunca en fechas anteriores ni dos veces en la misma fecha.
