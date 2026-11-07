// La mesa de decisiones: lee «Espera a Alex» de cada ESTADO.md. Nunca escribe en ellos.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };

const limpia = t => t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();

/**
 * El plazo de un punto: la primera fecha del texto que aún no ha pasado, como AAAA-MM-DD, o null.
 * Las fechas pasadas suelen ser de cuándo se dijo algo («del 25-oct, ¿siguen abiertas?»), no un plazo.
 */
export function fechaDe(texto, hoy = new Date()) {
	const hoyTxt = hoy.toISOString().slice(0, 10);
	for (const m of texto.matchAll(/\b(\d{1,2})[- ](?:de )?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\b/gi)) {
		const mes = MESES[m[2].toLowerCase()];
		let anio = hoy.getFullYear();
		// Una fecha de hace más de 6 meses es del año que viene
		if ((hoy.getMonth() + 1) - mes > 6) anio++;
		const f = `${anio}-${String(mes).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
		if (f >= hoyTxt) return f;
	}
	return null;
}

/** Saca los puntos de una sección «Espera a Alex» de un ESTADO.md. */
export function puntosDe(md, dep, hoy = new Date()) {
	const lineas = md.split('\n');
	const ini = lineas.findIndex(l => /^##\s+Espera a Alex/i.test(l));
	if (ini < 0) return [];
	const puntos = [];
	for (let i = ini + 1; i < lineas.length; i++) {
		const l = lineas[i];
		if (/^##\s/.test(l)) break;
		const m = l.match(/^(?:[-*]|\d+\.)\s+(.*)/);
		if (m) puntos.push(m[1]);
		else if (l.trim() && puntos.length) puntos[puntos.length - 1] += ' ' + l.trim().replace(/^[-*]\s+/, '');
	}
	return puntos.map(crudo => {
		const texto = limpia(crudo);
		const neg = crudo.match(/^\*\*([^*]+)\*\*/);
		const titulo = neg ? limpia(neg[1]).replace(/[:.]$/, '') : texto.split(/(?<=[.:?])\s/)[0].slice(0, 90);
		const detalle = neg ? limpia(crudo.slice(neg[0].length)).replace(/^[:.]\s*/, '') : texto.slice(titulo.length).trim();
		return {
			id: createHash('sha1').update(`${dep}|${texto}`).digest('hex').slice(0, 14),
			dep, titulo, detalle, texto, fecha: fechaDe(texto, hoy),
		};
	}).filter(p => p.texto);
}

/** Todos los puntos de todos los departamentos. Un ESTADO ausente o raro no rompe nada. */
export function pendientes(departamentos, db, hoy = new Date()) {
	const todos = [];
	for (const d of departamentos) {
		if (d.general) continue;
		try {
			todos.push(...puntosDe(fs.readFileSync(path.join(d.carpeta, 'ESTADO.md'), 'utf8'), d.id, hoy));
		} catch { /* sin ESTADO: sigue con los demás */ }
	}
	return todos.sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'));
}
