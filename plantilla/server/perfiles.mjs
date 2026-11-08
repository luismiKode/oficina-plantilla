// Permisos de la Oficina. Lista cerrada: lo que no está aquí no se puede usar.
// Probado contra `claude -p` real el 6-nov-2026. Por qué es así: spec, «Dos perfiles de permisos».
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { POR_ID } from './departamentos.mjs';
import { fileURLToPath } from 'node:url';
import { META_FUERA } from './meta-fuera.mjs';

const G = 'mcp__claude_ai_Gmail__', C = 'mcp__claude_ai_Google_Calendar__', D = 'mcp__claude_ai_Google_Drive__';
const S = 'mcp__claude_ai_Slack__', E = 'mcp__mi-erp__', M = 'mcp__meta-ads__';

const GMAIL_LEER = ['search_threads', 'get_thread', 'get_message', 'list_labels'].map(x => G + x);
// Solo crear: leer o editar borradores dejaría cambiar uno que Alex tiene a medias, sin que se entere.
const GMAIL_BORRADOR = ['create_draft'].map(x => G + x);
const GMAIL_ENVIAR = G + 'send_message';
const GMAIL_BORRADORES_FUERA = ['update_draft', 'list_drafts', 'get_draft'].map(x => G + x);
const CALENDARIO_LEER = ['list_events', 'get_event', 'list_calendars', 'search_events'].map(x => C + x);
const DRIVE_LEER = ['search_files', 'read_file_content', 'get_file_metadata', 'list_recent_files'].map(x => D + x);
const SLACK_LEER = ['slack_read_channel', 'slack_read_thread', 'slack_read_canvas', 'slack_read_user_profile', 'slack_search_channels', 'slack_search_public', 'slack_search_public_and_private', 'slack_search_users'].map(x => S + x);
const ERP_LEER = ['resumen', 'tesoreria', 'movimientos', 'facturas', 'factura', 'pedidos', 'pedido', 'entregas', 'proveedores', 'ventas', 'iva', 'personal', 'categorias', 'reglas', 'escenarios', 'candidatos_conciliacion'].map(x => E + x);
// Las de lectura que ya usa el equipo de Marketing en sus agentes
const META_LEER = ['ads_get_ad_entities', 'ads_get_creatives', 'ads_get_custom_audience', 'ads_get_dataset_stats', 'ads_get_datasets', 'ads_get_field_context', 'ads_get_ig_accounts', 'ads_get_ad_videos', 'ads_account_get_activity_logs'].map(x => M + x);

// Lo que Lucía y Marco pueden preparar y Alex aprobar: crear, modificar, pausar y activar. Borrar, píxeles, catálogo y listas de clientes, no.
export const META_CAMPANAS = ['ads_activate_entity', 'ads_update_entity', 'ads_create_campaign', 'ads_create_ad_set', 'ads_create_ad', 'ads_create_creative', 'ads_creative_update', 'ads_creative_update_image_elements', 'ads_creative_create_image_variations', 'ads_creative_upload_media', 'ads_boost_ig_post', 'ads_experiment_abtest_create_test', 'ads_experiment_abtest_update_test'].map(x => M + x);
/** Quién puede preparar cambios de campaña. El resto de Marketing lee. */
export const puedeCampanas = hilo => hilo === 'marketing' || hilo === 'marketing:medios';

// Lo que se deniega por nombre para que ni aparezca (ahorra contexto y es la primera barrera).
// Lo que se escape, lo caza la auditoría del motor en el `init` de cada turno.
const ESCRITURA = [
	...META_FUERA,
	...GMAIL_BORRADORES_FUERA,
	...['send_message', 'reply', 'forward', 'trash_message', 'trash_thread', 'untrash_message', 'untrash_thread', 'delete_draft', 'create_label', 'update_label', 'delete_label', 'label_message', 'label_thread', 'unlabel_message', 'unlabel_thread', 'update_message_labels', 'mark_message_spam', 'mark_thread_spam', 'unmark_message_spam', 'unmark_thread_spam', 'apply_sensitive_message_label', 'apply_sensitive_thread_label'].map(x => G + x),
	...['create_event', 'delete_event', 'update_event', 'respond_to_event', 'suggest_time'].map(x => C + x),
	...['copy_file', 'create_file', 'share_file', 'trash_file', 'update_file', 'download_file_content', 'get_file_permissions', 'add_comment_reply', 'resolve_comment_thread', 'request_access', 'get_shared_drive_metadata', 'list_shared_drives'].map(x => D + x),
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
function prefijoPermitido(dep, herramienta, modo = 'sala') {
	return dep === 'marketing' && (herramienta.startsWith('mcp__analytics-mcp__') || (herramienta.startsWith('mcp__google-ads-mcp__') && !/mutate|create|update|delete|remove|set_/i.test(herramienta)));
}

/** Conjunto de herramientas permitidas por departamento y modo: 'sala' | 'encargo' | 'recepcion'. */
export function permitidas(dep, modo = 'sala') {
	if (modo === 'recepcion') return new Set([G + 'search_threads', G + 'get_thread', C + 'list_events', S + 'slack_search_public_and_private', S + 'slack_read_thread', 'StructuredOutput']);
	if (modo === 'texto') return new Set(['StructuredOutput']);
	if (modo === 'borrador') return new Set(GMAIL_BORRADOR);
	if (modo === 'envio') return new Set([GMAIL_ENVIAR]);
	if (modo === 'campana-aprobada') return new Set();
	if (modo === 'investigacion') return new Set(['WebSearch', 'WebFetch', 'StructuredOutput']);
	if (modo === 'encargo-web') return new Set(['Read', 'Grep', 'Glob', 'Agent', 'Task', 'Write', 'WebSearch', 'WebFetch', 'StructuredOutput']);
	if (modo === 'encargo-datos') return new Set([...permitidas(dep, 'encargo'), 'Bash', 'WebFetch']);
	if (modo === 'obra') return new Set(['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash']);
	if (modo === 'reunion') return new Set(['Read', 'Grep', 'Glob', 'Agent', 'Task', 'StructuredOutput', ...ERP_LEER, ...lecturaMarketing(dep)]);
	if (modo === 'encargo') return new Set([...permitidas(dep, 'sala'), 'Write', 'Edit']);
	const d = POR_ID[dep];
	if (!d) throw new Error(`Departamento desconocido: ${dep}`);
	return new Set([
		...NUCLEO_SALA, ...GMAIL_LEER, ...CALENDARIO_LEER, ...DRIVE_LEER, ...SLACK_LEER, ...ERP_LEER, ...lecturaMarketing(dep),
	]);
}

/** Lo que aparece en el `init` y no está permitido. */
export function fueraDeLista(herramientas, dep, modo = 'sala') {
	const ok = permitidas(dep, modo);
	return herramientas.filter(h => !ok.has(h) && !prefijoPermitido(dep, h, modo));
}

function denegarLectura(dep, h = CONFIG.HOME) {
	const rutas = [
		'.ssh', '.config', '.aws', '.gnupg', '.mi-erp', '.claude-personal', 'Library', 'Fondos',
		'.codex', '.docker', '.cache', '.local', '.nvm', '.npm', 'Downloads', 'Desktop',
		'Documents/Personal', 'Documents/ClaudePersonal', 'Documents/Claude', 'Documents/Codex',
	];
	// El dosier de Privado solo lo abre Legal
	// La bandeja de facturas está en el escritorio: la abre Finanzas.
	if (dep === 'finanzas') rutas.splice(rutas.indexOf('Desktop'), 1);
	if (dep !== 'legal') rutas.push('Documents/Acme/4-Negocio/Legal/5-Disputas/privado', 'Documents/Acme/4-Negocio/privado');
	const r = [];
	for (const t of ['Read', 'Grep', 'Glob']) {
		for (const p of rutas) r.push(`${t}(/${path.join(h, p)}/**)`);
		// De ~/.claude solo se puede leer lo que Claude guarda cuando un resultado es largo (tool-results).
		// Ajustes, credenciales, memorias y conversaciones, no.
		r.push(`${t}(/${path.join(h, '.claude')}/*.json)`, `${t}(/${path.join(h, '.claude')}/*.jsonl)`, `${t}(/${path.join(h, '.claude')}/.credentials*)`, `${t}(/${path.join(h, '.claude')}/*.md)`, `${t}(/${path.join(h, '.claude')}/history*)`, `${t}(/${path.join(h, '.claude')}/session-env/**)`, `${t}(/${path.join(h, '.claude')}/file-history/**)`, `${t}(/${path.join(h, '.claude')}/ide/**)`, `${t}(/${path.join(h, '.claude')}/statsig/**)`, `${t}(/${path.join(h, '.claude')}/settings*)`, ...['uploads', 'paste-cache', 'sessions', 'backups', 'chrome', 'jobs', 'debug', 'downloads', 'scheduled-tasks', 'state', 'telemetry', 'bridge-spawn', 'cache', 'daemon', 'feedback'].map(c => `${t}(/${path.join(h, '.claude', c)}/**)`), `${t}(/${path.join(h, '.claude')}/projects/**/*.jsonl)`, `${t}(/${path.join(h, '.claude')}/projects/*/memory/**)`, `${t}(/${path.join(h, '.claude')}/plugins/**)`, `${t}(/${path.join(h, '.claude')}/skills/**)`, `${t}(/${path.join(h, '.claude')}/todos/**)`, `${t}(/${path.join(h, '.claude')}/shell-snapshots/**)`);
		r.push(`${t}(//Volumes/**)`, `${t}(**/.env*)`, `${t}(**/*.pem)`, `${t}(**/*.p12)`, `${t}(**/secretos*)`, `${t}(**/*secret*)`, `${t}(**/*password*)`, `${t}(/${path.join(h, '.zsh_history')})`, `${t}(/${path.join(h, '.bash_history')})`, `${t}(/${path.join(h, '.claude.json')})`, `${t}(/${path.join(CONFIG.DATOS, 'oficina.db')}*)`, `${t}(/${path.join(CONFIG.DATOS, 'vapid.json')})`, `${t}(/${path.join(CONFIG.DATOS, 'erp-mcp.json')})`);
	}
	return r;
}

/** Ajustes en línea: apaga plugins y hooks globales y añade lo denegado. */
const HOOK_BORRADOR = fileURLToPath(new URL('./hook-borrador.mjs', import.meta.url));
// `|| exit 2`: un hook que se rompe (nvm actualizado, error de sintaxis) bloquea en vez de dejar pasar.
const cerrado = ruta => [{ type: 'command', command: `"${process.execPath}" "${ruta}" || exit 2` }];
const HOOK_PRIVADO = fileURLToPath(new URL('./hook-privado.mjs', import.meta.url));
export const HOOK_ENVIO = fileURLToPath(new URL('./hook-envio.mjs', import.meta.url));
export const HOOK_ESCRITURA = fileURLToPath(new URL('./hook-escritura.mjs', import.meta.url));
export const HOOK_CAMPANA = fileURLToPath(new URL('./hook-campanas.mjs', import.meta.url));
const hooks = () => ({ PreToolUse: [
	{ matcher: GMAIL_BORRADOR[0], hooks: cerrado(HOOK_BORRADOR) },
	{ matcher: G + 'search_threads', hooks: cerrado(HOOK_PRIVADO) },
] });
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

/** Quien investiga fuera: tiene web pero ninguna conexión ni dato de fuera de su carpeta, para que lo que lea en una página no pueda sacar nada. */
export const ROLES_WEB = new Set(['investigador-referencias', 'creadores', 'marca', 'normativa']);
/** Quien saca números: además puede lanzar los scripts de datos de su departamento, y solo esos. */
export const ROLES_DATOS = new Set(['analista']);
export const modoEncargo = rol => (ROLES_WEB.has(rol) ? 'encargo-web' : ROLES_DATOS.has(rol) ? 'encargo-datos' : 'encargo');

/** Encargo: sin ajustes globales de Alex, lee su carpeta y escribe solo en su expediente. */
export function argsEncargo(dep, { prompt, sistema, carpeta, dirExpediente, mcpConfig, modelo = CONFIG.MODELO_A_FONDO, rol = null, denegadasExtra = [], pluginsUsuario = [] }) {
	if (CONFIG.SIMULACION) return argsMundo({ prompt, sistema, modelo: CONFIG.MODELO, dirExpediente, persistir: false });
	if (ROLES_WEB.has(rol)) {
		return [
			'-p', prompt, '--model', modelo,
			'--setting-sources', 'project,local',
			'--strict-mcp-config',
			'--settings', JSON.stringify({ autoMemoryEnabled: false, permissions: { deny: [...denegarLectura(dep), ...denegarEscritura()] } }),
			'--tools', 'Read,Grep,Glob,Agent,Write,WebSearch,WebFetch',
			'--allowedTools', `Read(/${carpeta}/**)`, `Grep(/${carpeta}/**)`, `Glob(/${carpeta}/**)`, `Read(/${dirExpediente}/**)`, `Edit(/${dirExpediente}/**)`, `Write(/${dirExpediente}/**)`, 'WebSearch', 'WebFetch', 'Agent', 'Task',
			'--disallowedTools', 'Bash', 'NotebookEdit', 'SendMessage', 'CronCreate', 'RemoteTrigger', ...denegadasExtra,
			'--append-system-prompt', sistema,
			'--agent', rol,
			'--no-session-persistence',
			...salida(),
		];
	}
	const datos = ROLES_DATOS.has(rol);
	const ok = [...permitidas(dep, 'encargo')].filter(h => !['Write', 'Edit'].includes(h));
	// Lee lo mismo que en su chat, para no atascarse pidiendo «una sesión». Sin nada que saque datos fuera.
	// Con ajustes de usuario, Write queda abierto: por eso escribir pasa siempre por el hook, que falla cerrado.
	const args = [
		'-p', prompt, '--model', modelo,
		'--setting-sources', 'user,project,local',
		'--settings', JSON.stringify({
			enabledPlugins: Object.fromEntries(pluginsUsuario.map(p => [p, false])),
			autoMemoryEnabled: false,
			hooks: { PreToolUse: [...hooks().PreToolUse, { matcher: 'Write|Edit|MultiEdit|NotebookEdit', hooks: cerrado(HOOK_ESCRITURA) }] },
			permissions: { deny: [...denegarLectura(dep), ...denegarEscritura()] },
		}),
		'--tools', `${NUCLEO_SALA.filter(x => x !== 'Task').join(',')},Write,Edit${datos ? ',Bash,WebFetch' : ''}`,
		'--allowedTools', ...ok, 'Write', 'Edit', ...(dep === 'marketing' ? ['mcp__analytics-mcp', 'mcp__google-ads-mcp'] : []), ...(datos ? ['Bash(python3 7-Datos/scripts/*)', 'WebFetch(domain:acme.diy)'] : []),
		'--disallowedTools', ...ESCRITURA.filter(h => !ok.includes(h)), ...GMAIL_BORRADOR, ...SERVIDORES_FUERA, ...WEB_Y_SHELL.filter(h => !(datos && (h === 'Bash' || h === 'WebFetch'))), ...denegadasExtra.filter(h => !ok.includes(h)),
		'--append-system-prompt', sistema,
		// El resultado queda en su expediente: guardar la conversación entera solo llena el disco.
		'--no-session-persistence',
		...salida(),
	];
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

/** Enviar un correo que Alex ha aprobado: solo esa herramienta, nada que leer, y un hook que compara con lo aprobado. */
export function argsEnvio({ prompt, pluginsUsuario = [] }) {
	const todas = [...GMAIL_LEER, ...CALENDARIO_LEER, ...DRIVE_LEER, ...SLACK_LEER, ...ERP_LEER, ...GMAIL_BORRADOR, ...ESCRITURA.filter(h => h !== GMAIL_ENVIAR)];
	return [
		'-p', prompt, '--model', 'haiku',
		'--setting-sources', 'user',
		'--settings', JSON.stringify({
			enabledPlugins: Object.fromEntries(pluginsUsuario.map(p => [p, false])),
			autoMemoryEnabled: false,
			hooks: { PreToolUse: [{ matcher: GMAIL_ENVIAR, hooks: cerrado(HOOK_ENVIO) }] },
			permissions: { deny: [...denegarLectura('general'), ...denegarEscritura()] },
		}),
		'--tools', '',
		'--allowedTools', GMAIL_ENVIAR,
		'--disallowedTools', ...todas, ...SERVIDORES_FUERA, ...WEB_Y_SHELL,
		'--no-session-persistence',
		...salida(),
	];
}

/** Hacer la única llamada que Alex ha aprobado: esa herramienta y nada más, y un hook que la compara con lo aprobado. */
export function argsCampanaAprobada({ herramienta, prompt }) {
	if (!META_CAMPANAS.includes(herramienta)) throw new Error('Esa herramienta no se puede usar');
	const todas = [...META_LEER, ...META_FUERA, ...GMAIL_LEER, ...CALENDARIO_LEER, ...DRIVE_LEER, ...SLACK_LEER, ...ERP_LEER, ...GMAIL_BORRADOR, ...ESCRITURA].filter(h => h !== herramienta);
	return [
		'-p', prompt, '--model', 'haiku',
		// Sin los ajustes del usuario: dan permisos sueltos que aquí no pintan nada.
		'--setting-sources', 'project,local',
		'--settings', JSON.stringify({
			autoMemoryEnabled: false,
			hooks: { PreToolUse: [{ matcher: herramienta, hooks: cerrado(HOOK_CAMPANA) }] },
			permissions: { deny: [...denegarLectura('marketing'), ...denegarEscritura()] },
		}),
		'--tools', '',
		'--allowedTools', herramienta,
		'--disallowedTools', ...new Set(todas), ...SERVIDORES_FUERA, 'mcp__analytics-mcp', 'mcp__google-ads-mcp', ...WEB_Y_SHELL,
		'--no-session-persistence',
		...salida(),
	];
}

// Lo único que puede ejecutar quien hace obras en la oficina: probar, compilar, guardar en su rama e instalar lo que haga falta. Nada de subir ni de red suelta.
const BASH_OBRA = ['node --test', 'npm test', 'npm install', 'npm run', 'npx vite', 'git status', 'git diff', 'git log', 'git add', 'git commit', 'brew install', 'which', 'ls', 'mkdir'];

/** Nico mejorando la oficina: en su rama, sin conectores ni datos, sin leer lo de los demás. */
export function argsObra({ prompt, carpeta, sesion = null }) {
	return [
		'-p', prompt, '--model', CONFIG.MODELO_A_FONDO,
		'--setting-sources', 'project',
		'--strict-mcp-config',
		'--settings', JSON.stringify({ autoMemoryEnabled: false, permissions: { deny: [...denegarLectura('general'), ...denegarEscritura(), 'Bash(git push:*)', 'Bash(git remote:*)', 'Bash(git config:*)'] } }),
		'--tools', 'Read,Grep,Glob,Write,Edit,Bash',
		'--allowedTools', `Read(/${carpeta}/**)`, `Grep(/${carpeta}/**)`, `Glob(/${carpeta}/**)`, `Edit(/${carpeta}/**)`, `Write(/${carpeta}/**)`, ...BASH_OBRA.map(c => `Bash(${c}:*)`), 'Bash(curl -L https://huggingface.co/*)',
		'--append-system-prompt', `Eres Nico, de tecnología. Mejoras la propia Oficina de Acme, en una rama aparte (${carpeta}): lo que está en marcha no se toca hasta que las pruebas pasen, y eso lo comprueba el servicio. Lee CLAUDE.md y sigue sus reglas. Cambia lo justo, añade pruebas y deja que pasen con node --test. No subas nada a ningún remoto ni toques claves. Si necesitas una clave que no tienes, dilo. Al acabar, dile a Alex en una o dos frases qué ha cambiado, en cristiano.`,
		...salida(),
		...(sesion ? ['--resume', sesion] : []),
	];
}

/** Investigar fuera para una reunión: solo la web. Ni conexiones, ni archivos, ni escribir: lo que lea en una página no puede sacar nada. */
export function argsInvestigacion({ prompt, modelo = CONFIG.MODELO_A_FONDO }) {
	return [
		'-p', prompt, '--model', modelo,
		'--setting-sources', 'project',
		'--strict-mcp-config',
		'--settings', JSON.stringify({ autoMemoryEnabled: false, permissions: { deny: [...denegarLectura('general'), ...denegarEscritura()] } }),
		'--tools', 'WebSearch,WebFetch',
		'--allowedTools', 'WebSearch', 'WebFetch',
		'--disallowedTools', 'Bash', 'Write', 'Edit', 'Read', 'Grep', 'Glob', 'NotebookEdit', 'SendMessage', 'Agent', 'Task',
		'--no-session-persistence',
		...salida(),
	];
}
