// La infra: que las carpetas de Acme sigan el mapa. Solo mira y se lo cuenta a Nico; aquí no se mueve nada.
import fs from 'node:fs';
import path from 'node:path';

/** Lo que no cuadra entre las carpetas y el mapa. */
export function revisaInfra({ acme }) {
	const hallazgos = [];
	const c = path.join(acme, 'CLAUDE.md'), a = path.join(acme, 'AGENTS.md');
	const mapa = fs.existsSync(c) ? fs.readFileSync(c, 'utf8') : '';
	if (!mapa) return ['No encuentro el mapa, CLAUDE.md, en la raíz de Acme.'];
	if (fs.existsSync(a) && fs.readFileSync(a, 'utf8') !== mapa) hallazgos.push('CLAUDE.md y AGENTS.md ya no son iguales.');
	for (const e of fs.readdirSync(acme, { withFileTypes: true })) {
		if (!e.isDirectory() || !/^[1-5]-/.test(e.name)) continue;
		const fila = mapa.split('\n').find(l => l.startsWith(`| \`${e.name}/\``)) ?? '';
		if (!fila) hallazgos.push(`La sección ${e.name} no está en el mapa.`);
		for (const p of fs.readdirSync(path.join(acme, e.name), { withFileTypes: true })) {
			if (p.name.startsWith('.') || p.isSymbolicLink()) continue;
			if (!p.isDirectory()) { hallazgos.push(`Archivo suelto en la sección: ${e.name}/${p.name}.`); continue; }
			if (!mapa.includes(p.name)) hallazgos.push(`${e.name}/${p.name} no está en el mapa.`);
			else if (!fs.existsSync(path.join(acme, e.name, p.name, 'README.md'))) hallazgos.push(`${e.name}/${p.name} no tiene README.md.`);
		}
	}
	return hallazgos;
}

const SEMANA = 7 * 86_400_000;

/** Una vez por semana, si hay algo, se lo cuenta a Nico. Él decide a quién darle qué. */
export function arrancaInfra({ db, salas, acme, log = () => {} }) {
	const mira = () => {
		const ultima = db.ajuste('infra_ultima');
		if (ultima && Date.now() - new Date(ultima).getTime() < SEMANA) return false;
		db.ajuste('infra_ultima', new Date().toISOString());
		let h;
		try { h = revisaInfra({ acme }); } catch (e) { log('infra:', e.message); return false; }
		if (!h.length) return false;
		salas.escribir('general:infra', `La revisión semanal de las carpetas contra el mapa ha encontrado esto:\n${h.slice(0, 30).map(x => `- ${x}`).join('\n')}\nMíralo y dale a cada cosa su dueño. Lo que solo pueda decidir Alex, a Julián.`, { de_sala: 'general:lean' });
		return true;
	};
	const t = setInterval(mira, 6 * 3_600_000);
	t.unref?.();
	mira();
	return { parar: () => clearInterval(t), mira };
}
