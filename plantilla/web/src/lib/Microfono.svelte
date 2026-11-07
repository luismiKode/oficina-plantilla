<script>
	// Tu voz: pulsa, cuenta lo que ha pasado, pulsa otra vez. Le llega a Julián (o a quien tengas abierto).
	import { mandaFormulario } from './api.js';

	let { hilo = 'general', alEnviar = null } = $props();
	let grabando = $state(false), enviando = $state(false), mensaje = $state(''), sinSubir = $state(null);
	let rec, trozos = [], flujo;

	const compatible = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

	async function empieza() {
		mensaje = '';
		try {
			flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
			const tipo = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
			rec = new MediaRecorder(flujo, { mimeType: tipo });
			trozos = [];
			rec.ondataavailable = e => { if (e.data.size) trozos.push(e.data); };
			rec.onstop = () => envia(new Blob(trozos, { type: tipo }), tipo);
			rec.start();
			grabando = true;
		} catch { mensaje = 'No tengo permiso para usar el micro.'; }
	}
	function para() { rec?.stop(); flujo?.getTracks().forEach(t => t.stop()); grabando = false; }
	async function envia(blob, tipo) {
		enviando = true; mensaje = '';
		// Hasta que el Mac lo tenga, el audio solo está aquí: si la red falla, no se pierde.
		sinSubir = { blob, tipo };
		const fd = new FormData();
		fd.append('audio', new File([blob], tipo.includes('mp4') ? 'nota.m4a' : 'nota.webm', { type: tipo }));
		try {
			await mandaFormulario(`/api/salas/${encodeURIComponent(hilo)}/mensajes`, fd);
			sinSubir = null;
			if (alEnviar) alEnviar(); else location.hash = `#/sala/${encodeURIComponent(hilo)}`;
		} catch (e) {
			if (/30 MB/.test(e.message)) { sinSubir = null; mensaje = e.message; }
			else mensaje = `No ha llegado: ${e.message}. Toca para repetir.`;
		}
		enviando = false;
	}
	const pulsa = () => { if (grabando) para(); else if (sinSubir) envia(sinSubir.blob, sinSubir.tipo); else empieza(); };
</script>

{#if compatible}
	<div class="mic">
		{#if mensaje}<p class="msg" role="status">{mensaje}</p>{/if}
		{#if sinSubir && !enviando}<button type="button" class="boton texto" onclick={() => { sinSubir = null; mensaje = ''; }}>Descartar</button>{/if}
		<button type="button" class="b" class:rojo={grabando} disabled={enviando} aria-label={grabando ? 'Parar y enviar' : sinSubir ? 'Repetir el envío del audio' : 'Grabar un audio'} onclick={pulsa}>
			{#if grabando}<span class="cuadro"></span>{:else if enviando}<span class="puntos">...</span>{:else}
				<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
			{/if}
		</button>
	</div>
{/if}

<style>
	.mic { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
	.b { width: 48px; height: 48px; flex: none; border-radius: 24px; background: var(--amarillo); color: var(--negro); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px var(--negro); }
	.b.rojo { background: #c9302c; color: #fff; }
	.cuadro { width: 16px; height: 16px; background: #fff; border-radius: 2px; }
	.puntos { font-weight: 800; }
	.msg { background: var(--negro); color: var(--papel); font-size: 14px; padding: 6px 10px; border-radius: 10px; max-width: 240px; }
</style>
