// Una noche de juego en la simulación: sucesos inventados, espaciados. Se niega si la Oficina no está en simulación.
// Uso: node scripts/jugar.mjs [puerto] [minutos entre sucesos]
const PUERTO = process.argv[2] ?? '4647';
const MIN = Number(process.argv[3] ?? 12);
const U = `http://127.0.0.1:${PUERTO}`;
const H = { 'tailscale-user-login': 'tu@correo.com', 'x-oficina': '1' };

const of = await (await fetch(`${U}/api/oficina`, { headers: H })).json();
if (!of.simulacion) { console.error('Esa Oficina no está en simulación. No hago nada.'); process.exit(1); }

const correo = (de, asunto, cuerpo, etiquetas = []) => ({ de, asunto, cuerpo, etiquetas });
const SUCESOS = [
	correo('Lidia <lidia@cliente-grande.example>', 'Pedido de 500 unidades para empresa', 'Hola. Somos una cadena de tiendas y querríamos 500 unidades para enero, con factura y un descuento por volumen. ¿Podéis? ¿Qué plazo y qué precio?', ['Clientes']),
	correo('Reseñas <avisos@tienda.example>', '12 reseñas de una estrella esta semana', 'Varios clientes se quejan de que la batería dura poco y de que nadie contesta en soporte. Adjuntamos el resumen: 12 reseñas de una estrella en siete días.'),
	correo('Bufete Olmo <consultas@bufeteolmo.example>', 'Marca: alguien ha registrado un nombre parecido', 'Hemos visto una solicitud de marca muy parecida a la vuestra en la UE. Hay dos meses para oponerse. Coste aproximado de la oposición: 1.200 €. Decidnos.', ['Asesorias']),
	correo('Agencia Luz <hola@agencialuz.example>', 'Última oferta: nueva cuota', 'Si no aceptáis los 3.500 € al mes pararemos las campañas el día 1. Podemos quedarnos en 2.800 € si firmáis un año más.', ['Marketing']),
	correo('Gestoría Centro <marisa@gestoriacentro.example>', 'Inspección: requerimiento de IVA', 'Ha llegado un requerimiento de Hacienda sobre el IVA de importación del año pasado. Hay diez días hábiles para contestar. Necesito facturas y DUAs.', ['Asesorias']),
	correo('Influencer <collab@creadora.example>', 'Colaboración: 400.000 seguidores', 'Me encantaría probar vuestro producto y sacarlo en un vídeo. Pido 2 unidades y 1.500 €. La semana que viene tengo hueco.'),
	correo('Fábrica Norte <ana@fabricanorte.example>', 'Muestra del nuevo lote: fallo en la pantalla', 'En las primeras 30 unidades del lote, 6 tienen fallo de pantalla. Creemos que es de un proveedor nuestro. Os propongo revisar el lote entero, con una semana más de plazo.', ['Proveedores']),
	correo('Banco Sur <pablo.rey@bancosur.example>', 'Documentación para la póliza', 'Para firmar la renovación necesito las cuentas del año pasado y el balance de situación. Te recuerdo que vence pronto.', ['Bancos']),
	correo('Prensa <redaccion@revistatec.example>', 'Queremos entrevistaros', 'Preparamos un reportaje sobre empresas de hardware en España. ¿Hablamos con alguien esta semana? El cierre es el viernes.', ['Comunicación']),
];

const espera = ms => new Promise(r => setTimeout(r, ms));
for (const s of SUCESOS) {
	try {
		const r = await fetch(`${U}/api/sim/correo`, { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(s) });
		console.log(new Date().toISOString().slice(11, 19), s.asunto, r.status);
	} catch (e) { console.log('sin respuesta:', e.message); }
	await espera(MIN * 60_000);
}
console.log('Fin del juego.');
