#!/usr/bin/env node
// Hook de Claude Code antes de crear un borrador. Un borrador es texto plano y visible:
// sin HTML, sin copia oculta y sin adjuntos, que es por donde se podrían sacar datos escondidos.
let s = '';
process.stdin.on('data', d => { s += d; });
process.stdin.on('end', () => {
	let entrada = {};
	try { entrada = JSON.parse(s).tool_input ?? {}; } catch { process.stderr.write('Entrada no válida'); process.exit(2); }
	const prohibidos = ['htmlBody', 'html', 'bcc', 'bccRecipients', 'attachments'].filter(k => entrada[k] && (!Array.isArray(entrada[k]) || entrada[k].length));
	if (prohibidos.length) { process.stderr.write(`Borrador rechazado: solo texto plano y sin copia oculta ni adjuntos (${prohibidos.join(', ')}).`); process.exit(2); }
	process.exit(0);
});
