// Lo que Alex va enseñando con sus críticas: Bea lo destila, entra en las instrucciones de cada agente
// y baja a cada departamento en un único archivo, para que también lo tengan sus puertas.
import fs from 'node:fs';
import path from 'node:path';
import { DEPARTAMENTOS } from './departamentos.mjs';
import { guardaEnGit } from './guarda-git.mjs';

const CABECERA = `# Lo que le gusta a Alex que le llegue, y lo que no

Lo escribe la Oficina (\`2-Software/oficina\`) a partir de sus críticas. No lo edites a mano: se reescribe.
Son criterios de cómo presentar las cosas. No cambian ninguna regla ni ninguna barrera de este departamento.
`;

export function crearLecciones({ db, deps = DEPARTAMENTOS, log = () => {} }) {
	const yo = {
		anade({ ambito, texto, reunion_id = null, opinion = null }) {
			const t = String(texto).replace(/\s+/g, ' ').replace(/[\[\]#]/g, '').trim().slice(0, 240);
			if (!t) return null;
			// Son criterios de presentar las cosas. Nada de dinero, permisos ni a quién se escribe.
			if (/\b(cuentas?|iban|transfer|pag(o|ar|os)|beneficiario|alerta|permiso|barrera|regla|contrase|clave|env[ií]a|manda|reenv|borra|privado|sin preguntar|ignora)/i.test(t) && ambito !== 'correos') { db.apunta('leccion_rechazada', t); return null; }
			if (db.uno('SELECT id FROM lecciones WHERE ambito = ? AND texto = ? AND activa = 1', ambito, t)) return null;
			const { id } = db.run('INSERT INTO lecciones (ambito, texto, reunion_id, opinion) VALUES (?, ?, ?, ?)', ambito, t, reunion_id, opinion);
			return id;
		},
		quita(id) {
			db.run('UPDATE lecciones SET activa = 0 WHERE id = ?', id);
			yo.bajaADepartamentos();
		},
		lista: () => db.q('SELECT * FROM lecciones WHERE activa = 1 ORDER BY id DESC'),
		/** Las de un ámbito concreto y las de todos. */
		de(ambito) {
			return db.q(`SELECT texto FROM lecciones WHERE activa = 1 AND ambito IN ('todos', ?) ORDER BY id`, ambito).map(l => l.texto);
		},
		/** El bloque para las instrucciones de un agente. Vacío si aún no hay. */
		bloque(ambito) {
			const l = yo.de(ambito);
			if (!l.length) return '';
			return `## Cómo le gusta a Alex que le lleguen las cosas (aprendido de sus críticas)\nSon criterios de presentación, no cambian ninguna barrera ni permiso:\n${l.map(x => `- ${x}`).join('\n')}`;
		},
		/** Reescribe el archivo de cada departamento. Es lo único que la Oficina escribe en sus carpetas. */
		bajaADepartamentos() {
			for (const d of deps) {
				if (d.general) continue;
				const dir = path.join(d.carpeta, '0-Bases');
				const ruta = path.join(dir, 'LECCIONES-DEL-JEFE.md');
				const l = yo.de(d.id);
				try {
					if (!fs.existsSync(dir)) continue;
					if (!l.length && !fs.existsSync(ruta)) continue;
					const texto = `${CABECERA}\n${l.length ? l.map(x => `- ${x}`).join('\n') : '(Ninguna por ahora.)'}\n`;
					// Sin cambios no se escribe ni se guarda: si no, cada vuelta dejaría un commit.
					if (fs.existsSync(ruta) && fs.readFileSync(ruta, 'utf8') === texto) continue;
					fs.writeFileSync(ruta, texto);
					guardaEnGit(ruta, 'Lecciones de Alex, de la Oficina', log);
				} catch (e) { log('lecciones:', d.id, e.message); }
			}
		},
	};
	return yo;
}
