#!/usr/bin/env node
// Antes de tocar una campaña aprobada. Solo deja pasar exactamente lo que Alex ha aprobado, y una sola vez.
import fs from 'node:fs';
import { firmaCampana, numeroPeligroso } from './campanas.mjs';

let s = '';
process.stdin.on('data', d => { s += d; });
process.stdin.on('end', () => {
	let e;
	try { e = JSON.parse(s); } catch { process.stderr.write('Entrada no válida'); process.exit(2); }
	if (numeroPeligroso(JSON.stringify(e.tool_input ?? {}))) { process.stderr.write('Campaña rechazada. Un id numérico sin comillas se redondearía.'); process.exit(2); }
	const firma = process.env.OFICINA_CAMPANA_FIRMA;
	if (!firma || firmaCampana(e.tool_name, e.tool_input) !== firma) { process.stderr.write('Campaña rechazada. No coincide con lo que Alex ha aprobado.'); process.exit(2); }
	try { fs.closeSync(fs.openSync(process.env.OFICINA_CAMPANA_MARCA, 'wx')); }
	catch { process.stderr.write('Campaña rechazada. Este cambio ya se ha intentado aplicar.'); process.exit(2); }
	process.exit(0);
});
