import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { puntosDe, pendientes, fechaDe } from '../server/estado.mjs';
import { abrirDB } from '../server/db.mjs';

const HOY = new Date('2026-11-06T12:00:00Z');
const MD = `# Estado
## Ahora mismo
- nada
## Espera a Alex

- **Subvención:** decidir antes del 16-nov.
- **Portal:** mirar el portal
  antes del 8-nov.
1. Sin negrita. Y sigue [enlace](a.md).

## Fechas
- 1-dic
`;

test('saca los puntos con título, detalle y fecha, y para en la siguiente sección', () => {
	const p = puntosDe(MD, 'fiscal', HOY);
	assert.equal(p.length, 3);
	assert.equal(p[0].titulo, 'Subvención');
	assert.equal(p[0].detalle, 'decidir antes del 16-nov.');
	assert.equal(p[0].fecha, '2026-11-16');
	assert.match(p[1].texto, /antes del 8-nov/);
	assert.equal(p[2].texto, 'Sin negrita. Y sigue enlace.');
});

test('fechas: enero visto en noviembre es del año siguiente', () => {
	assert.equal(fechaDe('el 5-ene', HOY), '2027-01-05');
	assert.equal(fechaDe('sin fecha', HOY), null);
});

test('fechas: una pasada no es un plazo, y se salta a la siguiente', () => {
	assert.equal(fechaDe('Del 25-oct, ¿siguen abiertas?', HOY), null);
	assert.equal(fechaDe('Lo dijo el 3-nov y vence el 16-nov', HOY), '2026-11-16');
	assert.equal(fechaDe('hoy, 6-nov', HOY), '2026-11-06');
});

function montar(dep, contenido) {
	const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-'));
	if (contenido != null) fs.writeFileSync(path.join(carpeta, 'ESTADO.md'), contenido);
	return { id: dep, carpeta };
}
const db = () => abrirDB(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'o-')), 'o.db'));

test('un ESTADO ausente o sin sección no rompe la mesa, y ordena por fecha', () => {
	const r = pendientes([montar('a', null), montar('b', '# Nada'), montar('c', MD)], db(), HOY);
	assert.equal(r.length, 3);
	assert.equal(r[0].titulo, 'Portal');
	assert.equal(r[2].fecha, null);
});

test('no escribe en el ESTADO', () => {
	const dep = montar('c', MD);
	pendientes([dep], db(), HOY);
	assert.equal(fs.readFileSync(path.join(dep.carpeta, 'ESTADO.md'), 'utf8'), MD);
});
