import { OfflineEngine } from "../src/offline/engine";
import { SecureStore } from "../src/offline/secureStore";
import { digest, canonical } from "../src/offline/crypto";

function adapters() {
  const values = new Map(),
    keys = new Map();
  return {
    values,
    keys,
    storage: {
      getItem: async (k) => values.get(k) ?? null,
      setItem: async (k, v) => values.set(k, v),
      removeItem: async (k) => values.delete(k),
      getAllKeys: async () => [...values.keys()],
    },
    vault: {
      get: async (k) => keys.get(k) ?? null,
      set: async (k, v) => keys.set(k, v),
      remove: async (k) => keys.delete(k),
    },
  };
}
const scope = "a".repeat(64);
function api() {
  return {
    me: jest.fn(async () => ({
      id: 1,
      role: "Agent Fokontany",
      fokontany: "Test",
    })),
    pull: jest.fn(async () => ({
      scope,
      cursor: { version: 0, scope },
      items: [],
      has_more: false,
    })),
    push: jest.fn(async (records) => ({
      results: records.map((r, index) => ({
        index,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        status: "accepted",
        code: "applied",
      })),
    })),
  };
}
async function client(shared = adapters(), backend = api(), id = 1) {
  const store = new SecureStore(
    shared.storage,
    shared.vault,
    "https://commune.example/api",
    id,
  );
  const engine = new OfflineEngine({
    store,
    api: backend,
    user: { id, role: "Agent Fokontany" },
  });
  await engine.init();
  await engine.setOnline(true);
  engine.setOnline(false);
  return { engine, shared, backend, store };
}
const person = { nom: "RAKOTO", prenom: "Jean", telephone: "0340000000" };

test("checksum matches the backend canonical JSON contract", () => {
  expect(
    canonical({ telephone: "0340000000", prenom: "Élodie", nom: "RAKOTO" }),
  ).toBe('{"nom":"RAKOTO","prenom":"Élodie","telephone":"0340000000"}');
  expect(digest("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
test("offline writes survive re-instantiation and separate accounts", async () => {
  const { engine, shared, backend } = await client();
  const id = await engine.enqueue("citoyen", person);
  expect(engine.snapshot().pending).toBe(1);
  const saved = engine.state.outbox[0];
  expect([...shared.values.values()].join("")).not.toContain("RAKOTO");
  await engine.dispose();
  const reloaded = await client(shared, backend); // reconnect commits the same record
  expect(backend.push).toHaveBeenCalledWith([saved.record]);
  expect(reloaded.engine.snapshot().pending).toBe(0);
  expect(reloaded.engine.list("citoyen").some((r) => r.id === id)).toBe(true);
  const other = new SecureStore(
    shared.storage,
    shared.vault,
    "https://commune.example/api",
    2,
  );
  await other.init();
  expect(await other.read()).toBeNull();
});
test("incomplete acknowledgment never removes the queue", async () => {
  const { engine, backend } = await client();
  await engine.enqueue("citoyen", person);
  backend.push.mockResolvedValue({ results: [] });
  await engine.setOnline(true);
  expect(engine.snapshot().pending).toBe(1);
  expect(engine.snapshot().error).toContain("incomplet");
});
test("a new edit during an in-flight push is not swallowed by the old acknowledgment", async () => {
  const { engine, backend } = await client();
  const id = await engine.enqueue("citoyen", person);
  let release, start;
  const started = new Promise((resolve) => {
    start = resolve;
  });
  backend.push.mockImplementationOnce(
    (records) =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            results: records.map((r, index) => ({
              ...r,
              index,
              status: "accepted",
              code: "applied",
            })),
          });
        start();
      }),
  );
  const sync = engine.setOnline(true);
  await started;
  await engine.enqueue("citoyen", { nom: "NOUVEAU" }, id);
  engine.setOnline(false);
  release();
  await sync;
  expect(engine.snapshot().pending).toBe(1);
  expect(engine.state.outbox[0].record.data.nom).toBe("NOUVEAU");
});
test("citizens are acknowledged before dependent civil records are sent", async () => {
  const { engine, backend } = await client();
  const id = await engine.enqueue("citoyen", person);
  await engine.enqueue("acte", {
    type_acte: "Naissance",
    nom_concerne: "Jean",
    date_evenement: "2024-01-02",
    citoyen_id: id,
  });
  await engine.setOnline(true);
  expect(
    backend.push.mock.calls.map(([batch]) => batch.map((r) => r.entity_type)),
  ).toEqual([["citoyen"], ["acte"]]);
});
test("conflicts stay visible without automatic overwriting and can be discarded", async () => {
  const { engine, backend } = await client();
  const id = await engine.enqueue("citoyen", person);
  backend.push.mockImplementation(async (records) => ({
    results: records.map((r, index) => ({
      ...r,
      index,
      status: "conflicts",
      code: "server_newer",
    })),
  }));
  await engine.setOnline(true);
  expect(engine.snapshot().issues[0].issue).toBe("server_newer");
  await engine.synchronize();
  expect(backend.push).toHaveBeenCalledTimes(1);
  await expect(engine.retry("citoyen", id)).rejects.toThrow("Consultez");
  await engine.discard("citoyen", id);
  expect(engine.snapshot().issues).toEqual([]);
});
test("scope changes purge old data and queued mutations before sending", async () => {
  const { engine, backend } = await client();
  await engine.enqueue("citoyen", person);
  const changed = "b".repeat(64);
  backend.pull.mockResolvedValue({
    scope: changed,
    cursor: { version: 0, scope: changed },
    items: [],
    has_more: false,
  });
  await engine.setOnline(true);
  expect(backend.push).not.toHaveBeenCalled();
  expect(engine.snapshot().citizens).toEqual([]);
  expect(engine.snapshot().notice).toContain("réinitialisé");
});
test("late network replies after logout cannot resurrect storage", async () => {
  const { engine, backend, store } = await client();
  await engine.enqueue("citoyen", person);
  let release, start;
  const started = new Promise((resolve) => {
    start = resolve;
  });
  backend.push.mockImplementationOnce(
    (records) =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            results: records.map((r, index) => ({
              ...r,
              index,
              status: "accepted",
              code: "applied",
            })),
          });
        start();
      }),
  );
  const syncing = engine.setOnline(true);
  await started;
  await engine.dispose({ purge: true });
  release();
  await syncing;
  expect(await store.storage.getItem(store.name)).toBeNull();
  expect(await store.vault.get(store.name)).toBeNull();
});
test("failed manifest writes preserve the prior encrypted generation", async () => {
  const shared = adapters(),
    store = new SecureStore(
      shared.storage,
      shared.vault,
      "https://example/api",
      1,
    );
  await store.init();
  await store.write({ name: "previous" });
  const set = shared.storage.setItem;
  shared.storage.setItem = async (k, v) => {
    if (k === store.name) throw new Error("disk full");
    return set(k, v);
  };
  await expect(store.write({ name: "new" })).rejects.toThrow("disk full");
  expect(await store.read()).toEqual({ name: "previous" });
});
test("ciphertext tampering and lost keys fail closed without replacing data", async () => {
  const shared = adapters(),
    store = new SecureStore(
      shared.storage,
      shared.vault,
      "https://example/api",
      1,
    );
  await store.init();
  await store.write({ personal: "private" });
  const manifest = JSON.parse(shared.values.get(store.name));
  shared.values.set(`${store.name}:${manifest.id}:0`, "AAAA");
  await expect(store.read()).rejects.toThrow("illisible");
  shared.keys.clear();
  const missing = new SecureStore(
    shared.storage,
    shared.vault,
    "https://example/api",
    1,
  );
  await expect(missing.init()).rejects.toThrow("Clé locale absente");
});

test("unchanged periodic sync does not rewrite the encrypted database", async () => {
  const { engine, store } = await client();
  const spy = jest.spyOn(store, "write");
  await engine.setOnline(true);
  expect(spy).not.toHaveBeenCalled();
});
test("a removal clears local data and dependent queued records", async () => {
  const { engine, backend } = await client();
  const id = await engine.enqueue("citoyen", person);
  await engine.enqueue("acte", {
    type_acte: "Naissance",
    nom_concerne: "Jean",
    date_evenement: "2024-01-02",
    citoyen_id: id,
  });
  backend.pull.mockImplementation(async (type) => ({
    scope,
    cursor: { version: 1, scope },
    has_more: false,
    items:
      type === "citoyen"
        ? [
            {
              entity_id: id,
              version: 1,
              data: null,
              metadata: { removed: true },
            },
          ]
        : [],
  }));
  await engine.setOnline(true);
  expect(engine.snapshot().pending).toBe(0);
  expect(engine.list("citoyen")).toEqual([]);
  expect(backend.push).not.toHaveBeenCalled();
});
test("permission loss locks the session even if persistent storage is full", async () => {
  const { engine, backend, store } = await client();
  await engine.enqueue("citoyen", person);
  engine.onAuth = jest.fn();
  jest.spyOn(store, "write").mockRejectedValue(new Error("disk full"));
  backend.me.mockRejectedValue(
    Object.assign(new Error("Denied"), { status: 403 }),
  );
  await engine.setOnline(true);
  expect(engine.onAuth).toHaveBeenCalled();
  expect(engine.snapshot().citizens).toEqual([]);
});

test("closing a session cannot falsely acknowledge a not-yet-persisted local save", async () => {
  const { engine, store } = await client();
  const saving = engine.enqueue("citoyen", person);
  const failure = expect(saving).rejects.toThrow("Session fermée");
  await engine.dispose();
  await failure;
  expect((await store.read()).outbox).toEqual([]);
});
test("encrypted generations span multiple bounded chunks and clean old chunks", async () => {
  const shared = adapters(),
    store = new SecureStore(
      shared.storage,
      shared.vault,
      "https://example/api",
      1,
    );
  await store.init();
  await store.write({ data: "é".repeat(300000) });
  const first = JSON.parse(shared.values.get(store.name));
  expect(first.chunks).toBeGreaterThan(1);
  expect((await store.read()).data.length).toBe(300000);
  await store.write({ data: "replacement" });
  expect([...shared.values.keys()].some((k) => k.includes(first.id))).toBe(
    false,
  );
});

test("a fresh device cannot create offline before learning its scope", async () => {
  const shared = adapters();
  const engine = new OfflineEngine({
    store: new SecureStore(
      shared.storage,
      shared.vault,
      "https://example/api",
      1,
    ),
    api: api(),
    user: { id: 1, role: "Agent Fokontany" },
  });
  await engine.init();
  await expect(engine.enqueue("citoyen", person)).rejects.toThrow(
    "première synchronisation",
  );
  expect(engine.snapshot().pending).toBe(0);
});
