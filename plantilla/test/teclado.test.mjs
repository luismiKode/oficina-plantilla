import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atras, teclaFisica } from '../web/src/lib/teclado.js';

test('Esc vuelve un paso, y en la oficina no hace nada', () => {
	assert.equal(atras('/'), null);
	assert.equal(atras('/sala/general'), '#/');
	assert.equal(atras('/tareas'), '#/');
	assert.equal(atras('/tareas/marketing'), '#/tareas');
	assert.equal(atras('/reunion/3'), '#/reuniones');
	assert.equal(atras('/reuniones'), '#/');
});

test('Enter envía con teclado físico y salta de línea con el de pantalla', () => {
	const ipad = { estrecha: false, puntero: false, alto: 800 };
	assert.equal(teclaFisica({ ...ipad, altoVisible: 800 }), true, 'iPad con teclado físico');
	assert.equal(teclaFisica({ ...ipad, altoVisible: 745 }), true, 'iPad con la barrita del teclado físico');
	assert.equal(teclaFisica({ ...ipad, altoVisible: 480 }), false, 'iPad con el teclado de pantalla');
	assert.equal(teclaFisica({ estrecha: true, puntero: false, alto: 800, altoVisible: 800 }), false, 'iPhone');
	assert.equal(teclaFisica({ estrecha: false, puntero: true, alto: 800, altoVisible: 800 }), true, 'Mac');
});
