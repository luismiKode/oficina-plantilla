// Comprueba contra el Claude real qué herramientas tiene cada agente en cada modo, y que nadie pueda enviar.
// Lanza cada perfil con los mismos argumentos que la Oficina y lo corta en cuanto dice qué tiene: no gasta un turno ni lee nada.
//   OFICINA_REAL=1 node scripts/auditar-permisos.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../server/config.mjs';
import { DEPARTAMENTOS, POR_ID } from '../server/departamentos.mjs';
import { EQUIPO, hiloDe } from '../server/equipo.mjs';
import { argsSala, argsObra, modoEncargo, argsCampanaAprobada, argsReunion, argsEncargo, argsRecepcion, argsEnvio, argsTexto, fueraDeLista } from '../server/perfiles.mjs';
import { configERP } from '../server/tareas.mjs';

const pluginsUsuario = Object.keys(JSON.parse(fs.readFileSync(path.join(CONFIG.CLAUDE_CONFIG_DIR, 'settings.json'), 'utf8')).enabledPlugins ?? {});
const dirTmp = fs.mkdtempSync('/tmp/ofi-audit-');
const mcpConfig = configERP(dirTmp);

// Nadie, en ningún modo, puede tener nada de esto.
const NUNCA = /send_message|__reply$|__forward$|schedule_message|send_message_draft|trash_|delete_|share_file|update_draft|update_event|create_event|respond_to_event|mutate|alta_factura|conciliar_factura|categorizar_movimiento|crear_regla|crear_escenario|fijar_presupuesto|importar_extracto|marcar_ola|^Bash$|^WebFetch$|^WebSearch$|^Edit$/;

function init(args, cwd) {
	return new Promise(resolve => {
		const h = spawn(CONFIG.CLAUDE_BIN, args, { cwd, env: { ...process.env, CLAUDE_CONFIG_DIR: undefined, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', ENABLE_TOOL_SEARCH: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
		let resto = '', hecho = false;
		const fin = r => { if (hecho) return; hecho = true; clearTimeout(t); h.kill('SIGKILL'); resolve(r); };
		const t = setTimeout(() => fin({ error: 'sin init en 60 s' }), 60_000);
		h.stdout.on('data', x => {
			resto += x;
			let i;
			while ((i = resto.indexOf('\n')) >= 0) {
				const l = resto.slice(0, i); resto = resto.slice(i + 1);
				try { const d = JSON.parse(l); if (d.type === 'system' && d.subtype === 'init') fin(d); } catch { /* otra línea */ }
			}
		});
		h.on('close', () => fin({ error: 'terminó sin init' }));
	});
}

// Julián y los directores tienen que ver lo suyo
const AGRUPA = [[/Gmail/, 'Gmail'], [/Calendar/, 'Agenda'], [/Drive/, 'Drive'], [/Slack/, 'Slack'], [/mi-erp/, 'ERP'], [/meta-ads/, 'Meta'], [/analytics-mcp/, 'GA4'], [/google-ads-mcp/, 'Google Ads']];
const servicios = tools => AGRUPA.filter(([re]) => tools.some(t => re.test(t))).map(([, n]) => n).join(' ') || '(ninguno)';

const casos = [];
for (const d of DEPARTAMENTOS) {
	for (const p of EQUIPO[d.id] ?? []) {
		const sinNada = ['revisora', 'correos', 'lean'].includes(p.nivel);
		casos.push({
			quien: `${p.nombre} (${hiloDe(d.id, p.rol)})`, modo: sinNada ? 'texto' : 'sala', dep: d.id, cwd: d.carpeta,
			args: sinNada ? argsTexto({ prompt: ' x', sistema: 's', persistir: false, modelo: 'haiku' }) : argsSala(d.id, { prompt: ' x', sistema: 's', rol: p.interna ? null : p.rol, modelo: 'haiku', pluginsUsuario }),
		});
	}
	casos.push({ quien: `${d.nombre}: reunión`, modo: 'reunion', dep: d.id, cwd: d.carpeta, args: argsReunion(d.id, { prompt: ' x', sistema: 's', carpeta: d.carpeta, mcpConfig, modelo: 'haiku' }) });
	casos.push({ quien: `${d.nombre}: encargo`, modo: 'encargo', dep: d.id, cwd: d.carpeta, args: argsEncargo(d.id, { prompt: ' x', sistema: 's', carpeta: d.carpeta, dirExpediente: dirTmp, mcpConfig, modelo: 'haiku' }) });
}
casos.push({ quien: 'Tere: pasada de correo', modo: 'recepcion', dep: 'recepcion', cwd: dirTmp, args: argsRecepcion({ prompt: ' x', pluginsUsuario, modelo: 'haiku' }) });
for (const [dep, rol] of [['marketing', 'investigador-referencias'], ['marketing', 'creadores'], ['legal', 'marca'], ['fiscal', 'normativa'], ['marketing', 'analista']]) casos.push({ quien: `Encargo de ${rol}`, modo: modoEncargo(rol), dep, cwd: POR_ID[dep].carpeta, args: argsEncargo(dep, { prompt: ' x', sistema: 's', carpeta: POR_ID[dep].carpeta, dirExpediente: dirTmp, mcpConfig, modelo: 'haiku', rol }) });
casos.push({ quien: 'Obra de Nico', modo: 'obra', dep: 'general', cwd: dirTmp, args: argsObra({ prompt: ' x', carpeta: dirTmp }) });
casos.push({ quien: 'Enviar lo aprobado', modo: 'envio', dep: 'general', cwd: dirTmp, args: argsEnvio({ prompt: ' x', pluginsUsuario }) });
casos.push({ quien: 'Aplicar un cambio aprobado de Meta', modo: 'campana-aprobada', dep: 'marketing', cwd: POR_ID.marketing.carpeta, args: argsCampanaAprobada({ herramienta: 'mcp__meta-ads__ads_update_entity', prompt: ' x' }), deja: ['mcp__meta-ads__ads_update_entity'] });

const faltan = new Map();
let malos = 0;
const paralelo = Number(process.env.A_LA_VEZ || 1);
const resultados = new Array(casos.length);
let siguiente = 0;
await Promise.all(Array.from({ length: paralelo }, async () => {
	while (siguiente < casos.length) {
		const i = siguiente++;
		const c = casos[i];
		const d = await init(c.args, c.cwd);
		if (d.error) { resultados[i] = { ...c, error: d.error }; continue; }
		resultados[i] = { ...c, tools: d.tools, modoPermisos: d.permissionMode, mcp: d.mcp_servers ?? [], fuera: fueraDeLista(d.tools, c.dep, c.modo).filter(t => !(c.deja ?? []).includes(t)), nunca: d.tools.filter(t => NUNCA.test(t) && !(c.modo === 'envio' && t.endsWith('Gmail__send_message')) && !(c.modo === 'encargo-web' && /^Web/.test(t)) && !(c.modo === 'encargo-datos' && /^(Bash|WebFetch)$/.test(t)) && !(c.modo === 'obra' && t === 'Bash' || /^(obra|encargo|encargo-datos)$/.test(c.modo) && t === 'Edit')) };
	}
}));

for (const r of resultados) {
	if (r.error) { malos++; console.log(`MAL  ${r.quien}: ${r.error}`); continue; }
	const errores = [];
	if (r.modoPermisos !== 'dontAsk') errores.push(`modo ${r.modoPermisos}`);
	if (r.fuera.length) errores.push(`fuera de lista: ${r.fuera.join(', ')}`);
	if (r.nunca.length) errores.push(`PROHIBIDAS: ${r.nunca.join(', ')}`);
	for (const s of r.mcp) if (s.status !== 'connected' && !/Notion|playwright|Docs/i.test(s.name)) faltan.set(s.name, s.status);
	if (errores.length) malos++;
	console.log(`${errores.length ? 'MAL ' : 'ok  '} ${r.quien.padEnd(42)} ${r.modo.padEnd(9)} ${servicios(r.tools)}${errores.length ? `  <<< ${errores.join(' | ')}` : ''}`);
}
console.log(`\n${resultados.length} perfiles comprobados, ${malos} con problemas.`);
console.log('Conexiones que no están activas:', faltan.size ? [...faltan].map(([n, s]) => `${n}: ${s}`).join(', ') : 'ninguna');
fs.rmSync(dirTmp, { recursive: true, force: true });
process.exit(malos ? 1 : 0);
