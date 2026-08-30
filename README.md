# Mi Reventa

App para llevar el control de un negocio de reventa de ropa: inventario con fotos,
tallas y cantidades, movimientos de caja y resumen de ganancias.

Es una sola pagina HTML sin dependencias ni servidor.

## Uso

Abrir la URL en el navegador. En iPhone conviene agregarla a la pantalla de inicio
(Safari, boton Compartir, "Agregar a inicio") para que se comporte como una app.

## Donde viven los datos

Todo se guarda en el almacenamiento local del navegador del dispositivo. No hay
servidor ni cuenta: los datos no salen del telefono y no se sincronizan entre equipos.

**Por eso el respaldo importa.** En la pestana Resumen hay un boton para descargar
un archivo `.json` con todo, y otro para restaurarlo. Conviene bajar uno cada tanto y
guardarlo en Archivos o iCloud. Si se borran los datos de Safari, ese archivo es lo
unico que permite recuperar el inventario.

## Que registra

- **Inventario**: prendas con foto, costo, precio de venta, proveedor y cantidades por talla.
- **Caja**: gastos del negocio (publicidad, transporte, empaque) e ingresos de dinero propio.
- **Resumen**: dinero disponible, ganancia neta, margen de ventas e inversion en stock.

La ropa comprada antes de empezar a usar la app se marca como "ya la tenia" para que su
costo no descuente de la caja, ya que ese gasto ocurrio antes.
