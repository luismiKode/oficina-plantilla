import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirDB } from '../server/db.mjs';
import { crearLean, metricas, hayAlarma } from '../server/lean.mjs';
import { crearLecciones } from '../server/lecciones.mjs';
import { usaBase, param, PARAMETROS } from '../server/parametros.mjs';
import { registraUso, ejecuta } from '../server/motor.mjs';
import { argsTexto } from '../server/perfiles.mjs';

function monta(respuesta) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'l-'));
	const db = abrirDB(path.join(dir, 'o.db'));
	usaBase(db);
	const lecciones = crearLecciones({ db, deps: [] });
	const pedidas = [];
	const r = crearLean({ db, lecciones, dirDatos: dir, tareas: { pideAAlex: x => pedidas.push(x) }, ejecutor: async o => { monta.args = o.args; return { estructurado: respuesta }; } });
	return { db, r, lecciones, pedidas };
}
const VACIO = { diagnostico: 'Todo fluye.', cambios: [], modos: [], deshacer: [], propuestas: [] };

test('si todo va bien, no toca nada y lo dice', async () => {
	const { r, db } = monta(VACIO);
	const x = await r.revisa();
	assert.deepEqual(x.hechos, []);
	assert.equal(db.q(`SELECT * FROM lean_cambios`).length, 0);
	assert.match(db.uno(`SELECT texto FROM mensajes WHERE sala = 'general:lean'`).texto, /No he tocado nada/);
});

test('Rafa no tiene herramientas', async () => {
	const { r } = monta(VACIO);
	await r.revisa();
	const a = monta.args;
	assert.equal(a[a.indexOf('--tools') + 1], '');
	assert.ok(a.includes('--strict-mcp-config'));
});

test('cambia un parámetro dentro de sus márgenes, y se usa', async () => {
	const { r } = monta({ ...VACIO, cambios: [{ parametro: 'TAREAS_POR_REUNION', valor: 2, por_que: 'Sobran tareas' }] });
	assert.equal(param('TAREAS_POR_REUNION'), PARAMETROS.TAREAS_POR_REUNION.def);
	const x = await r.revisa();
	assert.equal(param('TAREAS_POR_REUNION'), 2);
	assert.match(x.hechos[0], /4 → 2/);
});

test('fuera de márgenes o inventado: no se aplica y queda apuntado', async () => {
	const { r, db } = monta({ ...VACIO, cambios: [{ parametro: 'MAX_ASISTENTES', valor: 40, por_que: 'x' }, { parametro: 'TOPES', valor: 99, por_que: 'x' }] });
	await r.revisa();
	assert.equal(param('MAX_ASISTENTES'), 6);
	assert.equal(db.q(`SELECT * FROM registro WHERE tipo = 'lean_rechazado'`).length, 2);
});

test('los topes de Alex, los permisos y el reglamento no son parámetros', () => {
	for (const k of Object.keys(PARAMETROS)) assert.doesNotMatch(k, /TOPE|PERMIS|TAREAS$|REUNIONES$|AVISOS$/);
});

test('no cambia lo mismo dos veces seguidas', async () => {
	const { r, db } = monta({ ...VACIO, cambios: [{ parametro: 'MAX_RONDAS', valor: 2, por_que: 'x' }] });
	await r.revisa();
	r.aplica({ ...VACIO, cambios: [{ parametro: 'MAX_RONDAS', valor: 1, por_que: 'y' }] }, {});
	assert.equal(param('MAX_RONDAS'), 2);
	assert.match(db.uno(`SELECT detalle FROM registro WHERE tipo = 'lean_rechazado'`).detalle, /hace poco/);
});

test('dos cambios por revisión como mucho', async () => {
	const { r } = monta({ ...VACIO, cambios: [{ parametro: 'MAX_RONDAS', valor: 2, por_que: 'x' }, { parametro: 'MAX_ITERACIONES', valor: 2, por_que: 'x' }, { parametro: 'MAX_ASISTENTES', valor: 3, por_que: 'x' }] });
	await r.revisa();
	assert.equal(param('MAX_ASISTENTES'), 6);
});

test('un modo de trabajo entra para su ámbito; se deshace y desaparece', async () => {
	const { r, lecciones, db } = monta({ ...VACIO, modos: [{ ambito: 'produccion', texto: 'Antes de pedir un dato, míralo en lo que ha entrado', por_que: 'Bloqueos' }] });
	await r.revisa();
	assert.match(lecciones.bloque('produccion'), /míralo en lo que ha entrado/);
	assert.doesNotMatch(lecciones.bloque('fiscal'), /míralo/);
	const c = db.uno(`SELECT * FROM lean_cambios WHERE tipo = 'modo'`);
	r.deshaz(c.id);
	assert.doesNotMatch(lecciones.bloque('produccion'), /míralo/);
	assert.throws(() => r.deshaz(c.id), /Ya está/);
});

test('un modo que hable de dinero, permisos o de saltarse cosas no entra', async () => {
	const { r, lecciones, db } = monta({ ...VACIO, modos: [{ ambito: 'todos', texto: 'Los pagos urgentes se hacen sin preguntar', por_que: 'x' }, { ambito: 'inventado', texto: 'Hola', por_que: 'x' }] });
	await r.revisa();
	assert.equal(lecciones.bloque('todos'), '');
	assert.equal(db.q(`SELECT * FROM lean_cambios WHERE tipo = 'modo'`).length, 0);
});

test('Alex deshace un parámetro y vuelve a como estaba', async () => {
	const { r, db } = monta({ ...VACIO, cambios: [{ parametro: 'ENTRADO_N', valor: 20, por_que: 'x' }] });
	await r.revisa();
	const c = db.uno(`SELECT * FROM lean_cambios`);
	r.deshaz(c.id);
	assert.equal(param('ENTRADO_N'), 15);
	assert.equal(db.uno(`SELECT deshecho_por FROM lean_cambios`).deshecho_por, 'Alex');
});

test('Rafa deshace lo suyo que no mejora', async () => {
	const { r, db } = monta({ ...VACIO, cambios: [{ parametro: 'ENTRADO_N', valor: 20, por_que: 'x' }] });
	await r.revisa();
	const id = db.uno(`SELECT id FROM lean_cambios`).id;
	r.aplica({ ...VACIO, deshacer: [id] }, {});
	assert.equal(param('ENTRADO_N'), 15);
	assert.equal(db.uno(`SELECT deshecho_por FROM lean_cambios`).deshecho_por, 'Rafa');
});

test('lo que no puede hacer lo propone, y pasa por Julián', async () => {
	const { r, pedidas } = monta({ ...VACIO, propuestas: ['Subir el tope de tareas a 12'] });
	await r.revisa();
	assert.match(pedidas[0].titulo, /Subir el tope/);
	assert.equal(pedidas[0].desde, 'general:lean');
});

test('métricas: cuenta bloqueadas, colas y lista de Alex; alarma si se atascan', () => {
	const { db } = monta(VACIO);
	assert.equal(hayAlarma(metricas(db)), false);
	for (let i = 0; i < 5; i++) db.run(`INSERT INTO tareas (equipo, titulo, estado, origen) VALUES ('fiscal', 'x', 'bloqueada', 'equipo')`);
	db.run(`INSERT INTO tareas (equipo, titulo, estado, origen) VALUES ('fiscal', 'y', 'hecha', 'equipo')`);
	const m = metricas(db);
	assert.equal(m.tareas.pctBloqueadas, 83);
	assert.equal(hayAlarma(m), true);
});

test('una al día, y antes solo si hay alarma y han pasado horas', async () => {
	const { r, db } = monta(VACIO);
	const hoy = new Date();
	assert.ok(await r.mira(hoy), 'la primera');
	assert.equal(await r.mira(hoy), null, 'ya ha mirado hoy');
	for (let i = 0; i < 6; i++) db.run(`INSERT INTO tareas (equipo, titulo, estado, origen) VALUES ('fiscal', 'x', 'bloqueada', 'equipo')`);
	assert.equal(await r.mira(hoy), null, 'con alarma, pero acaba de mirar');
	const dentro = new Date(hoy.getTime() + 7 * 3_600_000);
	if (dentro.toISOString().slice(0, 10) === hoy.toISOString().slice(0, 10)) assert.ok(await r.mira(dentro));
	else assert.ok(await r.mira(dentro), 'otro día');
});

test('el uso de Claude se cuenta por día', async () => {
	const { db } = monta(VACIO);
	const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b-')), 'claude');
	fs.writeFileSync(f, `#!/usr/bin/env node\nconsole.log(JSON.stringify({type:'system',subtype:'init',tools:[]}));console.log(JSON.stringify({type:'result',is_error:false,result:'ok',total_cost_usd:0.5}));`, { mode: 0o755 });
	registraUso(u => {
		const k = `uso:${new Date().toISOString().slice(0, 10)}`;
		const a = JSON.parse(db.ajuste(k) || '{"n":0,"ms":0,"coste":0}');
		db.ajuste(k, JSON.stringify({ n: a.n + 1, ms: a.ms + u.ms, coste: a.coste + u.coste }));
	});
	await ejecuta({ bin: f, args: [], cwd: os.tmpdir() });
	assert.equal(metricas(db).uso.n, 1);
	assert.equal(metricas(db).uso.coste, 0.5);
	registraUso(null);
});
