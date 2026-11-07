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
	ENV_CLAUDE: { CLAUDE_CONFIG_DIR: undefined, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },
	MODELO: 'sonnet',
	MODELO_A_FONDO: 'opus',
	MAX_PROCESOS: 2,
	MAX_SALTOS: 2,
	MAX_ASISTENTES: 6,
	TIEMPO_SALA_MS: 6 * 60_000,
	TIEMPO_ENCARGO_MS: 30 * 60_000,
	TIEMPO_RECEPCION_MS: 8 * 60_000,
	PASADAS: [[8, 30]],             // el saludo de la mañana; el resto lo dispara la vigía
	VIGIA_MS: 10 * 60_000,
	VIGIA_HORAS: [7, 23],
	TOPES: { tareas: 8, reuniones: 6, avisos: 15, correos: 10 },
	ZONA: 'Europe/Madrid',
	MAX_RONDAS: 3,
	MAX_ITERACIONES: 3,
	TIEMPO_REUNION_PASO_MS: 15 * 60_000,
	RUTA_CLAVE_ELEVENLABS: path.join(HOME, '.config', 'acme', 'elevenlabs.env'),
	MAX_ADJUNTO: 30 * 1024 * 1024,
};
