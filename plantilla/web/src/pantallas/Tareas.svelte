<script>
	import { onMount } from 'svelte';
	import { lee, manda, escucha, diasHasta, fechaCorta, formato, activarAvisos } from '../lib/api.js';
	import Retrato from '../lib/Retrato.svelte';

	let { oficina, equipo = null } = $props();
	let edicion = $state({}), pide = $state({}), seguro = $state(null);
	// Aprobar envía de verdad: un segundo toque, para que un Enter o un dedo no lo mande sin querer.
	let desde = 0;
	const enlacesDe = t => [...String(t).matchAll(/\S*(?:https?:\/\/|www\.)\S+/gi)].map(m => m[0]);
	const apruebaCampana = t => {
		if (seguro !== t.id) { seguro = t.id; desde = Date.now(); setTimeout(() => { if (seguro === t.id) seguro = null; }, 6000); return; }
		if (Date.now() - desde < 700) return;
		seguro = null;
		accion(t, { accion: 'aprobar' });
	};
	const aprueba = (t, d) => {
		if (seguro !== t.id) { seguro = t.id; desde = Date.now(); setTimeout(() => { if (seguro === t.id) seguro = null; }, 6000); return; }
		// Un doble toque no vale como segundo toque.
		if (Date.now() - desde < 700) return;
		seguro = null;
		accion(t, { accion: 'aprobar', texto: edicion[t.id] ?? d.texto });
	};
	let mias = $state({ abiertas: [], hechas: [] }), tablones = $state(null), error = $state(''), nueva = $state(''), abierta = $state(null), verHechas = $state(false), doc = $state(''), avisos = $state('');
	const carga = async () => {
		try {
			if (equipo) tablones = await lee('/api/tablones');
			else mias = await lee('/api/tareas');
		} catch (e) { error = e.message; }
	};
	onMount(() => escucha(e => { if (['tarea', 'conectado'].includes(e.tipo)) carga(); }));
	$effect(() => { equipo; carga(); });

	const COLUMNAS = [['por_hacer', 'Por hacer'], ['en_curso', 'En curso'], ['bloqueada', 'Bloqueada'], ['hecha', 'Hecha']];
	const elTablon = $derived(tablones?.equipos.find(e => e.id === equipo));
	const NOMBRE = { produccion: 'Producción', marketing: 'Marketing', finanzas: 'Finanzas', fiscal: 'Fiscal', legal: 'Legal', general: 'Dirección' };
	// Los que se funden luego salen de la plantilla, antes de Dirección.
	const nuevos = $derived((oficina?.salas ?? []).filter(s => !NOMBRE[s.id]));
	const EQUIPOS = $derived([...Object.keys(NOMBRE).slice(0, -1), ...nuevos.map(s => s.id), 'general']);
	const nombreDe = e => NOMBRE[e] ?? nuevos.find(s => s.id === e)?.nombre ?? e;
	const cuando = d => { const n = diasHasta(d); return n < 0 ? fechaCorta(d) : n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : fechaCorta(d); };

	async function accion(t, cuerpo) {
		error = '';
		try {
			const j = await manda(`/api/tareas/${t.id}`, cuerpo);
			if (j.hilo) { location.hash = `#/sala/${encodeURIComponent(j.hilo)}`; return; }
			await carga();
		} catch (e) { error = e.message; }
	}
	async function anade(ev) {
		ev.preventDefault();
		if (!nueva.trim()) return;
		try { await manda('/api/tareas', { titulo: nueva, equipo: equipo ?? 'alex' }); nueva = ''; await carga(); } catch (e) { error = e.message; }
	}
	async function abre(t) {
		if (abierta === t.id) { abierta = null; return; }
		abierta = t.id; doc = '';
		if (t.documento) { try { doc = (await lee(`/api/tareas/${t.id}/documento`)).texto; } catch {} }
	}
	const puedeAvisar = typeof Notification !== 'undefined' && 'PushManager' in window && Notification.permission !== 'granted';
	async function activar() { try { await activarAvisos(oficina.vapid); avisos = 'Avisos activados.'; } catch (e) { avisos = e.message; } }
</script>

<div class="pantalla"><div class="ancho" class:ancha={!!equipo}>
	<div class="pestanas" role="navigation" aria-label="Listas">
		<a href="#/tareas" class:activa={!equipo}>Mías</a>
		{#each EQUIPOS as e}<a href={`#/tareas/${e}`} class:activa={equipo === e}>{nombreDe(e)}</a>{/each}
	</div>
	{#if error}<p class="mensaje-error">{error}</p>{/if}

	<form onsubmit={anade}>
		<input class="campo" bind:value={nueva} placeholder={equipo ? `Tarea para ${nombreDe(equipo)}` : 'Añade una tarea'} aria-label="Nueva tarea" />
	</form>

	{#if !equipo}
		<ul>
			{#each mias.abiertas as t (t.id)}
				<li class:si={t.tipo !== 'tarea'}>
					{#if t.tipo === 'correo'}
						{@const d = JSON.parse(t.datos)}
						<div class="correo">
							<p class="nota peq">{d.quien} quiere contestar. Lo ha repasado Marga{d.desde?.startsWith('legal') ? '. Desde Legal no sale nada: es para copiar' : ''}.</p>
							<p class="tit">{d.asunto || 'Sin asunto'}</p>
							<p class="nota peq">Para {d.para}</p>
							{#if d.aviso}<p class="aviso-correo">{d.aviso}</p>{/if}
							{#if enlacesDe(edicion[t.id] ?? d.texto).length}<p class="aviso-correo">Lleva enlaces: {enlacesDe(edicion[t.id] ?? d.texto).join(', ')}</p>{/if}
							<textarea class="campo" rows={Math.max(6, (edicion[t.id] ?? d.texto).split('\n').reduce((n, l) => n + 1 + Math.floor(l.length / 60), 1))} aria-label="Texto del correo" value={edicion[t.id] ?? d.texto} oninput={e => (edicion[t.id] = e.target.value)}></textarea>
							<div class="acciones">
								<button class="boton" onclick={() => aprueba(t, d)}>{seguro === t.id ? `Sí, enviar a ${d.para}` : d.desde?.startsWith('legal') ? 'Aprobar' : 'Aprobar y enviar'}</button>
								<button class="boton texto" onclick={() => accion(t, { accion: 'descartar' })}>Descartar</button>
							</div>
							<form class="cambiar" onsubmit={e => { e.preventDefault(); accion(t, { accion: 'cambiar', nota: pide[t.id] }); pide[t.id] = ''; }}>
								<input class="campo" placeholder="Dile a Marga qué cambiar" aria-label="Qué cambiar" value={pide[t.id] ?? ''} oninput={e => (pide[t.id] = e.target.value)} />
							</form>
						</div>
					{:else if t.tipo === 'campana'}
						{@const d = JSON.parse(t.datos)}
						<div class="correo">
							<p class="nota peq">{d.quien} lo ha preparado{d.ajeno ? '. Ha nacido viendo algo de fuera: míralo bien' : ''}.</p>
							<p class="tit">{d.verbo} en Meta</p>
							{#if d.porque}<p>{d.porque}</p>{/if}
							<ul class="cambio">{#each d.lineas as l}<li class:dinero={l.dinero}>{l.texto}</li>{/each}</ul>
							{#if d.yaHecha}<p class="aviso-correo">Esto mismo ya se tramitó el {d.yaHecha}.</p>{/if}
							<details open={d.raro}><summary class="nota peq">La llamada exacta</summary><pre class="llamada">{JSON.stringify(d.args, null, 1)}</pre></details>
							{#if d.aprendizaje}<details><summary class="nota peq">Lo que dice el aprendizaje</summary><pre class="llamada">{d.aprendizaje}</pre></details>{/if}
							<div class="acciones">
								<button class="boton" onclick={() => apruebaCampana(t)}>{seguro === t.id ? 'Sí, aplicarlo' : d.gasta ? 'Aprobar: gasta dinero' : 'Aprobar y aplicar'}</button>
								<button class="boton texto" onclick={() => accion(t, { accion: 'descartar' })}>Descartar</button>
							</div>
						</div>
					{:else if t.tipo === 'subida'}
						{@const d = JSON.parse(t.datos)}
						<div class="correo">
							<p class="nota peq">Nico: {d.nombre} tiene commits sin subir.</p>
							<p class="tit">{t.titulo}</p>
							<p class="nota peq">A {d.remoto}, rama {d.rama}. {d.archivos}</p>
							{#if d.clave}<p class="aviso-correo">Parece llevar una clave. No se puede subir hasta sacarla.</p>{/if}
							{#if !d.revisado}<p class="aviso-correo">Es demasiado grande para revisar si lleva alguna clave.</p>{/if}
							<details><summary class="nota peq">Qué se sube</summary><pre class="llamada">{d.commits.join('\n')}{d.n > d.commits.length ? `\n...y ${d.n - d.commits.length} más` : ''}</pre></details>
							<div class="acciones">
								{#if !d.clave}<button class="boton" onclick={() => apruebaCampana(t)}>{seguro === t.id ? 'Sí, subirlo' : 'Subir'}</button>{/if}
								<button class="boton texto" onclick={() => accion(t, { accion: 'descartar' })}>Ahora no</button>
							</div>
						</div>
					{:else if t.tipo === 'si'}
						<div class="fila"><span class="tit">{t.titulo}</span></div>
						{#if t.detalle}<p class="nota">{t.detalle}</p>{/if}
						<div class="acciones"><button class="boton" onclick={() => accion(t, { accion: 'si' })}>Sí</button><button class="boton discreto" onclick={() => accion(t, { accion: 'no' })}>No</button></div>
					{:else}
						<div class="fila">
							<button class="check" aria-label={`Completar: ${t.titulo}`} onclick={() => accion(t, { accion: 'hecha' })}></button>
							<button class="tit" data-fila aria-expanded={abierta === t.id} onclick={() => abre(t)}>{t.titulo}{#if t.nota}<span class="tiene-nota" aria-label="Tiene nota"> *</span>{/if}</button>
							{#if t.fecha}<span class="fecha num" class:cerca={diasHasta(t.fecha) <= 2}>{cuando(t.fecha)}</span>{/if}
						</div>
						{#if abierta === t.id}
							<div class="detalle">
								{#if t.detalle}<p class="nota">{t.detalle}</p>{/if}
								<textarea class="campo" rows="2" placeholder="Nota" aria-label="Nota" value={t.nota ?? ''} onblur={e => { if (e.target.value !== (t.nota ?? '')) accion(t, { accion: 'nota', nota: e.target.value }); }}></textarea>
								<div class="acciones">
									<button class="boton discreto" onclick={() => accion(t, { accion: 'hablar' })}>Hablarlo</button>
									{#if t.enlace}<a class="boton texto" href={t.enlace} target="_blank" rel="noopener noreferrer">Abrir</a>{/if}
									<button class="boton texto" onclick={() => accion(t, { accion: 'borrar' })}>Borrar</button>
								</div>
							</div>
						{/if}
					{/if}
				</li>
			{:else}
				<li class="vacio">Nada pendiente.</li>
			{/each}
		</ul>
		{#if mias.hechas.length}
			<button class="boton texto" onclick={() => (verHechas = !verHechas)} aria-expanded={verHechas}>Hechas</button>
			{#if verHechas}
				<ul class="hechas">
					{#each mias.hechas as t (t.id)}
						<li><div class="fila">{#if t.tipo === 'tarea'}<button class="check marcado" aria-label={`Reabrir: ${t.titulo}`} onclick={() => accion(t, { accion: 'reabrir' })}></button>{/if}<span class="tit">{t.titulo}</span></div></li>
					{/each}
				</ul>
			{/if}
		{/if}
		{#if puedeAvisar && oficina?.vapid}<p class="pie"><button class="boton texto" onclick={activar}>Activar avisos en este dispositivo</button> {avisos}</p>{/if}
	{:else if elTablon}
		<div class="equipo">{#each elTablon.personas as p (p.hilo)}<a href={`#/sala/${encodeURIComponent(p.hilo)}`} aria-label={p.nombre}><Retrato look={p.look} tam={32} /></a>{/each}<span class="nota num">{tablones.sprint}</span></div>
		<div class="tablon">
			{#each COLUMNAS as [id, nombre]}
				<section>
					<h2>{nombre} <span class="nota num">{elTablon.columnas[id].length || ''}</span></h2>
					{#each elTablon.columnas[id] as t (t.id)}
						<article class:alta={t.prioridad === 'alta'}>
							<button class="tit" data-fila aria-expanded={abierta === t.id} onclick={() => abre(t)}>{t.titulo}</button>
							{#if abierta === t.id}
								{#if t.resultado}<p class="nota res">{t.resultado}</p>{/if}
								{#if doc}<div class="doc">{@html formato(doc)}</div>{/if}
								<div class="acciones">
									{#if id === 'bloqueada' || id === 'hecha'}<button class="boton texto" onclick={() => accion(t, { accion: 'reabrir' })}>Reabrir</button>{/if}
									{#if id === 'por_hacer'}<button class="boton texto" onclick={() => accion(t, { accion: 'mover', estado: 'bloqueada' })}>Bloquear</button>{/if}
									<button class="boton texto" onclick={() => accion(t, { accion: 'borrar' })}>Borrar</button>
								</div>
							{/if}
						</article>
					{/each}
				</section>
			{/each}
		</div>
	{/if}
</div></div>

<style>
	.cambio { margin: 4px 0; padding-left: 1.1em; }
	.cambio .dinero { font-weight: 700; font-size: 18px; }
	.llamada { font-family: var(--marca-font-numbers); font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; background: #fff; border-radius: 8px; padding: 8px; max-height: 260px; overflow: auto; }
	.aviso-correo { font-size: 14px; font-weight: 600; background: #f8e7b8; border-radius: 8px; padding: 4px 8px; margin: 2px 0; overflow-wrap: anywhere; }
	.ancho.ancha { max-width: 1100px; }
	.pestanas { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 12px; white-space: nowrap; scrollbar-width: none; }
	.pestanas a { text-decoration: none; color: var(--apagado); min-height: 32px; display: inline-flex; align-items: center; }
	.pestanas a.activa { color: var(--negro); font-weight: 800; font-size: 19px; }
	form { margin-bottom: 8px; }
	ul { list-style: none; margin: 0; padding: 0; }
	li { padding: 10px 0; border-bottom: 1px solid var(--linea); }
	[data-fila]:focus-visible { outline: 3px solid var(--amarillo); outline-offset: 2px; border-radius: 4px; }
	.fila { display: flex; align-items: center; gap: 10px; }
	.check { width: 26px; height: 26px; flex: none; border: 2px solid var(--negro); border-radius: 50%; position: relative; }
	.check::after { content: ''; position: absolute; inset: -9px; }
	.check.marcado { background: var(--negro); box-shadow: inset 0 0 0 4px var(--papel); }
	.tit { flex: 1; min-width: 0; overflow-wrap: anywhere; line-height: 1.25; }
	.si { background: #fff4d6; border-radius: 12px; padding: 12px; margin: 8px 0; border: 0; }
	.si .tit { font-weight: 700; }
	.peq { font-size: 14px; }
	.correo { display: flex; flex-direction: column; gap: 6px; }
	.correo textarea { resize: vertical; border-width: 1px; }
	.cambiar { margin: 0; }
	.cambiar input { border-width: 1px; font-size: 15px; padding: 8px 12px; }
	.si .acciones { margin-top: 8px; }
	.fecha { font-size: 14px; color: var(--apagado); white-space: nowrap; }
	.fecha.cerca { color: #c9302c; font-weight: 700; }
	.tiene-nota { color: var(--apagado); }
	.detalle { padding: 8px 0 2px 36px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; }
	.hechas .tit { color: var(--apagado); text-decoration: line-through; }
	.pie { margin-top: 24px; font-size: 14px; }
	.equipo { display: flex; align-items: center; gap: 4px; margin: 6px 0 12px; flex-wrap: wrap; }
	.equipo .nota { margin-left: auto; font-size: 14px; }
	.tablon { display: grid; grid-template-columns: 1fr; gap: 14px; }
	@media (min-width: 800px) { .tablon { grid-template-columns: repeat(4, 1fr); align-items: start; } }
	section h2 { font-size: 16px; margin-bottom: 6px; }
	article { background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 6px; font-size: 15px; }
	article.alta { box-shadow: inset 3px 0 0 var(--amarillo); }
	article .tit { display: block; width: 100%; }
	.res { margin-top: 6px; font-size: 14px; }
	.doc { margin-top: 6px; font-size: 14px; max-height: 340px; overflow-y: auto; overflow-wrap: anywhere; }
	.doc :global(p + p) { margin-top: .5em; }
</style>
