// Permisos de la Oficina. Lista cerrada: lo que no está aquí no se puede usar.
// Probado contra `claude -p` real el 6-nov-2026. Por qué es así: spec, «Dos perfiles de permisos».
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { POR_ID } from './departamentos.mjs';
import { fileURLToPath } from 'node:url';

const G = 'mcp__claude_ai_Gmail__', C = 'mcp__claude_ai_Google_Calendar__', D = 'mcp__claude_ai_Google_Drive__';
const S = 'mcp__claude_ai_Slack__', E = 'mcp__mi-erp__', M = 'mcp__meta-ads__';

const GMAIL_LEER = ['search_threads', 'get_thread', 'get_message', 'list_labels'].map(x => G + x);
// Solo crear: leer o editar borradores dejaría cambiar uno que Alex tiene a medias, sin que se entere.
const GMAIL_BORRADOR = ['create_draft'].map(x => G + x);
const GMAIL_BORRADORES_FUERA = ['update_draft', 'list_drafts', 'get_draft'].map(x => G + x);
const CALENDARIO_LEER = ['list_events', 'get_event', 'list_calendars', 'search_events'].map(x => C + x);
const DRIVE_LEER = ['search_files', 'read_file_content', 'get_file_metadata', 'list_recent_files'].map(x => D + x);
const SLACK_LEER = ['slack_read_channel', 'slack_read_thread', 'slack_read_canvas', 'slack_read_user_profile', 'slack_search_channels', 'slack_search_public', 'slack_search_public_and_private', 'slack_search_users'].map(x => S + x);
const ERP_LEER = ['resumen', 'tesoreria', 'movimientos', 'facturas', 'factura', 'pedidos', 'pedido', 'entregas', 'proveedores', 'ventas', 'iva', 'personal', 'categorias', 'reglas', 'escenarios', 'candidatos_conciliacion'].map(x => E + x);
// Las de lectura que ya usa el equipo de Marketing en sus agentes
const META_LEER = ['ads_get_ad_entities', 'ads_get_creatives', 'ads_get_custom_audience', 'ads_get_dataset_stats', 'ads_get_datasets', 'ads_get_field_context', 'ads_get_ig_accounts', 'ads_get_ad_videos', 'ads_account_get_activity_logs'].map(x => M + x);

// Lo que se deniega por nombre para que ni aparezca (ahorra contexto y es la primera barrera).
// Lo que se escape, lo caza la auditoría del motor en el `init` de cada turno.
const ESCRITURA = [
	...GMAIL_BORRADORES_FUERA,
	...['send_message', 'reply', 'forward', 'trash_message', 'trash_thread', 'untrash_message', 'untrash_thread', 'delete_draft', 'create_label', 'update_label', 'delete_label', 'label_message', 'label_thread', 'unlabel_message', 'unlabel_thread', 'update_message_labels', 'mark_message_spam', 'mark_thread_spam', 'unmark_message_spam', 'unmark_thread_spam', 'apply_sensitive_message_label', 'apply_sensitive_thread_label'].map(x => G + x),
	...['create_event', 'delete_event', 'update_event', 'respond_to_event', 'suggest_time'].map(x => C + x),
	...['copy_file', 'create_file', 'share_file', 'trash_file', 'update_file', 'download_file_content', 'get_file_permissions'].map(x => D + x),
	...['slack_send_message', 'slack_send_message_draft', 'slack_schedule_message', 'slack_create_canvas', 'slack_update_canvas'].map(x => S + x),
	...['alta_factura_recibida', 'analizar_extracto', 'categorizar_movimiento', 'conciliar_factura', 'crear_escenario', 'crear_regla', 'fijar_presupuesto', 'importar_extracto'].map(x => E + x),
];
// Servidores enteros que no pinta nada aquí (o que son de escritura casi entera)
const SERVIDORES_FUERA = ['mcp__playwright', 'mcp__claude_ai_Claude_Docs', 'mcp__claude_ai_Notion', 'mcp__google-ads-mcp__execute_mutate'];
const WEB_Y_SHELL = ['Bash', 'BashOutput', 'KillShell', 'WebFetch', 'WebSearch', 'NotebookEdit', 'SendMessage', 'CronCreate', 'RemoteTrigger'];

const NUCLEO_SALA = ['Read', 'Grep', 'Glob', 'Agent', 'Task', 'Skill'];

/** Simulación: solo lee su mundo inventado. Sin conectores de ningún tipo ni ajustes del usuario. */
function argsMundo({ prompt, sistema, sesion = null, modelo = CONFIG.MODELO, dirExpediente = null, persistir = true, esquema = null, tools = 'Read,Grep,Glob' }) {
	const m = CONFIG.EMPRESA;
	const adj = path.join(CONFIG.DATOS, 'adjuntos');
	return [
		'-p', prompt, '--model', modelo,
		'--setting-sources', 'project',
		'--strict-mcp-config',
		'--settings', JSON.stringify({ autoMemoryEnabled: false }),
		'--tools', dirExpediente ? `${tools},Write` : tools,
		'--allowedTools', ...(tools ? [`Read(/${m}/**)`, `Grep(/${m}/**)`, `Glob(/${m}/**)`, `Read(/${adj}/**)`] : []), 'StructuredOutput',
		...(dirExpediente ? [`Read(/${dirExpediente}/**)`, `Edit(/${dirExpediente}/**)`, `Write(/${dirExpediente}/**)`] : []),
		'--append-system-prompt', `${sistema}\n\nEsto es una simulación con una empresa inventada: trabaja con lo que hay en tu carpeta como si fuera real.`,
		...(persistir ? [] : ['--no-session-persistence']),
		...(sesion ? ['--resume', sesion] : []),
		...(esquema ? ['--json-schema', JSON.stringify(esquema)] : []),
		...salida(),
	];
}

function lecturaMarketing(dep) { return dep === 'marketing' ? META_LEER : []; }

// Prefijos completos permitidos en Marketing (GA4 y consulta de Google Ads solo leen).
function prefijoPermitido(dep, herramienta) {
	return dep === 'marketing' && (herramienta.startsWith('mcp__analytics-mcp__') || (herramienta.startsWith('mcp__google-ads-mcp__') && !/mutate|create|update|delete|remove|set_/i.test(herramienta)));
}

/** Conjunto de herramientas permitidas por departamento y modo: 'sala' | 'encargo' | 'recepcion'. */
export function permitidas(dep, modo = 'sala') {
	if (modo === 'recepcion') return new Set([G + 'search_threads', G + 'get_thread', C + 'list_events', S + 'slack_search_public_and_private', S + 'slack_read_thread', 'StructuredOutput']);
	if (modo === 'texto') return new Set(['StructuredOutput']);
	if (modo === 'borrador') return new Set(GMAIL_BORRADOR);
	if (modo === 'reunion') return new Set(['Read', 'Grep', 'Glob', 'Agent', 'Task', 'StructuredOutput', ...ERP_LEER, ...lecturaMarketing(dep)]);
	if (modo === 'encargo') return new Set([...NUCLEO_SALA.filter(x => x !== 'Skill'), 'Write', ...ERP_LEER, ...lecturaMarketing(dep)]);
	const d = POR_ID[dep];
	if (!d) throw new Error(`Departamento desconocido: ${dep}`);
	return new Set([
		...NUCLEO_SALA, ...GMAIL_LEER, ...CALENDARIO_LEER, ...DRIVE_LEER, ...SLACK_LEER, ...ERP_LEER, ...lecturaMarketing(dep),
	]);
}

/** Lo que aparece en el `init` y no está permitido. */
export function fueraDeLista(herramientas, dep, modo = 'sala') {
	const ok = permitidas(dep, modo);
	return herramientas.filter(h => !ok.has(h) && !prefijoPermitido(dep, h));
}

function denegarLectura(dep, h = CONFIG.HOME) {
	const rutas = [
		'.ssh', '.config', '.aws', '.gnupg', '.mi-erp', '.claude', '.claude-personal', 'Library', 'Fondos',
		'.codex', '.docker', '.cache', '.local', '.nvm', '.npm', 'Downloads', 'Desktop',
		'Documents/Personal', 'Documents/ClaudePersonal', 'Documents/Claude', 'Documents/Codex',
	];
	const r = [];
	for (const t of ['Read', 'Grep', 'Glob']) {
		for (const p of rutas) r.push(`${t}(/${path.join(h, p)}/**)`);
		r.push(`${t}(//Volumes/**)`, `${t}(**/.env*)`, `${t}(**/*.pem)`, `${t}(**/*.p12)`, `${t}(**/secretos*)`, `${t}(**/*secret*)`, `${t}(**/*password*)`, `${t}(/${path.join(h, '.zsh_history')})`, `${t}(/${path.join(h, '.bash_history')})`, `${t}(/${path.join(h, '.claude.json')})`, `${t}(/${path.join(CONFIG.DATOS, 'oficina.db')}*)`, `${t}(/${path.join(CONFIG.DATOS, 'vapid.json')})`, `${t}(/${path.join(CONFIG.DATOS, 'erp-mcp.json')})`);
	}
	return r;
}

/** Ajustes en línea: apaga plugins y hooks globales y añade lo denegado. */
const HOOK_BORRADOR = fileURLToPath(new URL('./hook-borrador.mjs', import.meta.url));
const hooks = () => ({ PreToolUse: [{ matcher: GMAIL_BORRADOR[0], hooks: [{ type: 'command', command: `"${process.execPath}" "${HOOK_BORRADOR}"` }] }] });
// Por si Claude guardase memoria automática: esa carpeta la leen las puertas, que tienen terminal.
const denegarEscritura = () => [`Edit(/${path.join(CONFIG.HOME, '.claude')}/**)`, `Write(/${path.join(CONFIG.HOME, '.claude')}/**)`];

function ajustes(dep, pluginsUsuario = []) {
	return JSON.stringify({
		enabledPlugins: Object.fromEntries(pluginsUsuario.map(p => [p, false])),
		hooks: hooks(),
		autoMemoryEnabled: false,
		permissions: { deny: [...denegarLectura(dep), ...denegarEscritura()] },
	});
}

function salida() { return ['--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', 'dontAsk']; }

/** Sala: conectores en lectura; sin Bash, Write, Edit ni web. Solo sale un borrador, que Alex revisa. */
export function argsSala(dep, { prompt, sistema, sesion = null, modelo = CONFIG.MODELO, rol = null, pluginsUsuario = [], denegadasExtra = [] }) {
	if (CONFIG.SIMULACION) return argsMundo({ prompt, sistema, sesion, modelo });
	const ok = [...permitidas(dep, 'sala')];
	const args = [
		'-p', prompt, '--model', modelo,
		'--setting-sources', 'user,project,local',
		'--settings', ajustes(dep, pluginsUsuario),
		'--tools', NUCLEO_SALA.filter(x => x !== 'Task').join(','),
		'--allowedTools', ...ok, ...(dep === 'marketing' ? ['mcp__analytics-mcp', 'mcp__google-ads-mcp'] : []),
		'--disallowedTools', ...[...ESCRITURA, ...GMAIL_BORRADOR].filter(h => !ok.includes(h)), ...SERVIDORES_FUERA, ...WEB_Y_SHELL, 'Write', 'Edit', ...denegadasExtra.filter(h => !ok.includes(h)),
		'--append-system-prompt', sistema,
		...salida(),
	];
	if (rol) args.push('--agent', rol);
	if (sesion) args.push('--resume', sesion);
	return args;
}

/** Reunión: como el encargo, pero sin escribir nada. Lee su carpeta y sus datos; el servicio guarda lo que devuelve. */
export function argsReunion(dep, { prompt, sistema, carpeta, mcpConfig, modelo = CONFIG.MODELO, rol = null, denegadasExtra = [], esquema = null }) {
	if (CONFIG.SIMULACION) return argsMundo({ prompt, sistema, modelo, persistir: false, esquema });
	const permit = [...permitidas(dep, 'reunion')].filter(h => !['Read', 'Grep', 'Glob'].includes(h));
	const args = [
		'-p', prompt, '--model', modelo,
		'--setting-sources', 'project,local',
		'--settings', JSON.stringify({ autoMemoryEnabled: false, permissions: { deny: denegarLectura(dep) } }),
		'--tools', 'Read,Grep,Glob,Agent',
		'--allowedTools', `Read(/${carpeta}/**)`, `Grep(/${carpeta}/**)`, `Glob(/${carpeta}/**)`, ...permit,
		'--disallowedTools', ...ESCRITURA, ...GMAIL_LEER, ...GMAIL_BORRADOR, ...CALENDARIO_LEER, ...DRIVE_LEER, ...SLACK_LEER, ...SERVIDORES_FUERA, ...WEB_Y_SHELL, 'Write', 'Edit', ...denegadasExtra,
		'--append-system-prompt', sistema,
		'--no-session-persistence',
		...salida(),
	];
	if (esquema) args.push('--json-schema', JSON.stringify(esquema));
	if (mcpConfig) args.push('--mcp-config', mcpConfig);
	if (rol) args.push('--agent', rol);
	return args;
}

/** Solo texto: redactar y revisar. Sin herramientas ni conexiones de ningún tipo: todo lo que necesita va en el prompt. */
export function argsTexto({ prompt, sistema, esquema, modelo = CONFIG.MODELO_A_FONDO, sesion = null, persistir = false }) {
	return [
		'-p', prompt, '--model', modelo,
		'--setting-sources', 'project',
		'--strict-mcp-config',
		'--tools', '',
		'--append-system-prompt', sistema,
		...(persistir ? [] : ['--no-session-persistence']),
		...(sesion ? ['--resume', sesion] : []),
		...(esquema ? ['--json-schema', JSON.stringify(esquema)] : []),
		...salida(),
	];
}

/** Encargo: sin ajustes globales de Alex, lee su carpeta y escribe solo en su expediente. */
export function argsEncargo(dep, { prompt, sistema, carpeta, dirExpediente, mcpConfig, modelo = CONFIG.MODELO_A_FONDO, rol = null, denegadasExtra = [] }) {
	if (CONFIG.SIMULACION) return argsMundo({ prompt, sistema, modelo: CONFIG.MODELO, dirExpediente, persistir: false });
	const permit = [...permitidas(dep, 'encargo')].filter(h => !['Read', 'Write', 'Grep', 'Glob'].includes(h));
	const args = [
		'-p', prompt, '--model', modelo,
		'--setting-sources', 'project,local',
		'--settings', JSON.stringify({ autoMemoryEnabled: false, permissions: { deny: [...denegarLectura(dep), ...denegarEscritura()] } }),
		'--tools', 'Read,Grep,Glob,Agent,Write',
		// Las reglas de Edit gobiernan también a Write: denegar Edit bloquearía el expediente. `--tools` ya deja Edit fuera.
		'--allowedTools', `Read(/${carpeta}/**)`, `Grep(/${carpeta}/**)`, `Glob(/${carpeta}/**)`, `Read(/${dirExpediente}/**)`, `Edit(/${dirExpediente}/**)`, `Write(/${dirExpediente}/**)`, ...permit,
		'--disallowedTools', ...ESCRITURA, ...GMAIL_LEER, ...GMAIL_BORRADOR, ...CALENDARIO_LEER, ...DRIVE_LEER, ...SLACK_LEER, ...SERVIDORES_FUERA, ...WEB_Y_SHELL, ...denegadasExtra,
		'--append-system-prompt', sistema,
		...salida(),
	];
	if (mcpConfig) args.push('--mcp-config', mcpConfig);
	if (rol) args.push('--agent', rol);
	return args;
}

/** Recepción: solo leer correo y calendario, sin archivos ni sesión guardada. */
export function argsRecepcion({ prompt, esquema, pluginsUsuario = [], modelo = CONFIG.MODELO, denegadasExtra = [] }) {
	if (CONFIG.SIMULACION) return argsMundo({ prompt, sistema: 'Eres Tere, de recepción.', modelo, persistir: false, esquema, tools: '' });
	const ok = [...permitidas('recepcion', 'recepcion')].filter(h => h !== 'StructuredOutput');
	const todas = [...GMAIL_LEER, ...CALENDARIO_LEER, ...DRIVE_LEER, ...SLACK_LEER, ...ERP_LEER, ...GMAIL_BORRADOR, ...ESCRITURA];
	return [
		'-p', prompt, '--model', modelo,
		'--setting-sources', 'user',
		'--settings', ajustes('recepcion', pluginsUsuario),
		'--tools', '',
		'--allowedTools', ...ok,
		'--disallowedTools', ...todas.filter(h => !ok.includes(h)), ...SERVIDORES_FUERA, ...WEB_Y_SHELL, ...denegadasExtra,
		'--no-session-persistence',
		...(esquema ? ['--json-schema', JSON.stringify(esquema)] : []),
		...salida(),
	];
}

/** Crear el borrador que Alex ha aprobado: solo esa herramienta, sin nada que leer, en texto plano. */
export function argsBorrador({ prompt, pluginsUsuario = [] }) {
	const todas = [...GMAIL_LEER, ...CALENDARIO_LEER, ...DRIVE_LEER, ...SLACK_LEER, ...ERP_LEER, ...ESCRITURA];
	return [
		'-p', prompt, '--model', 'haiku',
		'--setting-sources', 'user',
		'--settings', ajustes('general', pluginsUsuario),
		'--tools', '',
		'--allowedTools', ...GMAIL_BORRADOR,
		'--disallowedTools', ...todas, ...SERVIDORES_FUERA, ...WEB_Y_SHELL,
		'--no-session-persistence',
		...salida(),
	];
}
