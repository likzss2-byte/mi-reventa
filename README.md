# Mi Reventa

App para llevar el control de un negocio de reventa de ropa: inventario con fotos,
tallas y cantidades, movimientos de caja y resumen de ganancias.

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
- **Caja**: gastos del negocio (publicidad, transporte, empaque) e ingresos de dinero propio.
- **Resumen**: dinero disponible, ganancia neta, margen de ventas e inversion en stock.

La ropa comprada antes de empezar a usar la app se marca como "ya la tenia" para que su
costo no descuente de la caja, ya que ese gasto ocurrio antes.
