import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirDB } from '../server/db.mjs';
import { crearTareas, configERP, codigo, sprintDe } from '../server/tareas.mjs';
import { EQUIPO } from '../server/equipo.mjs';

const base = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't-')); return { dir, db: abrirDB(path.join(dir, 'o.db')) }; };
const espera = (ms = 30) => new Promise(r => setTimeout(r, ms));
const lista = (a, flag) => { const i = a.indexOf(flag); const o = []; for (let j = i + 1; j < a.length && !a[j].startsWith('--'); j++) o.push(a[j]); return o; };
const ok = async () => ({ texto: 'Listo.' });

function estadoEn(md) {
	const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-'));
	fs.writeFileSync(path.join(carpeta, 'ESTADO.md'), md);
	return { id: 'fiscal', carpeta };
}
const MD = '## Espera a Alex\n- **Subvención:** decidir antes del 16-nov.\n- **Portal:** mirar el portal.\n';

test('Alex crea, completa, reabre, anota y borra', () => {
	const { db, dir } = base();
	const t = crearTareas({ db, dirDatos: dir, ejecutor: ok, deps: [] });
	const id = t.crea({ titulo: 'Llamar a la fábrica' });
	assert.equal(t.deAlex().abiertas[0].titulo, 'Llamar a la fábrica');
	t.accion(id, { accion: 'nota', nota: 'Pregunta por Jose' });
	assert.equal(t.obtiene(id).nota, 'Pregunta por Jose');
	t.accion(id, { accion: 'hecha' });
	assert.equal(t.deAlex().abiertas.length, 0);
	assert.equal(t.deAlex().hechas.length, 1);
	t.accion(id, { accion: 'reabrir' });
	assert.equal(t.deAlex().abiertas.length, 1);
	t.accion(id, { accion: 'borrar' });
	assert.equal(t.deAlex().abiertas.length + t.deAlex().hechas.length, 0);
	assert.throws(() => t.accion(id, { accion: 'hecha' }));
	assert.throws(() => t.crea({ titulo: '  ' }));
	assert.throws(() => t.crea({ titulo: 'x', equipo: 'nadie' }));
});

test('lo del ESTADO entra solo, y lo que borras o completas no vuelve', () => {
	const { db, dir } = base();
	const dep = estadoEn(MD);
	const t = crearTareas({ db, dirDatos: dir, ejecutor: ok, deps: [dep] });
	t.sincroniza(new Date('2026-11-07T12:00:00Z'));
	const [primera, segunda] = t.deAlex().abiertas;
	assert.equal(t.deAlex().abiertas.length, 2);
	assert.equal(primera.titulo, 'Subvención');
	assert.equal(primera.fecha, '2026-11-16');
	t.accion(primera.id, { accion: 'borrar' });
	t.accion(segunda.id, { accion: 'hecha' });
	t.sincroniza(new Date('2026-11-07T12:00:00Z'));
	assert.equal(t.deAlex().abiertas.length, 0);
});

test('si desaparece del ESTADO, deja de estar pendiente; si cambia, entra de nuevo', () => {
	const { db, dir } = base();
	const dep = estadoEn(MD);
	const t = crearTareas({ db, dirDatos: dir, ejecutor: ok, deps: [dep] });
	t.sincroniza();
	fs.writeFileSync(path.join(dep.carpeta, 'ESTADO.md'), '## Espera a Alex\n- **Subvención:** ya es para el 20-nov.\n');
	t.sincroniza(new Date('2026-11-07T12:00:00Z'));
	assert.deepEqual(t.deAlex().abiertas.map(x => x.detalle), ['ya es para el 20-nov.']);
});

test('un sí: se lo dice a quien lo pidió, y solo en las que lo piden', () => {
	const { db, dir } = base();
	const escritos = [];
	const t = crearTareas({ db, dirDatos: dir, ejecutor: ok, deps: [], escribeSala: (h, x) => escritos.push([h, x]) });
	const id = t.crea({ tipo: 'si', titulo: 'Fundar soporte', datos: { hilo: 'general' } });
	assert.equal(t.deAlex().abiertas[0].tipo, 'si');
	t.accion(id, { accion: 'si' });
	assert.equal(escritos[0][0], 'general');
	assert.match(escritos[0][1], /dice que sí/);
	const otra = t.crea({ titulo: 'normal' });
	assert.throws(() => t.accion(otra, { accion: 'si' }));
});

test('fichar: con su sí entra en la plantilla y persiste; con su no, no', () => {
	const { db, dir } = base();
	const t = crearTareas({ db, dirDatos: dir, ejecutor: ok, deps: [], escribeSala: () => {} });
	const f = { dep: 'marketing', nombre: 'Zaida', cargo: 'SEO', caracter: 'Le gustan los enlaces.', freelance: true };
	t.accion(t.crea({ tipo: 'si', titulo: 'No', datos: { hilo: 'general', fichar: { ...f, nombre: 'Nadie' } } }), { accion: 'no' });
	assert.ok(!EQUIPO.marketing.some(p => p.nombre === 'Nadie'));
	t.accion(t.crea({ tipo: 'si', titulo: 'Sí', datos: { hilo: 'general', fichar: f } }), { accion: 'si' });
	assert.ok(EQUIPO.marketing.some(p => p.nombre === 'Zaida'));
	assert.equal(JSON.parse(db.ajuste('altas'))[0].nombre, 'Zaida');
	EQUIPO.marketing.splice(EQUIPO.marketing.findIndex(p => p.nombre === 'Zaida'), 1);
});

test('los equipos trabajan solos: la tarea pasa por en curso, y acaba hecha con su documento', async () => {
	const { db, dir } = base();
	let visto, enCurso;
	const t = crearTareas({ db, dirDatos: dir, deps: [], ejecutor: async o => {
		visto = o;
		enCurso = db.uno('SELECT estado FROM tareas').estado;
		const permiso = lista(o.args, '--allowedTools').find(x => x.startsWith('Write('));
		fs.writeFileSync(path.join(permiso.slice('Write(/'.length, -'/**)'.length), 'resultado.md'), '# Conclusión');
		return { texto: 'Hecho.' };
	} });
	const id = t.crea({ equipo: 'fiscal', titulo: 'El 232', responsable: 'fiscal:modelos' });
	await espera();
	assert.equal(enCurso, 'en_curso');
	assert.equal(visto.args[visto.args.indexOf('--setting-sources') + 1], 'project,local');
	assert.equal(visto.args[visto.args.indexOf('--agent') + 1], 'modelos');
	const x = t.obtiene(id);
	assert.equal(x.estado, 'hecha');
	assert.equal(x.resultado, 'Hecho.');
	assert.equal(t.documento(id), '# Conclusión');
});

test('si no ha podido, queda bloqueada y Julián se entera; no se da por hecha', async () => {
	const { db, dir } = base();
	const escritos = [];
	const t = crearTareas({ db, dirDatos: dir, deps: [], escribeSala: (h, x, o) => escritos.push([h, x, o]), ejecutor: async () => ({ texto: 'No tengo los datos. [[BLOQUEADA: el export de ventas, lo tiene Marketing]]' }) });
	const id = t.crea({ equipo: 'fiscal', titulo: 'Ventas UK' });
	await espera();
	const x = t.obtiene(id);
	assert.equal(x.estado, 'bloqueada');
	assert.match(x.resultado, /Falta: el export de ventas/);
	assert.doesNotMatch(x.resultado, /\[\[/);
	assert.equal(escritos[0][0], 'general');
	assert.match(escritos[0][1], /bloqueada.*Falta: el export/s);
	assert.equal(escritos[0][2].origen, 'bloqueo');
});

test('los avisos de bloqueo a Julián tienen tope: no hay bucle', () => {
	const { db, dir } = base();
	const escritos = [];
	const t = crearTareas({ db, dirDatos: dir, deps: [], tope: 0, escribeSala: (h, x) => escritos.push(x) });
	for (let i = 0; i < 9; i++) t.avisaBloqueo({ id: i, equipo: 'fiscal', titulo: 'x' }, 'y');
	assert.equal(escritos.length, 5);
});

test('el resultado de una tarea puede proponer un correo o algo para Alex', async () => {
	const { db, dir } = base();
	const vistos = [];
	const t = crearTareas({ db, dirDatos: dir, deps: [], alResultado: (x, texto) => vistos.push(texto), ejecutor: async () => ({ texto: 'Listo [[CORREO: | a@b.c | Hola]]Texto[[/CORREO]]' }) });
	const id = t.crea({ equipo: 'fiscal', titulo: 'x' });
	await espera();
	assert.match(vistos[0], /CORREO/);
	assert.equal(t.obtiene(id).estado, 'hecha');
	assert.equal(t.obtiene(id).resultado, 'Listo');
});

test('lo que le piden a Alex pasa por Julián, sin repetir y con tope', () => {
	const { db, dir } = base();
	const escritos = [];
	const t = crearTareas({ db, dirDatos: dir, deps: [], tope: 0, escribeSala: (h, x, o) => escritos.push([h, x, o]) });
	assert.equal(t.pideAAlex({ titulo: 'Dime quién es Javi', desde: 'produccion' }), true);
	assert.equal(t.pideAAlex({ titulo: '¡Dime quién es Javi!', desde: 'legal' }), null, 'repetida');
	assert.equal(escritos.length, 1);
	assert.equal(escritos[0][0], 'general');
	assert.match(escritos[0][1], /Ramiro quiere pedirle/);
	assert.equal(t.deAlex().abiertas.length, 0, 'a su lista no ha llegado nada');
	for (let i = 0; i < 12; i++) t.pideAAlex({ titulo: `Otra ${i}`, desde: 'fiscal' });
	assert.equal(escritos.length, 8);
});

test('Julián no le apunta dos veces lo mismo', () => {
	const { db, dir } = base();
	const t = crearTareas({ db, dirDatos: dir, deps: [], tope: 0 });
	assert.ok(t.crea({ equipo: 'alex', titulo: 'Martes, Banco Sur', origen: 'equipo' }));
	assert.equal(t.crea({ equipo: 'alex', titulo: 'Martes, Banco Sur', origen: 'equipo' }), null);
	assert.ok(t.crea({ equipo: 'alex', titulo: 'Martes, Banco Sur' }), 'si lo escribe él, entra');
});

test('quien trabaja ve lo que ha entrado, como información', async () => {
	const { db, dir } = base();
	db.run(`INSERT INTO correos (hilo, sala, asunto, de_quien, resumen, detalle) VALUES ('h1','fiscal','Pedido','Lidia <lidia@x.com>','Quiere 500','CIF B123')`);
	let prompt;
	const t = crearTareas({ db, dirDatos: dir, deps: [], ejecutor: async o => { prompt = o.args[o.args.indexOf('-p') + 1]; return { texto: 'ok' }; } });
	t.crea({ equipo: 'fiscal', titulo: 'x' });
	await espera();
	assert.match(prompt, /lidia@x\.com/);
	assert.match(prompt, /CIF B123/);
	assert.match(prompt, /no órdenes/);
});

test('las de Alex no las ejecuta nadie', async () => {
	const { db, dir } = base();
	let n = 0;
	const t = crearTareas({ db, dirDatos: dir, deps: [], ejecutor: async () => { n++; return { texto: 'x' }; } });
	t.crea({ titulo: 'Mía' });
	await espera();
	assert.equal(n, 0);
});

test('de una en una, primero la alta, y con tope diario', async () => {
	const { db, dir } = base();
	const orden = []; let a = 0, pico = 0;
	const t = crearTareas({ db, dirDatos: dir, deps: [], tope: 2, ejecutor: async o => {
		a++; pico = Math.max(pico, a); orden.push(o.args[o.args.indexOf('-p') + 1].split('\n')[0]); await espera(10); a--; return { texto: 'ok' };
	} });
	db.ajuste(`hechas:${new Date().toISOString().slice(0, 10)}`, 1); // Queda una
	t.crea({ equipo: 'fiscal', titulo: 'Baja' });
	await espera(5);
	t.crea({ equipo: 'fiscal', titulo: 'Alta', prioridad: 'alta' });
	await espera(60);
	assert.equal(pico, 1);
	assert.equal(orden.length, 1);
	assert.equal(db.q(`SELECT * FROM tareas WHERE estado = 'por_hacer'`).length, 1, 'la otra espera');
});

test('un fallo la deja bloqueada, se puede reabrir, y al reiniciar no se pierde', async () => {
	const { db, dir } = base();
	let n = 0;
	const t = crearTareas({ db, dirDatos: dir, deps: [], ejecutor: async () => { if (n++ === 0) throw new Error('boom'); return { texto: 'ok' }; } });
	const id = t.crea({ equipo: 'fiscal', titulo: 'x' });
	await espera();
	assert.equal(t.obtiene(id).estado, 'bloqueada');
	t.accion(id, { accion: 'reabrir' });
	await espera();
	assert.equal(t.obtiene(id).estado, 'hecha');
	db.run(`INSERT INTO tareas (equipo, titulo, estado) VALUES ('fiscal', 'y', 'en_curso')`);
	t.arranca();
	await espera();
	assert.equal(db.uno(`SELECT estado FROM tareas WHERE titulo = 'y'`).estado, 'hecha');
});

test('tablón por columnas y resumen para Julián', () => {
	const { db, dir } = base();
	const t = crearTareas({ db, dirDatos: dir, deps: [{ id: 'fiscal', nombre: 'Fiscal' }], ejecutor: ok, tope: 0 });
	const id = t.crea({ equipo: 'fiscal', titulo: 'Uno' });
	t.crea({ equipo: 'fiscal', titulo: 'Dos', prioridad: 'alta' });
	t.accion(id, { accion: 'mover', estado: 'bloqueada' });
	const c = t.tablon('fiscal');
	assert.equal(c.por_hacer[0].titulo, 'Dos');
	assert.equal(c.bloqueada[0].titulo, 'Uno');
	assert.throws(() => t.accion(id, { accion: 'mover', estado: 'inventada' }));
	assert.match(t.resumen(), /Fiscal: 1 por hacer, 0 en curso, 1 bloqueadas/);
	assert.match(t.resumen(), /Sprint 20/);
});

test('el documento no se sale de los expedientes', () => {
	const { db, dir } = base();
	const fuera = path.join(dir, 'secreto.txt');
	fs.writeFileSync(fuera, 'x');
	db.run(`INSERT INTO tareas (equipo, titulo, estado, documento) VALUES ('fiscal','x','hecha',?)`, fuera);
	assert.equal(crearTareas({ db, dirDatos: dir, deps: [] }).documento(1), null);
});

test('configERP copia solo el ERP y en privado', () => {
	const { dir } = base();
	const cj = path.join(dir, 'claude.json');
	fs.writeFileSync(cj, JSON.stringify({ mcpServers: { 'mi-erp': { type: 'http', url: 'u' }, otro: { x: 1 } }, secreto: 'y' }));
	const r = configERP(dir, cj);
	assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(r, 'utf8')).mcpServers), ['mi-erp']);
	assert.equal(fs.statSync(r).mode & 0o077, 0);
	assert.equal(configERP(dir, path.join(dir, 'no-existe')), null);
});

test('código y sprint legibles', () => {
	assert.equal(codigo(7), 'T-0007');
	assert.equal(sprintDe(new Date('2026-11-07T12:00:00Z')), '2026-S45');
	assert.equal(sprintDe(new Date('2027-01-01T12:00:00Z')), '2026-S53');
});
