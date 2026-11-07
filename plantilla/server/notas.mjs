// Notas de voz: el mensaje ya existe con su audio y aquí se transcribe por detrás, de uno en uno.
// Al acabar, el texto va directo a la persona: Alex no revisa transcripciones.
// Quién lo dice y de dónde viene se fijaron en el POST. Aquí solo se pone el texto; nunca se toca la procedencia.
const ESPERAS = [5_000, 30_000];
const duerme = ms => new Promise(r => setTimeout(r, ms));

export function crearNotas({ db, bus, voz, salas, esperas = ESPERAS, log = () => {} }) {
	const cola = [];
	let enMarcha = false;
	const avisa = (id, sala) => bus?.emit('evento', { tipo: 'mensaje', hilo: sala, id });

	function falla(m, motivo) {
		db.run(`UPDATE mensajes SET estado = 'sin_transcribir', voz_error = ? WHERE id = ? AND estado = 'transcribiendo'`, String(motivo).slice(0, 200), m.id);
		db.apunta('voz', `${m.sala} #${m.id}: ${motivo}`);
		avisa(m.id, m.sala);
		// Lo que escribió después ya no tiene que esperarla.
		salas.siguiente();
	}

	/** Reintenta solo. El aviso y el botón aparecen únicamente si se agotan los intentos. */
	async function transcribe(m) {
		for (let i = 0; ; i++) {
			try {
				const texto = await voz.transcribe(JSON.parse(m.audio).ruta);
				// Sin voz no hay nada que repetir: saldría igual.
				if (!texto) return falla(m, 'No se oye nada en ese audio');
				return void salas.entregaNota(m.id, texto.slice(0, 100_000));
			} catch (e) {
				log('nota de voz:', e.message);
				if (i >= esperas.length) return falla(m, e.message);
				await duerme(esperas[i]);
			}
		}
	}

	async function sigue() {
		if (enMarcha) return;
		enMarcha = true;
		try {
			while (cola.length) {
				const m = db.uno(`SELECT id, sala, audio FROM mensajes WHERE id = ? AND estado = 'transcribiendo'`, cola[0]);
				if (m) await transcribe(m);
				cola.shift();
			}
		} finally { enMarcha = false; }
	}

	const encola = id => { if (!cola.includes(id)) cola.push(id); sigue().catch(e => log('nota de voz:', e.message)); };

	return {
		encola,
		/** El botón de reintentar: solo para una nota de esa sala que ya agotó sus intentos. */
		reintenta(id, sala) {
			const { cambios } = db.run(`UPDATE mensajes SET estado = 'transcribiendo', voz_error = NULL WHERE id = ? AND sala = ? AND estado = 'sin_transcribir' AND audio IS NOT NULL`, id, sala);
			if (!cambios) return false;
			avisa(id, sala);
			encola(id);
			return true;
		},
		/** Lo que se quedó a medias en un reinicio sigue: el audio está guardado. */
		arranca() { for (const m of db.q(`SELECT id FROM mensajes WHERE estado = 'transcribiendo' ORDER BY id`)) encola(m.id); },
		ocupado: () => cola.length > 0,
	};
}
