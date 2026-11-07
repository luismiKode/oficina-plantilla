<script>
	import { onMount } from 'svelte';
	import { escucha } from '../lib/api.js';
	import { crearEscena } from '../lib/escena.js';
	import Microfono from '../lib/Microfono.svelte';
	import { estado } from '../lib/teclado.js';

	let { oficina, registraTeclas = () => {} } = $props();
	let lienzo, caja = $state(), escena, plano = $state(null), ancho = $state(0);
	let sel = $state(null); // hilo de la mesa seleccionada, o 'reuniones'
	const pc = (v, t) => `${(v / t) * 100}%`;
	const unidad = $derived(plano && ancho ? ancho / plano.W : 3);

	onMount(() => {
		escena = crearEscena(lienzo, { alCambiar: () => { plano = escena.plano(); } });
		const ro = new ResizeObserver(([e]) => { ancho = e.contentRect.width; });
		ro.observe(caja);
		const off = escucha(e => { if (e.tipo === 'recado') escena.recado(e.de, e.a); });
		registraTeclas(teclas);
		return () => { registraTeclas(null); ro.disconnect(); off(); escena.destruye(); };
	});
	$effect(() => { if (oficina && escena && ancho) escena.actualiza($state.snapshot(oficina), ancho); });
	// Con teclas: las mesas, ordenadas como se ven, y la sala de reuniones como una parada más.
	const paradas = () => {
		if (!plano) return [];
		const mesas = plano.personas.map(a => ({ id: a.hilo, x: a.x, y: a.y, nombre: a.nombre, cargo: a.cargo }));
		const r = plano.plantas.find(p => p.sala);
		if (r) mesas.push({ id: 'reuniones', x: 60, y: r.y + r.alto - 26, nombre: 'Sala de reuniones', cargo: '' });
		return mesas.sort((a, b) => a.y - b.y || a.x - b.x);
	};
	const plantaDe = (y) => plano.plantas.findIndex(p => y >= p.y && y < p.y + p.alto);
	function elige(id) {
		sel = id;
		estado.ultimaMesa = id;
		const nodo = caja?.querySelector(`[data-parada="${CSS.escape(id)}"]`);
		nodo?.focus({ preventScroll: true });
		nodo?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
		if (id !== 'reuniones') escena?.saluda(id);
	}
	function teclas(e) {
		const ps = paradas();
		if (!ps.length) return false;
		const k = e.key;
		const flecha = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k);
		const act = ps.find(p => p.id === sel);
		if (flecha && !act) { elige(ps[0].id); return true; }
		if (flecha) {
			if (k === 'ArrowLeft' || k === 'ArrowRight') {
				const i = ps.indexOf(act) + (k === 'ArrowRight' ? 1 : -1);
				if (ps[i]) elige(ps[i].id);
				return true;
			}
			const baja = k === 'ArrowDown';
			if (e.shiftKey) {
				const f = plantaDe(act.y) + (baja ? 1 : -1);
				const destino = ps.find(p => plantaDe(p.y) === f) ?? (baja ? null : ps.findLast(p => plantaDe(p.y) <= f));
				if (destino) elige(destino.id);
				return true;
			}
			// La fila de arriba o de abajo, la mesa más cercana en horizontal
			const filas = [...new Set(ps.map(p => p.y))];
			const y = filas[filas.indexOf(act.y) + (baja ? 1 : -1)];
			if (y === undefined) return true;
			const fila = ps.filter(p => p.y === y);
			elige(fila.reduce((m, p) => (Math.abs(p.x - act.x) < Math.abs(m.x - act.x) ? p : m)).id);
			return true;
		}
		if (k === 'Enter' && act) {
			location.hash = act.id === 'reuniones' ? '#/reuniones' : act.id === 'general:recepcion' ? '#/correo' : `#/sala/${encodeURIComponent(act.id)}`;
			return true;
		}
		if (k === 'm' || k === 'M') { document.querySelector('.contar button')?.click(); return true; }
		if ((k === 't' || k === 'T') && act) {
			const pl = plano.plantas[plantaDe(act.y)];
			if (pl && !pl.sala && !pl.vestibulo) location.hash = `#/tareas/${pl.id}`;
			return true;
		}
		return false;
	}
	// Al volver con Esc, en la misma mesa
	$effect(() => {
		if (plano && estado.usandoTeclas && estado.ultimaMesa && !sel) elige(estado.ultimaMesa);
	});
	const seleccion = $derived(paradas().find(p => p.id === sel));
	const lista = $derived(oficina?.listas?.[0]);
	const alerta = $derived(oficina?.alertas);
</script>

{#if seleccion}
	<p class="hud" aria-live="polite"><b>{seleccion.nombre}</b>{#if seleccion.cargo}, {seleccion.cargo}{/if}<span>Enter para entrar. ? para ver las teclas</span></p>
{/if}
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
				{#if p.sala}<a class="zona" data-parada="reuniones" class:elegida={sel === 'reuniones'} tabindex={sel === 'reuniones' ? 0 : -1} href="#/reuniones" aria-label="Ver las reuniones" style={`left:0;top:${pc(p.y, plano.H)};width:${pc(plano.W - 22, plano.W)};height:${pc(p.alto, plano.H)}`}></a>{/if}
				{#if !p.sala && !p.vestibulo}<a class="zona corcho" href={`#/tareas/${p.id}`} aria-label={`Tablón de ${p.nombre}`} style={`left:${pc(plano.W === 300 ? 50 : 3, plano.W)};top:${pc(p.y, plano.H)};width:${pc(plano.W === 300 ? 22 : 44, plano.W)};height:${pc(24, plano.H)}`}></a>{/if}
			{/each}
			{#each plano.personas as a (a.hilo)}
				<a class="persona" class:elegida={sel === a.hilo} data-parada={a.hilo} href={a.hilo === 'general:recepcion' ? '#/correo' : `#/sala/${encodeURIComponent(a.hilo)}`} style={`left:${pc(a.x - plano.anchoMesa / 2, plano.W)};top:${pc(a.y - 22, plano.H)};width:${pc(plano.anchoMesa, plano.W)};height:${pc(40, plano.H)}`} aria-label={`${a.nombre}, ${a.cargo}`}>
					<span class="placa" style={`height:${(10 / 40) * 100}%`}><b>{a.nombre}</b><i>{a.cargo}</i></span>
				</a>
			{/each}
		{/if}
	</div>
</div>

<style>
	:global(html:not(.con-teclas)) .hud { display: none; }
	:global(html:not(.con-teclas)) .elegida { outline: none; }
	.hud { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(68px + env(safe-area-inset-bottom)); z-index: 5; background: var(--negro); color: var(--papel); padding: 8px 16px; border-radius: 22px; font-size: 16px; white-space: nowrap; box-shadow: 0 0 0 2px var(--amarillo); }
	.hud span { margin-left: 12px; font-size: 13px; opacity: .7; }
	.elegida { outline: 3px solid var(--amarillo); outline-offset: 2px; border-radius: 4px; z-index: 3; animation: elegir .22s ease-out; }
	.persona:focus-visible, .zona:focus-visible { outline: 3px solid var(--amarillo); outline-offset: 2px; }
	@keyframes elegir { from { outline-offset: 10px; outline-color: transparent; } to { outline-offset: 2px; } }
	@media (prefers-reduced-motion: reduce) { .elegida { animation: none; } }
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
