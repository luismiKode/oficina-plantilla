import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirDB } from '../server/db.mjs';
import { crearReuniones } from '../server/reuniones.mjs';
import { crearDecorador, normaliza, leeDecoracion, asistentesDe } from '../server/decoracion.mjs';

const nuevo = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd-')); return { dir, db: abrirDB(path.join(dir, 'o.db')) }; };
const espera = (ms = 60) => new Promise(r => setTimeout(r, ms));
const salud = () => ({ ok() {}, caducada() {}, limite() {}, estado: () => ({ sesion: 'ok' }) });
const BUENA = { pared: 'verde', suelo: 'roble', lema: 'Primero la caja', pared_objetos: ['tele', 'cuadro'], suelo_objetos: ['gato', 'altavoz'], kpis: [{ etiqueta: 'Caja', valor: '96.400 €', fuente: 'ESTADO.md' }], resumen: 'Tele con la caja y un gato.' };

test('normaliza: fuera lo que no está en el catálogo', () => {
	const d = normaliza({ ...BUENA, pared: 'fucsia', suelo_objetos: ['gato', 'cañón', 'gato'], pared_objetos: ['tele', 'tele', 'bomba'] });
	assert.ok(d.pared !== 'fucsia' && d.pared !== 'grafito');
	assert.deepEqual(d.suelo_objetos, ['gato']);
	assert.deepEqual(d.pared_objetos, ['tele']);
});

test('normaliza: con topes para que no se llene', () => {
	const d = normaliza({ ...BUENA, pared_objetos: ['tele', 'cuadro', 'mapa', 'reloj', 'diana'], suelo_objetos: ['gato', 'perro', 'planta', 'arbol', 'altavoz', 'sofa', 'cajas'], kpis: Array(6).fill(BUENA.kpis[0]) });
	assert.equal(d.pared_objetos.length, 3);
	assert.equal(d.suelo_objetos.length, 5);
	assert.equal(d.kpis.length, 3);
});

test('un KPI sin fuente no entra: no se inventan números', () => {
	const d = normaliza({ ...BUENA, kpis: [{ etiqueta: 'Ventas', valor: '999' }, { etiqueta: 'Caja', valor: '10 €', fuente: 'ERP' }] });
	assert.deepEqual(d.kpis.map(k => k.etiqueta), ['Caja']);
});

test('ninguna planta repite color de pared', () => {
	assert.notEqual(normaliza(BUENA, { paredesOcupadas: ['verde'] }).pared, 'verde');
	assert.equal(normaliza(BUENA, { paredesOcupadas: ['rosa'] }).pared, 'verde');
});

test('sin formato, error', () => assert.throws(() => normaliza(null)));

test('los que suben a decidir son del departamento', () => {
	const a = asistentesDe('fiscal');
	assert.equal(a.length, 3);
	assert.ok(a.every(h => h.startsWith('fiscal:')));
});

function reuniones(ejecutor) {
	const { db, dir } = nuevo();
	const r = crearReuniones({ db, salud: salud(), ejecutor, dirDatos: dir, decorador: crearDecorador({ db }) });
	return { db, r };
}

test('se reúnen de verdad, lo deciden y queda guardado, sin molestar a Alex', async () => {
	const prompts = [];
	const { db, r } = reuniones(async o => {
		prompts.push(o.args[o.args.indexOf('-p') + 1]);
		return o.args.includes('--json-schema') ? { estructurado: BUENA } : { texto: 'Yo pondría un gato.' };
	});
	const id = r.decorar('fiscal');
	assert.equal(r.obtiene(id).tipo, 'decoracion');
	await espera(100);
	assert.equal(r.obtiene(id).estado, 'resuelta');
	assert.equal(prompts.length, 4, 'tres del equipo y su dirección');
	assert.match(prompts[1], /Yo pondría un gato/, 'cada uno oye a los anteriores');
	assert.match(prompts[3], /no inventes/);
	assert.equal(leeDecoracion(db, 'fiscal').pared, 'verde');
	assert.ok(db.q(`SELECT * FROM interno WHERE reunion_id = ? AND tipo = 'mesa'`, id).length === 3);
});

test('no gasta el tope de reuniones de trabajo', async () => {
	const { db, r } = reuniones(async o => (o.args.includes('--json-schema') ? { estructurado: BUENA } : { texto: 'x' }));
	r.decorar('legal');
	await espera(100);
	assert.equal(db.ajuste(`reuniones:${new Date().toISOString().slice(0, 10)}`), null);
});

test('si la dirección devuelve algo roto, se atasca y no pisa lo que había', async () => {
	const { db, r } = reuniones(async o => (o.args.includes('--json-schema') ? { texto: '{roto' } : { texto: 'x' }));
	db.ajuste('decoracion:legal', JSON.stringify(BUENA));
	const id = r.decorar('legal');
	await espera(100);
	assert.equal(r.obtiene(id).estado, 'atascada');
	assert.equal(leeDecoracion(db, 'legal').pared, 'verde');
});
