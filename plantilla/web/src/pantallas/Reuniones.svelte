<script>
	import { onMount } from 'svelte';
	import { lee, manda, escucha, cuandoFue } from '../lib/api.js';
	import Retrato from '../lib/Retrato.svelte';

	let { oficina } = $props();
	let reuniones = $state([]), error = $state(''), nueva = $state(false);
	let tema = $state(''), objetivo = $state(''), asistentes = $state([]);
	const carga = async () => { try { reuniones = await lee('/api/reuniones'); } catch (e) { error = e.message; } };
	onMount(() => { carga(); return escucha(e => { if (e.tipo === 'reunion' || e.tipo === 'conectado') carga(); }); });
	const personas = $derived((oficina?.salas ?? []).flatMap(s => s.personas.filter(p => !['revisora', 'recepcion', 'correos', 'lean'].includes(p.rol) && p.hilo !== 'general')));
	const FASE = { en_cola: 'Mañana', preparando: 'Preparándola', mesa: 'Hablándolo', redactando: 'Cerrándola', revisando: 'Bea la revisa', lista: 'Te esperan', decidida: 'Decidida', resuelta: 'Resuelta entre ellos', atascada: 'Atascada' };
	let redecorando = $state(false);
	async function redecorar() { redecorando = true; try { await manda('/api/oficina/redecorar'); await carga(); } catch (e) { error = e.message; } redecorando = false; }
	const alterna = h => { asistentes = asistentes.includes(h) ? asistentes.filter(x => x !== h) : [...asistentes, h]; };
	async function convocar(ev) {
		ev.preventDefault();
		error = '';
		try { const { id } = await manda('/api/reuniones', { tema, objetivo, convoca: 'general', asistentes }); location.hash = `#/reunion/${id}`; } catch (e) { error = e.message; }
	}
</script>

<div class="pantalla"><div class="ancho">
	<div class="cabeza">
		<h1 class="titulo-pantalla">Reuniones</h1>
		<span class="acciones">
			<button class="boton texto" onclick={redecorar} disabled={redecorando}>Que redecoren</button>
			<button class="boton texto" onclick={() => (nueva = !nueva)} aria-expanded={nueva}>{nueva ? 'Cerrar' : 'Convocar'}</button>
		</span>
	</div>
	{#if error}<p class="mensaje-error">{error}</p>{/if}
	{#if nueva}
		<form onsubmit={convocar}>
			<input class="campo" bind:value={tema} required placeholder="¿De qué es?" aria-label="Tema" />
			<textarea class="campo" rows="2" bind:value={objetivo} placeholder="Qué tienen que resolver" aria-label="Objetivo"></textarea>
			<div class="elegir" role="group" aria-label="Quién va, además de Julián">
				{#each personas as p (p.hilo)}
					<button type="button" class="ficha" aria-pressed={asistentes.includes(p.hilo)} onclick={() => alterna(p.hilo)}><Retrato look={p.look} tam={36} /><span>{p.nombre}</span></button>
				{/each}
			</div>
			<button class="boton">Reunirlos</button>
		</form>
	{/if}
	<ul>
		{#each reuniones as r (r.id)}
			<li><a data-fila href={`#/reunion/${r.id}`}>
				<span class="titulo" class:espera={r.estado === 'lista'}>{r.deck?.titulo ?? r.tema}</span>
				<span class="nota peq">{FASE[r.estado] ?? r.estado}, {cuandoFue(r.actualizado)}</span>
			</a></li>
		{:else}
			{#if !nueva}<li class="vacio">Ninguna todavía.</li>{/if}
		{/each}
	</ul>
</div></div>

<style>
	[data-fila]:focus-visible { outline: 3px solid var(--amarillo); outline-offset: 2px; border-radius: 4px; }
	.cabeza { display: flex; justify-content: space-between; align-items: baseline; }
	form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; align-items: flex-start; }
	.elegir { display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 4px; width: 100%; }
	.ficha { display: flex; flex-direction: column; align-items: center; font-size: 13px; padding: 4px; border-radius: 10px; }
	.ficha[aria-pressed='true'] { background: var(--amarillo); font-weight: 700; }
	ul { list-style: none; margin: 0; padding: 0; }
	li { border-bottom: 1px solid var(--linea); }
	li a { display: block; padding: 10px 0; text-decoration: none; min-height: 44px; }
	.titulo { display: block; font-weight: 700; line-height: 1.2; }
	.titulo.espera { background: var(--amarillo); display: inline; padding: 0 4px; }
	.peq { display: block; font-size: 14px; }
</style>
