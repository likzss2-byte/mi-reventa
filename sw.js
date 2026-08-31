// Service worker de Mi Reventa.
//
// Solo se ocupa de las notificaciones. A proposito NO cachea nada ni intercepta
// peticiones: la app se actualiza sola en cada despliegue y un cache mal invalidado
// serviria una version vieja sin que nadie se diera cuenta.

self.addEventListener('install', function(){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(self.clients.claim());
});

// El envio manda un JSON con titulo, cuerpo y a donde llevar al tocar.
// Si viniera vacio o mal formado igual se muestra algo: iOS cierra la suscripcion
// si un push no termina en una notificacion visible.
self.addEventListener('push', function(e){
  var datos = {
    titulo: 'Mi Reventa',
    cuerpo: 'Tienes un apartado por vencer.',
    tag: 'apartados',
    url: './index.html?ver=apartados'
  };
  if (e.data){
    try{
      var recibido = e.data.json();
      if (recibido.titulo) datos.titulo = recibido.titulo;
      if (recibido.cuerpo) datos.cuerpo = recibido.cuerpo;
      if (recibido.tag) datos.tag = recibido.tag;
      if (recibido.url) datos.url = recibido.url;
    }catch(err){
      datos.cuerpo = e.data.text() || datos.cuerpo;
    }
  }
  e.waitUntil(self.registration.showNotification(datos.titulo, {
    body: datos.cuerpo,
    icon: 'icono.png',
    badge: 'icono.png',
    tag: datos.tag,
    data: { url: datos.url }
  }));
});

// Al tocar el aviso: si la app ya esta abierta se trae al frente, si no se abre
// directo en la pantalla de apartados.
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var destino = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(ventanas){
      for (var i = 0; i < ventanas.length; i++){
        if (ventanas[i].url.indexOf('mi-reventa') !== -1 && 'focus' in ventanas[i]){
          return ventanas[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});
