<script>
	import { pintaRetrato } from './escena.js';
	let { look, tam = 48 } = $props();
	let c;
	$effect(() => { if (c) pintaRetrato(c, look); });
</script>
<canvas bind:this={c} style={`width:${tam}px;height:${Math.round(tam * 15 / 14)}px`} aria-hidden="true"></canvas>
<style>canvas { image-rendering: pixelated; display: block; flex: none; }</style>
