import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EQUIPO, resuelveHilo, registraAlta, lookPara } from '../server/equipo.mjs';
import { POR_ID } from '../server/departamentos.mjs';

const todos = Object.values(EQUIPO).flat();

test('nadie se parece del todo a otro', () => {
	const firmas = todos.map(p => JSON.stringify(p.look));
	assert.equal(new Set(firmas).size, firmas.length);
});

test('nombres únicos: nadie se llama Dirección ni agente', () => {
	const n = todos.map(p => p.nombre);
	assert.equal(new Set(n).size, n.length);
	assert.ok(!n.includes('Dirección') && !n.includes('agente'));
});

test('cada uno tiene nivel, cargo, carácter y forma de hablar', () => {
	for (const p of todos) {
		assert.ok(['dg', 'direccion', 'empleado', 'revisora', 'recepcion', 'correos', 'lean'].includes(p.nivel), p.nombre);
		for (const c of ['cargo', 'caracter', 'habla']) assert.ok(p[c]?.length > 3, `${p.nombre} ${c}`);
		for (const c of ['pelo', 'colorPelo', 'piel', 'ropa', 'pantalla']) assert.ok(p.look[c], `${p.nombre} ${c}`);
	}
});

test('Julián es el único director general y no lleva agente de carpeta', () => {
	assert.deepEqual(todos.filter(p => p.nivel === 'dg').map(p => p.nombre), ['Julián']);
	assert.equal(resuelveHilo('general').persona.nombre, 'Julián');
});

test('cada departamento tiene su dirección, y los roles coinciden con el organigrama', { skip: !fs.existsSync(POR_ID.fiscal.carpeta) }, () => {
	for (const [dep, personas] of Object.entries(EQUIPO)) {
		assert.equal(personas.filter(p => p.rol === null).length, 1, dep);
		if (dep === 'general') continue;
		assert.equal(personas[0].nivel, 'direccion', dep);
		const txt = fs.readFileSync(path.join(POR_ID[dep].carpeta, '0-Bases/equipo/README.md'), 'utf8');
		const filas = [...txt.matchAll(/^\|[^|]+\|\s*\*\*([^*]+)\*\*\s*\|([^|]*)\|/gm)].map(m => [m[1], m[2].match(/`([^`]+)`/)?.[1] || null]).filter(([, rol]) => rol);
		for (const [nombre, rol] of filas) {
			const p = personas.find(x => x.nombre === nombre);
			assert.ok(p, `${dep}: falta ${nombre}`);
			assert.equal(p.rol, rol, `${dep}: rol de ${nombre}`);
		}
		for (const p of personas) if (p.rol) assert.ok(fs.existsSync(path.join(POR_ID[dep].carpeta, '.claude/agents', p.rol + '.md')), `${dep}/${p.rol}`);
	}
});

test('resuelveHilo: acepta lo real y rechaza lo inventado', () => {
	assert.equal(resuelveHilo('fiscal:modelos').persona.nombre, 'Clara');
	for (const x of ['fiscal:nadie', '../etc', 'fiscal:modelos:x', '__proto__', undefined]) assert.equal(resuelveHilo(x), null);
});

test('un fichaje entra en la plantilla, sin agente de carpeta, y no se duplica', () => {
	const h = registraAlta({ dep: 'marketing', nombre: 'Pepe Ñoño', cargo: 'SEO', caracter: 'Le gustan los enlaces.', freelance: true });
	assert.equal(h, 'marketing:pepenono');
	assert.equal(resuelveHilo(h).persona.interna, true);
	assert.match(resuelveHilo(h).persona.cargo, /freelance/);
	registraAlta({ dep: 'marketing', nombre: 'Pepe Ñoño', cargo: 'SEO', caracter: 'x' });
	assert.equal(EQUIPO.marketing.filter(p => p.rol === 'pepenono').length, 1);
	assert.deepEqual(lookPara('Pepe'), lookPara('Pepe'));
	assert.throws(() => registraAlta({ dep: 'nada', nombre: 'x' }));
	EQUIPO.marketing.pop();
});
