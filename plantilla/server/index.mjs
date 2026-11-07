// Arranque de la Oficina.
import { serve } from '@hono/node-server';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { abrirDB } from './db.mjs';
import { crearApp } from './app.mjs';
import { crearSalas, extraeMarcas } from './salas.mjs';
import { resuelveHilo } from './equipo.mjs';
import { crearTareas, configERP } from './tareas.mjs';
import { crearAvisos, crearSalud } from './avisos.mjs';
import { pasada, arrancaRecepcion, arrancaVigia } from './recepcion.mjs';
import { pendientes } from './estado.mjs';
import { DEPARTAMENTOS, POR_ID } from './departamentos.mjs';
import { crearReuniones } from './reuniones.mjs';
import { crearLecciones } from './lecciones.mjs';
import { crearVoz } from './voz.mjs';
import { crearNotas } from './notas.mjs';
import { crearCorreos } from './correos.mjs';
import { crearDecorador } from './decoracion.mjs';
import { crearLean } from './lean.mjs';
import { usaBase } from './parametros.mjs';
import { registraUso } from './motor.mjs';
import { crearFundador } from './fundar.mjs';
import { crearAvisoCorreo } from './avisame.mjs';
import { crearCampanas } from './campanas.mjs';
import { crearSubidas } from './subidas.mjs';
import { crearObras } from './obras.mjs';
import { execFile } from 'node:child_process';
import { arrancaInfra } from './infra.mjs';

const log = (...a) => console.log(new Date().toISOString(), ...a);

// Candado: con datos reales solo arranca si se pide de forma expresa. Hasta que Alex lo apruebe, no.
if (!CONFIG.SIMULACION && process.env.OFICINA_REAL !== '1') {
	console.error('La Oficina no arranca con datos reales sin OFICINA_REAL=1. Para probar: OFICINA_SIMULACION=1.');
	process.exit(1);
}

fs.mkdirSync(CONFIG.DATOS, { recursive: true, mode: 0o700 });
fs.chmodSync(CONFIG.DATOS, 0o700);
const db = abrirDB(path.join(CONFIG.DATOS, 'oficina.db'));
usaBase(db);
registraUso(u => {
	const k = `uso:${new Date().toISOString().slice(0, 10)}`;
	const a = JSON.parse(db.ajuste(k) || '{"n":0,"ms":0,"coste":0}');
	db.ajuste(k, JSON.stringify({ n: a.n + 1, ms: a.ms + u.ms, coste: Math.round((a.coste + u.coste) * 100) / 100 }));
});
const bus = new EventEmitter();
bus.setMaxListeners(50);

// Plugins del usuario: se apagan en cada sala, para que no se cuelen sus hooks ni su contexto.
let pluginsUsuario = [];
try {
	pluginsUsuario = Object.keys(JSON.parse(fs.readFileSync(path.join(CONFIG.CLAUDE_CONFIG_DIR, 'settings.json'), 'utf8')).enabledPlugins ?? {});
} catch { /* sin ajustes */ }

const avisos = crearAvisos({ db, log });
const avisa = a => avisos.avisa(a).catch(e => log('aviso:', e.message));
let salas, tareas, reuniones;
const salud = crearSalud({ bus, alRecuperar: () => { salas?.siguiente(); tareas?.siguiente(); reuniones?.siguiente(); } });
const mcpConfig = CONFIG.SIMULACION ? null : configERP(CONFIG.DATOS);
const lecciones = crearLecciones({ db, log });
const avisoCorreo = crearAvisoCorreo({ db, log });
// Antes de tocar una campaña, lo que dice el aprendizaje (regla de Marketing). Sin terminal para los agentes: lo saca el servicio.
let aprendizajeCache = { t: 0, texto: '' };
const aprendizaje = () => new Promise(res => {
	if (Date.now() - aprendizajeCache.t < 30 * 60_000) return res(aprendizajeCache.texto);
	const dir = POR_ID.marketing.carpeta;
	execFile('python3', ['7-Datos/scripts/aprendizaje.py'], { cwd: dir, timeout: 120_000, maxBuffer: 2_000_000 }, (e, salida) => {
		if (e) return res('No he podido sacarlo. No toques nada que dependa de esto y díselo a Alex.');
		aprendizajeCache = { t: Date.now(), texto: String(salida).slice(0, 6000) };
		res(aprendizajeCache.texto);
	});
});
const voz = crearVoz();
const escribeSala = (h, t, o) => salas.escribir(h, t, o);

const fundador = crearFundador({ db, acme: CONFIG.EMPRESA, home: CONFIG.HOME, conPuerta: !CONFIG.SIMULACION });
const avisaTrabajo = a => avisoCorreo.manda({ ...a, trabajo: true }).catch(e => log('aviso:', e.message));
tareas = crearTareas({ db, bus, salud, avisa, mcpConfig, escribeSala, alAvisar: avisaTrabajo, pluginsUsuario, fundador, leccionesDe: d => lecciones.bloque(d), alResultado: (t, texto) => {
	const m = extraeMarcas(texto);
	const h = resuelveHilo(t.responsable) ?? resuelveHilo(t.equipo);
	for (const c of m.correos) correos.propone({ ...c, desde: t.responsable ?? t.equipo }).catch(e => log('correo:', e.message));
	if (h?.persona.nivel === 'direccion') for (const n of m.tareas) if (n.equipo === 'alex') tareas.pideAAlex({ titulo: n.titulo, desde: t.responsable ?? t.equipo });
} });
const correos = crearCorreos({ db, bus, tareas, lecciones, avisa, escribeSala, pluginsUsuario, log });
avisoCorreo.respaldo = a => correos.avisaAAlex(a);
const campanasSalida = crearCampanas({ db, bus, tareas, escribeSala, aprendizaje, avisa, log, escribeFicha: !CONFIG.SIMULACION });
const subidas = crearSubidas({ db, bus, tareas, log });
reuniones = crearReuniones({ db, bus, salud, lecciones, tareas, avisa, mcpConfig, log, escribeSala, decorador: crearDecorador({ db, bus }) });
// Reiniciar tras una obra espera a que nadie esté a mitad de algo.
const obras = crearObras({ db, bus, tareas, log, alAvisar: avisaTrabajo, ocupada: () => salas.trabajando().length > 0 || tareas.ocupado() || correos.ocupado() || campanasSalida.ocupado() || notas.ocupado() });
tareas.obras = obras;
salas = crearSalas({
	db, bus, salud, pluginsUsuario, avisa, tareas, correos, avisoCorreo, campanasSalida, obras, aprendizaje,
	proponerReunion: reuniones.propone,
	opinar: t => reuniones.opina(t).catch(e => log('opinión:', e.message)),
	leccionesDe: dep => lecciones.bloque(dep),
	contexto: () => tareas.resumen(),
	tablonDe: d => tareas.resumenDe(d),
});
const notas = crearNotas({ db, bus, voz, salas, log });

const lean =crearLean({ db, bus, tareas, lecciones, log });

let enPasada = false;
// Dentro de la app no hay avisos: una alerta de dinero le llega también al correo.
const avisaPasada = a => { avisa(a); if (a.dinero) avisoCorreo.manda({ desde: 'general:recepcion', quien: 'Tere', asunto: a.titulo, texto: `${a.cuerpo ?? ''}. Comprueba por otra vía antes de hacer nada.`, dinero: true }).catch(() => {}); };
const opcionesPasada = { db, salud, bus, pluginsUsuario, avisa: avisaPasada, salas, reuniones, tareas, modos: () => lecciones.bloque('recepcion'), pendientes: () => pendientes(DEPARTAMENTOS, db) };
const mirar = async () => {
	if (enPasada) return false;
	enPasada = true;
	try { await pasada(opcionesPasada); return true; } catch (e) { log('pasada:', e.message); throw e; } finally { enPasada = false; }
};

const app = crearApp({ db, bus, salas, tareas, lean, correosSalida: correos, campanasSalida, subidas, reuniones, lecciones, voz, notas, avisos, salud, mirar, estatico: 'web/dist' });

await salud.comprobar();
salas.arranca();
notas.arranca();
// Que el modelo esté antes de la primera nota. Si falla, se vuelve a intentar al transcribir.
if (!CONFIG.SIMULACION) voz.preparaModelo().catch(e => log('modelo de Whisper:', e.message));
correos.arranca();
campanasSalida.arranca();
subidas.arranca();
obras.arranca();
tareas.arranca();
reuniones.arranca();
lean.arranca();
if (!CONFIG.SIMULACION) arrancaRecepcion({ ...opcionesPasada, mirar }, log);
if (!CONFIG.SIMULACION) arrancaVigia({ db, salud, pluginsUsuario, lanzaPasada: () => mirar().catch(() => false) }, log);
if (!CONFIG.SIMULACION) arrancaInfra({ db, salas, acme: CONFIG.EMPRESA, log });
setInterval(() => salud.comprobar(), 600_000).unref();
process.on('unhandledRejection', e => log('sin capturar:', e?.message ?? e));

serve({ fetch: app.fetch, hostname: '127.0.0.1', port: CONFIG.PUERTO }, () => log(`Oficina abierta en 127.0.0.1:${CONFIG.PUERTO}, sesión de Claude: ${salud.estado().sesion}`));

for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { log('Cierro la oficina'); db.cerrar(); process.exit(0); });
