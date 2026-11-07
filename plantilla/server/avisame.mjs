// Un departamento le escribe a Alex por correo, muy de vez en cuando, por Resend.
// Solo a él: el destinatario está en el código y el modelo no lo elige. Sale del servicio, sin herramienta que el modelo pueda usar.
import fs from 'node:fs';
import { CONFIG } from './config.mjs';

export const TOPE_DIA = 5;
export const TOPE_DINERO = 10;
export const TOPE_TRABAJO = 30;
const RE_PRIVADO = /privado/i;
const hoy = () => new Date().toISOString().slice(0, 10);

function leeClave(ruta = CONFIG.RUTA_CLAVE_RESEND) {
	try { return fs.readFileSync(ruta, 'utf8').match(/^\s*RESEND_API_KEY\s*=\s*["']?([^"'\s]+)/m)?.[1] ?? null; } catch { return null; }
}

/** Nunca lleva enlaces, ni dominios sueltos: nadie puede ponerle un enlace delante en nombre de la oficina. */
export function limpiaAviso(texto) {
	return String(texto ?? '').replace(/\[\[|\]\]/g, ' ').trim().slice(0, 1500)
		.replace(/\S*(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|www\.)\S*/gi, '[enlace, en el original]')
		.replace(/\S*[\p{L}\p{N}-](?:\.|\[\.\]|\(\.\))[a-z]{2,}\S*/giu, '[enlace, en el original]');
}

export function crearAvisoCorreo({ db, clave = CONFIG.SIMULACION ? null : leeClave(), hazFetch = fetch, para = CONFIG.USUARIO, de = CONFIG.RESEND_DE, log = () => {} }) {
	return {
		/** Sin Resend, sale desde su propia cuenta de Gmail, a sí mismo. */
		respaldo: null,
		/** @returns {Promise<boolean>} si ha salido */
		async manda({ desde, quien, asunto, texto, dinero = false, trabajo = false }) {
			if (RE_PRIVADO.test(`${asunto} ${texto}`)) { db.apunta('aviso_correo', `Privado fuera: ${desde}`); return false; }
			// Las alertas de dinero tienen su cupo: el ruido del día no puede taparlas.
			const claveDia = `aviso_correo${dinero ? '_dinero' : trabajo ? '_trabajo' : ''}:${hoy()}`, claveHilo = `aviso_correo:${hoy()}:${desde}`;
			const n = Number(db.ajuste(claveDia) || 0);
			if (n >= (dinero ? TOPE_DINERO : trabajo ? TOPE_TRABAJO : TOPE_DIA)) { db.apunta('tope', `aviso por correo de ${desde}`); return false; }
			if (!dinero && !trabajo && db.ajuste(claveHilo)) { db.apunta('tope', `segundo aviso por correo de ${desde}`); return false; }
			const cuerpo = limpiaAviso(texto);
			const tema = limpiaAviso(asunto).replace(/\s+/g, ' ').slice(0, 120);
			if (!cuerpo || !tema) return false;
			const asuntoFinal = `[Oficina] ${quien}: ${tema}`, textoFinal = `${cuerpo}\n\n${quien}, desde la Oficina.`;
			if (!clave && this.respaldo && !CONFIG.SIMULACION) {
				db.ajuste(claveDia, n + 1);
				if (!dinero && !trabajo) db.ajuste(claveHilo, '1');
				try { await this.respaldo({ asunto: asuntoFinal, texto: textoFinal }); db.apunta('aviso_correo', `${desde}: ${tema}`); return true; }
				catch (e) { log('aviso por Gmail:', e.message); db.apunta('error', `aviso por Gmail: ${e.message}`); return false; }
			}
			if (!clave) { db.apunta('aviso_correo', `Sin enviar (${CONFIG.SIMULACION ? 'simulación' : 'sin clave'}): ${desde}: ${tema}`); return false; }
			db.ajuste(claveDia, n + 1);
			if (!dinero && !trabajo) db.ajuste(claveHilo, '1');
			try {
				const r = await hazFetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
					body: JSON.stringify({ from: de, to: [para], subject: asuntoFinal, text: textoFinal }),
				});
				if (!r.ok) throw new Error(`Resend ${r.status}`);
				db.apunta('aviso_correo', `${desde}: ${tema}`);
				return true;
			} catch (e) { log('aviso por correo:', e.message); db.apunta('error', `aviso por correo: ${e.message}`); return false; }
		},
	};
}
