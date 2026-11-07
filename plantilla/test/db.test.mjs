import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirDB } from '../server/db.mjs';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ofi-')), 'o.db');

test('crea las tablas y es idempotente', () => {
	const ruta = tmp();
	abrirDB(ruta).cerrar();
	const db = abrirDB(ruta);
	const t = db.q(`SELECT name FROM sqlite_master WHERE type='table'`).map(r => r.name);
	for (const n of ['mensajes', 'correos', 'tareas', 'reuniones', 'interno', 'lecciones', 'ajustes', 'suscripciones', 'registro']) assert.ok(t.includes(n), n);
	db.cerrar();
});

test('la base no la lee nadie más', () => {
	const ruta = tmp();
	abrirDB(ruta).cerrar();
	assert.equal(fs.statSync(ruta).mode & 0o077, 0);
});

test('ajustes: guarda, lee y borra', () => {
	const db = abrirDB(tmp());
	assert.equal(db.ajuste('x'), null);
	db.ajuste('x', 'y');
	assert.equal(db.ajuste('x'), 'y');
	db.ajuste('x', null);
	assert.equal(db.ajuste('x'), null);
	db.cerrar();
});
