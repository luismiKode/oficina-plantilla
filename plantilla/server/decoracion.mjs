// Cada departamento decide cómo es su planta: se reúnen, proponen y su dirección lo cierra.
// Eligen de un catálogo, y la escena dibuja lo que elijan. Los KPI salen de sus datos: lo que no sepan, no se inventa.
import { resuelveHilo, hiloDe, EQUIPO } from './equipo.mjs';
import { POR_ID } from './departamentos.mjs';

export const PARED = {
	vino: ['#7f3333', '#6b2a2a'], burdeos: ['#5c1f3a', '#4a1830'], rosa: ['#a84d6f', '#8f3f5d'], naranja: ['#c9702e', '#ad5f24'], mostaza: ['#c98a2e', '#ad7524'],
	verde: ['#3f7f5f', '#346b4f'], oliva: ['#6b7a3a', '#5a682f'], turquesa: ['#2f7f8f', '#276b79'], azul: ['#35558f', '#2c4779'], noche: ['#3b2f4a', '#2e2439'],
	grafito: ['#3f444d', '#343840'], crema: ['#c9bda0', '#b5a98c'],
};
export const SUELO = {
	madera: ['#c9a67e', '#bd9a72'], roble: ['#8f6a42', '#835f39'], nogal: ['#6b4a32', '#5f412c'], baldosa: ['#d8d0c0', '#cbc3b3'], industrial: ['#8c8f94', '#7f8287'],
	moqueta: ['#5a6478', '#505a6c'], verde: ['#6f8f6a', '#63825f'], terracota: ['#b5714a', '#a86640'],
};
export const PARED_OBJETOS = ['cuadro', 'tele', 'pizarra', 'neon', 'reloj', 'bandera', 'mapa', 'diana', 'estanteria', 'ventana'];
export const SUELO_OBJETOS = ['gato', 'perro', 'planta', 'arbol', 'altavoz', 'cafetera', 'trofeo', 'alfombra', 'lampara', 'sofa', 'futbolin', 'acuario', 'arcade', 'bicicleta', 'cajas'];

export const ESQUEMA_DECORACION = {
	type: 'object', required: ['pared', 'suelo', 'pared_objetos', 'suelo_objetos', 'kpis', 'resumen'], additionalProperties: false,
	properties: {
		pared: { type: 'string', enum: Object.keys(PARED) },
		suelo: { type: 'string', enum: Object.keys(SUELO) },
		lema: { type: 'string', description: 'Para el neón, si pones uno. Tres palabras como mucho' },
		pared_objetos: { type: 'array', items: { type: 'string', enum: PARED_OBJETOS } },
		suelo_objetos: { type: 'array', items: { type: 'string', enum: SUELO_OBJETOS } },
		kpis: { type: 'array', items: {
			type: 'object', required: ['etiqueta', 'valor', 'fuente'], additionalProperties: false,
			properties: { etiqueta: { type: 'string' }, valor: { type: 'string' }, fuente: { type: 'string' } },
		} },
		resumen: { type: 'string', description: 'Una frase, como la dirías en el pasillo, de qué habéis decidido' },
	},
};

/** Lo que devuelve el modelo, con los pies en el suelo: del catálogo, con topes y sin cifras sin fuente. */
export function normaliza(d, { paredesOcupadas = [] } = {}) {
	if (!d || typeof d !== 'object') throw new Error('La decoración no trae el formato esperado');
	const libre = Object.keys(PARED).find(k => !paredesOcupadas.includes(k) && k !== 'grafito') ?? 'crema';
	const delCatalogo = (lista, cat, tope) => [...new Set(Array.isArray(lista) ? lista : [])].filter(x => cat.includes(x)).slice(0, tope);
	const corto = (t, n) => String(t ?? '').replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
	return {
		pared: Object.hasOwn(PARED, d.pared) && !paredesOcupadas.includes(d.pared) ? d.pared : libre,
		suelo: Object.hasOwn(SUELO, d.suelo) ? d.suelo : 'madera',
		lema: corto(d.lema, 22),
		pared_objetos: delCatalogo(d.pared_objetos, PARED_OBJETOS, 3),
		suelo_objetos: delCatalogo(d.suelo_objetos, SUELO_OBJETOS, 5),
		kpis: (Array.isArray(d.kpis) ? d.kpis : [])
			.map(k => ({ etiqueta: corto(k?.etiqueta, 16), valor: corto(k?.valor, 11), fuente: corto(k?.fuente, 80) }))
			.filter(k => k.etiqueta && k.valor && k.fuente)
			.slice(0, 3),
		resumen: corto(d.resumen, 200),
	};
}

export const leeDecoracion = (db, dep) => { const t = db.ajuste(`decoracion:${dep}`); return t ? JSON.parse(t) : null; };

const CATALOGO = `Pared: ${PARED_OBJETOS.join(', ')}. Suelo: ${SUELO_OBJETOS.join(', ')}. Color de pared: ${Object.keys(PARED).join(', ')}. Suelo: ${Object.keys(SUELO).join(', ')}.`;

/** Quiénes suben: su dirección y hasta tres más. */
export function asistentesDe(dep) {
	return EQUIPO[dep].filter(p => p.rol && !p.interna).slice(0, 3).map(p => hiloDe(dep, p.rol));
}

/** El paso de la reunión. Recibe las manos de reuniones.mjs. */
export function crearDecorador({ db, bus }) {
	return async function decora(r, { habla, interno, hilos }) {
		const h = resuelveHilo(r.convoca);
		const dep = h.dep;
		const nombre = POR_ID[dep].nombre;
		// Cada planta distinta: lo que ya tienen las demás no se repite.
		const otras = Object.keys(POR_ID).filter(x => x !== dep).map(x => ({ dep: POR_ID[x].nombre, d: leeDecoracion(db, x) })).filter(x => x.d);
		const paredesOcupadas = otras.map(x => x.d.pared);
		const yaHay = otras.length ? `Así han dejado las suyas: ${otras.map(x => `${x.dep}, ${x.d.pared} con ${[...x.d.pared_objetos, ...x.d.suelo_objetos].join(', ')}`).join('; ')}. Vosotros, otra cosa.` : '';
		const ya = new Set(db.q(`SELECT de_hilo FROM interno WHERE reunion_id = ? AND tipo = 'mesa'`, r.id).map(x => x.de_hilo));
		for (const q of hilos(r)) {
			if (ya.has(q) || q === r.convoca) continue;
			const dicho = db.q(`SELECT de_hilo, texto FROM interno WHERE reunion_id = ? AND tipo = 'mesa' ORDER BY id`, r.id).map(x => `${resuelveHilo(x.de_hilo)?.persona.nombre}: ${x.texto}`).join('\n');
			const res = await habla(q, `Es un rato de descanso: vais a decidir cómo es vuestra planta de la oficina, la de ${nombre}. Es vuestra casa, aquí pasáis el día, y tiene que notarse quién vive aquí. Nada de sobriedad corporativa ni de «aquí se trabaja». Se puede poner: ${CATALOGO}\nY un panel en la pared con hasta tres números que queráis ver siempre.\n${yaHay}\n${dicho ? `Lo que han dicho:\n${dicho}\n` : ''}\nPide un capricho tuyo, lo que te apetecería de verdad por cómo eres (el gato, el futbolín, la tele con el partido...), y discute con los demás si no te gusta lo suyo. Como en una reunión de verdad y con tu carácter, con gracia. Una o dos frases.`);
			interno(r, q, 'mesa', res.texto.slice(0, 600), 1);
		}
		const dicho = db.q(`SELECT de_hilo, texto FROM interno WHERE reunion_id = ? AND tipo = 'mesa' ORDER BY id`, r.id).map(x => `${resuelveHilo(x.de_hilo)?.persona.nombre}: ${x.texto}`).join('\n');
		const final = await habla(r.convoca, `Cierras la reunión de cómo va a ser la planta de ${nombre}.\nLo que ha dicho tu equipo:\n${dicho || '(estás tú solo)'}\n\nDecide haciendo caso a los caprichos de tu gente: tiene que tener personalidad y notarse quién vive aquí. Al menos tres cosas en el suelo, y al menos una que no sirva para trabajar. Color de pared alegre o con carácter; grafito no.${paredesOcupadas.length ? ` Esos colores ya los tienen otros: ${paredesOcupadas.join(', ')}.` : ''} ${yaHay}\nSe puede poner: ${CATALOGO}\nKPI: hasta tres números reales de tu área, de tus papeles (ESTADO.md). etiqueta muy corta, 14 letras como mucho, por ejemplo «Caja». valor muy corto, 10 letras como mucho, por ejemplo «96.400 €». fuente: de dónde sale. Si un número no lo tienes, no lo pongas: no inventes ninguno.\nlema: si pones neón, algo con gracia. resumen: una frase con gracia, como la contarías en el pasillo.`, { esquema: ESQUEMA_DECORACION });
		const d = normaliza(final.estructurado ?? JSON.parse(final.texto), { paredesOcupadas });
		db.ajuste(`decoracion:${dep}`, JSON.stringify(d));
		interno(r, r.convoca, 'redaccion', d.resumen || 'Decidido.');
		bus?.emit('evento', { tipo: 'decoracion', dep });
		return d;
	};
}
