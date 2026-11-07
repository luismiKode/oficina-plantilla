<script>
	import { onMount } from 'svelte';
	import { lee, manda, escucha, cuandoFue } from '../lib/api.js';

	let { oficina } = $props();
	let correos = $state([]), ultima = $state(null), mirando = $state(false), error = $state(''), abierto = $state(null);
	const carga = async () => {
		try { const j = await lee('/api/correo'); correos = j.correos; ultima = j.ultimaPasada; mirando = j.recepcionTrabajando; } catch (e) { error = e.message; }
	};
	onMount(() => { carga(); return escucha(e => { if (e.tipo === 'recepcion') { mirando = e.trabajando; if (!e.trabajando) carga(); } if (e.tipo === 'conectado') carga(); }); });
	const salas = $derived(Object.fromEntries((oficina?.salas ?? []).map(s => [s.id, s])));
	const accion = async (c, a) => {
		error = '';
		try {
			const j = await manda(`/api/correo/${encodeURIComponent(c.hilo)}`, { accion: a });
			if (j.hilo) location.hash = `#/sala/${encodeURIComponent(j.hilo)}`; else carga();
		} catch (e) { error = e.message; }
	};
	const mirar = async () => { mirando = true; try { await manda('/api/recepcion/mirar'); } catch (e) { error = e.message; mirando = false; } };
</script>

<div class="pantalla"><div class="ancho">
	<div class="cabeza">
		<h1 class="titulo-pantalla">Lo que ha entrado</h1>
		<button class="boton texto" onclick={mirar} disabled={mirando}>{mirando ? 'Mirando' : 'Mirar ahora'}</button>
	</div>
	<p class="nota">{ultima ? `Tere lo ha mirado ${cuandoFue(ultima)}. Los departamentos ya están con lo suyo.` : 'Tere aún no lo ha mirado.'}</p>
	{#if error}<p class="mensaje-error">{error}</p>{/if}
	<ul>
		{#each correos as c (c.hilo)}
			<li class:dinero={c.alerta_dinero}>
				<button class="fila" data-fila aria-expanded={abierto === c.hilo} onclick={() => (abierto = abierto === c.hilo ? null : c.hilo)}>
					<span class="tit">{c.asunto}</span>
					<span class="nota peq">{salas[c.sala]?.nombre}{c.urgencia === 'alta' ? ', urgente' : ''}</span>
				</button>
				{#if c.alerta_dinero}<p class="alerta">Pide cambios de dinero. No pagues nada sin comprobarlo por otra vía.</p>{/if}
				{#if abierto === c.hilo}
					<p class="nota peq">De {c.de_quien}</p>
					<p>{c.resumen}</p>
					<div class="acciones">
						{#if c.urgencia !== 'saber'}<button class="boton" onclick={() => accion(c, 'borrador')}>{salas[c.sala]?.id === 'legal' ? 'Redactar' : 'Borrador'}</button>{/if}
						<button class="boton discreto" onclick={() => accion(c, 'hablar')}>Hablarlo</button>
						<a class="boton texto" href={c.enlace} target="_blank" rel="noopener noreferrer">Abrir</a>
						<button class="boton texto" onclick={() => accion(c, 'hecho')}>Hecho</button>
					</div>
				{/if}
			</li>
		{:else}
			<li class="vacio">Todo al día. Lo de Privado queda fuera.</li>
		{/each}
	</ul>
</div></div>

<style>
	[data-fila]:focus-visible { outline: 3px solid var(--amarillo); outline-offset: 2px; border-radius: 4px; }
	.cabeza { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
	.titulo-pantalla { margin-bottom: 2px; }
	ul { list-style: none; margin: 12px 0 0; padding: 0; }
	li { padding: 10px 0; border-bottom: 1px solid var(--linea); }
	.fila { display: block; width: 100%; }
	.tit { display: block; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
	.peq { font-size: 14px; }
	.alerta { background: #c9302c; color: #fff; padding: 8px 12px; border-radius: 10px; font-weight: 700; margin-top: 6px; }
	.acciones { margin-top: 8px; }
</style>
