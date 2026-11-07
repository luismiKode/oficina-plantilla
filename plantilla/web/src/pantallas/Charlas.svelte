<script>
	import { onMount } from 'svelte';
	import { lee, escucha, formato, cuandoFue } from '../lib/api.js';
	import Retrato from '../lib/Retrato.svelte';

	let datos = $state({ ahora: [], antes: [] }), q = $state(''), abierta = $state(null), error = $state('');
	let t;
	const carga = async () => {
		try { datos = await lee(`/api/charlas${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); } catch (e) { error = e.message; }
	};
	const busca = () => { clearTimeout(t); t = setTimeout(carga, 250); };
	onMount(() => { carga(); return escucha(e => { if (['mensaje', 'estado', 'reunion', 'conectado'].includes(e.tipo)) { clearTimeout(t); t = setTimeout(carga, 400); } }); });
	const FASE = { preparando: 'Preparándola', mesa: 'Hablándolo', redactando: 'Cerrándola', revisando: 'Bea la revisa', lista: 'Te esperan', decidida: 'Decidida', resuelta: 'Resuelta', atascada: 'Atascada', en_cola: 'En cola' };
	const quien = g => g.map(x => x.nombre).join(', ');
</script>

{#snippet fila(c)}
	<li>
		{#if c.tipo === 'reunion'}
			<a class="cab" data-fila href={`#/reunion/${c.id}`}>
				<span class="caras">{#each c.gente.slice(0, 4) as g}<Retrato look={g.look} tam={28} />{/each}</span>
				<span class="txt"><b>{c.titulo}</b><span class="nota peq">Reunión. {quien(c.gente)}. {FASE[c.estado] ?? c.estado}, {cuandoFue(c.creado)}</span></span>
			</a>
		{:else}
			<button class="cab" data-fila aria-expanded={abierta === c.id} onclick={() => (abierta = abierta === c.id ? null : c.id)}>
				<span class="caras">{#each c.gente as g}<Retrato look={g.look} tam={28} />{/each}</span>
				<span class="txt"><b>{quien(c.gente)}</b><span class="nota peq resumen">{c.texto}</span><span class="nota peq">{c.vivo ? 'Hablando ahora' : cuandoFue(c.creado)}</span></span>
			</button>
			{#if abierta === c.id}
				<div class="dentro">
					<p class="de">{c.gente[0]?.nombre}</p><div class="burbuja">{@html formato(c.texto)}</div>
					{#if c.respuesta}<p class="de">{c.gente[1]?.nombre}</p><div class="burbuja">{@html formato(c.respuesta)}</div>
					{:else if c.vivo}<p class="nota peq">{c.gente[1]?.nombre} está contestando</p>{/if}
				</div>
			{/if}
		{/if}
	</li>
{/snippet}

<div class="pantalla"><div class="ancho">
	<h1 class="titulo-pantalla">Charlas</h1>
	<input class="campo" type="search" placeholder="Buscar en lo que han hablado" aria-label="Buscar" bind:value={q} oninput={busca} />
	{#if error}<p class="mensaje-error">{error}</p>{/if}
	{#if datos.ahora.length}
		<h2>Ahora</h2>
		<ul>{#each datos.ahora as c (`${c.tipo}${c.id}`)}{@render fila(c)}{/each}</ul>
	{/if}
	{#if datos.antes.length}
		{#if datos.ahora.length}<h2>Antes</h2>{/if}
		<ul>{#each datos.antes as c (`${c.tipo}${c.id}`)}{@render fila(c)}{/each}</ul>
	{:else if !datos.ahora.length}
		<p class="vacio">{q.trim() ? 'No hay nada con eso.' : 'Aún no han hablado de nada.'}</p>
	{/if}
</div></div>

<style>
	[data-fila]:focus-visible { outline: 3px solid var(--amarillo); outline-offset: 2px; border-radius: 4px; }
	h2 { font-size: 18px; margin-top: 18px; }
	ul { list-style: none; margin: 6px 0 0; padding: 0; }
	li { border-bottom: 1px solid var(--linea); }
	.cab { display: flex; gap: 10px; width: 100%; padding: 10px 0; text-decoration: none; align-items: flex-start; min-height: 44px; }
	.caras { display: flex; flex: none; }
	.txt { display: flex; flex-direction: column; min-width: 0; }
	.txt b { line-height: 1.2; overflow-wrap: anywhere; }
	.peq { font-size: 14px; }
	.resumen { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
	.dentro { padding: 0 0 12px; }
	.de { font-weight: 700; font-size: 14px; margin-top: 6px; }
	.burbuja { background: #fff; border-radius: 12px; padding: 8px 12px; overflow-wrap: anywhere; font-size: 15px; }
	.burbuja :global(p + p) { margin-top: .5em; }
	.burbuja :global(ul) { padding-left: 1.1em; }
	.burbuja :global(li) { border: 0; }
	.campo { margin-top: 2px; }
</style>
