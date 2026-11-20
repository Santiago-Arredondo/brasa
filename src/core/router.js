/**
 * Router por hash (#/ruta?param=valor). Sin dependencias y compatible con hosting estático.
 * Cada vista es una fábrica que devuelve { mount(el), destroy?() }.
 */
export function createRouter({ routes, outlet, context = {}, guard, onChange }) {
  let current = null;

  function parse() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, query = ''] = hash.split('?');
    return { path, params: Object.fromEntries(new URLSearchParams(query)) };
  }

  function resolve() {
    const { path, params } = parse();

    const redirect = guard?.(path, params);
    if (redirect && redirect !== path) {
      navigate(redirect, { replace: true });
      return;
    }

    const route = routes[path];
    current?.destroy?.();
    outlet.replaceChildren();
    current = route.view({ ...context, params, navigate });
    current.mount(outlet);
    onChange?.(path, route);
  }

  function navigate(path, { replace = false } = {}) {
    const url = `#${path}`;
    if (replace) {
      window.history.replaceState(null, '', url);
      resolve();
    } else if (window.location.hash === url) {
      resolve();
    } else {
      window.location.hash = path;
    }
  }

  window.addEventListener('hashchange', resolve);

  return { start: resolve, navigate };
}
