// Manda las notificaciones de apartados. Corre una vez al dia desde GitHub Actions.
//
// Esto no puede vivir dentro de la app: la pagina es estatica y con el telefono
// cerrado no hay nada corriendo que pueda avisar.
//
// IMPORTANTE: los registros de Actions son publicos porque el repositorio lo es.
// Aca no se imprime ningun nombre de cliente, monto ni direccion de suscripcion:
// solo cuentas. Cualquier dato del negocio que se escriba en la consola queda a
// la vista de cualquiera.

import crypto from 'node:crypto';
import webpush from 'web-push';

const PROYECTO = 'mi-reventa';
const ZONA = 'America/Mexico_City';   // define que dia es "hoy" al calcular los plazos
const SUBJECT = 'https://likzss2-byte.github.io/mi-reventa/';
const VAPID_PUBLICA = 'BOAy2Mr7WoJA5LlQnqnD-zkZSsYG-ky3rYghVzN1bZDgNRqyHx6lfTGGDfWLxF7s_xcrMpUJ4o65kphhjAtTA0Y';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;

// ---------- utilidades ----------
export function desdeFirestore(v){
  if (v == null) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(desdeFirestore);
  if (v.mapValue !== undefined){
    const salida = {};
    for (const [clave, valor] of Object.entries(v.mapValue.fields || {})) salida[clave] = desdeFirestore(valor);
    return salida;
  }
  return null;
}

export function hoyEnZona(zona = ZONA, ahora = new Date()){
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(ahora);
}

function aUTC(iso){
  const p = String(iso).split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

export function diasEntre(desde, hasta){
  const a = aUTC(desde), b = aUTC(hasta);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export function dinero(n){
  const v = Math.round(Number(n) * 100) / 100;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Los datos vienen de Firestore, donde alguien podria haber editado a mano. Un solo
// registro raro no puede tumbar el envio del dia para todos los demas.
const numero = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const total = a => (a.items || []).reduce((x, it) => x + numero(it.precioUnitario) * numero(it.cantidad), 0);
const abonado = a => (a.abonos || []).reduce((x, ab) => x + numero(ab.monto), 0);
const restante = a => Math.max(0, total(a) - abonado(a));
const unidades = a => (a.items || []).reduce((x, it) => x + numero(it.cantidad), 0);

// Se avisa tres veces en la vida de un apartado y no mas: dos dias antes, el dia
// del plazo, y al dia siguiente para contar como quedo. Avisar todos los dias
// seria ruido y se terminaria ignorando.
export function armarMensaje(apartados, hoy){
  const avisos = [];
  for (const a of apartados){
    if (!a || typeof a !== 'object') continue;
    if (a.estado === 'liquidado' || a.estado === 'vencido') continue;
    const dias = diasEntre(hoy, a.vence);
    if (dias === null) continue;
    const nombre = a.cliente || 'Sin nombre';
    // Un apartado ya pagado que nadie liquido tambien se vence, asi que se avisa
    // igual, pero decir "faltan $0.00" no ayuda a nadie.
    const falta = restante(a);
    const cola = falta > 0 ? `faltan ${dinero(falta)}` : 'ya esta pagado, falta liquidarlo';
    if (dias === 2){
      avisos.push({ orden: 2, texto: `${nombre} vence en 2 dias, ${cola}` });
    } else if (dias === 0){
      avisos.push({ orden: 0, texto: `${nombre} vence hoy, ${cola}` });
    } else if (dias === -1){
      const u = unidades(a);
      avisos.push({ orden: -1, texto: `${nombre} se vencio, ${u} prenda${u === 1 ? '' : 's'} de vuelta al inventario` });
    }
  }
  if (!avisos.length) return null;

  avisos.sort((x, y) => x.orden - y.orden);
  if (avisos.length === 1){
    return {
      titulo: avisos[0].orden === -1 ? 'Apartado vencido' : 'Apartado por vencer',
      cuerpo: avisos[0].texto,
      tag: 'apartados',
      url: './index.html?ver=apartados'
    };
  }
  const primeros = avisos.slice(0, 3).map(x => x.texto);
  const resto = avisos.length - primeros.length;
  return {
    titulo: `${avisos.length} apartados`,
    cuerpo: primeros.join('\n') + (resto > 0 ? `\ny ${resto} mas` : ''),
    tag: 'apartados',
    url: './index.html?ver=apartados'
  };
}

// ---------- acceso a Firestore ----------
function base64url(buf){ return Buffer.from(buf).toString('base64url'); }

async function tokenDeAcceso(cuenta){
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = base64url(JSON.stringify({
    iss: cuenta.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600
  }));
  const firma = crypto.createSign('RSA-SHA256').update(`${cabecera}.${cuerpo}`).sign(cuenta.private_key);
  const jwt = `${cabecera}.${cuerpo}.${base64url(firma)}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!r.ok) throw new Error(`No se pudo autenticar en Google (${r.status}). Revisa el secreto FIREBASE_CUENTA_SERVICIO.`);
  return (await r.json()).access_token;
}

async function leerColeccion(nombre, token){
  const salida = [];
  let pagina = '';
  do {
    const url = `${BASE}/${nombre}?pageSize=300${pagina ? `&pageToken=${pagina}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`No se pudo leer ${nombre} (${r.status}).`);
    const j = await r.json();
    for (const d of (j.documents || [])){
      const obj = desdeFirestore({ mapValue: { fields: d.fields || {} } });
      obj.__id = d.name.split('/').pop();
      salida.push(obj);
    }
    pagina = j.nextPageToken || '';
  } while (pagina);
  return salida;
}

async function borrarDoc(coleccion, id, token){
  await fetch(`${BASE}/${coleccion}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

// ---------- envio ----------
export async function principal(){
  const cuentaCruda = process.env.FIREBASE_CUENTA_SERVICIO || '';
  const vapidPrivada = process.env.VAPID_PRIVADA || '';
  const esPrueba = String(process.env.PRUEBA || '').toLowerCase() === 'true';

  if (!cuentaCruda) throw new Error('Falta el secreto FIREBASE_CUENTA_SERVICIO.');
  if (!vapidPrivada) throw new Error('Falta el secreto VAPID_PRIVADA.');

  let cuenta;
  try{
    cuenta = JSON.parse(cuentaCruda);
  }catch(e){
    throw new Error('FIREBASE_CUENTA_SERVICIO no es un JSON valido. Pega el archivo completo, tal cual lo descargaste.');
  }

  const token = await tokenDeAcceso(cuenta);
  const [apartados, suscripciones] = await Promise.all([
    leerColeccion('apartados', token),
    leerColeccion('suscripciones', token)
  ]);

  const hoy = hoyEnZona();
  let mensaje = armarMensaje(apartados, hoy);

  if (!mensaje && esPrueba){
    mensaje = {
      titulo: 'Prueba de Mi Reventa',
      cuerpo: 'El envio diario funciona. Asi va a llegar el aviso cuando un apartado este por vencer.',
      tag: 'apartados',
      url: './index.html?ver=apartados'
    };
  }

  console.log(`Apartados leidos: ${apartados.length}. Telefonos registrados: ${suscripciones.length}.`);

  if (!mensaje){
    console.log('Nada por avisar hoy.');
    return;
  }
  if (!suscripciones.length){
    console.log('Hay algo que avisar, pero ningun telefono tiene las notificaciones activadas.');
    return;
  }

  webpush.setVapidDetails(SUBJECT, VAPID_PUBLICA, vapidPrivada);
  const carga = JSON.stringify(mensaje);

  let enviados = 0, caducadas = 0;
  const fallos = [];

  for (const s of suscripciones){
    if (!s.endpoint || !s.p256dh || !s.auth){
      fallos.push('suscripcion incompleta');
      continue;
    }
    try{
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        carga,
        { TTL: 43200 }
      );
      enviados++;
    }catch(err){
      // 404/410 = el telefono desinstalo la app o el navegador cancelo la suscripcion.
      if (err.statusCode === 404 || err.statusCode === 410){
        await borrarDoc('suscripciones', s.__id, token);
        caducadas++;
      } else {
        fallos.push(`codigo ${err.statusCode || 'desconocido'}`);
      }
    }
  }

  console.log(`Enviados: ${enviados}. Suscripciones caducadas y limpiadas: ${caducadas}. Fallos: ${fallos.length}.`);
  if (fallos.length) console.log('Detalle de fallos: ' + fallos.join(', '));
  if (!enviados && fallos.length) process.exitCode = 1;
}

// Solo corre si se ejecuta directo, para poder importar las funciones en las pruebas.
if (process.argv[1] && process.argv[1].endsWith('enviar.js')){
  principal().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
