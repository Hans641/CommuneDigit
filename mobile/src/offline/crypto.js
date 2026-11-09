import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { gcm } from "@noble/ciphers/aes";
import { encode, decode } from "base-64";

export const digest = (text) => bytesToHex(sha256(utf8ToBytes(text)));
export const canonical = (data) =>
  JSON.stringify(
    Object.fromEntries(
      Object.keys(data)
        .sort()
        .map((k) => [k, data[k]]),
    ),
  );
export function randomBytes(size) {
  if (!global.crypto?.getRandomValues)
    throw new Error("Générateur aléatoire sécurisé indisponible");
  return global.crypto.getRandomValues(new Uint8Array(size));
}
export function uuid() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function base64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return encode(binary);
}
export const unbase64 = (value) =>
  Uint8Array.from(decode(value), (c) => c.charCodeAt(0));
export function seal(value, key, context) {
  const nonce = randomBytes(12);
  return {
    nonce: base64(nonce),
    data: base64(
      gcm(key, nonce, utf8ToBytes(context)).encrypt(
        utf8ToBytes(JSON.stringify(value)),
      ),
    ),
  };
}
export function open(envelope, key, context) {
  const plain = gcm(
    key,
    unbase64(envelope.nonce),
    utf8ToBytes(context),
  ).decrypt(unbase64(envelope.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
export function tokenValid(token, now = Date.now()) {
  try {
    const body = JSON.parse(
      decode(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return Number.isFinite(body.exp) && body.exp * 1000 > now;
  } catch {
    return false;
  }
}
