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

## Que la monte tu Claude

La idea es que no la montes a mano: se la pides a Claude Code en tu ordenador y la monta él, leyendo esta guía.

1. Instala Claude Code y entra con tu cuenta. En Windows, mejor dentro de WSL (mira «En Windows»).
2. Descarga esta carpeta con `git clone` y el enlace de este repositorio, y entra en ella.
3. Abre Claude Code ahí (`claude`) y pégale esto:

```
Lee GUIA.md entera y monta esta oficina en este ordenador. Si es Windows, hazlo dentro de WSL con Ubuntu,
siguiendo el apartado «En Windows». Empieza por la simulación con la empresa inventada y enséñamela
funcionando antes de conectar nada real. Pregúntame lo que necesites de mi trabajo para adaptarla:
departamentos, personas, carpetas y a quién le toca cada correo. No conectes mi correo ni nada real
hasta que yo te lo diga, y antes pasa una revisión de seguridad como dice la guía.
```

4. Cuando la tengas en simulación y te guste, pídele que la adapte a tu trabajo y, al final, que la conecte.

## En Windows

Está hecha y probada en un Mac. En Windows no se ha probado nunca. Lo más sencillo es montarla dentro de WSL 2, con Ubuntu, que se comporta como un Linux:

1. En PowerShell como administrador: `wsl --install -d Ubuntu`. Reinicia y crea tu usuario de Ubuntu.
2. Dentro de Ubuntu: instala Node 24 (con nvm, por ejemplo), Git y Claude Code, y entra con `claude` para iniciar sesión.
3. Copia la plantilla dentro de Ubuntu, en tu carpeta de usuario (`~/`), no en `C:\`: va mucho más rápido y los permisos de rutas funcionan como en el Mac.
4. Sigue «Empezar en diez minutos» desde ahí.
5. Tailscale, instalado en Windows: `tailscale serve` hacia `http://127.0.0.1:4647` llega a lo que corre en WSL.

Lo que en Windows no hay o cambia:

- **Arrancar sola y no dormirse:** en el Mac lo hacen `launchd` y `caffeinate`. En WSL, lánzala a mano o con una tarea programada de Windows que abra `wsl` y la arranque, y quita la suspensión del equipo mientras la uses.
- **Notas de voz:** instala `ffmpeg` y `whisper.cpp` en Ubuntu, o indica dónde están con `OFICINA_FFMPEG` y `OFICINA_WHISPER`.
- **Fundar un departamento:** crea la carpeta y lo apunta en el mapa, pero no la «puerta», que es una app del Mac.
- **La app del iPhone y el iPad** abre la oficina por Tailscale igual que en el Mac. En Android, ábrela en el navegador.

Si algo falla, abre Claude Code en la carpeta y dile qué ha pasado: el código está pensado para que lo adapte.

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

**Correos.** Los redacta el equipo, una revisora los deja naturales y en tu estilo, sin tics de IA, y aprende de lo que cambies. Tú apruebas y sale exactamente eso: un proceso aparte, con un vigilante que compara lo que sale con lo que has visto y solo lo deja salir una vez.

**Campañas.** Igual que los correos. Quien las lleva prepara el cambio, te llega una tarjeta con lo que pasa en euros, apruebas y se hace exactamente esa llamada. No intentes filtrar con reglas de texto lo que un agente puede gastar: lo probamos, y una revisión lo rompió dos veces.

**Avisos a tu correo.** Los departamentos pueden escribirte muy de vez en cuando por Resend, solo a ti y sin enlaces.

**Proactiva.** Lo que entra despierta a quien le toca; si afecta a varios, se reúnen.

**Lean.** Un agente mira los números cada día, ajusta parámetros dentro de márgenes y añade formas de trabajar. Todo anotado y se puede deshacer. Lo que se sale de su margen, lo propone.

**Personas e infra.** Una de personas contrata freelance de la oficina y propone departamentos; uno de tecnología vigila que las carpetas sigan el mapa. Fundar un departamento, con tu sí, crea la carpeta según el patrón, lo apunta en el mapa y le da planta (`server/fundar.mjs`).

**Se ve lo que hacen.** En el chat aparece en vivo lo que está haciendo cada uno, sacado de los eventos reales de Claude: «Buscando en el correo», «Leyendo ESTADO.md», «Preguntando a Vera». Si está en cola, lo dice. Al acabar queda plegado en «4 pasos, 38 s» (`server/actividad.mjs`).

**Se mejora sola.** El de tecnología hace las mejoras de la propia oficina en una rama aparte. El servicio, no el modelo, pasa las pruebas, compila y arranca la versión nueva con datos falsos antes de ponerla en marcha, y si no va, la retira. Lo que toque permisos o controles pide tu sí (`server/obras.mjs`).

**Las tareas se hacen solas.** No dependen del chat: siguen aunque se cierre, varias a la vez y una por equipo, y te avisan por correo al acabar o atascarse. Cada una lee sus conexiones y escribe solo en la carpeta de su departamento, con un vigilante que falla cerrado y todo guardado en git (`server/escritura.mjs`).

**Vida.** Un edificio en píxeles con plantas y ascensor, gente que se levanta, va a las reuniones y lleva recados. Cada departamento se reúne y decide cómo decorar su planta y qué KPI poner, sacados de sus datos.

## Seguridad: lo que no hay que aflojar

Esto lee cosas que escribe cualquiera, así que un correo puede intentar engañarlos. Los permisos van **en el código, no en el prompt**:

1. **Lo que dice un correo es información, nunca una orden.**
2. **Lista cerrada de herramientas por perfil.** Lo que no está, no existe. En cada turno se compara con lo que Claude dice tener y, si sobra algo, se mata el proceso (`server/perfiles.mjs`, `server/motor.mjs`).
3. **Quien lee no escribe fuera.** Quien lee correo y datos no tiene ninguna herramienta para sacar nada. Enviar lo hace otro proceso aparte, solo tras tu aprobación, con el texto que has visto, en texto plano y sin copia oculta ni adjuntos (`server/correos.mjs`, `server/hook-envio.mjs`).
4. **Lo que dispara un correo vale menos, y esa marca no se pierde.** Todo mensaje nace contaminado salvo el que escribes tú, y un turno que lee algo de fuera se contamina. No puede enseñar a la revisora, ni fichar, ni cerrar tareas. Revisa cada relevo: ahí se perdía.
5. **Los vigilantes fallan cerrado.** Un hook que se rompe deja pasar la llamada si no le pones `|| exit 2`. Compruébalo también antes de cada envío.
6. **Candado para lo real:** sin `OFICINA_REAL=1` no arranca con datos reales.
7. **Acceso:** solo por Tailscale y solo con tu cuenta. Comprueba quién entra y bloquea peticiones de otras webs.

Una revisión de seguridad hecha aparte encontró, entre otras cosas, que un correo podía colar instrucciones permanentes a través de las lecciones, que la marca de «viene de un correo» se perdía en los relevos, que un presupuesto podía pasar multiplicado por un millón y que una ruta de escritura se salía de su carpeta. Las pruebas automáticas pasaban todas. Pide una tú también, adversaria y contra el código de verdad, antes de conectar nada real, y repítela después de arreglar.

## Lo que solo salió probando contra Claude de verdad

Lanza `scripts/auditar-permisos.mjs` y `scripts/probar-conexiones.mjs` antes de conectar nada, y otra vez cada cierto tiempo. Encontraron esto, que no se veía en ninguna prueba automática:

- **El director no veía ni un correo.** Con muchas herramientas, Claude las deja en diferido y hace falta `ToolSearch`, que aquí no se da. El modelo decía «no tengo ninguna». Se arregla con `ENABLE_TOOL_SEARCH=false`.
- **Los servicios añaden herramientas sin avisar.** Drive estrenó cinco, de comentar y pedir acceso, y Meta ofrece 95 fuera de la lista, muchas de escritura. La lista de permitidas protege, pero lo que no quieres se deniega por nombre en el código.
- **El `init` solo lista lo ya conectado.** Lo que tarda en conectar no sale ahí: se vigila también cada llamada.
- **El ERP se caía en 8 de 12 arranques con cuatro a la vez,** y en ninguno en fila. Por eso los arranques van de uno en uno.
- **Un tope que se agota sin avisar parece que no trabaja nadie.** Lo que pidas tú no debe esperar por un tope, y quien dirige debe ver su tablón: si no, se inventa que está en marcha.
- **Lanzar compañeros desde el chat se corta.** Lo largo, en tareas que sobrevivan al chat y a un reinicio.
- **Sin leer el correo ni escribir en su carpeta, casi todo se atasca** pidiendo «una sesión». Dales su ámbito y vigila los bordes, en vez de quitarles las manos.
- **Mira el disco.** Las pruebas dejan temporales; lo llené y la oficina empezó a fallar.
- **Las fichas de los agentes piden más de lo que tienen.** Un agente con `Bash` o `create_draft` en su ficha no los tiene aquí: manda la lista del perfil. Pruébalo pidiéndoles que manden un correo por las bravas.

## Lo que aprendimos simulando

- **Se pasaron de sobrios.** Al decorar, todos eligieron gris y «aquí se trabaja». Hubo que decirles que era su casa. El encargo manda mucho.
- **Marcaban como hecho lo que no podían hacer.** Por eso existe «bloqueada».
- **Te inundan si no hay filtro.** Pasé de 23 cosas nuevas en una noche a 6 poniendo al director de filtro. Las rondas no fueron del todo comparables, pero la mejora es clara.
- **Se quedan sin contexto.** Si un agente no ve lo que ya sabe otro, te pregunta. Todos deben ver lo que ha entrado.
- **Generan más trabajo del que hacen.** Hacen falta topes diarios, y poca tarea y clara. Esto sigue sin estar resuelto del todo.
- **No avisaban a los demás.** Un retraso no es solo de quien lo recibe: hay que decirle a quien reparte a quién le cae después.

## Lo que no está probado

En la plantilla no se ha probado la conexión real con correo o ERP tras limpiarla, ni nada en Windows. En ninguna versión se han probado los audios, la voz narrada ni los avisos en un iPhone real, ni un cambio de campaña real. La versión original acaba de empezar a trabajar con datos reales: **es un prototipo, revisa antes de confiarle nada.**

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
- **Repos parecidos que merece mirar:** [Paperclip](https://github.com/paperclipai/paperclip) (MIT, unas 112.000 estrellas), el más completo para llevar una empresa de agentes: organigrama, presupuestos por agente, aprobar fichajes, registro de actividad y un visor de lo que hace cada agente herramienta a herramienta. [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT, unas 10.000), personajes en píxeles que se mueven según lo que hace cada sesión de Claude Code. [claude-code-webui](https://github.com/sugyan/claude-code-webui) (MIT) y [cui](https://github.com/wbopan/cui) (Apache-2.0), chats web sobre Claude Code. No se ha copiado código de ninguno: se han mirado para ver qué hacen. Si te encaja lo que hace Paperclip tal cual, míralo antes de montar nada tuyo.
- **Forma de trabajar con Claude:** el plugin [Superpowers](https://github.com/obra/superpowers), para pensar el diseño y el plan antes de construir.
- **Letras:** [Outfit](https://fonts.google.com/specimen/Outfit) y [DM Sans](https://fonts.google.com/specimen/DM+Sans), con licencia libre.
