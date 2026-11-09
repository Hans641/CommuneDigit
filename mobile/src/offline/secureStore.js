import { utf8ToBytes } from "@noble/hashes/utils";
import {
  digest,
  uuid,
  randomBytes,
  base64,
  unbase64,
  seal,
  open,
} from "./crypto";

// A manifest swap commits a whole encrypted generation. Interrupted writes keep the previous one.
export class SecureStore {
  constructor(storage, vault, backend, userId) {
    this.storage = storage;
    this.vault = vault;
    this.name = "commune-offline-v1:" + digest(backend + ":" + userId);
  }
  async init() {
    const key = await this.vault.get(this.name);
    const manifest = await this.storage.getItem(this.name);
    if (!key && manifest)
      throw new Error(
        "Clé locale absente : données conservées, restauration nécessaire",
      );
    this.key = key ? unbase64(key) : randomBytes(32);
    if (!key) await this.vault.set(this.name, base64(this.key));
  }
  async read() {
    const raw = await this.storage.getItem(this.name);
    if (!raw) {
      await this.cleanup(null);
      return null;
    }
    try {
      const m = JSON.parse(raw);
      if (
        m.v !== 1 ||
        !Number.isInteger(m.chunks) ||
        m.chunks < 1 ||
        m.chunks > 100
      )
        throw new Error();
      const chunks = await Promise.all(
        Array.from({ length: m.chunks }, (_, i) =>
          this.storage.getItem(`${this.name}:${m.id}:${i}`),
        ),
      );
      if (chunks.some((c) => c === null)) throw new Error();
      const value = open(
        { nonce: m.nonce, data: chunks.join("") },
        this.key,
        this.name + ":" + m.id,
      );
      await this.cleanup(m.id);
      return value;
    } catch {
      throw new Error(
        "Stockage local illisible : aucune donnée n’a été écrasée",
      );
    }
  }
  async write(state) {
    const text = JSON.stringify(state);
    if (utf8ToBytes(text).length > 8 * 1024 * 1024)
      throw new Error(
        "Cache local plein ; modifications conservées, synchronisation interrompue",
      );
    const id = uuid();
    const envelope = seal(state, this.key, this.name + ":" + id);
    const previous = await this.storage.getItem(this.name);
    const parts = envelope.data.match(/.{1,200000}/g);
    const keys = parts.map((_, i) => `${this.name}:${id}:${i}`);
    try {
      for (let i = 0; i < parts.length; i++)
        await this.storage.setItem(keys[i], parts[i]);
      await this.storage.setItem(
        this.name,
        JSON.stringify({
          v: 1,
          id,
          chunks: parts.length,
          nonce: envelope.nonce,
        }),
      );
    } catch (error) {
      // Never remove a generation whose manifest may already have committed.
      const current = await this.storage.getItem(this.name).catch(() => null);
      if (!current || JSON.parse(current).id !== id)
        await Promise.all(
          keys.map((k) => this.storage.removeItem(k).catch(() => {})),
        );
      throw error;
    }
    if (previous) {
      const old = JSON.parse(previous);
      await Promise.all(
        Array.from({ length: old.chunks }, (_, i) =>
          this.storage
            .removeItem(`${this.name}:${old.id}:${i}`)
            .catch(() => {}),
        ),
      );
    }
  }
  async cleanup(currentId) {
    const keys = await this.storage.getAllKeys();
    await Promise.all(
      keys
        .filter(
          (k) =>
            k.startsWith(this.name + ":") &&
            (!currentId || !k.startsWith(`${this.name}:${currentId}:`)),
        )
        .map((k) => this.storage.removeItem(k).catch(() => {})),
    );
  }
  async clear() {
    try {
      const keys = await this.storage.getAllKeys();
      for (const key of keys.filter(
        (k) => k === this.name || k.startsWith(this.name + ":"),
      ))
        await this.storage.removeItem(key);
    } finally {
      await this.vault.remove(this.name);
      this.key = null;
    }
  }
}
