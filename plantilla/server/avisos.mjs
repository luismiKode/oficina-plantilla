// Avisos al móvil (Web Push) y salud de la oficina.
import webpush from 'web-push';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';

export function crearAvisos({ db, dirDatos = CONFIG.DATOS, log = () => {} }) {
	const ruta = path.join(dirDatos, 'vapid.json');
	let claves;
	try { claves = JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch {
		claves = webpush.generateVAPIDKeys();
		fs.writeFileSync(ruta, JSON.stringify(claves), { mode: 0o600 });
	}
	webpush.setVapidDetails('https://example.com', claves.publicKey, claves.privateKey);

	return {
		publica: claves.publicKey,
		suscribir(sub) {
			if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint)) throw new Error('Suscripción no válida');
			db.run(`INSERT INTO suscripciones (endpoint, datos) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET datos = excluded.datos`, sub.endpoint, JSON.stringify(sub));
		},
		async avisa(a) {
			for (const s of db.q('SELECT * FROM suscripciones')) {
				try {
					await webpush.sendNotification(JSON.parse(s.datos), JSON.stringify(a), { TTL: 3600 });
				} catch (e) {
					if (e.statusCode === 404 || e.statusCode === 410) db.run('DELETE FROM suscripciones WHERE endpoint = ?', s.endpoint);
					else log('aviso:', e.message);
				}
			}
		},
	};
}

/** Estado de la conexión con Claude. Lo enseña la app; si está caducada, la cola se para. */
export function crearSalud({ bin = CONFIG.CLAUDE_BIN, bus, alRecuperar = () => {}, exec = execFile } = {}) {
	let sesion = 'ok', limite = null, expira = null;
	const cambia = () => bus?.emit('evento', { tipo: 'salud' });
	const yo = {
		ok() { const antes = sesion, habiaLimite = limite; sesion = 'ok'; limite = null; if (antes !== 'ok' || habiaLimite) { cambia(); alRecuperar(); } },
		caducada() { if (sesion !== 'caducada') { sesion = 'caducada'; cambia(); } },
		limite() { limite = new Date().toISOString(); cambia(); },
		estado: () => ({ sesion, limite, expira }),
		comprobar() {
			return new Promise(res => {
				exec(bin, ['auth', 'status'], { env: { ...process.env, ...CONFIG.ENV_CLAUDE }, timeout: 20_000 }, (err, out) => {
					try {
						const j = JSON.parse(out);
						expira = j.loginExpiresAt ?? null;
						if (j.loggedIn === false || (expira && new Date(expira) < new Date())) yo.caducada();
						else yo.ok();
					} catch { /* si el comando falla no se concluye nada */ }
					res(yo.estado());
				});
			});
		},
	};
	return yo;
}
