import { canonical, digest, uuid } from "./crypto";
import { validateRecord } from "./validation";

const TYPES = ["citoyen", "acte"];
const FIELDS = {
  citoyen: ["nom", "prenom", "telephone", "cin", "adresse", "fokontany_id"],
  acte: [
    "type_acte",
    "nom_concerne",
    "date_evenement",
    "lieu_evenement",
    "details_json",
    "citoyen_id",
    "fokontany_id",
  ],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const empty = () => ({
  v: 1,
  generation: 0,
  device: uuid(),
  scope: null,
  cursors: { citoyen: null, acte: null },
  remote: { citoyen: {}, acte: {} },
  outbox: [],
  catalogue: [],
  lastSync: null,
  notice: "",
});
const locked = (entry) =>
  entry?.metadata?.is_validated ||
  ["Validé", "Rejeté"].includes(entry?.metadata?.statut);

export class OfflineEngine {
  constructor({
    store,
    api,
    user,
    onChange = () => {},
    onAuth = () => {},
    onProfile = () => {},
    now = () => Date.now(),
  }) {
    Object.assign(this, { store, api, user, onChange, onAuth, onProfile, now });
    this.writes = Promise.resolve();
    this.closed = false;
    this.online = false;
    this.busy = false;
    this.error = "";
  }
  async init() {
    await this.store.init();
    this.state = (await this.store.read()) || empty();
    if (this.state.v !== 1 || !Array.isArray(this.state.outbox))
      throw new Error("Version du cache local non reconnue");
    if (
      this.state.profile &&
      String(this.state.profile.id) === String(this.user.id)
    )
      this.user = this.state.profile;
    this.emit();
  }
  emit() {
    if (!this.closed) this.onChange(this.snapshot());
  }
  snapshot() {
    return {
      generation: this.state?.generation || 0,
      ready: !!this.state?.scope,
      online: this.online,
      busy: this.busy,
      error: this.error,
      pending: this.state?.outbox.filter((o) => !o.issue).length || 0,
      issues: (this.state?.outbox.filter((o) => o.issue) || []).map((o) => ({
        ...clone(o),
        server: clone(
          this.state.remote[o.record.entity_type][o.record.entity_id] || null,
        ),
      })),
      fokontany: clone(this.state?.catalogue || []),
      lastSync: this.checkedAt || this.state?.lastSync,
      notice: this.state?.notice || "",
      citizens: this.list("citoyen"),
      actes: this.list("acte"),
    };
  }
  list(type) {
    if (!this.state) return [];
    const items = {};
    for (const [id, entry] of Object.entries(this.state.remote[type])) {
      if (!entry.metadata?.removed && entry.metadata?.is_active !== false)
        items[id] = {
          id,
          ...entry.data,
          ...entry.metadata,
          _timestamp: entry.timestamp,
          _version: entry.version,
          _provisional: !!entry.provisional,
        };
    }
    for (const op of this.state.outbox.filter(
      (o) => o.record.entity_type === type,
    )) {
      const id = op.record.entity_id;
      if (locked(this.state.remote[type][id])) continue;
      items[id] = {
        ...items[id],
        id,
        ...op.record.data,
        _timestamp: op.record.timestamp,
        _pending: true,
        _issue: op.issue || null,
      };
    }
    return Object.values(items);
  }
  transaction(change) {
    const task = this.writes.then(async () => {
      if (this.closed)
        throw new Error("Session fermée ; saisie non enregistrée");
      const next = clone(this.state);
      change(next);
      if (JSON.stringify(next) === JSON.stringify(this.state)) return;
      await this.store.write(next);
      if (!this.closed) {
        this.state = next;
        this.emit();
      }
    });
    this.writes = task.catch(() => {});
    return task;
  }
  async enqueue(type, data, id = null, { replace = false } = {}) {
    if (this.closed || !this.state.scope)
      throw new Error("Une première synchronisation en ligne est nécessaire");
    if (
      !["Agent Fokontany", "Administrateur", "Superviseur"].includes(
        this.user.role,
      )
    )
      throw new Error("Compte en lecture seule");
    if (
      !FIELDS[type] ||
      Object.keys(data).some((k) => !FIELDS[type].includes(k))
    )
      throw new Error("Champs non modifiables");
    if (locked(this.state.remote[type][id]))
      throw new Error("Ce dossier est verrouillé");
    data = { ...data };
    if (
      !id &&
      this.user.role === "Agent Fokontany" &&
      data.fokontany_id === null
    )
      delete data.fokontany_id;
    const previousView = id
      ? this.list(type).find((row) => row.id === id)
      : null;
    const base = Object.fromEntries(
      FIELDS[type]
        .filter((k) => previousView?.[k] !== undefined)
        .map((k) => [k, previousView[k]]),
    );
    const checked = validateRecord(type, { ...base, ...data });
    data = id
      ? Object.fromEntries(Object.keys(data).map((k) => [k, checked[k]]))
      : checked;
    const entityId = id || uuid();
    if (replace && this.sent?.some((o) => o.record.entity_id === entityId))
      throw new Error("Envoi en cours ; réessayez après la synchronisation");
    await this.transaction((state) => {
      const previous = state.outbox.filter(
        (o) => o.record.entity_id === entityId,
      );
      const timestamp = new Date(
        Math.max(
          this.now(),
          ...previous.map((o) => Date.parse(o.record.timestamp) + 1),
        ),
      ).toISOString();
      if (replace)
        state.outbox = state.outbox.filter(
          (o) => o.record.entity_id !== entityId,
        );
      const record = {
        entity_type: type,
        entity_id: entityId,
        client_id: state.device,
        timestamp,
        data: clone(data),
        hash_format: "json-v1",
        hash: digest(canonical(data)),
      };
      state.outbox.push({ id: uuid(), record, issue: null });
    });
    return entityId;
  }
  async discard(type, id) {
    if (this.sent?.some((o) => o.record.entity_id === id))
      throw new Error("Envoi en cours");
    await this.transaction((state) => {
      state.outbox = state.outbox.filter(
        (o) => !(o.record.entity_type === type && o.record.entity_id === id),
      );
    });
  }
  async retry(type, id) {
    if (this.sent?.some((o) => o.record.entity_id === id))
      throw new Error("Envoi en cours");
    await this.transaction((state) => {
      for (const op of state.outbox.filter(
        (o) => o.record.entity_type === type && o.record.entity_id === id,
      )) {
        if (
          [
            "server_newer",
            "timestamp_collision",
            "record_locked",
            "forbidden",
          ].includes(op.issue)
        )
          throw new Error(
            "Consultez la version serveur puis modifiez ou abandonnez votre saisie",
          );
        op.issue = null;
      }
    });
  }
  async reset(scope, reason) {
    try {
      await this.transaction((state) => {
        const count = state.outbox.length;
        state.generation = (state.generation || 0) + 1;
        state.remote = { citoyen: {}, acte: {} };
        state.cursors = { citoyen: null, acte: null };
        state.outbox = [];
        state.scope = scope;
        state.notice = `${reason} Cache réinitialisé ; ${count} modification(s) locale(s) non transmise(s) retirée(s).`;
      });
    } catch {
      this.state = empty();
      this.emit();
      throw Object.assign(
        new Error("Accès local verrouillé : stockage indisponible"),
        { status: 403 },
      );
    }
  }
  async pull(type, resetAllowed = true) {
    while (!this.closed) {
      let page;
      try {
        page = await this.api.pull(type, this.state.cursors[type]);
      } catch (error) {
        if (error.status === 409 && resetAllowed) {
          await this.reset(null, "Périmètre ou curseur modifié.");
          const check = await this.api.pull("citoyen", null, 1);
          await this.transaction((s) => {
            s.scope = check.scope;
          });
          return this.pull(type, false);
        }
        throw error;
      }
      if (this.closed) return;
      if (
        !Array.isArray(page.items) ||
        !page.cursor ||
        !Number.isSafeInteger(page.cursor.version) ||
        page.cursor.version < 0 ||
        page.cursor.scope !== page.scope ||
        typeof page.has_more !== "boolean" ||
        !/^[a-f0-9]{64}$/.test(page.scope || "")
      )
        throw new Error("Réponse de synchronisation invalide");
      if (page.scope !== this.state.scope) {
        await this.reset(page.scope, "Votre périmètre a changé.");
        return this.pull(type, false);
      }
      const before = JSON.stringify(this.state.cursors[type]);
      await this.transaction((state) => {
        for (const item of page.items) {
          if (
            !item.entity_id ||
            !Number.isSafeInteger(item.version) ||
            item.version < 0 ||
            !item.metadata
          )
            throw new Error("Changement serveur invalide");
          const previous = state.remote[type][item.entity_id];
          if (previous && previous.version > item.version) continue;
          const removed =
            item.metadata.removed || item.metadata.is_active === false;
          state.remote[type][item.entity_id] = removed
            ? { version: item.version, metadata: { removed: true } }
            : clone(item);
          if (removed) {
            const count = state.outbox.length;
            state.outbox = state.outbox.filter(
              (o) =>
                o.record.entity_id !== item.entity_id &&
                !(
                  type === "citoyen" &&
                  o.record.data.citoyen_id === item.entity_id
                ),
            );
            if (state.outbox.length !== count)
              state.notice =
                "Des dossiers ne sont plus accessibles ; leurs saisies locales ont été retirées.";
          } else if (locked(item)) {
            for (const op of state.outbox.filter(
              (o) => o.record.entity_id === item.entity_id,
            ))
              op.issue = "record_locked";
          }
        }
        state.cursors[type] = clone(page.cursor);
      });
      if (!page.has_more) return;
      if (before === JSON.stringify(page.cursor))
        throw new Error("Curseur serveur sans progression");
    }
  }
  batch() {
    const selected = [],
      seen = new Set();
    for (const type of TYPES)
      for (const op of this.state.outbox) {
        if (
          op.record.entity_type !== type ||
          seen.has(type + op.record.entity_id)
        )
          continue;
        seen.add(type + op.record.entity_id);
        if (op.issue) continue;
        if (
          type === "acte" &&
          this.state.outbox.some(
            (o) =>
              o.record.entity_type === "citoyen" &&
              o.record.entity_id === op.record.data.citoyen_id,
          )
        )
          continue;
        selected.push(clone(op));
        if (selected.length >= 50) return selected;
      }
    return selected;
  }
  synchronize() {
    if (this.flight) return this.flight;
    if (this.closed || !this.online) return Promise.resolve();
    this.flight = this.run().finally(() => {
      this.flight = null;
    });
    return this.flight;
  }
  async run() {
    this.busy = true;
    this.verified = false;
    this.authBlocked = false;
    this.error = "";
    this.emit();
    try {
      const profile = await this.api.me();
      if (this.closed) return;
      if (String(profile.id) !== String(this.user.id))
        throw Object.assign(new Error("Session différente"), { status: 401 });
      if (
        this.state.scope &&
        (this.user.role !== profile.role ||
          this.user.fokontany !== profile.fokontany)
      )
        await this.reset(null, "Votre affectation a changé.");
      await this.transaction((s) => {
        s.profile = clone(profile);
      });
      this.user = profile;
      this.onProfile(profile);
      const check = await this.api.pull("citoyen", null, 1);
      if (this.closed) return;
      if (!/^[a-f0-9]{64}$/.test(check.scope || ""))
        throw new Error("Périmètre serveur invalide");
      if (this.state.scope && this.state.scope !== check.scope)
        await this.reset(check.scope, "Votre périmètre a changé.");
      else
        await this.transaction((s) => {
          s.scope = check.scope;
        });
      this.verified = true;
      if (this.api.fokontany) {
        try {
          const catalogue = await this.api.fokontany();
          if (Array.isArray(catalogue))
            await this.transaction((s) => {
              s.catalogue = catalogue.map((f) => ({ id: f.id, nom: f.nom }));
            });
        } catch (error) {
          if (error.status === 401) throw error;
        }
      }
      for (const type of TYPES) await this.pull(type);
      let rounds = 0;
      while (!this.closed && this.online && rounds++ < 20) {
        const batch = this.batch();
        if (!batch.length) break;
        this.sent = batch;
        const reply = await this.api.push(batch.map((o) => o.record));
        if (this.closed) return;
        if (
          !Array.isArray(reply.results) ||
          reply.results.length !== batch.length
        )
          throw new Error("Acquittement serveur incomplet");
        const indexes = new Set();
        for (const result of reply.results) {
          const op = batch[result.index];
          if (
            !Number.isInteger(result.index) ||
            !op ||
            indexes.has(result.index) ||
            result.entity_id !== op.record.entity_id ||
            result.entity_type !== op.record.entity_type ||
            !["accepted", "errors", "conflicts"].includes(result.status) ||
            (result.status === "accepted" &&
              !["applied", "already_applied"].includes(result.code))
          )
            throw new Error("Acquittement serveur invalide");
          indexes.add(result.index);
        }
        await this.transaction((state) => {
          for (const result of reply.results) {
            const sent = batch[result.index];
            const op = state.outbox.find((o) => o.id === sent.id);
            if (!op) continue;
            if (result.status === "accepted") {
              const remote =
                state.remote[op.record.entity_type][op.record.entity_id];
              if (
                !remote ||
                Date.parse(remote.timestamp) < Date.parse(op.record.timestamp)
              )
                state.remote[op.record.entity_type][op.record.entity_id] = {
                  version: remote?.version ?? -1,
                  data: { ...remote?.data, ...op.record.data },
                  timestamp: op.record.timestamp,
                  metadata: remote?.metadata || {},
                  provisional: true,
                };
              state.outbox = state.outbox.filter((o) => o.id !== op.id);
            } else if (result.code === "forbidden") {
              state.remote[op.record.entity_type][op.record.entity_id] = {
                version: 0,
                metadata: { removed: true },
              };
              state.outbox = state.outbox.filter(
                (o) =>
                  o.record.entity_id !== op.record.entity_id &&
                  o.record.data.citoyen_id !== op.record.entity_id,
              );
              state.notice =
                "Un dossier n’est plus accessible ; ses modifications locales ont été retirées.";
            } else op.issue = result.code || result.status;
          }
        });
        this.sent = null;
      }
      for (const type of TYPES) await this.pull(type);
      this.checkedAt = new Date(this.now()).toISOString();
      if (
        !this.state.lastSync ||
        this.now() - Date.parse(this.state.lastSync) >= 300000
      )
        await this.transaction((s) => {
          s.lastSync = this.checkedAt;
        });
    } catch (error) {
      if (this.closed) return;
      this.error =
        error.status === 401
          ? "Session expirée ; reconnectez-vous. Vos saisies sont conservées."
          : error.message || "Synchronisation interrompue";
      if (error.status === 401 || error.status === 403) this.authBlocked = true;
      if (error.status === 403) {
        try {
          await this.reset(null, "Accès au périmètre refusé.");
        } catch {
          this.state = empty();
        }
        this.onAuth(this.error);
      } else if (error.status === 401) this.onAuth(this.error);
    } finally {
      this.sent = null;
      this.busy = false;
      this.emit();
    }
  }
  setOnline(value) {
    this.online = value;
    this.emit();
    if (value) return this.synchronize();
  }
  async dispose({ purge = false } = {}) {
    this.closed = true;
    await this.writes;
    if (purge) await this.store.clear();
    this.state = null;
  }
}
