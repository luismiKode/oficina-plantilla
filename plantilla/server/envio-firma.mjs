// La huella de un correo aprobado. El servicio la calcula con lo que Alex ha visto y el hook de envío
// la comprueba: si el modelo cambia una coma, un destinatario o el hilo, no sale.
import { createHash } from 'node:crypto';

export function firmaEnvio({ to, subject, body, replyThreadId = null }) {
	return createHash('sha256').update(JSON.stringify([to ?? [], subject ?? '', body ?? '', replyThreadId ?? null])).digest('hex');
}

/** Lo que el hook acepta. Devuelve el motivo de rechazo, o null. */
export function rechazoEnvio(entrada, firma) {
	const permitidos = new Set(['to', 'subject', 'body', 'replyThreadId', 'includeSignature']);
	const sobran = Object.keys(entrada).filter(k => !permitidos.has(k) && entrada[k] && (!Array.isArray(entrada[k]) || entrada[k].length));
	if (sobran.length) return `Solo el texto aprobado: sobra ${sobran.join(', ')}.`;
	if (!firma) return 'Sin un correo aprobado no se envía nada.';
	if (firmaEnvio(entrada) !== firma) return 'No coincide con lo que Alex ha aprobado.';
	return null;
}
