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

`index.html` incluye el `firebaseConfig` del proyecto y la clave publica VAPID de las
notificaciones (esos valores son publicos por diseno: la seguridad real la dan las reglas
de Firestore, no el codigo del cliente). La clave VAPID privada nunca va en el repositorio.
`sw.js` es el service worker; solo muestra notificaciones, no cachea nada.
Para replicar el proyecto: crear un proyecto en Firebase, activar Authentication con
el proveedor de Google, crear una base de datos Firestore, y en Reglas restringir
lectura/escritura a los correos autorizados.

## Envio de los avisos

Una pagina estatica no puede notificar nada con el telefono cerrado, asi que el aviso
lo manda un proceso diario: `.github/workflows/avisos.yml` corre `avisos/enviar.js`,
que lee los apartados en Firestore y manda la notificacion a los telefonos registrados.

Avisa tres veces en la vida de un apartado y no mas: dos dias antes del plazo, el dia
del plazo, y al dia siguiente para contar como quedo.

Necesita dos secretos del repositorio (Settings -> Secrets and variables -> Actions):

- `FIREBASE_CUENTA_SERVICIO`: el JSON de una cuenta de servicio de Firebase.
- `VAPID_PRIVADA`: la clave privada de las notificaciones.

Los registros de Actions son publicos porque el repositorio lo es, asi que el script
solo imprime cuentas, nunca nombres de clientes, montos ni direcciones de suscripcion.

`node avisos/prueba-local.js` recorre todo el camino con datos y claves de mentira,
sin tocar produccion.

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
- **Avisos**: notificaciones en el telefono cuando un apartado esta por vencer. En iPhone
  solo funcionan si la app se abrio desde el icono de la pantalla de inicio (restriccion de
  Apple). Cada telefono se activa por separado desde Resumen.

La ropa comprada antes de empezar a usar la app se marca como "ya la tenia" para que su
costo no descuente de la caja, ya que ese gasto ocurrio antes. El dinero solo entra al
negocio vendiendo prendas o cobrando apartados; no hay ingresos sueltos.
