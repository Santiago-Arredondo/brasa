/**
 * Plantillas HTML seguras.
 * Todo valor interpolado se escapa por defecto (previene XSS con datos del usuario,
 * p. ej. su "porqué"). Solo lo que viene de otro `html` o de `raw()` se inserta tal cual.
 */

class SafeHTML {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function serialize(value) {
  if (value instanceof SafeHTML) return value.value;
  if (Array.isArray(value)) return value.map(serialize).join('');
  if (value === false || value === null || value === undefined) return '';
  return escapeHTML(value);
}

/** Tagged template: html`<p>${texto}</p>` */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += serialize(value) + strings[i + 1];
  });
  return new SafeHTML(out);
}

/** Marca un string como HTML de confianza. Úsalo solo con contenido propio, nunca del usuario. */
export function raw(value) {
  return new SafeHTML(String(value));
}

export function render(element, template) {
  element.innerHTML = String(template);
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
