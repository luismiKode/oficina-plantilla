// Configuración de la Oficina. Lo sensible vive en DATOS, fuera de git.
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
// Simulación: empresa inventada, sin Gmail, ERP, Slack ni voz. Nada real entra ni sale.
const SIMULACION = process.env.OFICINA_SIMULACION === '1';
const DATOS = process.env.OFICINA_DATOS || path.join(HOME, SIMULACION ? '.oficina-sim' : '.oficina');

export const CONFIG = {
	HOME,
	SIMULACION,
	EMPRESA: SIMULACION ? path.join(DATOS, 'mundo') : path.join(HOME, 'Documents', 'Empresa'),
	// Fuera de ~/Library porque las salas tienen denegado leer ahí, y los adjuntos tienen que poder leerse.
	DATOS,
	PUERTO: Number(process.env.OFICINA_PUERTO || 4646),
	USUARIO: process.env.OFICINA_USUARIO || 'tu@correo.com',
	HOSTS: ['tu-mac.tu-tailnet.ts.net:8443', 'tu-mac.tu-tailnet.ts.net', `127.0.0.1:${Number(process.env.OFICINA_PUERTO || 4646)}`],
	CLAUDE_BIN: process.env.OFICINA_CLAUDE || path.join(HOME, '.local', 'bin', 'claude'),
	CLAUDE_CONFIG_DIR: path.join(HOME, '.claude'), // solo para leer sus ajustes
	// La cuenta de Acme es la de por defecto. Fijar CLAUDE_CONFIG_DIR, aunque sea a esa misma carpeta, hace que
	// Claude busque su configuración en otro sitio y diga que no hay sesión: se quita, por si viene heredada.
	// Sin ENABLE_TOOL_SEARCH=false, las conexiones quedan diferidas y quien no lleva agente no puede usarlas: Julián veía cero herramientas.
	ENV_CLAUDE: { CLAUDE_CONFIG_DIR: undefined, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', ENABLE_TOOL_SEARCH: 'false' },
	// Alex, 7-nov: que gasten lo que necesiten y las decisiones estén bien tomadas. En simulación no hace falta.
	MODELO: SIMULACION ? 'sonnet' : 'opus',
	MODELO_A_FONDO: 'opus',
	MAX_PROCESOS: 4,
	MAX_SALTOS: 2,
	MAX_ASISTENTES: 6,
	TIEMPO_SALA_MS: 15 * 60_000,
	TIEMPO_ENCARGO_MS: 30 * 60_000,
	TIEMPO_RECEPCION_MS: 20 * 60_000,
	PASADAS: [[8, 30]],             // el saludo de la mañana; el resto lo dispara la vigía
	VIGIA_MS: 10 * 60_000,
	VIGIA_HORAS: [7, 23],
	TOPES: { tareas: 20, reuniones: 10, avisos: 40, correos: 20, fichajes: 3 },
	DIAS_PRIMERA_PASADA: 14,
	ZONA: 'Europe/Madrid',
	MAX_RONDAS: 3,
	MAX_ITERACIONES: 3,
	TIEMPO_REUNION_PASO_MS: 15 * 60_000,
	// Resend de la empresa. Se usa para escribirle a Alex, nunca a otro. Sin clave, no sale nada.
	RUTA_CLAVE_RESEND: path.join(HOME, '.config', 'oficina', 'resend.env'),
	RESEND_DE: 'Oficina de Acme <oficina@tu-dominio.com>',
	RUTA_CLAVE_ELEVENLABS: path.join(HOME, '.config', 'acme', 'elevenlabs.env'),
	MAX_ADJUNTO: 30 * 1024 * 1024,
};
