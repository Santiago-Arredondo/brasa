# 🔥 Brasa — mantén viva tu brasa

App web de fitness para quienes **empiezan y abandonan**. Brasa no se centra en el plan perfecto sino en la **disciplina**:

| Mecánica | Qué hace |
| --- | --- |
| **El Pacto** | El onboarding termina con un compromiso firmado (mantener presionado). Incluye tu *porqué*. |
| **La brasa** | Una llama animada que crece al entrenar y se enfría si dejas de hacerlo (calor con decaimiento en 14 días). |
| **Regla de oro** | *Nunca falles dos veces.* Un día libre no rompe la racha; dos seguidos sí. |
| **Modo mínimo** | En un mal día, 2 minutos cuentan. Nunca un día en cero. |
| **Tu porqué vuelve** | Cuando la racha está en riesgo o se enfrió, la app te muestra tus propias palabras. |
| **Misión diaria** | Entrenamiento sin equipo generado según meta, nivel, minutos y tipo; estable durante el día. |
| **5 tipos** | Fuerza, Cardio, Core, Yoga (posturas + transiciones) y Caminata (ritmos alternos, sin pausas). 30 ejercicios. |
| **Figuras de referencia** | Cada ejercicio muestra una figura SVG animada con el movimiento completo. |
| **Recordatorio diario** | Notificación con tu *porqué* solo si aún no entrenaste + archivo de calendario (.ics) como respaldo. |
| **Sin conexión** | Service worker: la app funciona sin internet una vez abierta. |
| **Tu brasa en la nube** | Opcional (Supabase): entra con tu correo y tu pacto e historial se sincronizan entre dispositivos. |

### Imágenes propias de los ejercicios

Las figuras se dibujan con poses en `src/data/exercises.js`. Para usar una foto o GIF propio, agrega
`image: 'assets/exercises/sentadillas.webp'` al ejercicio: reemplaza la figura automáticamente.
Revisa todas las figuras en `/tests/figuras.html`.

## Ejecutar

No requiere instalación ni build. Desde la carpeta del proyecto:

```bash
py -m http.server 5173
```

En macOS/Linux también puedes usar `python3 -m http.server 5173`.

- App: http://localhost:5173
- Tests: http://localhost:5173/tests/ (o en consola: `npm test` si tienes Node)
- Galería de figuras: http://localhost:5173/tests/figuras.html
- Datos de demo (no sobrescribe datos existentes): http://localhost:5173/tests/demo.html

> Al agregar archivos a `src/` o `styles/`, añádelos a `PRECACHE` en `sw.js` (hay un test que lo verifica).

> Se necesita un servidor (no abrir `index.html` con doble clic) porque los ES Modules no cargan desde `file://`.

## Publicar en la web

El workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) ejecuta `npm test` y publica la app en GitHub Pages cada vez que se actualiza `master`. La URL es <https://santiago-arredondo.github.io/brasa/>. GitHub Pages está configurado con **GitHub Actions** como fuente de despliegue.

GitHub Pages sirve el sitio y el código fuente públicamente. Si necesitas mantener el código privado, migra el despliegue a un proveedor que permita repositorios privados antes de volver a cambiar la visibilidad.

Cuando tengas la URL publicada, en Supabase **Authentication → URL Configuration** establece esa URL como *Site URL* y añádela a *Redirect URLs*. Conserva también `http://localhost:5173/` en la lista para el desarrollo local.

## Nube con Supabase (opcional)

El pacto y cada entrenamiento se guardan automáticamente en el navegador actual. **Eso no crea una copia en la nube:** para respaldar y recuperar el progreso en otro equipo, la persona debe iniciar sesión desde **Mi pacto → Guardar mi progreso**. Si no inicia sesión, los datos permanecen solo en ese navegador y pueden perderse al borrar sus datos locales.

Para activar cuentas y sincronización:

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql) (tablas `profiles` y `sessions`, RLS y la función para borrar la cuenta).
3. **Authentication → URL Configuration**: pon tu dominio en *Site URL* y añade a *Redirect URLs* las URLs desde donde se abre la app (p. ej. `http://localhost:5173/` y la de producción).
4. **Authentication → Email Templates → Magic Link**: añade el código para poder entrar sin salir de la app (imprescindible si está instalada como PWA):
   ```html
   <p>Tu código para entrar a Brasa: <strong>{{ .Token }}</strong></p>
   <p>O abre este enlace en el mismo navegador: <a href="{{ .ConfirmationURL }}">Entrar</a></p>
   ```
5. Copia en [`src/config.js`](src/config.js) la *Project URL* y la clave pública (*anon* / *publishable*). Nunca la `service_role`.

> El correo integrado de Supabase tiene un límite bajo de envíos por hora; para producción configura un SMTP propio (Authentication → SMTP Settings).

**Cómo funciona** (`src/core/sync.js`): local-first. `localStorage` sigue siendo la fuente inmediata y la app nunca espera a la red. Al entrar, al volver a la app o al recuperar conexión se descarga lo de la nube, se fusiona (`src/domain/merge.js`: sesiones unidas por id, gana la edición más reciente; el pacto más reciente gana) y se sube lo pendiente. Cada cambio se sube a los ~1,5 s, solo lo modificado. El recordatorio no se sincroniza (depende del permiso de notificaciones de cada dispositivo). *Cerrar sesión* conserva los datos locales; *Borrar todos mis datos* con sesión iniciada elimina también la cuenta en la nube.

## Arquitectura

```
src/
├── core/        # Infraestructura: store, router, plantillas seguras, feedback (audio/vibración)
├── domain/      # Lógica de negocio PURA y testeada: rachas, calor, generador, temporizador
├── data/        # Contenido: ejercicios y opciones del pacto
├── components/  # UI reutilizable (brasa animada)
├── views/       # Pantallas: pacto, hoy, entreno, progreso, perfil
└── main.js      # Composición: rutas + guardas
styles/          # tokens.css (diseño) → base → components → views
tests/           # Tests de dominio sin dependencias
```

### Decisiones y buenas prácticas

- **Separación de capas**: el dominio no conoce el DOM → testeable y reutilizable (p. ej. en un backend).
- **Seguridad**: las plantillas `html` escapan todo por defecto (protección XSS para el texto del usuario).
- **Estado inmutable + persistencia local-first**: `localStorage` como caché inmediata y sincronización opcional con Supabase, sin tocar las vistas. Esquema versionado con migración.
- **Accesibilidad**: HTML semántico, controles nativos (radio, `<dialog>`), foco gestionado entre vistas, `aria-live` en el temporizador, `prefers-reduced-motion`, contraste AA, el botón de firma funciona con teclado.
- **Temporizador preciso**: basado en marcas de tiempo absolutas, no en contar ticks.
- **Design tokens**: colores, tipografía y espaciado centralizados en `styles/tokens.css`.
- **Mobile-first** y PWA instalable (manifest).

## Paleta

| Token | Color | Uso |
| --- | --- | --- |
| `--c-bg` | `#120F0D` | Carbón (fondo) |
| `--c-surface` | `#1C1815` | Tarjetas |
| `--c-ember` | `#FF5F1F` | Acción principal, fuego |
| `--c-ember-soft` | `#FF9A3C` | Acentos |
| `--c-amber` | `#FFC857` | Foco, destacados |
| `--c-mint` | `#5ED6A0` | Descanso / éxito |
| `--c-text` | `#F6EFE7` | Texto |

Tipografías: **Bricolage Grotesque** (títulos) + **Inter** (texto).

## Próximos pasos sugeridos

- Push real desde servidor (para notificar con la app cerrada).
- Migrar a Vite + TypeScript cuando haya Node disponible.
- Sincronización en tiempo real entre pestañas/dispositivos (Supabase Realtime).
- Compañero de pacto: compartir tu racha con alguien que te pida cuentas.
