// Que la oficina se mejore a sí misma. Lo hace Nico en una rama aparte, nunca sobre lo que está en marcha.
// El servicio, no el modelo, pasa las pruebas, compila, arranca la versión nueva con datos falsos y, si todo va, la pone en marcha.
// Lo que toque permisos o controles pide antes un sí de Alex. Nunca se sube nada a un remoto.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { argsObra, fueraDeLista } from './perfiles.mjs';
import { crearTurno } from './actividad.mjs';
import { ejecuta } from './motor.mjs';

const HILO = 'general:infra';
export const REPO = path.join(CONFIG.EMPRESA, '2-Software', 'oficina');
export const OBRA = path.join(CONFIG.EMPRESA, '2-Software', 'oficina-obra');
const NODE_BIN = process.execPath;
// Lo que controla qué puede hacer cada uno. Cambiarlo pide su sí, con los archivos a la vista.
const CONTROLES = /^(server\/(perfiles|motor|config|obras|subidas|avisame|envio-firma|campanas|correos|guarda-git|meta-fuera|hook-[\w-]+|app)\.mjs|launchd\/|docs\/REGLAMENTO\.md|CLAUDE\.md)/;
export const tocaControles = archivos => archivos.filter(a => CONTROLES.test(a));

const corre = (cwd, cmd, args, opciones = {}) => new Promise((res, rej) => execFile(cmd, args, { cwd, timeout: 600_000, maxBuffer: 30 * 1024 * 1024, ...opciones }, (e, salida, err) => (e ? rej(Object.assign(e, { salida: `${salida}\n${err}` })) : res(String(salida).trim()))));
const git = (cwd, ...a) => corre(cwd, 'git', a);
const cola = t => String(t ?? '').trim().split('\n').slice(-25).join('\n').slice(-3000);

/** Las pruebas de verdad, fuera del modelo: pruebas, compilar y arrancar con datos falsos. Devuelve el fallo, o null. */
export async function compruebaObra(dir, { puerto = 4699 } = {}) {
	// Las pruebas dejan carpetas temporales: aquí se borran al acabar, para que no llenen el disco.
	const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'ofi-pruebas-'));
	const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: temporal };
	try { return await comprueba(dir, puerto, env); } finally { fs.rmSync(temporal, { recursive: true, force: true }); }
}

async function comprueba(dir, puerto, env) {
	try { await corre(dir, NODE_BIN, ['--test', ...fs.readdirSync(path.join(dir, 'test')).filter(f => f.endsWith('.test.mjs')).map(f => `test/${f}`)], { env }); }
	catch (e) { return `Las pruebas fallan:\n${cola(e.salida)}`; }
	try { await corre(dir, 'npx', ['vite', 'build', 'web'], { env }); }
	catch (e) { return `No compila:\n${cola(e.salida)}`; }
	const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'ofi-obra-'));
	const h = spawn(NODE_BIN, ['--no-warnings', 'server/index.mjs'], { cwd: dir, env: { ...env, OFICINA_SIMULACION: '1', OFICINA_DATOS: datos, OFICINA_PUERTO: String(puerto) }, stdio: 'ignore' });
	try {
		for (let i = 0; i < 20; i++) {
			await new Promise(r => setTimeout(r, 500));
			if (h.exitCode !== null) return 'La versión nueva no arranca';
			try {
				const r = await fetch(`http://127.0.0.1:${puerto}/api/oficina`, { headers: { 'tailscale-user-login': CONFIG.USUARIO } });
				if (r.ok) return null;
			} catch { /* aún no escucha */ }
		}
		return 'La versión nueva arranca pero no contesta';
	} finally { h.kill('SIGKILL'); fs.rmSync(datos, { recursive: true, force: true }); }
}

/** Reinicia la oficina: con launchd basta salir; sin él, deja lanzada la siguiente. */
export function reiniciaOficina(log = () => {}) {
	log('Reinicio tras una obra');
	if (!/com\.acme\.oficina/.test(process.env.XPC_SERVICE_NAME ?? '')) {
		const mac = process.platform === 'darwin';
		const dirLog = mac ? path.join(CONFIG.HOME, 'Library', 'Logs') : CONFIG.DATOS;
		const s = fs.openSync(path.join(dirLog, 'oficina.log'), 'a');
		// En el Mac, caffeinate para que no se duerma. En Linux o WSL no existe.
		spawn('/bin/sh', ['-c', `sleep 4; exec ${mac ? 'caffeinate -is ' : ''}"${NODE_BIN}" --no-warnings server/index.mjs`], { cwd: REPO, detached: true, stdio: ['ignore', s, s], env: process.env }).unref();
	}
	setTimeout(() => process.exit(0), 300);
}

export function crearObras({ db, bus, tareas = null, ocupada = () => false, bin = CONFIG.CLAUDE_BIN, ejecutor = ejecuta, repo = REPO, obra = OBRA, comprueba = compruebaObra, reinicia = reiniciaOficina, alAvisar = () => {}, log = () => {} }) {
	let enMarcha = false, turno = null;
	const dice = (texto, pasos = null) => {
		const n = db.run(`INSERT INTO mensajes (sala, autor, texto, pasos) VALUES (?, 'sala', ?, ?)`, HILO, texto, pasos ? JSON.stringify(pasos) : null);
		bus?.emit('evento', { tipo: 'mensaje', hilo: HILO, id: n.id });
		alAvisar({ desde: HILO, quien: 'Nico', asunto: /en marcha\.$/.test(texto) ? 'Mejora en marcha' : 'La obra', texto });
	};
	const pendientes = () => JSON.parse(db.ajuste('obras_cola') || '[]');
	const guardaCola = c => db.ajuste('obras_cola', JSON.stringify(c));

	async function preparaRama(id) {
		await git(repo, 'worktree', 'prune');
		if (fs.existsSync(obra)) await git(repo, 'worktree', 'remove', '--force', obra);
		await git(repo, 'worktree', 'add', '-q', '-B', `obra/${id}`, obra, 'HEAD');
		// Lo que git no guarda y hace falta para probar.
		for (const r of ['node_modules', 'web/public/agente', 'web/public/marca']) {
			const a = path.join(repo, r);
			if (fs.existsSync(a) && !fs.existsSync(path.join(obra, r))) fs.symlinkSync(a, path.join(obra, r));
		}
	}

	async function trabaja(o) {
		const id = o.id;
		turno = crearTurno({ dep: 'general', alCambio: () => bus?.emit('evento', { tipo: 'progreso', hilo: HILO, mensaje: id, ...turno.foto(), texto: turno.foto().ahora, interno: false }) });
		bus?.emit('evento', { tipo: 'estado', hilo: HILO, trabajando: true, interno: false });
		turno.dice('Nico se pone con la obra');
		await preparaRama(id);
		let sesion = null, texto = '', fallo = null, encargo = o.texto;
		// Dos intentos: si las pruebas fallan, se lo devuelve una vez.
		for (let i = 0; i < 2; i++) {
			const r = await ejecutor({
				bin, cwd: obra, env: CONFIG.ENV_CLAUDE,
				args: argsObra({ prompt: encargo, carpeta: obra, sesion }),
				auditar: t => fueraDeLista(t, 'general', 'obra'),
				tiempoMax: CONFIG.TIEMPO_ENCARGO_MS,
				alEvento: ev => turno.evento(ev),
			});
			sesion = r.sesion; texto = r.texto;
			turno.dice('Pasando las pruebas');
			await git(obra, 'add', '-A');
			if (await git(obra, 'status', '--porcelain')) await git(obra, 'commit', '-q', '-m', `Obra: ${o.texto.split('\n')[0].slice(0, 70)}`, '-m', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
			fallo = await comprueba(obra);
			if (!fallo) break;
			encargo = `Las comprobaciones han fallado. Arréglalo:\n${fallo}`;
		}
		if (fallo) { dice(`No la he podido dejar bien, así que no la he puesto en marcha: sigue todo como estaba. ${fallo.split('\n')[0]}.`, turno.resumen()); db.apunta('obra', `${id} falla: ${fallo.slice(0, 300)}`); return; }
		const archivos = (await git(obra, 'diff', '--name-only', 'main...HEAD').catch(() => git(obra, 'diff', '--name-only', 'HEAD~1', 'HEAD'))).split('\n').filter(Boolean);
		if (!archivos.length) { dice(texto || 'No ha hecho falta cambiar nada.', turno.resumen()); return; }
		const controles = tocaControles(archivos);
		if (controles.length && !o.conSi) {
			tareas?.crea({ equipo: 'alex', tipo: 'si', prioridad: 'alta', titulo: `Nico quiere tocar controles de la oficina: ${controles.join(', ')}`.slice(0, 280), detalle: `${o.texto.slice(0, 500)}\n\nArchivos: ${archivos.join(', ')}`, origen: 'equipo', datos: { hilo: HILO, obraLista: { id, rama: `obra/${id}`, resumen: texto.slice(0, 600) } } });
			dice('La tengo lista y probada, pero toca permisos o controles, así que te he dejado un sí en Tareas.', turno.resumen());
			return;
		}
		await pone(`obra/${id}`, texto, turno.resumen());
	}

	/** La pone en marcha: la funde en main, compila y reinicia cuando nadie esté a mitad de algo. */
	async function pone(rama, texto, pasos) {
		try { await git(repo, 'merge', '--no-edit', '-q', rama); }
		catch (e) { await git(repo, 'merge', '--abort').catch(() => {}); throw new Error(`No se ha podido juntar con lo que está en marcha: ${String(e.salida ?? e.message).split('\n')[0].slice(0, 120)}`); }
		try { await corre(repo, 'npx', ['vite', 'build', 'web'], { env: { PATH: process.env.PATH, HOME: process.env.HOME } }); }
		catch (e) { await git(repo, 'revert', '-m', '1', '--no-edit', 'HEAD').catch(() => {}); throw new Error(`No compila al ponerla en marcha, la he retirado: ${cola(e.salida).slice(-160)}`); }
		db.apunta('obra', `En marcha: ${rama}`);
		dice(`${String(texto).slice(0, 700) || 'Hecho.'}\n\nYa está en marcha.`, pasos);
		for (let i = 0; i < 60 && ocupada(); i++) await new Promise(r => setTimeout(r, 5000));
		reinicia(log);
	}

	async function siguiente() {
		if (enMarcha || CONFIG.SIMULACION) return;
		const c = pendientes();
		if (!c.length) return;
		enMarcha = true;
		const o = c[0];
		try { await trabaja(o); }
		catch (e) { db.apunta('obra', `${o.id}: ${e.message.slice(0, 300)}`); dice(`Se me ha cortado la obra y no he puesto nada en marcha: ${e.message.slice(0, 160)}`); }
		finally {
			guardaCola(pendientes().filter(x => x.id !== o.id));
			enMarcha = false; turno = null;
			bus?.emit('evento', { tipo: 'estado', hilo: HILO, trabajando: false, interno: false });
			siguiente();
		}
	}

	return {
		/** Entra en cola y se hace en cuanto se pueda. */
		encarga({ texto, conSi = false }) {
			const id = `${Date.now().toString(36)}`;
			guardaCola([...pendientes(), { id, texto: String(texto).slice(0, 8000), conSi }]);
			db.apunta('obra', `Encargo ${id}: ${String(texto).slice(0, 200)}`);
			siguiente();
			return id;
		},
		/** Una obra que tocaba controles, cuando él dice que sí. */
		aprobada(d) { return pone(d.rama, d.resumen, null); },
		enVivo: () => (turno ? { ...turno.foto(), cola: null } : null),
		arranca: () => siguiente(),
	};
}
