/** Cuenta: guardar el progreso en la nube y recuperarlo en otro dispositivo. */
import { html, render } from '../core/dom.js';

const timeFormatter = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function syncStatusText({ phase, lastSyncedAt, error }) {
  if (phase === 'syncing') return 'Sincronizando…';
  if (phase === 'offline') return 'Sin conexión: se guardará en la nube al reconectar.';
  if (phase === 'error') return error ?? 'No se pudo sincronizar.';
  if (phase === 'synced' && lastSyncedAt) return `✓ Guardado en la nube a las ${timeFormatter.format(new Date(lastSyncedAt))}.`;
  return '';
}

export function accountView({ store, sync, navigate }) {
  let root;
  let panel;
  let mode = null;
  let step = 'email';
  let email = '';
  let busy = false;
  let unsubscribe;

  const hadPact = Boolean(store.getState().profile);

  const modeOf = (phase) => {
    if (phase === 'disabled' || phase === 'loading') return phase;
    return sync.isSignedIn() ? 'signed-in' : phase === 'signed-out' ? 'signed-out' : 'unavailable';
  };

  /* ---------- Plantillas ---------- */

  const templates = {
    disabled: () => html`
      <article class="card">
        <p>La nube no está configurada en esta instalación de Brasa.</p>
        <p class="field__hint">Tus datos se guardan solo en este dispositivo.</p>
      </article>
    `,
    loading: () => html`<p class="muted" role="status">Conectando…</p>`,
    unavailable: () => html`
      <article class="card">
        <p>No pudimos conectar con la nube ahora.</p>
        <p class="field__hint" data-ref="status" role="status"></p>
        <button type="button" class="btn btn--secondary btn--block" data-action="retry">Reintentar</button>
      </article>
    `,
    'signed-out': () =>
      step === 'email'
        ? html`
            <form class="card account__form" data-form="email" novalidate>
              <p class="muted">
                Entra con tu correo para guardar tu pacto y tu historial en la nube y recuperarlos en cualquier
                dispositivo. Sin contraseñas: te enviamos un código.
              </p>
              <label class="field">
                <span class="field__label">Correo electrónico</span>
                <input class="input" type="email" name="email" autocomplete="email" inputmode="email" value="${email}" required />
              </label>
              <p class="field__hint account__error" data-ref="error" role="alert"></p>
              <button class="btn btn--primary btn--block" type="submit">Enviarme un código</button>
            </form>
          `
        : html`
            <form class="card account__form" data-form="code" novalidate>
              <p class="muted">
                Te enviamos un correo a <strong>${email}</strong>. Escribe el código o abre el enlace en este mismo
                navegador.
              </p>
              <label class="field">
                <span class="field__label">Código</span>
                <input
                  class="input account__code"
                  name="code"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  pattern="[0-9]*"
                  maxlength="10"
                  required
                />
              </label>
              <p class="field__hint account__error" data-ref="error" role="alert"></p>
              <button class="btn btn--primary btn--block" type="submit">Entrar</button>
              <button class="btn btn--ghost btn--block" type="button" data-action="change-email">Usar otro correo</button>
            </form>
          `,
    'signed-in': () => html`
      <article class="card account__signed">
        <p>Conectado como <strong>${sync.getStatus().email}</strong></p>
        <p class="field__hint" data-ref="status" role="status"></p>
        <button type="button" class="btn btn--secondary btn--block" data-action="sync">Sincronizar ahora</button>
        <button type="button" class="btn btn--secondary btn--block" data-action="sign-out">Cerrar sesión</button>
        <p class="field__hint">Al cerrar sesión, tus datos siguen en este dispositivo.</p>
      </article>
    `,
  };

  /* ---------- Render ---------- */

  function renderPanel() {
    render(panel, templates[mode]());
    refreshStatus();
    panel.querySelector('input')?.focus();
  }

  function refreshStatus() {
    const target = panel.querySelector('[data-ref="status"]');
    if (target) target.textContent = syncStatusText(sync.getStatus());
  }

  function onStatus(status) {
    const next = modeOf(status.phase);
    if (next !== mode) {
      mode = next;
      if (mode === 'signed-out') step = 'email';
      renderPanel();
    } else {
      refreshStatus();
    }
  }

  function showError(message) {
    const target = panel.querySelector('[data-ref="error"]');
    if (target) target.textContent = message;
  }

  function setBusy(form, value) {
    busy = value;
    form.querySelectorAll('button, input').forEach((el) => (el.disabled = value));
  }

  /* ---------- Eventos ---------- */

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.target;
    if (busy) return;

    if (form.dataset.form === 'email') {
      email = form.email.value.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) return showError('Escribe un correo válido.');
      setBusy(form, true);
      try {
        await sync.requestCode(email);
        step = 'code';
        setBusy(form, false);
        renderPanel();
      } catch (error) {
        setBusy(form, false);
        showError(error.message);
      }
    }

    if (form.dataset.form === 'code') {
      const code = form.code.value.replace(/\D/g, '');
      if (code.length < 6) return showError('El código tiene al menos 6 dígitos.');
      setBusy(form, true);
      try {
        await sync.verifyCode(email, code);
        // La sincronización inicial ya terminó: si la cuenta tenía un pacto, ¡a entrenar!
        if (!hadPact && store.getState().profile) navigate('/hoy');
      } catch (error) {
        if (root.isConnected && form.isConnected) {
          setBusy(form, false);
          showError(error.message);
        }
      }
    }
  }

  async function onClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'change-email') {
      step = 'email';
      renderPanel();
    }
    if (action === 'retry') sync.start();
    if (action === 'sync') sync.syncNow();
    if (action === 'sign-out') {
      try {
        await sync.signOut();
      } catch (error) {
        console.warn('[brasa] No se pudo cerrar sesión.', error);
      }
    }
  }

  return {
    mount(el) {
      root = el;
      render(
        root,
        html`
          <section class="account">
            <header>
              <a class="eyebrow account__back" href="${hadPact ? '#/perfil' : '#/pacto'}">← Volver</a>
              <h1>${hadPact ? 'Tu brasa en la nube' : 'Recupera tu brasa'}</h1>
            </header>
            <div data-ref="panel"></div>
          </section>
        `,
      );
      panel = root.querySelector('[data-ref="panel"]');
      root.addEventListener('submit', onSubmit);
      root.addEventListener('click', onClick);
      unsubscribe = sync.subscribe(onStatus);
      onStatus(sync.getStatus());
    },
    destroy() {
      unsubscribe?.();
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('click', onClick);
    },
  };
}
