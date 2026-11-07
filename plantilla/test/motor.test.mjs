import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ejecuta, ErrorPermisos, ErrorSesionCaducada, ErrorLimite } from '../server/motor.mjs';

// Un `claude` falso: escribe las líneas que le digan y se queda vivo si se le pide.
function falso(lineas, { salir = 0, colgar = false, stderr = '' } = {}) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'falso-'));
	const f = path.join(dir, 'claude');
	const hecho = path.join(dir, 'siguio');
	fs.writeFileSync(f, `#!/usr/bin/env node
const fs=require('fs');
for (const l of ${JSON.stringify(lineas.map(l => JSON.stringify(l)))}) console.log(l);
${stderr ? `console.error(${JSON.stringify(stderr)});` : ''}
${colgar ? `setTimeout(()=>{fs.writeFileSync(${JSON.stringify(hecho)},'1');process.exit(0)},1500);` : `process.exitCode=${salir};`}
`, { mode: 0o755 });
	return { bin: f, hecho };
}
const init = tools => ({ type: 'system', subtype: 'init', session_id: 's1', tools });
const ok = t => ({ type: 'result', is_error: false, result: t, session_id: 's1', total_cost_usd: 0.01 });

test('flujo normal: texto, sesión y eventos', async () => {
	const { bin } = falso([init(['Read']), { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'x' } }] } }, ok('hola')]);
	const ev = [];
	const r = await ejecuta({ bin, args: [], cwd: os.tmpdir(), alEvento: e => ev.push(e) });
	assert.equal(r.texto, 'hola');
	assert.equal(r.sesion, 's1');
	assert.equal(ev[0].herramienta, 'Read');
});

test('herramienta fuera de lista: ErrorPermisos y proceso muerto antes de seguir', async () => {
	const { bin, hecho } = falso([init(['Read', 'mcp__x__send'])], { colgar: true });
	await assert.rejects(
		ejecuta({ bin, args: [], cwd: os.tmpdir(), auditar: t => t.filter(h => h !== 'Read') }),
		e => e instanceof ErrorPermisos && e.extras[0] === 'mcp__x__send',
	);
	await new Promise(r => setTimeout(r, 1800));
	assert.ok(!fs.existsSync(hecho), 'el proceso siguió trabajando');
});

test('modo de permisos distinto del pedido: se mata', async () => {
	const { bin } = falso([{ type: 'system', subtype: 'init', tools: [], permissionMode: 'bypassPermissions' }], { colgar: true });
	await assert.rejects(ejecuta({ bin, args: ['--permission-mode', 'dontAsk'], cwd: os.tmpdir() }), ErrorPermisos);
});

test('subagente con isolation: se mata', async () => {
	const { bin } = falso([init([]), { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Agent', input: { isolation: 'remote' } }] } }], { colgar: true });
	await assert.rejects(ejecuta({ bin, args: [], cwd: os.tmpdir() }), ErrorPermisos);
});

test('resultado sin init cuando se audita: no se da por bueno', async () => {
	const { bin } = falso([ok('hola')]);
	await assert.rejects(ejecuta({ bin, args: [], cwd: os.tmpdir(), auditar: () => [] }), /herramientas/);
});

test('un error de conector con «expired» no se toma por sesión caducada', async () => {
	const { bin } = falso([{ type: 'result', is_error: true, result: 'Tool error: token expired for Slack, 401' }], { salir: 1 });
	await assert.rejects(ejecuta({ bin, args: [], cwd: os.tmpdir() }), e => !(e instanceof ErrorSesionCaducada));
});

test('sesión caducada: su propio error', async () => {
	const { bin } = falso([{ type: 'result', is_error: true, result: 'Not logged in · Please run /login' }], { salir: 1 });
	await assert.rejects(ejecuta({ bin, args: [], cwd: os.tmpdir() }), ErrorSesionCaducada);
});

test('sesión caducada por stderr, sin result', async () => {
	const { bin } = falso([], { salir: 1, stderr: 'OAuth token has expired' });
	await assert.rejects(ejecuta({ bin, args: [], cwd: os.tmpdir() }), ErrorSesionCaducada);
});

test('límite de uso: su propio error', async () => {
	const { bin } = falso([{ type: 'result', is_error: true, result: 'You hit your limit' }], { salir: 1 });
	await assert.rejects(ejecuta({ bin, args: [], cwd: os.tmpdir() }), ErrorLimite);
});

test('se pasa de tiempo: lo mata', async () => {
	const { bin } = falso([init([])], { colgar: true });
	await assert.rejects(ejecuta({ bin, args: [], cwd: os.tmpdir(), tiempoMax: 200 }), /tiempo/);
});
