// La voz. Narrar va con ElevenLabs, bajo demanda y cacheada, con la misma clave que The Acme Studio.
// Solo voces predeterminadas: las clonadas de la cuenta están prohibidas (regla del Studio).
// Transcribir va con Whisper en este Mac: el audio nunca sale de aquí.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { CONFIG } from './config.mjs';

// Rutas fijas: con launchd el PATH no lleva Homebrew. El modelo se queda en los datos reales: no se pierde con cada obra.
const NOMBRE_MODELO = 'ggml-large-v3-turbo-q5_0.bin';
export const WHISPER = {
	bin: process.env.OFICINA_WHISPER || (process.platform === 'darwin' ? '/opt/homebrew/bin/whisper-cli' : 'whisper-cli'),
	ffmpeg: process.env.OFICINA_FFMPEG || (process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'),
	modelo: process.env.OFICINA_MODELO_WHISPER || path.join(CONFIG.HOME, '.oficina', 'modelos', NOMBRE_MODELO),
	urlModelo: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${NOMBRE_MODELO}`,
	minimoModelo: 400 * 1024 * 1024,
	tiempoFfmpeg: 10 * 60_000,
	tiempoWhisper: 30 * 60_000,
};

const corre = (bin, args, tiempo) => new Promise((res, rej) => execFile(bin, args, { timeout: tiempo, maxBuffer: 20 * 1024 * 1024 }, (e, salida, err) => {
	if (!e) return res(String(salida));
	if (e.code === 'ENOENT') return rej(new Error(`No encuentro ${path.basename(bin)} en este Mac`));
	rej(new Error(`${path.basename(bin)} ha fallado: ${String(err).trim().split('\n').at(-1).slice(0, 160) || e.message.slice(0, 160)}`));
}));

/** Quita lo que no es voz, como «[BLANK_AUDIO]» o «(música)». Si no queda nada, es que no se oye nada. */
export const limpiaTranscripcion = t => String(t).split('\n').map(l => l.trim()).filter(l => l && !/^[[(].*[\])]$/.test(l)).join(' ').replace(/\s+/g, ' ').trim();

/** Baja el modelo si falta. Solo se escribe en su sitio si es un modelo entero: lo comprueba la cabecera ggml y el tamaño. */
export async function aseguraModelo({ ruta, url, minimo, hazFetch = fetch }) {
	if (fs.existsSync(ruta)) return ruta;
	fs.mkdirSync(path.dirname(ruta), { recursive: true, mode: 0o700 });
	const parte = `${ruta}.${process.pid}.parte`;
	try {
		const r = await hazFetch(url);
		if (!r.ok) throw new Error(`No se puede bajar el modelo de Whisper: ${r.status}`);
		await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(parte, { mode: 0o600 }));
		const fd = fs.openSync(parte, 'r');
		const cabecera = Buffer.alloc(4);
		fs.readSync(fd, cabecera, 0, 4, 0);
		fs.closeSync(fd);
		const tam = fs.statSync(parte).size;
		const esperado = r.headers.get('content-encoding') ? 0 : Number(r.headers.get('content-length')) || 0;
		if (cabecera.toString('latin1') !== 'lmgg' || tam < minimo || (esperado && tam !== esperado)) throw new Error('El modelo de Whisper ha llegado mal');
		fs.renameSync(parte, ruta);
		return ruta;
	} finally { fs.rmSync(parte, { force: true }); }
}

const API = 'https://api.elevenlabs.io';
const MODELO = 'eleven_v4';
// Natural: sin exagerar la interpretación.
const AJUSTES = { stability: 0.55, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true, speed: 1.0 };

export function leeClave(ruta = CONFIG.RUTA_CLAVE_ELEVENLABS) {
	if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
	try {
		const m = fs.readFileSync(ruta, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m);
		return m?.[1] ?? null;
	} catch { return null; }
}

/** Voz fija para cada persona: la misma siempre, y el orden no depende de la lista que devuelva la API. */
export function eligeVoz(voces, clave) {
	const ok = voces.filter(v => v.category === 'premade').sort((a, b) => a.voice_id.localeCompare(b.voice_id));
	if (!ok.length) return null;
	const n = parseInt(createHash('sha1').update(clave).digest('hex').slice(0, 8), 16);
	return ok[n % ok.length];
}

export function crearVoz({ dirDatos = CONFIG.DATOS, clave = CONFIG.SIMULACION ? null : leeClave(), hazFetch = fetch, whisper = WHISPER } = {}) {
	let voces = null, bajando = null;
	const pide = async (ruta, op = {}) => {
		const r = await hazFetch(API + ruta, { ...op, headers: { 'xi-api-key': clave, ...(op.headers ?? {}) } });
		if (!r.ok) throw new Error(`ElevenLabs ${r.status}`);
		return r;
	};
	const listaVoces = async () => (voces ??= (await (await pide('/v1/voices')).json()).voices ?? []);
	async function saldo() {
		const j = await (await pide('/v1/user/subscription')).json();
		return (j.character_limit ?? 0) - (j.character_count ?? 0);
	}
	const preparaModelo = () => {
		if (fs.existsSync(whisper.modelo)) return Promise.resolve(whisper.modelo);
		// Sin la clave de ElevenLabs: esta descarga no lleva nada nuestro.
		bajando ??= aseguraModelo({ ruta: whisper.modelo, url: whisper.urlModelo, minimo: whisper.minimoModelo, hazFetch }).finally(() => { bajando = null; });
		return bajando;
	};
	return {
		hay: () => !!clave,
		saldo,
		preparaModelo,
		/** Pasa a texto un audio guardado, en este Mac. El iPhone graba en mp4 y Whisper quiere wav a 16 kHz. */
		async transcribe(ruta) {
			const modelo = await preparaModelo();
			const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oficina-voz-'));
			try {
				const wav = path.join(dir, 'nota.wav');
				await corre(whisper.ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', '-i', ruta, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], whisper.tiempoFfmpeg);
				return limpiaTranscripcion(await corre(whisper.bin, ['-m', modelo, '-l', 'es', '-nt', '-np', '-f', wav], whisper.tiempoWhisper));
			} finally { fs.rmSync(dir, { recursive: true, force: true }); }
		},
		/** Genera (o reutiliza) el audio de un texto. Devuelve la ruta del mp3. */
		async narra({ reunion, texto, quien }) {
			if (!clave) throw new Error('No encuentro la clave de ElevenLabs');
			const dir = path.join(dirDatos, 'reuniones', `R-${reunion}`, 'audio');
			fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
			const hash = createHash('sha1').update(`${quien}|${MODELO}|${texto}`).digest('hex').slice(0, 16);
			const ruta = path.join(dir, `${hash}.mp3`);
			if (fs.existsSync(ruta)) return { ruta, caracteres: 0 };
			if (texto.length > await saldo()) throw new Error('No quedan caracteres de ElevenLabs');
			const voz = eligeVoz(await listaVoces(), quien);
			if (!voz) throw new Error('No hay voces predeterminadas en la cuenta');
			const r = await pide(`/v1/text-to-speech/${voz.voice_id}?output_format=mp3_44100_128`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: texto, model_id: MODELO, voice_settings: AJUSTES }),
			});
			fs.writeFileSync(ruta, Buffer.from(await r.arrayBuffer()), { mode: 0o600 });
			return { ruta, caracteres: texto.length };
		},
	};
}
