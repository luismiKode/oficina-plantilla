<script>
	import { onMount } from 'svelte';
	import { lee, manda, escucha, cuandoFue } from '../lib/api.js';

	let p = $state(null), error = $state(''), mirando = $state(false);
	const carga = async () => { try { p = await lee('/api/lean'); } catch (e) { error = e.message; } };
	onMount(() => { carga(); return escucha(e => { if (e.tipo === 'lean' || e.tipo === 'conectado') { mirando = false; carga(); } }); });
	const deshaz = async c => { error = ''; try { await manda(`/api/lean/${c.id}/deshacer`); await carga(); } catch (e) { error = e.message; } };
	const revisa = async () => { mirando = true; try { await manda('/api/lean/revisar'); } catch (e) { error = e.message; mirando = false; } };
	const m = $derived(p?.metricas);
	const texto = c => c.tipo === 'parametro' ? `${p.parametros.find(x => x.nombre === c.nombre)?.de ?? c.nombre}: de ${c.antes} a ${c.despues}` : c.despues;
</script>

<div class="pantalla"><div class="ancho">
	<div class="cabeza">
		<h1 class="titulo-pantalla">Cómo fluye</h1>
		<button class="boton texto" onclick={revisa} disabled={mirando}>{mirando ? 'Mirando' : 'Que mire Rafa'}</button>
	</div>
	{#if error}<p class="mensaje-error">{error}</p>{/if}
	{#if p?.ultima}<p class="diag">{p.ultima.diagnostico}</p><p class="nota peq">Rafa, {cuandoFue(p.ultima.cuando)}</p>{:else if p}<p class="nota">Rafa aún no ha mirado.</p>{/if}

	{#if m}
		<dl>
			<div><dt>Tareas hechas, 24 h</dt><dd class="num">{m.tareas.hechas24h}</dd></div>
			<div><dt>Bloqueadas al ejecutar</dt><dd class="num" class:mal={m.tareas.pctBloqueadas >= 60}>{m.tareas.pctBloqueadas} %</dd></div>
			<div><dt>Por hacer</dt><dd class="num">{m.tareas.porHacer}</dd></div>
			<div><dt>Reuniones en cola</dt><dd class="num">{m.reuniones.enCola}</dd></div>
			<div><dt>Nuevas para ti, 24 h</dt><dd class="num">{m.alex.nuevas24h}</dd></div>
			<div><dt>Tareas de hoy</dt><dd class="num">{m.topes.tareas[0]}</dd></div>
			<div><dt>Reuniones de hoy, tope</dt><dd class="num">{m.topes.reuniones[0]} de {m.topes.reuniones[1]}</dd></div>
			<div><dt>Fallos, 24 h</dt><dd class="num" class:mal={m.fallos.errores24h > 0}>{m.fallos.errores24h}</dd></div>
		</dl>
	{/if}

	<h2>Lo que ha cambiado</h2>
	<ul>
		{#each p?.cambios ?? [] as c (c.id)}
			<li class:deshecho={c.deshecho}>
				<div>
					<p class="tit">{texto(c)}</p>
					{#if c.por_que}<p class="nota peq">{c.por_que}</p>{/if}
					<p class="nota peq">{c.tipo === 'propuesta' ? 'Propuesta' : c.deshecho ? `Deshecho por ${c.deshecho_por}` : ''} {cuandoFue(c.creado)}</p>
				</div>
				{#if !c.deshecho && c.tipo !== 'propuesta'}<button class="boton texto" onclick={() => deshaz(c)}>Deshacer</button>{/if}
			</li>
		{:else}
			<li class="vacio">Nada todavía.</li>
		{/each}
	</ul>
</div></div>

<style>
	.cabeza { display: flex; justify-content: space-between; align-items: baseline; }
	.diag { font-size: 19px; line-height: 1.3; }
	.peq { font-size: 14px; }
	dl { margin: 16px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px 16px; }
	dt { font-size: 14px; color: var(--apagado); }
	dd { margin: 0; font-size: 26px; font-weight: 700; }
	dd.mal { color: #c9302c; }
	h2 { font-size: 20px; margin-top: 18px; }
	ul { list-style: none; margin: 6px 0 0; padding: 0; }
	li { display: flex; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--linea); align-items: flex-start; }
	.tit { font-weight: 500; line-height: 1.25; overflow-wrap: anywhere; }
	.deshecho .tit { text-decoration: line-through; color: var(--apagado); }
</style>
