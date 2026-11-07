<script>
	import { onMount } from 'svelte';
	import { lee, manda, cuandoFue } from '../lib/api.js';

	let lecciones = $state([]), texto = $state(''), enviado = $state(false), error = $state('');
	const carga = async () => { try { lecciones = await lee('/api/lecciones'); } catch (e) { error = e.message; } };
	onMount(carga);
	const AMBITO = { revisora: 'Para Bea', todos: 'Para todos', produccion: 'Para Producción', marketing: 'Para Marketing', finanzas: 'Para Finanzas', fiscal: 'Para Fiscal', legal: 'Para Legal', recepcion: 'Para Recepción' };
	const quitar = async l => { await manda(`/api/lecciones/${l.id}`, { accion: 'quitar' }); carga(); };
	async function opina(ev) {
		ev.preventDefault();
		error = '';
		try { await manda('/api/opinion', { texto }); texto = ''; enviado = true; } catch (e) { error = e.message; }
	}
</script>

<div class="pantalla"><div class="ancho">
	<h1 class="titulo-pantalla">Lo que ha aprendido Bea</h1>
	{#if error}<p class="mensaje-error">{error}</p>{/if}
	<form onsubmit={opina}>
		<label for="crit">Qué te ha parecido lo último</label>
		<textarea id="crit" class="campo" rows="2" bind:value={texto} placeholder="Infumable: largo y sin decisión"></textarea>
		<div class="acciones"><button class="boton" disabled={!texto.trim()}>Decírselo</button>{#if enviado}<span>Te contesta en <a href="#/sala/general%3Arevisora">su chat</a>.</span>{/if}</div>
	</form>
	{#each lecciones as l (l.id)}
		<article>
			<div>
				<p class="ambito">{AMBITO[l.ambito] ?? l.ambito}, {cuandoFue(l.creado)}</p>
				<p class="txt">{l.texto}</p>
				{#if l.opinion}<p class="nota">Dijiste: «{l.opinion}»</p>{/if}
			</div>
			<button class="boton texto" onclick={() => quitar(l)}>Quitar</button>
		</article>
	{:else}
		<div class="vacio">Aún no le has enseñado nada.</div>
	{/each}
</div></div>

<style>
		form { margin: 18px 0; display: flex; flex-direction: column; gap: 6px; }
	label { font-weight: 700; }
	article { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid var(--linea); }
	.ambito { font-size: 14px; color: var(--apagado); }
	.txt { font-weight: 500; font-size: 19px; line-height: 1.22; }
</style>
