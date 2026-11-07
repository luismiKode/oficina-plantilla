import { test } from 'node:test';
import assert from 'node:assert/strict';
import { permitidas, fueraDeLista, argsSala, argsEncargo, argsRecepcion, argsReunion } from '../server/perfiles.mjs';
import { IDS } from '../server/departamentos.mjs';

const ESCRIBE = /send|reply|forward|trash|alta_factura|conciliar|crear_|share_file|create_event|delete|update_event|importar|fijar|marcar|categorizar|^Bash$|^Edit$|WebFetch|WebSearch/;
const val = (args, flag) => args[args.indexOf(flag) + 1];
const lista = (args, flag) => { const i = args.indexOf(flag); const o = []; for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) o.push(args[j]); return o; };

for (const dep of IDS) {
	test(`${dep}: ninguna herramienta permitida en sala escribe o se conecta fuera`, () => {
		for (const h of permitidas(dep, 'sala')) assert.doesNotMatch(h, ESCRIBE, h);
	});
	test(`${dep}: ninguna herramienta permitida en encargo escribe fuera`, () => {
		for (const h of permitidas(dep, 'encargo')) assert.doesNotMatch(h, ESCRIBE, h);
		for (const h of permitidas(dep, 'encargo')) assert.doesNotMatch(h, /Gmail|Slack|Drive|Calendar/, h);
	});
	test(`${dep}: sin Bash, Write ni Edit en la sala`, () => {
		const a = argsSala(dep, { prompt: 'x', sistema: 's' });
		const tools = val(a, '--tools').split(',');
		for (const t of ['Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch']) assert.ok(!tools.includes(t), t);
		for (const t of ['Bash', 'Write', 'Edit', 'WebFetch']) assert.ok(lista(a, '--disallowedTools').includes(t), t);
		assert.equal(val(a, '--permission-mode'), 'dontAsk');
	});
}

test('nadie toca borradores desde una sala', () => {
	assert.ok(!permitidas('legal').has('mcp__claude_ai_Gmail__create_draft'));
	assert.ok(!permitidas('produccion').has('mcp__claude_ai_Gmail__create_draft'));
	for (const h of ['update_draft', 'list_drafts', 'get_draft']) {
		assert.ok(!permitidas('produccion').has('mcp__claude_ai_Gmail__' + h), h);
		assert.ok(lista(argsSala('produccion', { prompt: 'x', sistema: 's' }), '--disallowedTools').includes('mcp__claude_ai_Gmail__' + h), h);
	}
});

test('En reunión y encargo, Grep y Glob tampoco salen de su carpeta', () => {
	for (const a of [argsEncargo('fiscal', { prompt: 'x', sistema: 's', carpeta: '/k/f', dirExpediente: '/d' }), argsReunion('fiscal', { prompt: 'x', sistema: 's', carpeta: '/k/f' })]) {
		const ok = lista(a, '--allowedTools');
		assert.ok(ok.includes('Grep(//k/f/**)') && ok.includes('Glob(//k/f/**)'));
		assert.ok(!ok.includes('Grep') && !ok.includes('Glob'));
	}
});

test('Secretos reales denegados', () => {
	const d = JSON.parse(val(argsSala('finanzas', { prompt: 'x', sistema: 's' }), '--settings')).permissions.deny.join('\n');
	for (const p of ['secretos', '.zsh_history', 'Downloads', 'Desktop', '/Volumes', '.codex', 'Documents/Claude']) assert.ok(d.includes(p), p);
});

test('Una denegada extra de otra sala no le quita a nadie lo que tiene permitido', () => {
	const no = lista(argsSala('fiscal', { prompt: 'x', sistema: 's', denegadasExtra: ['mcp__mi-erp__resumen', 'mcp__x__y'] }), '--disallowedTools');
	assert.ok(!no.includes('mcp__mi-erp__resumen'));
	assert.ok(no.includes('mcp__x__y'));
});

test('Lista cerrada: lo desconocido queda fuera', () => {
	assert.deepEqual(fueraDeLista(['Read', 'mcp__nuevo__borra_todo', 'Write'], 'finanzas'), ['mcp__nuevo__borra_todo', 'Write']);
});

test('Google Ads: leer sí, mutar no; y solo en Marketing', () => {
	assert.deepEqual(fueraDeLista(['mcp__google-ads-mcp__search', 'mcp__google-ads-mcp__execute_mutate'], 'marketing'), ['mcp__google-ads-mcp__execute_mutate']);
	assert.deepEqual(fueraDeLista(['mcp__google-ads-mcp__search'], 'finanzas'), ['mcp__google-ads-mcp__search']);
	assert.deepEqual(fueraDeLista(['mcp__analytics-mcp__run_report'], 'marketing'), []);
});

test('Marketing puede leer Meta, pero no crear ni borrar', () => {
	assert.ok(permitidas('marketing').has('mcp__meta-ads__ads_get_ad_entities'));
	assert.deepEqual(fueraDeLista(['mcp__meta-ads__ads_creative_delete'], 'marketing'), ['mcp__meta-ads__ads_creative_delete']);
	assert.ok(!permitidas('finanzas').has('mcp__meta-ads__ads_get_ad_entities'));
});

test('Sala: apaga los plugins del usuario', () => {
	const s = JSON.parse(val(argsSala('fiscal', { prompt: 'x', sistema: 's', pluginsUsuario: ['superpowers@x'] }), '--settings'));
	assert.equal(s.enabledPlugins['superpowers@x'], false);
	assert.match(s.hooks.PreToolUse[0].matcher, /create_draft/);
});

test('Encargo: sin ajustes de usuario y Write solo en su expediente', () => {
	const a = argsEncargo('fiscal', { prompt: 'x', sistema: 's', carpeta: '/k/fiscal', dirExpediente: '/d/E-1' });
	assert.equal(val(a, '--setting-sources'), 'project,local');
	const ok = lista(a, '--allowedTools');
	assert.ok(ok.includes('Write(//d/E-1/**)'));
	assert.ok(!ok.includes('Write'));
	assert.ok(!ok.includes('Read'));
	assert.ok(ok.includes('Read(//k/fiscal/**)'));
});

test('Recepción: solo buscar, leer hilo y calendario, y sin sesión', () => {
	const a = argsRecepcion({ prompt: 'x' });
	assert.deepEqual(lista(a, '--allowedTools').sort(), ['mcp__claude_ai_Gmail__get_thread', 'mcp__claude_ai_Gmail__search_threads', 'mcp__claude_ai_Google_Calendar__list_events', 'mcp__claude_ai_Slack__slack_read_thread', 'mcp__claude_ai_Slack__slack_search_public_and_private'].sort());
	assert.equal(val(a, '--tools'), '');
	assert.ok(a.includes('--no-session-persistence'));
	assert.ok(lista(a, '--disallowedTools').includes('mcp__claude_ai_Gmail__create_draft'));
});
