import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirDB } from '../server/db.mjs';
import { crearReuniones, validaDeck, fijaQuien, LIMITES } from '../server/reuniones.mjs';
import { crearLecciones } from '../server/lecciones.mjs';
import { eligeVoz, crearVoz, leeClave } from '../server/voz.mjs';
import { argsTexto, argsReunion, fueraDeLista, permitidas } from '../server/perfiles.mjs';
import { ErrorSesionCaducada } from '../server/motor.mjs';

const espera = (ms = 40) => new Promise(r => setTimeout(r, ms));
const nuevo = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r-'));
	return { dir, db: abrirDB(path.join(dir, 'o.db')) };
};
const salud = () => { let s = 'ok'; return { ok() { s = 'ok'; }, caducada() { s = 'caducada'; }, limite() {}, estado: () => ({ sesion: s }) }; };

const diapo = (o = {}) => ({ titulo: 'Sin stock para Navidad', puntos: ['Faltan 125 unidades'], narracion: 'La entrega de diciembre no cubre a los backers.', ...o });
const DECK = {
	para_alex: true, tareas: [{ equipo: 'produccion', titulo: 'Pedir la fecha a la fábrica' }, { equipo: 'inventado', titulo: 'x' }],
	titulo: 'Navidad', resumen: 'No llegamos con lo pedido.',
	diapositivas: [diapo()],
	decision: { pregunta: '¿Qué hacemos?', opciones: [{ nombre: 'Backers primero' }, { nombre: 'Tienda primero' }], recomendacion: 'Backers primero' },
};

// --- El formato

test('una presentación correcta pasa', () => assert.deepEqual(validaDeck(DECK), []));

test('más de 6 diapositivas: no pasa', () => {
	const f = validaDeck({ ...DECK, diapositivas: Array(7).fill(diapo()) });
	assert.ok(f.some(x => /7 diapositivas/.test(x)));
});

test('más de 4 puntos o puntos largos: no pasa', () => {
	assert.ok(validaDeck({ ...DECK, diapositivas: [diapo({ puntos: Array(5).fill('corto') })] }).some(x => /5 puntos/.test(x)));
	assert.ok(validaDeck({ ...DECK, diapositivas: [diapo({ puntos: [Array(LIMITES.palabrasPunto + 1).fill('palabra').join(' ')] })] }).some(x => /punto 1/.test(x)));
});

test('cifra sin fuente: no pasa', () => {
	assert.ok(validaDeck({ ...DECK, diapositivas: [diapo({ cifras: [{ valor: '5.000', etiqueta: 'unidades' }] })] }).some(x => /sin fuente/.test(x)));
});

test('clickbait, rayas largas y emojis: no pasan', () => {
	assert.ok(validaDeck({ ...DECK, diapositivas: [diapo({ narracion: 'Un resultado increíble, no te lo vas a creer.' })] }).some(x => /titular vacío/.test(x)));
	assert.ok(validaDeck({ ...DECK, diapositivas: [diapo({ titulo: 'Stock — mal' })] }).some(x => /rayas/.test(x)));
	assert.ok(validaDeck({ ...DECK, diapositivas: [diapo({ titulo: 'Stock 🚀' })] }).some(x => /emojis/.test(x)));
});

test('narración larga o total de más de dos minutos: no pasa', () => {
	const larga = Array(100).fill('palabra').join(' ');
	assert.ok(validaDeck({ ...DECK, diapositivas: [diapo({ narracion: larga })] }).some(x => /narración de más/.test(x)));
	const media = Array(80).fill('palabra').join(' ');
	assert.ok(validaDeck({ ...DECK, diapositivas: Array(5).fill(diapo({ narracion: media })) }).some(x => /Narración total/.test(x)));
});

test('la recomendación tiene que ser una de las opciones', () => {
	assert.ok(validaDeck({ ...DECK, decision: { ...DECK.decision, recomendacion: 'Otra' } }).some(x => /recomendación/.test(x)));
	assert.ok(validaDeck({ ...DECK, decision: { ...DECK.decision, opciones: [{ nombre: 'Backers primero' }] } }).some(x => /de 2 a 4/.test(x)));
});

test('quien cuenta: si se inventa a alguien, la cuenta quien convoca', () => {
	const d = fijaQuien({ diapositivas: [{ quien: 'hacker' }, { quien: 'fiscal' }] }, ['fiscal', 'finanzas'], 'finanzas');
	assert.deepEqual(d.diapositivas.map(x => x.quien), ['finanzas', 'fiscal']);
});

// --- Permisos

test('redactar y revisar: sin herramientas ni conexiones', () => {
	const a = argsTexto({ prompt: 'x', sistema: 's' });
	assert.equal(a[a.indexOf('--tools') + 1], '');
	assert.ok(a.includes('--strict-mcp-config'));
	assert.deepEqual([...permitidas('fiscal', 'texto')], ['StructuredOutput']);
	assert.deepEqual(fueraDeLista(['Read', 'mcp__claude_ai_Gmail__send_message'], 'fiscal', 'texto'), ['Read', 'mcp__claude_ai_Gmail__send_message']);
});

test('en reunión nadie escribe ni tiene correo', () => {
	const a = argsReunion('finanzas', { prompt: 'x', sistema: 's', carpeta: '/k/f' });
	const t = a[a.indexOf('--tools') + 1].split(',');
	for (const x of ['Write', 'Edit', 'Bash', 'WebFetch']) assert.ok(!t.includes(x), x);
	for (const h of permitidas('finanzas', 'reunion')) assert.doesNotMatch(h, /Gmail|Slack|Drive|Calendar|alta_factura|conciliar/, h);
	assert.equal(a[a.indexOf('--setting-sources') + 1], 'project,local');
	assert.ok(a.includes('Read(//k/f/**)'));
	assert.ok(!a.includes('Read'));
});

// --- El camino de una reunión

// Un ejecutor de pega que reconoce la fase por el prompt
function falso({ deck = DECK, revisiones = [{ aprobada: true, fallos: [], nota: 'Bien.' }], mesa = () => 'PASO' } = {}) {
	const log = [];
	let rev = 0;
	const f = async o => {
		const p = o.args[o.args.indexOf('-p') + 1];
		const esquema = o.args.includes('--json-schema');
		if (!esquema) {
			if (/Vas a preparar una reunión/.test(p)) { log.push('investigacion'); return { texto: 'NADA' }; }
			if (/ronda \d/.test(p) && /Estás en la mesa/.test(p)) { log.push('mesa'); return { texto: mesa(log.filter(x => x === 'mesa').length) }; }
			log.push('aporte');
			return { texto: 'Mi aporte con datos.' };
		}
		if (/Presentación, versión/.test(p)) { log.push('revision'); return { estructurado: revisiones[Math.min(rev++, revisiones.length - 1)] }; }
		if (/Lo que ha dicho Alex/.test(p)) { log.push('opinion'); return { estructurado: { respuesta: 'Tienes razón.', lecciones: [{ ambito: 'revisora', texto: 'Una sola idea por diapositiva' }, { ambito: 'marketing', texto: 'Menos jerga de campañas' }] } }; }
		log.push('redaccion');
		return { estructurado: deck };
	};
	return { f, log };
}

test('de principio a fin: aportes, mesa, redacción, revisión, lista y aviso', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso();
	const avisos = [];
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, avisa: a => avisos.push(a), dirDatos: dir });
	const id = r.convoca({ tema: 'Stock de Navidad', convoca: 'produccion', asistentes: ['finanzas', 'marketing:medios'] });
	await espera(80);
	assert.deepEqual(log, ['investigacion', 'aporte', 'aporte', 'aporte', 'mesa', 'mesa', 'mesa', 'redaccion', 'revision']);
	const x = r.obtiene(id);
	assert.equal(x.estado, 'lista');
	assert.equal(x.nota_revisora, 'Bien.');
	assert.match(avisos[0].titulo, /reunión/);
	assert.equal(db.q(`SELECT * FROM interno WHERE reunion_id = ? AND tipo = 'aporte'`, id).length, 3);
});

test('la mesa para cuando todos pasan, y nunca pasa de 3 rondas', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso({ mesa: () => 'Te corrijo la cifra.' });
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir });
	r.convoca({ tema: 'x', convoca: 'produccion', asistentes: ['finanzas'] });
	await espera(80);
	assert.equal(log.filter(x => x === 'mesa').length, 6, '2 personas × 3 rondas');
});

test('Bea devuelve: se rehace con sus fallos', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso({ revisiones: [{ aprobada: false, fallos: ['El título no dice la conclusión'], nota: '' }, { aprobada: true, fallos: [], nota: 'Ahora sí.' }] });
	let prompts = [];
	const r = crearReuniones({ db, salud: salud(), dirDatos: dir, ejecutor: o => { prompts.push(o.args[o.args.indexOf('-p') + 1]); return f(o); } });
	const id = r.convoca({ tema: 'x', convoca: 'fiscal' });
	await espera(80);
	assert.equal(log.filter(x => x === 'redaccion').length, 2);
	assert.ok(prompts.some(p => /El título no dice la conclusión/.test(p)), 'la nueva versión recibe los fallos');
	assert.equal(r.obtiene(id).estado, 'lista');
	assert.equal(r.obtiene(id).iteracion, 2);
});

test('tras 3 vueltas sin pasar llega igual, y lo dice', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso({ revisiones: [{ aprobada: false, fallos: ['Sigue siendo un tostón'], nota: '' }] });
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir });
	const id = r.convoca({ tema: 'x', convoca: 'fiscal' });
	await espera(80);
	assert.equal(log.filter(x => x === 'redaccion').length, 3);
	assert.equal(r.obtiene(id).estado, 'lista');
	assert.match(r.obtiene(id).nota_revisora, /No ha pasado mi revisión.*tostón/);
});

test('aunque Bea apruebe, si incumple los límites no pasa', async () => {
	const { db, dir } = nuevo();
	const { f } = falso({ deck: { ...DECK, diapositivas: Array(8).fill(diapo()) } });
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir });
	const id = r.convoca({ tema: 'x', convoca: 'fiscal' });
	await espera(80);
	assert.equal(JSON.parse(r.obtiene(id).veredicto).aprobada, false);
	assert.match(r.obtiene(id).nota_revisora, /8 diapositivas/);
});

const RESUELTO = { para_alex: false, titulo: 'Stock resuelto', resumen: 'Backers primero.', tareas: [{ equipo: 'marketing', titulo: 'Frenar Meta' }] };

test('la convocan ellos: se reúnen sin preguntar, lo resuelven y no le llega nada', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso({ deck: RESUELTO });
	const avisos = [], creadas = [];
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, avisa: a => avisos.push(a), tareas: { crea: t => creadas.push(t) } });
	const id = r.propone({ tema: 'x', convoca: 'fiscal', asistentes: ['finanzas'] });
	await espera(80);
	assert.equal(r.obtiene(id).estado, 'resuelta');
	assert.ok(!log.includes('revision'), 'sin Bea si no le llega a él');
	assert.equal(avisos.length, 0);
	assert.equal(creadas[0].equipo, 'marketing');
	assert.equal(creadas[0].origen, 'reunion');
});

test('si hace falta Alex, le llega y pasa por Bea', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso();
	const avisos = [];
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, avisa: a => avisos.push(a) });
	const id = r.propone({ tema: 'x', convoca: 'fiscal' });
	await espera(80);
	assert.equal(r.obtiene(id).estado, 'lista');
	assert.ok(log.includes('revision'));
	assert.equal(avisos.length, 1);
});

test('si la convoca Alex, le llega seguro aunque digan que no hace falta', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso({ deck: { ...DECK, para_alex: false } });
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir });
	const id = r.convoca({ tema: 'x', convoca: 'fiscal' });
	await espera(80);
	assert.equal(r.obtiene(id).estado, 'lista');
	assert.ok(log.includes('revision'));
});

test('lo que queda por hacer va a los tablones; equipos inventados, fuera', async () => {
	const { db, dir } = nuevo();
	const { f } = falso();
	const creadas = [];
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, tareas: { crea: t => creadas.push(t) } });
	r.convoca({ tema: 'x', convoca: 'fiscal' });
	await espera(80);
	assert.deepEqual(creadas.map(t => t.equipo), ['produccion']);
});

test('lo urgente entra aunque se haya pasado el tope', async () => {
	const { db, dir } = nuevo();
	const { f } = falso({ deck: RESUELTO });
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, tope: 0 });
	const id = r.propone({ tema: 'a', convoca: 'fiscal', urgente: true });
	await espera(60);
	assert.equal(r.obtiene(id).estado, 'resuelta');
});

test('tras la reunión, cuatro tareas como mucho, con su contexto; lo de Alex va a Julián', async () => {
	const { db, dir } = nuevo();
	const creadas = [], pedidas = [];
	const { f } = falso({ deck: { ...RESUELTO, tareas: [{ equipo: 'alex', titulo: 'firmar' }, ...Array(6).fill({ equipo: 'fiscal', titulo: 'x' })] } });
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, tareas: { crea: t => creadas.push(t), pideAAlex: t => pedidas.push(t) } });
	r.propone({ tema: 'Tema', objetivo: 'Escribe javi@x.com', convoca: 'fiscal' });
	await espera(80);
	assert.equal(pedidas[0].titulo, 'firmar');
	assert.equal(creadas.length, 3);
	assert.match(creadas[0].detalle, /javi@x\.com/);
});

test('lo que queda para Alex de una reunión de Julián le llega directo', async () => {
	const { db, dir } = nuevo();
	const creadas = [], pedidas = [];
	const { f } = falso({ deck: { ...RESUELTO, tareas: [{ equipo: 'alex', titulo: 'firmar' }] } });
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, tareas: { crea: t => creadas.push(t), pideAAlex: t => pedidas.push(t) } });
	r.propone({ tema: 'T', convoca: 'general' });
	await espera(80);
	assert.equal(pedidas.length, 0);
	assert.equal(creadas[0].equipo, 'alex');
});

test('pasado el tope de reuniones del día, esperan', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso({ deck: RESUELTO });
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, tope: 1 });
	r.propone({ tema: 'a', convoca: 'fiscal' });
	await espera(60);
	const n = log.length;
	const id = r.propone({ tema: 'b', convoca: 'fiscal' });
	await espera(60);
	assert.equal(r.obtiene(id).estado, 'en_cola');
	assert.equal(log.length, n);
});

test('asistentes inventados fuera', () => {
	const { db, dir } = nuevo();
	db.ajuste(`reuniones:${new Date().toISOString().slice(0, 10)}`, 99);
	const r = crearReuniones({ db, salud: salud(), ejecutor: async () => ({ texto: '' }), dirDatos: dir });
	const id = r.propone({ tema: 'x', convoca: 'fiscal', asistentes: ['fiscal:modelos', '../etc', 'nadie'] });
	assert.deepEqual(JSON.parse(r.obtiene(id).asistentes), ['fiscal:modelos']);
});

test('se atasca, se apunta dónde, y sigue sin repetir lo hecho', async () => {
	const { db, dir } = nuevo();
	const { f, log } = falso();
	let romper = true;
	const r = crearReuniones({ db, salud: salud(), dirDatos: dir, ejecutor: o => {
		if (romper && o.args.includes('--json-schema')) throw new Error('boom');
		return f(o);
	} });
	const id = r.convoca({ tema: 'x', convoca: 'fiscal' });
	await espera(60);
	assert.equal(r.obtiene(id).estado, 'atascada');
	assert.equal(r.obtiene(id).estado_previo, 'redactando');
	romper = false;
	const aportesAntes = log.filter(x => x === 'aporte').length;
	r.sigue(id);
	await espera(60);
	assert.equal(r.obtiene(id).estado, 'lista');
	assert.equal(log.filter(x => x === 'aporte').length, aportesAntes);
});

test('tras un reinicio sigue donde iba', async () => {
	const { db, dir } = nuevo();
	db.run(`INSERT INTO reuniones (tema, convoca, asistentes, estado) VALUES ('x','fiscal','[]','redactando')`);
	const { f, log } = falso();
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir });
	r.arranca();
	await espera(60);
	assert.deepEqual(log, ['redaccion', 'revision']);
});

test('sesión caducada: se para y no sigue gastando', async () => {
	const { db, dir } = nuevo();
	const s = salud();
	let n = 0;
	const r = crearReuniones({ db, salud: s, dirDatos: dir, ejecutor: async () => { n++; throw new ErrorSesionCaducada('no'); } });
	const id = r.convoca({ tema: 'x', convoca: 'fiscal' });
	await espera();
	assert.equal(s.estado().sesion, 'caducada');
	assert.equal(r.obtiene(id).estado, 'atascada');
	assert.equal(n, 1);
});

test('decidir: se lo cuenta a quien convocó y solo vale una opción real', async () => {
	const { db, dir } = nuevo();
	const { f } = falso();
	const escritos = [];
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, escribeSala: (h, t) => escritos.push([h, t]) });
	const id = r.convoca({ tema: 'Navidad', convoca: 'produccion' });
	await espera(60);
	assert.throws(() => r.decide(id, 'Inventada'));
	r.decide(id, 'Backers primero', 'y avísame');
	assert.equal(r.obtiene(id).estado, 'decidida');
	assert.throws(() => r.decide(id, 'Tienda primero'), /Ya está/);
	assert.equal(escritos[0][0], 'produccion');
	assert.match(escritos[0][1], /decido «Backers primero»\. y avísame/);
});

// --- Cómo aprende Bea

function conCarpetas() {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-'));
	const dep = id => { const carpeta = path.join(base, id); fs.mkdirSync(path.join(carpeta, '0-Bases'), { recursive: true }); return { id, carpeta }; };
	return [dep('marketing'), dep('fiscal')];
}

test('«es una mierda»: Bea lo asume, aprende, y la lección baja al departamento y a las instrucciones', async () => {
	const { db, dir } = nuevo();
	const deps = conCarpetas();
	const lecciones = crearLecciones({ db, deps });
	const { f, log } = falso();
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, lecciones });
	r.convoca({ tema: 'x', convoca: 'marketing' });
	await espera(60);
	const res = await r.opina('El último informe es una puta mierda, demasiada jerga');
	assert.equal(res.respuesta, 'Tienes razón.');
	assert.ok(log.includes('opinion'));
	assert.match(lecciones.bloque('revisora'), /Una sola idea/);
	assert.match(lecciones.bloque('marketing'), /Menos jerga/);
	assert.doesNotMatch(lecciones.bloque('fiscal'), /Menos jerga/);
	assert.match(fs.readFileSync(path.join(deps[0].carpeta, '0-Bases/LECCIONES-DEL-JEFE.md'), 'utf8'), /Menos jerga/);
	assert.ok(!fs.existsSync(path.join(deps[1].carpeta, '0-Bases/LECCIONES-DEL-JEFE.md')));
	assert.equal(db.uno(`SELECT texto FROM mensajes WHERE sala = 'general:revisora'`).texto, 'Tienes razón.');
	const dicho = db.q(`SELECT * FROM interno WHERE tipo = 'opinion'`);
	assert.match(dicho[0].texto, /puta mierda/);
});

test('lo aprendido entra en la siguiente revisión y la siguiente redacción', async () => {
	const { db, dir } = nuevo();
	const lecciones = crearLecciones({ db, deps: conCarpetas() });
	lecciones.anade({ ambito: 'revisora', texto: 'Nada de tablas' });
	lecciones.anade({ ambito: 'todos', texto: 'Sin siglas raras' });
	const { f } = falso();
	const sistemas = [];
	const r = crearReuniones({ db, salud: salud(), dirDatos: dir, lecciones, ejecutor: o => { sistemas.push(o.args[o.args.indexOf('--append-system-prompt') + 1]); return f(o); } });
	r.convoca({ tema: 'x', convoca: 'fiscal' });
	await espera(60);
	assert.ok(sistemas.at(-1).includes('Nada de tablas') && sistemas.at(-1).includes('Sin siglas raras'), 'revisión');
	assert.ok(sistemas.at(-2).includes('Sin siglas raras') && !sistemas.at(-2).includes('Nada de tablas'), 'redacción');
});

test('una lección quitada desaparece también del departamento', () => {
	const { db } = nuevo();
	const deps = conCarpetas();
	const l = crearLecciones({ db, deps });
	const id = l.anade({ ambito: 'fiscal', texto: 'X' });
	l.bajaADepartamentos();
	const ruta = path.join(deps[1].carpeta, '0-Bases/LECCIONES-DEL-JEFE.md');
	assert.match(fs.readFileSync(ruta, 'utf8'), /- X/);
	l.quita(id);
	assert.doesNotMatch(fs.readFileSync(ruta, 'utf8'), /- X/);
});

test('sin lecciones no se crea archivo; repetidas no se duplican', () => {
	const { db } = nuevo();
	const deps = conCarpetas();
	const l = crearLecciones({ db, deps });
	l.bajaADepartamentos();
	assert.ok(!fs.existsSync(path.join(deps[0].carpeta, '0-Bases/LECCIONES-DEL-JEFE.md')));
	assert.ok(l.anade({ ambito: 'todos', texto: 'A' }));
	assert.equal(l.anade({ ambito: 'todos', texto: 'A' }), null);
});

test('críticas de una en una', async () => {
	const { db, dir } = nuevo();
	let a = 0, pico = 0;
	const r = crearReuniones({ db, salud: salud(), dirDatos: dir, lecciones: crearLecciones({ db, deps: [] }), ejecutor: async () => { a++; pico = Math.max(pico, a); await espera(10); a--; return { estructurado: { respuesta: 'ok', lecciones: [] } }; } });
	await Promise.all([r.opina('a'), r.opina('b'), r.opina('c')]);
	assert.equal(pico, 1);
});

test('una reunión no pasa de 6 asistentes', () => {
	const { db, dir } = nuevo();
	db.ajuste(`reuniones:${new Date().toISOString().slice(0, 10)}`, 99);
	const r = crearReuniones({ db, salud: salud(), ejecutor: async () => ({ texto: '' }), dirDatos: dir });
	const id = r.propone({ tema: 'x', convoca: 'fiscal', asistentes: ['finanzas', 'legal', 'marketing', 'produccion', 'general', 'fiscal:modelos', 'legal:contratos', 'marketing:medios'] });
	assert.equal(JSON.parse(r.obtiene(id).asistentes).length, 6);
});

// --- Voz

const VOCES = [{ voice_id: 'b', category: 'premade' }, { voice_id: 'a', category: 'premade' }, { voice_id: 'c', category: 'cloned' }];

test('nunca una voz clonada, y la misma persona siempre con la misma voz', () => {
	for (const q of ['fiscal', 'finanzas:economista', 'legal', 'marketing:medios', 'produccion']) {
		assert.notEqual(eligeVoz(VOCES, q).voice_id, 'c');
		assert.equal(eligeVoz(VOCES, q).voice_id, eligeVoz([...VOCES].reverse(), q).voice_id);
	}
	assert.equal(eligeVoz([{ voice_id: 'c', category: 'cloned' }], 'x'), null);
});

function apiFalsa({ quedan = 1000 } = {}) {
	const llamadas = [];
	return { llamadas, hazFetch: async (url, op) => {
		llamadas.push({ url, op });
		if (url.includes('/v1/voices')) return new Response(JSON.stringify({ voices: VOCES }));
		if (url.includes('subscription')) return new Response(JSON.stringify({ character_limit: quedan, character_count: 0 }));
		return new Response(Buffer.from('mp3'));
	} };
}

test('narra una vez y reutiliza; la segunda no gasta', async () => {
	const { dir } = nuevo();
	const api = apiFalsa();
	const v = crearVoz({ dirDatos: dir, clave: 'k', hazFetch: api.hazFetch });
	const a = await v.narra({ reunion: 1, texto: 'Hola', quien: 'fiscal' });
	assert.equal(a.caracteres, 4);
	assert.equal(fs.readFileSync(a.ruta, 'utf8'), 'mp3');
	const n = api.llamadas.length;
	assert.equal((await v.narra({ reunion: 1, texto: 'Hola', quien: 'fiscal' })).caracteres, 0);
	assert.equal(api.llamadas.length, n);
	const tts = api.llamadas.find(l => l.url.includes('text-to-speech'));
	assert.equal(JSON.parse(tts.op.body).model_id, 'eleven_v4');
	assert.equal(tts.op.headers['xi-api-key'], 'k');
});

test('sin saldo no llama a generar; sin clave lo dice', async () => {
	const { dir } = nuevo();
	const api = apiFalsa({ quedan: 2 });
	await assert.rejects(crearVoz({ dirDatos: dir, clave: 'k', hazFetch: api.hazFetch }).narra({ reunion: 1, texto: 'Texto largo', quien: 'x' }), /caracteres/);
	assert.ok(!api.llamadas.some(l => l.url.includes('text-to-speech')));
	await assert.rejects(crearVoz({ dirDatos: dir, clave: null, hazFetch: api.hazFetch }).narra({ reunion: 1, texto: 'x', quien: 'x' }), /clave/);
});

test('lee la clave del fichero del Studio', () => {
	const { dir } = nuevo();
	const ruta = path.join(dir, 'e.env');
	fs.writeFileSync(ruta, 'OTRA=1\nELEVENLABS_API_KEY="abc123"\n');
	const antes = process.env.ELEVENLABS_API_KEY;
	delete process.env.ELEVENLABS_API_KEY;
	assert.equal(leeClave(ruta), 'abc123');
	assert.equal(leeClave(path.join(dir, 'no')), null);
	if (antes) process.env.ELEVENLABS_API_KEY = antes;
});

test('lo que llega a Alex sin verificar no pasa, y si no la convocó él, no se le llama', async () => {
	const { db, dir } = nuevo();
	const incompleto = { ...DECK, para_alex: true, resumen: 'Precio de memoria, pendiente de verificar' };
	const { f } = falso({ deck: incompleto });
	const escritos = [];
	const avisos = [];
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir, avisa: a => avisos.push(a), escribeSala: (h, t) => escritos.push([h, t]) });
	const id = r.propone({ tema: 'Banco', convoca: 'general', asistentes: ['finanzas'] });
	await espera(150);
	const x = r.obtiene(id);
	assert.equal(x.estado, 'resuelta');
	assert.match(x.nota_revisora, /No ha llegado a Alex/);
	assert.equal(avisos.length, 0, 'no se le llama');
	assert.ok(escritos.some(([h, t]) => h === 'general' && /no está para Alex/.test(t)));
	assert.equal(db.q(`SELECT * FROM interno WHERE reunion_id = ? AND tipo = 'investigacion'`, id).length, 1, 'antes, se ha investigado fuera');
});

test('la forma la arregla quien redacta: a Bea no le llega una presentación que se pasa de palabras', async () => {
	const { db, dir } = nuevo();
	const largo = { ...DECK, diapositivas: DECK.diapositivas.map(d => ({ ...d, titulo: 'una dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis' })) };
	let llamadas = 0;
	const f = async o => {
		const p = o.args[o.args.indexOf('-p') + 1];
		if (!o.args.includes('--json-schema')) return { texto: /Estás en la mesa/.test(p) ? 'PASO' : 'Dato.' };
		if (/se pasa de los límites/.test(p)) { llamadas++; return { estructurado: DECK }; }
		if (/Presentación, versión/.test(p)) { assert.equal(validaDeck(JSON.parse(p.slice(p.indexOf('{'), p.lastIndexOf('}') + 1).split('\n\nLo hablado')[0])).length, 0); return { estructurado: { aprobada: true, fallos: [], nota: 'Bien.' } }; }
		return { estructurado: largo };
	};
	const r = crearReuniones({ db, salud: salud(), ejecutor: f, dirDatos: dir });
	const id = r.convoca({ tema: 'x', convoca: 'produccion', asistentes: ['finanzas'] });
	await espera(150);
	assert.equal(llamadas, 1);
	assert.equal(r.obtiene(id).estado, 'lista');
});
