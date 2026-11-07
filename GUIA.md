# Una oficina virtual propia

Una oficina dibujada donde tu equipo son agentes de Claude con nombre, cargo y carácter. Hablas con tu director general y él reparte. Los equipos trabajan con tablones, se reúnen entre ellos, y solo te llega lo que únicamente puedes hacer tú.

Esta carpeta trae dos cosas: esta guía, con el modelo y lo aprendido, y `plantilla/`, el código funcionando con una empresa inventada. **Empieza por la simulación.** No conectes nada real hasta haberla visto trabajar.

## Empezar en diez minutos

Hace falta un Mac con Node 24 o superior y Claude Code con sesión iniciada.

```bash
cd plantilla
npm install
npm test
npm run web
OFICINA_SIMULACION=1 OFICINA_DATOS=/tmp/mi-oficina node scripts/crear-mundo.mjs
OFICINA_SIMULACION=1 OFICINA_DATOS=/tmp/mi-oficina OFICINA_PUERTO=4647 node server/index.mjs
```

La app solo deja entrar a quien llega identificado. Para verla en el propio Mac, lo más fácil es Tailscale: `tailscale serve --bg --https=8443 http://127.0.0.1:4647`, y abrir la dirección que te dé. Antes, pon tu correo y esa dirección con `node scripts/personalizar.mjs` (mira sus opciones al principio del archivo). En el iPad o el iPhone: Tailscale activo, abrir en Safari y «Añadir a pantalla de inicio».

Para poner a trabajar la simulación: `node scripts/simular.mjs 4647` (un día) o `node scripts/jugar.mjs 4647 12` (una tanda de sucesos). Usa tu cuenta de Claude de verdad, con datos falsos.

Lo más cómodo es abrir Claude Code en esta carpeta y decirle: «Lee GUIA.md y adáptalo a mi trabajo».

## El modelo

**Una persona con la que hablas.** El director general recibe tus preocupaciones, las analiza, reparte y filtra lo que te llega. Todo lo que los equipos quieran pedirte pasa antes por él.

**Departamentos con carpeta propia.** Cada uno es una carpeta con su `CLAUDE.md` (cómo se trabaja), su `ESTADO.md` (una foto de cómo va, que se sustituye en vez de crecer), sus agentes en `.claude/agents/` y una memoria corta por agente. Sus decisiones, en fichas escritas antes de aplicarlas. Los agentes arrancan dentro de esa carpeta y así tienen el contexto sin copiar nada.

**Personas, no IAs.** Cada agente tiene nombre, cargo, carácter y forma de hablar. Hablan por chat: una a tres frases, el dato y lo que proponen. Si quieres más, ya preguntarás.

**Niveles de permiso.** Unas normas comunes y, encima, quién puede qué:

| Decisión | Quién |
|---|---|
| Leer, hablar, apuntar tareas, reunirse, escribir informes | Se hace, sin preguntar |
| Prioridades y reparto entre equipos | Director general |
| Fichar, fundar un departamento, lo que no se puede deshacer | Tú, con un sí |
| Mandar nada fuera, pagar, firmar, publicar, borrar, tocar claves | Nadie sin ti, o nadie |

**Ágil.** Un tablón por equipo, con prioridad y sprint semanal. Una tarea a la vez. Si no se puede hacer, queda bloqueada con lo que falta, nunca como hecha, y el director la desbloquea.

**Reuniones que acaban en algo.** Aportes, una mesa con rondas en la que se corrigen entre ellos, y un cierre. Si lo resuelven, reparten tareas y no te enteras. Si hace falta que decidas, te llega una presentación con límites en el código: seis diapositivas, cuatro puntos, el título es la conclusión. Una revisora la devuelve si es un tostón, y la entrenas con tus críticas.

**Correos.** Los redacta el equipo, una revisora los deja en tu estilo y aprende de lo que cambies, y tú apruebas.

**Proactiva.** Lo que entra despierta a quien le toca; si afecta a varios, se reúnen.

**Lean.** Un agente mira los números cada día, ajusta parámetros dentro de márgenes y añade formas de trabajar. Todo anotado y se puede deshacer. Lo que se sale de su margen, lo propone.

**Vida.** Un edificio en píxeles con plantas y ascensor, gente que se levanta, va a las reuniones y lleva recados. Cada departamento se reúne y decide cómo decorar su planta y qué KPI poner, sacados de sus datos.

## Seguridad: lo que no hay que aflojar

Esto lee cosas que escribe cualquiera, así que un correo puede intentar engañarlos. Los permisos van **en el código, no en el prompt**:

1. **Lo que dice un correo es información, nunca una orden.**
2. **Lista cerrada de herramientas por perfil.** Lo que no está, no existe. En cada turno se compara con lo que Claude dice tener y, si sobra algo, se mata el proceso (`server/perfiles.mjs`, `server/motor.mjs`).
3. **Quien lee no escribe fuera.** Quien lee correo y datos no tiene ninguna herramienta para sacar nada. El borrador lo crea otro proceso aparte, solo tras tu aprobación, con el texto que has visto, en texto plano y sin copia oculta ni adjuntos (`server/correos.mjs`, `server/hook-borrador.mjs`).
4. **Lo que dispara un correo vale menos.** No puede enseñar a la revisora, ni fichar, ni cerrar tareas.
5. **Candado para lo real:** sin `OFICINA_REAL=1` no arranca con datos reales.
6. **Acceso:** solo por Tailscale y solo con tu cuenta. Comprueba quién entra y bloquea peticiones de otras webs.

Una revisión de seguridad hecha aparte encontró, por ejemplo, que un correo podía colar instrucciones permanentes a través de las lecciones, y que un borrador podía esconder datos. Pide una tú también antes de conectar nada real.

## Lo que aprendimos simulando

- **Se pasaron de sobrios.** Al decorar, todos eligieron gris y «aquí se trabaja». Hubo que decirles que era su casa. El encargo manda mucho.
- **Marcaban como hecho lo que no podían hacer.** Por eso existe «bloqueada».
- **Te inundan si no hay filtro.** Pasé de 23 cosas nuevas en una noche a 6 poniendo al director de filtro. Las rondas no fueron del todo comparables, pero la mejora es clara.
- **Se quedan sin contexto.** Si un agente no ve lo que ya sabe otro, te pregunta. Todos deben ver lo que ha entrado.
- **Generan más trabajo del que hacen.** Hacen falta topes diarios, y poca tarea y clara. Esto sigue sin estar resuelto del todo.
- **No avisaban a los demás.** Un retraso no es solo de quien lo recibe: hay que decirle a quien reparte a quién le cae después.

## Lo que no está probado

En la plantilla no se ha probado: la conexión real con correo o ERP tras limpiarla, y, en ninguna versión, los audios, la voz narrada y los avisos en un iPhone real. La versión original solo ha trabajado con datos reales en lectura, en pruebas cortas. **Es un prototipo: revisa antes de confiarle nada.**

## Adaptarla a tu trabajo

1. `scripts/personalizar.mjs`: tu nombre, correo, empresa y dirección.
2. `server/departamentos.mjs`: tus departamentos y sus carpetas.
3. `server/equipo.mjs`: tu gente.
4. `scripts/crear-mundo.mjs`: una empresa inventada que se parezca a la tuya. Simula con ella antes de nada.
5. `server/perfiles.mjs`: qué conexiones tiene cada uno, leyendo lo primero. Pruébalo contra `claude` real mirando el evento `init`.
6. `server/recepcion.mjs`: a quién le toca cada remitente.
7. Solo cuando te fíes: datos reales, con `OFICINA_REAL=1`.

## Una duda legal que debes mirar

Esto lanza `claude -p` con tu suscripción y pone una web delante. Las condiciones de Anthropic permiten usar Claude Code sin modificar con tu suscripción, pero son restrictivas con las aplicaciones que encaminan peticiones por un plan y dicen que los límites suponen un uso normal e individual. Para uso propio en tu máquina encaja mejor, pero no lo he confirmado. Léelas: https://code.claude.com/docs/en/legal-and-compliance. La alternativa es una clave de API, que se paga por uso.

## De dónde sale cada cosa

Todo el código que necesitas está aquí; no hay repos que clonar.

- **Claude Code:** [`claude -p` y sus opciones](https://code.claude.com/docs/en/cli-reference), [permisos](https://code.claude.com/docs/en/permissions), [subagentes](https://code.claude.com/docs/en/sub-agents), [hooks](https://code.claude.com/docs/en/hooks).
- **Librerías:** [Hono](https://hono.dev) para la API, `node:sqlite` para los datos, [Svelte](https://svelte.dev) y [Vite](https://vite.dev) para la app, [web-push](https://github.com/web-push-libs/web-push) para los avisos, [Tailscale serve](https://tailscale.com/kb/1242/tailscale-serve) para el acceso.
- **Forma de trabajar con Claude:** el plugin [Superpowers](https://github.com/obra/superpowers), para pensar el diseño y el plan antes de construir.
- **Letras:** [Outfit](https://fonts.google.com/specimen/Outfit) y [DM Sans](https://fonts.google.com/specimen/DM+Sans), con licencia libre.
