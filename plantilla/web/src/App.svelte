<script>
	import { onMount } from 'svelte';
	import { lee, escucha } from './lib/api.js';
	import { instala } from './lib/teclado.js';
	import Oficina from './pantallas/Oficina.svelte';
	import Sala from './pantallas/Sala.svelte';
	import Tareas from './pantallas/Tareas.svelte';
	import Correo from './pantallas/Correo.svelte';
	import Reuniones from './pantallas/Reuniones.svelte';
	import Reunion from './pantallas/Reunion.svelte';
	import Aprendido from './pantallas/Aprendido.svelte';
	import Lean from './pantallas/Lean.svelte';
	import Charlas from './pantallas/Charlas.svelte';

	let ruta = $state(location.hash.slice(1) || '/');
	let oficina = $state(null);
	let sinRed = $state(false);
	let ayuda = $state(false);
	let manejadorOficina = $state(null);

	async function refresca() {
		try { oficina = await lee('/api/oficina'); sinRed = false; } catch { sinRed = true; }
	}
	onMount(() => {
		const h = () => { ruta = location.hash.slice(1) || '/'; ayuda = false; };
		addEventListener('hashchange', h);
		const quitaTeclas = instala({
			ruta: () => ruta,
			ayuda: () => { ayuda = !ayuda; },
			cierraAyuda: () => { const a = ayuda; ayuda = false; return a; },
			oficina: () => ((partes[0] ?? 'oficina') === 'oficina' ? manejadorOficina : null),
		});
		refresca();
		let t;
		const off = escucha(e => { if (e.tipo === 'recado') return; clearTimeout(t); t = setTimeout(refresca, 300); });
		const vuelve = () => { if (document.visibilityState === 'visible') refresca(); };
		document.addEventListener('visibilitychange', vuelve);
		const reloj = setInterval(refresca, 60_000);
		return () => { quitaTeclas(); removeEventListener('hashchange', h); off(); document.removeEventListener('visibilitychange', vuelve); clearInterval(reloj); };
	});

	const partes = $derived(ruta.split('/').filter(Boolean));
	const pant = $derived(partes[0] ?? 'oficina');
	const julian = $derived(pant === 'sala' && decodeURIComponent(partes[1] ?? '') === 'general');
	const dias = $derived(oficina?.salud?.expira ? Math.ceil((new Date(oficina.salud.expira) - Date.now()) / 86_400_000) : null);
	const aviso = $derived(
		sinRed ? 'El Mac no contesta.'
		: oficina?.salud?.sesion === 'caducada' ? 'La sesión de Claude del Mac ha caducado: haz claude auth login allí.'
		: oficina?.salud?.limite ? 'Claude ha llegado a su límite de uso. Sigue en cuanto se reinicie.'
		: dias != null && dias <= 2 ? `La sesión de Claude caduca en ${dias} ${dias === 1 ? 'día' : 'días'}: haz claude auth login en el Mac.`
		: null);
	const presenta = $derived(pant === 'reunion');
</script>

{#if ayuda}
	<button class="ayuda" onclick={() => (ayuda = false)} aria-label="Cerrar la ayuda">
		<span class="caja">
			<b>Teclas</b>
			<span><kbd>↑ ↓ ← →</kbd> Moverte de mesa, o por la lista</span>
			<span><kbd>Mayús + ↑ ↓</kbd> Cambiar de planta</span>
			<span><kbd>Enter</kbd> Entrar o pulsar</span>
			<span><kbd>Esc</kbd>, <kbd>⌘ .</kbd> o <kbd>⌫</kbd> Salir</span>
			<span><kbd>Tab</kbd> Siguiente botón</span>
			<span><kbd>T</kbd> Tablón de la planta</span>
			<span><kbd>M</kbd> Grabar un audio, en la oficina</span>
			<span><kbd>1 2 3 4</kbd> Oficina, Julián, Charlas, Tareas</span>
			<span><kbd>/</kbd> Ir a escribir o buscar</span>
			<span><kbd>X</kbd> Completar una tarea</span>
			<span><kbd>← →</kbd> Pasar diapositivas o tablones</span>
		</span>
	</button>
{/if}
<div class="marco">
	{#if oficina?.simulacion}<p class="sim">Simulación: empresa y correos inventados</p>{/if}
	{#if aviso}<p class="aviso">{aviso}</p>{/if}
	<main>
		{#if pant === 'sala'}{#key partes[1]}<Sala hilo={decodeURIComponent(partes[1])} />{/key}
		{:else if pant === 'tareas'}<Tareas {oficina} equipo={partes[1] ?? null} />
		{:else if pant === 'correo'}<Correo {oficina} />
		{:else if pant === 'reuniones'}<Reuniones {oficina} />
		{:else if pant === 'reunion'}{#key partes[1]}<Reunion id={partes[1]} />{/key}
		{:else if pant === 'aprendido'}<Aprendido />
		{:else if pant === 'lean'}<Lean />
		{:else if pant === 'charlas'}<Charlas />
		{:else}<Oficina {oficina} registraTeclas={f => { manejadorOficina = f; }} />{/if}
	</main>
	{#if !presenta}
		<nav aria-label="Secciones">
			<a href="#/" class:activo={pant === 'oficina'}>Oficina</a>
			<a href="#/sala/general" class:activo={julian}>Julián</a>
			<a href="#/charlas" class:activo={pant === 'charlas'}>Charlas{#if oficina?.hablando}<span class="punto" aria-label="Están hablando"></span>{/if}</a>
			<a href="#/tareas" class:activo={pant === 'tareas'}>Tareas{#if oficina?.sies}<span class="globo num">{oficina.sies}</span>{/if}</a>
		</nav>
	{/if}
</div>

<style>
	.marco { height: 100%; display: flex; flex-direction: column; }
	main { flex: 1; min-height: 0; }
	nav { background: var(--negro); color: var(--papel); display: flex; justify-content: center; gap: 4px; padding: 6px 8px max(6px, env(safe-area-inset-bottom)); }
	nav a { flex: 1; max-width: 200px; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; text-decoration: none; opacity: .6; }
	nav a.activo { opacity: 1; font-weight: 700; }
	.ayuda { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; width: 100%; }
	.caja { background: var(--papel); border-radius: 16px; padding: 18px 22px; display: flex; flex-direction: column; gap: 8px; color: var(--negro); }
	.caja b { font-size: 22px; font-weight: 800; }
	kbd { font-family: var(--marca-font-numbers); font-weight: 700; background: #fff; border-radius: 6px; padding: 1px 7px; box-shadow: 0 1px 0 var(--linea); }
	.punto { width: 8px; height: 8px; border-radius: 4px; background: #6dff8a; }
	.globo { background: var(--amarillo); color: var(--negro); font-size: 13px; font-weight: 700; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
	.sim { background: #2f7f8f; color: #fff; text-align: center; font-size: 13px; font-weight: 700; padding: max(3px, env(safe-area-inset-top)) 8px 3px; }
	.aviso { background: var(--amarillo); color: var(--negro); padding: max(8px, env(safe-area-inset-top)) 16px 8px; font-weight: 500; font-size: 15px; }
</style>
