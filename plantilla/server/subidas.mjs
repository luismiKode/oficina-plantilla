// Subir a GitHub lo que haga falta. Lo vigila la oficina (Nico), lo aprueba Alex en una tarjeta y lo hace el servicio, sin modelo de por medio.
// Nunca a la fuerza, solo hasta el commit que se ha enseñado y solo a un remoto que ya existe.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { DEPARTAMENTOS } from './departamentos.mjs';

const git = (cwd, ...a) => new Promise((res, rej) => execFile('git', a, { cwd, timeout: 120_000, maxBuffer: 80 * 1024 * 1024 }, (e, salida, err) => (e ? rej(Object.assign(e, { err: String(err) })) : res(String(salida).trim()))));
const CADA = 6 * 3_600_000;
// Lo que no debería salir nunca a un remoto.
const RE_CLAVE = /re_[A-Za-z0-9]{20,}|sk-an[t]-[A-Za-z0-9-]{10,}|acme_pat_[A-Za-z0-9]{8,}|AIza[0-9A-Za-z_-]{30,}|xox[bp]-[0-9A-Za-z-]{10,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

/** Qué hay sin subir en un repo. Null si no tiene remoto, si está al día o no se puede saber. */
export async function sinSubir(carpeta) {
	try {
		const rama = await git(carpeta, 'symbolic-ref', '--short', 'HEAD');
		const arriba = await git(carpeta, 'rev-parse', '--abbrev-ref', '@{u}');
		const n = Number(await git(carpeta, 'rev-list', '--count', '@{u}..HEAD'));
		if (!n) return null;
		const sha = await git(carpeta, 'rev-parse', 'HEAD');
		const remoto = await git(carpeta, 'remote', 'get-url', arriba.split('/')[0]);
		const commits = (await git(carpeta, 'log', '@{u}..HEAD', '--format=%h %s', '-n', '20')).split('\n');
		const archivos = await git(carpeta, 'diff', '--shortstat', '@{u}', 'HEAD').catch(() => '');
		// Se revisa el contenido antes de enseñarlo. Si no se puede revisar, también se dice.
		let revisado = true, clave = false;
		try { clave = RE_CLAVE.test(await git(carpeta, 'diff', '--no-ext-diff', '@{u}', 'HEAD')); } catch { revisado = false; }
		return { rama, arriba, remoto: remoto.replace(/^https:\/\/[^@/]*@/, 'https://'), n, sha, commits, archivos, clave, revisado };
	} catch { return null; }
}

export function crearSubidas({ db, bus, tareas, repos = null, log = () => {} }) {
	const lista = () => repos ?? [
		...DEPARTAMENTOS.filter(d => !d.general).map(d => ({ id: d.id, nombre: d.nombre, carpeta: d.carpeta })),
		
	];
	const enCurso = new Set();
	const yo = {
		/** Una tarjeta por repo con algo sin subir. Si la descartó, no vuelve hasta que haya commits nuevos. */
		async revisa() {
			for (const r of lista()) {
				const e = await sinSubir(r.carpeta);
				const abierta = db.q(`SELECT id, datos FROM tareas WHERE tipo = 'subida' AND estado != 'hecha' AND borrada = 0`).find(t => JSON.parse(t.datos).repo === r.id);
				if (!e) { if (abierta) tareas.accion(abierta.id, { accion: 'hecha' }); continue; }
				if (db.ajuste(`subida_descartada:${r.id}`) === e.sha) continue;
				const titulo = `Subir ${e.n} ${e.n === 1 ? 'commit' : 'commits'} de ${r.nombre}`;
				const datos = { repo: r.id, nombre: r.nombre, ...e };
				if (abierta) { db.run(`UPDATE tareas SET titulo = ?, datos = ?, actualizado = datetime('now') WHERE id = ?`, titulo, JSON.stringify(datos), abierta.id); bus?.emit('evento', { tipo: 'tarea', id: abierta.id }); continue; }
				tareas.crea({ equipo: 'alex', tipo: 'subida', titulo, prioridad: 'normal', origen: 'equipo', responsable: 'general:infra', datos });
			}
		},
		async decide(id, { accion }) {
			const t = tareas.obtiene(id);
			if (!t || t.tipo !== 'subida') throw new Error('Eso no existe');
			if (t.estado === 'hecha') throw new Error('Ya está decidido');
			const d = JSON.parse(t.datos);
			if (accion === 'descartar') {
				db.ajuste(`subida_descartada:${d.repo}`, d.sha);
				tareas.accion(id, { accion: 'hecha' });
				return;
			}
			if (accion !== 'aprobar') throw new Error('Acción desconocida');
			if (enCurso.has(id)) throw new Error('Ya se está subiendo');
			if (d.clave) throw new Error('Parece llevar una clave: esto no se sube. Hay que sacarla antes');
			// El destino sale de la lista, nunca de lo que diga la tarjeta.
			const r = lista().find(x => x.id === d.repo);
			if (!r) throw new Error('Ese repo no está en la lista');
			enCurso.add(id);
			try {
				const ahora = await sinSubir(r.carpeta);
				if (!ahora) { db.run(`UPDATE tareas SET resultado = ?, estado = 'hecha', actualizado = datetime('now') WHERE id = ?`, 'Ya estaba subido', id); bus?.emit('evento', { tipo: 'tarea', id }); return; }
				if (ahora.clave) throw new Error('Parece llevar una clave: esto no se sube');
				// Solo hasta el commit que ha visto. Lo que haya entrado después va en otra tarjeta.
				if (!/^[0-9a-f]{40}$/.test(d.sha) || !/^[\w./-]+$/.test(ahora.rama)) throw new Error('Datos raros en la tarjeta');
				const origen = ahora.arriba.split('/')[0];
				await git(r.carpeta, 'merge-base', '--is-ancestor', d.sha, 'HEAD').catch(() => { throw new Error('Ese commit ya no está en la rama'); });
				try { await git(r.carpeta, 'push', origen, `${d.sha}:refs/heads/${ahora.rama}`); }
				catch (e) { throw new Error(`No se ha subido: ${String(e.err || e.message).split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 240)}`); }
				db.run(`UPDATE tareas SET resultado = ?, estado = 'hecha', actualizado = datetime('now') WHERE id = ?`, `Subido a ${ahora.remoto}`, id);
				db.apunta('subida', `${d.repo} ${d.sha.slice(0, 7)} a ${ahora.remoto}`);
				bus?.emit('evento', { tipo: 'tarea', id });
			} finally { enCurso.delete(id); }
		},
		arranca() {
			if (CONFIG.SIMULACION) return { parar() {} };
			const mira = () => yo.revisa().catch(e => log('subidas:', e.message));
			mira();
			const t = setInterval(mira, CADA);
			t.unref?.();
			return { parar: () => clearInterval(t) };
		},
	};
	return yo;
}
