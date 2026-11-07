#!/usr/bin/env node
// Antes de buscar en Gmail: toda búsqueda deja fuera a Privado. Si este hook falla, la búsqueda no se hace.
let s = '';
process.stdin.on('data', d => { s += d; });
process.stdin.on('end', () => {
	let q = '';
	try { q = String(JSON.parse(s).tool_input?.query ?? ''); } catch { process.stderr.write('Entrada no válida'); process.exit(2); }
	if (!/-label:Privado\b/i.test(q) || /\blabel:Privado/i.test(q.replace(/-label:Privado/gi, ''))) {
		process.stderr.write('Búsqueda rechazada: añade -label:Privado a la consulta. Privado no se toca.');
		process.exit(2);
	}
	process.exit(0);
});
