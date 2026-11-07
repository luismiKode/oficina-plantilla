#!/usr/bin/env node
// Antes de escribir un archivo: cada uno en su sitio. Si este hook falla, no se escribe.
import fs from 'node:fs';
import { rechazoEscritura } from './escritura.mjs';

let s = '';
process.stdin.on('data', d => { s += d; });
process.stdin.on('end', () => {
	let e;
	try { e = JSON.parse(s); } catch { process.stderr.write('Entrada no válida'); process.exit(2); }
	const motivo = rechazoEscritura(e.tool_input?.file_path ?? e.tool_input?.notebook_path, JSON.parse(process.env.OFICINA_ESCRIBE_EN || '[]'), { mapa: process.env.OFICINA_ESCRIBE_MAPA === '1', real: fs.realpathSync });
	if (motivo) { process.stderr.write(`Escritura rechazada. ${motivo}`); process.exit(2); }
	process.exit(0);
});
