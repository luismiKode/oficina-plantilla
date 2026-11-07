<script>
	import { onMount, onDestroy } from 'svelte';
	import { lee, manda, escucha, formato, cuandoFue } from '../lib/api.js';
	import Retrato from '../lib/Retrato.svelte';

	let { id } = $props();
	let r = $state(null), error = $state(''), i = $state(-1);
	let contando = $state(false), cargandoVoz = $state(false), verChat = $state(false), verTexto = $state(false);
	let nota = $state(''), opinion = $state(''), opinada = $state(false);
	let audio;

	const carga = async () => { try { r = await lee(`/api/reuniones/${id}`); } catch (e) { error = e.message; } };
	onMount(() => { carga(); return escucha(e => { if ((e.tipo === 'reunion' && e.id === Number(id)) || e.tipo === 'conectado') carga(); }); });
	onDestroy(() => { audio?.pause(); });

	const deck = $derived(r?.deck);
	const lista = $derived(['lista', 'decidida'].includes(r?.estado) && deck?.diapositivas?.length);
	const n = $derived(deck?.diapositivas?.length ?? 0);
	const dia = $derived(i >= 0 && i < n ? deck.diapositivas[i] : null);
	const enDecision = $derived(deck && i === n);
	const FASES = [['preparando', 'Cada uno prepara su aporte'], ['mesa', 'Lo hablan en la mesa'], ['redactando', 'Se redacta la presentación'], ['revisando', 'Bea la revisa'], ['lista', 'Te avisan']];
	const faseN = $derived(FASES.findIndex(f => f[0] === r?.estado));
	// Quien convoca suele asistir también: cada persona, una vez.
	const participantes = $derived(r ? [r.convoca, ...r.asistentes].filter((a, k, t) => t.findIndex(x => x.hilo === a.hilo) === k) : []);

	function detiene() { audio?.pause(); contando = false; cargandoVoz = false; }
	function ve(x) { detiene(); i = Math.max(-1, Math.min(n, x)); }

	function suena(k) {
		if (k >= n) { contando = false; i = n; return; }
		i = k;
		cargandoVoz = true;
		audio.src = `/api/reuniones/${id}/audio/${k}`;
		audio.play().catch(() => { contando = false; cargandoVoz = false; });
		// Se pide ya la siguiente, para que no haya silencio entre diapositivas
		if (k + 1 < n) fetch(`/api/reuniones/${id}/audio/${k + 1}`, { headers: { 'x-oficina': '1' } }).catch(() => {});
	}
	function cuenta() {
		error = '';
		if (contando) return detiene();
		audio ??= crearAudio();
		contando = true;
		suena(i < 0 || i >= n ? 0 : i);
	}
	function crearAudio() {
		const a = new Audio();
		a.preload = 'auto';
		a.onplaying = () => { cargandoVoz = false; };
		a.onended = () => { if (contando) suena(i + 1); };
		a.onerror = () => { if (!contando) return; contando = false; cargandoVoz = false; error = 'No se ha podido generar la voz. Puedes leerla con las flechas.'; };
		return a;
	}
	const tecla = e => {
		if (!lista) return;
		if (e.target?.tagName === 'INPUT') return;
		if (e.key === 'ArrowRight') { e.preventDefault(); ve(i + 1); }
		if (e.key === 'ArrowLeft') { e.preventDefault(); ve(i - 1); }
		// Espacio cuenta la reunión, salvo si estás sobre un botón: entonces lo pulsa.
		if (e.key === ' ' && r?.hayVoz && !['BUTTON', 'A'].includes(document.activeElement?.tagName)) { e.preventDefault(); cuenta(); }
	};
	async function accion(cuerpo) {
		error = '';
		try { await manda(`/api/reuniones/${id}`, cuerpo); await carga(); } catch (e) { error = e.message; }
	}
	async function opinar(ev) {
		ev.preventDefault();
		await accion({ accion: 'opinar', texto: opinion });
		if (!error) { opinion = ''; opinada = true; }
	}
	const presenta = $derived(dia?.presenta ?? r?.convoca);
</script>

<svelte:window onkeydown={tecla} />

<div class="reunion" class:oscura={i === n && lista}>
	<header>
		<a class="salir" href="#/reuniones">Salir</a>
		{#if lista}
			<div class="tramos" aria-label="Diapositiva {i + 2} de {n + 2}">
				{#each Array(n + 2) as _, k}<button data-sin-parada class:hecho={k <= i + 1} onclick={() => ve(k - 1)} aria-label="Ir a la diapositiva {k + 1}"></button>{/each}
			</div>
		{/if}
		<button class="boton texto" onclick={() => (verChat = !verChat)} aria-expanded={verChat}>{verChat ? 'Volver' : 'Lo hablado'}</button>
	</header>

	{#if error}<p class="mensaje-error margen">{error}</p>{/if}

	{#if verChat || (r && !lista)}
		<div class="detras">
			<div class="ancho">
				{#if r && !lista}
					<h1>{r.tema}</h1>
					{#if r.estado === 'resuelta'}
						<p class="resuelta">{deck?.resumen}</p>
						{#if deck?.tareas?.length}<ul class="salen">{#each deck.tareas as t}<li>{t.titulo}</li>{/each}</ul>{/if}
					{:else if r.estado === 'atascada'}
						<p class="mensaje-error">Se ha atascado: {r.error}</p>
						<button class="boton" onclick={() => accion({ accion: 'seguir' })}>Seguir desde donde iba</button>
					{:else}
						<ol class="fases">
							{#each FASES as [f, t], k}<li class:ya={k < faseN} class:ahora={k === faseN}>{t}{#if f === 'mesa' && k === faseN}, ronda <span class="num">{r.ronda}</span>{/if}{#if f === 'redactando' && r.iteracion > 0 && k === faseN}, versión <span class="num">{r.iteracion + 1}</span>{/if}</li>{/each}
						</ol>
						<div class="reunidos">{#each participantes as a (a.hilo)}<Retrato look={a.look} tam={40} />{/each}</div>
					{/if}
				{/if}
				<h2 class="chat-titulo">Lo hablado</h2>
				{#each r?.chat ?? [] as m (m.id)}
					<div class="mensaje" class:revision={m.tipo === 'revision'} class:alex={m.de_hilo === 'alex'}>
						<Retrato look={m.de.look} tam={36} />
						<div>
							<p class="de">{m.de.nombre}{#if m.tipo === 'aporte'}, su aporte{:else if m.ronda && m.tipo === 'mesa'}, ronda {m.ronda}{/if} <span class="nota">{cuandoFue(m.creado)}</span></p>
							<div class="txt">{@html formato(m.texto)}</div>
						</div>
					</div>
				{:else}<p class="nota">Aún no han dicho nada.</p>{/each}
			</div>
		</div>
	{:else if lista}
		<div class="escena">
			{#if i === -1}
				<div class="diapo portada">
					<h1>{deck.titulo}</h1>
					<p class="resumen">{deck.resumen}</p>
					<div class="asistentes">
						{#each participantes as a (a.hilo)}<span><Retrato look={a.look} tam={52} />{a.nombre}</span>{/each}
					</div>
					{#if r.nota_revisora}<p class="bea"><strong>Bea:</strong> {r.nota_revisora}</p>{/if}
				</div>
			{:else if dia}
				<div class="diapo">
					<h1>{dia.titulo}</h1>
					{#if dia.cifras?.length}
						<div class="cifras">{#each dia.cifras as c}<div><p class="valor num">{c.valor}</p><p>{c.etiqueta}</p><p class="fuente">{c.fuente}</p></div>{/each}</div>
					{/if}
					{#if dia.puntos?.length}<ul>{#each dia.puntos as p}<li>{p}</li>{/each}</ul>{/if}
					{#if verTexto}<p class="narracion">{dia.narracion}</p>{/if}
				</div>
			{:else if enDecision}
				<div class="diapo decision">
					<h1>{deck.decision.pregunta}</h1>
					{#if deck.decision.por_que}<p class="resumen">{deck.decision.por_que}</p>{/if}
					<div class="opciones">
						{#each deck.decision.opciones as o (o.nombre)}
							<button class="opcion" class:recomendada={o.nombre === deck.decision.recomendacion} class:elegida={r.decision?.opcion === o.nombre} disabled={!!r.decision} onclick={() => accion({ accion: 'decidir', opcion: o.nombre, nota })}>
								<span class="n">{o.nombre}</span>
								{#if o.efecto}<span class="e">{o.efecto}</span>{/if}
								{#if o.nombre === deck.decision.recomendacion}<span class="e rec">Lo que recomiendan</span>{/if}
							</button>
						{/each}
					</div>
					{#if r.decision}<p class="resumen">Decidido: {r.decision.opcion}. Se lo han contado a {r.convoca.nombre}.</p>
					{:else}<input class="campo" bind:value={nota} placeholder="Añade algo si quieres" aria-label="Nota para tu decisión" />{/if}
					<form class="opina" onsubmit={opinar}>
						<label for="opinion">¿Qué te ha parecido? Bea toma nota</label>
						<div class="fila">
							<input id="opinion" class="campo" bind:value={opinion} placeholder="Sobraba la diapositiva 3" />
							<button class="boton discreto" disabled={!opinion.trim()}>Decírselo</button>
						</div>
						{#if opinada}<p>Se lo paso a <a href="#/sala/general%3Arevisora">Bea</a>.</p>{/if}
					</form>
				</div>
			{/if}
			{#if presenta && dia}
				<div class="presenta" aria-hidden="true">
					<span class="cara" class:habla={contando}><Retrato look={presenta.look} tam={84} /></span>
					<span>{presenta.nombre}</span>
				</div>
			{/if}
		</div>
		<footer>
			<button class="boton discreto" onclick={() => ve(i - 1)} disabled={i < 0}>Atrás</button>
			{#if r.hayVoz}<button class="boton" onclick={cuenta}>{cargandoVoz ? 'Preparando la voz' : contando ? 'Parar' : 'Cuéntamela'}</button>{/if}
			{#if dia}<button class="boton texto" onclick={() => (verTexto = !verTexto)} aria-pressed={verTexto}>{verTexto ? 'Ocultar el texto' : 'Leer lo que cuenta'}</button>{/if}
			<button class="boton discreto seguir" onclick={() => ve(i + 1)} disabled={i >= n}>Siguiente</button>
		</footer>
	{/if}
</div>

<style>
	.reunion { height: 100%; display: flex; flex-direction: column; background: var(--papel); }
	.cara { display: block; }
	.cara.habla { animation: hablar .5s steps(2) infinite; }
	@keyframes hablar { 50% { transform: translateY(-2px); } }
	@media (prefers-reduced-motion: reduce) { .cara.habla { animation: none; } }
	.resuelta { font-size: 22px; line-height: 1.25; margin-bottom: 12px; }
	.salen li { font-size: 17px; }
	header { display: flex; align-items: center; gap: 12px; padding: max(8px, env(safe-area-inset-top)) 20px 8px; }
	.salir { font-size: 15px; white-space: nowrap; }
	.tramos { flex: 1; display: flex; gap: 4px; }
	.tramos button { flex: 1; height: 26px; position: relative; }
	.tramos button::after { content: ''; position: absolute; left: 0; right: 0; top: 10px; height: 6px; border-radius: 3px; background: var(--linea); }
	.tramos button.hecho::after { background: var(--negro); }
	header > .boton { margin-left: auto; font-size: 15px; }
	.margen { margin: 0 20px; }

	.escena { flex: 1; min-height: 0; position: relative; overflow-y: auto; padding: 14px 24px 12px; }
	.diapo { max-width: 1040px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; min-height: 100%; justify-content: center; padding-bottom: 110px; }
	.diapo h1 { font-size: clamp(34px, 6.4vw, 76px); max-width: 17ch; text-wrap: balance; }
	.portada h1 { font-size: clamp(42px, 8vw, 96px); }
	.resumen { font-size: clamp(20px, 2.6vw, 30px); line-height: 1.22; max-width: 34ch; }
	ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; max-width: 34em; }
	li { font-size: clamp(20px, 2.5vw, 28px); line-height: 1.2; padding-left: 22px; position: relative; }
	li::before { content: ''; position: absolute; left: 0; top: .42em; width: 10px; height: 10px; border-radius: 50%; background: var(--amarillo); }
	.cifras { display: flex; flex-wrap: wrap; gap: 14px 40px; }
	.valor { font-size: clamp(44px, 7vw, 84px); font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
	.fuente { font-size: 14px; color: var(--apagado); }
	.narracion { background: #fff; padding: 12px 16px; border-radius: 14px; max-width: 42em; }
	.asistentes { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 14px; font-weight: 500; }
	.asistentes > span { display: flex; flex-direction: column; align-items: center; width: 62px; text-align: center; }
	.bea { max-width: 44em; padding-left: 14px; border-left: 6px solid var(--linea); }
	.presenta { position: fixed; right: 16px; bottom: 76px; display: flex; flex-direction: column; align-items: center; font-weight: 700; font-size: 14px; pointer-events: none; }

	.decision { padding-bottom: 20px; justify-content: flex-start; gap: 16px; }
	.opciones { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
	.opcion { padding: 16px; border-radius: 18px; box-shadow: inset 0 0 0 3px var(--negro); display: flex; flex-direction: column; gap: 4px; min-height: 92px; }
	.opcion .n { font-weight: 800; font-size: 22px; line-height: 1.1; }
	.opcion .e { font-size: 15px; }
	.opcion .rec { font-weight: 700; }
	.opcion.recomendada { background: var(--amarillo); }
	.opcion.elegida { background: var(--negro); color: var(--suelo); }
	.opcion:disabled { cursor: default; }
	.opcion:disabled:not(.elegida) { opacity: .4; }
	.opina { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
	.opina label { font-weight: 700; }
	.fila { display: flex; gap: 8px; }

	footer { display: flex; align-items: center; gap: 8px; padding: 8px 20px max(10px, env(safe-area-inset-bottom)); flex-wrap: wrap; }
	.seguir { margin-left: auto; }

	.detras { flex: 1; overflow-y: auto; padding: 12px 24px 40px; }
	.ancho { max-width: 760px; margin-inline: auto; }
	.detras h1 { font-size: clamp(30px, 5vw, 48px); margin-bottom: 14px; }
	.fases { margin: 0; padding-left: 1.3em; display: flex; flex-direction: column; gap: 4px; font-size: 19px; }
	.fases li { font-size: 19px; color: var(--apagado); padding: 0; }
	.fases li::before { display: none; }
	.fases .ya { text-decoration: line-through; }
	.fases .ahora { color: var(--negro); font-weight: 800; }
	.reunidos { display: flex; flex-wrap: wrap; margin: 12px 0; }
	.chat-titulo { font-size: 22px; margin: 22px 0 8px; }
	.mensaje { display: grid; grid-template-columns: 36px 1fr; gap: 8px; padding: 8px 0; }
	.de { font-weight: 700; font-size: 15px; }
	.de .nota { font-weight: 400; }
	.txt { overflow-wrap: anywhere; }
	.txt :global(p + p) { margin-top: .5em; }
	.txt :global(ul) { gap: 2px; font-size: inherit; padding-left: 1em; list-style: disc; }
	.txt :global(li) { font-size: inherit; padding: 0; }
	.txt :global(li::before) { display: none; }
	.revision .txt { background: #fff; padding: 8px 12px; border-radius: 12px; }
	@media (max-width: 899px) { .diapo { padding-bottom: 130px; } .presenta { bottom: 118px; } }
</style>
