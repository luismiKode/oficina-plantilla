// Narración con ElevenLabs, bajo demanda y cacheada. Misma clave que The Acme Studio.
// Solo voces predeterminadas: las clonadas de la cuenta están prohibidas (regla del Studio).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';

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

export function crearVoz({ dirDatos = CONFIG.DATOS, clave = CONFIG.SIMULACION ? null : leeClave(), hazFetch = fetch } = {}) {
	let voces = null;
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
	return {
		hay: () => !!clave,
		saldo,
		/** Pasa un audio a texto con Scribe. Manda el audio a ElevenLabs. */
		async transcribe(bytes, nombre = 'nota.m4a', tipo = 'audio/mp4') {
			if (!clave) throw new Error(CONFIG.SIMULACION ? 'En la simulación la voz no sale del Mac. Escríbelo.' : 'No encuentro la clave de ElevenLabs');
			const fd = new FormData();
			fd.set('model_id', 'scribe_v1');
			fd.set('language_code', 'spa');
			fd.set('file', new File([bytes], nombre, { type: tipo }));
			const r = await pide('/v1/speech-to-text', { method: 'POST', body: fd });
			return String((await r.json()).text ?? '').trim();
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
