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
async function fetchJson(url, body, token) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let result;
    try { result = await response.json(); }
    catch (cause) {
      if (controller.signal.aborted || cause.name === "AbortError") throw cause;
      const error = Error(sourceMessage("network.serverUnavailable"));
      error.status = response.status;
      throw error;
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      const error = Error(sourceMessage("network.serverUnavailable"));
      error.status = response.status;
      throw error;
    }
    if (!response.ok) {
      const error = Error(result.error || sourceMessage("messages.serverUnavailable"));
      error.status = response.status;
      error.issue = result.issue;
      if (result.issue) error.code = result.issue.code;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.status !== undefined) throw error;
    throw Error(sourceMessage(controller.signal.aborted || error.name === 'AbortError'
      ? "network.timeout" : "network.connectionLost"));
  } finally { clearTimeout(timer); }
}

export class OnlineClient {
  constructor(onState, onError) {
    this.onState = onState; this.onError = onError; this.session = null; this.timer = null; this.busy = false;
    this.generation = 0;
  }
  async configure() {
    const generation = this.generation;
    const { apiUrl } = await fetchJson(new URL('../online-config.json', import.meta.url));
    if (generation === this.generation) this.url = new URL(apiUrl).href.replace(/\/$/, '');
  }
  request(path, body, token = this.session?.token) {
    return fetchJson(this.url + path, body, token);
  }
  accept(result, generation = this.generation) {
    if (generation !== this.generation) return;
    if (this.session?.code === result.code && result.revision < this.session.revision) return;
    this.session = { ...this.session, ...result, receivedAt: Date.now() };
    if (result.game.finished) clearSavedSession(this.session);
    else for (const storage of stores()) {
      try { storage.setItem(SESSION_KEY, JSON.stringify({ code: this.session.code, token: this.session.token, url: this.url })); } catch { /* Private browsing may disable storage. */ }
    }
    this.onState(result);
  }
  // A stopped or superseded operation must not restore state or clear a newer lock.
  async operation(work, { restart = false, exclusive = true } = {}) {
    if (restart) this.stop();
    else if (exclusive && this.busy) return;
    const generation = this.generation;
    const current = () => generation === this.generation;
    if (exclusive) this.busy = true;
    try { return await work(current, generation); }
    catch (error) { if (current()) throw error; }
    finally { if (current() && exclusive) this.busy = false; }
  }
  async connect(code, settings, nickname = '') {
    return this.operation(async (current, generation) => {
      await this.configure();
      if (!current()) return;
      if (!code && settings?.playerCount === 4) {
        const health = await this.request("/health");
        if (!current()) return;
        if (!health.supportedPlayerCounts?.includes(4)) throw Error(sourceMessage("four.backendUpdate"));
      }
      const result = await this.request(code ? `/rooms/${code.toUpperCase()}/join` : '/rooms', code ? { nickname } : { settings, nickname });
      if (!current()) return;
      this.accept(result, generation);
      this.poll();
    }, { restart: true });
  }
  async resume() {
    return this.operation(async (current, generation) => {
      const saved = savedSession();
      if (!saved) throw Error(sourceMessage("messages.noGameToResumeInThisTab"));
      await this.configure();
      if (!current()) return;
      if (saved.url !== this.url) throw Error(sourceMessage("messages.theServerAddressHasChanged"));
      const result = await this.readSaved(saved, generation);
      if (!current()) return;
      if (result.game.finished) {
        clearSavedSession(saved);
        throw Error(sourceMessage("messages.noGameToResumeInThisTab"));
      }
      this.session = saved;
      this.accept(result, generation);
      this.poll();
    }, { restart: true });
  }
  async readSaved(saved, generation = this.generation) {
    try { return await this.request(`/rooms/${saved.code}`, undefined, saved.token); }
    catch (error) {
      if (generation === this.generation && [401, 403, 404, 410].includes(error.status)) clearSavedSession(saved);
      throw error;
    }
  }
  async canResume() {
    const generation = this.generation;
    const saved = savedSession();
    if (!saved) return false;
    await this.configure();
    if (generation !== this.generation) return false;
    if (saved.url !== this.url) { clearSavedSession(saved); return false; }
    const result = await this.readSaved(saved, generation);
    if (generation !== this.generation) return false;
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
    return this.operation(async (current, generation) => {
      const session = this.session;
      try {
        this.accept(await this.request(`/rooms/${session.code}/commands`, {
          id: crypto.randomUUID(), revision: session.revision, command,
        }, session.token), generation);
      } catch (error) {
        if (!current()) return;
        try { this.accept(await this.request(`/rooms/${session.code}`, undefined, session.token), generation); }
        catch { /* Keep last confirmed state. */ }
        throw error;
      }
    });
  }
  async lobby(settings, start = false) {
    return this.operation(async (current, generation) => {
      const session = this.session;
      if (settings?.playerCount === 4 && session.game.players.length !== 4) {
        const health = await this.request("/health");
        if (!current()) return;
        if (!health.supportedPlayerCounts?.includes(4)) throw Error(sourceMessage("four.backendUpdate"));
      }
      this.accept(await this.request(`/rooms/${session.code}/lobby`, { settings, start, revision: session.revision }, session.token), generation);
    });
  }
  async resign() {
    const session = this.session;
    clearTimeout(this.timer);
    this.generation++;
    this.busy = false;
    return this.operation(async (current, generation) => {
      const result = await this.request(`/rooms/${session.code}/resign`, {}, session.token);
      if (!current()) return;
      this.accept({ ...result, token: session.token }, generation);
      this.stop();
    }).finally(() => { if (this.session === session) this.poll(); });
  }
  async profile(nickname) {
    return this.operation(async (current, generation) => {
      const session = this.session;
      this.accept(await this.request(`/rooms/${session.code}/profile`, { nickname }, session.token), generation);
    });
  }
  stop() { clearTimeout(this.timer); this.session = null; this.busy = false; this.generation++; }
}

export function remainingTurnSeconds(session, now = Date.now()) {
  const elapsed = Math.max(0, now - session.receivedAt);
  return Math.max(0, Math.ceil((session.deadline - session.serverNow - elapsed) / 1000));
}
