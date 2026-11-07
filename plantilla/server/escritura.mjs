// Dónde puede escribir cada uno: en su carpeta, y nunca lo que gobierna cómo funciona la oficina o sus permisos.
import path from 'node:path';

const PROHIBIDO = /(^|\/)(\.claude|\.git|\.ssh|node_modules)(\/|$)|(^|\/)\.env[^/]*$|(^|\/)[^/]*(secret|password|credencial)[^/]*$|\.(pem|p12|key)$/i;
const NORMAS = /(^|\/)(CLAUDE|AGENTS)\.md$/;

/** La ruta de verdad, siguiendo enlaces, aunque el archivo aún no exista: un enlace no sirve para salirse. */
function resuelve(ruta, real) {
	let actual = path.resolve(ruta);
	const resto = [];
	for (;;) {
		try { return path.join(real(actual), ...resto); }
		catch {
			const arriba = path.dirname(actual);
			if (arriba === actual) return path.resolve(ruta);
			resto.unshift(path.basename(actual));
			actual = arriba;
		}
	}
}

/** Devuelve el motivo si no se puede escribir ahí, o null. `mapa`: quien lleva el mapa de Acme puede tocarlo. */
export function rechazoEscritura(archivo, dirs, { mapa = false, real = x => x } = {}) {
	if (!archivo) return 'Sin ruta.';
	const r = resuelve(String(archivo), real);
	const base = dirs.map(d => resuelve(d, real));
	const dentro = base.find(d => r === d || r.startsWith(`${d}${path.sep}`));
	if (!dentro) return `${r} no es tu carpeta.`;
	if (PROHIBIDO.test(path.relative(dentro, r))) return 'Ese archivo no se toca desde la oficina.';
	if (NORMAS.test(r) && !mapa) return 'Las normas de la carpeta no se tocan desde una tarea. Díselo a Nico.';
	return null;
}
