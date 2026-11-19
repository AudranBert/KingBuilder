export class OnlineClient {
  constructor(onState, onError) {
    this.onState = onState; this.onError = onError; this.session = null; this.timer = null; this.busy = false;
    this.generation = 0;
  }
  async configure() {
    const response = await fetch(new URL('../online-config.json', import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw Error('Configuration multijoueur introuvable.');
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
      if (!response.ok) throw Error(result.error || 'Serveur indisponible.');
      return result;
    } finally { clearTimeout(timer); }
  }
  accept(result) {
    if (this.session?.code === result.code && result.revision < this.session.revision) return;
    this.session = { ...this.session, ...result };
    try { sessionStorage.setItem('kingbuilder-online', JSON.stringify({ code: this.session.code, token: this.session.token, url: this.url })); } catch { /* Private browsing may disable storage. */ }
    this.onState(result);
  }
  async connect(code, settings, nickname = '') {
    this.stop(); await this.configure();
    this.accept(await this.request(code ? `/rooms/${code.toUpperCase()}/join` : '/rooms', code ? { nickname } : { settings, nickname }));
    this.poll();
  }
  async resume() {
    this.stop();
    const saved = JSON.parse(sessionStorage.getItem('kingbuilder-online') || 'null');
    if (!saved) throw Error('Aucune partie à reprendre dans cet onglet.');
    await this.configure();
    if (saved.url !== this.url) throw Error('L’adresse du serveur a changé.');
    this.session = saved;
    this.accept(await this.request(`/rooms/${saved.code}`)); this.poll();
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
    sessionStorage.removeItem('kingbuilder-online');
  }
  async profile(nickname) {
    this.busy = true;
    try { this.accept(await this.request(`/rooms/${this.session.code}/profile`, { nickname })); }
    finally { this.busy = false; }
  }
  stop() { clearTimeout(this.timer); this.session = null; this.generation++; }
}
