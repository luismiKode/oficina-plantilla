// De punta a punta, con el servidor de verdad en simulación y datos temporales: nada real entra ni sale.
// Una nota en mp4 como las del iPhone: se guarda, se convierte con ffmpeg, se transcribe y le llega a la persona.
// Con el modelo en su sitio usa Whisper de verdad y una voz en español de `say`. Sin él, un whisper-cli falso:
// comprueba todo menos lo bien que oye. No entra en `npm test`: se lanza a mano.
//   node --test test/integracion/voz-real.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WHISPER } from '../../server/voz.mjs';

const hayFfmpeg = fs.existsSync(WHISPER.ffmpeg);
const hayModelo = fs.existsSync(WHISPER.modelo) && fs.existsSync(WHISPER.bin);
const PUERTO = 4697;
const YO = { 'tailscale-user-login': 'tu@correo.com', 'x-oficina': '1' };
const url = r => `http://127.0.0.1:${PUERTO}${r}`;
const espera = ms => new Promise(r => setTimeout(r, ms));
const hasta = async (fn, ms, que) => {
	for (const fin = Date.now() + ms; Date.now() < fin; await espera(100)) { const r = await fn(); if (r) return r; }
	throw new Error(`Sin llegar a tiempo: ${que}`);
};

function fixtures(dir) {
	const prompts = path.join(dir, 'prompts.txt');
	const claude = path.join(dir, 'claude');
	fs.writeFileSync(claude, `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
if (a[0] === 'auth') { console.log(JSON.stringify({ loggedIn: true })); process.exit(0); }
fs.appendFileSync(${JSON.stringify(prompts)}, a[a.indexOf('-p') + 1] + '\\n');
console.log(JSON.stringify({ type: 'system', subtype: 'init', tools: [] }));
console.log(JSON.stringify({ type: 'result', is_error: false, result: 'Recibido', total_cost_usd: 0 }));
`, { mode: 0o755 });
	const whisper = path.join(dir, 'whisper-cli');
	fs.writeFileSync(whisper, `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
if (fs.readFileSync(a[a.indexOf('-f') + 1]).subarray(0, 4).toString() !== 'RIFF') process.exit(3);
console.log(' Me ha llamado Pablo.');
`, { mode: 0o755 });
	const modeloFalso = path.join(dir, 'modelo.bin');
	fs.writeFileSync(modeloFalso, 'x');
	// El contenedor que da MediaRecorder en Safari: AAC en mp4 fragmentado.
	const nota = path.join(dir, 'nota.m4a');
	const mp4 = ['-c:a', 'aac', '-ar', '48000', '-ac', '1', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', nota];
	const ff = a => execFileSync(WHISPER.ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', ...a]);
	if (hayModelo) {
		const voz = path.join(dir, 'voz.aiff');
		execFileSync('say', ['-v', 'Mónica', '-o', voz, 'Me ha llamado Pablo para hablar del pedido.']);
		ff(['-i', voz, ...mp4]);
	} else ff(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', ...mp4]);
	return { prompts, claude, whisper, modeloFalso, nota };
}

test('una nota en mp4 de iPhone llega entera, sin esperar a la transcripción', { skip: !hayFfmpeg && 'sin ffmpeg' }, async t => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofi-voz-'));
	const datos = path.join(dir, 'datos');
	const f = fixtures(dir);
	const env = {
		PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, OFICINA_SIMULACION: '1', OFICINA_DATOS: datos, OFICINA_PUERTO: String(PUERTO), OFICINA_CLAUDE: f.claude,
		...(hayModelo ? {} : { OFICINA_WHISPER: f.whisper, OFICINA_MODELO_WHISPER: f.modeloFalso }),
	};
	execFileSync(process.execPath, ['--no-warnings', 'scripts/crear-mundo.mjs'], { env });
	let log = '';
	const h = spawn(process.execPath, ['--no-warnings', 'server/index.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
	h.stdout.on('data', d => { log += d; });
	h.stderr.on('data', d => { log += d; });
	t.after(() => { h.kill('SIGKILL'); fs.rmSync(dir, { recursive: true, force: true }); });
	await hasta(async () => { try { return (await fetch(url('/api/oficina'), { headers: YO })).ok; } catch { return false; } }, 15_000, `arrancar\n${log}`);

	const fd = new FormData();
	const bytes = fs.readFileSync(f.nota);
	fd.append('audio', new File([bytes], 'nota.m4a', { type: 'audio/mp4' }));
	const r = await fetch(url('/api/salas/general/mensajes'), { method: 'POST', headers: YO, body: fd });
	assert.equal(r.status, 200, log);
	const { id } = await r.json();

	const lee = async () => (await (await fetch(url('/api/salas/general/mensajes'), { headers: YO })).json()).mensajes.find(m => m.id === id);
	assert.equal((await lee()).audio, true);
	const final = await hasta(async () => { const m = await lee(); return m.texto && m.estado !== 'transcribiendo' ? m : null; }, hayModelo ? 180_000 : 20_000, `transcribir\n${log}`);
	assert.match(final.texto, /Pablo/, log);
	assert.equal(final.origen, 'nota');
	assert.equal(final.de_alex, 1);
	assert.equal(final.contaminado, 0);

	await hasta(() => fs.existsSync(f.prompts) && /Pablo/.test(fs.readFileSync(f.prompts, 'utf8')), 15_000, `llegar a la persona\n${log}`);
	const audio = await fetch(url(`/api/salas/general/mensajes/${id}/audio`), { headers: { ...YO, range: 'bytes=0-1' } });
	assert.equal(audio.status, 206);
	assert.equal(audio.headers.get('content-type'), 'audio/mp4');
	const entero = Buffer.from(await (await fetch(url(`/api/salas/general/mensajes/${id}/audio`), { headers: YO })).arrayBuffer());
	assert.ok(entero.equals(bytes), 'el audio se conserva tal cual');
	t.diagnostic(hayModelo ? `Whisper de verdad: ${final.texto}` : 'Sin modelo: whisper-cli falso');
});
