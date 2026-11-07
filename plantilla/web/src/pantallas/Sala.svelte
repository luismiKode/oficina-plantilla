<script>
	import { onMount, tick } from 'svelte';
	import { lee, mandaFormulario, manda, escucha, formato } from '../lib/api.js';
	import Retrato from '../lib/Retrato.svelte';
	import Microfono from '../lib/Microfono.svelte';

	let { hilo } = $props();
	let persona = $state(null), mensajes = $state([]), trabajando = $state(false), progreso = $state('');
	let texto = $state(''), archivos = $state([]), aFondo = $state(false), error = $state(''), enviando = $state(false), mas = $state(false);
	let abajo;

	async function carga() {
		try {
			const j = await lee(`/api/salas/${encodeURIComponent(hilo)}/mensajes`);
			persona = j.persona; mensajes = j.mensajes; trabajando = j.trabajando;
			await tick(); abajo?.scrollIntoView({ block: 'end' });
		} catch (e) { error = e.message; }
	}
	onMount(() => {
		carga();
		return escucha(e => {
			if (e.tipo === 'conectado') return carga();
			if (e.hilo !== hilo) return;
			if (e.tipo === 'progreso') progreso = e.texto;
			if (e.tipo === 'estado') { trabajando = e.trabajando; if (!e.trabajando) progreso = ''; }
			if (e.tipo === 'mensaje') carga();
		});
	});
	async function envia(ev) {
		ev?.preventDefault();
		if (enviando || (!texto.trim() && !archivos.length)) return;
		enviando = true; error = '';
		const fd = new FormData();
		fd.set('texto', texto.trim());
		if (aFondo) fd.set('a_fondo', '1');
		for (const a of archivos) fd.append('archivos', a);
		try {
			await mandaFormulario(`/api/salas/${encodeURIComponent(hilo)}/mensajes`, fd);
			texto = ''; archivos = []; aFondo = false;
			await carga();
		} catch (e) { error = e.message; }
		enviando = false;
	}
	const tecla = e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover: hover)').matches) envia(e); };
	async function nueva() {
		await manda(`/api/salas/${encodeURIComponent(hilo)}/nueva`);
		mas = false;
		mensajes = [...mensajes, { id: `n${Date.now()}`, autor: 'corte', texto: 'Conversación nueva', adjuntos: [] }];
	}
	const quien = m => (m.de_sala ? 'recado' : '');
</script>

<div class="sala">
	<header>
		{#if persona}
			<Retrato look={persona.look} tam={44} />
			<div class="id"><h1>{persona.nombre}</h1><p class="nota">{trabajando ? (progreso || 'Escribiendo') : persona.cargo}</p></div>
			<button class="boton texto" onclick={() => (mas = !mas)} aria-expanded={mas}>Más</button>
		{/if}
	</header>
	{#if mas && persona}
		<div class="mas">
			<p>{persona.caracter}</p>
			<div class="acciones">
				<button class="boton texto" onclick={nueva}>Empezar de cero</button>
				{#if hilo === 'general:revisora'}<a class="boton texto" href="#/aprendido">Lo que ha aprendido</a>{/if}
				{#if hilo === 'general:lean'}<a class="boton texto" href="#/lean">Cómo fluye</a>{/if}
				<a class="boton texto" href={`#/tareas/${persona.dep}`}>Tablón</a>
			</div>
		</div>
	{/if}

	<div class="hilo" aria-live="polite">
		{#each mensajes as m (m.id)}
			{#if m.autor === 'corte' || m.autor === 'nota'}<p class="corte">{m.texto}</p>
			{:else if m.autor === 'sala'}<div class="suyo" class:fallo={m.estado === 'error'}>{@html formato(m.texto)}</div>
			{:else if m.autor === 'recado'}<div class="recado">{@html formato(m.origen === 'correo' ? `Tere le ha pasado un correo` : m.texto)}</div>
			{:else}
				<div class="mio">{@html formato(m.texto)}{#each m.adjuntos ?? [] as a}<p class="adj">{a}</p>{/each}</div>
			{/if}
		{/each}
		<div bind:this={abajo}></div>
	</div>

	<form onsubmit={envia}>
		{#if error}<p class="mensaje-error">{error}</p>{/if}
		{#if archivos.length}<p class="elegidos">{archivos.map(a => a.name).join(', ')} <button type="button" class="boton texto" onclick={() => (archivos = [])}>Quitar</button></p>{/if}
		<div class="linea">
			<label class="clip" aria-label="Adjuntar"><span aria-hidden="true">+</span><input type="file" multiple onchange={e => (archivos = [...e.target.files])} /></label>
			<textarea class="campo" rows="1" placeholder={persona ? `Escribe a ${persona.nombre}` : ''} aria-label="Mensaje" bind:value={texto} onkeydown={tecla}></textarea>
			{#if texto.trim() || archivos.length}<button class="boton enviar" disabled={enviando}>Enviar</button>
			{:else}<Microfono {hilo} alEnviar={carga} />{/if}
		</div>
		<label class="fondo"><input type="checkbox" bind:checked={aFondo} /> Que se lo piense a fondo</label>
	</form>
</div>

<style>
	.sala { height: 100%; display: flex; flex-direction: column; background: var(--papel); }
	header { padding: max(10px, env(safe-area-inset-top)) 16px 8px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--linea); min-height: 60px; }
	.id { flex: 1; min-width: 0; }
	h1 { font-size: 20px; }
	.id p { font-size: 14px; line-height: 1.1; }
	.mas { padding: 8px 16px; border-bottom: 1px solid var(--linea); font-size: 15px; }
	.hilo { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; max-width: 720px; width: 100%; margin-inline: auto; }
	.suyo, .mio { padding: 8px 13px; border-radius: 16px; overflow-wrap: anywhere; max-width: 86%; }
	.suyo { background: #fff; align-self: flex-start; }
	.suyo.fallo { background: #f2d3cf; }
	.mio { background: var(--negro); color: var(--papel); align-self: flex-end; }
	.recado { align-self: center; font-size: 13px; color: var(--apagado); text-align: center; max-width: 86%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
	.adj { font-size: 14px; opacity: .8; }
	.hilo :global(p + p), .hilo :global(ul + p), .hilo :global(p + ul) { margin-top: .5em; }
	.hilo :global(ul) { margin: 0; padding-left: 1.1em; }
	.hilo :global(code) { font-family: var(--marca-font-numbers); background: rgba(25,25,25,.09); padding: 0 .25em; border-radius: 4px; }
	.corte { align-self: center; color: var(--apagado); font-size: 13px; }
	form { padding: 8px 12px max(8px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--linea); max-width: 720px; width: 100%; margin-inline: auto; }
	.linea { display: flex; gap: 6px; align-items: flex-end; }
	textarea { resize: none; flex: 1; min-height: 44px; border-width: 1px; }
	.clip { width: 44px; height: 44px; flex: none; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 300; cursor: pointer; }
	.clip input { position: absolute; width: 1px; height: 1px; opacity: 0; }
	.clip:focus-within { outline: 3px solid var(--marca-foco); border-radius: 22px; }
	.fondo { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--apagado); padding-left: 50px; }
	.elegidos { font-size: 14px; }
</style>
