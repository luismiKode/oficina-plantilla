// Lanza `claude -p`, sigue su progreso y vigila sus permisos en cada turno.
// Si el `init` trae una herramienta fuera de la lista, se mata el proceso antes de que haga nada.
import { spawn } from 'node:child_process';

export class ErrorSesionCaducada extends Error { constructor(m) { super(m); this.name = 'ErrorSesionCaducada'; } }
export class ErrorLimite extends Error { constructor(m) { super(m); this.name = 'ErrorLimite'; } }
export class ErrorPermisos extends Error {
	constructor(extras) { super(`Herramientas fuera de lista: ${extras.join(', ')}`); this.name = 'ErrorPermisos'; this.extras = extras; }
}

const RE_SESION = /not logged in|please run \/login|invalid api key|oauth token has expired|authentication_error|login required/i;
const RE_LIMITE = /rate limit|usage limit|hit your limit|limit reached|overloaded/i;

function clasifica(texto) {
	if (RE_SESION.test(texto)) return new ErrorSesionCaducada(texto.slice(0, 300));
	if (RE_LIMITE.test(texto)) return new ErrorLimite(texto.slice(0, 300));
	return new Error(texto.slice(0, 400) || 'claude terminó sin respuesta');
}

/**
 * @param {{bin:string, args:string[], cwd:string, env?:object, auditar?:(tools:string[])=>string[], alEvento?:(e:object)=>void, tiempoMax?:number}} p
 * @returns {Promise<{texto:string, sesion:string|null, ms:number, coste:number|null, estructurado:any}>}
 */
const NADA = () => [];
let alUso = null;
/** Se avisa de cada ejecución acabada, para medir lo que se gasta. */
export function registraUso(fn) { alUso = fn; }
export function ejecuta({ bin, args, cwd, env = {}, auditar = NADA, alEvento = () => {}, tiempoMax = 300_000 }) {
	// El modo de permisos tiene que ser el pedido: si no, el global del usuario lo saltaría todo.
	const iModo = args.indexOf('--permission-mode');
	const modoPedido = iModo >= 0 ? args[iModo + 1] : null;
	return new Promise((resolve, reject) => {
		const t0 = Date.now();
		const hijo = spawn(bin, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
		let resto = '', err = '', final = null, sesion = null, abortado = null, porTiempo = false, huboInit = false, acabado = false;
		const mata = () => { hijo.kill('SIGKILL'); };
		let remate;
		const fin = fn => { if (acabado) return; acabado = true; clearTimeout(reloj); clearTimeout(remate); fn(); };
		const reloj = setTimeout(() => {
			porTiempo = true;
			hijo.kill('SIGTERM');
			// Si no se va, o un hijo suyo se queda con la tubería, no dejamos colgada la cola.
			remate = setTimeout(() => { mata(); fin(() => reject(new Error('Se ha pasado de tiempo'))); }, 10_000);
			remate.unref?.();
		}, tiempoMax);

		const linea = l => {
			let d; try { d = JSON.parse(l); } catch { return; }
			if (d.session_id) sesion = d.session_id;
			if (d.type === 'system' && d.subtype === 'init') {
				huboInit = true;
				if (modoPedido && d.permissionMode && d.permissionMode !== modoPedido) { abortado = new ErrorPermisos([`modo de permisos ${d.permissionMode}`]); return mata(); }
				const extras = auditar(d.tools || []);
				if (extras.length) { abortado = new ErrorPermisos(extras); mata(); }
			} else if (d.type === 'stream_event') {
				const b = d.event?.content_block;
				if (d.event?.type === 'content_block_start' && b?.type === 'text') alEvento({ tipo: 'escribe' });
				if (d.event?.type === 'content_block_start' && b?.type === 'thinking') alEvento({ tipo: 'piensa' });
			} else if (d.type === 'assistant') {
				for (const c of d.message?.content || []) {
					if (c.type !== 'tool_use') continue;
					// Un subagente no se sale a otro sitio, ni a la nube ni a otra copia del repo.
					if ((c.name === 'Agent' || c.name === 'Task') && c.input?.isolation) { abortado = new ErrorPermisos(['Agent con isolation']); return mata(); }
					alEvento({ tipo: 'herramienta', herramienta: c.name, entrada: c.input });
				}
			} else if (d.type === 'result') final = d;
		};
		hijo.stdout.on('data', t => {
			resto += t;
			let i;
			while ((i = resto.indexOf('\n')) >= 0) { const l = resto.slice(0, i).trim(); resto = resto.slice(i + 1); if (l) linea(l); }
		});
		hijo.stderr.on('data', t => { err += t; });
		hijo.on('error', e => { fin(() => reject(e)); });
		hijo.on('close', code => fin(() => {
			if (resto.trim()) linea(resto.trim());
			if (abortado) return reject(abortado);
			if (porTiempo) return reject(new Error('Se ha pasado de tiempo'));
			if (final && !final.is_error) {
				if (!huboInit && auditar !== NADA) return reject(new Error('Claude no dijo qué herramientas tenía'));
				try { alUso?.({ ms: Date.now() - t0, coste: final.total_cost_usd ?? 0 }); } catch { /* medir no rompe nada */ }
				return resolve({ texto: typeof final.result === 'string' ? final.result : '', sesion: final.session_id || sesion, ms: Date.now() - t0, coste: final.total_cost_usd ?? null, estructurado: final.structured_output ?? null });
			}
			reject(clasifica(String(final?.result ?? '') + ' ' + err + (final ? '' : ` (código ${code})`)));
		}));
	});
}
