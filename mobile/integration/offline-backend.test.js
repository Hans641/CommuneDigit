import { OfflineEngine } from "../src/offline/engine";
import { SecureStore } from "../src/offline/secureStore";
import { createSyncAPI } from "../src/services/api";

const base = process.env.MOBILE_TEST_API_URL;
if (!base)
  throw new Error("MOBILE_TEST_API_URL must point to a disposable test API");
function storage() {
  const data = new Map(),
    keys = new Map();
  return {
    storage: {
      getItem: async (k) => data.get(k) ?? null,
      setItem: async (k, v) => data.set(k, v),
      removeItem: async (k) => data.delete(k),
      getAllKeys: async () => [...data.keys()],
    },
    vault: {
      get: async (k) => keys.get(k) ?? null,
      set: async (k, v) => keys.set(k, v),
      remove: async (k) => keys.delete(k),
    },
  };
}
test("lost response, restart, dependent record, and real backend conflict", async () => {
  const login = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "AGT-0002", password: "agent123" }),
  });
  expect(login.status).toBe(200);
  const session = await login.json(),
    api = createSyncAPI(base, session.access_token),
    shared = storage();
  const make = async () => {
    const store = new SecureStore(
      shared.storage,
      shared.vault,
      base,
      session.user.id,
    );
    const client = new OfflineEngine({ store, api, user: session.user });
    await client.init();
    return client;
  };
  let engine = await make();
  await engine.setOnline(true);
  engine.setOnline(false);
  const cid = await engine.enqueue("citoyen", {
    nom: "MOBILE-TEST",
    prenom: "Offline",
    telephone: "0340000000",
    fokontany_id: null,
  });
  const aid = await engine.enqueue("acte", {
    type_acte: "Naissance",
    nom_concerne: "Offline",
    date_evenement: "2024-01-02",
    citoyen_id: cid,
  });
  const original = engine.state.outbox.map((o) => o.record);
  await engine.dispose();
  engine = await make();
  expect(engine.state.outbox.map((o) => o.record)).toEqual(original);
  const push = api.push;
  api.push = async (records) => {
    api.push = push;
    await push(records);
    throw new Error("Simulated lost response after server commit");
  };
  await engine.setOnline(true);
  expect(engine.snapshot().pending).toBe(2);
  await engine.dispose();
  engine = await make();
  await engine.setOnline(true);
  expect(engine.snapshot().pending).toBe(0);
  expect(engine.snapshot().issues).toEqual([]);
  expect(engine.list("citoyen").filter((c) => c.id === cid)).toHaveLength(1);
  expect(engine.list("acte").find((a) => a.id === aid).citoyen_id).toBe(cid);
  engine.setOnline(false);
  await engine.enqueue("citoyen", { nom: "LOCAL-CONFLICT" }, cid);
  const server = await fetch(base + "/citoyens/" + cid, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session.access_token,
    },
    body: JSON.stringify({ nom: "SERVER-VERSION" }),
  });
  expect(server.status).toBe(200);
  await engine.setOnline(true);
  expect(engine.snapshot().issues[0].issue).toBe("server_newer");
  expect(engine.list("citoyen").find((c) => c.id === cid).nom).toBe(
    "LOCAL-CONFLICT",
  );
  await engine.discard("citoyen", cid);
  expect(engine.list("citoyen").find((c) => c.id === cid).nom).toBe(
    "SERVER-VERSION",
  );
  await engine.dispose({ purge: true });
});
