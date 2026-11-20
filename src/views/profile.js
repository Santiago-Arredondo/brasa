import { html, render } from '../core/dom.js';
import {
  downloadReminderICS,
  notificationPermission,
  requestNotificationPermission,
  showReminder,
} from '../core/reminders.js';
import { GOALS, LEVELS } from '../data/options.js';
import { isValidTime } from '../domain/reminder.js';
import { syncStatusText } from './account.js';

const signedFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' });

function reminderStatus({ enabled, time }, permission) {
  if (permission === 'unsupported') return 'Este navegador no admite notificaciones. Usa la opción de calendario.';
  if (permission === 'denied') return 'Bloqueaste las notificaciones. Actívalas en la configuración del navegador o usa el calendario.';
  if (enabled && permission === 'granted') return `Activo: a las ${time} te avisamos si aún no has entrenado.`;
  return 'Desactivado.';
}

export function profileView({ store, sync, navigate }) {
  let root;
  let deleteDialog;
  let unsubscribeSync;
  let signingOut = false;

  /* ---------- Nube ---------- */

  function cloudSummary(status) {
    if (status.phase === 'disabled') return null;
    if (sync.isSignedIn()) return { text: `${status.email} · ${syncStatusText(status) || 'Conectado.'}`, cta: 'Gestionar' };
    return {
      text: 'Hoy tu progreso vive solo en este dispositivo. Guárdalo en la nube para no perderlo nunca.',
      cta: 'Guardar mi progreso',
    };
  }

  function refreshCloudUI(status = sync.getStatus()) {
    const card = root.querySelector('[data-ref="cloud"]');
    const summary = cloudSummary(status);
    card.hidden = !summary;
    if (!summary) return;
    card.querySelector('[data-ref="cloud-text"]').textContent = summary.text;
    card.querySelector('[data-ref="cloud-cta"]').textContent = summary.cta;
    const signOutButton = card.querySelector('[data-action="sign-out"]');
    signOutButton.disabled = !sync.isSignedIn() || signingOut;
    signOutButton.textContent = signingOut ? 'Cerrando sesión…' : 'Cerrar sesión';
    root.querySelector('[data-ref="storage-note"]').textContent = sync.isSignedIn()
      ? 'Tus datos se guardan en este dispositivo y en tu cuenta.'
      : 'Tus datos se guardan solo en este dispositivo.';
    root.querySelector('[data-ref="delete-cloud-note"]').hidden = !sync.isSignedIn();
    root.querySelector('[data-ref="sign-out-note"]').hidden = sync.isSignedIn();
  }

  /* ---------- Recordatorio ---------- */

  function refreshReminderUI() {
    const { reminder } = store.getState();
    const permission = notificationPermission();
    const toggle = root.querySelector('[name="enabled"]');
    toggle.checked = reminder.enabled && permission === 'granted';
    toggle.disabled = permission === 'unsupported';
    root.querySelector('[data-action="test-reminder"]').disabled = permission !== 'granted';
    root.querySelector('[data-ref="reminder-status"]').textContent = reminderStatus(reminder, permission);
  }

  async function onReminderChange(event) {
    const { name, value, checked } = event.target;

    if (name === 'time' && isValidTime(value)) {
      store.actions.setReminder({ time: value });
    }

    if (name === 'enabled') {
      if (checked && notificationPermission() !== 'granted') {
        const result = await requestNotificationPermission();
        store.actions.setReminder({ enabled: result === 'granted' });
      } else {
        store.actions.setReminder({ enabled: checked });
      }
    }

    refreshReminderUI();
  }

  /* ---------- Eventos ---------- */

  async function onClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const { profile, reminder } = store.getState();

    if (action === 'delete') {
      root.querySelector('[data-ref="delete-error"]').textContent = '';
      deleteDialog.showModal();
    }
    if (action === 'sign-out' && sync.isSignedIn() && !signingOut) {
      signingOut = true;
      refreshCloudUI();
      try {
        await sync.signOut();
      } catch (error) {
        root.querySelector('[data-ref="cloud-text"]').textContent = error.message;
      } finally {
        signingOut = false;
        refreshCloudUI();
      }
    }
    if (action === 'calendar') downloadReminderICS({ time: reminder.time, why: profile.why });
    if (action === 'test-reminder') {
      try {
        await showReminder(profile);
      } catch (error) {
        console.warn('[brasa] No se pudo mostrar la notificación de prueba.', error);
      }
    }
  }

  async function onDeleteDialogClose() {
    if (deleteDialog.returnValue !== 'confirm') return;
    if (sync.isSignedIn()) {
      try {
        await sync.deleteAccount();
      } catch (error) {
        // Sin borrar en la nube no borramos lo local: volvería a subirse al iniciar sesión.
        root.querySelector('[data-ref="delete-error"]').textContent = error.message;
        deleteDialog.showModal();
        return;
      }
    }
    store.actions.reset();
    navigate('/pacto');
  }

  return {
    mount(el) {
      root = el;
      const { profile, reminder } = store.getState();
      const goal = GOALS.find((g) => g.id === profile.goal);
      const level = LEVELS.find((l) => l.id === profile.level);
      const offlineReady = Boolean(navigator.serviceWorker?.controller);

      render(
        root,
        html`
          <section class="profile">
            <header>
              <p class="eyebrow">Firmado el ${signedFormatter.format(new Date(profile.signedAt))}</p>
              <h1>Mi pacto</h1>
            </header>

            <article class="pact">
              <p>
                Yo, <strong>${profile.name}</strong>, me comprometo a moverme
                <strong>${profile.minutes} minutos</strong> al día para
                <strong>${goal?.title.toLowerCase()}</strong>.
              </p>
              <ul class="pact__clauses">
                <li>En un mal día, haré al menos <strong>2 minutos</strong>.</li>
                <li>Nunca fallaré <strong>dos días seguidos</strong>.</li>
              </ul>
              <p class="pact__why">“${profile.why}”</p>
            </article>

            <dl class="stats">
              <div class="stat"><dt>Nivel</dt><dd style="font-size:var(--fs-md)">${level?.title}</dd></div>
              <div class="stat"><dt>Meta diaria</dt><dd>${profile.minutes} min</dd></div>
            </dl>

            <article class="card reminder" aria-labelledby="reminder-title">
              <h2 id="reminder-title">⏰ Recordatorio diario</h2>
              <p class="muted">Solo te avisamos si a esa hora aún no has alimentado tu brasa, con tus propias palabras.</p>
              <form class="reminder__form" data-ref="reminder-form">
                <label class="switch">
                  <span>Notificaciones</span>
                  <input type="checkbox" role="switch" name="enabled" />
                </label>
                <label class="field">
                  <span class="field__label">Hora</span>
                  <input class="input" type="time" name="time" value="${reminder.time}" required />
                </label>
              </form>
              <p class="field__hint" data-ref="reminder-status" role="status"></p>
              <div class="reminder__actions">
                <button type="button" class="btn btn--secondary" data-action="test-reminder">Probar aviso</button>
                <button type="button" class="btn btn--secondary" data-action="calendar">📅 Añadir a mi calendario</button>
              </div>
              <p class="field__hint">
                Las notificaciones web solo llegan con Brasa abierta o instalada. Para no fallar nunca, añádelo también a
                tu calendario: suena aunque no abras la app.
              </p>
            </article>

            <article class="card cloud" data-ref="cloud" aria-labelledby="cloud-title" hidden>
              <h2 id="cloud-title">☁️ Tu brasa en la nube</h2>
              <p class="muted" data-ref="cloud-text" role="status"></p>
              <a class="btn btn--secondary btn--block" href="#/cuenta" data-ref="cloud-cta"></a>
              <button type="button" class="btn btn--ghost btn--block" data-action="sign-out" disabled>Cerrar sesión</button>
              <p class="field__hint" data-ref="sign-out-note">Inicia sesión con «Guardar mi progreso» para habilitar el cierre de sesión.</p>
            </article>

            <div class="profile__actions">
              <a class="btn btn--secondary btn--block" href="#/pacto?editar=1">Renovar mi pacto</a>
              <button type="button" class="btn btn--danger btn--block" data-action="delete">Borrar todos mis datos</button>
            </div>
            <p class="muted" style="font-size:var(--fs-sm);text-align:center">
              <span data-ref="storage-note">Tus datos se guardan solo en este dispositivo.</span>${offlineReady
                ? ' ✓ Funciona sin conexión.'
                : ''}
            </p>

            <dialog class="dialog" data-ref="delete-dialog" aria-labelledby="delete-title">
              <form method="dialog">
                <h2 id="delete-title">¿Borrar todo?</h2>
                <p class="muted" style="margin-top:var(--sp-2)">
                  Se eliminarán tu pacto y todo tu historial. No se puede deshacer.
                  <span data-ref="delete-cloud-note" hidden>También se borrará tu cuenta y todo lo guardado en la nube.</span>
                </p>
                <p class="field__hint account__error" data-ref="delete-error" role="alert"></p>
                <div class="dialog__actions">
                  <button class="btn btn--secondary" value="cancel" autofocus>Cancelar</button>
                  <button class="btn btn--danger" value="confirm">Sí, borrar todo</button>
                </div>
              </form>
            </dialog>
          </section>
        `,
      );

      deleteDialog = root.querySelector('[data-ref="delete-dialog"]');
      deleteDialog.addEventListener('close', onDeleteDialogClose);
      const reminderForm = root.querySelector('[data-ref="reminder-form"]');
      reminderForm.addEventListener('change', onReminderChange);
      reminderForm.addEventListener('submit', (event) => event.preventDefault());
      root.addEventListener('click', onClick);
      refreshReminderUI();
      unsubscribeSync = sync.subscribe((status) => refreshCloudUI(status));
      refreshCloudUI();
    },
    destroy() {
      unsubscribeSync?.();
      root.removeEventListener('click', onClick);
    },
  };
}
