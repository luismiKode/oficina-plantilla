// Toda escritura lleva x-oficina: una web ajena no puede mandarla sin permiso del servidor.
async function pide(ruta, op = {}) {
	const r = await fetch(ruta, { ...op, headers: { 'x-oficina': '1', ...(op.headers ?? {}) } });
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
	return j;
}
export const lee = ruta => pide(ruta);
export const manda = (ruta, cuerpo = {}) => pide(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
export const mandaFormulario = (ruta, fd) => pide(ruta, { method: 'POST', body: fd });

// Eventos en vivo: una sola conexión y quien quiera se apunta.
const oyentes = new Set();
let fuente;
export function escucha(fn) {
	oyentes.add(fn);
	if (!fuente) {
		fuente = new EventSource('/api/eventos');
		fuente.onmessage = e => { const d = JSON.parse(e.data); for (const o of oyentes) o(d); };
		fuente.onopen = () => { for (const o of oyentes) o({ tipo: 'conectado' }); };
	}
	return () => oyentes.delete(fn);
}

export async function activarAvisos(clave) {
	const reg = await navigator.serviceWorker.ready;
	if (await Notification.requestPermission() !== 'granted') throw new Error('Permiso de avisos denegado en este dispositivo');
	const b = atob(clave.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(clave.length / 4) * 4, '='));
	const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(b, c => c.charCodeAt(0)) });
	await manda('/api/push/suscribir', sub.toJSON());
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = t => String(t).replace(/[&<>"']/g, c => ESC[c]);
/** Markdown mínimo y seguro: se escapa todo primero. Nada de enlaces: pueden venir de un correo. */
export function formato(t) {
	return esc(t).split(/\n{2,}/).map(bloque => {
		// Un bloque puede mezclar una frase y una lista: cada tramo por su lado.
		const salida = [];
		let lista = [], texto = [];
		const cierra = () => {
			if (texto.length) { salida.push(`<p>${texto.join('<br>')}</p>`); texto = []; }
			if (lista.length) { salida.push(`<ul>${lista.map(x => `<li>${x}</li>`).join('')}</ul>`); lista = []; }
		};
		for (const l of bloque.split('\n')) {
			const m = l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
			if (m) { if (texto.length) cierra(); lista.push(m[1]); }
			else { if (lista.length) cierra(); texto.push(l); }
		}
		cierra();
		return salida.join('');
	}).join('').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}

const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
export const fechaCorta = iso => { try { return FECHA.format(new Date(iso)).replace('.', ''); } catch { return iso; } };
export function diasHasta(iso) {
	const a = new Date(iso + 'T12:00:00'), h = new Date(); h.setHours(12, 0, 0, 0);
	return Math.round((a - h) / 86_400_000);
}
export function cuandoFue(iso) {
	if (!iso) return null;
	const m = Math.round((Date.now() - new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')) / 60_000);
	if (m < 2) return 'ahora mismo';
	if (m < 60) return `hace ${m} min`;
	if (m < 1440) return `hace ${Math.round(m / 60)} h`;
	return `hace ${Math.round(m / 1440)} días`;
}
