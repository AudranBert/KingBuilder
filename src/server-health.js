// One bounded probe at a time, active only while the online dialog is open.
export function monitorServerHealth(onStatus, intervalMs = 10000) {
  let stopped = false, timer, controller;
  async function probe() {
    const started = Date.now();
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(9000, intervalMs));
    try {
      const config = await fetch(new URL('../online-config.json', import.meta.url), { signal: controller.signal, cache: 'no-store' });
      if (!config.ok) throw Error('Configuration indisponible');
      const { apiUrl } = await config.json();
      const response = await fetch(new URL('health', apiUrl.replace(/\/?$/, '/')), { signal: controller.signal, cache: 'no-store' });
      if (!response.ok || (await response.json()).status !== 'ok') throw Error('Serveur indisponible');
      if (!stopped) onStatus(true);
    } catch {
      if (!stopped) onStatus(false);
    } finally {
      clearTimeout(timeout);
      if (!stopped) timer = setTimeout(probe, Math.max(0, intervalMs - (Date.now() - started)));
    }
  }
  onStatus(null);
  probe();
  return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
}
