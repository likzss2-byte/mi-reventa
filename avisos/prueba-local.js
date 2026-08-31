// Banco de pruebas del envio. Recorre el camino completo (firma del JWT, lectura de
// Firestore, armado del mensaje, cifrado del push y limpieza de suscripciones
// caducadas) sin tocar produccion ni necesitar credenciales reales.
//
// Correr con:  node prueba-local.js

import crypto from 'node:crypto';
import webpush from 'web-push';

// Par de claves de usar y tirar, generado en cada corrida. Las de verdad NUNCA
// van en un archivo del repositorio: es publico.
const { publicKey: VAPID_PUBLICA, privateKey: VAPID_PRIVADA } = webpush.generateVAPIDKeys();

// ---------- datos de mentira ----------
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const cuentaFalsa = {
  client_email: 'prueba@mi-reventa.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
};

const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
const clavesTelefono = {
  p256dh: ecdh.getPublicKey().toString('base64url'),
  auth: crypto.randomBytes(16).toString('base64url')
};

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
function masDias(n){
  const p = hoy.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

const s = v => ({ stringValue: v });
const i = v => ({ integerValue: String(v) });
const doc = (id, fields) => ({ name: `projects/mi-reventa/databases/(default)/documents/x/${id}`, fields });
const item = (cant, precio) => ({ mapValue: { fields: { cantidad: i(cant), precioUnitario: i(precio) } } });
const abono = monto => ({ mapValue: { fields: { monto: i(monto) } } });

const apartados = [
  doc('a1', { cliente: s('Cliente Dos Dias'), vence: s(masDias(2)), estado: s('activo'),
    items: { arrayValue: { values: [item(1, 500)] } }, abonos: { arrayValue: { values: [abono(100)] } } }),
  doc('a2', { cliente: s('Cliente Vencido'), vence: s(masDias(-1)), estado: s('activo'),
    items: { arrayValue: { values: [item(2, 90)] } }, abonos: { arrayValue: { values: [abono(40)] } } }),
  doc('a3', { cliente: s('Cliente Lejano'), vence: s(masDias(9)), estado: s('activo'),
    items: { arrayValue: { values: [item(1, 200)] } }, abonos: { arrayValue: {} } }),
  doc('a4', { cliente: s('Cliente Liquidado'), vence: s(masDias(0)), estado: s('liquidado'),
    items: { arrayValue: { values: [item(1, 300)] } }, abonos: { arrayValue: { values: [abono(300)] } } })
];

const suscripciones = [
  doc('telefono-bueno', { endpoint: s('https://web.push.apple.com/BUENA'), p256dh: s(clavesTelefono.p256dh), auth: s(clavesTelefono.auth), email: s('uno@ejemplo.com') }),
  doc('telefono-caducado', { endpoint: s('https://web.push.apple.com/CADUCADA'), p256dh: s(clavesTelefono.p256dh), auth: s(clavesTelefono.auth), email: s('dos@ejemplo.com') }),
  doc('telefono-roto', { endpoint: s('https://web.push.apple.com/ROTA'), p256dh: s(clavesTelefono.p256dh), auth: s(clavesTelefono.auth), email: s('tres@ejemplo.com') })
];

// ---------- interceptores ----------
const borrados = [];
let jwtRecibido = '';
const fetchReal = globalThis.fetch;
globalThis.fetch = async (url, opciones = {}) => {
  const u = String(url);
  if (u.startsWith('https://oauth2.googleapis.com/token')){
    jwtRecibido = new URLSearchParams(String(opciones.body)).get('assertion') || '';
    return new Response(JSON.stringify({ access_token: 'token-de-prueba' }), { status: 200 });
  }
  if (u.includes('/documents/apartados')) return new Response(JSON.stringify({ documents: apartados }), { status: 200 });
  if (u.includes('/documents/suscripciones/') && opciones.method === 'DELETE'){
    borrados.push(decodeURIComponent(u.split('/').pop()));
    return new Response('{}', { status: 200 });
  }
  if (u.includes('/documents/suscripciones')) return new Response(JSON.stringify({ documents: suscripciones }), { status: 200 });
  return fetchReal(url, opciones);
};

// El envio real usa HTTPS contra Apple o Google; aca se sustituye por un doble que
// devuelve los codigos que interesan. El cifrado de verdad se comprueba aparte.
const enviados = [];
webpush.sendNotification = async (suscripcion, carga, opciones) => {
  enviados.push({ endpoint: suscripcion.endpoint, carga: JSON.parse(carga), ttl: opciones.TTL });
  if (suscripcion.endpoint.endsWith('CADUCADA')){ const e = new Error('gone'); e.statusCode = 410; throw e; }
  if (suscripcion.endpoint.endsWith('ROTA')){ const e = new Error('boom'); e.statusCode = 500; throw e; }
  return { statusCode: 201 };
};

process.env.FIREBASE_CUENTA_SERVICIO = JSON.stringify(cuentaFalsa);
process.env.VAPID_PRIVADA = VAPID_PRIVADA;
process.env.PRUEBA = 'false';

const { principal } = await import('./enviar.js');
await principal();

// ---------- comprobaciones ----------
const fallas = [];
const revisar = (nombre, condicion) => { console.log((condicion ? 'ok   ' : 'FALLA') + '  ' + nombre); if (!condicion) fallas.push(nombre); };

const partesJwt = jwtRecibido.split('.');
revisar('el JWT va firmado y tiene sus tres partes', partesJwt.length === 3 && partesJwt[2].length > 40);
revisar('el JWT pide el scope de Firestore',
  JSON.parse(Buffer.from(partesJwt[1] || '', 'base64url').toString()).scope === 'https://www.googleapis.com/auth/datastore');

revisar('se intento enviar a los 3 telefonos', enviados.length === 3);
const cuerpo = enviados[0] ? enviados[0].carga.cuerpo : '';
revisar('avisa del que vence en 2 dias', cuerpo.includes('Cliente Dos Dias') && cuerpo.includes('$400.00'));
revisar('avisa del que se vencio ayer', cuerpo.includes('Cliente Vencido') && cuerpo.includes('2 prendas'));
revisar('no avisa del que vence en 9 dias', !cuerpo.includes('Cliente Lejano'));
revisar('no avisa de uno liquidado', !cuerpo.includes('Cliente Liquidado'));
revisar('el vencido va primero', cuerpo.indexOf('Cliente Vencido') < cuerpo.indexOf('Cliente Dos Dias'));
revisar('lleva el enlace a apartados', enviados[0] && enviados[0].carga.url.includes('ver=apartados'));
revisar('lleva TTL de 12 horas', enviados[0] && enviados[0].ttl === 43200);
revisar('borra solo la suscripcion caducada', borrados.length === 1 && borrados[0] === 'telefono-caducado');
revisar('un fallo suelto no tumba el envio', (process.exitCode || 0) === 0);

// El cifrado y las cabeceras VAPID se comprueban con la funcion real de web-push.
const real = await webpush.generateRequestDetails(
  { endpoint: 'https://web.push.apple.com/REAL', keys: clavesTelefono },
  JSON.stringify({ titulo: 'x', cuerpo: 'y' }),
  { vapidDetails: { subject: 'https://likzss2-byte.github.io/mi-reventa/', publicKey: VAPID_PUBLICA, privateKey: VAPID_PRIVADA } }
);
revisar('el cuerpo va cifrado', Buffer.isBuffer(real.body) && real.body.length > 80);
revisar('usa el cifrado que pide iOS', real.headers['Content-Encoding'] === 'aes128gcm');
revisar('firma con la clave VAPID', String(real.headers.Authorization).startsWith('vapid t=')
  && String(real.headers.Authorization).includes(VAPID_PUBLICA));

console.log(fallas.length ? `\n${fallas.length} comprobacion(es) fallaron.` : '\nTodo bien.');
process.exit(fallas.length ? 1 : 0);
