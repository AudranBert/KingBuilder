import { message as sourceMessage } from "./i18n.js";
const SESSION_KEY = 'kingbuilder-online';
function stores() {
  return ['sessionStorage', 'localStorage'].flatMap(name => {
    try { return globalThis[name] ? [globalThis[name]] : []; } catch { return []; }
  });
}
export function clearSavedSession(expected = null) {
  for (const storage of stores()) try {
    if (expected) {
      const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
      if (saved?.code !== expected.code || saved?.token !== expected.token) continue;
    }
    storage.removeItem(SESSION_KEY);
  } catch { /* Storage may be disabled. */ }
}
export function savedSession() {
  for (const storage of stores()) {
    try {
      const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
      if (saved && /^[A-F0-9]{10}$/.test(saved.code) && typeof saved.token === 'string' && saved.token && typeof saved.url === 'string') return saved;
    } catch { /* Ignore corrupt or inaccessible storage. */ }
  }
  return null;
}
export class OnlineClient {
  constructor(onState, onError) {
    this.onState = onState; this.onError = onError; this.session = null; this.timer = null; this.busy = false;
    this.generation = 0;
  }
  async configure() {
    const response = await fetch(new URL('../online-config.json', import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw Error(sourceMessage("messages.multiplayerConfigurationNotFound"));
    const { apiUrl } = await response.json();
    this.url = new URL(apiUrl).href.replace(/\/$/, '');
  }
  async request(path, body, token = this.session?.token) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 75000);
    try {
      const response = await fetch(this.url + path, {
        method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      if (!response.ok) {
        const error = Error(result.error || sourceMessage("messages.serverUnavailable"));
        error.status = response.status;
        throw error;
      }
      return result;
    } finally { clearTimeout(timer); }
  }
  accept(result) {
    if (this.session?.code === result.code && result.revision < this.session.revision) return;
    this.session = { ...this.session, ...result };
    if (result.game.finished) clearSavedSession(this.session);
    else for (const storage of stores()) {
      try { storage.setItem(SESSION_KEY, JSON.stringify({ code: this.session.code, token: this.session.token, url: this.url })); } catch { /* Private browsing may disable storage. */ }
    }
    this.onState(result);
  }
  async connect(code, settings, nickname = '') {
    this.stop(); await this.configure();
    this.accept(await this.request(code ? `/rooms/${code.toUpperCase()}/join` : '/rooms', code ? { nickname } : { settings, nickname }));
    this.poll();
  }
  async resume() {
    this.stop();
    const saved = savedSession();
    if (!saved) throw Error(sourceMessage("messages.noGameToResumeInThisTab"));
    await this.configure();
    if (saved.url !== this.url) throw Error(sourceMessage("messages.theServerAddressHasChanged"));
    const result = await this.readSaved(saved);
    if (result.game.finished) {
      clearSavedSession(saved);
      throw Error(sourceMessage("messages.noGameToResumeInThisTab"));
    }
    this.session = saved;
    this.accept(result); this.poll();
  }
  async readSaved(saved) {
    try { return await this.request(`/rooms/${saved.code}`, undefined, saved.token); }
    catch (error) {
      if ([401, 403, 404, 410].includes(error.status)) clearSavedSession(saved);
      throw error;
    }
  }
  async canResume() {
    const saved = savedSession();
    if (!saved) return false;
    await this.configure();
    if (saved.url !== this.url) { clearSavedSession(saved); return false; }
    const result = await this.readSaved(saved);
    if (result.game.finished) { clearSavedSession(saved); return false; }
    return true;
  }
  poll() {
    clearTimeout(this.timer);
    const generation = this.generation;
    this.timer = setTimeout(async () => {
      if (!this.session) return;
      if (!this.busy) try {
        const result = await this.request(`/rooms/${this.session.code}`);
        if (generation === this.generation) this.accept(result);
      } catch (error) { if (generation === this.generation) this.onError(error); }
      if (this.session && generation === this.generation) this.poll();
    }, 2000);
  }
  async send(command) {
    this.busy = true;
    try {
      this.accept(await this.request(`/rooms/${this.session.code}/commands`, {
        id: crypto.randomUUID(), revision: this.session.revision, command,
      }));
    } catch (error) {
      try { this.accept(await this.request(`/rooms/${this.session.code}`)); } catch { /* Keep last confirmed state. */ }
      throw error;
    } finally { this.busy = false; }
  }
  async lobby(settings, start = false) {
    if (this.busy) return;
    this.busy = true;
    try {
      this.accept(await this.request(`/rooms/${this.session.code}/lobby`, { settings, start, revision: this.session.revision }));
    } finally { this.busy = false; }
  }
  async resign() {
    this.accept(await this.request(`/rooms/${this.session.code}/resign`, {}));
    this.stop();
  }
  async profile(nickname) {
    this.busy = true;
    try { this.accept(await this.request(`/rooms/${this.session.code}/profile`, { nickname })); }
    finally { this.busy = false; }
  }
  stop() { clearTimeout(this.timer); this.session = null; this.generation++; }
}
