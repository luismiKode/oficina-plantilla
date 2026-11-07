// La app entera con teclado físico. Flechas para moverse, Enter para entrar, Esc para salir.
// El iPad con teclado no tiene puntero: se sabe que usas teclas porque pulsas una, y al tocar la pantalla se olvida.
export const estado = { usandoTeclas: false, ultimaMesa: null };

const ORDEN = ['#/', '#/sala/general', '#/charlas', '#/tareas'];
const MODIFICADORES = ['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'];
const CONTROLES = 'a[href], button, input:not([type=file]), textarea';

const escribiendo = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'button'].includes(el.type)) || el.isContentEditable);
const lineaSuelta = el => !!el && el.tagName === 'INPUT' && escribiendo(el);
const pulsable = el => !!el && (el.tagName === 'BUTTON' || el.tagName === 'A');
const visible = el => el.getClientRects().length > 0 && !el.disabled;
// En una caja de varias líneas, las flechas mueven el cursor hasta que se acaba el texto.
const enElBorde = (el, dir) => dir > 0 ? el.selectionEnd >= el.value.length : el.selectionStart <= 0;

/** ¿A dónde se vuelve desde esta ruta? */
export function atras(ruta) {
	const p = ruta.split('/').filter(Boolean);
	if (!p.length) return null;
	if (p[0] === 'reunion') return '#/reuniones';
	if (p[0] === 'tareas' && p[1]) return '#/tareas';
	if (p[0] === 'aprendido') return '#/sala/general%3Arevisora';
	if (p[0] === 'lean') return '#/sala/general%3Alean';
	return '#/';
}

/**
 * ¿Enter envía? No con el teclado de pantalla, donde es un salto de línea.
 * Sale de los datos de la pantalla: el de pantalla le quita más de 150 px de alto, la barrita del físico no.
 */
export function teclaFisica({ estrecha, puntero, alto, altoVisible }) {
	if (puntero) return true;
	if (estrecha) return false;
	return alto - altoVisible <= 150;
}
export const tecladoFisico = () => teclaFisica({
	estrecha: matchMedia('(max-width: 699px)').matches,
	puntero: matchMedia('(hover: hover)').matches,
	alto: innerHeight,
	altoVisible: visualViewport?.height ?? innerHeight,
});

/** Por dónde paran las flechas: todo lo pulsable, menos lo que ya tiene su tecla. Las cajas de texto, solo con Tab. */
function paradas(raiz, conCajas) {
	return [...raiz.querySelectorAll(CONTROLES)]
		.filter(el => visible(el) && !el.matches('.check:not(.marcado), .pestanas a, [data-sin-parada]') && (conCajas || el.tagName !== 'TEXTAREA' || el === document.activeElement));
}

export function mueve(dir, { conCajas = false, raiz = document.querySelector('main') } = {}) {
	if (!raiz) return false;
	const ps = paradas(raiz, conCajas);
	if (!ps.length) return false;
	const i = ps.indexOf(document.activeElement);
	// Sin nada elegido, se empieza por lo primero que se pulsa: lo que te piden aprobar va arriba. La caja de añadir, no.
	const primera = ps.find(el => el.tagName !== 'INPUT') ?? ps[0];
	const sig = i < 0 ? (dir > 0 ? primera : ps[ps.length - 1]) : ps[Math.min(ps.length - 1, Math.max(0, i + dir))];
	sig.focus();
	sig.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	return true;
}

/** @param {{ruta:()=>string, ayuda:()=>boolean, cierraAyuda:()=>boolean, oficina:()=>((e:KeyboardEvent)=>boolean)|null}} o */
export function instala({ ruta, ayuda, cierraAyuda, oficina }) {
	const marca = v => { estado.usandoTeclas = v; document.documentElement.classList.toggle('con-teclas', v); };
	const alTocar = () => marca(false);
	const sal = (e, el) => {
		e.preventDefault();
		if (cierraAyuda()) return;
		const a = atras(ruta());
		if (a) { el?.blur?.(); location.hash = a; }
	};
	const alTeclear = e => {
		const el = document.activeElement;
		const enCampo = escribiendo(el);
		if (!MODIFICADORES.includes(e.key) && (!enCampo || tecladoFisico())) marca(true);
		const esEsc = e.key === 'Escape' || (e.metaKey && e.key === '.');
		if (e.metaKey && !esEsc) return;
		if (e.ctrlKey || e.altKey) return;
		const r = ruta();
		const p = r.split('/').filter(Boolean)[0];

		if (esEsc) {
			// Con algo escrito, Esc solo te saca del campo: no se pierde lo que llevas.
			if (enCampo && el.value?.trim()) { e.preventDefault(); el.blur(); return; }
			sal(e, el);
			return;
		}
		if (e.key === 'Tab') {
			if (p && mueve(e.shiftKey ? -1 : 1, { conCajas: true })) e.preventDefault();
			return;
		}
		if (enCampo && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
			const dir = e.key === 'ArrowDown' ? 1 : -1;
			if (lineaSuelta(el) || enElBorde(el, dir)) {
				// En el chat, la caja se queda donde está y lo que se mueve es la conversación.
				if (p === 'sala') document.querySelector('.hilo')?.scrollBy({ top: 160 * dir, behavior: 'smooth' });
				else mueve(dir);
				e.preventDefault();
			}
			return;
		}
		if (enCampo) return;

		if (e.key === 'Backspace') { sal(e, el); return; }
		if (e.key === '?') { e.preventDefault(); ayuda(); return; }
		if (/^[1-4]$/.test(e.key)) { e.preventDefault(); location.hash = ORDEN[Number(e.key) - 1]; return; }
		if (e.key === '/') {
			const c = document.querySelector('main input:not([type=checkbox]):not([type=file]), main textarea');
			if (c) { e.preventDefault(); c.focus(); }
			return;
		}
		const manejador = oficina();
		if (manejador) { if (manejador(e)) e.preventDefault(); return; }

		if ((e.key === 'Enter' || e.key === ' ') && pulsable(el)) {
			if (e.key === ' ' && el.tagName === 'A') return;
			e.preventDefault();
			el.click();
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			if (p === 'sala') {
				document.querySelector('.hilo')?.scrollBy({ top: e.key === 'ArrowDown' ? 160 : -160, behavior: 'smooth' });
				e.preventDefault();
				return;
			}
			if (mueve(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault();
			return;
		}
		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			const dir = e.key === 'ArrowRight' ? 1 : -1;
			if (p === 'tareas') {
				const tabs = [...document.querySelectorAll('.pestanas a')];
				const sig = tabs[tabs.findIndex(t => t.classList.contains('activa')) + dir];
				if (sig) { e.preventDefault(); location.hash = sig.getAttribute('href'); }
			} else if (p === 'sala' && mueve(dir)) e.preventDefault();
			return;
		}
		if (p === 'tareas' && (e.key === 'x' || e.key === 'X')) el?.closest('li')?.querySelector('.check')?.click();
		// En un chat, cualquier letra te lleva a escribir
		if (p === 'sala' && e.key.length === 1 && e.key !== ' ') document.querySelector('.sala textarea')?.focus();
	};
	addEventListener('keydown', alTeclear);
	addEventListener('pointerdown', alTocar, { passive: true });
	return () => { removeEventListener('keydown', alTeclear); removeEventListener('pointerdown', alTocar); };
}
