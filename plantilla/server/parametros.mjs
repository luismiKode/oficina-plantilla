// Lo que se puede ajustar de cómo trabaja la Oficina, con sus márgenes.
// Rafa, el de lean, se mueve solo dentro de esto. Permisos, reglamento y topes diarios de Alex no están aquí a propósito.
export const PARAMETROS = {
	MAX_RONDAS: { def: 3, min: 1, max: 3, de: 'Rondas de la mesa en una reunión' },
	MAX_ITERACIONES: { def: 3, min: 1, max: 3, de: 'Vueltas de Bea a una presentación' },
	MAX_ASISTENTES: { def: 6, min: 2, max: 6, de: 'Asistentes a una reunión' },
	TAREAS_POR_REUNION: { def: 4, min: 1, max: 6, de: 'Tareas que salen de una reunión' },
	FILTRO_DIA: { def: 8, min: 3, max: 8, de: 'Peticiones a Alex que revisa Julián al día' },
	BLOQUEOS_DIA: { def: 5, min: 2, max: 8, de: 'Avisos de tarea bloqueada a Julián al día' },
	ENTRADO_N: { def: 15, min: 5, max: 25, de: 'Correos recientes que ve quien trabaja' },
};

let db = null;
/** Se engancha a la base al arrancar. Sin ella, los valores por defecto. */
export function usaBase(d) { db = d; }

export function param(nombre) {
	const p = PARAMETROS[nombre];
	if (!p) throw new Error(`Parámetro desconocido: ${nombre}`);
	const v = db?.ajuste(`param:${nombre}`);
	const n = v == null ? p.def : Number(v);
	return Number.isFinite(n) ? Math.min(p.max, Math.max(p.min, n)) : p.def;
}

export function todos() {
	return Object.entries(PARAMETROS).map(([nombre, p]) => ({ nombre, ...p, valor: param(nombre) }));
}
