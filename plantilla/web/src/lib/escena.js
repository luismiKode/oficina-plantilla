// El edificio de Acme, en píxeles. Se pinta a baja resolución y se amplía nítido.
// Varias plantas, un ascensor, y cada uno con su vida: teclea, se levanta, va al agua, visita a un compañero,
// sube a las reuniones y Tere lleva los correos. Nada de esto depende de un motor de juegos.

const NEGRO = '#191919';
const PLANTAS = {
	general: { nombre: 'Dirección', pared: '#3b2f4a', oscura: '#2e2439', suelo1: '#6b4a32', suelo2: '#5f412c' },
	marketing: { nombre: 'Marketing', pared: '#a84d6f', oscura: '#8f3f5d', suelo1: '#c9a67e', suelo2: '#bd9a72' },
	produccion: { nombre: 'Producción', pared: '#c98a2e', oscura: '#ad7524', suelo1: '#8c8f94', suelo2: '#7f8287' },
	finanzas: { nombre: 'Finanzas', pared: '#3f7f5f', oscura: '#346b4f', suelo1: '#b98f62', suelo2: '#ad8357' },
	fiscal: { nombre: 'Fiscal', pared: '#2f7f8f', oscura: '#276b79', suelo1: '#c2b59b', suelo2: '#b6a98f' },
	legal: { nombre: 'Legal', pared: '#7f3333', oscura: '#6b2a2a', suelo1: '#7a5236', suelo2: '#6e4930' },
	reuniones: { nombre: 'Sala de reuniones', pared: '#4a5a78', oscura: '#3d4b65', suelo1: '#a98e6f', suelo2: '#9d8263', sala: true },
	vestibulo: { nombre: 'Recepción', pared: '#8a7a64', oscura: '#756752', suelo1: '#d8d0c0', suelo2: '#cbc3b3', vestibulo: true },
};
const ORDEN = ['general', 'marketing', 'produccion', 'finanzas', 'fiscal', 'legal', 'reuniones', 'vestibulo'];
// Lo que pueden elegir (server/decoracion.mjs)
const PARED = { vino: ['#7f3333', '#6b2a2a'], burdeos: ['#5c1f3a', '#4a1830'], rosa: ['#a84d6f', '#8f3f5d'], naranja: ['#c9702e', '#ad5f24'], mostaza: ['#c98a2e', '#ad7524'], verde: ['#3f7f5f', '#346b4f'], oliva: ['#6b7a3a', '#5a682f'], turquesa: ['#2f7f8f', '#276b79'], azul: ['#35558f', '#2c4779'], noche: ['#3b2f4a', '#2e2439'], grafito: ['#3f444d', '#343840'], crema: ['#c9bda0', '#b5a98c'] };
const SUELO = { madera: ['#c9a67e', '#bd9a72'], roble: ['#8f6a42', '#835f39'], nogal: ['#6b4a32', '#5f412c'], baldosa: ['#d8d0c0', '#cbc3b3'], industrial: ['#8c8f94', '#7f8287'], moqueta: ['#5a6478', '#505a6c'], verde: ['#6f8f6a', '#63825f'], terracota: ['#b5714a', '#a86640'] };

const CARAS = {
	corto: ['...hhhhhh...', '..hhhhhhhh..', '..hssssssh..', '..ssssssss..', '..ssessess..', '..ssssssss..', '..sssmmsss..', '...ssssss...', '....ssss....'],
	rizo: ['..hhhhhhhh..', '.hhhhhhhhhh.', '.hhssssssh..', '..ssssssss..', '..ssessess..', '..ssssssss..', '..sssmmsss..', '...ssssss...', '....ssss....'],
	melena: ['...hhhhhh...', '..hhhhhhhh..', '.hhhsssshhh.', '.hhsssssshh.', '.hhsesseshh.', '.hhsssssshh.', '.hhssmmsshh.', '.hhhsssshhh.', '.hhh.ss.hhh.'],
	mono: ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..', '..hssssssh..', '..ssessess..', '..ssssssss..', '..sssmmsss..', '...ssssss...', '....ssss....'],
	calvo: ['...ssssss...', '..ssssssss..', '..ssssssss..', '..ssssssss..', '..ssessess..', '..ssssssss..', '..sssmmsss..', '...ssssss...', '....ssss....'],
	cresta: ['.....hh.....', '.....hh.....', '..sshhhhss..', '..ssssssss..', '..ssessess..', '..ssssssss..', '..sssmmsss..', '...ssssss...', '....ssss....'],
};
const TORSO = ['..cccccccc..', '.cccaaaaccc.', '.cccccccccc.', '.cccccccccc.', '.ss.cccc.ss.'];
const PIERNAS = [['..ppp..ppp..', '..ppp..ppp..', '..zzz..zzz..'], ['..ppp..ppp..', '...pp..ppp..', '...zz..zzz..'], ['..ppp..ppp..', '..ppp..pp...', '..zzz..zz...']];

function filasCara(l) {
	const f = (CARAS[l.pelo] ?? CARAS.corto).slice();
	const cambia = (i, d, t) => { f[i] = f[i].slice(0, d) + t + f[i].slice(d + t.length); };
	if (l.gafas) cambia(4, 3, 'geggeg');
	if (l.barba) { cambia(6, 2, 'bbbmmbbb'); cambia(7, 3, 'bbbbbb'); }
	if (l.bigote) cambia(6, 4, 'bbbb');
	return f;
}
function pinta(g, filas, ox, oy, col) {
	for (let y = 0; y < filas.length; y++) {
		const fila = filas[y];
		for (let x = 0; x < fila.length; x++) {
			const c = col[fila[x]];
			if (c) { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); }
		}
	}
}
function colores(l, parpadeo) {
	return { h: l.colorPelo, s: l.piel, e: parpadeo ? l.piel : NEGRO, m: '#a8443f', c: l.ropa, a: l.acento ?? l.ropa, g: NEGRO, b: l.colorPelo === '#222' ? '#333' : l.colorPelo, p: '#2c3040', z: '#14161c' };
}
function cascos(g, l, ox, oy) {
	if (!l.cascos) return;
	g.fillStyle = NEGRO; g.fillRect(ox + 2, oy - 1, 8, 1); g.fillRect(ox + 1, oy, 1, 4); g.fillRect(ox + 10, oy, 1, 4);
	g.fillStyle = l.acento ?? '#ff4fa3'; g.fillRect(ox + 1, oy + 3, 1, 2); g.fillRect(ox + 10, oy + 3, 1, 2);
}
function cuerpoSentado(g, l, ox, oy, parpadeo) {
	pinta(g, [...filasCara(l), ...TORSO], ox, oy, colores(l, parpadeo));
	cascos(g, l, ox, oy);
}
function cuerpoDePie(g, l, ox, pies, paso, lleva) {
	const oy = pies - 17;
	pinta(g, [...filasCara(l), ...TORSO, ...PIERNAS[paso]], ox, oy, colores(l, false));
	cascos(g, l, ox, oy);
	if (lleva) { g.fillStyle = '#fff'; g.fillRect(ox + 8, oy + 10, 7, 5); g.fillStyle = '#c9302c'; g.fillRect(ox + 11, oy + 12, 1, 1); }
}

/** Retrato para el chat y las listas. */
export function pintaRetrato(c, look) {
	c.width = 14; c.height = 15;
	const g = c.getContext('2d');
	g.clearRect(0, 0, 14, 15);
	if (look) cuerpoSentado(g, look, 1, 1, false);
}

function cielo(h) {
	if (h < 6 || h >= 22) return ['#0d1430', '#121b3d', '#18244a', false];
	if (h < 8) return ['#f2a38c', '#f7c59f', '#a8c8e8', true];
	if (h < 18) return ['#7ec4ec', '#a4d8f2', '#cdeaf7', true];
	if (h < 20) return ['#f58a5f', '#fbb276', '#fdd9a0', true];
	return ['#3a2a5a', '#5a3a6a', '#a05a6a', false];
}

export function crearEscena(canvas, { alCambiar = () => {} } = {}) {
	const g = canvas.getContext('2d');
	let W = 300, H = 400, plantas = [], actores = new Map(), hechoReuniones = new Set(), t = 0, fondo = null, ultimoFondo = -1, vivo = true, reloj = null;
	let datos = null, gato = { x: 60, dir: 1, espera: 0 };
	const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

	// --- Plano
	function planifica(oficina, anchoCss) {
		W = anchoCss >= 700 ? 300 : 176;
		const util = W - 24;
		const porFila = W === 300 ? 6 : 3;
		const salaDe = id => oficina.salas.find(s => s.id === id);
		let y = 0;
		const ant = actores;
		const nuevos = new Map();
		plantas = ORDEN.map((id, f) => {
			const def = PLANTAS[id];
			let gente = [];
			if (id === 'general') gente = salaDe('general').personas.filter(p => p.rol !== 'recepcion');
			else if (id === 'vestibulo') gente = salaDe('general').personas.filter(p => p.rol === 'recepcion');
			else if (!def.sala) gente = salaDe(id)?.personas ?? [];
			const filas = Math.max(1, Math.ceil(gente.length / porFila));
			const alto = 32 + filas * 46 + 22;
			const deco = salaDe(id)?.decoracion ?? null;
			const planta = { id, f, ...def, y, alto, filas, gente, pasillo: y + alto - 3, tareas: salaDe(id)?.tareas ?? 0, deco };
			if (deco) {
				if (PARED[deco.pared]) [planta.pared, planta.oscura] = PARED[deco.pared];
				if (SUELO[deco.suelo]) [planta.suelo1, planta.suelo2] = SUELO[deco.suelo];
			}
			gente.forEach((p, i) => {
				const fila = Math.floor(i / porFila), col = i % porFila;
				const enFila = Math.min(gente.length - fila * porFila, porFila);
				const paso = util / porFila;
				const x = Math.round(4 + paso * col + paso / 2 + (porFila - enFila) * paso * (id === 'vestibulo' ? 0 : 0));
				const dy = y + 32 + fila * 46 + 16;
				const a = ant.get(p.hilo) ?? { hilo: p.hilo, modo: 'sentado', ruta: [], espera: 0, paso: 0 };
				Object.assign(a, { look: p.look, nombre: p.nombre, cargo: p.cargo, trabajando: p.trabajando, sinLeer: p.sinLeer, casa: { f, x, y: dy } });
				if (a.modo === 'sentado' || !a.pos) a.pos = { f, x, y: planta.pasillo };
				nuevos.set(p.hilo, a);
			});
			y += alto + 3;
			return planta;
		});
		actores = nuevos;
		H = y;
		canvas.width = W; canvas.height = H;
		fondo = null;
	}

	// --- Rutas
	const xAscensor = () => W - 14;
	function irA(a, f, x, luego, lleva = false) {
		if (a.modo === 'sentado' || a.modo === 'reunido') { a.pos = a.modo === 'sentado' ? { f: a.casa.f, x: a.casa.x, y: plantas[a.casa.f].pasillo } : { f: a.pos.f, x: a.pos.x, y: plantas[a.pos.f].pasillo }; }
		a.modo = 'ruta';
		a.lleva = lleva;
		a.ruta = a.pos.f === f ? [{ x }] : [{ x: xAscensor() }, { sube: f }, { x }];
		a.luego = luego;
	}
	const aCasa = a => irA(a, a.casa.f, a.casa.x, () => { a.modo = 'sentado'; a.lleva = false; });

	const plantaReuniones = () => plantas.find(p => p.sala);
	const plazaMesa = i => {
		const p = plantaReuniones();
		const n = W === 300 ? 8 : 4;
		const util = W - 60;
		return { f: p.f, x: Math.round(18 + (util / n) * (i % n) + util / n / 2) };
	};
	const ocupaMesa = new Map();

	function vida() {
		if (quieto) return;
		const lista = [...actores.values()];
		const andando = lista.filter(a => a.modo !== 'sentado' && a.modo !== 'reunido').length;
		if (andando >= (W === 300 ? 5 : 3) || Math.random() > 0.22) return;
		const a = lista[Math.floor(Math.random() * lista.length)];
		if (!a || a.modo !== 'sentado' || a.trabajando || a.enReunion) return;
		const r = Math.random();
		const vuelve = (min, max) => { a.modo = 'parado'; a.espera = min + Math.random() * (max - min); a.alAcabar = () => aCasa(a); };
		if (r < 0.5) irA(a, a.casa.f, W - 34, () => { a.modo = 'parado'; a.habla = true; vuelve(40, 90); });
		else if (r < 0.85) {
			const otros = lista.filter(o => o !== a && o.casa.f === a.casa.f && o.modo === 'sentado');
			if (!otros.length) return;
			const o = otros[Math.floor(Math.random() * otros.length)];
			irA(a, a.casa.f, o.casa.x + 12, () => { a.habla = true; vuelve(40, 100); });
		} else {
			irA(a, plantas.at(-1).f, 30 + Math.random() * 40, () => vuelve(50, 110));
		}
	}

	function sincroniza(oficina) {
		datos = oficina;
		const enMesa = new Set(oficina.enReunion.flatMap(r => r.hilos));
		let i = 0;
		for (const a of actores.values()) {
			if (enMesa.has(a.hilo)) {
				if (!a.enReunion && !quieto) {
					a.enReunion = true;
					const pl = plazaMesa(i);
					irA(a, pl.f, pl.x, () => { a.modo = 'reunido'; });
				} else if (!a.enReunion) { a.enReunion = true; }
				i++;
			} else if (a.enReunion) {
				a.enReunion = false;
				aCasa(a);
			}
			if (a.trabajando && (a.modo === 'parado' || (a.modo === 'ruta' && !a.enReunion && !a.lleva))) aCasa(a);
		}
	}

	/** Alguien le lleva algo a alguien: Tere con un correo, o un recado entre plantas. */
	function recado(de, a) {
		if (quieto) return;
		const origen = actores.get(de), destino = actores.get(a);
		if (!origen || !destino || origen.modo !== 'sentado') return;
		irA(origen, destino.casa.f, destino.casa.x + 12, () => {
			origen.modo = 'parado'; origen.habla = true; origen.lleva = false; origen.espera = 30; origen.alAcabar = () => aCasa(origen);
		}, true);
	}

	function avanza() {
		t++;
		for (const a of actores.values()) {
			if (a.modo === 'parado') {
				if (--a.espera <= 0) { a.habla = false; a.alAcabar?.(); }
				continue;
			}
			if (a.modo !== 'ruta') continue;
			const tramo = a.ruta[0];
			if (!tramo) { const l = a.luego; a.luego = null; a.modo = 'parado'; a.espera = 1; a.alAcabar = () => {}; l?.(); continue; }
			if (tramo.sube !== undefined) {
				const pl = plantas[tramo.sube];
				const objetivo = pl.pasillo;
				const dy = objetivo - a.pos.y;
				a.enAscensor = true;
				if (Math.abs(dy) <= 3) { a.pos.y = objetivo; a.pos.f = tramo.sube; a.enAscensor = false; a.ruta.shift(); }
				else a.pos.y += Math.sign(dy) * 3;
			} else {
				const dx = tramo.x - a.pos.x;
				if (Math.abs(dx) <= 1.3) { a.pos.x = tramo.x; a.ruta.shift(); }
				else { a.pos.x += Math.sign(dx) * 1.3; a.paso = t % 2 ? 1 : 2; }
			}
		}
		if (!quieto) {
			const ve = plantas.at(-1);
			if (ve) {
				if (gato.espera-- <= 0) {
					gato.x += gato.dir * 0.7;
					if (gato.x > W - 40 || gato.x < 44) gato.dir *= -1;
					if (Math.random() < 0.01) gato.espera = 30 + Math.random() * 60;
				}
			}
			if (t % 10 === 0) vida();
		}
	}

	// --- Dibujo
	const r = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w, h); };

	/** Los huecos de la pared: primero el panel de KPI, luego lo que hayan elegido, y ventanas en lo que sobre. */
	function ranuras(p) {
		const ini = W === 300 ? 74 : 50, fin = W - 26;
		const lista = [];
		let x = ini;
		const cabe = w => x + w <= fin;
		if (p.deco?.kpis?.length && cabe(W === 300 ? 66 : 62)) { const w = W === 300 ? 66 : 62; lista.push({ tipo: 'panel', x, w }); x += w + 4; }
		for (const t of p.deco?.pared_objetos ?? []) {
			const w = t === 'neon' ? 44 : t === 'ventana' ? 44 : t === 'mapa' || t === 'estanteria' ? 34 : t === 'pizarra' || t === 'tele' ? 30 : 20;
			if (cabe(w)) { lista.push({ tipo: t, x, w }); x += w + 4; }
		}
		while (cabe(44)) { lista.push({ tipo: 'ventana', x, w: 44 }); x += 48; }
		return lista;
	}
	function ventana(c, x, y, w, s1, s2, s3, dia, f) {
		const a = 15;
		r(c, x, y - 2, w, a + 4, '#e9e1c9');
		const dx = x + 2, dw = w - 4;
		r(c, dx, y, dw, 5, s1); r(c, dx, y + 5, dw, 5, s2); r(c, dx, y + 10, dw, 5, s3);
		if (dia) { for (let k = 0; k < dw; k++) { const al = 2 + Math.round(2 * Math.sin(k / 5 + f + x)); r(c, dx + k, y + 15 - al, 1, al, '#7a8fb0'); } }
		else { r(c, dx + 6, y + 3, 1, 1, '#fff'); r(c, dx + 24, y + 6, 1, 1, '#fff'); r(c, dx + 31, y + 2, 1, 1, '#fff4a8'); }
		r(c, dx + dw / 2 - 1, y, 2, a, '#e9e1c9');
	}
	function objetoPared(g2, h, y, tt) {
		const { tipo, x, w } = h;
		if (tipo === 'panel') { r(g2, x, y - 2, w, 21, NEGRO); r(g2, x + 1, y - 1, w - 2, 19, '#10141c'); return; }
		if (tipo === 'cuadro') { r(g2, x, y - 1, w, 18, '#6f4628'); r(g2, x + 2, y + 1, w - 4, 14, '#f2e7c9'); r(g2, x + 4, y + 7, w - 8, 6, '#3f8f8a'); r(g2, x + 8, y + 3, 4, 4, '#e0a020'); return; }
		if (tipo === 'tele') { r(g2, x, y, w, 15, NEGRO); r(g2, x + 1, y + 1, w - 2, 13, ['#2a5a9a', '#3a7aaa', '#6a3a8a'][(tt >> 4) % 3]); r(g2, x + 3 + ((tt >> 1) % 8), y + 4, 6, 3, '#fff'); r(g2, x + 3, y + 10, w - 6, 1, '#ffd23f'); return; }
		if (tipo === 'pizarra') { r(g2, x, y - 1, w, 18, '#9a9a9a'); r(g2, x + 1, y, w - 2, 16, '#fbfbfb'); r(g2, x + 3, y + 3, 10, 1, '#c9302c'); r(g2, x + 3, y + 6, 18, 1, '#2f7bd9'); r(g2, x + 3, y + 9, 7, 1, '#3aa64a'); r(g2, x + 14, y + 10, 8, 4, '#ffd23f'); return; }
		if (tipo === 'neon') { r(g2, x, y + 1, w, 13, NEGRO); r(g2, x + 1, y + 2, w - 2, 11, (tt >> 3) % 9 ? '#1c0f22' : '#14091a'); return; }
		if (tipo === 'reloj') { const cx = x + 10, cy = y + 8; r(g2, cx - 7, cy - 6, 14, 12, NEGRO); r(g2, cx - 6, cy - 7, 12, 14, NEGRO); r(g2, cx - 6, cy - 5, 12, 10, '#fff4d6'); r(g2, cx - 5, cy - 6, 10, 12, '#fff4d6'); const d = new Date(); const an = (d.getHours() % 12 + d.getMinutes() / 60) * Math.PI / 6 - Math.PI / 2; const am = d.getMinutes() * Math.PI / 30 - Math.PI / 2; for (let i = 1; i <= 3; i++) r(g2, cx + Math.round(Math.cos(an) * i), cy + Math.round(Math.sin(an) * i), 1, 1, NEGRO); for (let i = 1; i <= 5; i++) r(g2, cx + Math.round(Math.cos(am) * i), cy + Math.round(Math.sin(am) * i), 1, 1, '#d2462f'); return; }
		if (tipo === 'bandera') { r(g2, x + 2, y - 1, 1, 18, '#6f4628'); r(g2, x + 3, y, w - 6, 5, '#c9302c'); r(g2, x + 3, y + 5, w - 6, 3, '#ffd23f'); r(g2, x + 3, y + 8, w - 6, 3, '#c9302c'); return; }
		if (tipo === 'mapa') { r(g2, x, y - 1, w, 18, '#6f4628'); r(g2, x + 1, y, w - 2, 16, '#a9d5e8'); r(g2, x + 4, y + 3, 9, 6, '#6fa35a'); r(g2, x + 17, y + 5, 12, 8, '#6fa35a'); r(g2, x + 8, y + 5, 1, 1, '#c9302c'); r(g2, x + 22, y + 8, 1, 1, '#c9302c'); return; }
		if (tipo === 'diana') { const cx = x + 10, cy = y + 8; [[7, '#191919'], [6, '#f2e7c9'], [4, '#c9302c'], [2, '#f2e7c9'], [1, '#3aa64a']].forEach(([ra, co]) => { r(g2, cx - ra, cy - ra + 1, ra * 2, ra * 2 - 2, co); r(g2, cx - ra + 1, cy - ra, ra * 2 - 2, ra * 2, co); }); return; }
		if (tipo === 'estanteria') { r(g2, x, y - 1, w, 18, '#6f4628'); r(g2, x + 1, y, w - 2, 7, '#3f2a18'); r(g2, x + 1, y + 9, w - 2, 7, '#3f2a18'); ['#c9302c', '#2f7bd9', '#ffd23f', '#3aa64a', '#fff', '#e8590c', '#845ef7'].forEach((co, i) => { r(g2, x + 2 + i * 4, y + 1, 3, 6, co); r(g2, x + 2 + ((i * 7) % 28), y + 10, 3, 6, co); }); }
	}
	function objetoSuelo(g2, tipo, x, pies, tt) {
		const q = (dx, dy, w, h, co) => r(g2, x + dx, pies + dy, w, h, co);
		if (tipo === 'gato') { const o = '#3a3a3a'; q(0, -5, 9, 3, o); q(1, -6, 7, 1, o); q(7, -8, 4, 4, o); q(7, -9, 1, 1, o); q(10, -9, 1, 1, o); q(8, -6, 1, 1, '#ffd23f'); q(-2, -4 + ((tt >> 3) % 2), 2, 1, o); return; }
		if (tipo === 'perro') { const o = '#b5854a', d = '#8a6233'; q(0, -7, 11, 5, o); q(0, -2, 2, 2, d); q(9, -2, 2, 2, d); q(9, -11, 5, 5, o); q(13, -9, 2, 2, d); q(12, -10, 1, 1, NEGRO); q(-2, -7 - ((tt >> 2) % 2), 2, 1, o); return; }
		if (tipo === 'planta') { q(0, -6, 9, 6, '#c2552f'); for (let i = 0; i < 10; i += 2) { q(3, -16 + i, 2, 2, '#3f8f3a'); q(i % 4 ? 0 : 5, -15 + i, 4, 2, i % 4 ? '#3f8f3a' : '#62b84f'); } return; }
		if (tipo === 'arbol') { q(1, -6, 11, 6, '#8a5a34'); q(5, -14, 3, 8, '#6f4628'); q(-1, -25, 15, 11, '#3f8f3a'); q(2, -28, 9, 4, '#62b84f'); return; }
		if (tipo === 'altavoz') { q(0, -16, 9, 16, '#26262c'); q(2, -14, 5, 5, '#55555f'); q(1, -8, 7, 7, '#55555f'); q(3, -6, 3, 3, '#111'); if ((tt >> 2) % 3) { q(11, -18 - ((tt >> 2) % 4), 2, 2, '#ffd23f'); q(13, -22 - ((tt >> 2) % 4), 1, 3, '#ffd23f'); } return; }
		if (tipo === 'cafetera') { q(0, -9, 14, 9, '#8a5a34'); q(2, -19, 10, 10, '#5a5f6a'); q(4, -17, 6, 4, '#1b1d23'); q(5, -12, 4, 3, '#fff'); if ((tt >> 3) % 2) q(6, -23, 1, 3, '#ddd'); return; }
		if (tipo === 'trofeo') { q(1, -7, 10, 7, '#8a5a34'); q(3, -16, 6, 8, '#ffd23f'); q(1, -15, 2, 3, '#ffd23f'); q(9, -15, 2, 3, '#ffd23f'); q(5, -8, 2, 1, '#e0a020'); return; }
		if (tipo === 'alfombra') { q(-6, -3, 40, 3, '#a61e4d'); q(-5, -2, 38, 1, '#ffd23f'); return; }
		if (tipo === 'lampara') { q(3, -22, 2, 22, '#26262c'); q(0, -26, 8, 5, '#ffd23f'); q(1, -1, 6, 1, '#26262c'); return; }
		if (tipo === 'sofa') { q(0, -10, 28, 4, '#2f7f8f'); q(0, -6, 28, 5, '#276b79'); q(-2, -9, 3, 8, '#2f7f8f'); q(27, -9, 3, 8, '#2f7f8f'); q(13, -6, 1, 4, '#1f5661'); return; }
		if (tipo === 'futbolin') { q(0, -9, 26, 7, '#3f8f3a'); q(0, -10, 26, 1, '#6f4628'); q(0, -2, 2, 2, '#6f4628'); q(24, -2, 2, 2, '#6f4628'); for (let i = 0; i < 3; i++) { q(5 + i * 8, -11, 1, 9, '#ccc'); q(5 + i * 8, -7 + ((tt >> 2) + i) % 3, 1, 2, i % 2 ? '#c9302c' : '#2f7bd9'); } return; }
		if (tipo === 'acuario') { q(0, -6, 20, 6, '#6f4628'); q(0, -18, 20, 12, '#8fd0f5'); q(0, -18, 20, 1, '#fff'); const fx = ((tt >> 2) % 14) + 2; q(fx, -13, 3, 2, '#ff922b'); q(((tt >> 3) * 3) % 15 + 2, -9, 2, 1, '#ffd23f'); return; }
		if (tipo === 'arcade') { q(0, -24, 13, 24, '#26262c'); q(1, -22, 11, 8, ['#2a5a9a', '#6a3a8a', '#0ca678'][(tt >> 3) % 3]); q(2, -12, 9, 3, '#c9302c'); q(3, -11, 1, 1, '#ffd23f'); q(7, -11, 2, 1, '#fff'); return; }
		if (tipo === 'bicicleta') { q(0, -6, 6, 6, '#26262c'); q(1, -5, 4, 4, 'transparent'); q(15, -6, 6, 6, '#26262c'); q(4, -9, 12, 1, '#c9302c'); q(6, -11, 1, 6, '#c9302c'); q(14, -11, 1, 6, '#c9302c'); return; }
		if (tipo === 'cajas') { q(0, -9, 12, 9, '#c79a55'); q(0, -9, 12, 1, '#a87a3a'); q(5, -8, 1, 8, '#a87a3a'); q(11, -6, 9, 6, '#b5884a'); q(3, -16, 8, 7, '#d6ad6c'); }
	}

	function pintaFondo() {
		const h = new Date().getHours();
		fondo = document.createElement('canvas');
		fondo.width = W; fondo.height = H;
		const c = fondo.getContext('2d');
		r(c, 0, 0, W, H, NEGRO);
		const [s1, s2, s3, dia] = cielo(h);
		for (const p of plantas) {
			r(c, 0, p.y, W, 32, p.pared);
			for (let x = 0; x < W; x += 7) r(c, x, p.y + 2, 1, 22, p.oscura);
			r(c, 0, p.y, W, 2, NEGRO);
			r(c, 0, p.y + 24, W, 8, p.oscura);
			r(c, 0, p.y + 31, W, 1, NEGRO);
			const huecos = ranuras(p);
			for (const h of huecos) if (h.tipo === 'ventana') ventana(c, h.x, p.y + 5, h.w, s1, s2, s3, dia, p.f);
			for (let y = p.y + 32, n = 0; y < p.y + p.alto; y += 6, n++) {
				r(c, 0, y, W, 6, n % 2 ? p.suelo1 : p.suelo2);
				r(c, 0, y + 5, W, 1, '#0002');
				for (let x = (n % 3) * 13; x < W; x += 39) r(c, x, y, 1, 5, '#0002');
			}
			r(c, 0, p.y + p.alto, W, 3, NEGRO);
			// Cartel de la planta: sitio para el texto
			r(c, 3, p.y + 5, 44, 15, NEGRO); r(c, 4, p.y + 6, 42, 13, '#f5efe0');
			// Agua
			if (!p.sala && !p.vestibulo) {
				const x = W - 32, y = p.y + p.alto - 26;
				r(c, x, y, 8, 6, '#bfe8ff'); r(c, x + 1, y + 1, 6, 4, '#8fd0f5'); r(c, x - 1, y + 6, 10, 16, '#e9e1c9'); r(c, x + 5, y + 9, 2, 2, '#4fe3ff'); r(c, x - 1, y + 22, 10, 1, NEGRO);
			}
			// Planta
			if (!p.sala) {
				const x = 6, y = p.y + p.alto - 20;
				r(c, x, y + 12, 9, 6, '#c2552f'); r(c, x - 1, y + 12, 11, 2, '#d9693f');
				for (let i = 0; i < 12; i += 2) { r(c, x + 3, y + i, 2, 2, '#3f8f3a'); r(c, x + (i % 4 ? 0 : 5), y + i + 1, 4, 2, i % 4 ? '#3f8f3a' : '#62b84f'); }
			}
			if (p.sala) {
				const tx = 14, ty = p.y + p.alto - 26, tw = W - 52;
				r(c, tx + 2, ty + 12, tw, 2, '#0003');
				r(c, tx, ty, tw, 4, '#8a5a34'); r(c, tx, ty, tw, 1, '#a87446'); r(c, tx, ty + 4, tw, 8, '#6f4628');
				// Pantalla de la sala
				const px = W === 300 ? 90 : 56, py = p.y + 4;
			}
			if (p.vestibulo) {
				// La máquina de café y el mostrador
				const x = W - 58, y = p.y + p.alto - 34;
				r(c, x, y, 18, 30, '#5a5f6a'); r(c, x + 2, y + 3, 14, 9, '#1b1d23'); r(c, x + 4, y + 16, 10, 6, '#2c3040'); r(c, x + 7, y + 19, 4, 3, '#fff');
			}
		}
		// Hueco del ascensor
		r(c, W - 22, 0, 22, H, '#3a3d45');
		for (let y = 0; y < H; y += 12) r(c, W - 22, y, 22, 1, '#2c2f36');
		r(c, W - 21, 0, 1, H, '#1f2127'); r(c, W - 2, 0, 1, H, '#1f2127');
		for (const p of plantas) {
			r(c, W - 22, p.pasillo - 22, 18, 22, '#8d929c');
			r(c, W - 21, p.pasillo - 21, 8, 21, '#6e737d'); r(c, W - 12, p.pasillo - 21, 7, 21, '#6e737d');
			r(c, W - 13, p.pasillo - 21, 1, 21, NEGRO);
		}
		return fondo;
	}

	function pantalla(tipo, x, y, tt, rapido) {
		const k = rapido ? tt : tt >> 2;
		const v = '#6dff8a', a = '#4fe3ff', am = '#ffd23f', ro = '#ff4fa3';
		r(g, x, y, 9, 7, '#0c1f2a');
		if (tipo === 'codigo') for (let i = 0; i < 3; i++) r(g, x + 1 + ((i + k) % 2), y + 1 + i * 2, 3 + ((i * 3 + k) % 4), 1, v);
		else if (tipo === 'tabla') for (let i = 0; i < 3; i++) { r(g, x + 1, y + 1 + i * 2, 3, 1, a); r(g, x + 5, y + 1 + i * 2, 3, 1, i === k % 3 ? am : a); }
		else if (tipo === 'grafica') [2, 3, 3, 5, 6].forEach((h, i) => r(g, x + 1 + i * 1.6, y + 7 - h, 1, h, i === k % 5 ? am : v));
		else if (tipo === 'mapa') { r(g, x + 2, y + 2, 4, 3, '#3a7a3a'); r(g, x + 4, y + 1, 3, 2, '#3a7a3a'); r(g, x + 4 + (k % 2), y + 3, 1, 1, ro); }
		else if (tipo === 'dibujo') { r(g, x + 1, y + 1, 3, 2, ro); r(g, x + 5, y + 2, 3, 3, am); r(g, x + 2, y + 4, 2, 2, a); r(g, x + 6 + (k % 2), y + 1, 1, 1, '#fff'); }
		else if (tipo === 'barras') [2, 4, 3, 5].forEach((h, i) => r(g, x + 1 + i * 2, y + 7 - h, 1, h, (i + k) % 4 === 3 ? am : v));
		else if (tipo === 'idea') { const l = k % 2 ? am : '#a08a2a'; r(g, x + 3, y + 1, 3, 3, l); r(g, x + 3, y + 5, 3, 1, '#aaa'); }
		else if (tipo === 'carpetas') for (let i = 0; i < 3; i++) r(g, x + 1 + i * 3, y + 2, 2, 4, i === k % 3 ? '#fff' : am);
		else for (let i = 0; i < 3; i++) { r(g, x + 1, y + 1 + i * 2, 1, 1, i <= k % 3 ? v : '#2a5a5a'); r(g, x + 3, y + 1 + i * 2, 5, 1, a); }
	}

	const anchoMesa = () => (W === 300 ? 42 : 46);
	function mesa(a) {
		const { x, y } = a.casa;
		const w = anchoMesa(), x0 = x - w / 2;
		const sentado = a.modo === 'sentado';
		const eje = Math.round(x) - 6;
		// Silla
		r(g, eje - 1, y - 7, 14, 8, '#3a3346');
		if (sentado) {
			const teclea = a.trabajando || (t + x) % 40 < 25;
			cuerpoSentado(g, a.look, eje, y - 16 + (teclea && t % 4 < 2 ? 1 : 0), (t + x * 7) % 60 === 0);
		}
		r(g, x0 + 2, y + 18, w, 2, '#0003');
		r(g, x0, y, w, 4, '#b98a55'); r(g, x0, y, w, 1, '#d6a874'); r(g, x0, y + 4, w, 14, '#8f6a42');
		// La placa con su nombre y su puesto (el texto va encima, en la app)
		r(g, x0 + 1, y + 5, w - 2, 12, '#3a2a18'); r(g, x0 + 2, y + 6, w - 4, 10, '#f5efe0');
		// Pantalla
		r(g, x0 + 1, y - 10, 12, 11, '#d9d2bd'); r(g, x0 + 1, y - 10, 12, 1, '#efe7cf'); r(g, x0 + 2, y - 9, 10, 8, NEGRO);
		pantalla(a.look.pantalla, x0 + 2, y - 8, t, a.trabajando && sentado);
		// Sus cosas
		const dx = x0 + w - 8, ac = a.look.acento ?? '#ffd23f';
		if (a.look.pantalla === 'lista' || a.look.pantalla === 'carpetas') for (let i = 0; i < 4; i++) r(g, dx, y - 1 - i, 6, 1, i % 2 ? '#fff' : '#e8e0c8');
		else if (a.look.pantalla === 'dibujo' || a.look.pantalla === 'idea') { r(g, dx + 1, y - 4, 3, 4, '#4fe3ff'); r(g, dx + 1, y - 7, 1, 3, ac); r(g, dx + 3, y - 7, 1, 3, '#ff4fa3'); }
		else { r(g, dx, y - 3, 4, 3, '#fff'); r(g, dx, y - 2, 4, 1, ac); r(g, dx + 4, y - 3, 1, 2, '#fff'); }
		// Globo: tiene algo para ti
		if (a.sinLeer && sentado) { r(g, eje + 9, y - 21, 6, 6, '#ffac00'); r(g, eje + 9, y - 21, 6, 1, NEGRO); r(g, eje + 9, y - 16, 6, 1, NEGRO); r(g, eje + 9, y - 21, 1, 6, NEGRO); r(g, eje + 14, y - 21, 1, 6, NEGRO); r(g, eje + 11, y - 19, 2, 2, NEGRO); }
		if (a.trabajando && sentado) { for (let i = 0; i < 3; i++) if ((t >> 2) % 4 > i) r(g, eje + 12 + i * 2, y - 19, 1, 1, '#fff'); }
	}

	function dibuja() {
		const mi = new Date().getHours();
		if (!fondo || mi !== ultimoFondo) { pintaFondo(); ultimoFondo = mi; }
		g.drawImage(fondo, 0, 0);
		// Corcho: tareas del equipo
		for (const p of plantas) {
			if (p.sala || p.vestibulo) continue;
			const x = W === 300 ? 52 : 50, y = p.y + 4, w = 18, h = 18;
			if (W === 176) continue;
			r(g, x - 1, y - 1, w + 2, h + 2, NEGRO); r(g, x, y, w, h, '#c99a5b');
			const cols = ['#fff1a8', '#ffb3d1', '#bfe8ff', '#c8f5b0', '#ffd0a0', '#fff1a8'];
			for (let i = 0; i < Math.min(p.tareas, 6); i++) r(g, x + 2 + (i % 3) * 5, y + 2 + Math.floor(i / 3) * 7, 4, 5, cols[i]);
		}
		for (const p of plantas) {
			for (const h of ranuras(p)) if (h.tipo !== 'ventana') objetoPared(g, h, p.y + 5, t);
			const objs = p.deco?.suelo_objetos ?? [];
			objs.forEach((o, i) => objetoSuelo(g, o, Math.round(22 + (W - 76) * ((i + 0.5) / objs.length)), p.pasillo, t));
		}
		for (const a of actores.values()) mesa(a);
		// Correos en el mostrador de Tere
		const tere = [...actores.values()].find(a => a.hilo === 'general:recepcion');
		if (tere && datos?.correo) { const { x, y } = tere.casa; const n = Math.min(datos.correo, 7); for (let i = 0; i < n; i++) { r(g, x + 9, y - 2 - i * 1.4, 7, 1, i % 2 ? '#fff' : '#d8e7f5'); } }
		// El gato
		const ve = plantas.at(-1);
		if (ve) {
			const y = ve.pasillo - 6, x = gato.x, o = '#f28c28', d = '#c8641a';
			r(g, x, y + 2, 9, 3, o); r(g, x + 1, y + 1, 7, 1, o);
			const cabeza = gato.dir > 0 ? x + 7 : x - 2;
			r(g, cabeza, y, 4, 4, o); r(g, cabeza, y - 1, 1, 1, o); r(g, cabeza + 3, y - 1, 1, 1, o);
			r(g, cabeza + 1, y + 2, 1, 1, NEGRO);
			r(g, x + 2, y + 2, 1, 2, d); r(g, x + 4, y + 2, 1, 2, d);
			r(g, gato.dir > 0 ? x - 2 : x + 9, y + 3 + ((t >> 3) % 2), 2, 1, o);
		}
		// Los que están de pie
		const dePie = [...actores.values()].filter(a => a.modo !== 'sentado').sort((a, b) => a.pos.y - b.pos.y);
		for (const a of dePie) {
			if (a.modo === 'reunido') {
				const yMesa = plantas[a.pos.f].pasillo - 23;
				cuerpoSentado(g, a.look, Math.round(a.pos.x) - 6, yMesa - 14, (t + a.pos.x) % 50 === 0);
				continue;
			}
			if (a.enAscensor) {
				r(g, W - 21, a.pos.y - 24, 17, 25, '#b9bec8');
				r(g, W - 20, a.pos.y - 23, 15, 23, '#d9dde4');
			}
			cuerpoDePie(g, a.look, Math.round(a.enAscensor ? W - 18.5 : a.pos.x) - (a.enAscensor ? 0 : 6), Math.round(a.pos.y), a.modo === 'ruta' && !a.enAscensor ? a.paso : 0, a.lleva);
			if (a.habla && (t >> 3) % 3) { const bx = Math.round(a.pos.x) + 6, by = Math.round(a.pos.y) - 25; r(g, bx, by, 9, 6, '#fff'); r(g, bx, by + 6, 2, 1, '#fff'); r(g, bx + 2, by + 2, 1, 1, NEGRO); r(g, bx + 4, by + 2, 1, 1, NEGRO); r(g, bx + 6, by + 2, 1, 1, NEGRO); }
		}
		// En la mesa, uno habla
		const reunidos = dePie.filter(a => a.modo === 'reunido');
		if (reunidos.length) {
			const a = reunidos[(t >> 5) % reunidos.length];
			const bx = Math.round(a.pos.x) + 5, by = plantas[a.pos.f].pasillo - 44;
			r(g, bx, by, 11, 7, '#fff'); r(g, bx, by + 7, 2, 1, '#fff');
			for (let i = 0; i < 3; i++) if ((t >> 2) % 4 > i) r(g, bx + 2 + i * 3, by + 3, 1, 1, NEGRO);
			r(g, 14, plantas[a.pos.f].pasillo - 26, W - 52, 0, NEGRO);
		}
	}

	function bucle() {
		if (!vivo) return;
		reloj = setTimeout(bucle, 100);
		if (document.hidden) return;
		avanza();
		dibuja();
	}

	return {
		actualiza(oficina, anchoCss) {
			const firma = oficina.salas.map(s => `${s.id}:${s.personas.length}:${JSON.stringify(s.decoracion ?? '')}`).join() + (anchoCss >= 700 ? 'g' : 'p');
			if (firma !== canvas.dataset.firma) { canvas.dataset.firma = firma; planifica(oficina, anchoCss); alCambiar(); }
			else {
				for (const s of oficina.salas) for (const p of s.personas) { const a = actores.get(p.hilo); if (a) Object.assign(a, { trabajando: p.trabajando, sinLeer: p.sinLeer }); }
				for (const p of plantas) p.tareas = oficina.salas.find(s => s.id === p.id)?.tareas ?? 0;
			}
			sincroniza(oficina);
			if (!reloj) bucle();
		},
		recado,
		/** Dónde está cada cosa, para poner encima botones y nombres con su texto. */
		plano() {
			return {
				W, H,
				plantas: plantas.map(p => {
					const hs = ranuras(p);
					return { id: p.id, nombre: p.nombre, y: p.y, alto: p.alto, sala: !!p.sala, vestibulo: !!p.vestibulo, kpis: p.deco?.kpis ?? [], panel: hs.find(h => h.tipo === 'panel') ?? null, neon: hs.find(h => h.tipo === 'neon') ?? null, lema: p.deco?.lema ?? '' };
				}),
				anchoMesa: anchoMesa(),
				personas: [...actores.values()].map(a => ({ hilo: a.hilo, nombre: a.nombre, cargo: a.cargo, x: a.casa.x, y: a.casa.y, sinLeer: a.sinLeer })),
			};
		},
		destruye() { vivo = false; clearTimeout(reloj); },
	};
}
