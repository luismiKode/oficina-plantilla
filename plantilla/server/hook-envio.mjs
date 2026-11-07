#!/usr/bin/env node
// Hook de Claude Code antes de enviar. Solo deja salir exactamente lo que Alex ha aprobado.
import fs from 'node:fs';
import { rechazoEnvio } from './envio-firma.mjs';

let s = '';
process.stdin.on('data', d => { s += d; });
process.stdin.on('end', () => {
	let entrada;
	try { entrada = JSON.parse(s).tool_input ?? {}; } catch { process.stderr.write('Entrada no válida'); process.exit(2); }
	const motivo = rechazoEnvio(entrada, process.env.OFICINA_ENVIO_FIRMA);
	if (motivo) { process.stderr.write(`Envío rechazado. ${motivo}`); process.exit(2); }
	// Una aprobación, un envío: la marca solo se puede crear una vez.
	try { fs.closeSync(fs.openSync(process.env.OFICINA_ENVIO_MARCA, 'wx')); }
	catch { process.stderr.write('Envío rechazado. Este correo ya se ha intentado enviar.'); process.exit(2); }
	process.exit(0);
});
