<script>
	import { onMount } from 'svelte';
	import { escucha } from '../lib/api.js';
	import { crearEscena } from '../lib/escena.js';
	import Microfono from '../lib/Microfono.svelte';

	let { oficina } = $props();
	let lienzo, caja = $state(), escena, plano = $state(null), ancho = $state(0);
	const pc = (v, t) => `${(v / t) * 100}%`;
	const unidad = $derived(plano && ancho ? ancho / plano.W : 3);

	onMount(() => {
		escena = crearEscena(lienzo, { alCambiar: () => { plano = escena.plano(); } });
		const ro = new ResizeObserver(([e]) => { ancho = e.contentRect.width; });
		ro.observe(caja);
		const off = escucha(e => { if (e.tipo === 'recado') escena.recado(e.de, e.a); });
		return () => { ro.disconnect(); off(); escena.destruye(); };
	});
	$effect(() => { if (oficina && escena && ancho) escena.actualiza($state.snapshot(oficina), ancho); });
	const lista = $derived(oficina?.listas?.[0]);
	const alerta = $derived(oficina?.alertas);
</script>

<div class="contar"><Microfono /></div>
<div class="edificio" bind:this={caja}>
	{#if lista}<a class="fila-urgente" href={`#/reunion/${lista.id}`}>Te necesitan en una reunión: {lista.titulo ?? lista.tema}</a>{/if}
	{#if alerta}<a class="fila-urgente roja" href="#/correo">Un correo pide cambios de dinero</a>{/if}
	<div class="plano" style={`--u:${unidad}px`}>
		<canvas bind:this={lienzo}></canvas>
		{#if plano}
			{#each plano.plantas as p (p.id)}
				<span class="cartel" style={`left:${pc(4, plano.W)};top:${pc(p.y + 6, plano.H)};width:${pc(42, plano.W)};height:${pc(13, plano.H)}`}>{p.vestibulo ? 'Recepción' : p.sala ? 'Reuniones' : p.nombre}</span>
				{#if p.panel && p.kpis.length}
					<a class="panel" href={`#/tareas/${p.id}`} aria-label={`Números de ${p.nombre}`} style={`left:${pc(p.panel.x + 2, plano.W)};top:${pc(p.y + 5, plano.H)};width:${pc(p.panel.w - 4, plano.W)};height:${pc(17, plano.H)}`}>
						{#each p.kpis as k}<span class="kpi" title={k.fuente}><span>{k.etiqueta}</span><b class="num">{k.valor}</b></span>{/each}
					</a>
				{/if}
				{#if p.neon && p.lema}<span class="neon" style={`left:${pc(p.neon.x + 2, plano.W)};top:${pc(p.y + 7, plano.H)};width:${pc(p.neon.w - 4, plano.W)};height:${pc(11, plano.H)}`}>{p.lema}</span>{/if}
				{#if p.sala}<a class="zona" href="#/reuniones" aria-label="Ver las reuniones" style={`left:0;top:${pc(p.y, plano.H)};width:${pc(plano.W - 22, plano.W)};height:${pc(p.alto, plano.H)}`}></a>{/if}
				{#if !p.sala && !p.vestibulo}<a class="zona corcho" href={`#/tareas/${p.id}`} aria-label={`Tablón de ${p.nombre}`} style={`left:${pc(plano.W === 300 ? 50 : 3, plano.W)};top:${pc(p.y, plano.H)};width:${pc(plano.W === 300 ? 22 : 44, plano.W)};height:${pc(24, plano.H)}`}></a>{/if}
			{/each}
			{#each plano.personas as a (a.hilo)}
				<a class="persona" href={a.hilo === 'general:recepcion' ? '#/correo' : `#/sala/${encodeURIComponent(a.hilo)}`} style={`left:${pc(a.x - plano.anchoMesa / 2, plano.W)};top:${pc(a.y - 22, plano.H)};width:${pc(plano.anchoMesa, plano.W)};height:${pc(40, plano.H)}`} aria-label={`${a.nombre}, ${a.cargo}`}>
					<span class="placa" style={`height:${(10 / 40) * 100}%`}><b>{a.nombre}</b><i>{a.cargo}</i></span>
				</a>
			{/each}
		{/if}
	</div>
</div>

<style>
	.contar { position: fixed; right: 14px; bottom: calc(68px + env(safe-area-inset-bottom)); z-index: 5; }
	.edificio { height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; background: var(--negro); padding-top: env(safe-area-inset-top); }
	.plano { position: relative; }
	canvas { display: block; width: 100%; height: auto; image-rendering: pixelated; }
	.cartel { position: absolute; font-size: max(8px, calc(var(--u) * 3.6)); font-weight: 800; line-height: 1; color: var(--negro); white-space: nowrap; overflow: hidden; pointer-events: none; display: flex; align-items: center; justify-content: center; }
	.persona { position: absolute; display: flex; align-items: flex-end; justify-content: center; text-decoration: none; }
	.placa { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 90%; margin-bottom: calc(var(--u) * 2); color: var(--negro); line-height: 1.05; overflow: hidden; text-align: center; }
	.placa b { font-size: max(8px, calc(var(--u) * 3.1)); font-weight: 800; white-space: nowrap; }
	.placa i { font-style: normal; font-size: max(6.5px, calc(var(--u) * 2.25)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
	.panel { position: absolute; display: flex; flex-direction: column; justify-content: space-around; text-decoration: none; color: #9fe8ff; overflow: hidden; padding: 0 2px; z-index: 1; }
	.kpi { display: flex; justify-content: space-between; align-items: baseline; gap: 3px; font-size: max(6.5px, calc(var(--u) * 2.2)); line-height: 1; white-space: nowrap; }
	.kpi span { overflow: hidden; text-overflow: ellipsis; opacity: .8; }
	.kpi b { color: #ffd23f; font-weight: 700; }
	.neon { position: absolute; display: flex; align-items: center; justify-content: center; color: #ff5fb0; font-weight: 800; font-size: max(6.5px, calc(var(--u) * 2.6)); line-height: 1; text-align: center; text-shadow: 0 0 4px #ff5fb0; pointer-events: none; overflow: hidden; }
	.zona { position: absolute; }
	.corcho { z-index: 1; }
	.persona { z-index: 2; }
	.fila-urgente { display: block; background: var(--amarillo); color: var(--negro); padding: 10px 16px; font-weight: 700; text-decoration: none; }
	.fila-urgente.roja { background: #c9302c; color: #fff; }
</style>
