// Fundar un departamento: solo con el sí de Alex. Crea la carpeta según el patrón, lo apunta en el mapa de Acme,
// le da planta en la Oficina y deja lista su puerta. Lo que el patrón pide después (agentes, ordenación) lo acaba su primera sesión.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { IDS, registraDepartamento } from './departamentos.mjs';
import { registraDireccion, todosLosNombres } from './equipo.mjs';

const limpio = (t, n) => String(t ?? '').replace(/[\r\n|`\[\]<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const sinAcentos = t => t.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9]/g, '');

/** Comprueba lo que propone Pilar antes de pedir el sí. Lanza si no vale. */
export function validaFundacion(f, { acme, home = null, existentes = [], nombres = [] }) {
	const d = {
		id: limpio(f.id, 24).toLowerCase(), nombre: limpio(f.nombre, 40), seccion: limpio(f.seccion, 30),
		de: limpio(f.de, 200), noEs: limpio(f.noEs, 200), director: limpio(f.director, 30), caracter: limpio(f.caracter, 160),
	};
	if (!/^[a-z][a-z0-9-]{2,23}$/.test(d.id)) throw new Error('El identificador no vale: minúsculas y sin espacios');
	if (existentes.includes(d.id)) throw new Error(`Ya hay un departamento ${d.id}`);
	if (!d.nombre || !d.de || !d.director) throw new Error('Falta el nombre, de qué se ocupa o quién lo dirige');
	// Este nombre acaba en un script y en un .py: solo letras, números y espacios.
	if (!/^[\p{L}\p{N}][\p{L}\p{N} ]*$/u.test(d.nombre)) throw new Error('El nombre solo puede llevar letras, números y espacios');
	if (nombres.includes(d.director)) throw new Error(`Ya hay alguien que se llama ${d.director}`);
	if (!/^[1-5]-[A-Za-z]+$/.test(d.seccion) || !fs.statSync(path.join(acme, d.seccion), { throwIfNoEntry: false })?.isDirectory()) {
		throw new Error(`La sección ${d.seccion} no existe. No se crean secciones nuevas sin preguntar`);
	}
	d.carpetaNombre = sinAcentos(d.nombre);
	if (!d.carpetaNombre) throw new Error('El nombre no sirve para una carpeta');
	d.ruta = `${d.seccion}/${d.carpetaNombre}`;
	if (fs.existsSync(path.join(acme, d.ruta))) throw new Error(`${d.ruta} ya existe`);
	// Un nombre igual en otra sección pisaría la puerta de otro departamento.
	if (home && (fs.existsSync(path.join(home, 'Library/Application Support', `Claude${d.carpetaNombre}`)) || fs.existsSync(path.join(home, 'Applications', `Claude ${d.carpetaNombre}.app`)))) throw new Error(`Ya hay una puerta que se llama ${d.carpetaNombre}`);
	return d;
}

function esqueleto(d, hoy) {
	const { nombre, carpetaNombre: sin, de, noEs, director } = d;
	return {
		'CLAUDE.md': `# ${nombre}: contexto para la IA\n\nDepartamento de Acme. Cumple \`5-Marca/Marketing/0-Bases/PATRON-DEPARTAMENTO.md\`. Puerta: «${nombre} (Mac de Alex)», se arranca con \`~/Library/Application Support/Claude${sin}/arrancar.sh\`.\n\n## Al llegar\n\nLee este archivo y \`ESTADO.md\` antes de contestar. Preguntas de datos o de estado: las contesta Dirección sola.\n\n## Al acabar\n\nSustituye \`ESTADO.md\` por la foto de ahora.\n\n## El camino de un encargo\n\nDirección reparte, el área lo hace, Control revisa y devuelve lo que falle, y lo decidido queda en \`8-Decisiones/\`.\n\n## Reglas\n\n- Hacia fuera: nada se envía, se publica, se paga ni se firma sin el OK de Alex.\n- Se ocupa de: ${de}.\n- No es de ${nombre}: ${noEs || 'lo de los demás departamentos'}.\n\n## Historia\n\n- ${hoy}: nace el departamento, con el sí de Alex en la Oficina. Lo dirige ${director}.\n`,
		'README.md': `# ${nombre}\n\n${de}.\n\n- \`0-Bases/equipo/\`: quién hay y cómo se trabaja.\n- \`6-Informes/\`: informes fechados.\n- \`8-Decisiones/\`: fichas de lo decidido.\n`,
		'ESTADO.md': `# Estado de ${nombre}\n\nAl día: ${hoy}.\n\n## Ahora mismo\nRecién fundado.\n\n## En curso\nAcabar la fundación: definir los agentes y hacer la ordenación que pide el patrón, y pasar el comprobador.\n\n## Espera a Alex\nNada.\n\n## Fechas\nNinguna.\n\n## Última sesión\nFundación desde la Oficina.\n`,
		'0-Bases/equipo/README.md': `# El equipo de ${nombre}\n\n## Organigrama\n\n| Área | Nombre | Agente | Memoria | Modelo | De qué se ocupa |\n|---|---|---|---|---|---|\n| Dirección | **${director}** | | \`direccion/\` | Opus | Reparte y decide |\n\n## Cuánto delegar\n\nLo mecánico se delega; decidir y revisar, no.\n\n## La carpeta de cada agente\n\n\`CONTEXTO.md\`, \`DECISIONES.md\` y una subcarpeta de trabajo por tema.\n\n## Reglas para no saturar\n\nPocas tareas y claras.\n`,
		'0-Bases/equipo/direccion/CONTEXTO.md': `# Contexto de Dirección\n\nSe ocupa de: ${de}.\n`,
		'0-Bases/equipo/direccion/DECISIONES.md': `# Decisiones de Dirección\n\n- ${hoy}: nace el departamento. Por qué: lo decidió Alex. Quién: Alex.\n`,
		'6-Informes/.gitkeep': '',
		'8-Decisiones/README.md': `# Decisiones\n\nLa ficha se escribe antes de aplicar. Plantilla: fecha, tema, qué, por qué, quién.\n`,
	};
}

/** Añade el departamento al mapa de Acme. El mapa solo se toca si CLAUDE.md y AGENTS.md siguen siendo iguales. */
function apuntaEnMapa(d, acme, hoy) {
	const c = path.join(acme, 'CLAUDE.md'), a = path.join(acme, 'AGENTS.md');
	let t = fs.readFileSync(c, 'utf8');
	if (fs.existsSync(a) && fs.readFileSync(a, 'utf8') !== t) throw new Error('CLAUDE.md y AGENTS.md no son iguales: el mapa no se toca');
	const { nombre, ruta, de, noEs, carpetaNombre: sin } = d;
	const seccion = `### ${nombre} (\`${d.seccion}/${sin}\`)\n\nSi Alex habla de ${de}, la sesión hace de **Dirección del departamento**.\n\n- **Entra así:** lee \`${ruta}/CLAUDE.md\` y después \`${ruta}/ESTADO.md\` antes de contestar.\n- **La puerta buena es «${nombre} (Mac de Alex)»:** se arranca con \`~/Library/Application Support/Claude${sin}/arrancar.sh\`.\n- **Temas:** ${de}.\n- **No es de ${nombre}:** ${noEs || 'lo de los demás departamentos'}.\n\n`;
	if (!t.includes('## Convenciones de nombres')) throw new Error('El mapa no tiene la forma esperada');
	t = t.replace('## Convenciones de nombres', () => `${seccion}## Convenciones de nombres`);
	t = t.split('\n').map(l => (l.startsWith(`| \`${d.seccion}/\``) ? l.replace(/\s*\|\s*$/, () => `, ${sin} (departamento, ver «Departamentos») |`) : l)).join('\n');
	t = `${t.trimEnd()}\n- ${hoy}: nace \`${ruta}\` como departamento, con el sí de Alex desde la Oficina.\n`;
	fs.writeFileSync(c, t);
	fs.writeFileSync(a, t);
}

const ARRANCAR = (nombre, sin, ruta) => `#!/bin/zsh
# Deja este Mac como entorno de Claude Code del departamento ${nombre}. Lo lanza «Claude ${sin}.app».
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
SESION=claude-${sin.toLowerCase()}
LOG="$HOME/Library/Logs/claude-${sin.toLowerCase()}.log"
tmux -L claude-${sin.toLowerCase()} has-session -t $SESION 2>/dev/null && exit 0
tmux -L claude-${sin.toLowerCase()} new-session -d -s $SESION -c "$HOME/Documents/Acme/${ruta}" "zsh -lc '
  while true; do
    echo \\"[\\$(date \\"+%F %T\\")] arrancando remote-control\\" >> \\"$LOG\\"
    caffeinate -s claude remote-control --name \\"${nombre} (Mac de Alex)\\" --spawn same-dir --permission-mode default
    echo \\"[\\$(date \\"+%F %T\\")] remote-control ha salido (\\$?), reinicio en 15 s\\" >> \\"$LOG\\"
    sleep 15
  done'"
`;

/** La puerta: el script y la app. Sin arrancarla ni ponerla en el inicio de sesión, y con permisos normales. */
function creaPuerta(d, { home, acme, exec = execFileSync }) {
	const { nombre, carpetaNombre: sin, ruta, id } = d;
	const dir = path.join(home, 'Library/Application Support', `Claude${sin}`);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, 'arrancar.sh'), ARRANCAR(nombre, sin, ruta), { mode: 0o755 });
	fs.mkdirSync(path.join(home, 'Applications'), { recursive: true });
	exec('osacompile', ['-o', path.join(home, 'Applications', `Claude ${sin}.app`), '-e', `do shell script quoted form of ((POSIX path of (path to home folder)) & "Library/Application Support/Claude${sin}/arrancar.sh")`]);
	const comp = path.join(acme, '5-Marca/Marketing/scripts/comprobar_departamento.py');
	if (fs.existsSync(comp)) {
		const t = fs.readFileSync(comp, 'utf8');
		const nuevo = t.replace(/(DEPTS = \{[\s\S]*?)(\n\})/, (_, a, b) => `${a}\n    "${id}": ("${nombre}", "${ruta}", "${sin}"),${b}`);
		if (nuevo !== t) fs.writeFileSync(comp, nuevo);
	}
}

/** Crea todo. Si algo falla a medias, lanza y dice qué ha quedado. */
export function fundaDepartamento(f, { acme, home, conPuerta = true, conGit = true, hoy = new Date().toISOString().slice(0, 10), exec = execFileSync }) {
	const d = f.ruta ? f : validaFundacion(f, { acme });
	const raiz = path.join(acme, d.ruta);
	if (fs.existsSync(raiz)) throw new Error(`${d.ruta} ya existe`);
	for (const [rel, contenido] of Object.entries(esqueleto(d, hoy))) {
		const destino = path.join(raiz, rel);
		fs.mkdirSync(path.dirname(destino), { recursive: true });
		fs.writeFileSync(destino, contenido);
	}
	apuntaEnMapa(d, acme, hoy);
	if (conGit) {
		exec('git', ['init', '-q'], { cwd: raiz });
		exec('git', ['add', '-A'], { cwd: raiz });
		exec('git', ['commit', '-q', '-m', `Nace ${d.nombre}, con el sí de Alex desde la Oficina`], { cwd: raiz });
	}
	if (conPuerta) creaPuerta(d, { home, acme, exec });
	return { ...d, carpeta: raiz };
}

/** Lo que usa la Oficina: valida, funda, y vuelve a cargar lo fundado al arrancar. */
export function crearFundador({ db, acme, home, conPuerta = true }) {
	const registra = d => {
		registraDepartamento({ id: d.id, nombre: d.nombre, carpeta: path.join(acme, d.ruta), de: d.de });
		registraDireccion({ dep: d.id, nombre: d.director, cargo: `Dirección de ${d.nombre}`, caracter: d.caracter });
	};
	return {
		valida: f => validaFundacion(f, { acme, home: conPuerta ? home : null, existentes: IDS, nombres: todosLosNombres() }),
		funda(propuesta) {
			// Se vuelve a comprobar con el sí: desde que se propuso ha podido cambiar algo.
			const d = validaFundacion(propuesta, { acme, home: conPuerta ? home : null, existentes: IDS, nombres: todosLosNombres() });
			const hecho = fundaDepartamento(d, { acme, home, conPuerta });
			registra(d);
			db.ajuste('fundados', JSON.stringify([...JSON.parse(db.ajuste('fundados') || '[]'), d]));
			db.apunta('fundar', `${d.nombre} en ${d.ruta}`);
			return hecho;
		},
		carga() { for (const d of JSON.parse(db.ajuste('fundados') || '[]')) registra(d); },
	};
}
