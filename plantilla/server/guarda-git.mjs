// Lo poco que la Oficina escribe en la carpeta de un departamento se guarda sola en su repo, para que no quede sin commit.
// Solo ese archivo: nunca toca lo que otro tenga a medias. Nunca sube nada. Si falla, se apunta y no para nada.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { CONFIG } from './config.mjs';

const git = (cwd, ...args) => new Promise((res, rej) => execFile('git', args, { cwd, timeout: 30_000 }, (e, salida) => (e ? rej(e) : res(salida))));

// De uno en uno por repo: dos commits a la vez chocan por el bloqueo de git.
let cola = Promise.resolve();

export function guardaEnGit(ruta, mensaje, log = () => {}) {
	if (CONFIG.SIMULACION) return Promise.resolve(false);
	const cwd = path.dirname(ruta), rel = path.basename(ruta);
	cola = cola.then(async () => {
		await git(cwd, 'add', '--', rel);
		await git(cwd, 'commit', '-q', '-m', mensaje, '--', rel);
		return true;
	}).catch(e => { log('guardar en git:', ruta, e.message.split('\n')[0]); return false; });
	return cola;
}
