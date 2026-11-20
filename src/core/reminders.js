import { toISODate } from '../domain/dates.js';
import { buildReminderICS, nextReminderAt } from '../domain/reminder.js';

/**
 * Recordatorios en el navegador.
 * Limitación honesta de la web: sin un servidor de push, las notificaciones solo se
 * disparan mientras Brasa esté abierta (aunque sea en segundo plano). Por eso
 * ofrecemos también el archivo de calendario, que funciona siempre.
 */

const MAX_TIMEOUT_MS = 2_147_483_647;
const NOTIFICATION_TITLE = 'Tu brasa te espera 🔥';

export const notificationsSupported = () => 'Notification' in window;

export const notificationPermission = () => (notificationsSupported() ? Notification.permission : 'unsupported');

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

export async function showReminder(profile) {
  const options = {
    body: profile?.why ? `“${profile.why}” — Aunque sean 2 minutos.` : 'Aunque sean 2 minutos. Nunca dos días seguidos.',
    icon: 'assets/icons/brasa.svg',
    badge: 'assets/icons/brasa.svg',
    tag: 'brasa-recordatorio',
    renotify: true,
    data: { url: './#/hoy' },
  };
  // Se prefiere el service worker: en Android `new Notification()` no está permitido.
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) return registration.showNotification(NOTIFICATION_TITLE, options);
  return new Notification(NOTIFICATION_TITLE, options);
}

export function downloadReminderICS({ time, why }) {
  const appUrl = `${window.location.origin}${window.location.pathname}#/hoy`;
  const blob = new Blob([buildReminderICS({ time, why, appUrl })], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: 'brasa-recordatorio.ics' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Programa el aviso diario: solo notifica si ese día aún no has entrenado. */
export function createReminderScheduler({ store }) {
  let timeoutId = null;

  function schedule() {
    clearTimeout(timeoutId);
    timeoutId = null;
    const { reminder } = store.getState();
    if (!reminder.enabled || notificationPermission() !== 'granted') return;

    // +1 s evita re-disparar si el temporizador del navegador se adelanta unos milisegundos.
    const at = nextReminderAt(new Date(Date.now() + 1000), reminder.time);
    timeoutId = setTimeout(fire, Math.min(at - Date.now(), MAX_TIMEOUT_MS));
  }

  async function fire() {
    const { profile, sessions } = store.getState();
    const today = toISODate();
    if (profile && !sessions.some((s) => s.date === today)) {
      try {
        await showReminder(profile);
      } catch (error) {
        console.warn('[brasa] No se pudo mostrar el recordatorio.', error);
      }
    }
    schedule();
  }

  return {
    start() {
      store.subscribe(schedule);
      // Los temporizadores se pausan si el equipo duerme: reprogramar al volver.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') schedule();
      });
      schedule();
    },
  };
}
