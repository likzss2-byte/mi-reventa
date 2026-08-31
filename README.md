# Mi Reventa

App para llevar el control de un negocio de reventa de ropa: inventario con fotos,
tallas y cantidades, ventas, apartados, gastos y resumen de ganancias.

Es una sola pagina HTML sin servidor propio ni build. El unico servicio externo es
Firebase (Auth + Firestore) para el inicio de sesion y guardar los datos.

## Uso

Abrir la URL en el navegador e iniciar sesion con la cuenta de Google autorizada.
En iPhone conviene agregarla a la pantalla de inicio (Safari, boton Compartir,
"Agregar a inicio") para que se comporte como una app.

## Donde viven los datos

Los datos se guardan en Firestore y se sincronizan en tiempo real entre las cuentas
de Google que tengan acceso. Cualquiera puede abrir la URL, pero sin una cuenta
autorizada solo ve la pantalla de inicio de sesion o un aviso de "Sin acceso" — nunca
los datos del negocio. El acceso se controla en las reglas de seguridad de Firestore
(consola de Firebase), no en el codigo de este repositorio.

**Respaldo.** Aunque los datos ya viven en la nube, en la pestana Resumen hay un boton
para descargar un archivo `.json` con todo, y otro para restaurarlo. Sirve como copia
extra por si hace falta recuperar algo o se quiere trabajar sin conexion.

## Configuracion de Firebase

`index.html` incluye el `firebaseConfig` del proyecto (esos valores son publicos por
diseno: la seguridad real la dan las reglas de Firestore, no el codigo del cliente).
Para replicar el proyecto: crear un proyecto en Firebase, activar Authentication con
el proveedor de Google, crear una base de datos Firestore, y en Reglas restringir
lectura/escritura a los correos autorizados.

## Que registra

- **Inventario**: prendas con foto, costo, precio de venta, proveedor y cantidades por talla.
- **Vender**: se eligen varias prendas de una galeria (foto, nombre y precio) y se registra
  la venta completa de una vez.
- **Apartados**: esa misma venta se puede marcar como apartado, anotando el monto abonado.
  Las prendas quedan reservadas (no aparecen como disponibles) y hay 14 dias para liquidar.
  Pasado el plazo la prenda vuelve al inventario y lo abonado queda para el negocio.
- **Gastos**: lo que sale de la caja (publicidad, transporte, empaque).
- **Resumen**: dinero disponible, estado de los apartados, ganancia neta, margen de ventas
  e inversion en ropa sin vender.

La ropa comprada antes de empezar a usar la app se marca como "ya la tenia" para que su
costo no descuente de la caja, ya que ese gasto ocurrio antes. El dinero solo entra al
negocio vendiendo prendas o cobrando apartados; no hay ingresos sueltos.
