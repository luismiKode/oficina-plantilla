// Las salas de la Oficina. Cada una es una carpeta que ya funciona por sí sola:
// aquí solo se dice dónde está y qué se le deja hacer.
import path from 'node:path';
import { CONFIG } from './config.mjs';

const k = (...p) => path.join(CONFIG.EMPRESA, ...p);

export const DEPARTAMENTOS = [
	{ id: 'produccion', nombre: 'Producción', carpeta: k('Produccion'), borradores: true, de: 'Fábrica, proveedores, pedidos, envíos', correo: 'Proveedores, Logistica, Aduanas, Paquetes, Compras' },
	{ id: 'marketing', nombre: 'Marketing', carpeta: k('Marketing'), borradores: true, de: 'Campañas, piezas, tienda y datos de ventas', correo: 'Marketing, Branding, Comunicación' },
	{ id: 'finanzas', nombre: 'Finanzas', carpeta: k('Finanzas'), borradores: true, de: 'Caja, pagos, bancos, financiación, facturas', correo: 'Facturas, Bancos' },
	{ id: 'fiscal', nombre: 'Fiscal', carpeta: k('Fiscal'), borradores: true, de: 'Impuestos, gestoría, calendario fiscal', correo: 'Asesorias' },
	// Ejemplo de departamento sin borradores en Gmail: sus textos van en el chat, para copiar.
	{ id: 'legal', nombre: 'Legal', carpeta: k('Legal'), borradores: false, de: 'Contratos, societario, Inc, marca, laboral', correo: 'correos de abogados' },
	// Julián, Tere y Bea. Su carpeta es la raíz de Acme, para ver todos los departamentos.
	{ id: 'general', nombre: 'Dirección general', carpeta: CONFIG.EMPRESA, borradores: true, general: true, de: 'Lo que no sabes de quién es, y lo que cruza departamentos', correo: 'Certificaciones y lo que no sea de nadie' },
];

export const POR_ID = Object.fromEntries(DEPARTAMENTOS.map(d => [d.id, d]));
export const IDS = DEPARTAMENTOS.map(d => d.id);
export const esDepartamento = id => Object.hasOwn(POR_ID, id);

/** Un departamento fundado desde la Oficina. Se vuelve a cargar al arrancar. */
export function registraDepartamento({ id, nombre, carpeta, de, correo = '' }) {
	if (esDepartamento(id)) return POR_ID[id];
	const d = { id, nombre, carpeta, borradores: true, de, correo: correo || nombre };
	// Antes de Dirección general, que siempre va la última.
	DEPARTAMENTOS.splice(DEPARTAMENTOS.length - 1, 0, d);
	POR_ID[id] = d;
	IDS.splice(IDS.length - 1, 0, id);
	return d;
}
