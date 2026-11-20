import { createReminderScheduler } from './core/reminders.js';
import { createRouter } from './core/router.js';
import { createStore } from './core/store.js';
import { createSupabaseClient, isCloudConfigured } from './core/supabase.js';
import { createSync } from './core/sync.js';
import { SUPABASE } from './config.js';
import { accountView } from './views/account.js';
import { homeView } from './views/home.js';
import { onboardingView } from './views/onboarding.js';
import { profileView } from './views/profile.js';
import { progressView } from './views/progress.js';
import { workoutView } from './views/workout.js';

/** chrome: si la vista muestra la barra de navegación inferior. */
const ROUTES = {
  '/pacto': { view: onboardingView, title: 'Tu pacto', chrome: false },
  '/hoy': { view: homeView, title: 'Hoy', chrome: true },
  '/entreno': { view: workoutView, title: 'Entrenando', chrome: false },
  '/progreso': { view: progressView, title: 'Progreso', chrome: true },
  '/perfil': { view: profileView, title: 'Mi pacto', chrome: true },
  '/cuenta': { view: accountView, title: 'Cuenta', chrome: false },
};

/** Rutas accesibles sin pacto (p. ej. recuperar la cuenta en un dispositivo nuevo). */
const PUBLIC_ROUTES = new Set(['/pacto', '/cuenta']);

const store = createStore();
const sync = createSync({
  store,
  configured: isCloudConfigured(SUPABASE),
  loadClient: () => createSupabaseClient(SUPABASE),
  redirectTo: `${window.location.origin}${window.location.pathname}`,
});
const outlet = document.getElementById('app');
const tabbar = document.getElementById('tabbar');

function guard(path, params) {
  const hasPact = Boolean(store.getState().profile);
  if (!ROUTES[path]) return hasPact ? '/hoy' : '/pacto';
  if (!hasPact && !PUBLIC_ROUTES.has(path)) return '/pacto';
  if (hasPact && path === '/pacto' && !params.editar) return '/hoy';
  return null;
}

function onChange(path, route) {
  document.title = `${route.title} · Brasa`;
  tabbar.hidden = !route.chrome;
  outlet.classList.toggle('view--bare', !route.chrome);
  tabbar.querySelectorAll('a').forEach((link) => {
    if (link.getAttribute('href') === `#${path}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  // Accesibilidad: al cambiar de vista, mover el foco al título (si la vista no lo movió ya).
  if (!outlet.contains(document.activeElement)) {
    const heading = outlet.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }
  window.scrollTo(0, 0);
}

const router = createRouter({ routes: ROUTES, outlet, context: { store, sync }, guard, onChange });
router.start();
sync.start();

// Dispositivo nuevo: si el pacto llega desde la nube (p. ej. tras abrir el enlace del correo), ir a Hoy.
sync.subscribe(({ phase }) => {
  const onPact = window.location.hash.startsWith('#/pacto') && !window.location.hash.includes('editar');
  if (phase === 'synced' && onPact && store.getState().profile) router.navigate('/hoy', { replace: true });
});
createReminderScheduler({ store }).start();

// Modo sin conexión (requiere http/https; localhost cuenta como seguro).
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('[brasa] No se pudo registrar el service worker.', error);
    });
  });
}
