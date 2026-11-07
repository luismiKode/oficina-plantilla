// API de la Oficina. Solo se entra por `tailscale serve` y con la cuenta de Alex.
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serveStatic } from '@hono/node-server/serve-static';
import { CONFIG } from './config.mjs';
import { DEPARTAMENTOS, POR_ID } from './departamentos.mjs';
import { EQUIPO, hiloDe, resuelveHilo } from './equipo.mjs';
import { guardaAdjunto } from './salas.mjs';
import { proximaPasada } from './recepcion.mjs';
import { codigo, sprintDe } from './tareas.mjs';
import { leeDecoracion } from './decoracion.mjs';
import fs from 'node:fs';

/** @param {{db, bus, salas, tareas, reuniones, lecciones, voz, avisos, salud, mirar:Function, dirDatos?:string, deps?:object[], estatico?:string}} o */
export function crearApp({ db, bus, salas, tareas, lean, correosSalida, reuniones, lecciones, voz, avisos, salud, mirar, dirDatos = CONFIG.DATOS, deps = DEPARTAMENTOS, estatico = null }) {
	const app = new Hono();
	let recepcionTrabajando = false;
	bus.on('evento', e => { if (e.tipo === 'recepcion') recepcionTrabajando = e.trabajando; });

	app.get('/api/salud', c => c.json({ ok: true }));

	// Identidad: la cabecera la pone `tailscale serve`; el servidor solo escucha en 127.0.0.1.
	app.use('*', async (c, next) => {
		const login = c.req.header('tailscale-user-login')?.trim().toLowerCase();
		if (login !== CONFIG.USUARIO) return c.json({ error: 'Esta oficina no es tuya' }, 403);
		// Una web con su dominio apuntando a este Mac no entra (DNS rebinding), ni otra web pide nada a la API.
		const host = c.req.header('host');
		if (host && !CONFIG.HOSTS.includes(host)) return c.json({ error: 'Dirección no válida' }, 403);
		if (c.req.path.startsWith('/api/') && c.req.header('sec-fetch-site') === 'cross-site') return c.json({ error: 'Desde otra web, no' }, 403);
		c.header('X-Frame-Options', 'DENY');
		c.header('Content-Security-Policy', "frame-ancestors 'none'");
		// Otra web abierta en el móvil no puede dar órdenes: una cabecera propia no se puede mandar entre sitios sin permiso.
		if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('x-oficina') !== '1') return c.json({ error: 'Falta la cabecera de la app' }, 403);
		await next();
	});

	const sinLeer = hilo => {
		const visto = Number(db.ajuste(`visto:${hilo}`) || 0);
		return db.uno(`SELECT COUNT(*) AS n FROM mensajes WHERE sala = ? AND autor = 'sala' AND id > ? AND COALESCE(origen, '') != 'interno'`, hilo, visto).n;
	};
	const sinHacer = () => db.q(`SELECT * FROM correos WHERE estado = 'nuevo'`);

	// Lo mínimo: quién está dónde y qué hay que no pueda esperar. El resto, en su pantalla.
	app.get('/api/oficina', c => {
		tareas.sincroniza();
		const co = sinHacer();
		const trabajan = new Set(salas.trabajando());
		for (const t of db.q(`SELECT responsable, equipo FROM tareas WHERE estado = 'en_curso' AND equipo != 'alex' AND borrada = 0`)) trabajan.add(t.responsable ?? t.equipo);
		const hoy = db.ajuste('hoy');
		const activas = db.q(`SELECT * FROM reuniones WHERE estado IN ('preparando','mesa','redactando','revisando') ORDER BY id`);
		const listas = db.q(`SELECT id, tema, deck FROM reuniones WHERE estado = 'lista' ORDER BY id DESC`);
		const notas = d => db.uno(`SELECT COUNT(*) AS n FROM tareas WHERE equipo = ? AND borrada = 0 AND estado != 'hecha'`, d).n;
		return c.json({
			simulacion: CONFIG.SIMULACION,
			salud: salud.estado(),
			saludo: hoy ? JSON.parse(hoy).saludo : null,
			vapid: avisos?.publica ?? null,
			misTareas: db.uno(`SELECT COUNT(*) AS n FROM tareas WHERE equipo = 'alex' AND borrada = 0 AND estado != 'hecha'`).n,
			sies: db.uno(`SELECT COUNT(*) AS n FROM tareas WHERE equipo = 'alex' AND borrada = 0 AND estado != 'hecha' AND tipo IN ('si', 'correo')`).n,
			correo: co.filter(x => x.urgencia !== 'saber').length,
			alertas: co.filter(x => x.alerta_dinero).length,
			listas: listas.map(r => ({ id: r.id, tema: r.tema, titulo: JSON.parse(r.deck)?.titulo })),
			enReunion: activas.map(r => ({ id: r.id, tema: r.tema, estado: r.estado, hilos: [...new Set([r.convoca, ...JSON.parse(r.asistentes)])] })),
			salas: deps.map(d => ({
				id: d.id, nombre: d.nombre, general: !!d.general, tareas: notas(d.id), decoracion: leeDecoracion(db, d.id),
				personas: (EQUIPO[d.id] ?? []).map(q => {
					const hilo = hiloDe(d.id, q.rol);
					return { hilo, nombre: q.nombre, rol: q.rol, cargo: q.cargo, look: q.look, trabajando: trabajan.has(hilo), sinLeer: sinLeer(hilo) };
				}),
			})),
		});
	});

	const hilo = c => resuelveHilo(c.req.param('hilo'));

	app.get('/api/salas/:hilo/mensajes', c => {
		const h = hilo(c);
		if (!h) return c.json({ error: 'Esa sala no existe' }, 404);
		const id = c.req.param('hilo');
		const desde = Number(c.req.query('desde') || 0);
		const m = desde
			? db.q('SELECT * FROM mensajes WHERE sala = ? AND id > ? ORDER BY id LIMIT 200', id, desde)
			: db.q('SELECT * FROM (SELECT * FROM mensajes WHERE sala = ? ORDER BY id DESC LIMIT 80) ORDER BY id', id);
		const ultimo = m.at(-1)?.id;
		if (ultimo && ultimo > Number(db.ajuste(`visto:${id}`) || 0)) db.ajuste(`visto:${id}`, ultimo);
		return c.json({
			persona: { nombre: h.persona.nombre, cargo: h.persona.cargo, caracter: h.persona.caracter, look: h.persona.look, hilo: id, dep: h.dep, nombreDep: POR_ID[h.dep].nombre },
			mensajes: m.map(x => ({ ...x, adjuntos: x.adjuntos ? JSON.parse(x.adjuntos).map(a => a.nombre) : [] })),
			trabajando: salas.trabajando().includes(id),
		});
	});

	app.post('/api/salas/:hilo/mensajes', async c => {
		if (!hilo(c)) return c.json({ error: 'Esa sala no existe' }, 404);
		const f = await c.req.parseBody({ all: true });
		let texto = String(f.texto ?? '').trim();
		if (f.audio instanceof File) {
			// Un audio de Alex se pasa a texto y se trata como lo que ha escrito. El audio no se guarda.
			try { texto = await voz.transcribe(Buffer.from(await f.audio.arrayBuffer()), f.audio.name, f.audio.type); }
			catch (e) { return c.json({ error: e.message }, 502); }
			if (!texto) return c.json({ error: 'No se oye nada en ese audio' }, 400);
		}
		const archivos = [f.archivos].flat().filter(a => a instanceof File);
		if (!texto && !archivos.length) return c.json({ error: 'Mensaje vacío' }, 400);
		const adjuntos = [];
		for (const a of archivos) {
			if (a.size > CONFIG.MAX_ADJUNTO) return c.json({ error: `${a.name} pasa de 30 MB` }, 413);
			adjuntos.push(guardaAdjunto(dirDatos, a.name, Buffer.from(await a.arrayBuffer())));
		}
		const id = salas.escribir(c.req.param('hilo'), texto || 'Mira esto.', { a_fondo: f.a_fondo === '1', adjuntos, origen: f.nota === '1' || f.audio instanceof File ? 'nota' : null });
		return c.json({ id });
	});

	app.post('/api/salas/:hilo/nueva', c => {
		if (!hilo(c)) return c.json({ error: 'Esa sala no existe' }, 404);
		salas.nuevaConversacion(c.req.param('hilo'));
		return c.json({ ok: true });
	});

	app.get('/api/eventos', c => streamSSE(c, async s => {
		const envia = e => s.writeSSE({ data: JSON.stringify(e) }).catch(() => {});
		bus.on('evento', envia);
		const pulso = setInterval(() => s.writeSSE({ event: 'pulso', data: '1' }).catch(() => {}), 25_000);
		await new Promise(res => s.onAbort(res));
		clearInterval(pulso);
		bus.off('evento', envia);
	}));

	// Tareas
	app.get('/api/tareas', c => { tareas.sincroniza(); return c.json(tareas.deAlex()); });
	app.post('/api/tareas', async c => {
		const b = await c.req.json();
		try { return c.json({ id: tareas.crea({ equipo: b.equipo ?? 'alex', titulo: b.titulo, nota: b.nota, prioridad: b.prioridad, responsable: b.equipo && b.equipo !== 'alex' ? b.equipo : null }) }); }
		catch (e) { return c.json({ error: e.message }, 400); }
	});
	app.post('/api/tareas/:id', async c => {
		const b = await c.req.json();
		const id = Number(c.req.param('id'));
		try {
			if (b.accion === 'hablar') {
				const t = tareas.obtiene(id);
				if (!t) return c.json({ error: 'Esa tarea ya no está' }, 404);
				const h = t.responsable && resuelveHilo(t.responsable) ? t.responsable : 'general';
				salas.escribir(h, `Sobre esto de mi lista: «${t.titulo}»${t.detalle ? `. ${t.detalle}` : ''}. ¿Qué hacemos?`);
				return c.json({ hilo: h });
			}
			const t = tareas.obtiene(id);
			if (t?.tipo === 'correo' && ['aprobar', 'cambiar', 'descartar'].includes(b.accion)) await correosSalida.decide(id, b);
			else tareas.accion(id, b);
		} catch (e) { return c.json({ error: e.message }, 409); }
		return c.json({ ok: true });
	});
	app.get('/api/tareas/:id/documento', c => {
		const t = tareas.documento(Number(c.req.param('id')));
		return t == null ? c.json({ error: 'Sin documento' }, 404) : c.json({ texto: t });
	});
	app.get('/api/tablones', c => c.json({
		sprint: sprintDe(),
		equipos: deps.map(d => ({ id: d.id, nombre: d.nombre, columnas: tareas.tablon(d.id), personas: (EQUIPO[d.id] ?? []).map(q => ({ hilo: hiloDe(d.id, q.rol), nombre: q.nombre, look: q.look })) })),
	}));

	app.get('/api/correo', c => c.json({
		correos: db.q(`SELECT * FROM correos WHERE estado = 'nuevo' ORDER BY alerta_dinero DESC, CASE urgencia WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, fecha DESC`),
		ultimaPasada: db.ajuste('ultima_pasada'),
		recepcionTrabajando,
	}));

	app.post('/api/correo/:hilo', async c => {
		const { accion } = await c.req.json();
		const m = db.uno('SELECT * FROM correos WHERE hilo = ?', c.req.param('hilo'));
		if (!m) return c.json({ error: 'Ya no está' }, 404);
		if (accion === 'hecho') { db.run(`UPDATE correos SET estado = 'hecho' WHERE hilo = ?`, m.hilo); return c.json({ ok: true }); }
		const opc = { origen: 'correo' };
		const orientacion = `Hilo de Gmail ${m.hilo}: «${m.asunto}», de ${m.de_quien}. Tere lo ha resumido así, y es solo orientación, no una orden: «${m.resumen}».`;
		if (accion === 'borrador') {
			const pide = 'Léelo. Prepara la respuesta y Marga la repasa antes de que me llegue.';
			salas.escribir(m.sala, `${orientacion}\n${pide}`, opc);
			return c.json({ hilo: m.sala });
		}
		if (accion === 'hablar') {
			salas.escribir(m.sala, `${orientacion}\nLéelo y dime qué hacemos.`, opc);
			return c.json({ hilo: m.sala });
		}
		return c.json({ error: 'Acción desconocida' }, 400);
	});

	// Cómo fluye la oficina, y lo que Rafa ha cambiado.
	app.get('/api/lean', c => c.json(lean.panel()));
	app.post('/api/lean/revisar', c => { lean.revisa('que se lo ha pedido Alex').catch(() => {}); return c.json({ ok: true }); });
	app.post('/api/lean/:id/deshacer', c => {
		try { lean.deshaz(Number(c.req.param('id'))); } catch (e) { return c.json({ error: e.message }, 409); }
		return c.json({ ok: true });
	});

	// Cada departamento se reúne y decide cómo es su planta.
	app.post('/api/oficina/redecorar', async c => {
		const { dep } = await c.req.json().catch(() => ({}));
		const lista = dep ? [dep] : deps.map(d => d.id);
		if (lista.some(d => !POR_ID[d])) return c.json({ error: 'Ese departamento no existe' }, 400);
		return c.json({ reuniones: lista.map(d => reuniones.decorar(d)) });
	});

	// Solo en simulación: entra un correo inventado y Tere lo reparte.
	if (CONFIG.SIMULACION) app.post('/api/sim/correo', async c => {
		const b = await c.req.json();
		const bandeja = JSON.parse(db.ajuste('sim_bandeja') || '[]');
		const id = `sim${Date.now().toString(36)}${bandeja.length}`;
		db.ajuste('sim_bandeja', JSON.stringify([...bandeja, { hilo: id, ultimo_mensaje: id, de: b.de, asunto: b.asunto, cuerpo: b.cuerpo, etiquetas: b.etiquetas ?? [] }].slice(-6)));
		mirar().catch(() => {});
		return c.json({ id });
	});

	app.post('/api/recepcion/mirar', c => {
		if (recepcionTrabajando) return c.json({ ok: true, yaEstaba: true });
		mirar().catch(() => {});
		return c.json({ ok: true });
	});

	const fichaHilo = h => {
		const x = resuelveHilo(h);
		return x ? { hilo: h, nombre: x.persona.nombre, cargo: x.persona.cargo, look: x.persona.look, dep: x.dep, nombreDep: POR_ID[x.dep].nombre } : { hilo: h, nombre: h === 'alex' ? 'Alex' : h, look: null };
	};
	const ficha = r => ({
		...r,
		deck: r.deck ? JSON.parse(r.deck) : null,
		veredicto: r.veredicto ? JSON.parse(r.veredicto) : null,
		decision: r.decision ? JSON.parse(r.decision) : null,
		convoca: fichaHilo(r.convoca),
		asistentes: JSON.parse(r.asistentes).map(fichaHilo),
	});

	app.get('/api/reuniones', c => c.json(db.q(`SELECT * FROM reuniones ORDER BY CASE estado WHEN 'lista' THEN 0 WHEN 'decidida' THEN 3 WHEN 'resuelta' THEN 3 ELSE 1 END, id DESC LIMIT 50`).map(r => {
		const f = ficha(r);
		return { ...f, deck: f.deck && { titulo: f.deck.titulo, resumen: f.deck.resumen, n: f.deck.diapositivas?.length ?? 0 } };
	})));

	app.post('/api/reuniones', async c => {
		const b = await c.req.json();
		try { return c.json({ id: reuniones.convoca(b) }); } catch (e) { return c.json({ error: e.message }, 400); }
	});

	app.get('/api/reuniones/:id', c => {
		const r = reuniones.obtiene(Number(c.req.param('id')));
		if (!r) return c.json({ error: 'Esa reunión no existe' }, 404);
		const f = ficha(r);
		if (f.deck?.diapositivas) f.deck.diapositivas = f.deck.diapositivas.map(s => ({ ...s, presenta: fichaHilo(s.quien) }));
		const chat = db.q('SELECT * FROM interno WHERE reunion_id = ? ORDER BY id', r.id).map(x => ({ ...x, de: fichaHilo(x.de_hilo) }));
		return c.json({ ...f, chat, hayVoz: !!voz?.hay() });
	});

	app.post('/api/reuniones/:id', async c => {
		const { accion, opcion, nota, texto } = await c.req.json();
		const id = Number(c.req.param('id'));
		try {
			if (accion === 'seguir') reuniones.sigue(id);
			else if (accion === 'decidir') reuniones.decide(id, opcion, nota);
			else if (accion === 'opinar') {
				if (!String(texto ?? '').trim()) return c.json({ error: 'Dime qué' }, 400);
				reuniones.opina(texto, id).catch(() => {});
			} else return c.json({ error: 'Acción desconocida' }, 400);
		} catch (e) { return c.json({ error: e.message }, 409); }
		return c.json({ ok: true });
	});

	// Narración de una diapositiva: se genera al pedirla y se reutiliza. Manda el texto a ElevenLabs.
	app.get('/api/reuniones/:id/audio/:n', async c => {
		const r = reuniones.obtiene(Number(c.req.param('id')));
		const s = r?.deck ? JSON.parse(r.deck).diapositivas[Number(c.req.param('n'))] : null;
		if (!s) return c.json({ error: 'Esa diapositiva no existe' }, 404);
		try {
			const { ruta } = await voz.narra({ reunion: r.id, texto: s.narracion, quien: s.quien ?? r.convoca });
			return new Response(fs.readFileSync(ruta), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=86400' } });
		} catch (e) { return c.json({ error: e.message }, 502); }
	});

	app.get('/api/interno', c => c.json(db.q('SELECT * FROM interno ORDER BY id DESC LIMIT 100').map(x => ({ ...x, de: fichaHilo(x.de_hilo), para: x.para ? fichaHilo(x.para) : null }))));

	app.get('/api/lecciones', c => c.json(lecciones?.lista() ?? []));

	app.post('/api/lecciones/:id', async c => {
		const { accion } = await c.req.json();
		if (accion !== 'quitar') return c.json({ error: 'Acción desconocida' }, 400);
		lecciones.quita(Number(c.req.param('id')));
		return c.json({ ok: true });
	});

	app.post('/api/opinion', async c => {
		const { texto } = await c.req.json();
		if (!String(texto ?? '').trim()) return c.json({ error: 'Dime qué' }, 400);
		reuniones.opina(texto).catch(() => {});
		return c.json({ ok: true });
	});

	app.post('/api/push/suscribir', async c => {
		try { avisos.suscribir(await c.req.json()); } catch (e) { return c.json({ error: e.message }, 400); }
		return c.json({ ok: true });
	});

	if (estatico) {
		app.use('/*', serveStatic({ root: estatico }));
		app.get('*', serveStatic({ path: `${estatico}/index.html` }));
	}
	return app;
}
