import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearVoz, aseguraModelo, limpiaTranscripcion, WHISPER } from '../server/voz.mjs';

const hayFfmpeg = fs.existsSync(WHISPER.ffmpeg);
const carpeta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'voz-'));
const prohibido = async () => { throw new Error('El audio no sale del Mac'); };

/** Un whisper-cli falso: apunta con qué le llaman y qué fichero recibe, y dice lo que se le pida. */
function whisperFalso(dir, salida = ' Hola, soy Alex.\n Llámame luego.\n') {
	const bin = path.join(dir, 'whisper-cli'), registro = path.join(dir, 'llamada.json');
	fs.writeFileSync(bin, `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
const f = a[a.indexOf('-f') + 1];
fs.writeFileSync(${JSON.stringify(registro)}, JSON.stringify({ args: a, cabecera: fs.readFileSync(f).subarray(0, 44).toString('latin1'), tam: fs.statSync(f).size }));
process.stdout.write(${JSON.stringify(salida)});
`, { mode: 0o755 });
	return { bin, registro };
}
function opciones(dir, w, extra = {}) {
	const modelo = path.join(dir, 'modelo.bin');
	fs.writeFileSync(modelo, 'x');
	return { dirDatos: dir, clave: null, hazFetch: prohibido, whisper: { ...WHISPER, bin: w.bin, modelo, ...extra } };
}
/** Una grabación como las del iPhone: AAC en mp4 fragmentado, que es lo que da MediaRecorder en Safari. */
function grabacionIphone(dir) {
	const f = path.join(dir, 'nota.m4a');
	execFileSync(WHISPER.ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2:sample_rate=48000', '-c:a', 'aac', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', f]);
	return f;
}

test('quita lo que no es voz y junta las líneas', () => {
	assert.equal(limpiaTranscripcion(' Hola.\n  Qué tal.\n'), 'Hola. Qué tal.');
	assert.equal(limpiaTranscripcion('[BLANK_AUDIO]\n'), '');
	assert.equal(limpiaTranscripcion(' (música)\n [ Silencio ]\n'), '');
	assert.equal(limpiaTranscripcion('Dijo (bajito) que sí'), 'Dijo (bajito) que sí');
});

test('el mp4 del iPhone se convierte a wav de 16 kHz y va a Whisper en español, sin usar la red ni la clave', { skip: !hayFfmpeg && 'sin ffmpeg' }, async () => {
	const dir = carpeta();
	const w = whisperFalso(dir);
	const audio = grabacionIphone(dir);
	const antes = fs.readFileSync(audio);
	const v = crearVoz(opciones(dir, w));
	assert.equal(await v.transcribe(audio), 'Hola, soy Alex. Llámame luego.');
	const { args, cabecera, tam } = JSON.parse(fs.readFileSync(w.registro, 'utf8'));
	assert.equal(args[args.indexOf('-l') + 1], 'es');
	assert.ok(args.includes('-nt'));
	assert.equal(args[args.indexOf('-m') + 1], path.join(dir, 'modelo.bin'));
	assert.equal(cabecera.slice(0, 4), 'RIFF');
	assert.equal(Buffer.from(cabecera, 'latin1').readUInt32LE(24), 16_000, '16 kHz');
	assert.equal(Buffer.from(cabecera, 'latin1').readUInt16LE(22), 1, 'mono');
	assert.ok(tam > 60_000, '2 s de audio');
	assert.deepEqual(fs.readFileSync(audio), antes, 'el audio original no se toca');
	const wav = JSON.parse(fs.readFileSync(w.registro, 'utf8')).args.at(-1);
	assert.equal(fs.existsSync(wav), false, 'el wav temporal se borra');
});

test('si el audio no se puede leer, falla con un motivo y sin dejar nada', { skip: !hayFfmpeg && 'sin ffmpeg' }, async () => {
	const dir = carpeta();
	const malo = path.join(dir, 'malo.m4a');
	fs.writeFileSync(malo, 'esto no es audio');
	await assert.rejects(crearVoz(opciones(dir, whisperFalso(dir))).transcribe(malo), /ffmpeg ha fallado/);
});

test('sin whisper-cli o ffmpeg lo dice claro', async () => {
	const dir = carpeta();
	await assert.rejects(crearVoz(opciones(dir, { bin: '/no/hay/whisper-cli' }, { ffmpeg: '/no/hay/ffmpeg' })).transcribe(path.join(dir, 'x.m4a')), /No encuentro ffmpeg/);
});

const modeloFalso = (tam = 2000) => { const b = Buffer.alloc(tam); b.write('lmgg', 'latin1'); return b; };
const respuesta = (b, cabeceras = {}) => new Response(b, { status: 200, headers: { 'content-length': String(b.length), ...cabeceras } });

test('el modelo se baja una vez, sin la clave de ElevenLabs, y se queda en su sitio', async () => {
	const dir = carpeta();
	const ruta = path.join(dir, 'modelos', 'm.bin');
	const llamadas = [];
	const hazFetch = async (u, o) => { llamadas.push([u, o]); await new Promise(r => setTimeout(r, 5)); return respuesta(modeloFalso()); };
	const w = whisperFalso(dir);
	const v = crearVoz({ dirDatos: dir, clave: 'secreta', hazFetch, whisper: { ...WHISPER, bin: w.bin, modelo: ruta, urlModelo: 'https://huggingface.co/m', minimoModelo: 1000 } });
	assert.deepEqual(await Promise.all([v.preparaModelo(), v.preparaModelo()]), [ruta, ruta]);
	await v.preparaModelo();
	assert.equal(llamadas.length, 1, 'dos notas a la vez no lo bajan dos veces');
	assert.equal(llamadas[0][1], undefined, 'no lleva cabeceras: ni la clave');
	assert.equal(fs.statSync(ruta).size, 2000);
	assert.deepEqual(fs.readdirSync(path.dirname(ruta)), ['m.bin'], 'sin restos');
});

test('lo que no sea un modelo entero no se queda: ni una página de error, ni uno cortado', async () => {
	const dir = carpeta();
	const ruta = path.join(dir, 'm.bin');
	const opc = hazFetch => ({ ruta, url: 'https://huggingface.co/m', minimo: 1000, hazFetch });
	await assert.rejects(aseguraModelo(opc(async () => respuesta(Buffer.alloc(5000, 'x')))), /ha llegado mal/);
	await assert.rejects(aseguraModelo(opc(async () => respuesta(modeloFalso(500)))), /ha llegado mal/);
	await assert.rejects(aseguraModelo(opc(async () => new Response('no', { status: 503 }))), /503/);
	assert.deepEqual(fs.readdirSync(dir), [], 'nada a medias');
});
