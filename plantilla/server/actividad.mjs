// Lo que está haciendo cada uno, contado para Alex. Sale del progreso real de Claude, nunca de lo que el modelo diga que hace.
import path from 'node:path';
import { EQUIPO } from './equipo.mjs';

const corto = (t, n = 60) => {
	const s = String(t ?? '').replace(/[\[\]<>]/g, ' ').replace(/\s+/g, ' ').trim();
	return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const cita = (t, n) => { const c = corto(t, n); return c ? `«${c}»` : ''; };

const ERP = {
	resumen: 'el resumen del ERP', tesoreria: 'la tesorería', movimientos: 'los movimientos del banco', facturas: 'las facturas', factura: 'una factura',
	pedidos: 'los pedidos', pedido: 'un pedido', entregas: 'las entregas', proveedores: 'los proveedores', ventas: 'las ventas', iva: 'el IVA',
	personal: 'el total de personal', categorias: 'las categorías', reglas: 'las reglas del ERP', escenarios: 'los escenarios', candidatos_conciliacion: 'lo que falta por conciliar',
};
const SERVICIOS = [[/meta-ads/, 'Mirando Meta'], [/google-ads/, 'Mirando Google Ads'], [/analytics/, 'Mirando GA4']];

function fraseHerramienta(h, e = {}) {
	const m = h.match(/^mcp__(.+?)__(.+)$/);
	const accion = m?.[2];
	if (/Gmail/.test(h)) {
		if (accion === 'search_threads') return `Buscando en el correo ${cita(e.query, 40)}`.trim();
		if (accion === 'get_thread' || accion === 'get_message') return 'Leyendo un correo';
		if (accion === 'create_draft') return 'Dejando el borrador en Gmail';
		if (accion === 'send_message') return 'Enviando el correo';
		return 'Mirando el correo';
	}
	if (/Calendar/.test(h)) return accion === 'search_events' ? `Buscando en la agenda ${cita(e.query, 40)}`.trim() : 'Mirando la agenda';
	if (/Drive/.test(h)) {
		if (accion === 'read_file_content') return 'Abriendo un documento de Drive';
		return `Buscando en Drive ${cita(e.query, 40)}`.trim();
	}
	if (/Slack/.test(h)) {
		if (/search/.test(accion ?? '')) return `Buscando en Slack ${cita(e.query, 40)}`.trim();
		return /user/.test(accion ?? '') ? 'Mirando quién es en Slack' : 'Leyendo Slack';
	}
	if (/mi-erp/.test(h)) return `Mirando ${ERP[accion] ?? 'el ERP'}`;
	if (/meta-ads/.test(h) && /create|update|activate|boost/.test(accion ?? '')) return 'Aplicando el cambio aprobado en Meta';
	const s = SERVICIOS.find(([re]) => re.test(h));
	if (s) return s[1];
	if (h === 'Read') {
		const r = String(e.file_path ?? '');
		return r.includes(`${path.sep}adjuntos${path.sep}`) ? 'Mirando lo que has adjuntado' : `Leyendo ${corto(path.basename(r), 50) || 'un archivo'}`;
	}
	if (h === 'Grep') return `Buscando ${cita(e.pattern, 40) || 'en el archivo'}`;
	if (h === 'Glob') return 'Buscando archivos';
	if (h === 'Edit') return `Cambiando ${corto(path.basename(String(e.file_path ?? '')), 50) || 'un archivo'}`;
	if (h === 'Bash') return /test/.test(String(e.command ?? '')) ? 'Pasando las pruebas' : /brew|npm install/.test(String(e.command ?? '')) ? 'Instalando lo que hace falta' : 'Trabajando en la obra';
	if (h === 'Write') return `Escribiendo ${corto(path.basename(String(e.file_path ?? '')), 50) || 'un documento'}`;
	if (h === 'Skill') return 'Repasando cómo se hace';
	return 'Trabajando';
}

/** Una frase por cada cosa que hace. Null si no hay nada que contar. */
export function fraseDe(ev, dep) {
	if (ev.tipo === 'escribe') return 'Escribiendo';
	if (ev.tipo === 'piensa') return 'Pensando';
	if (ev.tipo !== 'herramienta') return null;
	if (ev.herramienta === 'Agent' || ev.herramienta === 'Task') {
		const p = EQUIPO[dep]?.find(x => x.rol && x.rol === ev.entrada?.subagent_type);
		const para = corto(ev.entrada?.description, 50);
		return `${p ? `Preguntando a ${p.nombre}` : 'Preguntando a alguien'}${para ? `: ${para}` : ''}`;
	}
	return fraseHerramienta(ev.herramienta, ev.entrada);
}

/** Lo que lleva hecho en este turno. Pensar y escribir son el momento; lo demás queda como pasos. */
export function crearTurno({ dep, alCambio = () => {} }) {
	const desde = Date.now();
	const pasos = [];
	const subagentes = new Map();
	let ahora = '';
	const pon = (texto, esPaso) => {
		if (!texto || texto === ahora) return;
		ahora = texto;
		if (esPaso && pasos.at(-1)?.texto !== texto) { pasos.push({ texto, s: Math.round((Date.now() - desde) / 1000) }); if (pasos.length > 40) pasos.shift(); }
		alCambio();
	};
	return {
		evento(ev) {
			let f = fraseDe(ev, dep);
			if (!f) return;
			if (ev.tipo === 'herramienta' && (ev.herramienta === 'Agent' || ev.herramienta === 'Task') && ev.id) {
				subagentes.set(ev.id, EQUIPO[dep]?.find(x => x.rol === ev.entrada?.subagent_type)?.nombre ?? 'Alguien');
			}
			// Lo que hace un compañero al que ha preguntado lleva su nombre.
			if (ev.padre) {
				if (ev.tipo !== 'herramienta') return;
				f = `${subagentes.get(ev.padre) ?? 'Alguien'}: ${f[0].toLowerCase()}${f.slice(1)}`;
			}
			pon(f, ev.tipo === 'herramienta');
		},
		dice(texto) { pon(texto, true); },
		foto: () => ({ desde, ahora, pasos: [...pasos] }),
		resumen: () => ({ pasos: pasos.slice(-40), ms: Date.now() - desde }),
	};
}
