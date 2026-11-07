<script>
	import { onMount, tick } from 'svelte';
	import { lee, mandaFormulario, manda, escucha, formato } from '../lib/api.js';
	import Retrato from '../lib/Retrato.svelte';
	import Microfono from '../lib/Microfono.svelte';
	import { estado, tecladoFisico } from '../lib/teclado.js';

	let { hilo } = $props();
	let persona = $state(null), mensajes = $state([]), vivo = $state(null), reloj = $state(Date.now()), abierto = $state(null);
	let texto = $state(''), archivos = $state([]), error = $state(''), enviando = $state(false), mas = $state(false);
	let abajo;
	const COLA = { ocupado: 'Termina lo que tiene entre manos y te contesta', espera: 'En cola: el resto de la oficina está ocupado' };
	const baja = async () => { await tick(); abajo?.scrollIntoView({ block: 'end' }); };
	const tiempo = s => (s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
	const segundos = $derived(vivo?.desde ? Math.max(0, Math.round((reloj - vivo.desde) / 1000)) : 0);
	const anteriores = $derived(vivo?.pasos ? vivo.pasos.filter(p => p.texto !== vivo.ahora).slice(-3) : []);

	async function carga() {
		try {
			const j = await lee(`/api/salas/${encodeURIComponent(hilo)}/mensajes`);
			persona = j.persona; mensajes = j.mensajes; vivo = j.vivo;
			await baja();
		} catch (e) { error = e.message; }
	}
	onMount(() => {
		carga();
		// Con teclado físico, entras y ya puedes escribir.
		if (estado.usandoTeclas) setTimeout(() => document.querySelector('.sala textarea')?.focus(), 80);
		const t = setInterval(() => { if (vivo?.desde) reloj = Date.now(); }, 1000);
		const off = escucha(e => {
			if (e.tipo === 'conectado') return carga();
			if (e.hilo !== hilo) return;
			// Lo que está hablando con otros no se ve aquí.
			if (e.interno) return;
			if (e.tipo === 'progreso') { vivo = { desde: e.desde, ahora: e.ahora, pasos: e.pasos, cola: vivo?.cola ?? null }; baja(); }
			if (e.tipo === 'estado' || e.tipo === 'mensaje') carga();
		});
		return () => { clearInterval(t); off(); };
	});
	async function envia(ev) {
		ev?.preventDefault();
		if (enviando || (!texto.trim() && !archivos.length)) return;
		enviando = true; error = '';
		const fd = new FormData();
		fd.set('texto', texto.trim());
		for (const a of archivos) fd.append('archivos', a);
		try {
			await mandaFormulario(`/api/salas/${encodeURIComponent(hilo)}/mensajes`, fd);
			texto = ''; archivos = [];
			await carga();
		} catch (e) { error = e.message; }
		enviando = false;
	}
	// Enter envía con teclado físico. Con el de pantalla, es un salto de línea.
	const tecla = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && tecladoFisico()) envia(e); };
	async function nueva() {
		await manda(`/api/salas/${encodeURIComponent(hilo)}/nueva`);
		mas = false;
		mensajes = [...mensajes, { id: `n${Date.now()}`, autor: 'corte', texto: 'Conversación nueva', adjuntos: [] }];
	}
</script>

<div class="sala entra">
	<header>
		{#if persona}
			<Retrato look={persona.look} tam={44} />
			<div class="id"><h1>{persona.nombre}</h1><p class="nota">{persona.cargo}</p></div>
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
			{:else if m.autor === 'sala'}
				<div class="suyo" class:fallo={m.estado === 'error'}>{@html formato(m.texto)}</div>
				{#if m.pasos?.pasos?.length > 1}
					<button type="button" class="como" aria-expanded={abierto === m.id} onclick={() => (abierto = abierto === m.id ? null : m.id)}>{m.pasos.pasos.length - 1} {m.pasos.pasos.length === 2 ? 'paso' : 'pasos'}, {tiempo(Math.round(m.pasos.ms / 1000))}</button>
					{#if abierto === m.id}<ol class="pasos">{#each m.pasos.pasos.slice(1) as p}<li>{p.texto}</li>{/each}</ol>{/if}
				{/if}
			{:else}
				<div class="mio">{@html formato(m.texto)}{#each m.adjuntos ?? [] as a}<p class="adj">{a}</p>{/each}</div>
			{/if}
		{/each}
		{#if vivo && persona}
			<div class="vivo">
				<Retrato look={persona.look} tam={32} />
				<div class="cuenta">
					{#each anteriores as p}<p class="antes">{p.texto}</p>{/each}
					<p class="ahora" role="status"><span class="latido" aria-hidden="true"></span>{vivo.ahora || COLA[vivo.cola] || 'Enseguida'}{#if vivo.desde}<span class="crono" aria-hidden="true">{tiempo(segundos)}</span>{/if}</p>
					{#if vivo.desde && vivo.cola === 'despues'}<p class="antes">Tu último mensaje va después de esto</p>{/if}
				</div>
			</div>
		{/if}
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
	</form>
</div>

<style>
	.entra { animation: entrar .16s ease-out; }
	@keyframes entrar { from { opacity: 0; transform: scale(1.03); } }
	@media (prefers-reduced-motion: reduce) { .entra { animation: none; } }
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
	.como { align-self: flex-start; font-size: 13px; color: var(--apagado); padding: 0 13px; text-decoration: underline; text-decoration-color: var(--linea); text-underline-offset: 3px; min-height: 28px; }
	.pasos { align-self: flex-start; margin: 0 0 4px; padding: 0 13px 0 32px; font-size: 14px; color: var(--apagado); }
	.pasos li { padding: 1px 0; overflow-wrap: anywhere; }
	.vivo { display: flex; gap: 8px; align-items: flex-end; align-self: flex-start; max-width: 92%; margin-top: 2px; }
	.vivo :global(canvas), .vivo :global(img) { flex: none; }
	.cuenta { background: #fff; border-radius: 16px; padding: 8px 13px; min-width: 0; }
	.cuenta p { line-height: 1.3; overflow-wrap: anywhere; }
	.antes { font-size: 14px; color: var(--apagado); }
	.ahora { display: flex; align-items: baseline; gap: 7px; font-size: 15px; font-weight: 600; }
	.latido { width: 8px; height: 8px; border-radius: 50%; background: var(--amarillo); flex: none; align-self: center; animation: latir 1.1s ease-in-out infinite; }
	@keyframes latir { 50% { opacity: .25; transform: scale(.75); } }
	@media (prefers-reduced-motion: reduce) { .latido { animation: none; } }
	.crono { margin-left: auto; padding-left: 10px; font-family: var(--marca-font-numbers); font-weight: 500; font-size: 13px; color: var(--apagado); font-variant-numeric: tabular-nums; }
	.elegidos { font-size: 14px; }
</style>
